/**
 * De un domicilio escrito a mano, un punto en el mapa.
 *
 * Usa **Nominatim**, el geocodificador de OpenStreetMap: gratis, sin clave y sin
 * tarjeta, igual que las teselas del mapa. Su política de uso pide tres cosas y las
 * tres se cumplen acá:
 *
 *  · Identificarse con un User-Agent propio y un contacto (abajo). Con el
 *    User-Agent que pone la librería de turno cortan el acceso.
 *  · Como máximo una consulta por segundo. Esto se llama UNA vez por socio —en el
 *    alta, y cuando cambia su domicilio— y el resultado queda guardado en
 *    `profiles.lat/lng`, así que ninguna pantalla consulta al abrirse.
 *  · No geocodificar en masa. El relleno de los socios que ya estaban se hizo de a
 *    uno, con pausa entre cada uno.
 *
 * Nunca lanza: un domicilio que no se puede resolver no puede voltear un alta. El
 * que queda sin coordenadas ve el mapa en el centro de CABA y la pantalla se lo
 * dice ("del centro" en vez de "de tu casa").
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/* Quién consulta y a dónde escribirle: lo exige la política de Nominatim. El sitio
   va escrito y no importado de `@kumo/shared` para que este archivo se pueda
   compilar y probar solo, que es como se verificaron los domicilios reales. */
const IDENTIDAD = 'Kumo/1.0 (https://www.kumo.pet; hola@kumo.pet)';

export type Ubicacion = {
  lat: number;
  lng: number;
  /** Con qué precisión se resolvió: la calle o solo la localidad. */
  origen: 'domicilio' | 'localidad';
};

/** Argentina, a lo bruto. Un resultado afuera de esta caja es un error de
 *  interpretación (hay calles con el mismo nombre en media América), y es mejor no
 *  tener coordenadas que tener las de otro país. */
const CAJA_AR = { latMin: -56, latMax: -21, lngMin: -74, lngMax: -52 };

/** Para comparar "CABA" con "caba" y "Córdoba" con "cordoba": saca los acentos que
 *  `normalize('NFD')` separa de la letra. */
const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * La Ciudad de Buenos Aires, que la gente escribe de seis maneras.
 *
 * Importa porque es donde vive la mayoría de los socios y donde están todos los
 * prestadores: con "caba" a secas, Nominatim devolvió el Banco Central en vez del
 * centro de la ciudad, y la calle no la encontraba.
 */
const ES_CABA = /^(caba|c\.?a\.?b\.?a\.?|capital federal|ciudad de buenos aires|ciudad autonoma de buenos aires|capital)$/;
const CABA = 'Ciudad Autónoma de Buenos Aires';

/**
 * Lo que se le pregunta a Nominatim, en orden: de lo más preciso a lo más general.
 *
 * Las tres limpiezas salen de los domicilios reales que había cargados:
 *
 *  · **El piso y el departamento se van.** "luis maria campos 405, 1" no lo
 *    resolvía; sin el ", 1", cae exacto en Las Cañitas. Nominatim busca portales,
 *    no timbres.
 *  · **CABA se escribe completo**, y sin provincia: "caba, Buenos Aires" es además
 *    contradictorio (la ciudad no está en la provincia).
 *  · **Si la localidad se llama igual que la provincia**, se pide "Ciudad de X":
 *    con "mendoza, Mendoza" contestaba un pueblo a 40 km del centro; con "Ciudad de
 *    Mendoza" cae en el centro.
 */
export function consultasDeDomicilio(partes: {
  address?: string | null;
  city?: string | null;
  province?: string | null;
}): { q: string; origen: Ubicacion['origen'] }[] {
  // Del domicilio, solo la calle y la altura: lo que sigue a la primera coma es el
  // piso, el departamento o una aclaración para el cartero.
  const calle = ((partes.address ?? '').split(',')[0] ?? '')
    .replace(/\b(piso|p\.?b\.?|dto|dpto|depto|departamento|of|oficina|torre|timbre|casa)\b.*$/i, '')
    .trim();
  let localidad = (partes.city ?? '').trim();
  let provincia = (partes.province ?? '').trim();

  if (ES_CABA.test(sinTildes(localidad)) || (!localidad && ES_CABA.test(sinTildes(provincia)))) {
    localidad = CABA;
    provincia = '';
  } else if (ES_CABA.test(sinTildes(provincia))) {
    provincia = CABA;
  } else if (localidad && provincia && sinTildes(localidad) === sinTildes(provincia)) {
    localidad = `Ciudad de ${localidad}`;
  }

  const armar = (...t: string[]) => [...t.filter(Boolean), 'Argentina'].join(', ');
  const consultas: { q: string; origen: Ubicacion['origen'] }[] = [];
  if (calle && (localidad || provincia)) consultas.push({ q: armar(calle, localidad, provincia), origen: 'domicilio' });
  if (localidad || provincia) consultas.push({ q: armar(localidad, provincia), origen: 'localidad' });
  return consultas;
}

async function preguntar(consulta: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM}?${new URLSearchParams({
    q: consulta,
    format: 'jsonv2',
    limit: '1',
    // Solo Argentina: sin esto "Rivadavia 5100" cae en cualquier país.
    countrycodes: 'ar',
    addressdetails: '0',
  })}`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': IDENTIDAD, 'Accept-Language': 'es' },
      // Que el alta no quede colgada esperando a un servicio de terceros.
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const filas = (await r.json()) as { lat?: string; lon?: string }[];
    const fila = Array.isArray(filas) ? filas[0] : null;
    if (!fila) return null;
    const lat = Number(fila.lat);
    const lng = Number(fila.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < CAJA_AR.latMin || lat > CAJA_AR.latMax || lng < CAJA_AR.lngMin || lng > CAJA_AR.lngMax) return null;
    return { lat, lng };
  } catch {
    // Timeout, DNS, 429: no hay coordenadas y no pasa nada más.
    return null;
  }
}

/**
 * El domicilio del socio, resuelto lo mejor que se pueda.
 *
 * Si la calle no se encuentra, el centro de su ciudad sigue siendo muchísimo mejor
 * que el Obelisco para alguien de Mendoza; por eso hay segundo intento. Y se
 * devuelve CUÁL de los dos contestó, porque la pantalla dice "de tu casa" solo
 * cuando resolvió la calle.
 */
export async function geocodificarDomicilio(partes: {
  address?: string | null;
  city?: string | null;
  province?: string | null;
}): Promise<Ubicacion | null> {
  let primera = true;
  for (const consulta of consultasDeDomicilio(partes)) {
    // La pausa entre dos consultas seguidas es la cortesía que pide Nominatim.
    if (!primera) await new Promise((listo) => setTimeout(listo, 1100));
    primera = false;
    const punto = await preguntar(consulta.q);
    if (punto) return { ...punto, origen: consulta.origen };
  }
  return null;
}
