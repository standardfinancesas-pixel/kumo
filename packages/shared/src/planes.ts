/**
 * Precio del add-on de cobertura odontológica, en ARS por mes.
 *
 * Está en el paquete compartido y no en la pantalla del alta porque lo usan dos
 * lados que no pueden diferir: el cliente para mostrar la cuota y el **servidor**
 * para calcular la que guarda como aceptada. Si el monto lo mandara el
 * navegador, un socio podría firmar por una cuota de $1.
 *
 * Pendiente: debería vivir en la base (una columna de `plans` o una tabla de
 * add-ons) para que el club lo cambie desde el panel sin deployar. Mientras sea
 * una constante, cambiarlo acá no afecta a los socios que ya firmaron: la cuota
 * que aceptaron queda guardada en `profiles.monthly_fee_agreed`.
 */
export const ODONTO_PRECIO = 12000;

/** Cuota mensual de un plan con sus add-ons, que es lo que el socio acepta. */
export const cuotaMensual = (basePrice: number, addonOdonto: boolean) =>
  basePrice + (addonOdonto ? ODONTO_PRECIO : 0);

/* ── Lo que la tarjeta del plan promete ────────────────────────── */

/** Las líneas que ya no se escriben a mano, vengan como vengan redactadas. */
const ES_GENERADA = /^\s*(reintegros?|topes?)\b/i;

const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;

/** Lo que el plan promete sobre la plata, armado con los números que lo cumplen. */
export type PlanConNumeros = {
  perks: string[];
  refundPct: number;
  topeMensual: number;
  topeAnual: number;
};

/**
 * Los beneficios de un plan, con las líneas de plata ARMADAS con sus números.
 *
 * Antes eran texto libre y los números vivían en el código, así que decían cosas
 * distintas sin que nada avisara: el club editaba "Reintegro 30%" en el panel y
 * la cuenta seguía haciéndose con el valor viejo. Ahora estas líneas no se
 * escriben, se calculan desde `plans` —los mismos campos que usa el trigger para
 * decidir cuánta plata devolver y hasta dónde—, así que la promesa y lo que pasa
 * salen del mismo dato: no pueden contradecirse.
 *
 * Van primeras porque es lo que el socio viene a buscar, y si alguien vuelve a
 * escribir una a mano, se descarta en lugar de duplicarse.
 */
export function perksDelPlan(plan: PlanConNumeros): string[] {
  const propias = (plan.perks ?? []).filter((p) => !ES_GENERADA.test(p));
  const generadas = [
    plan.refundPct > 0 ? `Reintegro ${plan.refundPct}% del gasto` : null,
    plan.topeMensual > 0 ? `Tope mensual ${pesos(plan.topeMensual)}` : null,
    plan.topeAnual > 0 ? `Tope anual ${pesos(plan.topeAnual)}` : null,
  ].filter((l): l is string => l !== null);
  return [...generadas, ...propias];
}

/**
 * El renglón que resume todos los planes, armado con los planes.
 *
 * Estaba escrito a mano abajo de las tarjetas ("Reintegros de 30% a 60% ·
 * Topes mensuales de $5.400 a $15.000"). Coincidía de casualidad: al primer
 * cambio de un plan en el panel pasaba a mentir, en la primera pantalla que ve
 * alguien que todavía no es socio. Devuelve null si no hay con qué armarlo.
 */
export function resumenDePlanes(planes: PlanConNumeros[]): string | null {
  const pcts = planes.map((p) => p.refundPct).filter((n) => n > 0);
  const topes = planes.map((p) => p.topeMensual).filter((n) => n > 0);
  if (pcts.length === 0) return null;
  const rango = (min: number, max: number, f: (n: number) => string) =>
    min === max ? f(min) : `de ${f(min)} a ${f(max)}`;
  const reintegros = `Reintegros ${rango(Math.min(...pcts), Math.max(...pcts), (n) => `${n}%`)} según plan`;
  if (topes.length === 0) return reintegros;
  return `${reintegros} · Topes mensuales ${rango(Math.min(...topes), Math.max(...topes), pesos)}`;
}
