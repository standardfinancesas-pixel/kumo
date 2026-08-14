/**
 * Notificaciones del socio.
 *
 * No hay tabla de notificaciones: se derivan de lo que ya está en la base
 * (vacunas, reintegros, el negocio propio). La lógica vive acá y no en cada app
 * para que la webapp y la app móvil muestren exactamente lo mismo: cuando cada
 * una armaba su propia lista, terminaron mostrando cosas distintas.
 */

import { diasHasta } from './fechas';

/** Cuántos días antes se avisa un vencimiento del carnet. Dos: alcanza para
 *  conseguir turno y no tan temprano como para olvidarse. Lo usa también el cron
 *  de mails y push, así que el aviso de la app y el del teléfono coinciden. */
export const DIAS_AVISO_CARNET = 2;

export type NotifKind = 'vacuna' | 'reintegro-ok' | 'reintegro-no' | 'reintegro-revision' | 'negocio-ok' | 'negocio-revision';

export type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  /** Fecha del hecho, en ISO. Ordena la lista y decide el grupo. */
  date: string;
  /** Texto del pie. Si no está, se muestra el tiempo relativo a `date`. */
  timeLabel?: string;
  /** A qué pantalla lleva al tocarla. */
  to: 'carnet' | 'reintegros' | 'minegocio';
};

export type NotifGroup = { label: string; items: Notif[] };

/** Ícono, fondo del chip y color del trazo por tipo, como en el prototipo. */
export const NOTIF_STYLE: Record<NotifKind, { ic: 'bell' | 'wallet' | 'shield'; chip: string; color: string }> = {
  vacuna: { ic: 'bell', chip: '#eef7d6', color: '#5f7d10' },
  'reintegro-ok': { ic: 'wallet', chip: '#e2f5ea', color: '#2f8f5b' },
  'reintegro-no': { ic: 'wallet', chip: '#fbe8ef', color: '#b0483f' },
  'reintegro-revision': { ic: 'wallet', chip: '#fbf3e2', color: '#92690a' },
  'negocio-ok': { ic: 'shield', chip: '#e2f5ea', color: '#2f8f5b' },
  'negocio-revision': { ic: 'shield', chip: '#fbf3e2', color: '#92690a' },
};

const money = (n: number) => '$' + n.toLocaleString('es-AR');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const asDate = (iso: string) => new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
const fmtDia = (iso: string) => { const d = asDate(iso); return `${d.getDate()} ${MESES[d.getMonth()]}`; };

/** "Recién", "Hace 2 h", "Ayer", "Hace 3 días". */
export function notifTiempo(iso: string): string {
  const mins = Math.round((Date.now() - asDate(iso).getTime()) / 60000);
  if (mins < 5) return 'Recién';
  if (mins < 60) return `Hace ${mins} min`;
  const hs = Math.round(mins / 60);
  if (hs < 24) return `Hace ${hs} h`;
  const dias = Math.round(hs / 24);
  if (dias === 1) return 'Ayer';
  return `Hace ${dias} días`;
}

export type NotifInput = {
  pets: { name: string; vaccines: { id: string; name: string; kind?: string; status: string; dueOn: string | null }[] }[];
  reintegros: { id: string; providerName: string; refund: number; status: string; createdAt: string; resolvedAt: string | null }[];
  negocio: { name: string; status: string; createdAt: string } | null;
};

/**
 * Arma las notificaciones y las agrupa por fecha.
 *
 * Nota: el aviso de un reintegro se fecha con `resolved_at` (cuándo el club lo
 * resolvió), y solo cae al `created_at` si todavía está en revisión o si se
 * resolvió antes de que existiera la columna. Antes se usaba siempre el pedido, y
 * un "acreditado" resuelto hoy aparecía en "Antes" fechado semanas atrás. Con el
 * negocio sigue pasando eso: se usa cuándo se dio de alta, no cuándo lo aprobaron.
 */
export function buildNotifs(input: NotifInput): NotifGroup[] {
  const items: Notif[] = [];
  const hoyIso = new Date().toISOString();

  /*
   * Lo del carnet que vence pronto.
   *
   * Dos cosas que estaban mal y se ven en cuanto un socio tiene el carnet cargado:
   * la ventana era de 30 días —o sea que la campanita mostraba avisos de cosas de
   * un mes después, y no se distinguía lo urgente— y TODO se anunciaba como
   * "Recordatorio de vacuna", aunque fuera un estudio o un antiparasitario.
   *
   * Es un recordatorio vigente (no un hecho pasado), así que va arriba —fechado
   * hoy— y en el pie muestra el vencimiento en lugar de un "hace tanto" que no
   * significaría nada.
   */
  for (const pet of input.pets) {
    for (const v of pet.vaccines) {
      if (v.status === 'aplicada' || !v.dueOn) continue;
      const dias = diasHasta(v.dueOn);
      if (dias < 0 || dias > DIAS_AVISO_CARNET) continue;
      const tipo = (v.kind ?? 'Vacuna').toLowerCase();
      // "la antirrábica" pero "el estudio": el artículo depende del tipo.
      const el = tipo === 'vacuna' ? 'La' : 'El';
      items.push({
        id: `vac-${v.id}`,
        kind: 'vacuna',
        title: `Recordatorio de ${tipo}`,
        body: dias === 0
          ? `${el} ${v.name.toLowerCase()} de ${pet.name} vence hoy. Reservá turno en tu veterinaria.`
          : `${el} ${v.name.toLowerCase()} de ${pet.name} vence ${dias === 1 ? 'mañana' : `en ${dias} días`} (${fmtDia(v.dueOn)}). Reservá turno en tu veterinaria.`,
        date: hoyIso,
        timeLabel: dias === 0 ? 'Vence hoy' : `Vence el ${fmtDia(v.dueOn)}`,
        to: 'carnet',
      });
    }
  }

  for (const r of input.reintegros) {
    // El hecho que se avisa es la resolución, no el pedido.
    const cuando = r.resolvedAt ?? r.createdAt;
    if (r.status === 'acreditado') {
      items.push({ id: `re-${r.id}`, kind: 'reintegro-ok', title: 'Reintegro acreditado', body: `Se acreditaron ${money(r.refund)} por tu gasto en ${r.providerName}.`, date: cuando, to: 'reintegros' });
    } else if (r.status === 'aprobado') {
      items.push({ id: `re-${r.id}`, kind: 'reintegro-ok', title: 'Reintegro aprobado', body: `Aprobamos ${money(r.refund)} por tu gasto en ${r.providerName}. Se acredita en tu CBU en las próximas 48 h.`, date: cuando, to: 'reintegros' });
    } else if (r.status === 'rechazado') {
      items.push({ id: `re-${r.id}`, kind: 'reintegro-no', title: 'Reintegro no aprobado', body: `No pudimos aprobar el pedido de ${r.providerName}. Respondé el mail que te enviamos y lo revisamos.`, date: cuando, to: 'reintegros' });
    } else {
      items.push({ id: `re-${r.id}`, kind: 'reintegro-revision', title: 'Reintegro en revisión', body: `Estamos revisando tu pedido de ${r.providerName}. Te avisamos cuando esté resuelto.`, date: cuando, to: 'reintegros' });
    }
  }

  if (input.negocio?.status === 'verificado') {
    items.push({ id: 'negocio-ok', kind: 'negocio-ok', title: '¡Tu negocio fue aprobado! 🎉', body: `"${input.negocio.name}" ya está publicado en Servicios. Los socios pueden verte y contactarte.`, date: input.negocio.createdAt, to: 'minegocio' });
  } else if (input.negocio?.status === 'pendiente') {
    items.push({ id: 'negocio-rev', kind: 'negocio-revision', title: 'Tu negocio está en revisión', body: `Estamos validando los datos de "${input.negocio.name}". Te avisamos cuando quede publicado.`, date: input.negocio.createdAt, to: 'minegocio' });
  }

  items.sort((a, b) => asDate(b.date).getTime() - asDate(a.date).getTime());

  const hoy: Notif[] = [], semana: Notif[] = [], antes: Notif[] = [];
  for (const n of items) {
    const dias = Math.floor((Date.now() - asDate(n.date).getTime()) / 86400000);
    if (dias < 1) hoy.push(n);
    else if (dias < 7) semana.push(n);
    else antes.push(n);
  }
  return [
    { label: 'Hoy', items: hoy },
    { label: 'Esta semana', items: semana },
    { label: 'Antes', items: antes },
  ].filter((g) => g.items.length > 0);
}

/** Cuántas son posteriores a la última vez que el socio abrió el panel. */
export function contarNoLeidas(groups: NotifGroup[], vistoIso: string | null): number {
  if (!vistoIso) return groups.reduce((a, g) => a + g.items.length, 0);
  const visto = new Date(vistoIso).getTime();
  return groups.reduce((a, g) => a + g.items.filter((n) => asDate(n.date).getTime() > visto).length, 0);
}
