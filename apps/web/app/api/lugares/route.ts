import { NextResponse } from 'next/server';
import { buscarDirecciones, buscarLocalidades, esCABA } from '@/lib/lugares';

/**
 * El buscador de direcciones que usan los campos de domicilio.
 *
 * Es **pública a propósito**: el alta pasa por acá y ahí todavía no hay sesión —
 * pedir token sería pedirle al que se está registrando algo que no tiene. No expone
 * ningún dato del club: es un pasamanos al callejero oficial argentino.
 *
 * Pasa por el servidor y no se llama a Georef desde el navegador por tres razones:
 * el domicilio de alguien no viaja desde su IP a un tercero, se puede cachear entre
 * todos los que tipean lo mismo, y si algún día hay que cambiar de proveedor se
 * cambia en un archivo.
 */

/*
 * Caché de consultas y freno por IP.
 *
 * Un campo con autocompletado son varias consultas por persona, y esto es un
 * servicio público del Estado: la cortesía mínima es no preguntarle dos veces lo
 * mismo. La caché es en memoria y por instancia —en serverless no hay una sola— así
 * que es un amortiguador, no una garantía; alcanza porque los prefijos que la gente
 * tipea se repiten muchísimo ("av c", "av ca", "av cab"...).
 */
const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;
const cache = new Map<string, { cuando: number; datos: unknown }>();

const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 40;
const porIp = new Map<string, { desde: number; cuantas: number }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const provincia = (url.searchParams.get('provincia') ?? '').trim().slice(0, 60);
  /* Dos búsquedas distintas en la misma ruta: una dirección es una calle con
     altura, una zona es un área de cobertura ('Palermo', 'Tandil'). Georef tiene un
     endpoint para cada cosa y preguntarle a uno lo del otro no devuelve nada. */
  const zona = url.searchParams.get('tipo') === 'localidad';
  /*
   * La localidad es la pista que hace la diferencia. Con la provincia sola, "9 de
   * julio 250" en Buenos Aires devuelve Bahía Blanca y Coronel Dorrego y Tandil no
   * entra en la lista; con la localidad, contesta una sola dirección y es la correcta.
   *
   * En CABA se ignora a propósito: ahí lo que se guarda como localidad es el BARRIO
   * ("Belgrano"), el callejero no conoce barrios como localidad y filtrar por eso no
   * encuentra nada. La ciudad tampoco hace falta, porque hay una sola.
   */
  const enCABA = esCABA(provincia);
  const localidad = enCABA ? '' : (url.searchParams.get('localidad') ?? '').trim().slice(0, 80);

  // Menos de esto no es un lugar, es alguien empezando a escribir. Los barrios son
  // más cortos que las calles ('Boca', 'Once'), así que ahí el mínimo es menor.
  if (q.length < (zona ? 3 : 4)) return NextResponse.json({ sugerencias: [] });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'sin-ip';
  const ahora = Date.now();
  const marca = porIp.get(ip);
  if (!marca || ahora - marca.desde > VENTANA_MS) {
    porIp.set(ip, { desde: ahora, cuantas: 1 });
  } else if (marca.cuantas >= MAX_POR_VENTANA) {
    // 200 y lista vacía en vez de 429: esto alimenta un campo de texto, y un error
    // ahí solo lograría que la pantalla muestre un cartel rojo por escribir rápido.
    return NextResponse.json({ sugerencias: [] });
  } else {
    marca.cuantas += 1;
  }

  const clave = `${zona ? 'z' : 'd'}|${provincia}|${localidad}|${q.toLowerCase()}`;
  const guardada = cache.get(clave);
  if (guardada && ahora - guardada.cuando < CACHE_MS) {
    return NextResponse.json(guardada.datos);
  }

  let sugerencias;
  if (zona) {
    sugerencias = await buscarLocalidades(q, provincia || undefined);
  } else {
    sugerencias = await buscarDirecciones(q, provincia || undefined, localidad || undefined);
    /* La pista de localidad puede venir escrita de una forma que el callejero no
       tiene ("Todo CABA", "Zona Sur GBA", un barrio) y ahí filtra de más. Si no
       encontró nada, se vuelve a preguntar sin ella: es mejor una lista amplia que
       una lista vacía. */
    if (localidad && sugerencias.length === 0) {
      sugerencias = await buscarDirecciones(q, provincia || undefined);
    }
  }
  const datos = { sugerencias };

  // Se guarda incluso la lista vacía: si Georef no conoce esa calle, tampoco la va a
  // conocer en el próximo tecleo.
  if (cache.size >= CACHE_MAX) {
    const masVieja = cache.keys().next().value;
    if (masVieja) cache.delete(masVieja);
  }
  cache.set(clave, { cuando: ahora, datos });

  return NextResponse.json(datos);
}
