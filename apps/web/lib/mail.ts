import { Resend } from 'resend';
import { urls } from '@kumo/shared';

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
/** Para armar links absolutos: en el mail no sirven las rutas relativas. */
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const BRAND = '#5d5491';
const INK = '#211e33';
const LIME = '#e1fb62';
const MUTED = '#8781a0';

const money = (n: number) => '$' + n.toLocaleString('es-AR');

/** Envoltorio común: tablas y estilos en línea, que es lo que los clientes de
 *  mail renderizan de forma consistente. */
function layout(titulo: string, cuerpo: string, cta?: { label: string; href: string }): string {
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
            ¿Dudas? Respondé este mail y te contestamos.
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

/** Bienvenida al alta de un socio. */
export function sendBienvenida(opts: { to: string; firstName: string; petName: string; memberNo: number; planName: string }) {
  const { to, firstName, petName, memberNo, planName } = opts;
  const cuerpo = `
    <h1 style="margin:0 0 10px;font-size:23px;font-weight:700;">¡Bienvenida al club, ${firstName}!</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3f3a55;">
      Ya sos socia de Kumo y ${petName} tiene su carnet digital listo.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9fd;border-radius:12px;padding:16px;">
      <tr><td style="font-size:13px;color:${MUTED};padding-bottom:4px;">TU NÚMERO DE SOCIA</td></tr>
      <tr><td style="font-size:26px;font-weight:700;color:${BRAND};padding-bottom:10px;">#${memberNo}</td></tr>
      <tr><td style="font-size:14px;color:#3f3a55;">Plan ${planName}</td></tr>
    </table>
    <p style="margin:18px 0 0;font-size:15px;line-height:1.65;color:#3f3a55;">
      Desde tu cuenta podés ver el carnet de ${petName}, pedir reintegros de lo que gastás
      en el veterinario y usar los descuentos de la red.
    </p>`;
  const text = `¡Bienvenida al club, ${firstName}!\n\nYa sos socia de Kumo y ${petName} tiene su carnet digital.\nTu número de socia: #${memberNo}\nPlan ${planName}\n\nEntrá a tu cuenta: ${SITE}${urls.webapp}`;
  return enviar(to, `¡Bienvenida a Kumo! Sos la socia #${memberNo}`, layout('Bienvenida a Kumo', cuerpo, { label: 'Ver mi carnet', href: `${SITE}${urls.webapp}` }), text);
}

/** Aviso de reintegro resuelto (acreditado o rechazado). */
export function sendReintegroResuelto(opts: {
  to: string; firstName: string; acreditado: boolean;
  providerName: string; concept: string; amount: number; refund: number;
}) {
  const { to, firstName, acreditado, providerName, concept, amount, refund } = opts;
  const detalle = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9fd;border-radius:12px;padding:16px;margin:0 0 18px;">
      <tr><td style="font-size:14px;color:#3f3a55;padding-bottom:6px;"><strong>${providerName}</strong></td></tr>
      <tr><td style="font-size:13px;color:${MUTED};padding-bottom:10px;">${concept} · gastaste ${money(amount)}</td></tr>
      ${acreditado ? `<tr><td style="font-size:13px;color:${MUTED};padding-bottom:2px;">TE ACREDITAMOS</td></tr>
      <tr><td style="font-size:26px;font-weight:700;color:${BRAND};">${money(refund)}</td></tr>` : ''}
    </table>`;

  const cuerpo = acreditado
    ? `<h1 style="margin:0 0 10px;font-size:23px;font-weight:700;">Aprobamos tu reintegro 🎉</h1>
       <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3f3a55;">
         ${firstName}, ya está: el dinero se acredita en los próximos días hábiles.
       </p>
       ${detalle}`
    : `<h1 style="margin:0 0 10px;font-size:23px;font-weight:700;">Sobre tu reintegro</h1>
       <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3f3a55;">
         ${firstName}, esta vez no pudimos aprobar el pedido. Puede ser porque el comprobante
         no era legible, porque el gasto no entra en tu plan, o porque ya usaste el tope del mes.
       </p>
       ${detalle}
       <p style="margin:0;font-size:15px;line-height:1.65;color:#3f3a55;">
         Si creés que hubo un error, respondé este mail y lo revisamos con vos.
       </p>`;

  const text = acreditado
    ? `${firstName}, aprobamos tu reintegro.\n\n${providerName} · ${concept}\nGastaste ${money(amount)} · te acreditamos ${money(refund)}\n\nSe acredita en los próximos días hábiles.`
    : `${firstName}, esta vez no pudimos aprobar tu reintegro de ${providerName} (${concept}, ${money(amount)}).\n\nSi creés que hubo un error, respondé este mail.`;

  return enviar(
    to,
    acreditado ? `Aprobamos tu reintegro de ${money(refund)}` : 'Sobre tu pedido de reintegro',
    layout(acreditado ? 'Reintegro aprobado' : 'Reintegro no aprobado', cuerpo, { label: 'Ver mis reintegros', href: `${SITE}${urls.webapp}` }),
    text
  );
}
