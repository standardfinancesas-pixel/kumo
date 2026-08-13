/**
 * Declaración jurada de salud del paso 4 del alta.
 *
 * Las preguntas viven acá y no en la pantalla porque son la fuente de verdad de
 * un registro legal: el cliente las renderiza, pero el **servidor** arma el par
 * pregunta/respuesta con esta misma lista. Si el enunciado lo mandara el
 * navegador, un socio podría guardar "No" contra una pregunta que no es la que
 * contestó.
 *
 * `DECLARACION_VERSION` se sube cada vez que cambia el cuestionario. Las
 * declaraciones ya firmadas guardan su versión y su texto, así que siguen siendo
 * legibles después del cambio.
 */
export const DECLARACION_VERSION = 1;

export const HEALTH_Q = [
  '¿Tu mascota tiene o tuvo diagnóstico de enfermedad oncológica?',
  '¿Tiene enfermedades crónicas con medicación o control continuo?',
  '¿Tiene enfermedades hereditarias o congénitas diagnosticadas?',
  '¿Está actualmente en tratamiento veterinario?',
  '¿Fue operada en los últimos 12 meses?',
  '¿Tiene alguna condición ortopédica diagnosticada (displasia u otra)?',
  '¿Está en gestación o lactancia?',
] as const;

export const SANITARIO_Q = [
  'Vacuna antirrábica al día',
  'Vacuna polivalente al día',
  'Desparasitación interna en los últimos 6 meses',
  'Desparasitación externa en los últimos 3 meses',
] as const;

export type RespuestaDeclarada = { pregunta: string; respuesta: 'Sí' | 'No' };

/** Una respuesta por pregunta, y solo Sí/No: lo demás no es una declaración. */
function emparejar(preguntas: readonly string[], respuestas: Record<number, string>): RespuestaDeclarada[] {
  return preguntas.map((pregunta, i) => ({
    pregunta,
    respuesta: respuestas[i] === 'Sí' ? 'Sí' : 'No',
  }));
}

/**
 * Arma la declaración para guardar. Devuelve `null` si está incompleta: media
 * declaración jurada no se firma.
 */
export function armarDeclaracion(opts: {
  health: Record<number, string>;
  sanit: Record<number, string>;
  firma: string;
}): { version: number; answers: RespuestaDeclarada[]; sanitary: RespuestaDeclarada[]; signature: string } | null {
  const { health, sanit, firma } = opts;
  const completa = (preguntas: readonly string[], r: Record<number, string>) =>
    preguntas.every((_, i) => r[i] === 'Sí' || r[i] === 'No');

  if (!completa(HEALTH_Q, health) || !completa(SANITARIO_Q, sanit)) return null;
  if (!firma || firma.trim().length < 3) return null;

  return {
    version: DECLARACION_VERSION,
    answers: emparejar(HEALTH_Q, health),
    sanitary: emparejar(SANITARIO_Q, sanit),
    signature: firma.trim(),
  };
}
