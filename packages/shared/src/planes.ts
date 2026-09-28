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

/** Una línea de beneficio que habla del reintegro, venga como venga escrita. */
const HABLA_DE_REINTEGRO = /^\s*reintegros?\b/i;

/**
 * Los beneficios de un plan, con la línea del reintegro ARMADA con el número.
 *
 * Antes era texto libre y el número estaba en el código, así que decían cosas
 * distintas sin que nada avisara: el club editaba "Reintegro 30%" en el panel y
 * la cuenta seguía haciéndose con el valor viejo. Ahora la línea no se escribe,
 * se calcula desde `plans.refund_pct`, que es el mismo campo que usa el trigger
 * para decidir cuánta plata devolver. La promesa y lo que pasa salen del mismo
 * dato: no pueden contradecirse.
 *
 * Va primera porque es lo que el socio viene a buscar, y si alguien vuelve a
 * escribir una línea de reintegro a mano, se descarta en lugar de duplicarse.
 */
export function perksDelPlan(perks: string[], refundPct: number): string[] {
  const resto = perks.filter((p) => !HABLA_DE_REINTEGRO.test(p));
  return refundPct > 0 ? [`Reintegro ${refundPct}% del gasto`, ...resto] : resto;
}
