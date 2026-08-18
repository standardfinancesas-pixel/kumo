import crypto from 'node:crypto';

/**
 * Mercado Pago: cobro de la cuota mensual con Checkout Pro.
 *
 * Va contra la API REST y no contra el SDK a propósito: son tres llamadas y el
 * SDK traía su propia versión de conflicto con el runtime de Vercel. Todo esto
 * corre SOLO en el servidor — el access token es la llave de la cuenta de cobro
 * del club y no puede llegar al navegador ni por accidente.
 *
 * Por qué Checkout Pro (redirect) y no un formulario propio: la tarjeta se tipea
 * en el sitio de Mercado Pago. Nunca pasa por Kumo, así que no hay datos de
 * tarjeta que podamos filtrar ni obligaciones de PCI DSS que cumplir.
 */
const API = 'https://api.mercadopago.com';

/** Falta la config → el modal se lo dice al socio en lugar de romperse. */
export class MercadoPagoSinConfigurar extends Error {
  constructor(cual: string) {
    super(`Falta ${cual} en el entorno: el cobro con Mercado Pago no está configurado.`);
    this.name = 'MercadoPagoSinConfigurar';
  }
}

function token(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new MercadoPagoSinConfigurar('MP_ACCESS_TOKEN');
  return t;
}

async function mp<T>(ruta: string, init?: RequestInit & { idempotencia?: string }): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      // Mercado Pago acepta una llave de idempotencia: si el mismo pedido sale
      // dos veces (reintento de red, doble clic), no crea dos cobros.
      ...(init?.idempotencia ? { 'X-Idempotency-Key': init.idempotencia } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const cuerpo = await res.text();
  if (!res.ok) {
    // El detalle va al log del servidor, no al socio: puede traer datos de la
    // cuenta de cobro.
    console.error('[mp] error', ruta, res.status, cuerpo.slice(0, 500));
    throw new Error(`Mercado Pago devolvió ${res.status}`);
  }
  return JSON.parse(cuerpo) as T;
}

export type Preferencia = { id: string; init_point: string };

/**
 * Arma el link de pago de una cuota.
 *
 * `external_reference` es la fila de `payments`: es lo que vuelve en el aviso y
 * lo único que nos permite saber de qué socio y de qué intento hablaba.
 */
export async function crearPreferencia(opts: {
  referencia: string;
  titulo: string;
  monto: number;
  emailSocio: string;
  volverA: string;
  avisarA: string;
}): Promise<Preferencia> {
  return mp<Preferencia>('/checkout/preferences', {
    method: 'POST',
    idempotencia: opts.referencia,
    body: JSON.stringify({
      items: [{
        title: opts.titulo,
        quantity: 1,
        unit_price: opts.monto,
        currency_id: 'ARS',
      }],
      payer: { email: opts.emailSocio },
      external_reference: opts.referencia,
      // A dónde vuelve el socio. Es sólo un cartel: el acceso lo da el webhook.
      back_urls: {
        success: `${opts.volverA}?pago=ok`,
        pending: `${opts.volverA}?pago=pendiente`,
        failure: `${opts.volverA}?pago=error`,
      },
      auto_return: 'approved',
      notification_url: opts.avisarA,
      statement_descriptor: 'KUMO',
      // Sin cuotas: es una cuota mensual, financiarla no tiene sentido.
      installments: 1,
    }),
  });
}

export type Suscripcion = { id: string; init_point: string; status: string };

/**
 * Crea la suscripción: el socio autoriza una vez y Mercado Pago le debita todos
 * los meses.
 *
 * Es el producto "Suscripciones" (preapproval), no Checkout Pro: acá no se cobra
 * nada en el momento, se guarda una autorización. El primer débito lo hace MP
 * enseguida y avisa por webhook, igual que todos los que siguen.
 *
 * `status: 'pending'` es a propósito: la suscripción nace pendiente y pasa a
 * `authorized` cuando el socio pone la tarjeta en el sitio de MP. Nosotros nos
 * enteramos por el aviso, no por la vuelta del navegador.
 */
export async function crearSuscripcion(opts: {
  referencia: string;
  motivo: string;
  monto: number;
  emailSocio: string;
  volverA: string;
}): Promise<Suscripcion> {
  return mp<Suscripcion>('/preapproval', {
    method: 'POST',
    idempotencia: opts.referencia,
    body: JSON.stringify({
      reason: opts.motivo,
      external_reference: opts.referencia,
      payer_email: opts.emailSocio,
      back_url: opts.volverA,
      status: 'pending',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: opts.monto,
        currency_id: 'ARS',
      },
    }),
  });
}

export type SuscripcionMP = {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  external_reference: string | null;
  payer_email: string;
  auto_recurring?: { transaction_amount: number };
};

/** El estado de una suscripción, preguntado a Mercado Pago. */
export async function traerSuscripcion(id: string): Promise<SuscripcionMP> {
  return mp<SuscripcionMP>(`/preapproval/${encodeURIComponent(id)}`);
}

/** Dar de baja. El socio tiene que poder hacerlo desde la app: con débito
 *  automático, la baja tiene que ser tan fácil como el alta. */
export async function cancelarSuscripcion(id: string): Promise<SuscripcionMP> {
  return mp<SuscripcionMP>(`/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });
}

export type DebitoMP = {
  id: number;
  preapproval_id: string;
  status: 'processed' | 'recycling' | 'scheduled' | 'cancelled';
  /** 'approved' cuando el débito salió bien; 'rejected' si la tarjeta rebotó. */
  payment?: { id: number; status: string; status_detail?: string };
  transaction_amount: number;
  debit_date?: string;
};

/**
 * Un débito mensual de la suscripción.
 *
 * El aviso `subscription_authorized_payment` trae el id de ESTE objeto, que no es
 * el id del pago: adentro viene el pago con su estado. Confundirlos es acreditar
 * meses que la tarjeta rechazó.
 */
export async function traerDebito(id: string): Promise<DebitoMP> {
  return mp<DebitoMP>(`/authorized_payments/${encodeURIComponent(id)}`);
}

export type PagoMP = {
  id: number;
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'refunded' | 'cancelled' | 'charged_back';
  status_detail: string;
  transaction_amount: number;
  external_reference: string | null;
  payment_method_id: string;
};

/**
 * Los datos de un pago, preguntados a Mercado Pago.
 *
 * El aviso del webhook trae sólo un id: nunca se le cree al cuerpo del mensaje
 * para saber cuánto se pagó ni si está aprobado. Cualquiera puede POSTear un
 * JSON que diga "aprobado $50.000"; sólo Mercado Pago sabe la verdad.
 */
export async function traerPago(id: string): Promise<PagoMP> {
  return mp<PagoMP>(`/v1/payments/${encodeURIComponent(id)}`);
}

/**
 * ¿El aviso lo mandó Mercado Pago?
 *
 * Firma el `x-signature` con el secreto del webhook (panel de MP → Webhooks). Sin
 * este chequeo el endpoint queda abierto: cualquiera que conozca la URL puede
 * avisar "este socio pagó" y regalarse el acceso al club.
 *
 * El formato del header es `ts=1704908010,v1=<hmac>` y lo que se firma es
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — con los nombres en
 * minúscula y el punto y coma final, que es fácil de pasar por alto.
 */
export function firmaValida(opts: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}): { ok: true } | { ok: false; motivo: string } {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) return { ok: false, motivo: 'falta MP_WEBHOOK_SECRET' };
  if (!opts.signature) return { ok: false, motivo: 'el aviso vino sin x-signature' };

  const partes = new Map(
    opts.signature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k?.trim() ?? '', v.join('=').trim()];
    }),
  );
  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  if (!ts || !v1) return { ok: false, motivo: 'x-signature mal formado' };

  const manifest = `id:${(opts.dataId ?? '').toLowerCase()};request-id:${opts.requestId ?? ''};ts:${ts};`;
  const esperado = crypto.createHmac('sha256', secreto).update(manifest).digest('hex');

  // Comparación en tiempo constante: comparar con === filtra información sobre
  // el hash correcto a quien mida los tiempos de respuesta.
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, motivo: 'la firma no coincide' };
  }
  return { ok: true };
}
