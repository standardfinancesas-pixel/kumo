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

/* ── Los datos de contacto, convertidos en acciones ─────────────────── */

/**
 * De lo que el prestador escribió, un link que funcione.
 *
 * Los cuatro datos de la ficha —sitio, Instagram, dirección y teléfono— eran texto
 * plano: se veían como información y no se podía hacer nada con ellos. El trabajo
 * real está en que la gente los escribe como quiere: el sitio sin `https://`, el
 * Instagram con arroba, con la URL entera o con las dos cosas.
 *
 * Todos devuelven null cuando no hay nada que abrir, así la pantalla muestra la fila
 * como texto en vez de un link roto.
 */

/** "paseospalermo.com.ar" → "https://paseospalermo.com.ar" */
export function urlSitio(sitio?: string | null): string | null {
  const t = (sitio ?? '').trim();
  if (!t || !t.includes('.')) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** "@paseospalermo", "instagram.com/paseospalermo" o la URL entera → el perfil. */
export function urlInstagram(instagram?: string | null): string | null {
  const t = (instagram ?? '').trim();
  if (!t) return null;
  const usuario = t
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?]/)[0];
  return usuario ? `https://www.instagram.com/${usuario}` : null;
}

/** El teléfono para llamar. Se le dejan el + y los dígitos, nada más. */
export function urlTel(phone?: string | null): string | null {
  const t = (phone ?? '').trim();
  const limpio = t.replace(/[^\d+]/g, '');
  return limpio.replace(/\D/g, '').length >= 8 ? `tel:${limpio}` : null;
}

/** El chat de WhatsApp. Solo dígitos: wa.me no acepta ni el + ni los espacios. */
export function urlWhatsapp(phone?: string | null): string | null {
  const digitos = (phone ?? '').replace(/\D/g, '');
  return digitos.length >= 8 ? `https://wa.me/${digitos}` : null;
}

/**
 * Qué se le pide al mapa: las coordenadas si las hay, y si no la dirección escrita.
 *
 * Las coordenadas son mejores porque son las mismas que muestra el pin —el mapa que
 * se abre cae exactamente donde el socio vio el prestador—, pero un comercio puede
 * tener dirección sin geocodificar y ahí el texto alcanza.
 *
 * Devuelve solo la consulta y no la URL completa porque cada superficie abre otra
 * cosa: la web manda a Google Maps (un link, no un script) y la app usa el esquema
 * del sistema para que se abra la aplicación de mapas que la persona ya usa.
 */
export function consultaMapa(opts: { lat?: number | null; lng?: number | null; direccion?: string | null; zona?: string | null }): string | null {
  if (typeof opts.lat === 'number' && typeof opts.lng === 'number') return `${opts.lat},${opts.lng}`;
  const texto = [opts.direccion, opts.zona].map((t) => (t ?? '').trim()).filter(Boolean).join(', ');
  return texto || null;
}

/** El link de la web para abrir un lugar en el mapa. */
export function urlMapaWeb(opts: Parameters<typeof consultaMapa>[0]): string | null {
  const q = consultaMapa(opts);
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

/**
 * El precio, o null si el prestador no cargó ninguno.
 *
 * Importa que sea null y no 0: la tarjeta y la ficha mostraban "$0" a todo el que no
 * puso tarifa, que es peor que no decir nada — parece que trabaja gratis.
 */
export function precioTexto(price?: number | null, unidad?: string | null): string | null {
  if (!price || price <= 0) return null;
  return `$${price.toLocaleString('es-AR')}${(unidad ?? '').trim()}`;
}
