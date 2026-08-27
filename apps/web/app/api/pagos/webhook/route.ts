import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';
import { firmaValida, traerDebito, traerSuscripcion, ponerReferenciaEnSuscripcion, cancelarSuscripcion } from '@/lib/mp';
import { sendAdminSuscripcionSinDueno } from '@/lib/mail';
import { acreditarDebito } from '@/lib/cobrar';

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

  /*
   * De qué modo del panel de MP vino el aviso: productivo o pruebas.
   *
   * Queda anotado en cada pago, porque mientras probemos con credenciales de
   * prueba contra producción, un mes acreditado por un aviso de prueba NO es plata
   * que entró. Sin esta marca, en la tabla los dos casos se ven idénticos y el
   * club no tiene cómo saber qué cobró de verdad.
   */
  const marcaModo = firma.modo === 'prueba' ? ' · aviso de PRUEBA (no es plata real)' : '';

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
    /*
     * De quién es.
     *
     * Las del flujo viejo traen `external_reference` (la pusimos al crearlas).
     * Las nacidas del flujo por plan llegan SIN referencia y sin payer_email —
     * las crea Mercado Pago, no nosotros— y el único identificador que viaja es
     * `preapproval_plan_id`. Como cada plan es DE UN SOCIO, `mp_member_plans`
     * dice de quién es.
     */
    let memberId = sus.external_reference;
    if (!memberId && sus.preapproval_plan_id) {
      const { data: mapeo } = await svc
        .from('mp_member_plans')
        .select('member_id')
        .eq('mp_plan_id', sus.preapproval_plan_id)
        .maybeSingle();
      if (mapeo) {
        memberId = mapeo.member_id as string;
        /*
         * Y la referencia se escribe DE VUELTA en la suscripción: los avisos
         * siguientes —y pagos/confirmar— resuelven por `external_reference` como
         * siempre, sin depender de la tabla de mapeo. Si falla no pasa nada: el
         * próximo aviso vuelve a entrar por el mapeo y lo intenta de nuevo.
         */
        try {
          await ponerReferenciaEnSuscripcion(sus.id, mapeo.member_id as string);
        } catch (e) {
          console.error('[pagos/webhook] no pudimos escribir la referencia', sus.id, e);
        }
      }
    }
    if (!memberId) {
      /*
       * Suscripción sin dueño: un débito recurrente REAL que no se puede
       * atribuir. En silencio se convierte en plata que entra sin que ningún
       * socio reciba nada — y nadie puede reclamarla ni cancelarla. Por eso es
       * una ALERTA al club, no un log perdido. Se contesta 200 igual: reintentar
       * no va a hacer aparecer el mapeo.
       */
      console.error('[pagos/webhook] SUSCRIPCIÓN SIN DUEÑO', sus.id, '· plan', sus.preapproval_plan_id ?? 'sin plan', '· estado', sus.status);
      void sendAdminSuscripcionSinDueno({ preapprovalId: sus.id, planMp: sus.preapproval_plan_id ?? null, estado: sus.status });
      return NextResponse.json({ ok: true, ignorado: 'sin referencia' });
    }

    const { data: antes } = await svc
      .from('profiles')
      .select('mp_preapproval_id, mp_subscription_status')
      .eq('id', memberId)
      .maybeSingle();

    /*
     * Una cancelación de una suscripción que YA NO es la del socio no toca nada.
     *
     * Pasa de verdad: al confirmarse una suscripción nueva se cancela la
     * anterior (acá abajo), y Mercado Pago avisa esa cancelación DESPUÉS. Sin
     * esta guarda, ese aviso tardío pisaría en el perfil a la suscripción nueva
     * con el estado de la vieja, y el socio que acaba de pagar aparecería como
     * cancelado.
     */
    if (sus.status === 'cancelled' && antes?.mp_preapproval_id && antes.mp_preapproval_id !== sus.id) {
      console.log('[pagos/webhook] cancelación de una suscripción reemplazada, se ignora', sus.id);
      return NextResponse.json({ ok: true, ignorado: 'suscripción reemplazada' });
    }

    /*
     * Red contra el doble débito: si esta suscripción quedó autorizada y el
     * socio tenía OTRA viva, la vieja se cancela. Mercado Pago acepta las dos y
     * cobra las dos — y un init_point viejo en una pestaña abierta llega acá
     * sin pasar por pagos/crear, así que este es el único lugar que ve el
     * conflicto con certeza.
     */
    if (
      sus.status === 'authorized'
      && antes?.mp_preapproval_id
      && antes.mp_preapproval_id !== sus.id
      && (antes.mp_subscription_status === 'authorized' || antes.mp_subscription_status === 'pending')
    ) {
      try {
        await cancelarSuscripcion(antes.mp_preapproval_id);
        console.log('[pagos/webhook] suscripción anterior cancelada', antes.mp_preapproval_id, '→ la reemplaza', sus.id);
      } catch (e) {
        // Si no se pudo, el socio queda con dos débitos: eso TIENE que verse.
        console.error('[pagos/webhook] NO pudimos cancelar la suscripción anterior', antes.mp_preapproval_id, e);
      }
    }

    await svc.rpc('marcar_suscripcion', {
      p_member_id: memberId,
      p_preapproval_id: sus.id,
      p_status: sus.status,
    });
    console.log('[pagos/webhook] suscripción', sus.id, '→', sus.status, '· modo', firma.modo);
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

    /*
     * La acreditación vive en `lib/cobrar.ts` porque la comparte con la vuelta del
     * socio al sitio (`/api/pagos/confirmar`), que pregunta por los débitos en vez de
     * esperar este aviso. Las dos pueden ver el mismo débito: `acreditar_cuota`
     * deduplica por el id del pago, así que la segunda no suma otro mes.
     */
    try {
      const r = await acreditarDebito(svc, debito, marcaModo);
      if (r.estado === 'acreditado' || r.estado === 'repetido') {
        return NextResponse.json({ ok: true, acreditado: r.estado === 'acreditado', hasta: r.hasta });
      }
      return NextResponse.json({ ok: true, estado: r.estado });
    } catch {
      return NextResponse.json({ error: 'No pudimos acreditar.' }, { status: 500 });
    }
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
