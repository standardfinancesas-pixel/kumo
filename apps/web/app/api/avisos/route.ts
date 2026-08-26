import { NextResponse } from 'next/server';
import { hoyISO } from '@kumo/shared';
import { getServiceClient } from '@/lib/supabase-service';
import { quienPide } from '@/lib/quien-pide';
import { sendReintegroRecibido, sendNegocioRecibido, sendBajaMembresia, sendAdminBajaMembresia } from '@/lib/mail';

/**
 * Los mails que dispara una acción del socio: pidió un reintegro, dio de alta su
 * negocio, se dio de baja.
 *
 * Está en un route handler y no en el cliente porque la API key de Resend es de
 * servidor. Las escrituras siguen pasando por Supabase desde la app (la RLS ya
 * las cubre) y acá solo se avisa: si el mail falla, la operación del socio no se
 * cae con él.
 *
 * Todo lo que se cuenta en el mail se lee de la base con el service client, no
 * del body: el pedido trae un id y nada más. Y antes de leer se verifica que la
 * fila sea de quien pide, porque el service client ignora la RLS. Sin ese chequeo
 * cualquier socio con sesión podría pedir el aviso de un reintegro ajeno y
 * enterarse de cuánto gastó otro.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "13 ago 2026" a partir de un "YYYY-MM-DD". */
function fechaLegible(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[(m ?? 1) - 1]} ${a}`;
}

const nombreDePila = (nombre: string | null) => nombre?.trim().split(' ')[0] || 'Hola';

type Pedido = { tipo?: string; id?: string };

export async function POST(req: Request) {
  const { tipo, id } = (await req.json()) as Pedido;
  const quien = await quienPide(req);
  if (!quien) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const svc = getServiceClient();
  const { data: perfil } = await svc
    .from('profiles')
    // `member_no`, el plan y el estado de la suscripción los usa el aviso al club:
    // sin ellos el mail diría "un socio se dio de baja" sin decir cuál ni de qué.
    .select('email, full_name, member_no, status, created_at, mp_subscription_status, plans(name)')
    .eq('id', quien.id)
    .single();
  if (!perfil?.email) return NextResponse.json({ error: 'Sin perfil.' }, { status: 404 });
  const firstName = nombreDePila(perfil.full_name);

  if (tipo === 'reintegro-recibido') {
    if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
    const { data: r } = await svc
      .from('reimbursements')
      .select('member_id, provider_name, concept, amount')
      .eq('id', id)
      .single();
    // El reintegro tiene que ser del que pide: el service client no chequea RLS.
    if (!r || r.member_id !== quien.id) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
    const res = await sendReintegroRecibido({
      to: perfil.email, firstName, providerName: r.provider_name, concept: r.concept, amount: r.amount,
    });
    return NextResponse.json({ ok: true, mailEnviado: 'ok' in res && res.ok === true });
  }

  if (tipo === 'negocio-recibido') {
    if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
    const { data: n } = await svc.from('providers').select('owner_id, name').eq('id', id).single();
    if (!n || n.owner_id !== quien.id) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
    const res = await sendNegocioRecibido({ to: perfil.email, firstName, negocio: n.name });
    return NextResponse.json({ ok: true, mailEnviado: 'ok' in res && res.ok === true });
  }

  if (tipo === 'baja') {
    // Solo se avisa una baja que pasó de verdad. Si la fila sigue activa, el
    // mail estaría certificando algo falso justo donde más importa.
    if (perfil.status !== 'baja') return NextResponse.json({ error: 'La membresía no está de baja.' }, { status: 409 });
    const { data: mascotas } = await svc.from('pets').select('name').eq('owner_id', quien.id);
    const nombres = (mascotas ?? []).map((m) => m.name);
    // Los 10 días de la Ley 24.240 se cuentan desde el alta. Se calcula acá y no
    // se recibe del cliente: define si se promete una devolución.
    const dias = (Date.now() - Date.parse(perfil.created_at)) / 86400000;
    const res = await sendBajaMembresia({
      to: perfil.email,
      firstName,
      petNames: nombres.length === 0 ? 'tu mascota'
        : nombres.length === 1 ? nombres[0]!
        : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`,
      hasta: fechaLegible(hoyISO()),
      dentroDeLos10Dias: dias <= 10,
    });
    /*
     * Y al club, que hasta ahora no se enteraba de nada.
     *
     * La baja es la señal de churn más importante del negocio y solo cambiaba un
     * campo en silencio: había que entrar al panel y notarlo. Un socio que se va
     * recién todavía se puede recuperar; uno que se fue hace tres semanas, no.
     *
     * Sin `await`: la respuesta al socio no espera un aviso interno.
     */
    void sendAdminBajaMembresia({
      socio: perfil.full_name?.trim() || firstName,
      memberNo: perfil.member_no ?? null,
      email: perfil.email,
      plan: perfil.plans ? (Array.isArray(perfil.plans) ? perfil.plans[0]?.name : (perfil.plans as { name: string }).name) ?? null : null,
      debitoCancelado: perfil.mp_subscription_status === 'cancelled',
    });
    return NextResponse.json({ ok: true, mailEnviado: 'ok' in res && res.ok === true });
  }

  return NextResponse.json({ error: 'Aviso desconocido.' }, { status: 400 });
}
