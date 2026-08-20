import { NextResponse } from 'next/server';
import { quienPide } from '@/lib/quien-pide';
import { getServiceClient } from '@/lib/supabase-service';
import { geocodificarComercio } from '@/lib/geocodificar';

/**
 * Pone al prestador en el mapa: de su dirección a un punto.
 *
 * Se llama después de dar de alta un negocio o de editarle la dirección, desde la
 * webapp y desde la app. Sin esto, los prestadores que cargue el club de acá en
 * adelante saldrían en la lista sin distancia y no aparecerían en el mapa — los
 * cinco que hay tienen las coordenadas puestas a mano.
 *
 * Solo recibe el id: la dirección la lee de la fila, así nadie escribe coordenadas
 * a mano. Y puede pedirlo el dueño del negocio o un admin, nadie más: mover el pin
 * de otro sería mandarle sus clientes a otra cuadra.
 *
 * La ciudad y la provincia salen del PERFIL DEL DUEÑO, porque `providers` no las
 * tiene: sin ese contexto, "Rivadavia 5100" existe en veinte ciudades del país.
 */

/* Un freno por negocio, del mismo tipo que el de /api/perfil/ubicacion: en memoria
   y por instancia, para no golpear a Nominatim si alguien guarda diez veces. */
const ultimoPedido = new Map<string, number>();
const ESPERA_MS = 60_000;

export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Falta el negocio.' }, { status: 400 });

  const quien = await quienPide(req);
  if (!quien) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const svc = getServiceClient();
  const { data: negocio } = await svc
    .from('providers')
    .select('id, owner_id, address, zone')
    .eq('id', id)
    .single();
  if (!negocio) return NextResponse.json({ error: 'No encontramos el negocio.' }, { status: 404 });

  const { data: yo } = await svc.from('profiles').select('role').eq('id', quien.id).single();
  if (negocio.owner_id !== quien.id && yo?.role !== 'admin') {
    return NextResponse.json({ error: 'Ese negocio no es tuyo.' }, { status: 403 });
  }

  const ahora = Date.now();
  if (ahora - (ultimoPedido.get(id) ?? 0) < ESPERA_MS) return NextResponse.json({ ok: false, motivo: 'muy seguido' });
  ultimoPedido.set(id, ahora);

  // La ciudad del dueño, no la de quien pide: si esto lo resuelve un admin, el
  // negocio sigue estando en la ciudad de su dueño.
  const { data: dueno } = negocio.owner_id
    ? await svc.from('profiles').select('city, province').eq('id', negocio.owner_id).single()
    : { data: null };

  const ubicacion = await geocodificarComercio({
    address: negocio.address,
    zone: negocio.zone,
    city: dueno?.city,
    province: dueno?.province,
  });

  const { error } = await svc
    .from('providers')
    .update({ lat: ubicacion?.lat ?? null, lng: ubicacion?.lng ?? null })
    .eq('id', id);
  if (error) {
    console.error('[prestadores/ubicacion] no pude guardar', error);
    return NextResponse.json({ error: 'No pudimos guardar la ubicación.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ubicacion });
}
