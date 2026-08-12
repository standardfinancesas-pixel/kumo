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
 * Solo se conoce la fecha del pedido: la base no guarda cuándo se revisó,
 * aprobó ni acreditó, así que los pasos posteriores se muestran hechos pero sin
 * fecha en vez de inventarle una. Si se agrega un `resolved_at`, usarlo acá.
 */
export function reintPasos(status: string, pedidoLabel: string): ReintPaso[] {
  if (status === 'rechazado') {
    return [
      { label: 'Solicitud enviada', when: pedidoLabel, done: true },
      { label: 'En revisión', when: '', done: true },
      { label: 'No aprobado', when: '', done: true },
    ];
  }
  const revisado = true; // toda solicitud entra en revisión al crearse
  const aprobado = status === 'aprobado' || status === 'acreditado';
  const acreditado = status === 'acreditado';
  return [
    { label: 'Solicitud enviada', when: pedidoLabel, done: true },
    { label: 'En revisión', when: '', done: revisado },
    { label: 'Aprobado', when: '', done: aprobado },
    { label: 'Acreditado', when: '', done: acreditado },
  ];
}

/** Texto del pie de cada paso. */
export const pasoWhen = (p: ReintPaso) => (p.when ? `✓ ${p.when}` : p.done ? 'Listo' : 'Pendiente');
