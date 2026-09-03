import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { sendReintegroResuelto } from '@/lib/mail';
import { mandarPush } from '@/lib/push';

/**
 * Resuelve un reintegro (acreditar o rechazar) y le avisa al socio por mail.
 *
 * Está en el servidor porque la API key de Resend no puede llegar al navegador.
 * De paso, resolver y avisar quedan en una sola operación: antes el admin
 * actualizaba el estado desde el cliente y el socio no se enteraba de nada.
 *
 * La autorización la hace la RLS: la política de update de `reimbursements` es
 * solo para admin, así que un socio no puede tocar esto ni conociendo el id.
 */
export async function POST(req: Request) {
  const { id, status } = (await req.json()) as { id?: string; status?: string };
  if (!id || (status !== 'acreditado' && status !== 'rechazado')) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede resolver reintegros.' }, { status: 403 });

  // El update devuelve la fila: si vuelve vacía, la RLS lo bloqueó.
  const { data: fila, error } = await supabase
    .from('reimbursements')
    // La fecha de resolucion: es el unico lugar donde un reintegro cambia de
    // estado, asi que es el unico que puede saberla.
    .update({ status, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .select('member_id, provider_name, concept, amount, refund, profiles(email, full_name)')
    .single();

  if (error || !fila) {
    return NextResponse.json({ error: 'No pudimos actualizar la solicitud.' }, { status: 500 });
  }

  const socio = Array.isArray(fila.profiles) ? fila.profiles[0] : fila.profiles;

  /*
   * El mismo aviso, por el otro canal.
   *
   * La campanita de la app ya lo mostraba, pero solo si el socio entraba. El
   * mail sale siempre y el push sale si tiene la app con las notificaciones
   * prendidas: si las apagó no hay token, así que no hay nada que mandar y no
   * hace falta preguntar nada acá.
   *
   * Los tokens se leen con la sesión del admin: la política de `push_tokens`
   * deja leerlos a un admin, así que no hace falta la service-role key.
   */
  const { data: tokens } = await supabase.from('push_tokens').select('token').eq('member_id', fila.member_id);
  let pushEntregados = 0;
  if (tokens?.length) {
    const r = await mandarPush(
      tokens.map((t) => t.token as string),
      /* "Aprobado" y no "acreditado": la transferencia tarda hasta 30 días y el
         push decía que la plata ya estaba. El mail siempre avisó el plazo. */
      status === 'acreditado' ? 'Aprobamos tu reintegro' : 'No pudimos aprobar tu reintegro',
      status === 'acreditado'
        ? `$${fila.refund.toLocaleString('es-AR')} por ${fila.concept.toLowerCase()} en ${fila.provider_name}. Se acredita en tu CBU dentro de los 30 días.`
        : `Mirá el detalle de ${fila.concept.toLowerCase()} en ${fila.provider_name} en la app.`,
      { pantalla: 'reintegros' },
    );
    pushEntregados = r.entregados;
  }
  let mailEnviado = false;
  if (socio?.email) {
    const r = await sendReintegroResuelto({
      to: socio.email,
      firstName: socio.full_name?.split(' ')[0] || 'Hola',
      acreditado: status === 'acreditado',
      providerName: fila.provider_name,
      concept: fila.concept,
      amount: fila.amount,
      refund: fila.refund,
    });
    mailEnviado = 'ok' in r && r.ok === true;
  }

  // El reintegro ya quedó resuelto aunque el mail no salga: se informa para que
  // el panel pueda avisarlo, no para revertir la operación.
  return NextResponse.json({ ok: true, mailEnviado, pushEntregados });
}
