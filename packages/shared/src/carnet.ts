/**
 * Carnet de salud: calendario mensual y alta de vacuna/estudio.
 *
 * La grilla del calendario y las reglas de color son idénticas en la webapp y en
 * la app móvil, así que el cálculo vive acá y cada superficie solo dibuja. Sigue
 * a reference/kumo-prototype.html.
 */

import { diasHasta, diaISO } from './fechas';
import type { VaccineKind } from './types';

export const VACUNA_KINDS: VaccineKind[] = ['Vacuna', 'Estudio', 'Antiparasitario'];

/* ── El formulario del carnet ───────────────────────────────────────────── */

/**
 * Lo que el socio completa al cargar —o al corregir— una vacuna o un estudio.
 *
 * La fila de la base tiene DOS fechas (cuándo se aplicó y cuándo toca la próxima)
 * y el formulario tiene una sola, con un interruptor que dice cuál de las dos es.
 * Esa traducción vivía copiada en las dos superficies; acá está una sola vez,
 * porque ya se separaron una vez: "marcar aplicada" borraba la próxima fecha en la
 * app y la conservaba en la web, así que la misma acción dejaba la fila distinta
 * según desde dónde la hicieras.
 */
export type FormVacuna = { kind: VaccineKind; name: string; aplicada: boolean; fecha: string | null };

/** Del formulario a una fila nueva. Acá sí se escriben las dos fechas: una es la
 *  que se cargó y la otra queda explícitamente vacía. */
export function filaDeVacuna(v: FormVacuna): {
  name: string; kind: VaccineKind; status: 'aplicada' | 'pendiente'; applied_on: string | null; due_on: string | null;
} {
  return {
    name: v.name.trim(),
    kind: v.kind,
    status: v.aplicada ? 'aplicada' : 'pendiente',
    applied_on: v.aplicada ? v.fecha : null,
    due_on: v.aplicada ? null : v.fecha,
  };
}

/**
 * Del formulario a una CORRECCIÓN, que no es lo mismo que un alta.
 *
 * Se tocan sólo los campos que el formulario muestra: la otra fecha se deja como
 * estaba. Si no, corregirle el nombre a una vacuna ya aplicada le borraría de paso
 * la fecha de la próxima, que es un dato que el socio cargó y que nadie le pidió
 * tirar. Es el mismo criterio que "marcar aplicada", que conserva la próxima.
 */
export function parcheDeVacuna(v: FormVacuna): Record<string, string | null> {
  const base = { name: v.name.trim(), kind: v.kind, status: v.aplicada ? 'aplicada' : 'pendiente' };
  return v.aplicada ? { ...base, applied_on: v.fecha } : { ...base, due_on: v.fecha };
}

/**
 * El camino de vuelta: de la fila al formulario, para abrirlo ya completo.
 *
 * `aplicada` sale de si tiene fecha de aplicación y no del estado, porque el estado
 * que llega a la pantalla ya viene traducido a algo que se lee ("Al día ✓", "En 5
 * días") y no sirve para decidir.
 */
export function formDeVacuna(v: { kind?: string | null; name: string; appliedOn: string | null; dueOn: string | null }): FormVacuna {
  const aplicada = v.appliedOn != null;
  return {
    kind: (VACUNA_KINDS.includes(v.kind as VaccineKind) ? v.kind : 'Vacuna') as VaccineKind,
    name: v.name,
    aplicada,
    fecha: aplicada ? v.appliedOn : v.dueOn,
  };
}

/** Ícono por tipo, para que las dos superficies elijan el mismo. */
export const KIND_ICON: Record<VaccineKind, 'shield' | 'pill' | 'plus'> = {
  Vacuna: 'shield',
  Antiparasitario: 'pill',
  Estudio: 'plus',
};

/**
 * Vacuna tal como la necesita el calendario: fechas crudas, sin formatear.
 *
 * `kind` viaja para que el calendario diga qué es cada cosa: el carnet mezcla
 * vacunas, estudios y antiparasitarios, y llamarlos todos "vacuna" era mentira.
 */
export type CalVac = { id: string; name: string; kind?: string; status: string; appliedOn: string | null; dueOn: string | null };

/** Qué marca un día: ya aplicada, próxima dentro de 3 días, o próxima más lejana. */
export type CalMark = 'aplicada' | 'pronto' | 'pendiente';

export type CalCell = {
  /** null en los huecos antes del día 1. */
  num: number | null;
  iso: string | null;
  mark: CalMark | null;
  /** Lo que pasó (o pasa) ese día. Vacío si no hay nada. */
  vaxes: { name: string; estado: string; kind: string }[];
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
/**
 * "15 ago 2026", el formato que muestran las dos superficies.
 *
 * Acepta un día ("YYYY-MM-DD") o un instante (`timestamptz`), y en el segundo caso
 * muestra el día ARGENTINO: partir el texto crudo daría el día UTC, y un cobro
 * acreditado a las 22:00 de Buenos Aires aparecería fechado al día siguiente.
 */
export const fmtFechaCorta = (iso: string) => {
  const [y, m, d] = (iso.length > 10 ? diaISO(iso) : iso).split('-');
  return `${d} ${MESES_CORTOS[Number(m) - 1]} ${y}`;
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Arma las celdas del mes: los huecos iniciales para que el 1 caiga en su día de
 * la semana, y después cada día con lo que tenga marcado.
 *
 * Una vacuna puede marcar dos días distintos: el de aplicación y el del próximo
 * vencimiento. Si en un mismo día coinciden varias, gana la más "resuelta"
 * (aplicada sobre pronto sobre pendiente), como en el prototipo.
 */
export function buildCalMes(vacs: CalVac[], year: number, month: number): CalCell[] {
  const porDia = new Map<string, { name: string; estado: string; kind: string; mark: CalMark }[]>();
  const push = (fecha: string, item: { name: string; estado: string; kind: string; mark: CalMark }) => {
    const lista = porDia.get(fecha) ?? [];
    lista.push(item);
    porDia.set(fecha, lista);
  };

  for (const v of vacs) {
    const kind = v.kind ?? 'Vacuna';
    if (v.appliedOn) push(v.appliedOn, { name: v.name, kind, estado: 'Aplicada', mark: 'aplicada' });
    if (v.dueOn && v.status !== 'aplicada') {
      const pronto = diasHasta(v.dueOn) <= 3;
      push(v.dueOn, { name: v.name, kind, estado: pronto ? 'Próxima' : 'Próxima pendiente', mark: pronto ? 'pronto' : 'pendiente' });
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
    cells.push({ num: d, iso: key, mark, vaxes: lista.map(({ name, estado, kind }) => ({ name, estado, kind })) });
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
