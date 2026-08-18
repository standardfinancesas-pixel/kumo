import { NextResponse } from 'next/server';
import { quienPide } from '@/lib/quien-pide';
import { getServiceClient } from '@/lib/supabase-service';
import { cancelarSuscripcion, MercadoPagoSinConfigurar } from '@/lib/mp';

/**
 * El socio da de baja su suscripción.
 *
 * No es un extra: con débito automático la baja tiene que ser tan simple como el
 * alta, y tiene que poder hacerla desde donde se suscribió. Un club que te cobra
 * todos los meses y te hace escribir un mail para cortar es una queja en Defensa
 * del Consumidor esperando a pasar.
 *
 * Lo que se corta es el débito futuro, no el mes ya pagado: `paid_until` no se
 * toca, así que sigue entrando hasta que se le vence. Cobrarle un mes y sacárselo
 * el mismo día sería quedarse con la plata.
 *
 * La baja de la MEMBRESÍA es otra cosa (`profiles.status = 'baja'`) y la decide el
 * socio en Mi perfil. Se puede dar de baja el débito y seguir siendo socio hasta
 * fin de mes.
 */
export async function POST(req: Request) {
  // Igual que crear: la baja tiene que poder hacerse desde el celular también.
  const quien = await quienPide(req);
  if (!quien) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { data: perfil } = await getServiceClient()
    .from('profiles')
    .select('id, mp_preapproval_id, mp_subscription_status, paid_until')
    .eq('id', quien.id)
    .single();
  if (!perfil) return NextResponse.json({ error: 'No encontramos tu perfil.' }, { status: 404 });
  if (!perfil.mp_preapproval_id) {
    return NextResponse.json({ error: 'No tenés una suscripción activa.' }, { status: 409 });
  }

  try {
    const sus = await cancelarSuscripcion(perfil.mp_preapproval_id);
    // El estado lo escribe el servidor (el trigger no deja que lo haga el socio),
    // y de todos modos MP nos va a avisar por webhook: esto es para que la
    // pantalla no quede mintiendo hasta que llegue el aviso.
    await getServiceClient().rpc('marcar_suscripcion', {
      p_member_id: perfil.id,
      p_preapproval_id: perfil.mp_preapproval_id,
      p_status: sus.status ?? 'cancelled',
    });
    return NextResponse.json({ ok: true, hasta: perfil.paid_until });
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) {
      console.error('[suscripcion/baja]', e.message);
      return NextResponse.json({ error: 'No pudimos procesar la baja. Escribinos por WhatsApp y la hacemos nosotros.' }, { status: 503 });
    }
    console.error('[suscripcion/baja]', e);
    return NextResponse.json({ error: 'No pudimos dar de baja el débito. Probá de nuevo o escribinos por WhatsApp.' }, { status: 502 });
  }
}
