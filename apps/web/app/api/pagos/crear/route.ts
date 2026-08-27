import { NextResponse } from 'next/server';
import { cuotaMensual, urls, SITIO } from '@kumo/shared';
import { quienPide } from '@/lib/quien-pide';
import { getServiceClient } from '@/lib/supabase-service';
import { crearPlanDeSocio, traerPlanDeSocio, traerSuscripcion, cancelarSuscripcion, actualizarMontoSuscripcion, MercadoPagoSinConfigurar } from '@/lib/mp';

/**
 * La suscripción del socio que está pidiendo: el link para autorizar el débito
 * automático de la cuota.
 *
 * De quién es y de cuánto sale NO lo dice el navegador: el socio sale de la sesión
 * y el monto de su perfil. Si el monto viajara en el body, cualquiera podría
 * suscribirse por $1 — es el error clásico de estas integraciones.
 *
 * El plan SÍ se puede elegir acá: el muro llega con el del alta preseleccionado y
 * el socio puede cambiarlo o sumar la cobertura odontológica antes de pagar — es
 * el momento en que compara. Pero del navegador viene solo el NOMBRE del plan: el
 * precio lo busca el servidor.
 */
export async function POST(req: Request) {
  // Sirve a la webapp (sesión en cookies) y a la app del celular (token en el
  // header): el muro existe en las dos y en las dos tiene que poder pagar.
  const quien = await quienPide(req);
  if (!quien) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  /*
   * El socio puede cambiar de plan y sumar la cobertura odontológica desde el
   * muro: viene con el que eligió en el alta preseleccionado, pero ahí está por
   * pagar y es el momento en que compara.
   *
   * Del navegador llega SOLO el nombre del plan y el sí/no del add-on. El precio
   * lo busca el servidor en la base y la cuota la calcula con `cuotaMensual`. Si
   * el monto viniera del cliente, cualquiera se suscribiría por $1 — y es el error
   * más común de estas integraciones.
   */
  const elegido = (await req.json().catch(() => ({}))) as { plan?: string; odonto?: boolean; desde?: 'alta' };

  const { data: perfil } = await getServiceClient()
    .from('profiles')
    .select('id, email, role, status, plan_id, addon_odonto, monthly_fee_agreed, paid_until, mp_preapproval_id, mp_subscription_status, plans(name, base_price)')
    .eq('id', quien.id)
    .single();

  if (!perfil) return NextResponse.json({ error: 'No encontramos tu perfil.' }, { status: 404 });
  if (perfil.role !== 'socio') return NextResponse.json({ error: 'Solo los socios pagan cuota.' }, { status: 403 });
  if (perfil.status === 'suspendido' || perfil.status === 'baja') {
    return NextResponse.json({ error: 'Tu cuenta no está activa. Escribinos por WhatsApp.' }, { status: 403 });
  }

  const svc = getServiceClient();
  let plan = Array.isArray(perfil.plans) ? perfil.plans[0] : perfil.plans;
  let odonto = perfil.addon_odonto === true;
  // El id del plan del club (no el de MP): el mapeo de `mp_member_plans` lo lleva.
  let planId = (perfil.plan_id as string | null) ?? null;

  /*
   * Si eligió plan (o tocó el add-on) en el muro, se lo guarda en el perfil: es
   * lo que contrató, y de ahí sale la cuota de todos los meses que siguen, la
   * ficha del panel y el ingreso mensual del dashboard. Guardarlo solo en la
   * suscripción de Mercado Pago dejaría a Kumo diciendo una cosa y a MP cobrando
   * otra.
   */
  if (elegido.plan || typeof elegido.odonto === 'boolean') {
    const nombre = elegido.plan ?? plan?.name;
    const { data: planRow } = await svc.from('plans').select('id, name, base_price').eq('name', nombre).maybeSingle();
    if (!planRow) return NextResponse.json({ error: 'Ese plan no existe.' }, { status: 400 });
    odonto = elegido.odonto === true;
    plan = { name: planRow.name, base_price: planRow.base_price };
    planId = planRow.id;
    await svc.from('profiles').update({
      plan_id: planRow.id,
      addon_odonto: odonto,
      monthly_fee_agreed: cuotaMensual(planRow.base_price, odonto),
    }).eq('id', perfil.id);
  }

  /*
   * La cuota: plan más add-ons, calculada acá. El precio sale de la base y el
   * add-on de una constante compartida, así que el navegador no puede inventarlo.
   */
  const monto = plan ? cuotaMensual(plan.base_price, odonto) : perfil.monthly_fee_agreed;
  if (!monto || monto <= 0) {
    return NextResponse.json({ error: 'No pudimos calcular tu cuota. Escribinos por WhatsApp.' }, { status: 409 });
  }

  /*
   * ¿Ya tenía una suscripción empezada? Dos clics, dos pestañas o volver atrás
   * llegan acá de nuevo. Antes de crear otra se le pregunta a Mercado Pago por la
   * que hay: si sigue viva, se le devuelve el mismo link en lugar de dejarle dos
   * suscripciones y el riesgo de que le debiten dos veces.
   */
  if (perfil.mp_preapproval_id) {
    try {
      const vieja = await traerSuscripcion(perfil.mp_preapproval_id);
      const mismoMonto = Math.round(vieja.auto_recurring?.transaction_amount ?? 0) === Math.round(monto);
      if (vieja.status === 'authorized' && mismoMonto) {
        // Ya está autorizada: no hay nada que autorizar de nuevo. El primer débito
        // puede estar en camino.
        return NextResponse.json({ yaAutorizada: true });
      }
      if (vieja.status === 'pending' && mismoMonto) {
        return NextResponse.json({ initPoint: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${vieja.id}`, reusada: true });
      }
      /*
       * Cambió de plan o sumó el add-on: la suscripción vieja es por otro monto.
       *
       * Con una suscripción AUTORIZADA se le cambia el monto y listo, que es lo mismo
       * que hace el club cuando cambia el precio de un plan (`/api/planes/precio`).
       * Rige desde el próximo cobro y no le pide nada al socio.
       *
       * Antes acá se cancelaba la vieja y se creaba otra, y eso traía tres cosas que
       * el socio no pidió: Mercado Pago debita al autorizar (medido: 18 segundos), así
       * que cambiar de plan a mitad de mes era un segundo cobro en el mismo mes;
       * cancelaba el débito ANTES de que autorizara el nuevo, así que abandonar el
       * checkout lo dejaba sin suscripción; y lo obligaba a pasar otra vez por MP.
       *
       * Los días no se pierden en ninguno de los dos caminos: `acreditar_cuota` suma
       * el mes desde `paid_until`, no desde hoy.
       */
      if (!mismoMonto && vieja.status === 'authorized') {
        try {
          await actualizarMontoSuscripcion(vieja.id, monto, `Cuota Kumo${plan?.name ? ` · plan ${plan.name}` : ''}${odonto ? ' + odontología' : ''}`);
          console.log('[pagos/crear] débito actualizado', vieja.id, '→', monto);
          return NextResponse.json({ actualizada: true, monto, hasta: perfil.paid_until });
        } catch (e) {
          /*
           * Si Mercado Pago no acepta el cambio, el único camino que queda es
           * reemplazarla. Se cancela ACÁ y no antes: mientras el update tenga chance,
           * el socio conserva su débito.
           */
          console.error('[pagos/crear] no pudimos actualizar el monto, se reemplaza', vieja.id, e);
          await cancelarSuscripcion(vieja.id);
        }
      }
      /*
       * Una suscripción PENDIENTE nunca cobró nada, así que reemplazarla no le cuesta
       * nada al socio: se cancela y se crea con el monto nuevo. Y hay que hacerlo, o
       * quedarían dos vivas y terminaría con dos débitos por mes.
       */
      if (!mismoMonto && vieja.status === 'pending') {
        await cancelarSuscripcion(vieja.id);
        console.log('[pagos/crear] cancelada la suscripción pendiente', vieja.id, 'por cambio de monto');
      }
    } catch (e) {
      // Si no se pudo consultar, se sigue: es peor dejarlo sin poder suscribirse.
      console.error('[pagos/crear] no pudimos consultar la suscripción vieja', e);
    }
  }

  /*
   * Sin plan del club identificado no se arma nada: el mapeo que sostiene la
   * atribución (`mp_member_plans`) necesita saber QUÉ contrató, y un link de pago
   * sin ese dato es una suscripción que después no se puede explicar. En la
   * práctica no pasa —el muro y la hoja mandan siempre el nombre del plan— pero
   * si pasa, mejor este error que un cobro huérfano.
   */
  if (!planId) {
    return NextResponse.json({ error: 'Elegí un plan antes de pagar.' }, { status: 409 });
  }

  /*
   * A dónde vuelve al terminar. Si vino de la app, NO a la webapp: en el
   * navegador del teléfono no hay sesión, así que /app lo rebotaba a la portada.
   * Y el del alta no es un lujo: si la vuelta fuera a /app, el socio que recién
   * se dio de alta nunca vería la pantalla final con el carnet de sus mascotas.
   *
   * OJO: sin query propia. Mercado Pago agrega SUS parámetros con `?` aunque ya
   * haya uno, y la vuelta se reconoce por el `preapproval_id` que agrega MP.
   */
  const volverA = quien.desdeLaApp
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? SITIO}/suscripcion/listo`
    : elegido.desde === 'alta'
      ? `${process.env.NEXT_PUBLIC_SITE_URL ?? SITIO}/alta/listo`
      : `${process.env.NEXT_PUBLIC_SITE_URL ?? SITIO}${urls.webapp}`;

  /*
   * El link de pago es el checkout de UN PLAN DE ESTE SOCIO, no una suscripción
   * creada por nosotros (el porqué completo está en `crearPlanDeSocio`: el
   * payer_email del flujo viejo exigía que el mail de Mercado Pago coincidiera
   * con el de Kumo, y eso dejaba afuera a gente real).
   *
   * ¿Ya le habíamos armado un plan igual? Se reutiliza: mismo plan del club,
   * mismo add-on, mismo monto y misma vuelta. Si cambió cualquiera de esos, se
   * crea otro — los planes viejos quedan en Mercado Pago como filas inertes, y
   * sus mapeos NO se borran: un checkout abierto en otra pestaña sobre un link
   * viejo puede terminar en una suscripción real, y sin el mapeo ese cobro no
   * se podría atribuir a nadie.
   */
  const { data: previos, error: ePrevios } = await svc
    .from('mp_member_plans')
    .select('mp_plan_id, amount, back_url')
    .eq('member_id', perfil.id)
    .eq('plan_id', planId)
    .eq('addon_odonto', odonto)
    .order('created_at', { ascending: false })
    .limit(1);
  if (ePrevios) {
    // Si la tabla no está o no se puede leer, acá se corta: seguir de largo
    // terminaría creando un plan al que después no se le puede poner dueño.
    console.error('[pagos/crear] no pudimos leer mp_member_plans', ePrevios);
    return NextResponse.json({ error: 'No pudimos preparar el pago. Probá de nuevo en un rato.' }, { status: 500 });
  }

  const previo = previos?.[0];
  if (previo && previo.amount === Math.round(monto) && previo.back_url === volverA) {
    try {
      const actual = await traerPlanDeSocio(previo.mp_plan_id);
      return NextResponse.json({ initPoint: actual.init_point, monto });
    } catch (e) {
      // El plan guardado no se pudo traer: se crea otro. El mapeo viejo queda.
      console.error('[pagos/crear] plan guardado ilegible, se crea otro', previo.mp_plan_id, e);
    }
  }

  try {
    const creado = await crearPlanDeSocio({
      // Con el add-on, el cargo es $12.000 más alto que el precio publicado del
      // plan: si el resumen de la tarjeta no dice por qué, ese es exactamente el
      // cargo que el socio desconoce.
      motivo: `Cuota Kumo${plan?.name ? ` · plan ${plan.name}` : ''}${odonto ? ' + odontología' : ''}`,
      monto,
      volverA,
    });

    /*
     * El mapeo se guarda ANTES de entregar el link, y si no se puede guardar el
     * link NO se entrega: un pago que entra por un plan sin mapeo es un débito
     * recurrente real que no se puede atribuir a nadie. El plan recién creado
     * queda huérfano en Mercado Pago, pero huérfano e INERTE — nadie tiene su
     * init_point.
     */
    const { error: eMapeo } = await svc.from('mp_member_plans').insert({
      mp_plan_id: creado.id,
      member_id: perfil.id,
      plan_id: planId,
      addon_odonto: odonto,
      amount: Math.round(monto),
      back_url: volverA,
    });
    if (eMapeo) {
      console.error('[pagos/crear] no pudimos guardar el mapeo del plan', creado.id, eMapeo);
      return NextResponse.json({ error: 'No pudimos preparar el pago. Probá de nuevo en un rato.' }, { status: 500 });
    }

    // Nada de `marcar_suscripcion` acá: todavía no HAY suscripción. La crea
    // Mercado Pago cuando el socio pasa por el checkout, y nos llega por webhook.
    return NextResponse.json({ initPoint: creado.init_point, monto });
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) {
      console.error('[pagos/crear]', e.message);
      return NextResponse.json({ error: 'El cobro todavía no está configurado. Escribinos por WhatsApp y lo resolvemos.' }, { status: 503 });
    }
    console.error('[pagos/crear] plan del socio', e);
    return NextResponse.json({ error: 'No pudimos abrir la suscripción. Probá de nuevo en un rato.' }, { status: 502 });
  }
}
