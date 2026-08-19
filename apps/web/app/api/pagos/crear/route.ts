import { NextResponse } from 'next/server';
import { cuotaMensual, urls, SITIO } from '@kumo/shared';
import { quienPide } from '@/lib/quien-pide';
import { getServiceClient } from '@/lib/supabase-service';
import { crearSuscripcion, traerSuscripcion, cancelarSuscripcion, MercadoPagoSinConfigurar } from '@/lib/mp';

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
  const elegido = (await req.json().catch(() => ({}))) as { plan?: string; odonto?: boolean };

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
       * Cambió de plan o sumó el add-on, así que la suscripción vieja es por otro
       * monto: se cancela antes de crear la nueva. Sin esto quedarían dos vivas y
       * el socio terminaría con dos débitos por mes — el peor error posible acá.
       */
      if (!mismoMonto && (vieja.status === 'authorized' || vieja.status === 'pending')) {
        await cancelarSuscripcion(vieja.id);
        console.log('[pagos/crear] cancelada la suscripción', vieja.id, 'por cambio de monto');
      }
    } catch (e) {
      // Si no se pudo consultar, se sigue: es peor dejarlo sin poder suscribirse.
      console.error('[pagos/crear] no pudimos consultar la suscripción vieja', e);
    }
  }

  try {
    const sus = await crearSuscripcion({
      // La referencia es el socio: los avisos de los débitos vienen con el id de la
      // suscripción, y así se puede cruzar por los dos lados.
      referencia: perfil.id,
      motivo: `Cuota Kumo${plan?.name ? ` · plan ${plan.name}` : ''}`,
      monto,
      /*
       * En sandbox el pagador tiene que ser el COMPRADOR de prueba: Mercado Pago
       * exige que cobrador y pagador sean los dos reales o los dos de prueba, y
       * con el email real del socio la creación da 400/500 (Biomea chocó con
       * esto). `MP_PAYER_EMAIL_PRUEBA` se setea SOLO mientras el token cargado es
       * el del vendedor de prueba; en producción no existe y va el email real.
       */
      emailSocio: process.env.MP_PAYER_EMAIL_PRUEBA || perfil.email,
      /*
       * A dónde vuelve al terminar. Si vino de la app, NO a la webapp: en el
       * navegador del teléfono no hay sesión, así que /app lo rebotaba a la
       * portada y quedaba mirando la landing sin saber si el pago salió. Va a una
       * página que le dice que vuelva a la app, con un botón que la abre.
       */
      /*
       * OJO: sin query propia.
       *
       * Mercado Pago le agrega SUS parámetros a esta URL, y los agrega con `?`
       * aunque ya haya uno. Con `?suscripcion=ok` la vuelta terminaba en
       * `...?suscripcion=ok?preapproval_id=xxx`, que para el navegador es un solo
       * parámetro llamado `suscripcion` con valor `ok?preapproval_id=xxx`: se pierde
       * lo que MP quiso decir y tampoco se puede leer lo nuestro.
       *
       * La webapp reconoce la vuelta por el `preapproval_id` que agrega MP, así que
       * no hace falta marcarla nosotros.
       */
      volverA: quien.desdeLaApp
        ? `${process.env.NEXT_PUBLIC_SITE_URL ?? SITIO}/suscripcion/listo`
        : `${process.env.NEXT_PUBLIC_SITE_URL ?? SITIO}${urls.webapp}`,
    });

    // El estado y el id los escribe el servidor con la service-role key, y el
    // trigger del perfil solo lo deja pasar con el flag: el socio no puede
    // declararse suscripto desde el navegador.
    await svc.rpc('marcar_suscripcion', {
      p_member_id: perfil.id,
      p_preapproval_id: sus.id,
      p_status: sus.status ?? 'pending',
    });

    return NextResponse.json({ initPoint: sus.init_point, monto });
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) {
      console.error('[pagos/crear]', e.message);
      return NextResponse.json({ error: 'El cobro todavía no está configurado. Escribinos por WhatsApp y lo resolvemos.' }, { status: 503 });
    }
    console.error('[pagos/crear] suscripción', e);
    return NextResponse.json({ error: 'No pudimos abrir la suscripción. Probá de nuevo en un rato.' }, { status: 502 });
  }
}
