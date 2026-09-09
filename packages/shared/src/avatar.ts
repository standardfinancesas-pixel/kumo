/**
 * La cara del socio en el foro.
 *
 * Subir foto es opcional, así que lo que más se va a ver NO es la foto: son las
 * iniciales. En una lista de veinte publicaciones puede haber una sola foto y
 * diecinueve iniciales, y eso quiere decir que el caso "sin foto" no es el borde
 * sino el normal — tiene que verse igual de terminado.
 *
 * Vive acá y no en cada pantalla porque el mismo socio aparece en la app y en la
 * web, y dos formas distintas de abreviar su nombre lo convierten en dos personas
 * distintas para quien lee.
 */

/**
 * Las iniciales de un nombre: la primera del primer nombre y la del apellido.
 *
 * "Florencia Lioi" → FL. "Richi" → R. Con tres o más palabras se toman los
 * extremos y no las tres, para que el círculo no tenga que achicar la letra:
 * "Maria del Carmen Lozano" → ML.
 */
export function iniciales(nombre: string | null | undefined): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primera = partes[0]![0]!;
  const ultima = partes.length > 1 ? partes[partes.length - 1]![0]! : '';
  return (primera + ultima).toUpperCase();
}
