/**
 * Notificaciones del socio.
 *
 * No hay tabla de notificaciones: se derivan de lo que ya está en la base
 * (vacunas, reintegros, el negocio propio). La lógica vive acá y no en cada app
 * para que la webapp y la app móvil muestren exactamente lo mismo: cuando cada
 * una armaba su propia lista, terminaron mostrando cosas distintas.
 */

import { diasHasta, diaISO } from './fechas';

/** Cuántos días antes se avisa un vencimiento del carnet. Dos: alcanza para
 *  conseguir turno y no tan temprano como para olvidarse. Lo usa también el cron
 *  de mails y push, así que el aviso de la app y el del teléfono coinciden. */
export const DIAS_AVISO_CARNET = 2;

export type NotifKind = 'vacuna' | 'reintegro-ok' | 'reintegro-no' | 'reintegro-revision' | 'negocio-ok' | 'negocio-revision' | 'foro-respuesta' | 'foro-like' | 'cuota-ok' | 'cuota-no';

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
  to: 'carnet' | 'reintegros' | 'minegocio' | 'foros' | 'perfil';
  /**
   * Qué abrir dentro de esa pantalla. Hoy sólo el foro lo usa: sin esto, tocar
   * "respondieron tu publicación" te dejaba en la lista del foro a buscar cuál
   * era tuya — y con el foro lleno, eso es peor que no avisar.
   */
  targetId?: string;
};

export type NotifGroup = { label: string; items: Notif[] };

/** Ícono, fondo del chip y color del trazo por tipo, como en el prototipo. */
export const NOTIF_STYLE: Record<NotifKind, { ic: 'bell' | 'wallet' | 'shield' | 'chat' | 'heart'; chip: string; color: string }> = {
  vacuna: { ic: 'bell', chip: '#eef7d6', color: '#5f7d10' },
  'reintegro-ok': { ic: 'wallet', chip: '#e2f5ea', color: '#2f8f5b' },
  'reintegro-no': { ic: 'wallet', chip: '#fbe8ef', color: '#b0483f' },
  'reintegro-revision': { ic: 'wallet', chip: '#fbf3e2', color: '#92690a' },
  'negocio-ok': { ic: 'shield', chip: '#e2f5ea', color: '#2f8f5b' },
  'negocio-revision': { ic: 'shield', chip: '#fbf3e2', color: '#92690a' },
  'foro-respuesta': { ic: 'chat', chip: '#e8e5f5', color: '#5d5491' },
  'foro-like': { ic: 'heart', chip: '#fbe9ee', color: '#c04863' },
  /* Billetera como los reintegros: es la misma plata, entrando o saliendo. */
  'cuota-ok': { ic: 'wallet', chip: '#e2f5ea', color: '#2f8f5b' },
  'cuota-no': { ic: 'wallet', chip: '#fbe8ef', color: '#b0483f' },
};

const money = (n: number) => '$' + n.toLocaleString('es-AR');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const asDate = (iso: string) => new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
/** El día que se muestra es el argentino, no el del reloj de quien mira: con
 *  `getMonth()` sobre un instante, un aviso de las 22:00 de Buenos Aires salía
 *  fechado al día siguiente para quien abriera la app desde otra zona. */
const fmtDia = (iso: string) => {
  const [, m, d] = (iso.length > 10 ? diaISO(iso) : iso).split('-').map(Number);
  return `${d} ${MESES[(m ?? 1) - 1]}`;
};

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
  /** Los negocios del socio. Son varios: puede tener un servicio y un comercio. */
  negocios: { id: string; name: string; status: string; createdAt: string }[];
  /**
   * Lo que pasó en el foro sobre lo que el socio escribió: respuestas a sus
   * publicaciones y "me gusta" a sus publicaciones y a sus respuestas.
   *
   * Llegan SIN agrupar y se agrupan acá, no en la consulta, por lo mismo que el
   * resto: si cada superficie agrupara por su cuenta, terminarían contando
   * distinto. Quien las trae ya se encarga de excluir lo que hizo el socio mismo
   * —nadie necesita que le avisen que se dio me gusta solo—.
   */
  foro: {
    respuestas: { id: string; postId: string; postTitle: string; autor: string; createdAt: string }[];
    likes: { id: string; postId: string; postTitle: string; sobre: 'publicacion' | 'respuesta'; autor: string; createdAt: string }[];
  };
  /** Los cobros de la cuota. Las dos superficies ya los traen para el historial. */
  pagos: { id: string; amount: number; status: string; coversUntil: string | null; createdAt: string; paidAt: string | null }[];
};

/**
 * Cuánto tiempo se muestra un cobro en la campanita.
 *
 * A diferencia de un reintegro o una vacuna, la cuota vuelve TODOS LOS MESES: sin
 * un límite, después de un año la lista es un extracto bancario con doce "cuota al
 * día". Dos ciclos alcanzan para que un rechazo siga a la vista mientras importa,
 * y el historial completo ya vive en "Mis pagos".
 */
const DIAS_PAGO = 60;

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
    /* Los dos estados quieren decir lo mismo —el club aprobó y transfirió— y el
       aviso NO dice "se acreditaron": la transferencia tarda hasta 30 días y así
       el socio iba al banco el mismo día y no encontraba nada. El mail siempre
       dijo lo correcto; esto lo dejaba en offside. */
    if (r.status === 'acreditado' || r.status === 'aprobado') {
      items.push({ id: `re-${r.id}`, kind: 'reintegro-ok', title: 'Reintegro aprobado', body: `Aprobamos ${money(r.refund)} por tu gasto en ${r.providerName}. Se acredita en tu CBU dentro de los 30 días corridos.`, date: cuando, to: 'reintegros' });
    } else if (r.status === 'rechazado') {
      items.push({ id: `re-${r.id}`, kind: 'reintegro-no', title: 'Reintegro no aprobado', body: `No pudimos aprobar el pedido de ${r.providerName}. Respondé el mail que te enviamos y lo revisamos.`, date: cuando, to: 'reintegros' });
    } else {
      items.push({ id: `re-${r.id}`, kind: 'reintegro-revision', title: 'Reintegro en revisión', body: `Estamos revisando tu pedido de ${r.providerName}. Te avisamos cuando esté resuelto.`, date: cuando, to: 'reintegros' });
    }
  }

  /* Uno por negocio: el socio puede tener varios, y con un aviso solo el segundo
     quedaba sin noticias. El id lleva el id del negocio porque si no, dos avisos del
     mismo estado colisionan en la lista. */
  for (const n of input.negocios) {
    if (n.status === 'verificado') {
      items.push({ id: `negocio-ok-${n.id}`, kind: 'negocio-ok', title: '¡Tu negocio fue aprobado! 🎉', body: `"${n.name}" ya está publicado en Servicios. Los socios pueden verte y contactarte.`, date: n.createdAt, to: 'minegocio' });
    } else if (n.status === 'pendiente') {
      items.push({ id: `negocio-rev-${n.id}`, kind: 'negocio-revision', title: 'Tu negocio está en revisión', body: `Estamos validando los datos de "${n.name}". Te avisamos cuando quede publicado.`, date: n.createdAt, to: 'minegocio' });
    }
  }

  /*
   * El foro, agrupado POR PUBLICACIÓN y no por hecho.
   *
   * Sin agrupar, una publicación que junta veinte "me gusta" produce veinte
   * avisos y tapa todo lo demás —el reintegro acreditado queda enterrado—. Con
   * uno por publicación, la campanita dice cuánto pasó sin volverse un ruido que
   * la gente aprende a ignorar, que es la forma más rápida de que un aviso deje
   * de servir.
   *
   * Se fecha con el hecho MÁS RECIENTE del grupo: es lo que hace que una
   * publicación que sigue recibiendo respuestas vuelva a subir en la lista.
   */
  const agrupar = <T extends { postId: string; postTitle: string; createdAt: string; autor: string }>(
    xs: T[],
    /* La clave la decide quien llama y no es siempre el post: un "me gusta" a tu
       publicación y otro a TU RESPUESTA en el mismo hilo son dos cosas distintas
       y tienen que dar dos avisos. Agrupando solo por publicación se fusionaban
       y uno de los dos desaparecía. */
    clave: (x: T) => string = (x) => x.postId,
  ) => {
    const por = new Map<string, T[]>();
    for (const x of xs) { const k = clave(x); por.set(k, [...(por.get(k) ?? []), x]); }
    return [...por.values()].map((g) => {
      const ordenado = [...g].sort((a, b) => asDate(b.createdAt).getTime() - asDate(a.createdAt).getTime());
      const ultimo = ordenado[0]!;
      /* Cuántas PERSONAS, no cuántos hechos: si alguien responde tres veces la
         misma publicación, sigue siendo una persona respondiendo. */
      const personas = new Set(g.map((x) => x.autor)).size;
      return { ultimo, cuantos: g.length, personas };
    });
  };

  for (const { ultimo, personas } of agrupar(input.foro.respuestas)) {
    items.push({
      id: `foro-resp-${ultimo.postId}`,
      kind: 'foro-respuesta',
      title: 'Respondieron tu publicación',
      body: personas === 1
        ? `${ultimo.autor} respondió "${ultimo.postTitle}".`
        : `${ultimo.autor} y ${personas - 1} ${personas === 2 ? 'persona más' : 'personas más'} respondieron "${ultimo.postTitle}".`,
      date: ultimo.createdAt,
      to: 'foros',
      targetId: ultimo.postId,
    });
  }

  for (const { ultimo, personas } of agrupar(input.foro.likes, (x) => `${x.postId}|${x.sobre}`)) {
    /* El texto dice si el me gusta fue a la publicación o a una respuesta tuya:
       "le gustó tu publicación" cuando en realidad comentaste, confunde. */
    const donde = ultimo.sobre === 'respuesta' ? 'tu respuesta en' : 'tu publicación';
    items.push({
      id: `foro-like-${ultimo.postId}-${ultimo.sobre}`,
      kind: 'foro-like',
      /* El título concuerda con el cuerpo: "Le gustó" arriba y "a 3 personas les
         gustó" abajo se contradicen dentro del mismo aviso. El de respuestas no
         tiene el problema porque "Respondieron" sirve para uno o para veinte. */
      title: personas === 1 ? 'Le gustó lo que escribiste' : 'Les gustó lo que escribiste',
      body: personas === 1
        ? `A ${ultimo.autor} le gustó ${donde} "${ultimo.postTitle}".`
        : `A ${personas} personas les gustó ${donde} "${ultimo.postTitle}".`,
      date: ultimo.createdAt,
      to: 'foros',
      targetId: ultimo.postId,
    });
  }

  /*
   * LOS COBROS DE LA CUOTA.
   *
   * Faltaban, y era el hueco que más dolía: a un socio al que se le rechazó la
   * tarjeta se le corta el acceso, y adentro de la app no había ni una palabra
   * sobre por qué. El push y el mail sí salían, pero un push se toca una vez y se
   * va, y el mail se pierde. La campanita es el único lugar donde el motivo queda.
   *
   * Sólo aprobado y rechazado: "pendiente" es un intento abierto —todavía no pasó
   * nada— y "devuelto" lo maneja el club a mano, hablando con el socio.
   */
  for (const pago of input.pagos) {
    const cuando = pago.paidAt ?? pago.createdAt;
    if (Math.floor((Date.now() - asDate(cuando).getTime()) / 86400000) > DIAS_PAGO) continue;
    if (pago.status === 'rechazado') {
      items.push({
        id: `pago-${pago.id}`,
        kind: 'cuota-no',
        title: 'No pudimos cobrar tu cuota',
        body: `Tu tarjeta rechazó el pago de ${money(pago.amount)}. Revisá los datos en Mi perfil así no se corta tu cobertura.`,
        date: cuando,
        to: 'perfil',
      });
    } else if (pago.status === 'aprobado') {
      items.push({
        id: `pago-${pago.id}`,
        kind: 'cuota-ok',
        title: 'Cuota al día',
        body: `Recibimos ${money(pago.amount)} de tu cuota.${pago.coversUntil ? ` Tu cobertura sigue activa hasta el ${fmtDia(pago.coversUntil)}.` : ''}`,
        date: cuando,
        to: 'perfil',
      });
    }
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
