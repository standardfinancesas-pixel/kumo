import { NextResponse } from 'next/server';
import { quienPide } from '@/lib/quien-pide';
import { getServiceClient } from '@/lib/supabase-service';
import { geocodificarComercio } from '@/lib/geocodificar';

/**
 * Pone el comercio de un beneficio en el mapa.
 *
 * Los beneficios los carga el club en el panel, así que esto es **solo para
 * admins**: no hay dueño a quien pedirle permiso, y el que edita el catálogo es el
 * mismo que decide dónde queda cada comercio.
 *
 * Solo recibe el id: la dirección la lee de la fila. Sin dirección, las coordenadas
 * quedan en null y el beneficio se muestra sin distancia — ver `consultasDeComercio`
 * para por qué no se resuelve la zona sola.
 */

/* Un freno por beneficio, igual que en las otras dos rutas: en memoria y por
   instancia, para no golpear a Nominatim si alguien guarda diez veces seguidas. */
const ultimoPedido = new Map<string, number>();
const ESPERA_MS = 60_000;

export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Falta el beneficio.' }, { status: 400 });

  const quien = await quienPide(req);
  if (!quien) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const svc = getServiceClient();
  const { data: yo } = await svc.from('profiles').select('role').eq('id', quien.id).single();
  if (yo?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede ubicar beneficios.' }, { status: 403 });
  }

  const { data: beneficio } = await svc
    .from('benefits')
    .select('id, address, zone')
    .eq('id', id)
    .single();
  if (!beneficio) return NextResponse.json({ error: 'No encontramos el beneficio.' }, { status: 404 });

  const ahora = Date.now();
  if (ahora - (ultimoPedido.get(id) ?? 0) < ESPERA_MS) return NextResponse.json({ ok: false, motivo: 'muy seguido' });
  ultimoPedido.set(id, ahora);

  const ubicacion = await geocodificarComercio({ address: beneficio.address, zone: beneficio.zone });

  const { error } = await svc
    .from('benefits')
    .update({ lat: ubicacion?.lat ?? null, lng: ubicacion?.lng ?? null })
    .eq('id', id);
  if (error) {
    console.error('[beneficios/ubicacion] no pude guardar', error);
    return NextResponse.json({ error: 'No pudimos guardar la ubicación.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ubicacion });
}
