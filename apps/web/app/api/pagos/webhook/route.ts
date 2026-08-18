import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';
import { firmaValida, traerDebito, traerSuscripcion } from '@/lib/mp';

/**
 * El aviso de Mercado Pago: es lo único que da acceso al club.
 *
 * La vuelta del navegador (`/app?suscripcion=ok`) es un cartel y nada más: la
 * puede escribir cualquiera en la barra de direcciones, y además el socio puede
 * autorizar y cerrar el navegador antes de volver. Acreditar por el redirect sería
 * regalar el acceso a quien tipee la URL y dejar afuera al que pagó bien.
 *
 * Con débito automático llegan dos familias de avisos:
 *
 *  · `subscription_preapproval` — la suscripción cambió de estado: el socio la
 *    autorizó, la pausó, la dio de baja. No es plata, es permiso.
 *  · `subscription_authorized_payment` — un débito mensual. ESTE es el que
 *    acredita, y sólo si el pago de adentro salió aprobado: si la tarjeta rebotó,
 *    el aviso llega igual y acreditar sería regalar un mes.
 *
 * Tres cosas que hay que hacer bien, y las tres son por seguridad o por
 * concurrencia:
 *
 *  1. Verificar la firma. Sin eso, cualquiera que conozca esta URL puede avisar
 *     "el socio tal pagó".
 *  2. No creerle al cuerpo del aviso. Trae sólo un id; el estado y el monto se los
 *     preguntamos a Mercado Pago con ese id.
 *  3. Ser idempotente. MP reintenta, y manda más de un evento por el mismo débito.
 *     La acreditación vive en `acreditar_cuota()`, que bloquea el perfil y suma una
 *     sola vez.
 *
 * Siempre 200, salvo que la firma falle o que no hayamos podido consultar: un 500
 * hace que MP reintente, y eso sólo tiene sentido cuando el problema es nuestro y
 * puede pasar.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const cuerpo = (await req.json().catch(() => ({}))) as {
    type?: string;
    action?: string;
    data?: { id?: string | number };
  };

  const dataId = String(cuerpo.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '');
  const tipo = cuerpo.type ?? url.searchParams.get('type') ?? '';

  const firma = firmaValida({
    signature: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    dataId,
  });
  if (!firma.ok) {
    console.error('[pagos/webhook] firma rechazada:', firma.motivo);
    return NextResponse.json({ error: 'Aviso no verificado.' }, { status: 401 });
  }
  if (!dataId) return NextResponse.json({ ok: true, ignorado: 'sin id' });

  const svc = getServiceClient();

  // ── La suscripción cambió de estado ──
  if (tipo === 'subscription_preapproval' || tipo === 'preapproval') {
    let sus;
    try {
      sus = await traerSuscripcion(dataId);
    } catch (e) {
      console.error('[pagos/webhook] no pudimos traer la suscripción', dataId, e);
      return NextResponse.json({ error: 'No pudimos consultar la suscripción.' }, { status: 500 });
    }
    // `external_reference` es el id del socio (lo pusimos al crearla).
    if (!sus.external_reference) {
      console.error('[pagos/webhook] suscripción sin external_reference', sus.id);
      return NextResponse.json({ ok: true, ignorado: 'sin referencia' });
    }
    await svc.rpc('marcar_suscripcion', {
      p_member_id: sus.external_reference,
      p_preapproval_id: sus.id,
      p_status: sus.status,
    });
    console.log('[pagos/webhook] suscripción', sus.id, '→', sus.status);
    // Ojo: autorizada NO es pagada. El acceso lo da el primer débito, que llega
    // como `subscription_authorized_payment`.
    return NextResponse.json({ ok: true, suscripcion: sus.status });
  }

  // ── Un débito mensual ──
  if (tipo === 'subscription_authorized_payment') {
    let debito;
    try {
      debito = await traerDebito(dataId);
    } catch (e) {
      console.error('[pagos/webhook] no pudimos traer el débito', dataId, e);
      return NextResponse.json({ error: 'No pudimos consultar el débito.' }, { status: 500 });
    }

    const pagoOk = debito.payment?.status === 'approved';
    const socio = await svc.from('profiles').select('id').eq('mp_preapproval_id', debito.preapproval_id).maybeSingle();
    if (!socio.data) {
      console.error('[pagos/webhook] no encontramos socio para la suscripción', debito.preapproval_id);
      return NextResponse.json({ ok: true, ignorado: 'suscripción desconocida' });
    }

    if (!pagoOk) {
      // La tarjeta rebotó o el débito está agendado. No se acredita nada, pero
      // queda la fila: es lo que explica por qué el socio se encontró el muro.
      await svc.from('payments').insert({
        member_id: socio.data.id,
        amount: Math.round(debito.transaction_amount || 0) || 1,
        status: debito.status === 'scheduled' ? 'pendiente' : 'rechazado',
        method: 'mercadopago',
        mp_payment_id: debito.payment?.id ? String(debito.payment.id) : `ap:${debito.id}`,
        external_reference: `ap:${debito.id}`,
        detail: `débito ${debito.status} · pago ${debito.payment?.status ?? 'sin pago'}${debito.payment?.status_detail ? ` (${debito.payment.status_detail})` : ''}`,
      });
      return NextResponse.json({ ok: true, acreditado: false, estado: debito.status });
    }

    const { data, error } = await svc.rpc('acreditar_cuota', {
      p_member_id: socio.data.id,
      p_mp_payment_id: String(debito.payment!.id),
      p_amount: Math.round(debito.transaction_amount),
      p_method: 'mercadopago',
      p_detalle: `débito automático de la suscripción ${debito.preapproval_id}`,
    });
    if (error) {
      console.error('[pagos/webhook] acreditar_cuota falló', error);
      return NextResponse.json({ error: 'No pudimos acreditar.' }, { status: 500 });
    }
    // `acreditado: false` no es un error: casi siempre es el mismo aviso llegando
    // por segunda vez. Se contesta 200 para que MP deje de reintentar.
    const r = Array.isArray(data) ? data[0] : data;
    console.log('[pagos/webhook] débito', debito.payment!.id, r?.motivo, r?.hasta ?? '');
    return NextResponse.json({ ok: true, acreditado: r?.acreditado === true, hasta: r?.hasta ?? null });
  }

  // Cualquier otro tipo (`payment` suelto, `merchant_order`, las pruebas del panel
  // de MP) se reconoce y se ignora: contestar 200 es lo que hace que MP deje de
  // reintentar un aviso que no tenemos que procesar.
  return NextResponse.json({ ok: true, ignorado: tipo || 'sin tipo' });
}

/** Mercado Pago prueba el endpoint con un GET desde su panel. */
export function GET() {
  return NextResponse.json({ ok: true });
}
