import { NextResponse } from 'next/server';
import { cuotaMensual, urls, SITIO } from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';
import { crearPreferencia, MercadoPagoSinConfigurar } from '@/lib/mp';

/**
 * El link para pagar la cuota del socio que está pidiendo.
 *
 * De quién es el pago y de cuánto sale NO lo dice el navegador: el socio sale de
 * la sesión y el monto de su perfil. Si el monto viajara en el body, cualquiera
 * podría pagar $1 y quedar al día — es el error clásico de estas integraciones.
 *
 * El plan tampoco se elige acá: es el que eligió en el paso 3 del alta y quedó en
 * su perfil, con el add-on odontológico si lo contrató.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, status, plan_id, addon_odonto, monthly_fee_agreed, paid_until, plans(name, base_price)')
    .eq('id', auth.user.id)
    .single();

  if (!perfil) return NextResponse.json({ error: 'No encontramos tu perfil.' }, { status: 404 });
  if (perfil.role !== 'socio') return NextResponse.json({ error: 'Solo los socios pagan cuota.' }, { status: 403 });
  if (perfil.status === 'suspendido' || perfil.status === 'baja') {
    return NextResponse.json({ error: 'Tu cuenta no está activa. Escribinos por WhatsApp.' }, { status: 403 });
  }

  const plan = Array.isArray(perfil.plans) ? perfil.plans[0] : perfil.plans;
  /*
   * La cuota: la que aceptó al firmar. El precio del plan puede haber cambiado
   * desde entonces y cobrarle otro número sin avisarle sería cambiarle el
   * contrato de un mes al otro. Si por lo que sea no quedó guardada, se recalcula
   * con el precio de hoy — pero nunca sale del cliente.
   */
  const monto = perfil.monthly_fee_agreed ?? (plan ? cuotaMensual(plan.base_price, perfil.addon_odonto === true) : null);
  if (!monto || monto <= 0) {
    return NextResponse.json({ error: 'No pudimos calcular tu cuota. Escribinos por WhatsApp.' }, { status: 409 });
  }

  // La service-role key para escribir en `payments`: el socio no puede insertar
  // sus propios pagos (se regalaría el acceso), así que la fila la crea el
  // servidor.
  const svc = getServiceClient();

  /*
   * ¿Ya tenía un intento abierto? Dos clics en "Pagar", dos pestañas o volver
   * atrás en el navegador llegan acá de nuevo. En vez de crear otra preferencia
   * —y dejar pagos fantasma en la tabla y en la cuenta de MP— se le devuelve el
   * mismo link. El índice único parcial de `payments` lo garantiza incluso si dos
   * pedidos entran a la vez: el segundo choca y cae en este mismo camino.
   */
  const { data: abierto } = await svc
    .from('payments')
    .select('id, init_point, amount, external_reference')
    .eq('member_id', perfil.id)
    .eq('status', 'pendiente')
    .maybeSingle();

  if (abierto?.init_point && abierto.amount === monto) {
    return NextResponse.json({ initPoint: abierto.init_point, reusado: true });
  }

  // Si el intento abierto quedó viejo (le cambió el plan, o nunca llegó a tener
  // link), se descarta y se arma uno nuevo: es un intento sin pagar, no hay plata
  // en juego.
  if (abierto) {
    await svc.from('payments').update({ status: 'rechazado', detail: 'reemplazado por un intento nuevo' }).eq('id', abierto.id);
  }

  const { data: fila, error: errFila } = await svc
    .from('payments')
    .insert({
      member_id: perfil.id,
      plan_id: perfil.plan_id,
      plan_name: plan?.name ?? null,
      amount: monto,
      status: 'pendiente',
      method: 'mercadopago',
    })
    .select('id')
    .single();

  if (errFila || !fila) {
    console.error('[pagos/crear] no se pudo crear la fila', errFila);
    return NextResponse.json({ error: 'No pudimos generar el pago. Probá de nuevo.' }, { status: 500 });
  }

  // La referencia ES el id de la fila: es lo que vuelve en el aviso de MP y lo
  // que el webhook usa para saber qué acreditar.
  const referencia = fila.id as string;
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? SITIO;

  try {
    const pref = await crearPreferencia({
      referencia,
      titulo: `Cuota Kumo${plan?.name ? ` · plan ${plan.name}` : ''}`,
      monto,
      emailSocio: perfil.email,
      volverA: `${sitio}${urls.webapp}`,
      avisarA: `${sitio}/api/pagos/webhook`,
    });
    await svc
      .from('payments')
      .update({ mp_preference_id: pref.id, init_point: pref.init_point, external_reference: referencia })
      .eq('id', referencia);
    return NextResponse.json({ initPoint: pref.init_point, monto });
  } catch (e) {
    // La fila queda marcada, no pendiente: si no, el socio no puede volver a
    // intentar (el índice único de "un solo pendiente" se lo impediría).
    await svc.from('payments').update({ status: 'rechazado', detail: e instanceof Error ? e.message : 'error al crear la preferencia' }).eq('id', referencia);
    if (e instanceof MercadoPagoSinConfigurar) {
      console.error('[pagos/crear]', e.message);
      return NextResponse.json({ error: 'El cobro todavía no está configurado. Escribinos por WhatsApp y lo resolvemos.' }, { status: 503 });
    }
    console.error('[pagos/crear] preferencia', e);
    return NextResponse.json({ error: 'No pudimos abrir el pago. Probá de nuevo en un rato.' }, { status: 502 });
  }
}
