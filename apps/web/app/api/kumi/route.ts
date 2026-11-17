import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import {
  ACCION, DESLINDE_VERSION, ESPECIES, MAX_FOTOS, SENALES_URGENCIA, SINTOMAS, TOXICOS,
  evaluarTriaje, senalesEnTexto, type HechosTriaje,
} from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * KUMI · una vuelta de la conversación de triaje.
 *
 * El reparto de trabajo es la decisión de diseño de todo esto, y no es un
 * detalle de implementación:
 *
 * - **El modelo pregunta y ordena.** Entiende "desde anoche está tirada y no
 *   come", pide lo que falta de a una cosa por vez y llena una ficha de hechos.
 * - **El código decide.** `evaluarTriaje` de @kumo/shared mira esos hechos y
 *   dice guardia, videoconsulta o casa. El modelo NO emite el veredicto, ni
 *   siquiera lo insinúa: el texto que ve la persona sale de `ACCION`.
 *
 * Y hay un atajo antes de todo: si en lo que la persona escribió aparece una
 * frase roja —"no respira", "convulsionó", "comió veneno"—, esta ruta contesta
 * guardia **sin llamar al modelo**. Es gratis, es instantáneo y sigue andando si
 * la API de Anthropic está caída. La emergencia es justo el caso donde no se
 * puede depender de un servicio de terceros.
 */

const KEY = process.env.ANTHROPIC_API_KEY;
/* Claude Opus 5.5. El esfuerzo va explícito porque en este modelo el valor por
   defecto es `medium`: dejarlo implícito es elegir sin decirlo. */
const MODELO = 'claude-opus-5-5';

/** Tope por socio y por hora. Cada consulta cuesta plata de verdad. */
const TOPE_POR_HORA = 12;
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
      horasDeEvolucion: { type: ['integer', 'null'], description: 'Hace cuántas horas empezó.' },
      senales: { type: 'array', items: { type: 'string', enum: [...SENALES_URGENCIA] } },
      toxicos: { type: 'array', items: { type: 'string', enum: [...TOXICOS] } },
      sintomas: { type: 'array', items: { type: 'string', enum: [...SINTOMAS] } },
      animo: { type: ['string', 'null'], enum: ['normal', 'decaido', 'muy_decaido', null] },
      comida: { type: ['string', 'null'], enum: ['normal', 'come_menos', 'no_come', 'no_toma_agua', null] },
      pujaSinOrinar: { type: 'boolean', description: 'Hace fuerza para orinar y no sale nada.' },
      arcadasSinVomitar: { type: 'boolean', description: 'Arcadas sin llegar a vomitar.' },
      relato: { type: 'string', description: 'Lo que contó la persona, resumido en una línea.' },
      listo: { type: 'boolean', description: 'true cuando ya alcanza para orientar.' },
    },
    required: [
      'especie', 'edadMeses', 'pesoKg', 'horasDeEvolucion', 'senales', 'toxicos',
      'sintomas', 'animo', 'comida', 'pujaSinOrinar', 'arcadasSinVomitar', 'relato', 'listo',
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
- Preguntá explícitamente por las señales de alarma si todavía no surgieron.
- Si es macho y hay algo urinario, preguntá si hace fuerza sin que salga nada.
- Si es un perro grande con la panza hinchada, preguntá si tiene arcadas sin vomitar.
- Dos o tres preguntas más y listo. La gente que escribe esto está preocupada: no la hagas completar un formulario.`;

type Mensaje = { rol: 'socio' | 'kumi'; texto: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Entrá a tu cuenta para usar KUMI.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { mensajes?: Mensaje[]; fotos?: string[]; consentimiento?: boolean; petId?: string | null }
    | null;
  if (!body?.consentimiento) {
    return NextResponse.json({ error: 'Falta aceptar el deslinde.' }, { status: 400 });
  }
  const mensajes = (body.mensajes ?? []).filter((m) => m && typeof m.texto === 'string').slice(-20);
  if (mensajes.length === 0) return NextResponse.json({ error: 'Contanos qué le pasa.' }, { status: 400 });

  const ultimo = [...mensajes].reverse().find((m) => m.rol === 'socio')?.texto ?? '';

  /* El atajo de emergencia: antes del modelo, antes de la clave, antes de todo.
     Si lo que escribió ya dice "no respira", no hay nada que conversar. */
  const rojas = senalesEnTexto(ultimo);
  if (rojas.length > 0) {
    const hechos: HechosTriaje = { especie: 'otro', senales: rojas, relato: ultimo };
    const veredicto = evaluarTriaje(hechos);
    await guardar(auth.user.id, hechos, veredicto, mensajes, body.fotos?.length ?? 0, body.petId ?? null);
    return NextResponse.json({ tipo: 'veredicto', veredicto, accion: ACCION[veredicto.nivel] });
  }

  if (!KEY) {
    console.warn('[kumi] sin ANTHROPIC_API_KEY: la conversación no puede seguir');
    return NextResponse.json(
      { error: 'KUMI no está disponible en este momento. Si es urgente, andá a una guardia.' },
      { status: 503 },
    );
  }
  if (!pasaElTope(auth.user.id)) {
    return NextResponse.json({ error: 'Hiciste muchas consultas seguidas. Probá de nuevo en un rato.' }, { status: 429 });
  }

  const fotos = (body.fotos ?? []).slice(0, MAX_FOTOS).filter((f) => typeof f === 'string' && f.startsWith('data:image/'));

  const historia: Anthropic.MessageParam[] = mensajes.map((m, i) => {
    const esUltimo = i === mensajes.length - 1;
    if (m.rol === 'kumi') return { role: 'assistant', content: m.texto };
    // Las fotos van con el último mensaje del socio, que es el que las trae.
    if (!esUltimo || fotos.length === 0) return { role: 'user', content: m.texto };
    return {
      role: 'user',
      content: [
        ...fotos.map((f): Anthropic.ImageBlockParam => {
          const [cabecera, datos] = f.split(',');
          const tipo = cabecera?.slice(5).split(';')[0] ?? 'image/jpeg';
          return { type: 'image', source: { type: 'base64', media_type: tipo as 'image/jpeg', data: datos ?? '' } };
        }),
        { type: 'text', text: m.texto },
      ],
    };
  });

  const client = new Anthropic({ apiKey: KEY });
  let respuesta: Anthropic.Message;
  try {
    respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 1500,
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
      tools: [FICHA],
      // Sin `tool_choice` forzado: en este modelo devuelve 400. La instrucción de
      // llamar a la herramienta en cada respuesta va en el system.
      messages: historia,
    });
  } catch (e) {
    const detalle = e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e);
    console.error('[kumi]', detalle);
    return NextResponse.json(
      { error: 'No pudimos seguir la consulta. Si es urgente, andá a una guardia.' },
      { status: 502 },
    );
  }

  /* Una negativa del clasificador de seguridad llega con 200 y stop_reason
     "refusal": hay que mirarlo ANTES de leer el contenido. */
  if (respuesta.stop_reason === 'refusal') {
    return NextResponse.json(
      { error: 'No pudimos procesar esa consulta. Si es urgente, andá a una guardia.' },
      { status: 422 },
    );
  }

  const texto = respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const llamada = respuesta.content.find((b) => b.type === 'tool_use' && b.name === 'registrar_hechos');
  const hechos = (llamada && llamada.type === 'tool_use' ? llamada.input : null) as (HechosTriaje & { listo?: boolean }) | null;

  if (!hechos?.listo) {
    return NextResponse.json({ tipo: 'pregunta', texto: texto || '¿Me contás un poco más?', hechos });
  }

  // Tiene lo suficiente: ahora decide el código, no el modelo.
  const veredicto = evaluarTriaje({ ...hechos, relato: hechos.relato || ultimo });
  await guardar(auth.user.id, hechos, veredicto, mensajes, fotos.length, body.petId ?? null);
  return NextResponse.json({ tipo: 'veredicto', veredicto, accion: ACCION[veredicto.nivel], texto });
}

/** Deja la constancia. Si falla, la persona igual recibe su orientación: perder
 *  el registro es malo, no dársela es peor. */
async function guardar(
  memberId: string,
  hechos: HechosTriaje,
  veredicto: ReturnType<typeof evaluarTriaje>,
  mensajes: Mensaje[],
  fotos: number,
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
    relato: hechos.relato ?? null,
    fotos,
    nivel: veredicto.nivel,
    motivos: veredicto.motivos,
    reglas: veredicto.reglas,
    mensajes,
    deslinde_version: DESLINDE_VERSION,
    consentimiento_en: new Date().toISOString(),
  });
  if (error) console.error('[kumi] no se pudo guardar la consulta:', error.message);
}
