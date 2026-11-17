import { NextResponse } from 'next/server';
import {
  ACCION, ANTECEDENTES, DESLINDE_VERSION, ESPECIES, SENALES_URGENCIA, SINTOMAS, TOXICOS,
  evaluarTriaje, type Especie, type HechosTriaje,
} from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * KUMI · evaluar una consulta de triaje.
 *
 * Sin IA, a propósito y por ahora: la pantalla pregunta con un formulario y esta
 * ruta resuelve con `evaluarTriaje` de @kumo/shared. Que no haya modelo no le
 * saca nada al triaje —las reglas SIEMPRE fueron las que deciden— y le saca tres
 * cosas: el costo por consulta, la dependencia de un servicio de terceros para
 * una respuesta de urgencia, y la foto de la mascota viajando a otra empresa.
 *
 * **La evaluación corre acá y no en el navegador** aunque la función sea pura y
 * podría correr en el cliente. Dos razones: el veredicto que se guarda tiene que
 * ser el que produjo el código del servidor y no uno que llegó armado desde
 * afuera, y el registro de la consulta se escribe en el mismo lugar donde se
 * decide. Un triaje que se puede dictar desde el cliente no es auditable.
 */

type Cuerpo = {
  especie?: string;
  edadMeses?: number | null;
  pesoKg?: number | null;
  horasDeEvolucion?: number | null;
  senales?: string[];
  toxicos?: string[];
  sintomas?: string[];
  animo?: string | null;
  comida?: string | null;
  pujaSinOrinar?: boolean;
  arcadasSinVomitar?: boolean;
  relato?: string;
  antecedente?: string | null;
  petId?: string | null;
  consentimiento?: boolean;
};

const texto = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const lista = (v: unknown, permitidos?: readonly string[]) =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string').filter((x) => !permitidos || permitidos.includes(x)).slice(0, 40)
    : [];
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Entrá a tu cuenta para usar KUMI.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Cuerpo | null;
  if (!body?.consentimiento) {
    return NextResponse.json({ error: 'Falta aceptar el deslinde.' }, { status: 400 });
  }

  const especie = ESPECIES.map((e) => e.id).includes(body.especie as Especie) ? (body.especie as Especie) : null;
  if (!especie) return NextResponse.json({ error: 'Decinos qué animal es.' }, { status: 400 });

  /* Las listas se filtran contra las que el triaje conoce. No es paranoia: lo que
     llegue acá entra a una decisión clínica, y una señal con un nombre que no
     existe se perdería en silencio en vez de escalar. */
  const hechos: HechosTriaje = {
    especie,
    edadMeses: numero(body.edadMeses),
    pesoKg: numero(body.pesoKg),
    horasDeEvolucion: numero(body.horasDeEvolucion),
    senales: lista(body.senales, SENALES),
    toxicos: lista(body.toxicos, TOXICOS_OK),
    sintomas: lista(body.sintomas, SINTOMAS_OK),
    animo: ANIMOS.includes(body.animo as string) ? (body.animo as HechosTriaje['animo']) : null,
    comida: COMIDAS.includes(body.comida as string) ? (body.comida as HechosTriaje['comida']) : null,
    pujaSinOrinar: body.pujaSinOrinar === true,
    arcadasSinVomitar: body.arcadasSinVomitar === true,
    relato: texto(body.relato),
    antecedente: ANTECEDENTES.some((a) => a.id === body.antecedente) ? (body.antecedente as HechosTriaje['antecedente']) : null,
  };

  const veredicto = evaluarTriaje(hechos);

  const { error } = await getServiceClient().from('triage_consultas').insert({
    member_id: auth.user.id,
    pet_id: typeof body.petId === 'string' ? body.petId : null,
    especie: hechos.especie,
    edad_meses: hechos.edadMeses,
    peso_kg: hechos.pesoKg,
    horas_evolucion: hechos.horasDeEvolucion,
    senales: hechos.senales ?? [],
    toxicos: hechos.toxicos ?? [],
    sintomas: hechos.sintomas ?? [],
    relato: hechos.relato || null,
    fotos: 0,
    nivel: veredicto.nivel,
    motivos: veredicto.motivos,
    reglas: veredicto.reglas,
    mensajes: [],
    deslinde_version: DESLINDE_VERSION,
    consentimiento_en: new Date().toISOString(),
  });
  // Si no se pudo guardar, la persona igual recibe su orientación: perder el
  // registro es malo, no dársela es peor.
  if (error) console.error('[kumi] no se pudo guardar la consulta:', error.message);

  return NextResponse.json({ veredicto, accion: ACCION[veredicto.nivel] });
}

/* Las listas permitidas, acá abajo para no tapar la lógica de arriba. */
const SENALES: readonly string[] = SENALES_URGENCIA;
const TOXICOS_OK: readonly string[] = TOXICOS;
const SINTOMAS_OK: readonly string[] = SINTOMAS;
const ANIMOS = ['normal', 'decaido', 'muy_decaido'];
const COMIDAS = ['normal', 'come_menos', 'no_come', 'no_toma_agua'];
