/**
 * Seguimiento de un reintegro.
 *
 * El prototipo trae los pasos escritos a mano en cada reintegro de ejemplo. Acá
 * se derivan del estado real, que es el único dato que existe, y vive en la capa
 * compartida para que la webapp y la app móvil no cuenten historias distintas.
 */

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
 * Los cuatro pasos del prototipo, marcados según el estado.
 *
 * Se conocen dos fechas: cuándo se pidió y cuándo el club lo resolvió
 * (`resolved_at`). El paso intermedio "En revisión" y, cuando ya está acreditado,
 * el "Aprobado", se muestran hechos pero SIN fecha: la base no guarda cuándo pasó
 * cada uno, y ponerle la de la resolución sería inventar dos fechas a partir de
 * una. Los reintegros resueltos antes de que existiera la columna tampoco tienen
 * fecha, y también quedan sin ella en vez de con una falsa.
 */
export function reintPasos(status: string, pedidoLabel: string, resueltoLabel = ''): ReintPaso[] {
  if (status === 'rechazado') {
    return [
      { label: 'Solicitud enviada', when: pedidoLabel, done: true },
      { label: 'En revisión', when: '', done: true },
      { label: 'No aprobado', when: resueltoLabel, done: true },
    ];
  }
  const revisado = true; // toda solicitud entra en revisión al crearse
  const aprobado = status === 'aprobado' || status === 'acreditado';
  const acreditado = status === 'acreditado';
  return [
    { label: 'Solicitud enviada', when: pedidoLabel, done: true },
    { label: 'En revisión', when: '', done: revisado },
    // Con la fecha de resolución solo se puede fechar el estado FINAL al que
    // llegó: si ya está acreditado, esa fecha es la de la acreditación.
    { label: 'Aprobado', when: acreditado ? '' : aprobado ? resueltoLabel : '', done: aprobado },
    { label: 'Acreditado', when: acreditado ? resueltoLabel : '', done: acreditado },
  ];
}

/** Texto del pie de cada paso. */
export const pasoWhen = (p: ReintPaso) => (p.when ? `✓ ${p.when}` : p.done ? 'Listo' : 'Pendiente');
