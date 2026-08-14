import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';
import { sendNegocioPublicado, sendNegocioRechazado } from '@/lib/mail';
import { mandarPush } from '@/lib/push';

/**
 * El club publica o rechaza un negocio, y le avisa al dueño.
 *
 * Igual que el resolver de reintegros: el cambio de estado y el mail quedan en la
 * misma operación. Antes el admin cambiaba `providers.status` desde el cliente y
 * el prestador no se enteraba de nada — se quedaba mirando "en revisión" sin
 * saber que ya estaba publicado.
 *
 * La autorización la hace la RLS (la política de update de `providers` es de
 * admin o del dueño) más el chequeo de rol de acá, porque el dueño no puede
 * publicarse a sí mismo.
 */
export async function POST(req: Request) {
  const { id, status } = (await req.json()) as { id?: string; status?: string };
  if (!id || (status !== 'verificado' && status !== 'rechazado')) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede resolver negocios.' }, { status: 403 });

  const { data: fila, error } = await supabase
    .from('providers')
    .update({ status })
    .eq('id', id)
    .select('name, owner_id')
    .single();
  if (error || !fila) return NextResponse.json({ error: 'No pudimos actualizar el negocio.' }, { status: 500 });

  /*
   * A quién se le avisa: al mail del perfil del dueño.
   *
   * Un negocio puede no tener dueño —`providers.owner_id` es nullable y los que
   * cargó el club a mano lo tienen en null—, y en ese caso no hay dirección a la
   * que escribir. Se responde ok con `mailEnviado: false` y el motivo, así el
   * panel lo puede decir en vez de dar por hecho que el prestador se enteró.
   */
  if (!fila.owner_id) {
    return NextResponse.json({ ok: true, mailEnviado: false, motivo: 'El negocio no tiene una cuenta asociada, así que no hay a quién escribirle.' });
  }

  const { data: dueño } = await getServiceClient()
    .from('profiles')
    .select('email, full_name')
    .eq('id', fila.owner_id)
    .single();
  if (!dueño?.email) {
    return NextResponse.json({ ok: true, mailEnviado: false, motivo: 'El dueño del negocio no tiene mail en su perfil.' });
  }

  const opts = { to: dueño.email, firstName: dueño.full_name?.split(' ')[0] || 'Hola', negocio: fila.name };
  const res = status === 'verificado' ? await sendNegocioPublicado(opts) : await sendNegocioRechazado(opts);

  // Y el mismo aviso al teléfono, si tiene la app con las notificaciones
  // prendidas. Sin token no hay nada que mandar: es lo que apaga el switch de la
  // pantalla de Notificaciones.
  const { data: tokens } = await supabase.from('push_tokens').select('token').eq('member_id', fila.owner_id);
  let pushEntregados = 0;
  if (tokens?.length) {
    const r = await mandarPush(
      tokens.map((t) => t.token as string),
      status === 'verificado' ? 'Tu negocio ya está publicado' : 'No pudimos publicar tu negocio',
      status === 'verificado'
        ? `${fila.name} ya aparece en Servicios para todos los socios.`
        : `Entrá a Mi negocio para ver qué falta en ${fila.name}.`,
      { pantalla: 'minegocio' },
    );
    pushEntregados = r.entregados;
  }

  return NextResponse.json({ ok: true, mailEnviado: 'ok' in res && res.ok === true, pushEntregados });
}
