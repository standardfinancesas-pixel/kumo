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
