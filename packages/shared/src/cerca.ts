/**
 * Kumo · qué queda cerca de quién
 *
 * Todo lo que en la app dice "a 5,9 km de tu casa" sale de acá: desde qué punto se
 * mide, cómo se mide y cómo se llama ese punto en la pantalla.
 *
 * Hasta ahora las dos superficies medían desde el Obelisco, con el punto escrito a
 * mano en cada una y un comentario que lo admitía ("no tenemos la ubicación real
 * del socio"). El texto, en cambio, decía "de tu casa": para alguien de Tandil eso
 * no era una aproximación, era otra cosa. Ahora el punto es el domicilio que el
 * socio cargó en el alta —geocodificado una vez, guardado en su perfil— y el texto
 * dice exactamente de dónde se está midiendo.
 */

/** Desde dónde se está midiendo, que es lo que la pantalla tiene que decir. */
export type OrigenDistancia =
  /** El domicilio del socio, resuelto hasta la calle. */
  | 'casa'
  /** Solo se pudo resolver la localidad: el centro de su ciudad. */
  | 'zona'
  /** No hay domicilio resuelto: el punto fijo de abajo. */
  | 'centro';

/**
 * El punto de siempre, para cuando no sabemos dónde vive el socio.
 *
 * Es el Obelisco. No es un domicilio de nadie: es un centro geográfico para que la
 * lista de prestadores tenga algún orden y el mapa arranque en algún lado. Cuando
 * se usa esto, la pantalla dice "del centro" y no "de tu casa".
 */
export const CENTRO_CABA = { lat: -34.6037, lng: -58.3816 };

export type Punto = { lat: number; lng: number };

/** Cómo se lee cada origen en la pantalla, atado al tipo para que no falte ninguno. */
const TEXTO: Record<OrigenDistancia, string> = {
  casa: 'de tu casa',
  zona: 'de tu zona',
  centro: 'del centro',
};
export function textoDistancia(origen: OrigenDistancia): string {
  return TEXTO[origen];
}

/**
 * Cómo se llama el centro del mapa, cuando es un lugar del socio.
 *
 * Null cuando el centro es el punto fijo: ahí no se dibuja ninguna casa, porque el
 * Obelisco no es la de nadie y un marcador ahí sería una invención.
 */
const CENTRO: Record<OrigenDistancia, string | null> = {
  casa: 'Tu casa',
  zona: 'Tu zona',
  centro: null,
};
export function etiquetaCentro(origen: OrigenDistancia): string | null {
  return CENTRO[origen];
}

/**
 * Desde dónde medirle a este socio.
 *
 * `geo_origen` guarda con qué precisión se resolvió el domicilio, y de ahí sale el
 * texto: con la calle resuelta es "tu casa", con solo la localidad es "tu zona".
 * Sin coordenadas, el punto fijo — y ahí la pantalla deja de hablar de la casa.
 */
export function origenDelSocio(
  perfil: { lat?: number | null; lng?: number | null; geoOrigen?: string | null },
): Punto & { origen: OrigenDistancia } {
  if (perfil.lat == null || perfil.lng == null) return { ...CENTRO_CABA, origen: 'centro' };
  return {
    lat: perfil.lat,
    lng: perfil.lng,
    origen: perfil.geoOrigen === 'localidad' ? 'zona' : 'casa',
  };
}

/**
 * Distancia en línea recta, en kilómetros con un decimal.
 *
 * Es la fórmula del haversine, que estaba copiada en la web y en la app con el
 * origen fijo adentro. Acá el origen es un parámetro: es lo que permite que cada
 * socio vea las distancias desde su casa.
 */
export function distanciaKm(desde: Punto, hasta: Punto): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(hasta.lat - desde.lat);
  const dLng = rad(hasta.lng - desde.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(desde.lat)) * Math.cos(rad(hasta.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.min(1, Math.sqrt(a))) * 10) / 10;
}
