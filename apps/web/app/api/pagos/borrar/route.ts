import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * El club borra un cobro.
 *
 * Para dos casos: registró un pago que no era, o hay que limpiar los de prueba.
 *
 * Lo delicado no es borrar la fila, es el mes: un cobro aprobado le sumó exactamente
 * un mes a `paid_until` cuando se acreditó, así que `borrar_pago()` se lo descuenta.
 * Sin eso, el socio se queda con un mes de acceso que nadie pagó y el panel no puede
 * explicar de dónde salió esa fecha. Los cobros rechazados o pendientes no tocan la
 * cuota, así que ahí solo se borra la fila.
 *
 * Ojo con lo que esto NO hace: no le devuelve la plata a nadie. Si el cobro salió por
 * Mercado Pago y hay que reintegrarlo, eso se hace en Mercado Pago.
 */
export async function POST(req: Request) {
  const { pagoId } = (await req.json().catch(() => ({}))) as { pagoId?: string };
  if (!pagoId) return NextResponse.json({ error: 'Falta el cobro.' }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede borrar cobros.' }, { status: 403 });

  const svc = getServiceClient();
  const { data, error } = await svc.rpc('borrar_pago', { p_pago_id: pagoId });
  if (error) {
    console.error('[pagos/borrar]', error);
    return NextResponse.json({ error: 'No pudimos borrar el cobro.' }, { status: 500 });
  }

  console.log('[pagos/borrar]', JSON.stringify(data), '· por', auth.user.id);
  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
