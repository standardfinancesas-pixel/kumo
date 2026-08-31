import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';
import { mandarPush, CON_ACCESO } from '@/lib/push';

/**
 * El resumen diario de "me gusta" del foro.
 *
 * Los "me gusta" NO se empujan en el momento, a diferencia de las respuestas
 * (que salen por `/api/avisos`). El motivo es simple: una publicación que junta
 * doce me gusta produciría doce notificaciones seguidas, y esa es la forma más
 * rápida de que alguien apague los avisos de Kumo para siempre. Acá se manda uno
 * por publicación y por día: "A 12 personas les gustó tu publicación".
 *
 * Corre a las 22:00 UTC, o sea 19:00 de Buenos Aires: al final del día, cuando el
 * foro ya tuvo movimiento, y sin pisarse con el recordatorio de vacunas de la
 * mañana. La agenda vive en `apps/web/vercel.json`, que es JSON estricto y no
 * admite comentarios —el schema de Vercel rechaza hasta una clave "//"—, así que
 * el porqué del horario se explica acá.
 *
 * La ventana es de 24 horas porque el cron corre una vez por día. Si algún día
 * corre dos veces, el peor caso es un aviso repetido — no se pierde ninguno, que
 * es el error que sí importaría.
 *
 * No hay tabla de "ya avisado" como en vacunas: ahí la marca hace falta porque el
 * hecho (una vacuna que vence) sigue siendo verdad todos los días durante un mes.
 * Un "me gusta" ocurre una sola vez y sale de la ventana solo.
 */
export async function GET(req: Request) {
  /* Mismo control que el cron de vacunas: sin secreto, cualquiera que conozca la
     URL hace sonar el teléfono de todos los socios. */
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Falta CRON_SECRET en el entorno.' }, { status: 500 });
    }
  } else if (req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const svc = getServiceClient();
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  /*
   * Los me gusta del día a publicaciones y a respuestas, con el dueño de lo
   * likeado. Se piden por separado porque son dos tablas, y se juntan por
   * (dueño + publicación): al socio le importa "mi publicación gustó", no si el
   * me gusta cayó en el texto original o en algo que comentó después.
   */
  const [{ data: enPosts }, { data: enRespuestas }] = await Promise.all([
    svc
      .from('post_likes')
      .select('member_id, created_at, community_posts!inner(id, title, author_id)')
      .gte('created_at', desde),
    svc
      .from('answer_likes')
      .select('member_id, created_at, community_answers!inner(author_id, community_posts!inner(id, title))')
      .gte('created_at', desde),
  ]);

  /** dueño → publicación → quiénes le dieron me gusta (sin repetir personas). */
  const porDueno = new Map<string, Map<string, { titulo: string; personas: Set<string> }>>();
  const sumar = (dueno: string | null, postId: string, titulo: string, quien: string) => {
    // Darse me gusta solo no cuenta, y sin dueño no hay a quién avisarle.
    if (!dueno || dueno === quien) return;
    const posts = porDueno.get(dueno) ?? new Map();
    const acum = posts.get(postId) ?? { titulo, personas: new Set<string>() };
    acum.personas.add(quien);
    posts.set(postId, acum);
    porDueno.set(dueno, posts);
  };

  for (const l of enPosts ?? []) {
    const p = Array.isArray(l.community_posts) ? l.community_posts[0] : l.community_posts;
    if (p) sumar(p.author_id as string | null, p.id as string, p.title as string, l.member_id as string);
  }
  for (const l of enRespuestas ?? []) {
    const a = Array.isArray(l.community_answers) ? l.community_answers[0] : l.community_answers;
    const p = a && (Array.isArray(a.community_posts) ? a.community_posts[0] : a.community_posts);
    if (a && p) sumar(a.author_id as string | null, p.id as string, p.title as string, l.member_id as string);
  }

  if (porDueno.size === 0) {
    console.log('[cron/foro-likes] sin me gusta en las últimas 24 h');
    return NextResponse.json({ ok: true, avisados: 0 });
  }

  /* Solo a quien tiene acceso: a un socio suspendido o dado de baja no se le
     manda nada, igual que en el resto de los avisos. */
  const { data: conAcceso } = await svc
    .from('profiles')
    .select('id')
    .in('id', [...porDueno.keys()])
    .in('status', CON_ACCESO);

  let avisados = 0;
  for (const { id: dueno } of conAcceso ?? []) {
    const posts = porDueno.get(dueno as string);
    if (!posts) continue;
    const { data: tokens } = await svc.from('push_tokens').select('token').eq('member_id', dueno);
    if (!tokens?.length) continue;

    for (const { titulo, personas } of posts.values()) {
      const n = personas.size;
      await mandarPush(
        tokens.map((t) => t.token as string),
        'Le gustó lo que escribiste',
        n === 1 ? `A alguien le gustó tu publicación "${titulo}".` : `A ${n} personas les gustó tu publicación "${titulo}".`,
        { pantalla: 'foros' },
      );
      avisados++;
    }
  }

  console.log(`[cron/foro-likes] ${avisados} avisos a ${conAcceso?.length ?? 0} socios`);
  return NextResponse.json({ ok: true, avisados });
}
