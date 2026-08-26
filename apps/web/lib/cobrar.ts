import { tarjetaLabel } from '@kumo/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DebitoMP } from '@/lib/mp';
import { sendCuotaRechazada, sendCuotaAcreditada, sendAdminCobroRechazado } from '@/lib/mail';
import { mandarPush } from '@/lib/push';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** El mes del que habla el mail. Sale de la fecha del débito que informa Mercado
 *  Pago, no del reloj del servidor: un cobro que se acredita el 1° a la mañana es
 *  la cuota del mes anterior, y decirle el mes equivocado en el comprobante hace
 *  dudar de todo lo demás. */
function mesDe(fecha?: string): string {
  const d = fecha ? new Date(fecha) : new Date();
  return Number.isNaN(d.getTime()) ? MESES[new Date().getMonth()]! : MESES[d.getMonth()]!;
}

export type ResultadoDebito =
  | { estado: 'acreditado' | 'repetido'; hasta: string | null; monto: number }
  | { estado: 'rechazado' | 'agendado' }
  | { estado: 'ignorado'; motivo: string };

/**
 * Un débito de la suscripción se convierte en un mes pago.
 *
 * Vive acá y no en el webhook porque ahora hay DOS caminos que llegan al mismo
 * cobro: el aviso de Mercado Pago y la vuelta del socio al sitio, que pregunta por
 * los débitos en el momento en vez de esperar el aviso (ver
 * `/api/pagos/confirmar`). Escrita dos veces, esta regla —cuándo un débito es
 * plata, qué monto vale, a quién se le avisa— se iba a desincronizar, y del lado
 * de la plata eso se paga caro.
 *
 * Lo que NO cambia por venir de un lado o del otro: acreditar es idempotente
 * (`acreditar_cuota` bloquea el perfil y suma una sola vez, deduplicando por el id
 * del pago), así que los dos caminos pueden ver el mismo débito sin sumar dos
 * meses. El que llega segundo devuelve 'repetido'.
 *
 * `marca` queda escrita en el detalle del pago: sirve para distinguir un mes
 * acreditado por un aviso de prueba de uno de plata real.
 */
export async function acreditarDebito(
  svc: SupabaseClient,
  debito: DebitoMP,
  marca = '',
): Promise<ResultadoDebito> {
  const pagoOk = debito.payment?.status === 'approved';

  const { data: quien } = await svc
    .from('profiles')
    .select('id, email, full_name, member_no, monthly_fee_agreed, card_brand, card_last4, plans(name)')
    .eq('mp_preapproval_id', debito.preapproval_id)
    .maybeSingle();
  if (!quien) {
    console.error('[cobrar] no encontramos socio para la suscripción', debito.preapproval_id);
    return { estado: 'ignorado', motivo: 'suscripción desconocida' };
  }

  const nombre = quien.full_name?.trim().split(' ')[0] || 'Hola';
  const plan = Array.isArray(quien.plans) ? quien.plans[0] : quien.plans;
  const monto = Math.round(debito.transaction_amount || 0) || quien.monthly_fee_agreed || 1;

  if (!pagoOk) {
    /*
     * La tarjeta rebotó, o el débito todavía está agendado.
     *
     * `upsert` y no `insert`: MP reintenta el MISMO débito varios días, y con un
     * insert el segundo intento choca contra el índice único de
     * `external_reference` y se pierde. Quedaba guardado el motivo del primer
     * rechazo y no el del último, así que el club veía información vieja.
     */
    const rechazado = debito.status !== 'scheduled';
    await svc.from('payments').upsert({
      member_id: quien.id,
      amount: monto,
      status: rechazado ? 'rechazado' : 'pendiente',
      method: 'mercadopago',
      mp_payment_id: debito.payment?.id ? String(debito.payment.id) : `ap:${debito.id}`,
      external_reference: `ap:${debito.id}`,
      plan_name: plan?.name ?? null,
      detail: `débito ${debito.status} · pago ${debito.payment?.status ?? 'sin pago'}${debito.payment?.status_detail ? ` (${debito.payment.status_detail})` : ''}${marca}`,
    }, { onConflict: 'external_reference' });

    /*
     * Y se le avisa, que es lo que faltaba: sin el mail, el socio se enteraba
     * recién al chocarse con el muro, sin saber que era su tarjeta. El aviso va
     * sólo cuando el pago fue RECHAZADO, no cuando está agendado — avisar de un
     * débito que todavía no se intentó es asustar por nada.
     *
     * Ni el mail ni el push revierten nada si fallan: el cobro rebotó igual, y
     * el estado ya quedó guardado arriba.
     */
    if (rechazado && quien.email) {
      await sendCuotaRechazada({
        to: quien.email,
        firstName: nombre,
        mes: mesDe(debito.debit_date),
        cuota: monto,
        reintentoEl: 'los próximos días',
      });
      const { data: tokens } = await svc.from('push_tokens').select('token').eq('member_id', quien.id);
      if (tokens?.length) {
        await mandarPush(
          tokens.map((t: { token: string }) => t.token),
          'No pudimos cobrar tu cuota',
          'Tu tarjeta rechazó el pago. Revisá los datos así no se corta tu cobertura.',
          { pantalla: 'perfil' },
        );
      }
    }
    /*
     * Y al club, que es lo que faltaba del otro lado.
     *
     * Mercado Pago reintenta el mismo débito varios días: esa es la ventana para
     * llamar al socio antes de perderlo. Hasta acá el socio se enteraba y el club
     * no, así que la ventana pasaba sin que nadie la usara — el rechazo quedaba en
     * `payments` y nadie mira esa tabla salvo que ya sospeche algo.
     *
     * Va FUERA del `if (quien.email)` de arriba: que el socio no tenga mail no es
     * motivo para que el club tampoco se entere. Justamente al revés.
     */
    if (rechazado) {
      await sendAdminCobroRechazado({
        socio: quien.full_name?.trim() || 'Un socio',
        memberNo: quien.member_no ?? null,
        email: quien.email ?? 'sin mail',
        cuota: monto,
        plan: plan?.name ?? null,
        motivo: debito.payment?.status_detail || debito.payment?.status || 'sin detalle',
      });
    }
    return { estado: rechazado ? 'rechazado' : 'agendado' };
  }

  const { data, error } = await svc.rpc('acreditar_cuota', {
    p_member_id: quien.id,
    p_mp_payment_id: String(debito.payment!.id),
    p_amount: Math.round(debito.transaction_amount),
    p_method: 'mercadopago',
    p_detalle: `débito automático de la suscripción ${debito.preapproval_id}${marca}`,
  });
  if (error) {
    console.error('[cobrar] acreditar_cuota falló', error);
    throw error;
  }

  const r = Array.isArray(data) ? data[0] : data;
  const acreditado = r?.acreditado === true;
  console.log('[cobrar] débito', debito.payment!.id, r?.motivo, r?.hasta ?? '', marca ? '· prueba' : '');

  /*
   * El comprobante del mes, sólo si esta pasada fue la que acreditó.
   *
   * Con `acreditado: false` no se manda nada: es el mismo cobro visto de nuevo (el
   * aviso repetido, o la vuelta del socio y el aviso mirando el mismo débito), y
   * mandar tres veces "cobramos tu cuota" por un solo cobro es peor que no mandar
   * nada — el socio cree que le cobraron tres veces.
   */
  if (acreditado && quien.email) {
    await sendCuotaAcreditada({
      to: quien.email,
      firstName: nombre,
      mes: mesDe(debito.debit_date),
      cuota: monto,
      planName: plan?.name ?? '—',
      tarjeta: tarjetaLabel(quien.card_brand, quien.card_last4) ?? 'tu medio de pago',
    });
  }

  return { estado: acreditado ? 'acreditado' : 'repetido', hasta: r?.hasta ?? null, monto };
}
