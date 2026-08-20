import { NextResponse } from 'next/server';
import { barrioDe } from '@/lib/lugares';

/**
 * En qué barrio cae un punto. La usan los campos de domicilio cuando la persona
 * elige una dirección de CABA, porque el callejero oficial ahí devuelve la comuna y
 * nadie dice que vive en la Comuna 13.
 *
 * Pública igual que `/api/lugares`: la usa el alta, donde todavía no hay sesión. No
 * expone nada — de un par de coordenadas contesta un nombre de barrio.
 */

/*
 * Caché por coordenadas redondeadas a tres decimales, que son unos 100 metros: un
 * barrio mide miles, así que redondear no cambia la respuesta y hace que dos
 * personas de la misma cuadra se cuenten como una sola consulta. Importa porque del
 * otro lado está el servidor comunitario de Nominatim.
 */
const CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { cuando: number; barrio: string | null }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 });
  }

  const clave = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const guardada = cache.get(clave);
  const ahora = Date.now();
  if (guardada && ahora - guardada.cuando < CACHE_MS) {
    return NextResponse.json({ barrio: guardada.barrio });
  }

  const barrio = await barrioDe(lat, lng);

  if (cache.size >= CACHE_MAX) {
    const masVieja = cache.keys().next().value;
    if (masVieja) cache.delete(masVieja);
  }
  cache.set(clave, { cuando: ahora, barrio });

  return NextResponse.json({ barrio });
}
