/**
 * Buscar texto como lo busca una persona.
 *
 * Quien escribe en un buscador no escribe los acentos ni respeta las mayúsculas,
 * y casi nunca escribe el nombre completo: pone dos pedazos sueltos y espera que
 * aparezca. Si la comparación es literal, "maria" no encuentra a "María" y "lioi
 * flor" no encuentra a "Florencia Lioi" — y lo que ve el club es una lista vacía,
 * que se lee como "ese socio no existe".
 */

/** Sin acentos, en minúsculas y sin espacios de sobra: la forma comparable. */
export function sinAcentos(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * ¿Lo escrito aparece en alguno de estos campos?
 *
 * Se parte en palabras y se exigen TODAS, en cualquier orden y en cualquiera de
 * los campos: así "lioi flor" encuentra a Florencia Lioi y "13 kira" encuentra al
 * socio #13 si su mascota se llama Kira. Una consulta vacía no filtra nada.
 */
export function coincideBusqueda(consulta: string, campos: (string | null | undefined)[]): boolean {
  const palabras = sinAcentos(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const heno = sinAcentos(campos.filter(Boolean).join(' '));
  return palabras.every((p) => heno.includes(p));
}
