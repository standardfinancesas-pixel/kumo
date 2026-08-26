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
const MUTED = '#8781a0';

const money = (n: number) => '$' + n.toLocaleString('es-AR');

/** 'Lola', 'Lola y Mora', 'Lola, Mora y Rocco'. Sin la coma de Oxford, que en
 *  castellano no va. */
const listar = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

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

/**
 * La casilla del club: a dónde van los avisos para el ADMIN, no para el socio.
 *
 * Sale de `club_settings` y no de una constante por lo mismo que el WhatsApp: si
 * el club cambia de casilla, los avisos lo siguen sin tocar código ni variables.
 *
 * OJO con una limitación que hoy es real: `hola@kumo.pet` NO recibe mails —el
 * dominio no tiene MX—, así que mientras ese sea el valor cargado, estos avisos
 * salen y rebotan. El envío no se bloquea a propósito: el día que se configure el
 * MX o se cargue otra casilla, empiezan a llegar sin tocar nada.
 */
async function mailDelClub(): Promise<string | null> {
  /*
   * `MAIL_ADMIN` pisa el contacto público, y son dos cosas distintas.
   *
   * `club_settings.email` es la dirección PÚBLICA del club: la muestran la
   * landing, /legal y /eliminar-cuenta, y es a donde le escribe un socio. Los
   * avisos internos van a quien opera el club, que puede ser otra persona y otra
   * casilla — hoy de hecho lo es, porque `hola@kumo.pet` todavía no recibe.
   *
   * Meter la casilla interna en `club_settings` sería publicarla en la web. Por
   * eso va en variable de entorno, solo servidor y sin NEXT_PUBLIC.
   *
   * El día que la casilla del club reciba de verdad, se borra la variable y estos
   * avisos vuelven solos al contacto público. No hay que tocar código.
   */
  const interno = process.env.MAIL_ADMIN?.trim();
  if (interno) return interno;

  try {
    const { data: row } = await createClient()
      .from('club_settings')
      .select('email')
      .eq('id', 1)
      .single();
    return row?.email?.trim() || data.clubSettings.email || null;
  } catch {
    return data.clubSettings.email || null;
  }
}

/*
 * La tipografía del mail, y por qué no es la de la marca a secas.
 *
 * Gmail —web, Android e iOS, o sea la mayoría de las casillas— BORRA los web fonts:
 * ni `@font-face` ni el `<link>` a Google Fonts. Apple Mail y iOS Mail sí los
 * respetan, y Outlook de escritorio no. Así que Baloo 2 y DM Sans se piden igual
 * (para los clientes que los muestran) pero la pila de respaldo es la que se va a
 * ver en la mayoría de los casos, y está elegida a mano: Trebuchet para los títulos
 * porque es la web-safe más redonda y cercana a Baloo, y Helvetica/Arial para el
 * cuerpo, que es donde DM Sans casi no se distingue.
 *
 * La marca de verdad la lleva el LOGO, que va como imagen: es la única forma de que
 * la tipografía de Kumo llegue al inbox tal cual.
 */
const TIPO_TITULO = "'Baloo 2','Trebuchet MS','Segoe UI',Helvetica,Arial,sans-serif";
const TIPO_TEXTO = "'DM Sans','Segoe UI',Helvetica,Arial,sans-serif";
/**
 * El logo del mail: el isotipo Y la palabra "Kumo", en una sola imagen.
 *
 * La palabra va dentro de la imagen y no como texto porque si no, no es la misma
 * marca que la web: ahí "Kumo" está en Baloo 2 800 (ver LandingClient) y en el mail
 * saldría en la pila de respaldo. Está dibujada con la Baloo 2 que sirve el sitio,
 * al doble de tamaño para las pantallas densas, y el fondo es transparente para que
 * el violeta lo siga poniendo el header.
 *
 * Se sirve desde `/mail/` y no desde la ruta de ícono que genera Next: esa lleva un
 * hash que cambia entre builds, y un mail de hace seis meses tiene que seguir
 * mostrando el logo. `kumo-isotipo.png` queda al lado, sin usarse acá, porque es de
 * donde salió el isotipo y los mails que ya salieron lo piden por URL.
 */
const LOGO = `${SITE}/mail/kumo-logo-mail.png`;

/** Envoltorio común: tablas y estilos en línea, que es lo que los clientes de
 *  mail renderizan de forma consistente. */
function layout(titulo: string, cuerpo: string, wa: string, cta?: { label: string; href: string }): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${titulo}</title>
<!-- Las fuentes de la marca, para los clientes que las cargan (Apple Mail, iOS).
     Gmail y Outlook lo ignoran y usan la pila de respaldo: ver TIPO_TITULO. -->
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f5f4f8;font-family:${TIPO_TEXTO};color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f8;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:${BRAND};padding:20px 26px;">
          <!-- El estilo del img es para cuando la imagen NO carga: el cliente pinta el
               texto del alt con estas reglas, y el header sigue diciendo Kumo en grande. -->
          <img src="${LOGO}" width="124" height="40" alt="Kumo" style="display:block;width:124px;height:40px;border:0;font-family:${TIPO_TITULO};color:#ffffff;font-size:24px;font-weight:800;" />
          <div style="margin-top:8px;color:#c9c3e3;font-size:12.5px;line-height:1.3;">el club de tu mascota</div>
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

/**
 * Envoltorio para los avisos al CLUB.
 *
 * Es otro layout y no un parámetro del de arriba porque el pie dice cosas
 * distintas y opuestas: al socio le explica por qué le escribimos y lo manda al
 * WhatsApp del club; al club, mandarlo a su propio WhatsApp sería absurdo. Acá el
 * pie aclara que es un aviso interno y el botón va al panel.
 *
 * Importa que se distingan de un vistazo: el admin recibe los dos tipos en la
 * misma casilla, y confundir "te avisamos a vos" con "avisale al socio" es la
 * clase de error que termina en un mail reenviado a quien no era.
 */
function layoutAdmin(titulo: string, cuerpo: string, cta?: { label: string; href: string }): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f5f4f8;font-family:${TIPO_TEXTO};color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f8;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:${INK};padding:20px 26px;">
          <img src="${LOGO}" width="124" height="40" alt="Kumo" style="display:block;width:124px;height:40px;border:0;font-family:${TIPO_TITULO};color:#ffffff;font-size:24px;font-weight:800;" />
          <div style="margin-top:8px;color:#a29dba;font-size:12.5px;line-height:1.3;">aviso para el equipo</div>
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
            Este es un aviso interno de Kumo, no lo recibe el socio.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** El header del admin va en tinta y no en violeta: es lo que los distingue en la
 *  bandeja sin abrirlos. */
const verPanel = (seccion = '') => ({ label: 'Abrir el panel', href: `${SITE}${urls.admin}${seccion}` });

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

/**
 * Escapa lo que escribió una persona antes de meterlo en el HTML del mail.
 *
 * No es XSS —los clientes de correo no ejecutan scripts— pero sin esto se puede
 * inyectar markup y links DENTRO de un mail que sale firmado por Kumo: un concepto
 * de reintegro como `Consulta</strong><a href="...">Reclamá acá</a>` llega con
 * nuestro nombre y nuestro logo. El que lo recibe no tiene forma de saber que esa
 * línea la escribió otro.
 *
 * Se aplica SOLO en la versión HTML. En la de texto plano no va: ahí "Rodríguez &
 * Cía" tiene que leerse así y no como `&amp;`.
 */
const esc = (t: string | number) => String(t)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/* ── Piezas que se repiten en varios mails ─────────────────────── */

/** Título de un mail. */
const h1 = (texto: string) => `<h1 style="margin:0 0 10px;font-family:${TIPO_TITULO};font-size:23px;font-weight:800;">${texto}</h1>`;
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
/**
 * Bienvenida al alta.
 *
 * Dos cosas cambiaron cuando entrar pasó a ser gratis:
 *
 *  · Puede haber VARIAS mascotas, así que el texto se pluraliza. Decirle "Lola ya
 *    tiene su carnet" a quien cargó tres es no haber leído lo que mandó.
 *  · Sin plan, la promesa de siempre era FALSA: el mail decía "podés pedir el
 *    reintegro de lo que gastás en el veterinario", y el socio gratuito no puede.
 *    Prometerle en el primer mail algo que la app no le va a dar es la peor forma
 *    de empezar, así que la variante gratuita cuenta lo que sí tiene y ofrece el
 *    plan como un paso siguiente, no como un requisito.
 */
export async function sendBienvenida(opts: { to: string; firstName: string; mascotas: string[]; memberNo: number; planName: string | null }) {
  const { to, firstName, mascotas, memberNo, planName } = opts;
  const wa = await whatsappDelClub();
  const nombres = listar(mascotas);
  const varias = mascotas.length > 1;
  const suCarnet = varias ? `sus carnets digitales` : `su carnet digital`;
  const elCarnetDe = varias ? `los carnets de ${nombres}` : `el carnet de ${nombres}`;
  const cuerpo = `
    ${h1(`Te sumaste al club, ${esc(firstName)}`)}
    ${par(`${esc(nombres)} ya ${varias ? "tienen" : "tiene"} ${esc(suCarnet)}, y vos tu número de socio.`)}
    ${caja(`${filaChica('TU NÚMERO DE SOCIO')}${filaGrande(`#${memberNo}`)}${filaMedia(planName ? `Plan ${planName}` : 'Plan gratuito')}`)}
    ${par(planName
      ? `Desde tu cuenta podés ver ${esc(elCarnetDe)}, pedir el reintegro de lo que gastás en el veterinario y usar los descuentos de la red de prestadores.`
      : `Desde tu cuenta podés ver ${esc(elCarnetDe)}, anotar las vacunas, buscar prestadores cerca y participar de los foros. Los reintegros y los beneficios se activan con cualquier plan, cuando quieras.`, true)}`;
  const text = `Te sumaste al club, ${firstName}.\n\n${nombres} ya ${varias ? "tienen" : "tiene"} ${suCarnet}.\nTu número de socio: #${memberNo}\n${planName ? `Plan ${planName}` : "Plan gratuito"}\n\nEntrá a tu cuenta: ${SITE}${urls.webapp}`;
  return enviar(to, `Ya sos parte de Kumo · socio #${memberNo}`, layout('Bienvenida a Kumo', cuerpo, wa, { label: varias ? 'Ver mis carnets' : 'Ver mi carnet', href: `${SITE}${urls.webapp}` }), text);
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
    ${par(`${esc(firstName)}, nos llegó tu pedido por ${esc(concept)} en ${esc(providerName)}, por ${money(amount)}.`)}
    ${caja(`${filaMedia(`<strong>${esc(providerName)}</strong>`)}${filaChica(`${esc(concept)} · ${money(amount)}`)}`)}
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
       ${par(`${esc(firstName)}, ya está: transferimos ${money(refund)} a tu CBU y se acredita dentro de los 30 días corridos.`)}
       ${detalle}`
    : `${h1('Sobre tu reintegro')}
       ${par(`${esc(firstName)}, esta vez no pudimos aprobarlo. Los motivos más comunes son que el comprobante no se lee bien, que el gasto no entra en tu plan, o que ya usaste el tope del mes.`)}
       ${detalle}
       ${par(`Si creés que hubo un error, ${linkWa(wa, 'escribinos por WhatsApp')} y lo revisamos con vos. Si el problema era el comprobante, podés cargarlo de nuevo desde la app.`, true)}`;

  const text = acreditado
    ? `${firstName}, aprobamos tu reintegro.\n\n${providerName} · ${concept}\nGastaste ${money(amount)} · te transferimos ${money(refund)} a tu CBU.\n\nSe acredita dentro de los 30 días corridos.`
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
    ${h1(`Se acerca la ${esc(vacuna.toLowerCase())} de ${esc(petName)}`)}
    ${par(`${esc(firstName)}, ${cuando}: el ${fecha}.`)}
    ${caja(`${filaChica('VENCE')}${filaGrande(fecha)}${filaMedia(`${esc(vacuna)} · ${esc(petName)}`)}`)}
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
    ${par(`${esc(firstName)}, pasaste del plan ${planAnterior} al ${planNuevo}.`)}
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
    ${par(`${esc(firstName)}, no te vamos a cobrar más. Tu cobertura y los descuentos estuvieron activos hasta el ${hasta}.`)}
    ${par(`El carnet de ${esc(petNames)} y su historial de vacunas quedan guardados: si algún día volvés, están ahí.`)}
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
    ${par(`Gracias por sumarte, ${esc(firstName)}. Antes de publicar ${esc(negocio)} revisamos los datos: es lo que hace que el sello de verificado signifique algo para los socios.`)}
    ${par(`Te escribimos en cuanto esté listo. Si necesitamos algo más, te lo pedimos ${linkWa(wa, 'por WhatsApp')}.`, true)}`;
  const text = `Gracias por sumarte, ${firstName}. Estamos validando los datos de ${negocio} antes de publicarlo: es lo que hace que el sello de verificado signifique algo.\n\nTe escribimos en cuanto esté listo.`;
  return enviar(to, `Recibimos los datos de ${negocio}`, layout('Alta de negocio recibida', cuerpo, wa), text);
}

/** 10 · El negocio quedó publicado. */
export async function sendNegocioPublicado(opts: { to: string; firstName: string; negocio: string }) {
  const { to, firstName, negocio } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1(`¡Estás en la red, ${esc(firstName)}! 🎉`)}
    ${par(`${esc(negocio)} ya aparece en Servicios y los socios pueden verte, contactarte y dejarte reseñas.`)}
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
    ${par(`${esc(firstName)}, revisamos ${esc(negocio)} y por ahora no lo publicamos. Puede ser porque faltan datos de contacto, porque no pudimos verificar la dirección, o porque el rubro no entra en las categorías del club.`)}
    ${par(`No es definitivo: ${linkWa(wa, 'escribinos por WhatsApp')}, vemos qué falta y lo publicamos.`, true)}`;
  const text = `${firstName}, revisamos ${negocio} y por ahora no lo publicamos: pueden faltar datos de contacto, no haber podido verificar la dirección, o el rubro no entrar en las categorías del club.\n\nNo es definitivo: escribinos y lo resolvemos. ${waLink(wa)}`;
  return enviar(to, `Sobre la publicación de ${negocio}`, layout('Negocio no publicado', cuerpo, wa), text);
}

/* ── Cobro de la cuota ──────────────────────────────────────────
 * Los dos que siguen los dispara el webhook de Mercado Pago
 * (`/api/pagos/webhook`), uno por cada débito de la suscripción: el rechazado
 * cuando la tarjeta rebota, el acreditado como comprobante del mes cobrado.
 *
 * El del rechazo es el que más importa: es plata que no entró y un socio que, sin
 * el mail, se entera recién cuando se choca con el muro de la cuota — sin saber
 * que era su tarjeta y sin nada que hacer al respecto. Eso es un socio que se va
 * en lugar de actualizar los datos.
 */

/** 12 · No se pudo cobrar la cuota. */
export async function sendCuotaRechazada(opts: {
  to: string; firstName: string; mes: string; cuota: number; reintentoEl: string;
}) {
  const { to, firstName, mes, cuota, reintentoEl } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1('Tu tarjeta rechazó el pago')}
    ${par(`${esc(firstName)}, no pudimos cobrar la cuota de ${mes}. Suele ser por fondos, por una tarjeta vencida o por un tope del banco.`)}
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
    ${par(`${esc(firstName)}, cobramos tu cuota de ${mes}.`)}
    ${caja(`${filaChica(`CUOTA DE ${mes.toUpperCase()}`)}${filaGrande(money(cuota))}${filaMedia(`Plan ${planName} · ${tarjeta}`)}`)}
    ${par('El comprobante lo tenés en tu cuenta.', true)}`;
  const text = `${firstName}, cobramos ${money(cuota)} del plan ${planName} por ${mes}, con tu ${tarjeta}.\n\nEl comprobante está en tu cuenta: ${SITE}${urls.webapp}`;
  return enviar(to, `Cobramos tu cuota de ${mes}`, layout('Pago acreditado', cuerpo, wa, verCuenta), text);
}

/**
 * 15 · El plan cambió de precio.
 *
 * Se manda cuando el club actualiza el precio y alcanza a un socio que ya venía
 * pagando. No es opcional: un débito que cambia sin aviso es la receta del
 * contracargo y de la baja enojada. El asunto dice el monto directo — para esta
 * noticia, el rodeo es peor que la noticia.
 */
export async function sendCuotaActualizada(opts: {
  to: string; firstName: string; planName: string; cuota: number; conOdonto: boolean; debitoAutomatico: boolean;
}) {
  const { to, firstName, planName, cuota, conOdonto, debitoAutomatico } = opts;
  const wa = await whatsappDelClub();
  const detalle = `Plan ${planName}${conOdonto ? ' + cobertura odontológica' : ''}`;
  const cierre = debitoAutomatico
    ? 'No tenés que hacer nada: el débito automático se actualiza solo.'
    : 'Es el monto que vale desde el próximo mes que abones.';
  const cuerpo = `
    ${h1('Tu cuota cambia de precio')}
    ${par(`${esc(firstName)}, el club actualizó el precio del plan ${planName}. Tu cuota queda así:`)}
    ${caja(`${filaChica('CUOTA MENSUAL · DESDE EL PRÓXIMO COBRO')}${filaGrande(money(cuota))}${filaMedia(detalle)}`)}
    ${par(cierre, true)}
    ${par(`Si querés revisar tu plan o tenés dudas, escribinos ${linkWa(wa, 'por WhatsApp')}.`, true)}`;
  const text = `${firstName}, el club actualizó el precio del plan ${planName}.\n\nTu cuota mensual pasa a ${money(cuota)} (${detalle}) desde el próximo cobro.\n\n${cierre}\n\nTu cuenta: ${SITE}${urls.webapp}`;
  return enviar(to, `Tu cuota pasa a ${money(cuota)}`, layout('Cambio de cuota', cuerpo, wa, verCuenta), text);
}

/**
 * 14 · Recuperar la contraseña.
 *
 * Va por acá y no por el mail que manda Supabase solo, por dos razones: el de
 * Supabase llega en inglés, sin la marca y desde un remitente `supabase.co` —o
 * sea, exactamente igual a un mail de phishing—, y este es un mail que el socio
 * recibe cuando ya está con un problema. El link lo genera Supabase igual (es la
 * única forma de que el token sea válido), lo que cambia es quién lo manda y cómo
 * se ve.
 *
 * Ojo con el texto: NO se le confirma si el mail estaba registrado o no. Quien
 * pide el link sin ser dueño de la casilla no tiene que poder averiguar quién es
 * socio del club.
 */
export async function sendRecuperarClave(opts: { to: string; firstName: string; link: string }) {
  const { to, firstName, link } = opts;
  const wa = await whatsappDelClub();
  const cuerpo = `
    ${h1('Cambiá tu contraseña')}
    ${par(`${esc(firstName)}, alguien pidió recuperar la contraseña de esta cuenta. Si fuiste vos, el botón de abajo te deja elegir una nueva.`)}
    ${par('El link vence en una hora y sirve una sola vez. Si no lo pediste, ignorá este mail: tu contraseña sigue siendo la de siempre.', true)}
    ${par(`Cualquier cosa, escribinos ${linkWa(wa, 'por WhatsApp')}.`, true)}`;
  const text = `${firstName}, alguien pidió recuperar la contraseña de esta cuenta.\n\nSi fuiste vos, elegí una nueva acá: ${link}\n\nEl link vence en una hora y sirve una sola vez. Si no lo pediste, ignorá este mail: tu contraseña sigue siendo la de siempre.`;
  return enviar(to, 'Cambiá tu contraseña de Kumo', layout('Recuperar contraseña', cuerpo, wa, { label: 'Elegir una nueva', href: link }), text);
}

/* ══════════════════════════════════════════════════════════════
 *  Avisos para el CLUB
 * ══════════════════════════════════════════════════════════════
 * Los 13 mails de arriba van al socio. Estos tres van al club, y existen porque
 * son los eventos que HOY NO DEJAN RASTRO donde el admin trabaja: los reintegros
 * y los negocios pendientes aparecen en sus colas del panel, pero estos tres no
 * aparecen en ninguna, o aparecen donde nadie mira.
 *
 * Los tres son "de mejor esfuerzo": si el mail falla, la operación ya pasó y no
 * se revierte nada. Un aviso que no sale no puede romper un borrado que el socio
 * pidió.
 */

/**
 * Un cobro rebotó.
 *
 * El más urgente de los tres, y el único que se puede accionar: Mercado Pago
 * reintenta el mismo débito varios días, así que hay una ventana para llamar al
 * socio antes de perderlo. Hoy el socio se entera (le llega el mail 11) y el club
 * no, con lo que la ventana pasa sin que nadie la use.
 */
export async function sendAdminCobroRechazado(opts: {
  socio: string; memberNo: number | null; email: string; cuota: number; plan: string | null; motivo: string;
}) {
  const to = await mailDelClub();
  if (!to) return { skipped: true as const };
  const { socio, memberNo, email, cuota, plan, motivo } = opts;
  const cuerpo = `
    ${h1('Rebotó el cobro de un socio')}
    ${par(`La tarjeta de <strong>${esc(socio)}</strong>${memberNo ? ` (socio #${memberNo})` : ''} rechazó la cuota. Mercado Pago va a reintentar los próximos días.`)}
    ${caja(`${filaChica('Cuota')}${filaGrande(money(cuota))}${filaMedia(`${esc(email)}${plan ? ` · plan ${esc(plan)}` : ''}`)}${filaMedia(`Motivo: ${esc(motivo)}`)}`)}
    ${par('Al socio ya se le avisó por mail y por notificación. Si querés contactarlo antes de que se le corte la cobertura, este es el momento: después del último reintento la suscripción se cae.', true)}`;
  const text = `Rebotó el cobro de ${socio}${memberNo ? ` (socio #${memberNo})` : ''}.\n\nCuota: ${money(cuota)}${plan ? ` · plan ${plan}` : ''}\nMail: ${email}\nMotivo: ${motivo}\n\nMercado Pago reintenta los próximos días. Al socio ya se le avisó.`;
  return enviar(to, `Rebotó el cobro de ${socio}`, layoutAdmin('Cobro rechazado', cuerpo, verPanel('?s=cobros')), text);
}

/**
 * Un socio borró su cuenta.
 *
 * No deja NADA: la fila desaparece con todo lo suyo, así que no hay cola, ni
 * contador, ni forma de saber después que pasó. Este mail es el único registro
 * que le queda al club, y por eso lleva los números de lo que se borró — que
 * `borrar_socio()` devuelve justamente para esto.
 *
 * No es para revertir nada (no se puede) sino para que el club sepa que perdió un
 * socio y por qué vía. Un pico de borrados es una señal que hoy sería invisible.
 */
export async function sendAdminCuentaEliminada(opts: {
  socio: string; memberNo: number | null; mascotas: number; reintegros: number; pagos: number; debitoCancelado: boolean;
}) {
  const to = await mailDelClub();
  if (!to) return { skipped: true as const };
  const { socio, memberNo, mascotas, reintegros, pagos, debitoCancelado } = opts;
  const cuerpo = `
    ${h1('Un socio eliminó su cuenta')}
    ${par(`<strong>${esc(socio)}</strong>${memberNo ? ` (socio #${memberNo})` : ''} borró su cuenta y todos sus datos. Es irreversible y no queda registro en el panel: este mail es el único.`)}
    ${caja(`${filaChica('Se borró')}${filaMedia(`${mascotas} ${mascotas === 1 ? 'mascota' : 'mascotas'}`)}${filaMedia(`${reintegros} ${reintegros === 1 ? 'reintegro' : 'reintegros'}`)}${filaMedia(`${pagos} ${pagos === 1 ? 'cobro' : 'cobros'}`)}${filaMedia(debitoCancelado ? 'Su débito automático quedó cancelado' : 'No tenía débito automático')}`)}
    ${par('Ejerció el derecho de supresión de datos, así que no hay nada que recuperar ni a quién escribirle. Queda como dato para el churn.', true)}`;
  const text = `${socio}${memberNo ? ` (socio #${memberNo})` : ''} eliminó su cuenta.\n\nSe borró: ${mascotas} mascotas, ${reintegros} reintegros, ${pagos} cobros.\n${debitoCancelado ? 'Su débito automático quedó cancelado.' : 'No tenía débito automático.'}\n\nEs irreversible y no queda registro en el panel.`;
  return enviar(to, `${socio} eliminó su cuenta`, layoutAdmin('Cuenta eliminada', cuerpo, verPanel('?s=socios')), text);
}

/**
 * Un socio se dio de baja del club.
 *
 * Distinto del anterior: los datos quedan y la baja se revierte. Pero hoy solo
 * cambia un campo en silencio, y es la señal de churn más importante que tiene el
 * negocio. Un socio que se va todavía se puede recuperar; uno que se fue hace tres
 * semanas, no.
 */
export async function sendAdminBajaMembresia(opts: {
  socio: string; memberNo: number | null; email: string; plan: string | null; debitoCancelado: boolean;
}) {
  const to = await mailDelClub();
  if (!to) return { skipped: true as const };
  const { socio, memberNo, email, plan, debitoCancelado } = opts;
  const cuerpo = `
    ${h1('Un socio se dio de baja')}
    ${par(`<strong>${esc(socio)}</strong>${memberNo ? ` (socio #${memberNo})` : ''} dio de baja su membresía${plan ? ` del plan ${esc(plan)}` : ''}.`)}
    ${caja(`${filaChica('Contacto')}${filaMedia(esc(email))}${filaMedia(debitoCancelado ? 'Su débito automático quedó cancelado' : 'No tenía débito automático')}`)}
    ${par('Sus datos y su historial quedan guardados, así que la baja se revierte si vuelve. Si querés preguntarle por qué se fue, ahora es cuando más chances hay de que conteste.', true)}`;
  const text = `${socio}${memberNo ? ` (socio #${memberNo})` : ''} se dio de baja${plan ? ` del plan ${plan}` : ''}.\n\nContacto: ${email}\n${debitoCancelado ? 'Su débito automático quedó cancelado.' : 'No tenía débito automático.'}\n\nSus datos quedan guardados: la baja se revierte si vuelve.`;
  return enviar(to, `${socio} se dio de baja`, layoutAdmin('Baja de membresía', cuerpo, verPanel('?s=socios')), text);
}

/**
 * Un socio nuevo se dio de alta.
 *
 * Este es el único de los cuatro que SÍ deja rastro: el socio aparece en la lista
 * del panel y el número avanza. Va igual, y con una razón concreta: distingue si
 * eligió plan o entró gratis.
 *
 * El alta sin plan es una oportunidad de conversión que hoy no ve nadie — en la
 * lista de Socios se mezcla con todos los demás y hay que ir a buscarla. En el
 * mail salta sola.
 *
 * OJO cuando el volumen crezca: con dos altas por semana esto sirve para dar la
 * bienvenida a mano; con doscientas es ruido y hay que pasarlo a un resumen
 * diario. El día que moleste, ese es el arreglo, no borrarlo.
 */
export async function sendAdminAltaNueva(opts: {
  socio: string; memberNo: number | null; email: string; mascotas: string[]; plan: string | null;
}) {
  const to = await mailDelClub();
  if (!to) return { skipped: true as const };
  const { socio, memberNo, email, mascotas, plan } = opts;
  const conPlan = !!plan;
  const cuerpo = `
    ${h1(conPlan ? 'Se sumó un socio nuevo' : 'Alta nueva, sin plan')}
    ${par(`<strong>${esc(socio)}</strong>${memberNo ? ` es el socio #${memberNo}` : ' se dio de alta'}${mascotas.length ? ` y cargó ${mascotas.length === 1 ? 'a' : 'a'} ${esc(listar(mascotas))}` : ''}.`)}
    ${caja(`${filaChica('Contacto')}${filaMedia(esc(email))}${filaChica('Plan')}${filaMedia(conPlan ? esc(plan!) : 'Ninguno — entró gratis')}`)}
    ${conPlan
      ? par('Ya se le mandó la bienvenida. Si querés escribirle a mano, ahora es cuando más atención te va a dar.', true)
      : par('Entró gratis, así que <strong>no tiene reintegros ni descuentos</strong>. Es el momento con más chances de que contrate: acaba de cargar a su mascota y todavía está mirando la app.', true)}`;
  const text = `${socio}${memberNo ? ` es el socio #${memberNo}` : ' se dio de alta'}.\n\nContacto: ${email}\nPlan: ${conPlan ? plan : 'ninguno, entró gratis'}${mascotas.length ? `\nMascotas: ${listar(mascotas)}` : ''}`;
  return enviar(to, conPlan ? `Socio nuevo: ${socio} (${plan})` : `Alta sin plan: ${socio}`, layoutAdmin('Alta nueva', cuerpo, verPanel('?s=socios')), text);
}
