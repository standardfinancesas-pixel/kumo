import { NextResponse } from 'next/server';
import { diasHasta, hoyISO, diaISO, DIAS_AVISO_CARNET } from '@kumo/shared';
import { getServiceClient } from '@/lib/supabase-service';
import { mandarPush, CON_ACCESO } from '@/lib/push';
import { sendVacunaProxima } from '@/lib/mail';

/**
 * Recordatorio de vacunas por vencer. Lo llama el cron de Vercel una vez por día,
 * a las 12:00 UTC — o sea 09:00 de Buenos Aires, a una hora en la que se puede
 * llamar a la veterinaria. La agenda vive en `apps/web/vercel.json`, junto con
 * `regions: ["gru1"]`: la función corría en Virginia con Supabase en San Pablo, y
 * cada consulta cruzaba el continente.
 *
 * Hasta acá el aviso de vacuna existía solo DENTRO de la app y se calculaba cuando
 * el socio la abría: a quien no entraba no le llegaba nada, que es justo el caso
 * que un recordatorio tiene que cubrir. Ahora sale push + mail.
 *
 * La marca de "ya avisado" vive en `vaccine_reminders` y es por vacuna: el cron
 * corre todos los días y sin eso el socio recibiría el mismo aviso cada mañana
 * durante un mes. Si la vacuna se aplica o se reprograma, un trigger borra la
 * marca y el aviso vuelve a habilitarse para la fecha nueva.
 */

/** La misma ventana que usa la campanita de la app (`DIAS_AVISO_CARNET`), para
 *  que el aviso de adentro y el del teléfono no se contradigan. */
const DIAS_ANTES = DIAS_AVISO_CARNET;

export async function GET(req: Request) {
  /*
   * Vercel manda sus crons con `Authorization: Bearer $CRON_SECRET`. Sin el
   * chequeo, cualquiera que conozca la URL puede disparar avisos a todos los
   * socios; y si la variable no está configurada, el endpoint queda abierto. Así
   * que en producción sin secreto no corre: es preferible un cron que no funciona
   * y avisa, a uno que cualquiera puede gatillar.
   */
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Falta CRON_SECRET en el entorno.' }, { status: 500 });
    }
  } else if (req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const svc = getServiceClient();

  // Todo lo pendiente con vencimiento en la ventana, con dueño y mascota.
  const { data: filas, error } = await svc
    .from('vaccinations')
    .select('id, name, due_on, pets(name, owner_id, profiles!pets_owner_id_fkey(full_name, email, status))')
    .eq('status', 'pendiente')
    .not('due_on', 'is', null)
    .gte('due_on', hoyISO())
    // El fin de la ventana, en días argentinos: con el día UTC, entre las 21:00 y
    // la medianoche el cron miraba un día de más.
    .lte('due_on', diaISO(new Date(Date.now() + (DIAS_ANTES + 1) * 86400000).toISOString()));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: yaAvisadas } = await svc.from('vaccine_reminders').select('vaccination_id');
  const avisadas = new Set((yaAvisadas ?? []).map((v) => v.vaccination_id as string));

  type Perfil = { full_name: string; email: string; status: string };
  type Mascota = { name: string; owner_id: string; profiles: Perfil | Perfil[] | null };
  type Fila = { id: string; name: string; due_on: string; pets: Mascota | Mascota[] | null };

  let avisos = 0, mails = 0, pushes = 0;
  const saltadas: string[] = [];

  for (const f of (filas ?? []) as Fila[]) {
    if (avisadas.has(f.id)) continue;
    const dias = diasHasta(f.due_on);
    if (dias < 0 || dias > DIAS_ANTES) continue;

    const mascota = Array.isArray(f.pets) ? f.pets[0] : f.pets;
    const perfil = mascota && (Array.isArray(mascota.profiles) ? mascota.profiles[0] : mascota.profiles);
    if (!mascota || !perfil) { saltadas.push(f.id); continue; }
    // Al que no tiene acceso no se le recuerda nada: no tiene cobertura. Va por
    // lista blanca, igual que `tiene_acceso()` en la base y `CON_ACCESO` en el
    // envío del panel: un estado nuevo no empieza a recibir avisos por descuido.
    if (!CON_ACCESO.includes(perfil.status)) continue;

    const firstName = perfil.full_name?.trim().split(' ')[0] || 'Hola';
    const fecha = fmtFecha(f.due_on);

    const { data: tokens } = await svc.from('push_tokens').select('token').eq('member_id', mascota.owner_id);
    if (tokens?.length) {
      const r = await mandarPush(
        tokens.map((t) => t.token as string),
        `A ${mascota.name} le toca la ${f.name.toLowerCase()}`,
        dias === 0 ? `Vence hoy. Reservá turno en tu veterinaria.` : `Vence ${dias === 1 ? 'mañana' : `en ${dias} días`} (${fecha}).`,
        { pantalla: 'carnet' },
      );
      pushes += r.entregados;
    }

    if (perfil.email) {
      const r = await sendVacunaProxima({ to: perfil.email, firstName, petName: mascota.name, vacuna: f.name, fecha, dias });
      if ('ok' in r && r.ok) mails++;
    }

    // La marca se escribe aunque el push no haya salido: el mail ya salió, y
    // repetir el mail todos los días es peor que perder un push.
    await svc.from('vaccine_reminders').insert({ vaccination_id: f.id, due_on: f.due_on });
    avisos++;
  }

  return NextResponse.json({ ok: true, avisos, mails, pushes, saltadas: saltadas.length });
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtFecha(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[(m ?? 1) - 1]} ${a}`;
}
