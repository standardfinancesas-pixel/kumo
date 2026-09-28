/**
 * La edad de una mascota, calculada y escrita.
 *
 * Hay DOS fuentes y conviven a propósito: la fecha de nacimiento, que es lo que se
 * pide desde el 28/09/2026, y `ageYears`, el número que se cargaba antes. Las
 * mascotas viejas no tienen fecha y no se les inventa una —de "5 años" no se
 * deduce un día—, así que siguen mostrando su número hasta que alguien las edite.
 *
 * La fecha MANDA cuando está: un número escrito hace un año ya no es la edad de
 * nadie.
 */

/** Cuántos meses enteros pasaron desde que nació. Null si no hay fecha. */
export function mesesDeVida(fechaNacimiento?: string | null, hoy = new Date()): number | null {
  const t = (fechaNacimiento ?? '').trim();
  if (!t) return null;
  const nac = new Date(`${t.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(nac.getTime())) return null;
  const meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth());
  /* El mes sólo se cumple el día del mes que nació: hasta ahí, todavía tiene la
     edad del mes anterior. Sin esto un cachorro nacido el 30 "cumple" un mes el 1. */
  const cumplido = hoy.getDate() >= nac.getDate() ? meses : meses - 1;
  return Math.max(cumplido, 0);
}

/**
 * La edad como se escribe en pantalla, o null si no se sabe.
 *
 * Por qué cambia de unidad: a un cachorro se lo mide en meses —"2 meses" y "8
 * meses" son animales distintos, con vacunas distintas— y a un adulto en años,
 * donde los meses no aportan nada. El corte va a los dos años, que es cuando deja
 * de importar la diferencia.
 */
export function edadDeMascota(
  p: { birthDate?: string | null; ageYears?: number | null },
  hoy = new Date(),
): string | null {
  const meses = mesesDeVida(p.birthDate, hoy);
  if (meses != null) {
    if (meses < 1) return 'Recién nacido';
    if (meses < 24) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    const años = Math.floor(meses / 12);
    return `${años} años`;
  }
  /* Sin fecha, el número viejo. Se muestra tal cual se cargó, incluido el 0 de
     quien tenía un cachorro y no tenía dónde poner los meses. */
  const n = p.ageYears;
  if (n == null) return null;
  if (n === 0) return 'Menos de un año';
  return `${n} ${n === 1 ? 'año' : 'años'}`;
}
