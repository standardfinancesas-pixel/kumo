import crypto from 'node:crypto';
import { MercadoPagoConfig, Preference, PreApproval, Invoice, Payment } from 'mercadopago';

/**
 * Mercado Pago: cobro de la cuota mensual con Checkout Pro + Suscripciones.
 *
 * Va contra el SDK oficial (`mercadopago@3`). Todo esto corre SOLO en el
 * servidor — el access token es la llave de la cuenta de cobro del club y no
 * puede llegar al navegador ni por accidente.
 *
 * Antes iba contra la API REST a mano, por un conflicto viejo del SDK con el
 * runtime de Vercel que no quedó documentado con más detalle que eso. Al migrar
 * (2026-08-19) se probó a fondo antes de asumir que seguía existiendo: build de
 * producción limpio, y las cinco llamadas corridas en vivo contra la API de
 * Mercado Pago dieron exactamente los mismos errores que la versión con fetch.
 * No se pudo reproducir ningún conflicto. Si vuelve a aparecer alguno, anotar
 * acá el error exacto para la próxima vez.
 *
 * Por qué Checkout Pro / Suscripciones (redirect) y no un formulario propio: la
 * tarjeta se tipea en el sitio de Mercado Pago. Nunca pasa por Kumo, así que no
 * hay datos de tarjeta que podamos filtrar ni obligaciones de PCI DSS que
 * cumplir.
 */

/** Falta la config → el modal se lo dice al socio en lugar de romperse. */
export class MercadoPagoSinConfigurar extends Error {
  constructor(cual: string) {
    super(`Falta ${cual} en el entorno: el cobro con Mercado Pago no está configurado.`);
    this.name = 'MercadoPagoSinConfigurar';
  }
}

function cliente(): MercadoPagoConfig {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new MercadoPagoSinConfigurar('MP_ACCESS_TOKEN');
  return new MercadoPagoConfig({ accessToken: t });
}

/**
 * El SDK tira sus propios errores (`MercadoPagoError` / `errors.ApiError`), sin
 * un `status` consistente en todas las versiones. Se homogeneiza a lo que ya
 * loguea todo el resto del código: el detalle completo al log del servidor
 * (puede traer datos de la cuenta de cobro, nunca al socio) y un Error simple
 * con el status hacia arriba.
 */
function relanzar(ruta: string, e: unknown): never {
  const status = (e as { status?: number })?.status ?? (e as { statusCode?: number })?.statusCode ?? '?';
  console.error('[mp] error', ruta, status, JSON.stringify((e as { cause?: unknown })?.cause ?? (e as Error)?.message ?? e).slice(0, 500));
  throw new Error(`Mercado Pago devolvió ${status}`);
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
  try {
    const res = await new Preference(cliente()).create({
      body: {
        items: [{
          id: opts.referencia,
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
        payment_methods: { installments: 1 },
      },
      requestOptions: { idempotencyKey: opts.referencia },
    });
    if (!res.id || !res.init_point) throw new Error('Mercado Pago no devolvió init_point');
    return { id: res.id, init_point: res.init_point };
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) throw e;
    return relanzar('/checkout/preferences', e);
  }
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
  try {
    const res = await new PreApproval(cliente()).create({
      body: {
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
      },
      requestOptions: { idempotencyKey: opts.referencia },
    });
    if (!res.id || !res.init_point || !res.status) throw new Error('Mercado Pago no devolvió los datos de la suscripción');
    return { id: res.id, init_point: res.init_point, status: res.status };
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) throw e;
    return relanzar('/preapproval', e);
  }
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
  try {
    return (await new PreApproval(cliente()).get({ id })) as SuscripcionMP;
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) throw e;
    return relanzar(`/preapproval/${id}`, e);
  }
}

/**
 * Cambia la cuota de una suscripción viva. Rige desde el próximo débito y no le
 * pide nada al socio: la autorización de la tarjeta sigue siendo la misma.
 *
 * Lo usa el panel cuando el club cambia el precio de un plan: sin esto, los ya
 * suscriptos seguirían debitando el monto con el que firmaron para siempre.
 */
export async function actualizarMontoSuscripcion(id: string, monto: number): Promise<SuscripcionMP> {
  try {
    return (await new PreApproval(cliente()).update({
      id,
      body: { auto_recurring: { transaction_amount: monto, currency_id: 'ARS' } },
    })) as unknown as SuscripcionMP;
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) throw e;
    return relanzar(`/preapproval/${id}`, e);
  }
}

/** Dar de baja. El socio tiene que poder hacerlo desde la app: con débito
 *  automático, la baja tiene que ser tan fácil como el alta. */
export async function cancelarSuscripcion(id: string): Promise<SuscripcionMP> {
  try {
    return (await new PreApproval(cliente()).update({ id, body: { status: 'cancelled' } })) as unknown as SuscripcionMP;
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) throw e;
    return relanzar(`/preapproval/${id}`, e);
  }
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
 * El aviso `subscription_authorized_payment` trae el id de ESTE objeto (lo que
 * Mercado Pago llama "invoice"), que no es el id del pago: adentro viene el pago
 * con su estado. Confundirlos es acreditar meses que la tarjeta rechazó.
 */
export async function traerDebito(id: string): Promise<DebitoMP> {
  try {
    return (await new Invoice(cliente()).get({ id })) as unknown as DebitoMP;
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) throw e;
    return relanzar(`/authorized_payments/${id}`, e);
  }
}

/**
 * Los débitos de una suscripción, preguntados en el momento.
 *
 * Es lo que permite que la vuelta de Mercado Pago no espere el aviso: el primer
 * cobro sale segundos después de que el socio autoriza (medido: 18 s), pero el
 * aviso tardó 2 minutos. Preguntando, el socio ve su plan activo al instante.
 *
 * Mercado Pago llama "authorized payments" a estos objetos y NO son pagos: cada uno
 * tiene un pago adentro con su propio estado. Confundirlos es acreditar meses que la
 * tarjeta rechazó.
 */
export async function buscarDebitos(preapprovalId: string): Promise<DebitoMP[]> {
  try {
    const res = (await new Invoice(cliente()).search({
      options: { preapproval_id: preapprovalId, sort: 'debit_date:desc', limit: 10 },
    })) as unknown as { results?: DebitoMP[] };
    return res?.results ?? [];
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) throw e;
    return relanzar('/authorized_payments/search', e);
  }
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
  try {
    return (await new Payment(cliente()).get({ id: Number(id) })) as unknown as PagoMP;
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) throw e;
    return relanzar(`/v1/payments/${id}`, e);
  }
}

/**
 * ¿El aviso lo mandó Mercado Pago?
 *
 * Firma el `x-signature` con el secreto del webhook (panel de MP → Webhooks). Sin
 * este chequeo el endpoint queda abierto: cualquiera que conozca la URL puede
 * avisar "este socio pagó" y regalarse el acceso al club.
 *
 * Esto NO pasa por el SDK: es una verificación local con HMAC (no una llamada a
 * la API), y el SDK no la ofrece — el formato del header es `ts=...,v1=<hmac>` y
 * lo que se firma es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, con los
 * nombres en minúscula y el punto y coma final, que es fácil de pasar por alto.
 */
export type Modo = 'produccion' | 'prueba';

export function firmaValida(opts: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}): { ok: true; modo: Modo } | { ok: false; motivo: string } {
  /*
   * Dos claves, no una: el panel de Mercado Pago tiene modo productivo y modo
   * pruebas, cada uno con su URL y su PROPIA clave secreta.
   *
   * Se aceptan las dos en paralelo para que el día que el club pase a cobrar de
   * verdad no se caigan los avisos porque nadie se acordó de cambiar la variable
   * —el clásico— y para poder probar en producción con credenciales de prueba,
   * que es lo que estamos haciendo ahora.
   *
   * OJO cuando empiece a entrar plata real: hay que BORRAR `MP_WEBHOOK_SECRET_TEST`.
   * Mientras esté, quien tenga esa clave puede avisar "este socio pagó" desde el
   * simulador del panel y regalar meses. Por eso, además, cada mes acreditado por
   * un aviso de prueba queda marcado como tal en `payments.detail`.
   */
  const claves: { modo: Modo; valor: string }[] = [
    { modo: 'produccion', valor: process.env.MP_WEBHOOK_SECRET ?? '' },
    { modo: 'prueba', valor: process.env.MP_WEBHOOK_SECRET_TEST ?? '' },
  ].filter((c) => c.valor.length > 0) as { modo: Modo; valor: string }[];

  if (claves.length === 0) return { ok: false, motivo: 'no hay ninguna clave de webhook configurada' };
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
  const recibido = Buffer.from(v1, 'utf8');

  for (const clave of claves) {
    const esperado = Buffer.from(crypto.createHmac('sha256', clave.valor).update(manifest).digest('hex'), 'utf8');
    // Comparación en tiempo constante: comparar con === filtra información sobre
    // el hash correcto a quien mida los tiempos de respuesta.
    if (esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido)) {
      return { ok: true, modo: clave.modo };
    }
  }
  return { ok: false, motivo: 'la firma no coincide con ninguna de las claves configuradas' };
}
