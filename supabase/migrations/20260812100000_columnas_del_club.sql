-- Campos que decide el club, no el socio.
--
-- Mismo problema que `profiles.role` y `providers.status`: la RLS de Postgres es
-- por fila, no por columna, así que "el socio edita lo suyo" también dejaba tocar
-- campos que no son suyos. Probado con la sesión de un socio real antes de esto:
--
--   A) POST /rest/v1/reimbursements con status='acreditado' y refund=999999 → 201.
--      El reintegro nacía acreditado, no entraba nunca a la cola del admin y
--      sumaba al total reintegrado. Es el peor: es plata.
--   B) POST /community_posts con likes=9999, replies=9999 → aceptado. Y con un
--      PATCH a su propio post podía poner reported=false, o sea sacarse solo de
--      la cola de Moderación.
--   C) POST /community_answers con best=true → se marcaba "Mejor respuesta" a sí
--      mismo, que es decisión de quien preguntó.
--
-- Los contadores `likes` y `replies` ya los mantienen triggers a partir de las
-- tablas de likes y respuestas: acá se los fuerza también en el insert para que
-- nadie los siembre inflados.

-- ── Reintegros: nacen en revisión ──
create or replace function reimbursements_estado_del_club()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- El club decide si se aprueba y se acredita.
    new.status := 'en_revision';
    -- El monto a reintegrar lo calcula la app según el plan, pero nunca puede
    -- ser mayor al gasto: eso no es un plan, es un error o un abuso.
    if new.refund > new.amount then
      new.refund := new.amount;
    end if;
  else
    new.status := old.status;
    new.refund := old.refund;
    new.refund_pct := old.refund_pct;
    new.amount := old.amount;
  end if;
  return new;
end $$;

drop trigger if exists reimbursements_estado_guard on reimbursements;
create trigger reimbursements_estado_guard before insert or update on reimbursements
  for each row execute function reimbursements_estado_del_club();

-- ── Posts: contadores y moderación ──
create or replace function posts_campos_del_club()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.likes := 0;
    new.replies := 0;
    new.reported := false;
  else
    new.likes := old.likes;
    new.replies := old.replies;
    -- Reportar sí (cualquiera puede), des-reportar no: eso lo resuelve el club.
    if old.reported and not new.reported then
      new.reported := true;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists posts_campos_guard on community_posts;
create trigger posts_campos_guard before insert or update on community_posts
  for each row execute function posts_campos_del_club();

-- ── Respuestas: contador y "mejor respuesta" ──
-- `best` la puede marcar el autor del post (o el admin), no el de la respuesta.
create or replace function answers_campos_del_club()
returns trigger language plpgsql security definer set search_path = public as $$
declare dueño_post uuid;
begin
  if is_admin() then
    return new;
  end if;
  select author_id into dueño_post from community_posts where id = new.post_id;

  if tg_op = 'INSERT' then
    new.likes := 0;
    new.best := false;
  else
    new.likes := old.likes;
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

drop trigger if exists answers_campos_guard on community_answers;
create trigger answers_campos_guard before insert or update on community_answers
  for each row execute function answers_campos_del_club();

-- Que el autor del post pueda marcar la mejor respuesta: hasta ahora solo podía
-- editar las respuestas propias, así que no había forma de usar el campo.
drop policy if exists "mejor respuesta la marca quien preguntó" on community_answers;
create policy "mejor respuesta la marca quien preguntó" on community_answers for update
  using (exists (select 1 from community_posts p where p.id = post_id and p.author_id = auth.uid()));

-- Los contadores del seed no tienen filas detrás; se recalculan.
update community_posts p set
  likes   = (select count(*) from post_likes l where l.post_id = p.id),
  replies = (select count(*) from community_answers a where a.post_id = p.id);
update community_answers a set
  likes = (select count(*) from answer_likes l where l.answer_id = a.id);
