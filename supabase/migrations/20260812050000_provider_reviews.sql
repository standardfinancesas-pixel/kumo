-- Reseñas de prestadores.
--
-- `providers.rating` y `providers.reviews` venían del seed: números inventados
-- sin nada detrás. Ahora salen de esta tabla y los mantiene un trigger, así que
-- la estrella de un prestador es el promedio real de lo que votaron los socios.

create table if not exists provider_reviews (
  id          uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references providers(id) on delete cascade,
  member_id   uuid not null references profiles(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  text        text not null default '',
  -- Nombre del socio al momento de reseñar. Se guarda acá porque la RLS de
  -- `profiles` no deja que un socio lea el perfil de otro, así que un join no
  -- podría resolver el autor.
  author_name text not null,
  created_at  timestamptz not null default now(),
  -- Una reseña por socio y prestador: si vuelve a opinar, edita la suya.
  unique (provider_id, member_id)
);

create index if not exists provider_reviews_provider_idx on provider_reviews (provider_id, created_at desc);

alter table provider_reviews enable row level security;

-- Las reseñas de un prestador publicado son contenido público del club; cada
-- socio escribe y edita solo la suya.
drop policy if exists "reseñas visibles" on provider_reviews;
create policy "reseñas visibles" on provider_reviews for select
  using (exists (select 1 from providers p where p.id = provider_id and p.status = 'verificado') or member_id = auth.uid() or is_admin());

drop policy if exists "reseña propia - insert" on provider_reviews;
create policy "reseña propia - insert" on provider_reviews for insert
  with check (member_id = auth.uid());

drop policy if exists "reseña propia - update" on provider_reviews;
create policy "reseña propia - update" on provider_reviews for update
  using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "reseña propia - delete" on provider_reviews;
create policy "reseña propia - delete" on provider_reviews for delete
  using (member_id = auth.uid() or is_admin());

-- El promedio y el conteo se recalculan solos: si se dejaran a mano quedarían
-- desfasados en cuanto alguien edite o borre su reseña.
create or replace function sync_provider_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.provider_id, old.provider_id);
  update providers set
    rating  = coalesce((select round(avg(r.rating)::numeric, 1) from provider_reviews r where r.provider_id = pid), 0),
    reviews = (select count(*) from provider_reviews r where r.provider_id = pid)
  where id = pid;
  return null;
end $$;

drop trigger if exists provider_reviews_sync on provider_reviews;
create trigger provider_reviews_sync
  after insert or update or delete on provider_reviews
  for each row execute function sync_provider_rating();

-- Los ratings del seed no tienen reseñas detrás, así que quedan en cero. Es la
-- consecuencia de que el número sea real: se llena cuando los socios opinen.
update providers p set
  rating  = coalesce((select round(avg(r.rating)::numeric, 1) from provider_reviews r where r.provider_id = p.id), 0),
  reviews = (select count(*) from provider_reviews r where r.provider_id = p.id);
