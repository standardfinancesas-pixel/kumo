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
