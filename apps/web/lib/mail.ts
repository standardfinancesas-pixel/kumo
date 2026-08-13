import { Resend } from 'resend';
import { data, urls, waLink } from '@kumo/shared';
import { createClient } from './supabase-public';

/**
 * Mails transaccionales (Resend). SOLO servidor: la API key no puede llegar al
 * navegador, así que este módulo se importa únicamente desde route handlers.
 *
 * Si falta RESEND_API_KEY no se rompe nada: se saltea el envío y se avisa por
 * consola. Es a propósito — que no se pueda dar de alta un socio porque el mail
 * falló sería peor que quedarse sin el mail.
 */
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'Kumo <onboarding@resend.dev>';
/**
 * Para armar links absolutos: en el mail no sirven las rutas relativas.
 *
 * El fallback a VERCEL_URL (que Vercel define solo en cada deploy) está para que
 * un olvido de NEXT_PUBLIC_SITE_URL no termine mandando mails con links a
 * localhost. Peor que un link al dominio de vercel.app es uno que no abre.
 */
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

const BRAND = '#5d5491';
const INK = '#211e33';
const LIME = '#e1fb62';
const MUTED = '#8781a0';

const money = (n: number) => '$' + n.toLocaleString('es-AR');

/**
 * El WhatsApp del club: es a dónde se manda a quien quiera contestar un mail.
 *
 * El remitente no recibe. Un dominio verificado en Resend sirve para mandar, no
 * para recibir: sin MX, `hola@kumo.pet` no es una casilla y toda respuesta
 * rebota. Así que "respondé este mail" era una promesa que el producto no podía
 * cumplir, y el único canal que sí existe es el WhatsApp que el admin carga en
 * `club_settings`.
 *
 * Se lee en cada envío y no se cachea: son mails puntuales, y si el club cambia
 * el número, mandar el viejo es peor que la consulta de más. La tabla es pública
 * (la landing la lee igual), así que alcanza el cliente anon.
 */
async function whatsappDelClub(): Promise<string> {
  try {
    const { data: row } = await createClient()
      .from('club_settings')
      .select('whatsapp')
      .eq('id', 1)
      .single();
    return row?.whatsapp || data.clubSettings.whatsapp;
  } catch {
    return data.clubSettings.whatsapp;
  }
}

/** Envoltorio común: tablas y estilos en línea, que es lo que los clientes de
 *  mail renderizan de forma consistente. */
function layout(titulo: string, cuerpo: string, wa: string, cta?: { label: string; href: string }): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#f5f4f8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f8;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:${BRAND};padding:22px 26px;">
          <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">Kumo</span>
          <span style="color:#c9c3e3;font-size:13px;margin-left:8px;">el club de tu mascota</span>
        </td></tr>
        <tr><td style="padding:26px;">
          ${cuerpo}
          ${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr>
            <td style="background:${BRAND};border-radius:11px;">
              <a href="${cta.href}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${cta.label}</a>
            </td></tr></table>` : ''}
        </td></tr>
        <tr><td style="padding:18px 26px 24px;border-top:1px solid #eeecf5;">
          <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.6;">
            Te escribimos porque tenés una cuenta en Kumo.<br>
            ¿Dudas? Escribinos por <a href="${waLink(wa)}" style="color:${BRAND};font-weight:700;text-decoration:none;">WhatsApp</a> y te contestamos.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function enviar(to: string, subject: string, html: string, text: string) {
  if (!KEY) {
    console.warn(`[mail] RESEND_API_KEY no configurada — no se envió "${subject}" a ${to}`);
    return { skipped: true as const };
  }
  try {
    const resend = new Resend(KEY);
    const { error } = await resend.emails.send({ from: FROM, to, subject, html, text });
    if (error) {
      console.error('[mail] Resend rechazó el envío:', error.message);
      return { error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    console.error('[mail] falló el envío:', e instanceof Error ? e.message : e);
    return { error: 'error de red' };
  }
}

/* ── Piezas que se repiten en varios mails ─────────────────────── */

/** Título de un mail. */
const h1 = (texto: string) => `<h1 style="margin:0 0 10px;font-size:23px;font-weight:700;">${texto}</h1>`;
/** Párrafo del cuerpo. */
const par = (texto: string, ultimo = false) =>
  `<p style="margin:0 0 ${ultimo ? 0 : 18}px;font-size:15px;line-height:1.65;color:#3f3a55;">${texto}</p>`;
/** Recuadro gris con el dato importante. */
const caja = (filas: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9fd;border-radius:12px;padding:16px;margin:0 0 18px;">${filas}</table>`;
const filaChica = (texto: string) => `<tr><td style="font-size:13px;color:${MUTED};padding-bottom:4px;">${texto}</td></tr>`;
const filaGrande = (texto: string) => `<tr><td style="font-size:26px;font-weight:700;color:${BRAND};padding-bottom:10px;">${texto}</td></tr>`;
const filaMedia = (texto: string) => `<tr><td style="font-size:14px;color:#3f3a55;padding-bottom:6px;">${texto}</td></tr>`;
/** Link al WhatsApp del club, dentro de una frase. */
const linkWa = (wa: string, texto: string) =>
  `<a href="${waLink(wa)}" style="color:${BRAND};font-weight:700;text-decoration:none;">${texto}</a>`;
const verCuenta = { label: 'Ir a mi cuenta', href: `${SITE}${urls.webapp}` };

/**
 * Ojo con el género: los textos van en neutro.
 *
 * Estaban escritos en femenino ("¡Bienvenida!", "sos la socia #55") para todo el
 * mundo, y el club no sabe cómo se identifica cada persona: en el alta se piden
 * nombre, DNI y domicilio, nunca el género. Como el mail va con el nombre de
 * pila, acertar la mitad de las veces no es mejor que no suponer nada.
 */

/** 1 · Bienvenida al alta de un socio. */
export async function sendBienvenida(opts: { to: string; firstName: string; petName: string; memberNo: number; planName: string }) {
  const { to, firstName, petName, memberNo, planName } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1(`Te sumaste al club, ${firstName}`)}
    ${par(`${petName} ya tiene su carnet digital, y vos tu número de socio.`)}
    ${caja(`${filaChica('TU NÚMERO DE SOCIO')}${filaGrande(`#${memberNo}`)}${filaMedia(`Plan ${planName}`)}`)}
    ${par(`Desde tu cuenta podés ver el carnet de ${petName}, pedir el reintegro de lo que gastás en el veterinario y usar los descuentos de la red de prestadores.`, true)}`;
  const text = `Te sumaste al club, ${firstName}.\n\n${petName} ya tiene su carnet digital.\nTu número de socio: #${memberNo}\nPlan ${planName}\n\nEntrá a tu cuenta: ${SITE}${urls.webapp}`;
  return enviar(to, `Ya sos parte de Kumo · socio #${memberNo}`, layout('Bienvenida a Kumo', cuerpo, wa, { label: 'Ver mi carnet', href: `${SITE}${urls.webapp}` }), text);
}

/**
 * 2 · Acuse del pedido de reintegro.
 *
 * Antes el socio subía el comprobante y no recibía nada hasta que el club lo
 * resolvía, que puede ser días después: la duda de "¿llegó?" se contestaba
 * escribiendo por WhatsApp. Dice explícitamente que no hace falta volver a
 * mandarlo, porque el reflejo es cargarlo de nuevo.
 */
export async function sendReintegroRecibido(opts: {
  to: string; firstName: string; providerName: string; concept: string; amount: number;
}) {
  const { to, firstName, providerName, concept, amount } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1('Lo estamos revisando')}
    ${par(`${firstName}, nos llegó tu pedido por ${concept} en ${providerName}, por ${money(amount)}.`)}
    ${caja(`${filaMedia(`<strong>${providerName}</strong>`)}${filaChica(`${concept} · ${money(amount)}`)}`)}
    ${par('Lo revisa una persona del club, así que puede tardar unos días hábiles. Te escribimos en cuanto esté resuelto — no hace falta que vuelvas a mandarlo.', true)}`;
  const text = `${firstName}, recibimos tu pedido de reintegro.\n\n${providerName} · ${concept} · ${money(amount)}\n\nLo revisa una persona del club y puede tardar unos días hábiles. Te escribimos cuando esté resuelto: no hace falta volver a mandarlo.\n\nVer el estado: ${SITE}${urls.webapp}`;
  return enviar(to, 'Recibimos tu pedido de reintegro', layout('Pedido de reintegro recibido', cuerpo, wa, { label: 'Ver el estado', href: `${SITE}${urls.webapp}` }), text);
}

/**
 * 3 y 4 · Reintegro resuelto (acreditado o rechazado).
 *
 * El acreditado nombra el CBU: la transferencia la hace el club a mano a la
 * cuenta que el socio cargó, y "se acredita el dinero" a secas dejaba la duda de
 * si venía como descuento en la cuota. El rechazado ofrece cargar el comprobante
 * de nuevo, que es el motivo más común y el único que el socio puede resolver
 * solo.
 */
export async function sendReintegroResuelto(opts: {
  to: string; firstName: string; acreditado: boolean;
  providerName: string; concept: string; amount: number; refund: number;
}) {
  const { to, firstName, acreditado, providerName, concept, amount, refund } = opts;
  const wa = await whatsappDelClub();
  const detalle = caja(`
      ${filaMedia(`<strong>${providerName}</strong>`)}
      <tr><td style="font-size:13px;color:${MUTED};padding-bottom:10px;">${concept} · gastaste ${money(amount)}</td></tr>
      ${acreditado ? `<tr><td style="font-size:13px;color:${MUTED};padding-bottom:2px;">TE ACREDITAMOS</td></tr>
      <tr><td style="font-size:26px;font-weight:700;color:${BRAND};">${money(refund)}</td></tr>` : ''}`);

  const cuerpo = acreditado
    ? `${h1('Aprobamos tu reintegro 🎉')}
       ${par(`${firstName}, ya está: transferimos ${money(refund)} a tu CBU y se acredita en los próximos días hábiles.`)}
       ${detalle}`
    : `${h1('Sobre tu reintegro')}
       ${par(`${firstName}, esta vez no pudimos aprobarlo. Los motivos más comunes son que el comprobante no se lee bien, que el gasto no entra en tu plan, o que ya usaste el tope del mes.`)}
       ${detalle}
       ${par(`Si creés que hubo un error, ${linkWa(wa, 'escribinos por WhatsApp')} y lo revisamos con vos. Si el problema era el comprobante, podés cargarlo de nuevo desde la app.`, true)}`;

  const text = acreditado
    ? `${firstName}, aprobamos tu reintegro.\n\n${providerName} · ${concept}\nGastaste ${money(amount)} · te transferimos ${money(refund)} a tu CBU.\n\nSe acredita en los próximos días hábiles.`
    : `${firstName}, esta vez no pudimos aprobar tu reintegro de ${providerName} (${concept}, ${money(amount)}).\n\nSi creés que hubo un error, escribinos por WhatsApp: ${waLink(wa)}\nSi el problema era el comprobante, podés cargarlo de nuevo desde la app.`;

  return enviar(
    to,
    acreditado ? `Aprobamos tu reintegro de ${money(refund)}` : 'Sobre tu pedido de reintegro',
    layout(acreditado ? 'Reintegro aprobado' : 'Reintegro no aprobado', cuerpo, wa, { label: 'Ver mis reintegros', href: `${SITE}${urls.webapp}` }),
    text
  );
}

/**
 * 5 · Recordatorio de vacuna.
 *
 * TODAVÍA NO LO LLAMA NADIE: necesita un cron que barra los vencimientos y una
 * marca de "ya avisado" para no repetirlo cada día. Hoy el aviso existe solo
 * dentro de la app y se calcula cuando el socio la abre, así que a quien no
 * entra no le llega nada — que es justo el caso que este mail resuelve.
 */
export async function sendVacunaProxima(opts: {
  to: string; firstName: string; petName: string; vacuna: string; fecha: string; dias: number;
}) {
  const { to, firstName, petName, vacuna, fecha, dias } = opts;
  const wa = await whatsappDelClub();
  const cuando = dias === 0 ? 'vence hoy' : dias === 1 ? 'vence mañana' : `vence en ${dias} días`;
  const cuerpo = `
    ${h1(`Se acerca la ${vacuna.toLowerCase()} de ${petName}`)}
    ${par(`${firstName}, ${cuando}: el ${fecha}.`)}
    ${caja(`${filaChica('VENCE')}${filaGrande(fecha)}${filaMedia(`${vacuna} · ${petName}`)}`)}
    ${par('Reservá turno en tu veterinaria y después cargala en el carnet, así no se te pasa la próxima. Si la aplicás en un prestador de la red, te llevás el descuento.', true)}`;
  const text = `${firstName}, la ${vacuna.toLowerCase()} de ${petName} ${cuando} (${fecha}).\n\nReservá turno y cargala en el carnet cuando la apliquen. En los prestadores de la red tenés descuento.\n\nVer el carnet: ${SITE}${urls.webapp}`;
  return enviar(to, `A ${petName} le toca la ${vacuna.toLowerCase()}`, layout('Recordatorio de vacuna', cuerpo, wa, { label: `Ver el carnet de ${petName}`, href: `${SITE}${urls.webapp}` }), text);
}

/**
 * 6 · Cambio de plan.
 *
 * TODAVÍA NO LO LLAMA NADIE, y es a propósito: el cambio de plan no cobra la
 * diferencia (ver el ROADMAP), así que un mail que confirma "tu cuota queda en
 * $X" estaría afirmando algo que no pasó. Se engancha junto con el cobro.
 */
export async function sendPlanCambiado(opts: {
  to: string; firstName: string; planAnterior: string; planNuevo: string; cuota: number;
}) {
  const { to, firstName, planAnterior, planNuevo, cuota } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1('Listo, cambiamos tu plan')}
    ${par(`${firstName}, pasaste del plan ${planAnterior} al ${planNuevo}.`)}
    ${caja(`${filaChica('TU CUOTA MENSUAL')}${filaGrande(money(cuota))}${filaMedia(`Plan ${planNuevo}`)}`)}
    ${par('Los topes y coberturas nuevos ya están activos en tu cuenta. Las carencias de las coberturas que antes no tenías empiezan a contar desde hoy.', true)}`;
  const text = `${firstName}, pasaste del plan ${planAnterior} al ${planNuevo}.\nTu cuota mensual queda en ${money(cuota)}.\n\nLos topes y coberturas nuevos ya están activos. Las carencias de lo que antes no tenías cuentan desde hoy.`;
  return enviar(to, `Tu plan ahora es ${planNuevo}`, layout('Cambio de plan', cuerpo, wa, verCuenta), text);
}

/**
 * 7 · Baja de la membresía.
 *
 * El más delicado: es el comprobante de que la baja se hizo. Dice explícitamente
 * que no se cobra más —el miedo número uno de quien se da de baja— y menciona los
 * 10 días de la Ley 24.240, porque el derecho existe aunque el socio no lo
 * conozca. También aclara que el carnet no se borra, que es lo que más pesa a la
 * hora de volver.
 */
export async function sendBajaMembresia(opts: {
  to: string; firstName: string; petNames: string; hasta: string; dentroDeLos10Dias: boolean;
}) {
  const { to, firstName, petNames, hasta, dentroDeLos10Dias } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1('Tu membresía quedó dada de baja')}
    ${par(`${firstName}, no te vamos a cobrar más. Tu cobertura y los descuentos estuvieron activos hasta el ${hasta}.`)}
    ${par(`El carnet de ${petNames} y su historial de vacunas quedan guardados: si algún día volvés, están ahí.`)}
    ${dentroDeLos10Dias
      ? par(`Como te diste de baja dentro de los primeros 10 días desde el alta, te devolvemos la cuota completa por el mismo medio de pago (Ley 24.240 de Defensa del Consumidor). Si en 5 días hábiles no ves la devolución, ${linkWa(wa, 'escribinos')}.`, true)
      : par(`Si te diste de baja por algo que podamos resolver, ${linkWa(wa, 'contanos')}. Y si querés volver, tu número de socio te espera.`, true)}`;
  const text = `${firstName}, tu membresía quedó dada de baja. No te vamos a cobrar más.\n\nLa cobertura estuvo activa hasta el ${hasta}. El carnet de ${petNames} y su historial quedan guardados.\n\n${dentroDeLos10Dias ? 'Como te diste de baja dentro de los primeros 10 días, te devolvemos la cuota completa por el mismo medio de pago (Ley 24.240).' : `Si querés contarnos por qué, escribinos: ${waLink(wa)}`}`;
  return enviar(to, 'Dimos de baja tu membresía', layout('Baja de la membresía', cuerpo, wa), text);
}

/* ── Prestadores ────────────────────────────────────────────────
 * Van al mail del PERFIL del dueño (`providers.owner_id` → `profiles.email`),
 * porque el único camino de la app para dar de alta un negocio es desde la cuenta
 * de un socio. Los prestadores que cargó el club a mano no tienen dueño
 * —`owner_id` es nullable— y por lo tanto no hay a quién escribirle: la ruta que
 * resuelve avisa que no salió el mail en vez de fallar en silencio.
 */

/** 9 · Recibimos el alta del negocio. */
export async function sendNegocioRecibido(opts: { to: string; firstName: string; negocio: string }) {
  const { to, firstName, negocio } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1('Estamos validando tu negocio')}
    ${par(`Gracias por sumarte, ${firstName}. Antes de publicar ${negocio} revisamos los datos: es lo que hace que el sello de verificado signifique algo para los socios.`)}
    ${par(`Te escribimos en cuanto esté listo. Si necesitamos algo más, te lo pedimos ${linkWa(wa, 'por WhatsApp')}.`, true)}`;
  const text = `Gracias por sumarte, ${firstName}. Estamos validando los datos de ${negocio} antes de publicarlo: es lo que hace que el sello de verificado signifique algo.\n\nTe escribimos en cuanto esté listo.`;
  return enviar(to, `Recibimos los datos de ${negocio}`, layout('Alta de negocio recibida', cuerpo, wa), text);
}

/** 10 · El negocio quedó publicado. */
export async function sendNegocioPublicado(opts: { to: string; firstName: string; negocio: string }) {
  const { to, firstName, negocio } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1(`¡Estás en la red, ${firstName}! 🎉`)}
    ${par(`${negocio} ya aparece en Servicios y los socios pueden verte, contactarte y dejarte reseñas.`)}
    ${par('Desde <strong>Mi negocio</strong> podés editar horarios, precios y fotos cuando quieras. Los cambios se publican al instante.', true)}`;
  const text = `¡Estás en la red, ${firstName}!\n\n${negocio} ya aparece en Servicios: los socios pueden verte, contactarte y dejarte reseñas.\n\nDesde Mi negocio editás horarios, precios y fotos cuando quieras: ${SITE}${urls.webapp}`;
  return enviar(to, `${negocio} ya está publicado en Kumo`, layout('Negocio publicado', cuerpo, wa, { label: 'Ver mi ficha', href: `${SITE}${urls.webapp}` }), text);
}

/** 11 · El negocio no se publicó. */
export async function sendNegocioRechazado(opts: { to: string; firstName: string; negocio: string }) {
  const { to, firstName, negocio } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1('No pudimos publicarlo todavía')}
    ${par(`${firstName}, revisamos ${negocio} y por ahora no lo publicamos. Puede ser porque faltan datos de contacto, porque no pudimos verificar la dirección, o porque el rubro no entra en las categorías del club.`)}
    ${par(`No es definitivo: ${linkWa(wa, 'escribinos por WhatsApp')}, vemos qué falta y lo publicamos.`, true)}`;
  const text = `${firstName}, revisamos ${negocio} y por ahora no lo publicamos: pueden faltar datos de contacto, no haber podido verificar la dirección, o el rubro no entrar en las categorías del club.\n\nNo es definitivo: escribinos y lo resolvemos. ${waLink(wa)}`;
  return enviar(to, `Sobre la publicación de ${negocio}`, layout('Negocio no publicado', cuerpo, wa), text);
}

/* ── Cobro de la cuota ──────────────────────────────────────────
 * Los dos que siguen NO LOS LLAMA NADIE todavía: no hay cobro. Quedan escritos
 * para que, cuando se enganche Mercado Pago, el mail no sea lo último que se
 * improvisa. El del pago rechazado es el que más importa: es plata que no entró y
 * un socio que no sabe que su cobertura está por caerse.
 */

/** 12 · No se pudo cobrar la cuota. */
export async function sendCuotaRechazada(opts: {
  to: string; firstName: string; mes: string; cuota: number; reintentoEl: string;
}) {
  const { to, firstName, mes, cuota, reintentoEl } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1('Tu tarjeta rechazó el pago')}
    ${par(`${firstName}, no pudimos cobrar la cuota de ${mes}. Suele ser por fondos, por una tarjeta vencida o por un tope del banco.`)}
    ${caja(`${filaChica(`CUOTA DE ${mes.toUpperCase()}`)}${filaGrande(money(cuota))}${filaMedia(`Reintentamos el ${reintentoEl}`)}`)}
    ${par('Mientras tanto tu cobertura sigue activa. Si tampoco sale en el reintento, se suspende hasta que regularices.', true)}`;
  const text = `${firstName}, no pudimos cobrar la cuota de ${mes} (${money(cuota)}). Suele ser por fondos, tarjeta vencida o un tope del banco.\n\nReintentamos el ${reintentoEl}. Tu cobertura sigue activa hasta entonces.\n\nActualizá tu tarjeta: ${SITE}${urls.webapp}`;
  return enviar(to, `No pudimos cobrar tu cuota de ${mes}`, layout('Pago rechazado', cuerpo, wa, { label: 'Actualizar mi tarjeta', href: `${SITE}${urls.webapp}` }), text);
}

/** 13 · Cuota cobrada. */
export async function sendCuotaAcreditada(opts: {
  to: string; firstName: string; mes: string; cuota: number; planName: string; tarjeta: string;
}) {
  const { to, firstName, mes, cuota, planName, tarjeta } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1('Pago acreditado')}
    ${par(`${firstName}, cobramos tu cuota de ${mes}.`)}
    ${caja(`${filaChica(`CUOTA DE ${mes.toUpperCase()}`)}${filaGrande(money(cuota))}${filaMedia(`Plan ${planName} · ${tarjeta}`)}`)}
    ${par('El comprobante lo tenés en tu cuenta.', true)}`;
  const text = `${firstName}, cobramos ${money(cuota)} del plan ${planName} por ${mes}, con tu ${tarjeta}.\n\nEl comprobante está en tu cuenta: ${SITE}${urls.webapp}`;
  return enviar(to, `Cobramos tu cuota de ${mes}`, layout('Pago acreditado', cuerpo, wa, verCuenta), text);
}
