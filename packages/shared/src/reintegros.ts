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
