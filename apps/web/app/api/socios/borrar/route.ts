import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';
import { cancelarSuscripcion, MercadoPagoSinConfigurar } from '@/lib/mp';

/**
 * El club borra un socio y todo lo suyo.
 *
 * Es distinto de darlo de BAJA (`status = 'baja'`), que es reversible y cuenta para el
 * churn del dashboard. Esto no se puede deshacer, y existe para dos cosas que son
 * reales las dos: limpiar los socios de prueba y cumplir cuando alguien pide que le
 * borren los datos (Ley 25.326, derecho de supresión).
 *
 * El orden importa y no es intercambiable:
 *
 *  1. **Cancelar la suscripción de Mercado Pago.** Va PRIMERO porque es lo único
 *     irreversible que vive afuera: si se borra el perfil sin cancelar, MP le sigue
 *     debitando la tarjeta todos los meses a alguien que ya no existe en Kumo, y sin
 *     el perfil ya no queda ni el `mp_preapproval_id` para poder cancelarla. Si esto
 *     falla, el borrado se aborta.
 *  2. Anotar las fotos del bucket, que hay que borrar por separado (storage no es SQL
 *     y no cascadea) y cuyos nombres viven en filas que están por desaparecer.
 *  3. `borrar_socio()`, que hace todo el SQL en una transacción.
 *  4. El usuario de `auth.users`, con la API de admin.
 *
 * Los pasos 2 y 4 son "de mejor esfuerzo" a propósito: si una foto o el usuario de
 * auth no se pueden borrar, el socio YA se borró y no tiene sentido fallar — se
 * avisa en la respuesta para que el club lo sepa.
 */
export async function POST(req: Request) {
  const { memberId } = (await req.json().catch(() => ({}))) as { memberId?: string };
  if (!memberId) return NextResponse.json({ error: 'Falta el socio.' }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede borrar socios.' }, { status: 403 });
  // Un admin borrándose a sí mismo se queda sin panel para arreglarlo.
  if (memberId === auth.user.id) return NextResponse.json({ error: 'No podés borrarte a vos.' }, { status: 409 });

  const svc = getServiceClient();
  const { data: socio } = await svc
    .from('profiles')
    .select('id, role, full_name, member_no, mp_preapproval_id, mp_subscription_status')
    .eq('id', memberId)
    .maybeSingle();
  if (!socio) return NextResponse.json({ error: 'No encontramos al socio.' }, { status: 404 });
  if (socio.role !== 'socio') return NextResponse.json({ error: 'Ese perfil no es un socio.' }, { status: 409 });

  // ── 1 · El débito de Mercado Pago ──
  const conDebito = socio.mp_preapproval_id
    && (socio.mp_subscription_status === 'authorized' || socio.mp_subscription_status === 'pending');
  if (conDebito) {
    try {
      await cancelarSuscripcion(socio.mp_preapproval_id as string);
      console.log('[socios/borrar] suscripción cancelada', socio.mp_preapproval_id);
    } catch (e) {
      if (e instanceof MercadoPagoSinConfigurar) {
        return NextResponse.json({
          error: 'Tiene un débito activo en Mercado Pago y los pagos no están configurados acá, así que no podemos cancelarlo. Cancelalo desde Mercado Pago y volvé a intentar.',
        }, { status: 503 });
      }
      console.error('[socios/borrar] no pudimos cancelar la suscripción', socio.mp_preapproval_id, e);
      return NextResponse.json({
        error: 'No pudimos cancelar su débito automático, así que no lo borramos: si lo borráramos, Mercado Pago le seguiría cobrando y ya no tendríamos con qué cancelarlo. Probá de nuevo en un rato.',
      }, { status: 502 });
    }
  }

  // ── 2 · Las fotos, antes de que desaparezcan las filas que las nombran ──
  const { data: mascotas } = await svc.from('pets').select('photo_url').eq('owner_id', memberId);
  const { data: posts } = await svc.from('community_posts').select('photo_url').eq('author_id', memberId);
  const rutas = [...(mascotas ?? []), ...(posts ?? [])]
    .map((f) => f.photo_url as string | null)
    .filter((u): u is string => !!u && u.includes('/pet-photos/'))
    // La URL pública es …/object/public/pet-photos/<ruta>, y storage quiere <ruta>.
    .map((u) => u.split('/pet-photos/')[1]!.split('?')[0]!);

  // ── 3 · El SQL, todo junto ──
  const { data: resumen, error } = await svc.rpc('borrar_socio', { p_member_id: memberId });
  if (error) {
    console.error('[socios/borrar] borrar_socio', error);
    return NextResponse.json({ error: 'No pudimos borrar al socio. No se borró nada.' }, { status: 500 });
  }

  // ── 4 · Las fotos y el usuario de auth: el socio ya no está, esto es prolijidad ──
  let fotosBorradas = 0;
  if (rutas.length) {
    const { data: fuera, error: eFotos } = await svc.storage.from('pet-photos').remove(rutas);
    fotosBorradas = fuera?.length ?? 0;
    if (eFotos) console.error('[socios/borrar] fotos que quedaron en el bucket', rutas, eFotos);
  }
  const { error: eAuth } = await svc.auth.admin.deleteUser(memberId);
  if (eAuth) console.error('[socios/borrar] el usuario de auth quedó', memberId, eAuth.message);

  console.log('[socios/borrar]', JSON.stringify(resumen), '· fotos', fotosBorradas, '· por', auth.user.id);
  return NextResponse.json({
    ok: true,
    ...(resumen as Record<string, unknown>),
    fotos: fotosBorradas,
    debitoCancelado: !!conDebito,
    // Si el usuario de auth quedó, el mail no se puede reusar para un alta nueva: el
    // club tiene que saberlo, porque el socio va a chocar con "ya existe una cuenta".
    avisoAuth: eAuth ? 'El socio se borró, pero su usuario de acceso quedó. Escribinos para limpiarlo.' : null,
  });
}
