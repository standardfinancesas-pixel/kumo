-- Likes y respuestas del foro.
--
-- Los likes eran estado local en cada app: se perdían al recargar y el mismo
-- socio podía "dar me gusta" infinitas veces. Y responder no existía: no había
-- ningún insert a `community_answers`, así que las respuestas solo se leían y el
-- contador `replies` nunca se movía.
--
-- Los contadores de `community_posts` y `community_answers` quedan como cache
-- mantenido por triggers: se leen mucho (en cada tarjeta del listado) y contar
-- filas cada vez sería caro.

create table if not exists post_likes (
  member_id uuid not null references profiles(id) on delete cascade,
  post_id   uuid not null references community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, post_id)
);

create table if not exists answer_likes (
  member_id uuid not null references profiles(id) on delete cascade,
  answer_id uuid not null references community_answers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, answer_id)
);

create index if not exists community_answers_post_idx on community_answers (post_id, created_at);

alter table post_likes   enable row level security;
alter table answer_likes enable row level security;

-- Los likes son públicos (hay que poder contarlos), pero cada socio maneja solo
-- los suyos.
drop policy if exists "likes visibles" on post_likes;
create policy "likes visibles" on post_likes for select using (true);
drop policy if exists "like propio" on post_likes;
create policy "like propio" on post_likes for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "likes de respuesta visibles" on answer_likes;
create policy "likes de respuesta visibles" on answer_likes for select using (true);
drop policy if exists "like de respuesta propio" on answer_likes;
create policy "like de respuesta propio" on answer_likes for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Responder: cualquier socio puede, y edita o borra solo lo suyo. El admin borra
-- cualquiera, que es lo que necesita Moderación.
drop policy if exists "respuestas visibles" on community_answers;
create policy "respuestas visibles" on community_answers for select using (true);
drop policy if exists "respuesta propia - insert" on community_answers;
create policy "respuesta propia - insert" on community_answers for insert
  with check (author_id = auth.uid());
drop policy if exists "respuesta propia - update" on community_answers;
create policy "respuesta propia - update" on community_answers for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "respuesta propia - delete" on community_answers;
create policy "respuesta propia - delete" on community_answers for delete
  using (author_id = auth.uid() or is_admin());

-- ── Contadores ──
create or replace function sync_post_likes()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.post_id, old.post_id);
  update community_posts set likes = (select count(*) from post_likes where post_id = pid) where id = pid;
  return null;
end $$;

drop trigger if exists post_likes_sync on post_likes;
create trigger post_likes_sync after insert or delete on post_likes
  for each row execute function sync_post_likes();

create or replace function sync_answer_likes()
returns trigger language plpgsql security definer set search_path = public as $$
declare aid uuid;
begin
  aid := coalesce(new.answer_id, old.answer_id);
  update community_answers set likes = (select count(*) from answer_likes where answer_id = aid) where id = aid;
  return null;
end $$;

drop trigger if exists answer_likes_sync on answer_likes;
create trigger answer_likes_sync after insert or delete on answer_likes
  for each row execute function sync_answer_likes();

create or replace function sync_post_replies()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.post_id, old.post_id);
  update community_posts set replies = (select count(*) from community_answers where post_id = pid) where id = pid;
  return null;
end $$;

drop trigger if exists community_answers_count on community_answers;
create trigger community_answers_count after insert or delete on community_answers
  for each row execute function sync_post_replies();

-- Los contadores del seed no tienen filas detrás, así que se recalculan.
update community_posts p set
  likes   = (select count(*) from post_likes l where l.post_id = p.id),
  replies = (select count(*) from community_answers a where a.post_id = p.id);
update community_answers a set
  likes = (select count(*) from answer_likes l where l.answer_id = a.id);
