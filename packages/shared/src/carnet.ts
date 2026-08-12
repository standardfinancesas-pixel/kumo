/**
 * Carnet de salud: calendario mensual y alta de vacuna/estudio.
 *
 * La grilla del calendario y las reglas de color son idénticas en la webapp y en
 * la app móvil, así que el cálculo vive acá y cada superficie solo dibuja. Sigue
 * a reference/kumo-prototype.html.
 */

import type { VaccineKind } from './types';

export const VACUNA_KINDS: VaccineKind[] = ['Vacuna', 'Estudio', 'Antiparasitario'];

/** Ícono por tipo, para que las dos superficies elijan el mismo. */
export const KIND_ICON: Record<VaccineKind, 'shield' | 'pill' | 'plus'> = {
  Vacuna: 'shield',
  Antiparasitario: 'pill',
  Estudio: 'plus',
};

/** Vacuna tal como la necesita el calendario: fechas crudas, sin formatear. */
export type CalVac = { id: string; name: string; status: string; appliedOn: string | null; dueOn: string | null };

/** Qué marca un día: ya aplicada, próxima dentro de 3 días, o próxima más lejana. */
export type CalMark = 'aplicada' | 'pronto' | 'pendiente';

export type CalCell = {
  /** null en los huecos antes del día 1. */
  num: number | null;
  iso: string | null;
  mark: CalMark | null;
  /** Lo que pasó (o pasa) ese día. Vacío si no hay nada. */
  vaxes: { name: string; estado: string }[];
};

/** Colores del prototipo: fondo, borde y punto de cada marca. */
export const CAL_TONE: Record<CalMark, { bg: string; border: string; dot: string }> = {
  aplicada: { bg: '#e6f4ec', border: '#2f8f5b', dot: '#2f8f5b' },
  pronto: { bg: '#eef7d6', border: '#c7e04f', dot: '#c7e04f' },
  pendiente: { bg: '#fbf1d8', border: '#e6c04d', dot: '#e6c04d' },
};

export const CAL_DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "Julio 2026". */
export const calMesLabel = (year: number, month: number) => `${MESES_LARGOS[month]} ${year}`;
/** "15 de julio". */
export const calDiaLabel = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)} de ${MESES_LARGOS[Number(m) - 1]!.toLowerCase()}`;
};
/** "15 ago 2026", el formato que muestran las dos superficies. */
export const fmtFechaCorta = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d} ${MESES_CORTOS[Number(m) - 1]} ${y}`;
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function diasHasta(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(fecha + 'T00:00:00').getTime() - hoy.getTime()) / 86400000);
}

/**
 * Arma las celdas del mes: los huecos iniciales para que el 1 caiga en su día de
 * la semana, y después cada día con lo que tenga marcado.
 *
 * Una vacuna puede marcar dos días distintos: el de aplicación y el del próximo
 * vencimiento. Si en un mismo día coinciden varias, gana la más "resuelta"
 * (aplicada sobre pronto sobre pendiente), como en el prototipo.
 */
export function buildCalMes(vacs: CalVac[], year: number, month: number): CalCell[] {
  const porDia = new Map<string, { name: string; estado: string; mark: CalMark }[]>();
  const push = (fecha: string, item: { name: string; estado: string; mark: CalMark }) => {
    const lista = porDia.get(fecha) ?? [];
    lista.push(item);
    porDia.set(fecha, lista);
  };

  for (const v of vacs) {
    if (v.appliedOn) push(v.appliedOn, { name: v.name, estado: 'Aplicada', mark: 'aplicada' });
    if (v.dueOn && v.status !== 'aplicada') {
      const pronto = diasHasta(v.dueOn) <= 3;
      push(v.dueOn, { name: v.name, estado: pronto ? 'Próxima en 3 días' : 'Próxima pendiente', mark: pronto ? 'pronto' : 'pendiente' });
    }
  }

  const cells: CalCell[] = [];
  const primerDia = new Date(year, month, 1).getDay();
  const ultimo = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < primerDia; i++) cells.push({ num: null, iso: null, mark: null, vaxes: [] });
  for (let d = 1; d <= ultimo; d++) {
    const key = iso(year, month, d);
    const lista = porDia.get(key) ?? [];
    const mark: CalMark | null = lista.some((x) => x.mark === 'aplicada') ? 'aplicada'
      : lista.some((x) => x.mark === 'pronto') ? 'pronto'
      : lista.some((x) => x.mark === 'pendiente') ? 'pendiente'
      : null;
    cells.push({ num: d, iso: key, mark, vaxes: lista.map(({ name, estado }) => ({ name, estado })) });
  }
  return cells;
}

/** Celdas del date picker del formulario: los mismos huecos, sin marcas. */
export function buildPickerMes(year: number, month: number): { num: number | null; iso: string | null }[] {
  const cells: { num: number | null; iso: string | null }[] = [];
  const primerDia = new Date(year, month, 1).getDay();
  const ultimo = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < primerDia; i++) cells.push({ num: null, iso: null });
  for (let d = 1; d <= ultimo; d++) cells.push({ num: d, iso: iso(year, month, d) });
  return cells;
}
