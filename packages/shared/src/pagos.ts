/**
 * Medio de pago de la cuota.
 *
 * La marca y los últimos 4 se calculan **en el cliente** y son lo único que
 * viaja al servidor: si el número completo llegara al backend, aunque no se
 * guardara, metería al servidor dentro del alcance de PCI DSS. El CVV no se
 * guarda en ningún caso — está prohibido después de autorizar.
 *
 * Cuando entre la suscripción de Mercado Pago, el token de tarjeta lo genera el
 * SDK de MP también en el navegador, con la misma lógica: el instrumento nunca
 * pasa por acá.
 */
export type TarjetaMeta = { brand: string; last4: string; exp: string; holder: string };

/** Marca por IIN. Se reconocen las de uso corriente en Argentina. */
export function marcaTarjeta(numero: string): string {
  const n = numero.replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(58963[13]|60420[1-9]|6042[1-9])/.test(n)) return 'Cabal';
  if (/^(589562|402917|402918|527571|527572)/.test(n)) return 'Naranja';
  return 'Tarjeta';
}

export const ultimos4 = (numero: string): string => numero.replace(/\D/g, '').slice(-4);

/**
 * Lo que se manda al servidor de una tarjeta. `null` si el número está
 * incompleto: guardar 2 dígitos como "últimos 4" sería peor que no guardar nada.
 */
export function tarjetaMeta(opts: { numero: string; exp: string; holder: string }): TarjetaMeta | null {
  const digitos = opts.numero.replace(/\D/g, '');
  if (digitos.length < 13) return null;
  return {
    brand: marcaTarjeta(digitos),
    last4: ultimos4(digitos),
    exp: opts.exp.trim(),
    holder: opts.holder.trim(),
  };
}

/** "Visa ···· 4242", para mostrar el medio de pago sin exponer nada. */
export const tarjetaLabel = (brand: string | null, last4: string | null): string | null =>
  brand && last4 ? `${brand} ···· ${last4}` : null;

/**
 * Los datos de transferencia (a dónde el club manda el reintegro) son el
 * `BankDetails` de `types.ts`: se piden una vez en el alta, quedan en el perfil y
 * el formulario de reintegro los prefiltra. No se redefinen acá para que no haya
 * dos formas del mismo dato.
 *
 * Un CBU tiene 22 dígitos; un CVU también. El alias es la vía alternativa.
 */
export const cbuValido = (cbu: string): boolean => /^\d{22}$/.test(cbu.replace(/\D/g, ''));
