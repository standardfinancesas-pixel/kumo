/**
 * KUMI · el triaje, que es la parte que NO decide el modelo.
 *
 * La conversación la lleva Claude: pregunta, entiende "está decaída desde
 * anoche" y ordena lo que la persona cuenta. Pero **la urgencia la decide este
 * archivo**, con reglas escritas, revisables y siempre iguales. El modelo junta
 * los hechos; el código resuelve qué hacer con ellos.
 *
 * No es desconfianza del modelo: es que un error acá no se mide en una respuesta
 * fea, se mide en un animal que llegó tarde a la guardia. Una regla se lee, se
 * discute con un veterinario y se versiona; una respuesta generada, no.
 *
 * Las listas salen del diseño de KUMI, no de mi criterio clínico. **Faltan
 * revisar por un veterinario matriculado antes de publicar esto**: el propio
 * deslinde dice que la IA puede equivocarse, y las reglas de abajo deciden más
 * que la IA.
 */

/* ── Lo que se pregunta ────────────────────────────────────────── */

export type Especie = 'perro' | 'gato' | 'conejo' | 'ave' | 'otro';
export const ESPECIES: { id: Especie; label: string }[] = [
  { id: 'perro', label: 'Perro' },
  { id: 'gato', label: 'Gato' },
  { id: 'conejo', label: 'Conejo' },
  { id: 'ave', label: 'Ave' },
  { id: 'otro', label: 'Otro' },
];

/**
 * Las señales que cortan solas: marcada una, es guardia y no hay más preguntas.
 * Tal cual la lista del diseño de KUMI.
 */
export const SENALES_URGENCIA = [
  'Le cuesta respirar',
  'Convulsiones',
  'Sangrado que no para',
  'Comió algo tóxico',
  'Atropello o caída fuerte',
  'Panza hinchada y dura',
  'No puede orinar',
  'Vómitos o diarrea con sangre',
  'Desmayo o no responde',
  'Encías pálidas o azuladas',
  'Golpe de calor',
] as const;
export type SenalUrgencia = (typeof SENALES_URGENCIA)[number];

/** Lo que puede haber comido o tocado. Cualquiera de estos también es guardia. */
export const TOXICOS = [
  'Chocolate',
  'Uvas o pasas',
  'Cebolla o ajo',
  'Chicle o caramelos sin azúcar (xilitol)',
  'Medicamentos de personas',
  'Raticida o veneno',
  'Lirios (gatos)',
  'Productos de limpieza',
  'Pipeta de perro en un gato',
  'Marihuana u otras drogas',
] as const;
export type Toxico = (typeof TOXICOS)[number];

/** Motivos de consulta comunes. No deciden nada por sí solos: orientan la charla. */
export const SINTOMAS = [
  'Piel / picazón',
  'Herida',
  'Vómitos',
  'Diarrea',
  'Cojera',
  'Ojos',
  'Oídos',
  'Tos / estornudos',
  'Bulto',
  'No come',
  'Comportamiento raro',
  'Dientes / boca',
] as const;
export type Sintoma = (typeof SINTOMAS)[number];

export type Animo = 'normal' | 'decaido' | 'muy_decaido';
export type Comida = 'normal' | 'come_menos' | 'no_come' | 'no_toma_agua';

/* ── Los hechos que junta la conversación ──────────────────────── */

/**
 * Lo que el modelo tiene que haber averiguado para que se pueda evaluar.
 *
 * Todo es opcional salvo la especie: la conversación puede cortarse en cualquier
 * momento —si aparece una señal de urgencia, se corta a propósito— y el triaje
 * tiene que poder resolver con lo que haya.
 */
export type HechosTriaje = {
  especie: Especie;
  /** En MESES, no en años: abajo de los 3 meses cambia el criterio. */
  edadMeses?: number | null;
  pesoKg?: number | null;
  /** Hace cuánto empezó, en horas. */
  horasDeEvolucion?: number | null;
  senales?: string[];
  toxicos?: string[];
  sintomas?: string[];
  animo?: Animo | null;
  comida?: Comida | null;
  /** Macho que puja para orinar sin resultado: obstrucción urinaria. */
  pujaSinOrinar?: boolean;
  /** Arcadas sin llegar a vomitar: con panza hinchada, torsión gástrica. */
  arcadasSinVomitar?: boolean;
  /** Lo que escribió la persona, tal cual. */
  relato?: string;
};

/* ── La decisión ───────────────────────────────────────────────── */

export type NivelUrgencia = 'guardia' | 'videoconsulta' | 'casa';

export type Veredicto = {
  nivel: NivelUrgencia;
  /** Por qué, en palabras, para mostrárselo a la persona Y para auditarlo
   *  después. Un triaje que no dice por qué no se puede revisar. */
  motivos: string[];
  /** Qué regla lo decidió, para poder medir cuáles se disparan de verdad. */
  reglas: string[];
};

const PESADO_KG = 20;

/**
 * Las combinaciones que un solo síntoma no muestra.
 *
 * Están separadas de las señales sueltas porque son el caso donde el triaje
 * aporta algo: "vomita" en un cachorro de dos meses no es lo mismo que en un
 * perro adulto, y nadie que esté asustado a las tres de la mañana va a hacer esa
 * cuenta. Las tres salen del propio diseño de KUMI.
 */
function reglasCombinadas(h: HechosTriaje): { motivo: string; regla: string }[] {
  const salida: { motivo: string; regla: string }[] = [];
  const sintomas = h.sintomas ?? [];
  const tiene = (s: Sintoma) => sintomas.includes(s);

  // Cachorro muy chico: se deshidrata y se descompensa en horas, no en días.
  const muyChico = h.edadMeses != null && h.edadMeses < 3;
  const decaidoOSintoma = tiene('Vómitos') || tiene('Diarrea') || tiene('No come') || h.animo === 'muy_decaido' || h.animo === 'decaido';
  if (muyChico && decaidoOSintoma) {
    salida.push({
      motivo: 'Es muy chiquito (menos de 3 meses) y está con vómitos, diarrea, sin comer o decaído. A esa edad se complica en horas.',
      regla: 'cachorro-menor-3-meses',
    });
  }

  // Obstrucción urinaria: en gatos machos mata en un día y parece "está raro".
  if (h.pujaSinOrinar) {
    salida.push({
      motivo: 'Hace fuerza para orinar y no sale nada. Puede ser una obstrucción, que es una urgencia de verdad.',
      regla: 'puja-sin-orinar',
    });
  }

  // Torsión gástrica: perro grande, arcadas improductivas, abdomen distendido.
  const grande = h.pesoKg != null && h.pesoKg >= PESADO_KG;
  if (h.especie === 'perro' && grande && h.arcadasSinVomitar) {
    salida.push({
      motivo: 'Es un perro grande con arcadas sin llegar a vomitar. Eso puede ser una torsión de estómago y no espera.',
      regla: 'arcadas-perro-grande',
    });
  }

  return salida;
}

/**
 * La red de seguridad sobre el texto crudo.
 *
 * Si el modelo no marcó la señal pero la persona escribió "no respira", esto la
 * marca igual. **Solo escala, nunca baja el nivel**: un falso positivo manda a
 * alguien a la veterinaria sin necesidad, que es el error barato; el falso
 * negativo es el que no se puede pagar. Por eso no intenta entender la frase —
 * "no vomitó sangre" también va a escalar, y está bien que así sea.
 */
const FRASES_ROJAS: { frase: string; senal: string }[] = [
  { frase: 'no respira', senal: 'Le cuesta respirar' },
  { frase: 'no puede respirar', senal: 'Le cuesta respirar' },
  { frase: 'le cuesta respirar', senal: 'Le cuesta respirar' },
  { frase: 'convuls', senal: 'Convulsiones' },
  { frase: 'ataque epilep', senal: 'Convulsiones' },
  { frase: 'no reacciona', senal: 'Desmayo o no responde' },
  { frase: 'no responde', senal: 'Desmayo o no responde' },
  { frase: 'desmay', senal: 'Desmayo o no responde' },
  { frase: 'inconsciente', senal: 'Desmayo o no responde' },
  { frase: 'lo atropell', senal: 'Atropello o caída fuerte' },
  { frase: 'la atropell', senal: 'Atropello o caída fuerte' },
  { frase: 'se cayo de', senal: 'Atropello o caída fuerte' },
  { frase: 'veneno', senal: 'Comió algo tóxico' },
  { frase: 'raticida', senal: 'Comió algo tóxico' },
  { frase: 'tomo lavandina', senal: 'Comió algo tóxico' },
  { frase: 'sangre', senal: 'Sangrado que no para' },
  { frase: 'sangrando', senal: 'Sangrado que no para' },
  { frase: 'encias blancas', senal: 'Encías pálidas o azuladas' },
  { frase: 'encias palidas', senal: 'Encías pálidas o azuladas' },
  { frase: 'golpe de calor', senal: 'Golpe de calor' },
];

/** Sin tildes y en minúscula, para que "convulsión" y "convulsion" pesen igual. */
const plano = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function senalesEnTexto(texto: string): string[] {
  const t = plano(texto);
  const encontradas = new Set<string>();
  for (const { frase, senal } of FRASES_ROJAS) {
    if (t.includes(frase)) encontradas.add(senal);
  }
  return [...encontradas];
}

/**
 * El veredicto. Determinístico: los mismos hechos dan siempre lo mismo.
 *
 * El orden importa y es a propósito: primero lo que manda a la guardia, y recién
 * si nada de eso aparece se mira lo demás. Nada de lo que venga después puede
 * bajar de nivel a alguien que ya tiene una señal roja.
 */
export function evaluarTriaje(h: HechosTriaje): Veredicto {
  const motivos: string[] = [];
  const reglas: string[] = [];

  const senales = new Set([...(h.senales ?? []), ...senalesEnTexto(h.relato ?? '')]);
  for (const s of senales) {
    motivos.push(`Marcaste "${s}", que es una señal de urgencia.`);
    reglas.push(`senal:${s}`);
  }

  for (const t of h.toxicos ?? []) {
    motivos.push(`Pudo haber comido o tocado ${t.toLowerCase()}.`);
    reglas.push(`toxico:${t}`);
  }

  for (const { motivo, regla } of reglasCombinadas(h)) {
    motivos.push(motivo);
    reglas.push(regla);
  }

  if (motivos.length > 0) return { nivel: 'guardia', motivos, reglas };

  /*
   * Sin señales rojas marcadas, hay cuadros que igual no esperan. Estos salen del
   * motor de reglas del diseño de KUMI, no de criterio mío:
   */

  // Un gato que no come más de un día puede hacer lipidosis hepática. Es la regla
  // menos obvia de todas y la que más veces salva: "no come" suena a capricho.
  if (h.especie === 'gato' && h.comida === 'no_come' && (h.horasDeEvolucion ?? 0) > 24) {
    return {
      nivel: 'guardia',
      motivos: ['Es un gato que no come hace más de un día. Eso necesita revisión presencial: se le puede complicar el hígado.'],
      reglas: ['gato-sin-comer-mas-de-24h'],
    };
  }

  // Decaimiento fuerte o sin tomar agua: se deshidrata rápido.
  if (h.animo === 'muy_decaido' || h.comida === 'no_toma_agua') {
    return {
      nivel: 'guardia',
      motivos: ['Lo ves muy decaído o no está tomando agua. Puede deshidratarse rápido, así que conviene verlo hoy en una veterinaria.'],
      reglas: ['decaimiento-fuerte-o-sin-agua'],
    };
  }

  // Los extremos de edad aguantan menos: con cualquier cosa, que lo vea alguien.
  if (h.edadMeses != null && h.edadMeses >= 84 && h.animo != null && h.animo !== 'normal') {
    return {
      nivel: 'videoconsulta',
      motivos: ['Tiene más de 7 años y lo ves decaído. A esa edad el decaimiento siempre conviene que lo vea un veterinario.'],
      reglas: ['mayor-de-7-decaido'],
    };
  }
  if (h.edadMeses != null && h.edadMeses < 3) {
    return {
      nivel: 'videoconsulta',
      motivos: ['Es menor de 3 meses: a esa edad cualquier síntoma conviene que lo vea un veterinario.'],
      reglas: ['menor-de-3-meses'],
    };
  }

  if (h.comida === 'no_come' || h.comida === 'come_menos') {
    return {
      nivel: 'videoconsulta',
      motivos: ['No está comiendo como siempre. No es una emergencia, pero sí algo para que lo vea un profesional.'],
      reglas: ['come-menos'],
    };
  }

  // Lo que lleva muchos días sin mejorar tampoco se resuelve mirándolo más.
  if (h.horasDeEvolucion != null && h.horasDeEvolucion >= 72) {
    return {
      nivel: 'videoconsulta',
      motivos: ['Ya lleva más de tres días así. Si no mejora solo, conviene que lo vea un veterinario.'],
      reglas: ['lleva-mas-de-72-horas'],
    };
  }

  if ((h.sintomas ?? []).length > 0) {
    return {
      nivel: 'videoconsulta',
      motivos: ['Hay síntomas que conviene que vea un profesional, pero sin signos de urgencia.'],
      reglas: ['sintomas-sin-urgencia'],
    };
  }

  return {
    nivel: 'casa',
    motivos: ['Por lo que contás no hay señales de alarma.'],
    reglas: ['sin-senales'],
  };
}

/**
 * Qué hacer y qué no, según el desenlace, y cuándo volver a consultar.
 *
 * Salen del diseño de KUMI, igual que las reglas. Importan más de lo que parecen:
 * sin esto, un "se puede seguir en casa" se lee como "no pasa nada" y la persona
 * no sabe qué tiene que mirar ni cuándo preocuparse. Las dos cosas que más daño
 * hacen entre la consulta y el veterinario —provocar el vómito y dar un remedio
 * de persona— están nombradas en todos los niveles a propósito.
 */
export const CUIDADOS: Record<NivelUrgencia, { hacer: string[]; noHacer: string[]; volverSi: string[] }> = {
  guardia: {
    hacer: [
      'Llamá a la guardia mientras vas en camino.',
      'Trasladalo con cuidado, abrigado y sin forzarlo.',
      'Si comió algo, llevá el envase o una foto de lo que comió.',
    ],
    noHacer: [
      'No le provoques el vómito sin indicación de un veterinario.',
      'No le des medicamentos de uso humano.',
      'No esperes a ver si mejora.',
    ],
    volverSi: [],
  },
  videoconsulta: {
    hacer: [
      'Tené a mano las fotos y lo que observaste.',
      'Anotá si come, toma agua, orina y defeca normal.',
    ],
    noHacer: ['No lo automediques.'],
    volverSi: [
      'Deja de comer o de tomar agua.',
      'Aparece decaimiento fuerte, vómitos repetidos o sangre.',
    ],
  },
  casa: {
    hacer: ['Observalo durante 24 a 48 horas.', 'Anotá si come, toma agua, orina y defeca normal.'],
    noHacer: ['No lo automediques.'],
    volverSi: ['Empeora o aparece cualquiera de las señales de urgencia.'],
  },
};

/* ── El deslinde ───────────────────────────────────────────────── */

/**
 * La versión del deslinde que la persona aceptó se guarda con la consulta.
 *
 * Sirve para una sola cosa, pero importa: el día que haya un reclamo, poder
 * mostrar QUÉ texto aceptó esa persona ese día. Si el texto cambia, cambia la
 * versión y las consultas viejas siguen apuntando a la que firmaron.
 */
export const DESLINDE_VERSION = '2026-11-17';

export const DESLINDE: { titulo: string; texto: string }[] = [
  { titulo: 'Orientativo', texto: 'No es diagnóstico, tratamiento ni acto médico veterinario; no reemplaza a un veterinario matriculado.' },
  { titulo: 'Sin relación profesional', texto: 'No genera vínculo veterinario-paciente con Kumo, Standard Finance S.A.S. ni su red.' },
  { titulo: 'Emergencias', texto: 'Ante signos de gravedad o si empeora, andá a una guardia sin importar el resultado.' },
  { titulo: 'Limitaciones', texto: 'Depende de lo que cargues; una foto no permite revisar, palpar ni auscultar.' },
  { titulo: 'Inteligencia artificial', texto: 'Puede equivocarse; la decisión final es tuya y del profesional.' },
  { titulo: 'Responsabilidad', texto: 'Kumo y Standard Finance S.A.S. no responden por decisiones tomadas con esta orientación ni por demoras en consultar.' },
  { titulo: 'Datos', texto: 'Las fotos y los datos se usan solo para esta orientación (Ley 25.326). No subas fotos de personas.' },
  { titulo: 'Medicación', texto: 'No le des medicamentos de personas sin indicación de un veterinario.' },
];

/** Hasta 3 fotos, como el diseño. Más no agregan y encarecen cada consulta. */
export const MAX_FOTOS = 3;

/** Qué le decimos que haga, según el nivel. */
export const ACCION: Record<NivelUrgencia, { titulo: string; bajada: string }> = {
  guardia: {
    titulo: 'Andá a una guardia ahora',
    bajada: 'Por lo que contás, esto no espera. Buscá la veterinaria de urgencias más cercana y salí.',
  },
  videoconsulta: {
    titulo: 'Que lo vea un veterinario hoy',
    bajada: 'No parece una emergencia, pero tampoco para dejar pasar. Coordinamos una videoconsulta.',
  },
  casa: {
    titulo: 'Se puede seguir en casa',
    bajada: 'Por ahora no hay señales de alarma. Miralo de cerca y volvé a consultar si algo cambia.',
  },
};
