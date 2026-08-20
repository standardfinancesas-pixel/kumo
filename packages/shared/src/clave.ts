/**
 * Qué se le pide a una contraseña, y cómo se le muestra.
 *
 * Vive acá porque se elige una contraseña en cuatro lugares —el alta en la web, el
 * alta en la app, y las dos pantallas de "contraseña nueva"— y hasta ahora cada una
 * tenía su propio mínimo escrito a mano. Con reglas distintas por pantalla, la misma
 * clave se acepta en un lado y se rechaza en el otro, y quien la cambia por el mail
 * no entiende por qué.
 *
 * Es una lista y no un booleano a propósito: el formulario muestra los requisitos
 * uno por uno y se van tildando mientras la persona escribe. Un "contraseña
 * inválida" después de apretar el botón obliga a adivinar qué falta.
 *
 * OJO: esto valida cuando se ELIGE una contraseña, nunca al entrar. Los socios que
 * ya están tienen claves de 6 caracteres hechas con la regla vieja, y aplicar esto
 * en el login los dejaría afuera de su propia cuenta.
 */
export const CLAVE_MINIMA = 8;

export type ChequeoClave = { texto: string; ok: boolean };

/** Las mayúsculas con tilde y la Ñ cuentan: es una app en español, y no reconocer la
 *  Á de "Ángel" es decirle a alguien que su mayúscula no es una mayúscula. */
const MAYUSCULA = /[A-ZÁÉÍÓÚÜÑ]/;

export function chequeosClave(clave: string): ChequeoClave[] {
  return [
    { texto: `Al menos ${CLAVE_MINIMA} caracteres`, ok: clave.length >= CLAVE_MINIMA },
    { texto: 'Al menos una mayúscula', ok: MAYUSCULA.test(clave) },
  ];
}

export const claveValida = (clave: string): boolean => chequeosClave(clave).every((c) => c.ok);
