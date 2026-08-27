import { NextResponse } from 'next/server';
import { cuotaMensual } from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';
import { actualizarMontoSuscripcion } from '@/lib/mp';
import { sendCuotaActualizada } from '@/lib/mail';

/**
 * El club cambia el precio de un plan, y el cambio alcanza a los que ya estaban.
 *
 * Sin esto, un aumento solo regía para los socios nuevos: la suscripción de
 * Mercado Pago debita para siempre el monto con el que se creó, y el perfil
 * seguía diciendo la cuota vieja. El precio nuevo pasa por acá y no por un
 * update directo de `plans` desde el panel, para que el precio y su propagación
 * viajen juntos: si esto falla, el precio tampoco cambió.
 *
 * Por cada socio del plan se actualizan las tres verdades que tienen que decir
 * lo mismo:
 *  1. `plans.base_price` — lo que ven la landing, el alta y el muro.
 *  2. `profiles.monthly_fee_agreed` — la cuota del socio (con su add-on).
 *  3. El débito en Mercado Pago, si tiene suscripción viva. Rige desde el
 *     próximo cobro y no le pide nada al socio.
 *
 * Y se le avisa por mail a cada socio activo: un débito que cambia sin aviso es
 * la receta del contracargo.
 *
 * Si algún PUT a Mercado Pago falla, se sigue con el resto y se devuelve cuántos
 * quedaron: volver a guardar el mismo precio reintenta solo esos (actualizar al
 * mismo monto es inocuo), así que el camino de recuperación es "guardá de nuevo".
 */
export async function POST(req: Request) {
  const { planId, precio } = (await req.json().catch(() => ({}))) as { planId?: string; precio?: number };
  const monto = Math.round(Number(precio));
  if (!planId || !monto || monto <= 0) return NextResponse.json({ error: 'Falta el plan o el precio.' }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede cambiar precios.' }, { status: 403 });

  const svc = getServiceClient();
  const { data: plan } = await svc.from('plans').select('id, name, base_price').eq('id', planId).single();
  if (!plan) return NextResponse.json({ error: 'Ese plan no existe.' }, { status: 404 });

  const { error: ePlan } = await svc.from('plans').update({ base_price: monto }).eq('id', plan.id);
  if (ePlan) {
    console.error('[planes/precio] no se pudo guardar el precio', ePlan);
    return NextResponse.json({ error: 'No pudimos guardar el precio.' }, { status: 500 });
  }

  // Los socios del plan, estén como estén: la cuota acordada acompaña al plan
  // también para un suspendido, así el día que vuelve no revive un precio viejo.
  const { data: socios } = await svc
    .from('profiles')
    .select('id, email, full_name, status, addon_odonto, monthly_fee_agreed, mp_preapproval_id, mp_subscription_status')
    .eq('role', 'socio')
    .eq('plan_id', plan.id);

  let debitosActualizados = 0;
  let debitosFallidos = 0;
  let debitosEsperandoAprobacion = 0;
  let mails = 0;

  for (const socio of socios ?? []) {
    const cuota = cuotaMensual(monto, socio.addon_odonto === true);
    const sinCambio = Math.round(socio.monthly_fee_agreed ?? 0) === cuota;

    // El débito, solo si hay una suscripción que vaya a cobrar: una cancelada o
    // pausada no se toca (y Mercado Pago rechazaría el cambio igual).
    const viva = socio.mp_preapproval_id
      && (socio.mp_subscription_status === 'authorized' || socio.mp_subscription_status === 'pending');
    let debitoOk = true;
    if (viva) {
      try {
        /*
         * El motivo se manda SIEMPRE, no solo cuando cambia el plan del socio: es
         * lo que la persona ve en su resumen de la tarjeta, y este update es la
         * única oportunidad de refrescarlo. Sin esto, una suscripción vieja seguía
         * diciendo el nombre de antes —o callándose el add-on— por años.
         */
        const r = await actualizarMontoSuscripcion(
          socio.mp_preapproval_id as string,
          cuota,
          `Cuota Kumo · plan ${plan.name}${socio.addon_odonto === true ? ' + odontología' : ''}`,
        );
        /*
         * El estado que DEVUELVE el update es la verdad, no una formalidad: un
         * aumento puede sacar la suscripción de `authorized` y dejarla esperando
         * que el socio apruebe el monto nuevo — hasta entonces Mercado Pago le
         * sigue debitando el anterior. A esos NO se les escribe la cuota nueva ni
         * se les manda el mail: el perfil tiene que decir lo que MP va a debitar
         * de verdad. El reintento es el mismo de los fallidos (guardar el precio
         * de nuevo re-pregunta), y el estado real queda en el perfil, que es de
         * donde la app le muestra al socio que tiene algo pendiente.
         */
        if (r.status === 'authorized') {
          debitosActualizados++;
        } else {
          debitoOk = false;
          debitosEsperandoAprobacion++;
          await svc.rpc('marcar_suscripcion', {
            p_member_id: socio.id,
            p_preapproval_id: socio.mp_preapproval_id,
            p_status: r.status,
          });
          console.warn('[planes/precio] la suscripción de', socio.id, 'quedó', r.status, ': espera aprobación del socio');
        }
      } catch (e) {
        debitoOk = false;
        debitosFallidos++;
        console.error('[planes/precio] no se pudo actualizar el débito de', socio.id, e);
      }
    }

    /*
     * La cuota del perfil recién se escribe cuando el débito acompañó: si el PUT
     * falló, el perfil sigue diciendo la cuota vieja —que es la que Mercado Pago
     * va a debitar de verdad— y el reintento (guardar el precio de nuevo) lo
     * encuentra pendiente, lo actualiza y ahí sí avisa.
     */
    if (!debitoOk) continue;
    await svc.from('profiles').update({ monthly_fee_agreed: cuota }).eq('id', socio.id);

    /*
     * El aviso va al que está pagando (activo) y solo si su cuota realmente
     * cambió: guardar el mismo precio dos veces no puede mandar el mail dos
     * veces.
     */
    if (!sinCambio && socio.status === 'activo' && socio.email) {
      await sendCuotaActualizada({
        to: socio.email,
        firstName: socio.full_name?.trim().split(' ')[0] || 'Hola',
        planName: plan.name,
        cuota,
        conOdonto: socio.addon_odonto === true,
        debitoAutomatico: socio.mp_subscription_status === 'authorized',
      });
      mails++;
    }
  }

  console.log(`[planes/precio] ${plan.name}: $${plan.base_price} → $${monto} · ${socios?.length ?? 0} socios · ${debitosActualizados} débitos ok · ${debitosEsperandoAprobacion} esperan aprobación · ${debitosFallidos} fallidos · ${mails} mails`);
  return NextResponse.json({ ok: true, socios: socios?.length ?? 0, debitosActualizados, debitosEsperandoAprobacion, debitosFallidos, mails });
}
