import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';
import { esDestino } from '@kumo/shared';
import { mandarPush, tokensDeAudiencia } from '@/lib/push';

/**
 * El club manda un aviso push a una audiencia.
 *
 * Antes el panel guardaba la fila en `push_notifications` y decía "Enviadas": el
 * aviso no salía a ningún teléfono. Ahora esta ruta resuelve los tokens de la
 * audiencia, los manda por la Expo Push API y guarda el resultado, así "Enviadas"
 * puede decir a cuántos llegó de verdad.
 *
 * Está en el servidor porque los tokens de los demás socios no se pueden leer
 * desde el navegador (la RLS solo deja ver los propios) y porque resolver la
 * audiencia es una consulta que no debería depender de lo que mande el cliente.
 *
 * Desde el 16/09/2026 el aviso tiene DOS destinos y el club elige: el push al
 * teléfono y la campanita de adentro de la app. Antes sólo existía el push, y un
 * aviso que el socio no veía en el momento se perdía para siempre — no quedaba
 * en ningún lado, porque la campanita se arma sola con los hechos del socio.
 *
 * El push sale desde acá; la campanita no "se manda": queda marcada en la fila y
 * cada app la lee con `avisos_del_club`, que resuelve la audiencia del lado del
 * servidor.
 */
export async function POST(req: Request) {
  const { titulo, cuerpo, audiencia, enPush, enCampanita, vigenteHasta, destino } = (await req.json()) as {
    titulo?: string; cuerpo?: string; audiencia?: string;
    enPush?: boolean; enCampanita?: boolean; vigenteHasta?: string; destino?: string;
  };
  if (!titulo?.trim()) return NextResponse.json({ error: 'Falta el título.' }, { status: 400 });
  /* Un aviso sin destino no es un aviso. El panel no deja llegar hasta acá con
     los dos desmarcados, pero esto no depende de que el panel se porte bien. */
  const aPush = enPush !== false;
  const aCampanita = enCampanita === true;
  if (!aPush && !aCampanita) return NextResponse.json({ error: 'Elegí al menos un lugar donde mostrarlo.' }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede enviar avisos.' }, { status: 403 });

  const aud = audiencia?.trim() || 'Todos los socios';
  /* Sin push no hay a quién resolverle los tokens: un aviso que va sólo a la
     campanita no toca la Expo Push API ni cuenta dispositivos. */
  const tokens = aPush ? await tokensDeAudiencia(aud) : [];
  /*
   * A dónde lleva el aviso al tocarlo.
   *
   * Se valida contra la lista compartida en vez de pasar lo que venga: esto viaja
   * adentro del push y del otro lado hay una app que navega con eso. Sin destino
   * válido no se manda ninguno, y tocar el push sólo abre la app — que es lo que
   * hacía siempre, porque acá iba 'inicio' clavado y eso no es una pantalla a la
   * que la app sepa ir.
   */
  const aDonde = esDestino(destino) ? destino : null;
  const r = aPush
    ? await mandarPush(tokens, titulo.trim(), (cuerpo ?? '').trim(), aDonde ? { pantalla: aDonde } : {})
    : { entregados: 0, fallados: 0, detalle: [] as string[] };

  // Queda registrado igual si no llegó a nadie: el club tiene que poder ver qué
  // intentó mandar, no solo lo que salió bien.
  const svc = getServiceClient();
  await svc.from('push_notifications').insert({
    title: titulo.trim(),
    body: (cuerpo ?? '').trim(),
    audience: aud,
    sent_at: new Date().toISOString(),
    delivered: r.entregados,
    failed: r.fallados,
    en_push: aPush,
    en_campanita: aCampanita,
    /* Sólo tiene sentido si va a la campanita: el push no "vence", ya salió. */
    vigente_hasta: aCampanita ? (vigenteHasta || null) : null,
    /* Se guarda aunque vaya sólo al push: es lo que hace que el mismo aviso se
       comporte igual en los dos canales. */
    destino: aDonde,
  });

  return NextResponse.json({ ok: true, ...r, dispositivos: tokens.length, aPush, aCampanita });
}
