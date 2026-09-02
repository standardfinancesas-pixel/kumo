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
 * por día y por cosa escrita: "A 12 personas les gustó tu publicación".
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

  /**
   * dueño → (publicación + dónde cayó el me gusta) → quiénes se lo dieron.
   *
   * La clave lleva el DÓNDE y no sólo la publicación, por dos razones que son la
   * misma: en un hilo podés ser el autor de la publicación y además haber
   * respondido. Agrupando sólo por publicación, un me gusta a tu texto original y
   * otro a tu comentario se sumaban en un solo aviso —"a 2 personas les gustó tu
   * publicación"— que además mentía sobre la mitad. Es el mismo criterio que usa
   * `buildNotifs` para la lista de adentro de la app, que agrupa por
   * `postId|sobre`.
   */
  type Grupo = { titulo: string; sobre: 'publicacion' | 'respuesta'; personas: Set<string> };
  const porDueno = new Map<string, Map<string, Grupo>>();
  const sumar = (dueno: string | null, postId: string, titulo: string, sobre: Grupo['sobre'], quien: string) => {
    // Darse me gusta solo no cuenta, y sin dueño no hay a quién avisarle.
    if (!dueno || dueno === quien) return;
    const posts = porDueno.get(dueno) ?? new Map<string, Grupo>();
    const clave = `${postId}|${sobre}`;
    const acum = posts.get(clave) ?? { titulo, sobre, personas: new Set<string>() };
    acum.personas.add(quien);
    posts.set(clave, acum);
    porDueno.set(dueno, posts);
  };

  for (const l of enPosts ?? []) {
    const p = Array.isArray(l.community_posts) ? l.community_posts[0] : l.community_posts;
    if (p) sumar(p.author_id as string | null, p.id as string, p.title as string, 'publicacion', l.member_id as string);
  }
  for (const l of enRespuestas ?? []) {
    const a = Array.isArray(l.community_answers) ? l.community_answers[0] : l.community_answers;
    const p = a && (Array.isArray(a.community_posts) ? a.community_posts[0] : a.community_posts);
    if (a && p) sumar(a.author_id as string | null, p.id as string, p.title as string, 'respuesta', l.member_id as string);
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

    for (const { titulo, sobre, personas } of posts.values()) {
      const n = personas.size;
      /* El título que se muestra es siempre el de la PUBLICACIÓN, también cuando el
         me gusta fue a una respuesta: es lo que ubica el hilo. Por eso el texto
         cambia la preposición —"tu respuesta EN «Aura»"— y no sólo el sustantivo. */
      const donde = sobre === 'respuesta' ? 'tu respuesta en' : 'tu publicación';
      await mandarPush(
        tokens.map((t) => t.token as string),
        'Le gustó lo que escribiste',
        n === 1 ? `A alguien le gustó ${donde} "${titulo}".` : `A ${n} personas les gustó ${donde} "${titulo}".`,
        { pantalla: 'foros' },
      );
      avisados++;
    }
  }

  console.log(`[cron/foro-likes] ${avisados} avisos a ${conAcceso?.length ?? 0} socios`);
  return NextResponse.json({ ok: true, avisados });
}
