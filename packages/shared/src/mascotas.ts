/**
 * Historial de una mascota.
 *
 * El prototipo lo trae escrito a mano y promete "cuando cargues vacunas o uses
 * beneficios van a aparecer acá". Beneficios usados no se registran en ninguna
 * parte, así que el historial se arma con lo que sí existe: las vacunas y
 * estudios del carnet, y los reintegros pedidos por esa mascota.
 */

export type PetEvento = {
  id: string;
  /** Qué ícono le toca en cada superficie. */
  kind: 'vacuna' | 'estudio' | 'reintegro';
  title: string;
  tag: string;
  sub: string;
  /** ISO, para ordenar. */
  date: string;
};

export type PetHistoryInput = {
  vaccines: { id: string; name: string; kind: string; status: string; appliedOn: string | null; dueOn: string | null }[];
  reintegros: { id: string; providerName: string; concept: string; refund: number; status: string; date: string }[];
};

const money = (n: number) => '$' + n.toLocaleString('es-AR');
const ESTADO_REINT: Record<string, string> = {
  acreditado: 'Acreditado', aprobado: 'Aprobado', rechazado: 'No aprobado', en_revision: 'En revisión',
};

/** Todo junto y de lo más nuevo a lo más viejo. Sin fecha no entra: no hay dónde ubicarlo. */
export function buildPetHistory(input: PetHistoryInput): PetEvento[] {
  const eventos: PetEvento[] = [];

  for (const v of input.vaccines) {
    const esEstudio = v.kind === 'Estudio';
    if (v.appliedOn) {
      eventos.push({
        id: `v-${v.id}`, kind: esEstudio ? 'estudio' : 'vacuna',
        title: v.name, tag: 'Aplicada', sub: v.kind, date: v.appliedOn,
      });
    } else if (v.dueOn) {
      eventos.push({
        id: `v-${v.id}`, kind: esEstudio ? 'estudio' : 'vacuna',
        title: v.name, tag: 'Pendiente', sub: `${v.kind} · vence`, date: v.dueOn,
      });
    }
  }

  for (const r of input.reintegros) {
    eventos.push({
      id: `r-${r.id}`, kind: 'reintegro',
      title: r.providerName, tag: ESTADO_REINT[r.status] ?? r.status,
      sub: `${r.concept} · ${money(r.refund)}`, date: r.date,
    });
  }

  return eventos.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
