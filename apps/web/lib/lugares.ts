import { PROVINCIAS } from '@kumo/shared';

/**
 * Direcciones argentinas de verdad, para autocompletar mientras se tipea.
 *
 * Usa **Georef**, el normalizador de direcciones del Estado argentino
 * (`apis.datos.gob.ar/georef`): gratis, sin clave, sin tarjeta, y con el callejero
 * oficial. Devuelve la calle normalizada, el departamento, la provincia y las
 * coordenadas en una sola consulta.
 *
 * POR QUÉ NO NOMINATIM ACÁ: la política de uso de Nominatim **prohíbe** el
 * autocompletado contra su servidor público ("you must not implement such a service
 * on top of the public API"), así que el geocodificador que ya tenemos no se puede
 * colgar de un input ni con debounce. Georef está hecho para esto.
 *
 * Y por qué importa más que la comodidad de no tipear: los domicilios que había
 * cargados eran "luis maria campos 405, 1", "caba" y "mendoza", y de ahí salieron
 * todas las reglas de limpieza del geocodificador. Si la persona elige de una lista,
 * el problema no existe.
 *
 * Cubre solo Argentina, y no resuelve todo: barrios nuevos, direcciones rurales,
 * "km 12 de la ruta 9". Por eso el campo sigue aceptando texto libre y esto nunca
 * bloquea nada.
 */
const GEOREF = 'https://apis.datos.gob.ar/georef/api/direcciones';

export type Sugerencia = {
  /** Para la key de la lista, no se guarda. */
  id: string;
  /** Lo que se muestra en la lista. */
  etiqueta: string;
  /** Lo que va a `profiles.address`. */
  domicilio: string;
  /** Lo que va a `profiles.city`: la localidad, o la comuna en CABA. */
  localidad: string;
  /** Lo que va a `profiles.province`, ya con el nombre que usa el selector. */
  provincia: string;
  lat: number;
  lng: number;
};

/* Los nombres de provincia de Georef son los oficiales y dos no coinciden con la
   lista del formulario. El resto es idéntico (chequeado contra /provincias). */
const PROVINCIA_CANONICA: Record<string, string> = {
  'Ciudad Autónoma de Buenos Aires': 'CABA',
  'Tierra del Fuego, Antártida e Islas del Atlántico Sur': 'Tierra del Fuego',
};
function canonizarProvincia(nombre: string): string {
  const mapeada = PROVINCIA_CANONICA[nombre] ?? nombre;
  // Si Georef devolviera una provincia que el selector no tiene, se manda igual el
  // nombre oficial: es mejor un texto raro que un campo vacío.
  return (PROVINCIAS as readonly string[]).includes(mapeada) ? mapeada : nombre;
}

/* Georef escribe las calles en mayúsculas y abreviadas ("AV GRAL PAZ"). Esto las
   deja como las escribiría una persona, porque es texto que el socio va a ver en su
   perfil y en su carnet. */
const ABREVIATURAS: Record<string, string> = {
  AV: 'Av.', AVDA: 'Av.', BV: 'Bv.', BLVD: 'Bv.', PJE: 'Pje.', DIAG: 'Diag.',
  GRAL: 'Gral.', CNEL: 'Cnel.', TTE: 'Tte.', SGTO: 'Sgto.', ALTE: 'Alte.',
  DR: 'Dr.', DRA: 'Dra.', PTE: 'Pte.', ING: 'Ing.', ARQ: 'Arq.', PROF: 'Prof.',
  MONS: 'Mons.', PJE_: 'Pje.',
};
/** Palabras que van en minúscula salvo al principio. */
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'el', 'al']);

function lindo(texto: string): string {
  return texto.trim().split(/\s+/).map((palabra, i) => {
    const abrev = ABREVIATURAS[palabra.toUpperCase()];
    if (abrev) return abrev;
    const bajo = palabra.toLowerCase();
    if (i > 0 && MINUSCULAS.has(bajo)) return bajo;
    // Los números quedan como están ("9 de Julio", "25 de Mayo").
    if (/^\d/.test(bajo)) return bajo;
    return bajo.charAt(0).toUpperCase() + bajo.slice(1);
  }).join(' ');
}

type FilaGeoref = {
  calle?: { nombre?: string | null } | null;
  altura?: { valor?: number | null } | null;
  departamento?: { nombre?: string | null } | null;
  localidad_censal?: { nombre?: string | null } | null;
  provincia?: { nombre?: string | null } | null;
  ubicacion?: { lat?: number | null; lon?: number | null } | null;
};

/**
 * Busca direcciones. Nunca lanza: si Georef no contesta, devuelve una lista vacía y
 * el campo se comporta como el texto libre de siempre.
 *
 * `provincia` y `localidad` son opcionales pero ayudan muchísimo: sin ellas, "San
 * Martín 450" tiene candidatos en medio país.
 */
export async function buscarDirecciones(consulta: string, provincia?: string, localidad?: string): Promise<Sugerencia[]> {
  const q = consulta.trim();
  if (q.length < 4) return [];
  const params = new URLSearchParams({ direccion: q, max: '8', campos: 'estandar' });
  if (provincia) params.set('provincia', provincia);
  // La localidad la manda el geocodificador, que ya la tiene guardada; el campo de
  // autocompletado no, porque la persona todavía la está por elegir.
  if (localidad) params.set('localidad', localidad);

  try {
    const r = await fetch(`${GEOREF}?${params}`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return [];
    const { direcciones } = (await r.json()) as { direcciones?: FilaGeoref[] };
    const vistas = new Set<string>();
    const salida: Sugerencia[] = [];

    for (const fila of direcciones ?? []) {
      const calle = fila.calle?.nombre;
      const lat = fila.ubicacion?.lat;
      const lng = fila.ubicacion?.lon;
      const prov = fila.provincia?.nombre;
      if (!calle || !prov || typeof lat !== 'number' || typeof lng !== 'number') continue;

      const altura = fila.altura?.valor;
      const domicilio = altura ? `${lindo(calle)} ${altura}` : lindo(calle);
      /* La localidad: en CABA `localidad_censal` es la ciudad entera y repite la
         provincia, así que ahí sirve el departamento, que es la comuna. En el resto
         del país `localidad_censal` es la ciudad ("Tandil"), que es lo que uno
         escribiría. */
      const censal = fila.localidad_censal?.nombre ?? '';
      const localidadFinal = censal && censal !== prov ? censal : (fila.departamento?.nombre ?? '');
      const provinciaFinal = canonizarProvincia(prov);

      // Sin altura, Georef devuelve un punto por tramo de calle: son varias filas
      // iguales para el ojo del socio. Se muestra una.
      const clave = `${domicilio}|${localidadFinal}|${provinciaFinal}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);

      salida.push({
        id: clave,
        etiqueta: [domicilio, [localidadFinal, provinciaFinal].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
        domicilio,
        localidad: localidadFinal,
        provincia: provinciaFinal,
        lat,
        lng,
      });
    }
    return salida;
  } catch {
    // Timeout, DNS, 429: el campo sigue siendo un input de texto y nada se rompe.
    return [];
  }
}
