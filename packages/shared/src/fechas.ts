/**
 * El día según el calendario argentino.
 *
 * Kumo opera en Argentina: cuando el producto dice "hoy" o "vence en 3 días", el
 * día es el de Buenos Aires, no el de donde corra el código. Importa porque parte
 * del código corre en el navegador o el celular del socio (su reloj) y parte en
 * el servidor de Vercel (UTC): con `new Date()` a secas, entre las 21:00 y la
 * medianoche los dos daban días distintos y el socio veía "En 2 días" donde la
 * app decía "En 3".
 *
 * Argentina está en UTC-3 todo el año — no tiene horario de verano desde 2009 —
 * así que alcanza con correr el reloj tres horas. Se hace a mano y no con
 * `Intl.DateTimeFormat({ timeZone })` porque Hermes (el motor de la app móvil)
 * trae el soporte de zonas horarias recortado según la plataforma.
 */

/** Minutos que Argentina va detrás de UTC. */
export const AR_OFFSET_MIN = 180;

const AR_OFFSET_MS = AR_OFFSET_MIN * 60 * 1000;

/** Hoy en Argentina, como "YYYY-MM-DD". */
export function hoyISO(): string {
  return new Date(Date.now() - AR_OFFSET_MS).toISOString().slice(0, 10);
}

/** Comienzo del mes argentino en curso, como "YYYY-MM-01". */
export function mesActualISO(): string {
  return hoyISO().slice(0, 7) + '-01';
}

/**
 * Días enteros desde hoy (Argentina) hasta una fecha "YYYY-MM-DD".
 * Negativo si ya pasó, 0 si es hoy. Es aritmética de fechas, no de horas: no
 * depende de la hora a la que se pregunte.
 */
export function diasHasta(fechaIso: string): number {
  const dias = (iso: string) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
  return dias(fechaIso) - dias(hoyISO());
}
