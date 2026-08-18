import { NextResponse } from 'next/server';
import { cuotaMensual } from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * El club registra un pago que cobró por fuera: efectivo, transferencia, un
 * Mercado Pago hecho a mano.
 *
 * Un club de barrio siempre cobra así a algunos socios, y sin esto el panel no
 * tendría forma de ponerlos al día — quedarían con el muro puesto habiendo pagado.
 *
 * Pasa por la MISMA función que el webhook (`acreditar_pago`), y no por un update
 * suelto de `paid_until`: la cuenta de los meses, los bloqueos y la idempotencia
 * ya están resueltos ahí. Dos caminos distintos para sumar un mes es la forma
 * segura de que uno de los dos quede mal.
 */
export async function POST(req: Request) {
  const { memberId, monto, detalle } = (await req.json()) as { memberId?: string; monto?: number; detalle?: string };
  if (!memberId) return NextResponse.json({ error: 'Falta el socio.' }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede registrar pagos.' }, { status: 403 });

  const svc = getServiceClient();
  const { data: socio } = await svc
    .from('profiles')
    .select('id, role, plan_id, addon_odonto, monthly_fee_agreed, plans(name, base_price)')
    .eq('id', memberId)
    .single();
  if (!socio) return NextResponse.json({ error: 'No encontramos al socio.' }, { status: 404 });
  if (socio.role !== 'socio') return NextResponse.json({ error: 'Ese perfil no paga cuota.' }, { status: 409 });

  const plan = Array.isArray(socio.plans) ? socio.plans[0] : socio.plans;
  // El monto lo puede fijar el admin (cobró otra cifra, hizo un descuento), y si
  // no manda nada va la cuota que el socio aceptó.
  const importe = Math.round(monto ?? socio.monthly_fee_agreed ?? (plan ? cuotaMensual(plan.base_price, socio.addon_odonto === true) : 0));
  if (!importe || importe <= 0) return NextResponse.json({ error: 'No pudimos determinar el monto.' }, { status: 409 });

  // Un id propio, con el mismo formato de llave que los débitos de MP: es lo que
  // hace que dos avisos del mismo cobro no acrediten dos veces. Acá lo genera el
  // servidor porque el cobro fue por fuera y no tiene id de Mercado Pago.
  const { data, error } = await svc.rpc('acreditar_cuota', {
    p_member_id: socio.id,
    p_mp_payment_id: `manual:${crypto.randomUUID()}`,
    p_amount: importe,
    p_method: 'manual',
    p_detalle: detalle?.trim() || 'cobrado por fuera de la app',
    p_registrado_por: auth.user.id,
  });
  if (error) {
    console.error('[pagos/manual] acreditar_cuota', error);
    return NextResponse.json({ error: 'No pudimos acreditar el pago.' }, { status: 500 });
  }

  const r = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, acreditado: r?.acreditado === true, hasta: r?.hasta ?? null, motivo: r?.motivo });
}
