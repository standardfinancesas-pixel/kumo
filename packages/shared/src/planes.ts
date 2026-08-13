/**
 * Precio del add-on de cobertura odontológica, en ARS por mes.
 *
 * Está en el paquete compartido y no en la pantalla del alta porque lo usan dos
 * lados que no pueden diferir: el cliente para mostrar la cuota y el **servidor**
 * para calcular la que guarda como aceptada. Si el monto lo mandara el
 * navegador, un socio podría firmar por una cuota de $1.
 *
 * Pendiente: debería vivir en la base (una columna de `plans` o una tabla de
 * add-ons) para que el club lo cambie desde el panel sin deployar. Mientras sea
 * una constante, cambiarlo acá no afecta a los socios que ya firmaron: la cuota
 * que aceptaron queda guardada en `profiles.monthly_fee_agreed`.
 */
export const ODONTO_PRECIO = 12000;

/** Cuota mensual de un plan con sus add-ons, que es lo que el socio acepta. */
export const cuotaMensual = (basePrice: number, addonOdonto: boolean) =>
  basePrice + (addonOdonto ? ODONTO_PRECIO : 0);
