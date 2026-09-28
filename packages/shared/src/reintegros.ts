/**
 * Seguimiento de un reintegro.
 *
 * El prototipo trae los pasos escritos a mano en cada reintegro de ejemplo. Acá
 * se derivan del estado real, que es el único dato que existe, y vive en la capa
 * compartida para que la webapp y la app móvil no cuenten historias distintas.
 */

/* ── Cuánto se reintegra ───────────────────────────────────────── */

/**
 * El piso, para cuando no se sabe el plan.
 *
 * Es el más bajo de los publicados (AMIGO, 30%). Se usa en un solo caso: el
 * socio que está al día pero sin plan escrito —pasa cuando el cobro se acredita
 * y el plan no se llega a guardar—. Dejarlo en cero convertiría un reintegro
 * legítimo en uno de $0; dejarlo alto sería regalar plata. En cualquier caso es
 * sólo lo que se le MUESTRA: el número que se guarda lo decide el servidor.
 */
export const PISO_REINTEGRO = 30;

/**
 * El porcentaje que le toca a un socio, según su plan.
 *
 * El número sale de `plans.refund_pct`, que edita el club en el panel. NO hay
 * una tabla de porcentajes en el código, y es a propósito: hasta el 28/09/2026
 * había tres —la app con 30/50/70, la webapp con 50 fijo para todos, y los
 * textos publicados de los planes con 30/50/60—, así que el mismo socio AMIGO
 * pedía $3.000 desde el teléfono y $5.000 desde el navegador por el mismo gasto.
 *
 * Esto es para mostrar. Lo que se guarda lo calcula el trigger de
 * `reimbursements` leyendo el mismo campo, así que una app vieja que mande otro
 * número no puede torcerlo.
 */
export function porcentajeReintegro(planRefundPct?: number | null): number {
  return planRefundPct && planRefundPct > 0 ? planRefundPct : PISO_REINTEGRO;
}

/** Lo que le corresponde por un gasto, redondeado al peso. */
export function montoReintegro(gasto: number, planRefundPct?: number | null): number {
  return Math.round((gasto * porcentajeReintegro(planRefundPct)) / 100);
}

/**
 * Cuánto le queda a un socio del tope, mirando lo que ya pidió.
 *
 * Cuenta TODO lo que no esté rechazado, incluido lo que está en revisión: un
 * pedido pendiente ya es un compromiso contra el tope. La misma regla corre en
 * el trigger, que es el que manda; esto existe para poder decírselo ANTES de que
 * cargue la factura y no después.
 *
 * `null` cuando el plan no tiene tope, que no es lo mismo que cero.
 */
export function topeRestante(
  reintegros: { refund: number; status: string; requestedOn: string }[],
  tope: number,
  desdeISO: string,
  hastaISO: string,
): number | null {
  if (!tope || tope <= 0) return null;
  const usado = reintegros
    .filter((r) => r.status !== 'rechazado' && r.requestedOn >= desdeISO && r.requestedOn < hastaISO)
    .reduce((a, r) => a + r.refund, 0);
  return Math.max(0, tope - usado);
}

/**
 * Lo que se le puede reintegrar HOY por un gasto: el porcentaje de su plan,
 * recortado por lo que le queda de los topes.
 *
 * Decidido con el club el 28/09/2026: pasarse no rechaza el pedido, lo recorta.
 * Si a un AMIGO le corresponden $6.000 y le quedan $5.400 de tope, cobra $5.400;
 * rechazárselo entero lo dejaría sin lo que sí le corresponde. Sin cupo, en
 * cambio, no hay nada que pedir y conviene decirlo antes de que cargue la
 * factura. La misma regla corre en el trigger, que es el que manda.
 */
export function reintegroDisponible(opts: {
  gasto: number;
  planRefundPct?: number | null;
  restanteMes: number | null;
  restanteAnio: number | null;
}): { monto: number; techo: number | null; recortado: boolean; sinCupo: boolean } {
  const techos = [opts.restanteMes, opts.restanteAnio].filter((t): t is number => t !== null);
  const techo = techos.length > 0 ? Math.min(...techos) : null;
  const pleno = montoReintegro(opts.gasto, opts.planRefundPct);
  const monto = techo === null ? pleno : Math.min(pleno, techo);
  return { monto, techo, recortado: techo !== null && pleno > techo, sinCupo: techo === 0 };
}

export type ReintPaso = {
  label: string;
  /** Cuándo pasó, o "Pendiente" si todavía no. */
  when: string;
  done: boolean;
};

export const REINT_TONE: Record<string, { bg: string; fg: string }> = {
  acreditado: { bg: '#e2f5ea', fg: '#2f8f5b' },
  aprobado: { bg: '#e2f5ea', fg: '#2f8f5b' },
  en_revision: { bg: '#fbf3e2', fg: '#b8860b' },
  rechazado: { bg: '#fbe8ef', fg: '#b0483f' },
};

/**
 * Los pasos del seguimiento, marcados según el estado.
 *
 * SON TRES Y NO CUATRO. El prototipo tenía "Aprobado" y "Acreditado" separados, y
 * la idea era buena —una cosa es que el club te lo reconozca y otra que la plata
 * esté en tu cuenta—, pero el club NO REGISTRA la segunda: el panel tiene un solo
 * botón ("Aprobar y transferir") y ahí se termina. Con los dos pasos, los dos se
 * prendían en el mismo instante y el socio leía "acreditado" el día que lo
 * aprobaban, iba al banco y no había nada: la transferencia tarda hasta 30 días.
 *
 * Un paso que siempre se prende junto con el anterior no informa: miente. Así que
 * el seguimiento termina en "Aprobado" y el aviso dice cuánto puede tardar.
 * El día que el club lleve registro de la transferencia, vuelve el cuarto paso.
 *
 * Se conocen dos fechas: cuándo se pidió y cuándo el club lo resolvió
 * (`resolved_at`). "En revisión" se muestra hecho pero SIN fecha: la base no
 * guarda cuándo pasó, y ponerle la de la resolución sería inventar una fecha a
 * partir de otra. Los reintegros resueltos antes de que existiera la columna
 * tampoco tienen fecha, y también quedan sin ella en vez de con una falsa.
 */
export function reintPasos(status: string, pedidoLabel: string, resueltoLabel = ''): ReintPaso[] {
  if (status === 'rechazado') {
    return [
      { label: 'Solicitud enviada', when: pedidoLabel, done: true },
      { label: 'En revisión', when: '', done: true },
      { label: 'No aprobado', when: resueltoLabel, done: true },
    ];
  }
  /* `acreditado` es el valor que escribe el panel al aprobar y `aprobado` no lo
     escribe nadie: los dos significan lo mismo —el club lo aprobó y transfirió—
     y se tratan igual. El nombre del estado en la base quedó de cuando eran dos
     pasos; cambiarlo sería una migración que no cambia nada de lo que se ve. */
  const aprobado = status === 'aprobado' || status === 'acreditado';
  return [
    { label: 'Solicitud enviada', when: pedidoLabel, done: true },
    { label: 'En revisión', when: '', done: true }, // toda solicitud entra en revisión al crearse
    { label: 'Aprobado', when: aprobado ? resueltoLabel : '', done: aprobado },
  ];
}

/** Texto del pie de cada paso. */
export const pasoWhen = (p: ReintPaso) => (p.when ? `✓ ${p.when}` : p.done ? 'Listo' : 'Pendiente');
