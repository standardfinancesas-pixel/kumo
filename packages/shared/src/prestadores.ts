/**
 * Prestadores: sello y reseñas.
 *
 * Vive acá porque las dos superficies lo mostraban distinto: el badge de la lista
 * salía del rating y no del estado, y la webapp usaba un umbral y la app móvil
 * otro, así que el mismo prestador podía verse "Top rated" en una y "Verificado"
 * en la otra.
 */

/** Reseña tal como la muestran las pantallas. */
export type Review = {
  id: string;
  author: string;
  rating: number;
  text: string;
  createdAt: string;
  /** Si es la del socio logueado: puede editarla. */
  propia: boolean;
};

/**
 * Badge de la tarjeta del prestador.
 *
 * "Verificado" es el estado real (lo pone el admin). "Top rated" es un extra y
 * exige reseñas de verdad: sin un mínimo, un solo 5 dejaría a cualquiera arriba.
 */
export const TOP_RATED_MIN_RESEÑAS = 5;
export const TOP_RATED_MIN_RATING = 4.8;

export function providerBadge(status: string, rating: number, reviews: number): string | undefined {
  if (status !== 'verificado') return undefined;
  return reviews >= TOP_RATED_MIN_RESEÑAS && rating >= TOP_RATED_MIN_RATING ? 'Top rated' : 'Verificado';
}

/** "4.8", o null si todavía nadie lo calificó (no mostrar "0"). */
export function ratingLabel(rating: number, reviews: number): string | null {
  return reviews > 0 ? rating.toFixed(1) : null;
}

/** Estrellas llenas para un rating, para pintar 5 y rellenar las primeras N. */
export const estrellasLlenas = (rating: number) => Math.round(rating);

/** "hace 3 días", "ayer", "hace 2 h". */
export function reviewTiempo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${Math.max(mins, 1)} min`;
  const hs = Math.round(mins / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.round(hs / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}
