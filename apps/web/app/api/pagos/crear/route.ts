import { NextResponse } from 'next/server';
import { cuotaMensual, urls, SITIO } from '@kumo/shared';
import { quienPide } from '@/lib/quien-pide';
import { getServiceClient } from '@/lib/supabase-service';
import { crearSuscripcion, traerSuscripcion, MercadoPagoSinConfigurar } from '@/lib/mp';

/**
 * La suscripción del socio que está pidiendo: el link para autorizar el débito
 * automático de la cuota.
 *
 * De quién es y de cuánto sale NO lo dice el navegador: el socio sale de la sesión
 * y el monto de su perfil. Si el monto viajara en el body, cualquiera podría
 * suscribirse por $1 — es el error clásico de estas integraciones.
 *
 * El plan tampoco se elige acá: es el que eligió en el paso 3 del alta y quedó en
 * su perfil, con el add-on odontológico si lo contrató.
 */
export async function POST(req: Request) {
  // Sirve a la webapp (sesión en cookies) y a la app del celular (token en el
  // header): el muro existe en las dos y en las dos tiene que poder pagar.
  const quien = await quienPide(req);
  if (!quien) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

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

  const plan = Array.isArray(perfil.plans) ? perfil.plans[0] : perfil.plans;
  /*
   * La cuota: la que aceptó al firmar. El precio del plan puede haber cambiado
   * desde entonces y cobrarle otro número sin avisarle sería cambiarle el contrato
   * de un mes al otro. Si no quedó guardada, se recalcula con el precio de hoy —
   * pero nunca sale del cliente.
   */
  const monto = perfil.monthly_fee_agreed ?? (plan ? cuotaMensual(plan.base_price, perfil.addon_odonto === true) : null);
  if (!monto || monto <= 0) {
    return NextResponse.json({ error: 'No pudimos calcular tu cuota. Escribinos por WhatsApp.' }, { status: 409 });
  }

  const svc = getServiceClient();

  /*
   * ¿Ya tenía una suscripción empezada? Dos clics, dos pestañas o volver atrás
   * llegan acá de nuevo. Antes de crear otra se le pregunta a Mercado Pago por la
   * que hay: si sigue viva, se le devuelve el mismo link en lugar de dejarle dos
   * suscripciones y el riesgo de que le debiten dos veces.
   */
  if (perfil.mp_preapproval_id) {
    try {
      const vieja = await traerSuscripcion(perfil.mp_preapproval_id);
      if (vieja.status === 'authorized') {
        // Ya está autorizada: no hay nada que autorizar de nuevo. El primer débito
        // puede estar en camino.
        return NextResponse.json({ yaAutorizada: true });
      }
      if (vieja.status === 'pending') {
        return NextResponse.json({ initPoint: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${vieja.id}`, reusada: true });
      }
      // Pausada o cancelada: se crea una nueva más abajo.
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
      emailSocio: perfil.email,
      /*
       * A dónde vuelve al terminar. Si vino de la app, NO a la webapp: en el
       * navegador del teléfono no hay sesión, así que /app lo rebotaba a la
       * portada y quedaba mirando la landing sin saber si el pago salió. Va a una
       * página que le dice que vuelva a la app, con un botón que la abre.
       */
      volverA: quien.desdeLaApp
        ? `${process.env.NEXT_PUBLIC_SITE_URL ?? SITIO}/suscripcion/listo`
        : `${process.env.NEXT_PUBLIC_SITE_URL ?? SITIO}${urls.webapp}?suscripcion=ok`,
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
