/**
 * Quién puede usar qué, y qué se le dice.
 *
 * Entrar a Kumo es gratis: el carnet, las vacunas, los prestadores, los foros y las
 * mascotas son de cualquier socio. Los **reintegros** y los **beneficios** son de
 * quien tiene la cuota paga. Antes el corte era uno solo y total (un muro tapaba la
 * app entera hasta pagar), y por eso este archivo no existía.
 *
 * Los textos viven acá y no en las pantallas por un motivo concreto: la nota de los
 * reintegros ya está escrita palabra por palabra en la webapp y en la app, y es
 * cuestión de tiempo que se separen. Un socio que lee una cosa en el navegador y
 * otra en el celular no piensa "qué raro": piensa que el club no sabe lo que cobra.
 *
 * El corte de verdad NO está acá: está en la base, en `tiene_plan_pago()`. Esto es
 * lo que decide qué se muestra; la RLS es lo que decide qué se puede pedir. Si
 * alguna vez discrepan, gana la base y la pantalla queda vacía — a propósito.
 */

/** Las dos cosas que se pagan. En un solo lugar para que las dos superficies
 *  filtren el menú contra la misma lista. */
export const FEATURES_PAGAS = ['reintegros', 'beneficios'] as const;
export type FeaturePaga = (typeof FEATURES_PAGAS)[number];

export type EstadoSuscripcion = 'pending' | 'authorized' | 'paused' | 'cancelled' | null;

/**
 * En qué situación está la cuota del socio.
 *
 * `rebotado` es el que faltaba y arregla un bug real: cuando a un socio le rebota
 * el débito, Mercado Pago reintenta y la suscripción sigue en `authorized`, así que
 * la pantalla le decía "estamos confirmando tu pago" para siempre sobre un cobro
 * que ya falló. Son dos cosas distintas y ahora se dicen distinto.
 */
export type EstadoCuota = 'gratuito' | 'vencido' | 'rebotado' | 'activando' | 'confirmando' | 'listo';

export function estadoCuota(opts: {
  /** `paid_until`, o null si nunca pagó. */
  hasta: string | null;
  /** ¿La cuota está impaga hoy? */
  debePagar: boolean;
  suscripcion: EstadoSuscripcion;
  /** Un pago abierto: una transferencia que tarda, un Rapipago sin acreditar. */
  pagoPendiente?: boolean;
  /** Acaba de volver del checkout de Mercado Pago. */
  volviendoDeMP?: boolean;
}): EstadoCuota {
  if (!opts.debePagar) return 'listo';
  /*
   * Débito vivo y nunca pagó: la suscripción quedó autorizada y el primer cobro está
   * en camino. NO es "le rebotó" —no hay nada que le pudiera rebotar todavía— y no es
   * "se le venció" —nunca tuvo un vencimiento—. Es el minuto siguiente al alta, y
   * decirle cualquiera de las otras dos cosas es acusarlo de una deuda inventada.
   *
   * Va PRIMERO porque también aplica si cerró la pantalla y volvió después: el estado
   * no depende de que venga del checkout, depende de la plata.
   */
  if (opts.suscripcion === 'authorized' && !opts.hasta) return 'activando';
  // Volver del checkout o tener un pago abierto es esperar; que el débito esté vivo
  // y el mes sin acreditar teniendo historial de pago, no: eso es un cobro que rebotó.
  if (opts.volviendoDeMP || opts.pagoPendiente) return 'confirmando';
  if (opts.suscripcion === 'authorized') return 'rebotado';
  return opts.hasta ? 'vencido' : 'gratuito';
}

/** ¿Ve reintegros y beneficios? Una sola pregunta, derivada de la misma verdad que
 *  usa la RLS: la cuota paga. */
export const tieneFeaturesPagas = (debePagar: boolean) => !debePagar;

export type CopyCuota = { titulo: string; cuerpo: string; cta: string };

/**
 * Lo que se le dice en cada situación.
 *
 * El texto anterior mentía en dos frentes y los dos importan: decía "para volver a
 * usar tus beneficios, carnet y reintegros" —el carnet ahora es gratis, así que
 * nombraba como rehén algo que la persona ya tiene— y le decía "se te venció la
 * cuota" a alguien que nunca tuvo ninguna.
 */
export function copyCuota(estado: EstadoCuota, nombre: string, hasta?: string | null): CopyCuota {
  switch (estado) {
    case 'gratuito':
      return {
        titulo: `Sumate a un plan, ${nombre}`,
        cuerpo: 'El carnet de tus mascotas, los foros y los prestadores son tuyos, gratis. Con un plan sumás los reintegros de veterinaria y los beneficios en la red de comercios.',
        cta: 'Elegir plan y activar el débito',
      };
    case 'vencido':
      return {
        titulo: `${nombre}, se te venció la cuota`,
        cuerpo: `Tu carnet, los foros y los prestadores siguen andando igual${hasta ? ` (la cuota venció el ${hasta})` : ''}. Para volver a usar los reintegros y los beneficios, reactivá tu cuota.`,
        cta: 'Reactivar mi cuota',
      };
    case 'rebotado':
      return {
        titulo: 'No pudimos cobrarte la cuota',
        cuerpo: 'Tu débito automático sigue activo y Mercado Pago va a volver a intentarlo. Si cambiaste de tarjeta o no tenía saldo, actualizala desde Mercado Pago. Mientras tanto, los reintegros y los beneficios quedan en pausa.',
        cta: 'Ver mi suscripción',
      };
    /*
     * Autorizada y esperando el primer cobro. El título dice lo que YA pasó, porque
     * es verdad y es lo que la persona quiere saber: su plan quedó activo. El cobro
     * es un trámite entre Kumo y Mercado Pago, no algo que ella tenga que vigilar.
     */
    case 'activando':
      return {
        titulo: '¡Listo! Tu plan quedó activo',
        cuerpo: 'Mercado Pago está haciendo el primer cobro; suele tardar un par de minutos. En cuanto entre, los reintegros y los beneficios aparecen solos en tu menú. No hace falta que hagas nada.',
        cta: 'Entrar a la app',
      };
    case 'confirmando':
      return {
        titulo: 'Estamos confirmando tu pago',
        cuerpo: 'Mercado Pago nos tiene que avisar del débito y suele tardar un par de minutos. Podés seguir usando la app mientras esperamos.',
        cta: 'Volver a chequear',
      };
    case 'listo':
      return {
        titulo: '¡Listo! Ya tenés todo el club',
        cuerpo: 'Los reintegros y los beneficios ya están en tu menú.',
        cta: 'Ver mis beneficios',
      };
  }
}

/** El cartel de la tarjeta que invita a pagar, desde Inicio. Dice qué es y qué
 *  falta, sin "premium" ni "desbloqueá". */
export const INVITACION_PLAN = {
  titulo: 'Reintegros y beneficios',
  bajada: 'Se activan con cualquier plan',
} as const;

/**
 * Lo que el socio suma si contrata un plan, para el banner de Inicio.
 *
 * Son SOLO las cosas que el plan habilita de verdad. Los perks guardados en
 * `plans.perks` no sirven para esto: siguen listando el carnet digital, los
 * recordatorios de vacunas y la comunidad como beneficios del plan, y desde que
 * entrar es gratis esas tres las tiene cualquiera. Un banner que ofrece lo que la
 * persona ya tiene no vende nada y encima enseña a ignorar los banners.
 *
 * Los porcentajes y los topes salen de los planes cargados (AMIGO 30%, FAMILIA 50%
 * y 40%, VIP 60%): si el club los cambia en el panel, hay que cambiarlos acá.
 */
export const BANNER_PLAN = {
  titulo: 'Con un plan recuperás parte de lo que gastás',
  puntos: [
    'Reintegros del 30% al 60% en consultas, vacunas, estudios y cirugías',
    'Descuentos en las veterinarias y pet shops de la red',
    'Consulta veterinaria online, desde el plan FAMILIA',
  ],
  cta: 'Ver los planes',
  /** El precio sale de los planes que el club tiene cargados, no de acá: un número
   *  escrito a mano en el banner es el que queda viejo cuando suben la cuota. */
  pie: 'Cambiás o cancelás cuando quieras.',
} as const;

/**
 * Cuánto se espera el aviso de Mercado Pago antes de decir que está tardando.
 *
 * Medido el 19/08 con una suscripción real: el socio autorizó 13:16:34, MP debitó
 * 13:16:52 (18 segundos) y su aviso llegó 13:18:33. Dos minutos de punta a punta.
 * Con los 30 segundos que había antes, el socio pagaba bien y leía "está tardando",
 * que es justo lo que empuja a pagar dos veces.
 *
 * Escalonado para no dispararle 60 recargas a la base: `/app` hace una docena de
 * consultas en cada una.
 */
export const ESPERA_PAGO = { rapidos: 10, limite: 35, msRapido: 3000, msLento: 6000 } as const;

/** Cómo se nombra el plan del socio en pantalla. `planName` llega '—' cuando no
 *  tiene ninguno, y "Plan —" no le dice nada a nadie. */
export function etiquetaPlan(planName: string | null | undefined, debePagar: boolean, activando = false): string {
  const limpio = planName && planName !== '—' ? planName : null;
  if (!limpio) return 'Plan gratuito';
  // Mientras el primer cobro se acredita no se le cuelga "cuota pendiente": el plan
  // está activo y lo pendiente es un trámite nuestro con Mercado Pago.
  if (!debePagar || activando) return `Plan ${limpio}`;
  return `Plan ${limpio} · cuota pendiente`;
}

/**
 * Lo que dice el carnet de la mascota: el sello y la fila de la cobertura
 * odontológica.
 *
 * Está acá porque es el documento que el socio le muestra al veterinario, y hasta
 * ahora las dos superficies lo tenían escrito a mano y fijo: el sello decía
 * **ACTIVO** siempre —incluso a un socio gratuito o a uno con la cuota vencida— y
 * la fila decía **"No activo"** siempre, incluso al que paga $12.000 por mes de más
 * por la cobertura. Un carnet que afirma lo que no puede sostener es peor que uno
 * que no dice nada: el que reclama en el mostrador queda expuesto.
 *
 * La cobertura sigue la misma regla que los reintegros y los beneficios: la
 * habilita la cuota paga, no haberla contratado alguna vez. Alguien con el add-on
 * y la cuota vencida no tiene cobertura, y el carnet no puede decir que sí.
 */
/**
 * El sello del carnet. Cinco casos, y los cinco importan porque es el documento que
 * el socio le muestra al veterinario:
 *
 *  · paga           → ACTIVO
 *  · sin plan       → GRATUITO
 *  · recién se dio de alta y el cobro está en camino → ACTIVANDO
 *  · pagó antes y ahora no → CUOTA VENCIDA (hay una fecha que pasó)
 *  · eligió plan y nunca llegó a pagar → CUOTA PENDIENTE
 *
 * Antes eran dos y decía ACTIVO siempre. Los tres del medio se confundían entre sí, y
 * cada confusión es una acusación: "CUOTA VENCIDA" al minuto de anotarse inventa una
 * deuda, y "PENDIENTE" con la suscripción ya autorizada hace dudar de un pago que
 * está saliendo bien.
 */
export function selloCarnet(opts: {
  debePagar: boolean;
  tienePlan: boolean;
  cuotaHasta?: string | null;
  suscripcion?: EstadoSuscripcion;
}): { texto: string; tono: 'ok' | 'neutro' | 'alerta' } {
  if (!opts.debePagar) return { texto: 'ACTIVO', tono: 'ok' };
  if (!opts.tienePlan) return { texto: 'GRATUITO', tono: 'neutro' };
  if (opts.suscripcion === 'authorized' && !opts.cuotaHasta) return { texto: 'ACTIVANDO', tono: 'neutro' };
  return opts.cuotaHasta
    ? { texto: 'CUOTA VENCIDA', tono: 'alerta' }
    : { texto: 'CUOTA PENDIENTE', tono: 'neutro' };
}

/** La fila "Odontológico" del carnet. */
export const etiquetaOdonto = (addonOdonto: boolean, debePagar: boolean): string =>
  addonOdonto && !debePagar ? 'Activo' : 'No activo';
