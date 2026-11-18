import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import {
  ACCION, ANTECEDENTES, DESLINDE_VERSION, ESPECIES, SENALES_URGENCIA, SINTOMAS, TOXICOS,
  evaluarTriaje, hoyISO, senalesEnTexto, type Especie, type HechosTriaje,
} from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * KUMI · el triaje de orientación veterinaria.
 *
 * El reparto de trabajo es la decisión de diseño de todo esto, y no un detalle
 * de implementación:
 *
 * - **El modelo pregunta y ordena.** Entiende "desde anoche está tirada y no
 *   come", pide lo que falta de a una cosa por vez y llena una ficha de hechos.
 * - **El código decide.** `evaluarTriaje` de @kumo/shared mira esos hechos y
 *   dice guardia, videoconsulta o casa. El modelo NO emite el veredicto, ni
 *   siquiera lo insinúa: el texto que ve la persona sale de `ACCION`.
 *
 * De ahí salen las tres cosas que hacen que esto se pueda sostener:
 *
 * 1. **El atajo de emergencia va antes del modelo.** Si en lo que la persona
 *    escribió aparece una frase roja —"no respira", "convulsionó", "comió
 *    veneno"—, esta ruta contesta guardia SIN llamar a nadie. Es gratis, es
 *    instantáneo y sigue andando con la API de Anthropic caída. La emergencia es
 *    justo el caso donde no se puede depender de un tercero.
 * 2. **Si el modelo no está, el triaje igual sucede.** Sin clave, con error, con
 *    el tope pasado o con una negativa del clasificador, la ruta contesta
 *    `tipo: 'formulario'` y la pantalla cae al guion de pastillas, que pregunta
 *    exactamente lo mismo sin IA. Un triaje que depende de que un proveedor
 *    conteste no es un triaje: es un servicio de terceros con otro nombre.
 * 3. **La evaluación corre SIEMPRE acá**, aunque `evaluarTriaje` sea una función
 *    pura que podría correr en el navegador. El veredicto que se guarda tiene
 *    que ser el que produjo este código y no uno que llegó armado desde afuera.
 *    Un triaje que se puede dictar desde el cliente no es auditable.
 */

const KEY = process.env.ANTHROPIC_API_KEY;

/* Claude Sonnet 5.5 y no el Opus de la primera versión. El modelo acá no decide
   nada clínico: entiende castellano, pregunta lo que falta y llena una ficha de
   enums cerrados. Para eso alcanza, y la diferencia de precio con Opus 5.5 es de
   cinco veces en entrada y en salida ($2/$10 contra $4/$20 por millón de tokens
   al 17/11/2026). El esfuerzo va explícito y bajo por la misma razón y porque la
   persona que escribe esto está preocupada: cada segundo de espera se siente. */
const MODELO = 'claude-sonnet-5-5';
const ESFUERZO = 'low' as const;

/** Tope por socio y por hora. Cada vuelta de conversación cuesta plata de verdad. */
const TOPE_POR_HORA = 12;
/* Tope de vueltas de una misma consulta: a la novena, se evalúa con lo que haya.
   Sin esto, un modelo que nunca se da por satisfecho deja a la persona
   contestando preguntas mientras el animal espera. */
const MAX_VUELTAS = 8;

const usos = new Map<string, number[]>();
function pasaElTope(id: string): boolean {
  const ahora = Date.now();
  const hora = 60 * 60 * 1000;
  const previos = (usos.get(id) ?? []).filter((t) => ahora - t < hora);
  if (previos.length >= TOPE_POR_HORA) return false;
  previos.push(ahora);
  usos.set(id, previos);
  return true;
}

/* Las listas permitidas. Todo lo que llega —del navegador o del modelo— se filtra
   contra ellas. No es paranoia: esto entra a una decisión clínica, y una señal
   con un nombre que no existe se perdería en silencio en vez de escalar. */
const SENALES_OK: readonly string[] = SENALES_URGENCIA;
const TOXICOS_OK: readonly string[] = TOXICOS;
const SINTOMAS_OK: readonly string[] = SINTOMAS;
const ANIMOS = ['normal', 'decaido', 'muy_decaido'];
const COMIDAS = ['normal', 'come_menos', 'no_come', 'no_toma_agua'];

const texto = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const lista = (v: unknown, permitidos: readonly string[]) =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string').filter((x) => permitidos.includes(x)).slice(0, 40)
    : [];
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const unaEspecie = (v: unknown): Especie | null =>
  ESPECIES.map((e) => e.id).includes(v as Especie) ? (v as Especie) : null;

/** Arma los hechos desde cualquier origen, con todo filtrado contra lo conocido. */
function hechosDe(crudo: Record<string, unknown>, especie: Especie): HechosTriaje {
  return {
    especie,
    edadMeses: numero(crudo.edadMeses),
    pesoKg: numero(crudo.pesoKg),
    horasDeEvolucion: numero(crudo.horasDeEvolucion),
    senales: lista(crudo.senales, SENALES_OK),
    toxicos: lista(crudo.toxicos, TOXICOS_OK),
    sintomas: lista(crudo.sintomas, SINTOMAS_OK),
    animo: ANIMOS.includes(crudo.animo as string) ? (crudo.animo as HechosTriaje['animo']) : null,
    comida: COMIDAS.includes(crudo.comida as string) ? (crudo.comida as HechosTriaje['comida']) : null,
    pujaSinOrinar: crudo.pujaSinOrinar === true,
    arcadasSinVomitar: crudo.arcadasSinVomitar === true,
    relato: texto(crudo.relato),
    antecedente: ANTECEDENTES.some((a) => a.id === crudo.antecedente)
      ? (crudo.antecedente as HechosTriaje['antecedente'])
      : null,
  };
}

/**
 * La ficha que el modelo va llenando.
 *
 * `strict: true` y `additionalProperties: false` para que lo que llega sea
 * exactamente esto: estos campos entran a una decisión clínica, así que un campo
 * inventado o un tipo raro no puede pasar de largo.
 */
const FICHA: Anthropic.Tool = {
  name: 'registrar_hechos',
  description:
    'Registra lo que sabés de la mascota hasta ahora. Llamala en CADA respuesta, con todo lo que tengas, aunque falten datos. Cuando ya tengas lo suficiente para una orientación, poné listo en true.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      especie: { type: 'string', enum: ESPECIES.map((e) => e.id) },
      edadMeses: { type: ['integer', 'null'], description: 'Edad en MESES. 2 años = 24.' },
      pesoKg: { type: ['number', 'null'] },
      /* Con las equivalencias escritas: "desde anoche" se quedaba en null, y de
         ese número dependen dos reglas (el gato que no come hace más de 24 h y
         lo que ya lleva más de 72). Un null acá no escala de menos por error de
         criterio, escala de menos por una cuenta que nadie hizo. */
      horasDeEvolucion: {
        type: ['integer', 'null'],
        description: 'Hace cuántas horas empezó. Convertí siempre: "recién" = 1, "esta mañana" = 6, "anoche" = 12, "ayer" = 24, "dos días" = 48, "una semana" = 168.',
      },
      senales: { type: 'array', items: { type: 'string', enum: [...SENALES_URGENCIA] } },
      toxicos: { type: 'array', items: { type: 'string', enum: [...TOXICOS] } },
      sintomas: { type: 'array', items: { type: 'string', enum: [...SINTOMAS] } },
      /* Los enums que además pueden venir vacíos van como `anyOf` y no como
         `type: ['string','null']` con el null metido en el enum: con `strict`
         eso es un 400 ("Enum value 'normal' does not match declared type"). */
      animo: { anyOf: [{ type: 'string', enum: ANIMOS }, { type: 'null' }] },
      comida: { anyOf: [{ type: 'string', enum: COMIDAS }, { type: 'null' }] },
      pujaSinOrinar: { type: 'boolean', description: 'Hace fuerza para orinar y no sale nada.' },
      arcadasSinVomitar: { type: 'boolean', description: 'Arcadas sin llegar a vomitar.' },
      antecedente: {
        anyOf: [{ type: 'string', enum: ANTECEDENTES.map((a) => a.id) }, { type: 'null' }],
        description: 'Si ya le pasó antes y si lo vio un veterinario.',
      },
      relato: { type: 'string', description: 'Lo que contó la persona, resumido en una línea.' },
      /* La pregunta viaja ADENTRO de la ficha y no como texto suelto. Cuando el
         modelo llama a una herramienta suele cortar ahí sin escribir nada, y la
         persona se queda mirando una burbuja vacía. Medido: en las dos pruebas
         contra la API, `stop_reason` fue `tool_use` y el texto vino vacío. La
         alternativa era una segunda llamada para que hable, o sea el doble de
         plata y el doble de espera por cada vuelta. */
      mensaje: {
        type: 'string',
        description: 'Lo que le decís a la persona ahora, en una o dos líneas: la próxima pregunta, o una frase corta de cierre si listo es true. Nunca el veredicto.',
      },
      listo: { type: 'boolean', description: 'true cuando ya alcanza para orientar.' },
    },
    required: [
      'especie', 'edadMeses', 'pesoKg', 'horasDeEvolucion', 'senales', 'toxicos',
      'sintomas', 'animo', 'comida', 'pujaSinOrinar', 'arcadasSinVomitar', 'antecedente', 'relato', 'mensaje', 'listo',
    ],
  },
};

const SISTEMA = `Sos KUMI, el asistente de orientación veterinaria de Kumo. Hablás en español rioplatense, de vos, con calma y sin dramatizar.

QUÉ HACÉS
- Averiguás qué le pasa a la mascota preguntando de a UNA cosa por vez, en lenguaje simple.
- Registrás todo lo que te van contando con la herramienta registrar_hechos, en CADA respuesta.
- Cuando ya tenés lo suficiente, ponés listo en true.

QUÉ NO HACÉS, NUNCA
- No diagnosticás, no nombrás enfermedades probables y no sugerís tratamientos ni medicamentos.
- No decís si hay que ir a la guardia, si es grave o si puede esperar. Esa conclusión NO es tuya: la decide el sistema con reglas revisadas por veterinarios, y se le muestra a la persona aparte. Si te preguntan "¿es grave?", contestá que estás juntando los datos y que en un momento le das la orientación.
- No pidas datos de personas ni fotos donde salga alguien.

CÓMO PREGUNTÁS
- Primero lo que cambia el criterio: especie, edad (en meses si es cachorro), peso aproximado, hace cuánto empezó.
- Lo que ya sabés NO se vuelve a preguntar. Si abajo dice que ya tenés la especie, la edad o el peso, salteá esa pregunta.
- Preguntá explícitamente por las señales de alarma si todavía no surgieron.
- Si es macho y hay algo urinario, preguntá si hace fuerza sin que salga nada.
- Si es un perro grande con la panza hinchada, preguntá si tiene arcadas sin vomitar.
- Dos o tres preguntas más y listo. La gente que escribe esto está preocupada: no la hagas completar un formulario.`;

type Mensaje = { rol: 'socio' | 'kumi'; texto: string };

type Cuerpo = {
  modo?: 'charla';
  mensajes?: Mensaje[];
  conocido?: Record<string, unknown>;
  ficha?: Record<string, unknown>;
  petId?: string | null;
  consentimiento?: boolean;
} & Record<string, unknown>;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Entrá a tu cuenta para usar KUMI.' }, { status: 401 });

  /*
   * KUMI es del plan. Decisión del club (18/11/2026).
   *
   * Se corta ACÁ y no solo escondiendo la burbuja: un botón que no se ve no es un
   * límite —la ruta queda igual de abierta para cualquiera que sepa su nombre— y
   * cada vuelta de conversación le cuesta plata al club de verdad.
   *
   * El admin pasa igual, con el mismo criterio que el resto del proyecto: no es
   * socio y su acceso no depende de la cuota (ver los `or is_admin()` de la RLS y
   * el comentario del middleware). Sin esto, los únicos que necesitan probar KUMI
   * serían justo los únicos que no pueden usarlo.
   */
  const { data: perfil } = await supabase.from('profiles').select('role, paid_until').eq('id', auth.user.id).single();
  const alDia = !!perfil?.paid_until && perfil.paid_until >= hoyISO();
  if (!alDia && perfil?.role !== 'admin') {
    return NextResponse.json({ error: 'KUMI viene con el plan.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Cuerpo | null;
  if (!body?.consentimiento) {
    return NextResponse.json({ error: 'Falta aceptar el deslinde.' }, { status: 400 });
  }
  const petId = typeof body.petId === 'string' ? body.petId : null;

  return body.modo === 'charla'
    ? charla(body, auth.user.id, petId)
    : formulario(body, auth.user.id, petId);
}

/* ─────────────────────────── el camino sin modelo ─────────────────────────── */

/**
 * El guion de pastillas: la pantalla ya preguntó todo y manda los hechos.
 * Es el camino de siempre y el piso al que se cae cuando la IA no está.
 */
async function formulario(body: Cuerpo, memberId: string, petId: string | null) {
  const especie = unaEspecie(body.especie);
  if (!especie) return NextResponse.json({ error: 'Decinos qué animal es.' }, { status: 400 });

  const hechos = hechosDe(body, especie);
  const veredicto = evaluarTriaje(hechos);
  await guardar(memberId, hechos, veredicto, [], petId);
  return NextResponse.json({ tipo: 'veredicto', veredicto, accion: ACCION[veredicto.nivel] });
}

/* ─────────────────────────── el camino con modelo ─────────────────────────── */

/** Lo que la pantalla necesita para caer al formulario sin perder lo ya dicho. */
const aFormulario = (error: string, hechos: HechosTriaje | null = null) =>
  NextResponse.json({ tipo: 'formulario', error, hechos });

async function charla(body: Cuerpo, memberId: string, petId: string | null) {
  const mensajes = (body.mensajes ?? []).filter((m) => m && typeof m.texto === 'string').slice(-20);
  if (mensajes.length === 0) return NextResponse.json({ error: 'Contanos qué le pasa.' }, { status: 400 });

  /* Lo que ya se sabe por la ficha de la mascota: especie, edad exacta en meses y
     peso. Se le pasa al modelo para que no vuelva a preguntar lo que Kumo ya
     tiene, y se conserva aunque el modelo no lo repita en la ficha. */
  const conocido = (body.conocido ?? {}) as Record<string, unknown>;
  const especieConocida = unaEspecie(conocido.especie);

  /* Lo que ya se juntó en las vueltas anteriores. Viaja por el cliente y se
     filtra contra las listas conocidas como todo lo demás. Sirve solo para el
     atajo, que es el único momento en que no se le pregunta al modelo. */
  const previa = (body.ficha ?? {}) as Record<string, unknown>;

  /* El relato es lo que la persona escribió, entero y con sus palabras. Es lo
     que va a leer un veterinario si revisa la consulta, y es sobre lo que corre
     la red de frases rojas: un resumen de una línea del modelo perdería justo la
     frase que importa. El hilo completo igual se guarda aparte. */
  const narracion = mensajes.filter((m) => m.rol === 'socio').map((m) => m.texto).join('. ').slice(0, 2000);

  /* El atajo de emergencia: antes del modelo, antes de la clave, antes de todo.
     Si lo que escribió ya dice "no respira", no hay nada que conversar. */
  const rojas = senalesEnTexto(narracion);
  if (rojas.length > 0) {
    /* Con lo que ya se había juntado, no desde cero. Si la señal roja aparece en
       la quinta vuelta, tirar las cuatro anteriores deja una constancia sin
       síntomas, sin horas y sin relato justo en la consulta más grave de todas. */
    const base = hechosDe({ ...previa, ...conocido }, especieConocida ?? unaEspecie(previa.especie) ?? 'otro');
    const hechos: HechosTriaje = {
      ...base,
      senales: [...new Set([...(base.senales ?? []), ...rojas])],
      relato: narracion,
    };
    const veredicto = evaluarTriaje(hechos);
    await guardar(memberId, hechos, veredicto, mensajes, petId);
    return NextResponse.json({ tipo: 'veredicto', veredicto, accion: ACCION[veredicto.nivel] });
  }

  if (!KEY) {
    console.warn('[kumi] sin ANTHROPIC_API_KEY: se cae al formulario');
    return aFormulario('');
  }
  if (!pasaElTope(memberId)) {
    return aFormulario('Hiciste muchas consultas seguidas. Seguimos con las preguntas de siempre.');
  }

  const vueltas = mensajes.filter((m) => m.rol === 'socio').length;
  const yaSabe = resumenDeLoConocido(conocido, especieConocida);

  const client = new Anthropic({ apiKey: KEY });
  let respuesta: Anthropic.Message;
  try {
    respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 1500,
      output_config: { effort: ESFUERZO },
      system: [
        { type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } },
        ...(yaSabe ? [{ type: 'text' as const, text: yaSabe }] : []),
        ...(vueltas >= MAX_VUELTAS
          ? [{ type: 'text' as const, text: 'Ya preguntaste bastante: cerrá con listo en true usando lo que tengas.' }]
          : []),
      ],
      tools: [FICHA],
      // Sin `tool_choice` forzado: en este modelo devuelve 400. La instrucción de
      // llamar a la herramienta en cada respuesta va en el system.
      messages: aHistoria(mensajes),
    });
  } catch (e) {
    const detalle = e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e);
    console.error('[kumi]', detalle);
    return aFormulario('');
  }

  /* Una negativa del clasificador de seguridad llega con 200 y stop_reason
     "refusal": hay que mirarlo ANTES de leer el contenido. */
  if (respuesta.stop_reason === 'refusal') return aFormulario('');

  const suelto = respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const llamada = respuesta.content.find((b) => b.type === 'tool_use' && b.name === 'registrar_hechos');
  const crudo = (llamada && llamada.type === 'tool_use' ? llamada.input : null) as Record<string, unknown> | null;

  /* Sin ficha no hay nada que evaluar, pero sí algo que preguntar: el modelo
     igual escribió. `auto` no garantiza la llamada, así que esto pasa. */
  if (!crudo) {
    return NextResponse.json({ tipo: 'pregunta', texto: suelto || '¿Me contás un poco más?' });
  }
  const dicho = texto(crudo.mensaje, 600) || suelto;

  /* Lo que sabe Kumo gana sobre lo que dedujo el modelo: la edad de la ficha es
     la fecha de nacimiento cargada, no un rango inferido de una charla. */
  const hechos: HechosTriaje = {
    ...hechosDe(crudo, especieConocida ?? unaEspecie(crudo.especie) ?? 'otro'),
    edadMeses: numero(conocido.edadMeses) ?? numero(crudo.edadMeses),
    pesoKg: numero(conocido.pesoKg) ?? numero(crudo.pesoKg),
    relato: narracion || texto(crudo.relato),
  };

  const cierra = crudo.listo === true || vueltas >= MAX_VUELTAS;
  if (!cierra) {
    return NextResponse.json({ tipo: 'pregunta', texto: dicho || '¿Me contás un poco más?', hechos });
  }

  // Tiene lo suficiente: ahora decide el código, no el modelo.
  const veredicto = evaluarTriaje(hechos);
  await guardar(memberId, hechos, veredicto, mensajes, petId);
  return NextResponse.json({ tipo: 'veredicto', veredicto, accion: ACCION[veredicto.nivel], texto: dicho });
}

/**
 * El hilo de la pantalla, pasado a lo que la API acepta.
 *
 * Dos arreglos que no son cosméticos: el hilo EMPIEZA con una burbuja de KUMI
 * —el saludo, o la pregunta de por cuál mascota—, y la API exige que el primer
 * mensaje sea de la persona; y dos burbujas seguidas del mismo lado también son
 * un 400. Las dos cosas pasan en el uso normal, así que se normaliza acá en vez
 * de confiar en que la pantalla las evite.
 */
function aHistoria(mensajes: Mensaje[]): Anthropic.MessageParam[] {
  const salida: Anthropic.MessageParam[] = [];
  for (const m of mensajes) {
    const role = m.rol === 'kumi' ? 'assistant' : 'user';
    // Nada antes del primer mensaje de la persona.
    if (salida.length === 0 && role === 'assistant') continue;
    const previo = salida[salida.length - 1];
    if (previo && previo.role === role) {
      previo.content = `${previo.content as string}\n${m.texto}`;
      continue;
    }
    salida.push({ role, content: m.texto });
  }
  return salida;
}

/** Lo que Kumo ya sabe, en una línea para el system. Vacío si no sabe nada. */
function resumenDeLoConocido(conocido: Record<string, unknown>, especie: Especie | null): string {
  const partes: string[] = [];
  if (especie) partes.push(`es un ${ESPECIES.find((e) => e.id === especie)?.label.toLowerCase() ?? especie}`);
  const meses = numero(conocido.edadMeses);
  if (meses != null) partes.push(`tiene ${meses} meses`);
  const kg = numero(conocido.pesoKg);
  if (kg != null) partes.push(`pesa ${kg} kg`);
  const nombre = texto(conocido.nombre, 40);
  if (nombre) partes.push(`se llama ${nombre}`);
  return partes.length > 0
    ? `DE ESTA MASCOTA YA SABÉS: ${partes.join(', ')}. No preguntes nada de eso; usalo al hablar.`
    : '';
}

/* ──────────────────────────────── constancia ──────────────────────────────── */

/**
 * Deja la constancia. Si falla, la persona igual recibe su orientación: perder
 * el registro es malo, no dársela es peor.
 *
 * Se guardan las REGLAS que produjeron el veredicto, no solo el veredicto. Sin
 * eso no hay forma de auditar un triaje ni de medir qué reglas se disparan
 * cuando un veterinario las revise.
 */
async function guardar(
  memberId: string,
  hechos: HechosTriaje,
  veredicto: ReturnType<typeof evaluarTriaje>,
  mensajes: Mensaje[],
  petId: string | null,
) {
  const { error } = await getServiceClient().from('triage_consultas').insert({
    member_id: memberId,
    pet_id: petId,
    especie: hechos.especie,
    edad_meses: hechos.edadMeses ?? null,
    peso_kg: hechos.pesoKg ?? null,
    horas_evolucion: hechos.horasDeEvolucion ?? null,
    senales: hechos.senales ?? [],
    toxicos: hechos.toxicos ?? [],
    sintomas: hechos.sintomas ?? [],
    relato: hechos.relato || null,
    fotos: 0,
    nivel: veredicto.nivel,
    motivos: veredicto.motivos,
    reglas: veredicto.reglas,
    mensajes,
    deslinde_version: DESLINDE_VERSION,
    consentimiento_en: new Date().toISOString(),
  });
  if (error) console.error('[kumi] no se pudo guardar la consulta:', error.message);
}
