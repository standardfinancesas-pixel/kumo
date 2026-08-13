-- Los contadores del foro nunca se movían.
--
-- Dos triggers míos se pisaban. `posts_campos_del_club` (de ayer) congelaba los
-- contadores para que nadie los infle:
--
--     new.likes := old.likes;  new.replies := old.replies;
--
-- Pero `sync_post_replies` recalcula el contador con un UPDATE sobre
-- `community_posts`, y ese UPDATE pasa por el mismo BEFORE UPDATE, así que su
-- recuento se descartaba. Efecto visible: en el foro todo decía "0 respuestas ·
-- 0 me gusta" para siempre, sin importar cuántas hubiera. Probado: después de una
-- respuesta y un like, los dos seguían en 0.
--
-- En vez de congelar, se RECALCULA. Los dos caminos convergen en la verdad: el
-- trigger de sincronización funciona, y un cliente que mande likes:9999 igual
-- termina con el número real. El invariante queda más simple y no depende de
-- quién hizo el update: `likes` y `replies` son siempre la cuenta de sus filas.
--
-- El recuento va antes del `is_admin()` a propósito: que sean derivados vale para
-- todos, y así un PATCH del panel con un valor viejo tampoco los desalinea.

create or replace function posts_campos_del_club()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.likes   := (select count(*) from post_likes where post_id = new.id);
    new.replies := (select count(*) from community_answers where post_id = new.id);
  else
    new.likes := 0;
    new.replies := 0;
  end if;

  if is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.reported := false;
  elsif old.reported and not new.reported then
    -- Reportar sí (cualquiera puede), des-reportar no: eso lo resuelve el club.
    new.reported := true;
  end if;
  return new;
end $$;

create or replace function answers_campos_del_club()
returns trigger language plpgsql security definer set search_path = public as $$
declare dueño_post uuid;
begin
  if tg_op = 'UPDATE' then
    new.likes := (select count(*) from answer_likes where answer_id = new.id);
  else
    new.likes := 0;
  end if;

  if is_admin() then
    return new;
  end if;

  select author_id into dueño_post from community_posts where id = new.post_id;

  if tg_op = 'INSERT' then
    new.best := false;
  else
    if new.best <> old.best and auth.uid() <> dueño_post then
      new.best := old.best;
    end if;
    -- La política que deja al autor del post marcar la mejor respuesta es por
    -- fila, así que también le habilitaría reescribir el texto ajeno. El
    -- contenido solo lo cambia quien lo escribió.
    if auth.uid() <> old.author_id then
      new.text := old.text;
      new.author_id := old.author_id;
      new.author_name := old.author_name;
    end if;
  end if;
  return new;
end $$;

-- Realinear lo que quedó desfasado mientras el contador estuvo congelado.
update community_posts p set
  likes   = (select count(*) from post_likes l where l.post_id = p.id),
  replies = (select count(*) from community_answers a where a.post_id = p.id);
update community_answers a set
  likes = (select count(*) from answer_likes l where l.answer_id = a.id);
