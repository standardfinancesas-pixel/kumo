import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';
import { firmaValida, traerPago } from '@/lib/mp';

/**
 * El aviso de Mercado Pago: es lo único que da acceso al club.
 *
 * La vuelta del navegador (`/app?pago=ok`) es un cartel y nada más: la puede
 * escribir cualquiera en la barra de direcciones, y además el socio puede pagar y
 * cerrar el navegador antes de volver. Acreditar por el redirect sería regalar el
 * acceso a quien tipee la URL y dejar afuera al que pagó bien.
 *
 * Tres cosas que hay que hacer bien acá, y las tres son por seguridad o por
 * concurrencia:
 *
 *  1. Verificar la firma. Sin eso, cualquiera que conozca esta URL puede avisar
 *     "el socio tal pagó".
 *  2. No creerle al cuerpo del aviso. Trae sólo un id; el estado y el monto se
 *     los preguntamos a Mercado Pago con ese id.
 *  3. Ser idempotente. MP reintenta, y además manda un aviso por `payment` y otro
 *     por `merchant_order` del mismo pago. La acreditación vive en
 *     `acreditar_pago()`, que bloquea las filas y suma una sola vez.
 *
 * Siempre 200, salvo que la firma falle: un 500 hace que MP reintente en loop, y
 * si el aviso ya fue procesado no hay nada que reintentar.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const cuerpo = (await req.json().catch(() => ({}))) as {
    type?: string;
    action?: string;
    data?: { id?: string | number };
  };

  // El id del pago viene en el body o en la query, según el tipo de aviso.
  const dataId = String(cuerpo.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '');

  const firma = firmaValida({
    signature: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    dataId,
  });
  if (!firma.ok) {
    console.error('[pagos/webhook] firma rechazada:', firma.motivo);
    return NextResponse.json({ error: 'Aviso no verificado.' }, { status: 401 });
  }

  // Los avisos de `merchant_order` y los de test no traen un pago que acreditar.
  const tipo = cuerpo.type ?? url.searchParams.get('type') ?? '';
  if (tipo && tipo !== 'payment') {
    return NextResponse.json({ ok: true, ignorado: tipo });
  }
  if (!dataId) return NextResponse.json({ ok: true, ignorado: 'sin id' });

  let pago;
  try {
    pago = await traerPago(dataId);
  } catch (e) {
    // Acá sí conviene un 500: no pudimos preguntar, así que queremos el reintento.
    console.error('[pagos/webhook] no pudimos traer el pago', dataId, e);
    return NextResponse.json({ error: 'No pudimos consultar el pago.' }, { status: 500 });
  }

  if (!pago.external_reference) {
    console.error('[pagos/webhook] pago sin external_reference', pago.id);
    return NextResponse.json({ ok: true, ignorado: 'sin referencia' });
  }

  const svc = getServiceClient();

  // Los estados que no son "aprobado" se registran igual: el socio tiene que
  // poder ver por qué no entró, y un pago en proceso (transferencia, Rapipago)
  // puede tardar horas y aprobarse después.
  if (pago.status !== 'approved') {
    const estado = pago.status === 'refunded' || pago.status === 'charged_back' ? 'devuelto'
      : pago.status === 'pending' || pago.status === 'in_process' ? 'pendiente'
      : 'rechazado';
    await svc
      .from('payments')
      .update({ status: estado, mp_payment_id: String(pago.id), detail: `${pago.status} · ${pago.status_detail}` })
      .eq('external_reference', pago.external_reference);
    return NextResponse.json({ ok: true, estado });
  }

  const { data, error } = await svc.rpc('acreditar_pago', {
    p_external_reference: pago.external_reference,
    p_mp_payment_id: String(pago.id),
    p_amount: Math.round(pago.transaction_amount),
  });

  if (error) {
    console.error('[pagos/webhook] acreditar_pago falló', error);
    return NextResponse.json({ error: 'No pudimos acreditar.' }, { status: 500 });
  }

  // `acreditado: false` no es un error: casi siempre es el mismo aviso llegando
  // por segunda vez. Se contesta 200 para que MP deje de reintentar.
  const r = Array.isArray(data) ? data[0] : data;
  console.log('[pagos/webhook]', pago.external_reference, r?.motivo, r?.hasta ?? '');
  return NextResponse.json({ ok: true, acreditado: r?.acreditado === true, hasta: r?.hasta ?? null });
}

/** Mercado Pago prueba el endpoint con un GET desde su panel. */
export function GET() {
  return NextResponse.json({ ok: true });
}
