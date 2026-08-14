import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';
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
 */
export async function POST(req: Request) {
  const { titulo, cuerpo, audiencia } = (await req.json()) as { titulo?: string; cuerpo?: string; audiencia?: string };
  if (!titulo?.trim()) return NextResponse.json({ error: 'Falta el título.' }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede enviar avisos.' }, { status: 403 });

  const aud = audiencia?.trim() || 'Todos los socios';
  const tokens = await tokensDeAudiencia(aud);
  const r = await mandarPush(tokens, titulo.trim(), (cuerpo ?? '').trim(), { pantalla: 'inicio' });

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
  });

  return NextResponse.json({ ok: true, ...r, dispositivos: tokens.length });
}
