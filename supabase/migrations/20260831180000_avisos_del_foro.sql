-- Los avisos del foro: quién te respondió y a quién le gustó lo que escribiste.
--
-- Hasta ahora las notificaciones del socio se deducían de sus vacunas, sus
-- reintegros y su negocio (ver packages/shared/src/notifs.ts). Del foro no sabían
-- nada: te respondían una pregunta sobre tu perro y no te enterabas salvo que
-- volvieras a entrar al hilo a mirar, que es exactamente lo que vacía un foro.
--
-- Va como función y no como tres consultas en cada app por dos razones:
--
--  1. Son cruces contra "lo que escribí yo", y ese cruce lo necesitan TRES
--     consumidores: la webapp, la app móvil y el cron que manda el push. Escrito
--     tres veces, empieza a divergir — ya pasó con la lista de notificaciones,
--     que por eso hoy vive en @kumo/shared.
--  2. Necesita mirar publicaciones y respuestas de OTROS socios para saber quién
--     reaccionó, y las políticas del foro no dejan leer el perfil de cualquiera.
--     `security definer` resuelve eso sin abrir nada: la función devuelve
--     únicamente el nombre de quien reaccionó, y sólo sobre contenido del socio
--     que se pasa por parámetro.
--
-- Devuelve las reacciones SIN AGRUPAR, a propósito: agrupar es una decisión de
-- presentación (un aviso por publicación, no uno por "me gusta") y vive en
-- `buildNotifs`, para que las dos superficies cuenten igual.
--
-- Nunca devuelve lo que hizo el socio mismo: nadie necesita que le avisen que se
-- respondió o se dio me gusta solo.

create or replace function avisos_del_foro(p_member uuid)
returns table (
  id         text,
  tipo       text,   -- 'respuesta' | 'like'
  post_id    uuid,
  post_title text,
  -- Sobre qué fue el me gusta: 'publicacion' o 'respuesta'. En las respuestas
  -- viene 'publicacion' y no se usa.
  sobre      text,
  autor      text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  /*
   * Un socio sólo puede pedir SUS avisos.
   *
   * Sin este chequeo la función sería un enumerador: cualquiera con sesión pasa
   * el id de otro socio y se entera de quién le respondió y a quién le gustó lo
   * que escribió. `security definer` se saltea las políticas, así que el permiso
   * hay que ponerlo acá — no alcanza con que las tablas tengan RLS.
   *
   * El servidor no tiene `auth.uid()` y sí puede pedir los de cualquiera: es
   * exactamente lo que necesita el cron que manda el push.
   */
  if auth.uid() is not null and p_member is distinct from auth.uid() then
    raise exception 'Solo podés pedir tus propios avisos del foro';
  end if;

  return query
  select t.id, t.tipo, t.post_id, t.post_title, t.sobre, t.autor, t.created_at
  from (
    -- Respuestas a mis publicaciones
    select
      ('r-' || a.id::text)::text                     as id,
      'respuesta'::text                              as tipo,
      p.id                                           as post_id,
      p.title::text                                  as post_title,
      'publicacion'::text                            as sobre,
      coalesce(pr.full_name, 'Alguien')::text        as autor,
      a.created_at                                   as created_at
    from community_answers a
    join community_posts p on p.id = a.post_id
    left join profiles pr on pr.id = a.author_id
    where p.author_id = p_member
      and a.author_id is distinct from p_member

    union all

    -- Me gusta a mis publicaciones
    select
      ('lp-' || l.member_id::text || '-' || l.post_id::text)::text,
      'like'::text,
      p.id,
      p.title::text,
      'publicacion'::text,
      coalesce(pr.full_name, 'Alguien')::text,
      l.created_at
    from post_likes l
    join community_posts p on p.id = l.post_id
    left join profiles pr on pr.id = l.member_id
    where p.author_id = p_member
      and l.member_id is distinct from p_member

    union all

    -- Me gusta a mis respuestas. El título que se muestra es el de la publicación
    -- donde respondí: "le gustó tu respuesta en «Mi perro no come»" ubica; el
    -- texto de la respuesta suelto, no.
    select
      ('la-' || l.member_id::text || '-' || l.answer_id::text)::text,
      'like'::text,
      p.id,
      p.title::text,
      'respuesta'::text,
      coalesce(pr.full_name, 'Alguien')::text,
      l.created_at
    from answer_likes l
    join community_answers a on a.id = l.answer_id
    join community_posts p on p.id = a.post_id
    left join profiles pr on pr.id = l.member_id
    where a.author_id = p_member
      and l.member_id is distinct from p_member
  ) t
  /*
   * Acotado en tiempo y en cantidad. Un aviso de hace meses no es un aviso, y sin
   * tope esto crece para siempre: una publicación que se hace popular le mandaría
   * al socio una lista interminable en cada carga de la app.
   */
  where t.created_at > now() - interval '30 days'
  order by t.created_at desc
  limit 200;
end $$;

-- Quién puede llamarla: el socio con su sesión (la app) y el servidor.
--
-- OJO CON `anon`, y no alcanza con revocarle a `public`: Supabase deja
-- configurado que toda función nueva del esquema `public` se otorgue
-- automáticamente a `anon` y `authenticated` (default privileges). Ese permiso
-- es EXPLÍCITO sobre el rol, así que `revoke ... from public` no lo toca.
--
-- Sin la línea de `anon` esto quedó abierto de verdad: la clave anónima viaja
-- dentro del bundle de la app, o sea que es pública, y con ella cualquiera podía
-- pedir la actividad del foro de cualquier socio —quién le respondió, quién le
-- dio me gusta, los títulos de sus publicaciones— sin siquiera tener cuenta. Se
-- detectó probando la función recién creada contra producción.
--
-- La guardia de `auth.uid()` de adentro NO cubría esto: sin sesión `auth.uid()`
-- es null, que es justo el caso que la guardia deja pasar para que el cron pueda
-- consultar por cualquier socio.
revoke all on function avisos_del_foro(uuid) from public;
revoke all on function avisos_del_foro(uuid) from anon;
grant execute on function avisos_del_foro(uuid) to authenticated, service_role;

comment on function avisos_del_foro is
  'Reacciones del foro sobre lo que escribió un socio (respuestas a sus publicaciones y me gusta a sus publicaciones y respuestas), sin agrupar y sin incluir lo que hizo él mismo. La agrupación vive en buildNotifs de @kumo/shared.';
