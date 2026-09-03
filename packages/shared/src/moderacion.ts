/**
 * Moderación del foro.
 *
 * Los motivos viven acá y no en cada app para que el club lea siempre la misma
 * lista: si la webapp y el celular ofrecieran motivos distintos, la pantalla de
 * Moderación mostraría categorías que no se pueden comparar entre sí.
 *
 * Son cuatro a propósito. Con más, la persona que reporta elige el primero que
 * más o menos encaja; con menos, todo termina en "Otro" y el club no sabe nada.
 */
export const MOTIVOS_REPORTE = [
  'Spam o publicidad',
  'Agresivo o discriminatorio',
  'Información peligrosa para la mascota',
  'Otro',
] as const;

export type MotivoReporte = (typeof MOTIVOS_REPORTE)[number];

/* ── Bloquear a una persona ──────────────────────────────────────────────── */

/**
 * Saca del foro lo que escribió quien bloqueaste.
 *
 * Trabaja sobre las filas CRUDAS de la base y no sobre el modelo de cada pantalla:
 * los dos modelos se arman distinto, pero las dos superficies leen exactamente las
 * mismas columnas, así que el filtro es uno solo y corre antes de que se separen.
 *
 * Vive acá y no en cada app por la misma razón que los motivos y las categorías:
 * si una superficie escondiera la publicación y la otra no, el bloqueo no sería un
 * bloqueo — sería un lugar donde funciona y otro donde no.
 *
 * Esconde LAS DOS COSAS: la publicación entera si es de esa persona, y sus
 * respuestas adentro de publicaciones de cualquier otro. Filtrar sólo las
 * publicaciones deja la mitad del problema intacta, que además es la peor: las
 * respuestas son las que aparecen abajo de lo que vos escribiste.
 *
 * El contador de respuestas se recalcula sobre lo que queda: si dice "3
 * respuestas" y adentro hay una, la persona bloqueada sigue estando ahí en forma
 * de número que no cierra.
 */
export function sinBloqueados<
  A extends { author_id?: string | null },
  P extends { author_id?: string | null; community_answers?: A[] | null; replies?: number },
>(posts: P[], bloqueados: Iterable<string>): P[] {
  const fuera = new Set(bloqueados);
  if (fuera.size === 0) return posts;
  return posts
    .filter((p) => !(p.author_id && fuera.has(p.author_id)))
    .map((p) => {
      const respuestas = p.community_answers;
      if (!respuestas?.length) return p;
      const quedan = respuestas.filter((r) => !(r.author_id && fuera.has(r.author_id)));
      return quedan.length === respuestas.length ? p : { ...p, community_answers: quedan, replies: quedan.length };
    });
}

/**
 * Las categorías del foro.
 *
 * Viven acá y no en cada app porque estaban escritas dos veces —una en la webapp y
 * otra en la del celular— y la categoría es un `text` libre en la base: dos listas
 * que se separan no dan un error, dan publicaciones que no se pueden encontrar
 * desde la otra superficie. El chip filtra por igualdad exacta, así que una tilde de
 * diferencia alcanza para esconder un tema.
 *
 * Las tres primeras van adelante a propósito: son las que piden una acción de otra
 * persona —encontrar, adoptar, contactar—, y las otras son consulta.
 */
export const FORO_CATEGORIAS = [
  'Perdidos',
  'Adopciones',
  'Emparejamientos',
  'Paseadores',
  'Salud',
  'Guarderías',
  'Adiestramiento',
  'Alimentación',
  'Cruzas',
  'Razas',
] as const;

export type ForoCategoria = (typeof FORO_CATEGORIAS)[number];

/** Con "Todos" adelante, para la fila de filtros. Publicar, en cambio, siempre pide
 *  una categoría concreta: "Todos" no es un tema. */
export const FORO_FILTROS = ['Todos', ...FORO_CATEGORIAS] as const;

/**
 * Con qué categoría arranca el formulario de publicar.
 *
 * No es la primera de la lista a propósito: "Perdidos" abre la fila porque es la que
 * hay que ver primero, pero dejarla como opción por defecto haría que cualquier
 * consulta distraída termine publicada como una mascota perdida — y ahí el costo lo
 * paga la categoría que más precisión necesita.
 */
export const FORO_CATEGORIA_DEFECTO: ForoCategoria = 'Salud';
