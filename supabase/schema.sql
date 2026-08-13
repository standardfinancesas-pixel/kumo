-- ============================================================
--  Kumo · Esquema de base de datos (Supabase / Postgres)
--  Generado a partir del modelo del prototipo.
--  Incluye: tablas, roles, RLS y Realtime.
--  Aplicar con:  supabase db reset   (usa migrations + seed)
--            o:  psql < schema.sql
-- ============================================================

-- ---------- Extensiones ----------
create extension if not exists "uuid-ossp";

-- ---------- Tipos enumerados ----------
do $$ begin
  create type user_role as enum ('socio', 'prestador', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_name as enum ('AMIGO', 'FAMILIA', 'VIP');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pet_type as enum ('perro', 'gato', 'otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vaccine_status as enum ('aplicada', 'pendiente', 'vencida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_status as enum ('activo', 'moroso', 'baja');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reimbursement_status as enum ('en_revision', 'aprobado', 'rechazado', 'acreditado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type provider_status as enum ('pendiente', 'verificado', 'rechazado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type benefit_status as enum ('activo', 'pausado');
exception when duplicate_object then null; end $$;

-- ============================================================
--  TABLAS
-- ============================================================

-- Perfil de usuario (extiende auth.users de Supabase)
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         user_role   not null default 'socio',
  member_no    serial,
  full_name    text        not null,
  email        text        not null,
  phone        text,
  -- El domicilio en tres columnas y no concatenado: el club se organiza por
  -- zonas, así que hay que poder segmentar por localidad y provincia.
  address      text,
  city         text,
  province     text,
  dni          text,
  birth_date   date,
  plan_id      uuid,
  -- Lo que el socio contrató y aceptó en los pasos 3 y 5 del alta.
  -- `monthly_fee_agreed` es la cuota que aceptó al firmar, no la de hoy: el
  -- precio del plan cambia y sin este número no se puede reconstruir a qué se
  -- comprometió. De la tarjeta no se guarda nada (PCI DSS).
  addon_odonto         boolean not null default false,
  monthly_fee_agreed   integer,
  pay_method           text check (pay_method in ('tarjeta', 'cbu')),
  contract_accepted_at timestamptz,
  -- Club → socio: a dónde se le TRANSFIERE el reintegro. La transferencia la
  -- hace el club a mano desde su home banking; el sistema no mueve plata, solo
  -- guarda el destino. A una tarjeta no se le puede transferir. Se pide una vez
  -- en el alta y el formulario de reintegro lo prefija.
  bank_holder     text,
  bank_holder_dni text,
  bank_cuit       text,
  bank_name       text,
  bank_cbu        text,
  bank_alias      text,
  -- Socio → club: con qué se le COBRA la cuota (suscripción de Mercado Pago).
  -- Solo metadata del medio de pago: el número completo obliga a certificar PCI
  -- DSS y el CVV está prohibido después de autorizar. Los últimos 4 y la marca
  -- los calcula el navegador, así el PAN no llega ni de paso al servidor.
  card_brand  text,
  card_last4  text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  card_exp    text,
  card_holder text,
  status       member_status not null default 'activo',
  joined_on    date        not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  created_at   timestamptz not null default now()
);

create table if not exists plans (
  id          uuid primary key default uuid_generate_v4(),
  name        plan_name unique not null,
  base_price  integer   not null,        -- ARS/mes, IVA incluido
  tagline     text      not null,
  perks       text[]    not null default '{}',
  featured    boolean   not null default false
);

alter table profiles
  drop constraint if exists profiles_plan_fk,
  add  constraint profiles_plan_fk foreign key (plan_id) references plans(id);

create table if not exists pets (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   uuid not null references profiles(id) on delete cascade,
  name       text not null,
  type       pet_type not null default 'perro',
  breed      text,
  age_years  numeric,
  weight_kg  numeric,
  microchip  text,
  neutered   boolean not null default false,
  sex        text,
  vet_name   text,
  photo_url  text,
  created_at timestamptz not null default now()
);

-- Declaración jurada de salud del paso 4 del alta.
--
-- Guarda el texto de las preguntas junto con las respuestas y no solo un índice:
-- el cuestionario va a cambiar (`version`), y una respuesta sin su pregunta no
-- sirve para sostener el rechazo de un reintegro por preexistencia, que es para
-- lo que se pide. El par lo arma el servidor con la lista canónica de
-- `@kumo/shared`, así que el cliente no puede falsear el enunciado.
create table if not exists health_declarations (
  id         uuid primary key default uuid_generate_v4(),
  member_id  uuid not null references profiles(id) on delete cascade,
  -- La mascota puede borrarse; la declaración no. Por eso el nombre queda
  -- copiado: el registro tiene que valerse solo.
  pet_id     uuid references pets(id) on delete set null,
  pet_name   text not null,
  version    integer not null,
  answers    jsonb not null,
  sanitary   jsonb not null,
  signature  text not null,
  signed_at  timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists health_declarations_member_idx on health_declarations(member_id);

create table if not exists vaccinations (
  id          uuid primary key default uuid_generate_v4(),
  pet_id      uuid not null references pets(id) on delete cascade,
  name        text not null,
  -- Vacuna, estudio o antiparasitario: define el ícono del carnet.
  kind        text not null default 'Vacuna' check (kind in ('Vacuna', 'Estudio', 'Antiparasitario')),
  status      vaccine_status not null default 'pendiente',
  applied_on  date,
  due_on      date,
  next_on     date
);

create table if not exists providers (
  id           uuid primary key default uuid_generate_v4(),
  owner_id     uuid references profiles(id) on delete set null,
  name         text not null,
  category     text not null,
  zone         text not null,
  address      text,
  phone        text,
  instagram    text,
  website      text,
  about        text not null default '',
  rating       numeric not null default 0,
  reviews      integer not null default 0,
  price        integer,
  price_unit   text,
  status       provider_status not null default 'pendiente',
  photo_url    text,
  lat          double precision,
  lng          double precision,
  created_at   timestamptz not null default now()
);

create table if not exists benefits (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  category         text not null,
  discount         text not null,
  plan_requirement text not null,
  status           benefit_status not null default 'activo',
  description      text not null default '',
  valid_until      date,
  zone             text not null default '',
  days             text[] not null default '{}',
  hours            text not null default ''
);

create table if not exists reimbursements (
  id             uuid primary key default uuid_generate_v4(),
  member_id      uuid not null references profiles(id) on delete cascade,
  pet_id         uuid references pets(id) on delete set null,
  plan_name      plan_name not null,
  provider_name  text not null,
  concept        text not null,
  amount         integer not null,
  refund         integer not null,
  refund_pct     integer not null,
  status         reimbursement_status not null default 'en_revision',
  requested_on   date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  receipt_no     text,
  -- Path dentro del bucket privado 'receipts' (ver migración de comprobantes).
  receipt_path   text,
  -- datos de transferencia
  bank_holder    text,
  bank_holder_dni text,
  bank_cuit      text,
  bank_name      text,
  bank_cbu       text,
  bank_alias     text,
  flag           text,
  created_at     timestamptz not null default now()
);

create table if not exists community_posts (
  id          uuid primary key default uuid_generate_v4(),
  author_id   uuid references profiles(id) on delete set null,
  category    text not null,
  title       text not null,
  body        text not null,
  zone        text,
  -- El nombre va copiado porque la RLS de `profiles` no deja leer el perfil de
  -- otro socio. Lo pone el trigger `autor_desde_el_perfil` y no el cliente: si no,
  -- cualquiera puede firmar con el nombre de otro.
  author_name text not null default '',
  replies     integer not null default 0,
  likes       integer not null default 0,
  reported    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists community_answers (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid not null references community_posts(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  text       text not null,
  author_name text not null default '',
  likes      integer not null default 0,
  best       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists push_notifications (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  body       text not null,
  audience   text not null default 'todos',
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists faqs (
  id       uuid primary key default uuid_generate_v4(),
  question text not null,
  answer   text not null,
  "order"  integer not null default 0
);

create table if not exists emergency_contacts (
  id       uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete cascade,
  name     text not null,
  phone    text not null,
  type     text not null,
  address  text,
  hours    text
);

create table if not exists club_settings (
  id       integer primary key default 1,
  whatsapp text not null,
  email    text not null,
  constraint singleton check (id = 1)
);

-- Prestadores guardados por el socio (el corazón del detalle y "Mis guardados").
create table if not exists provider_favorites (
  member_id   uuid not null references profiles(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (member_id, provider_id)
);

-- Likes del foro. `community_posts.likes` / `community_answers.likes` y
-- `community_posts.replies` son cache que mantienen triggers (ver migraciones).
create table if not exists post_likes (
  member_id  uuid not null references profiles(id) on delete cascade,
  post_id    uuid not null references community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, post_id)
);

create table if not exists answer_likes (
  member_id  uuid not null references profiles(id) on delete cascade,
  answer_id  uuid not null references community_answers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, answer_id)
);

-- Reseñas de prestadores. `providers.rating` y `providers.reviews` se calculan
-- de acá con el trigger `provider_reviews_sync` (ver migraciones).
create table if not exists provider_reviews (
  id          uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references providers(id) on delete cascade,
  member_id   uuid not null references profiles(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  text        text not null default '',
  -- El nombre va copiado: la RLS de `profiles` no deja leer el perfil de otro socio.
  author_name text not null,
  created_at  timestamptz not null default now(),
  unique (provider_id, member_id)
);

-- ============================================================
--  Helper: ¿el usuario actual es admin?
-- ============================================================
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table profiles           enable row level security;
alter table plans              enable row level security;
alter table pets               enable row level security;
alter table vaccinations       enable row level security;
alter table providers          enable row level security;
alter table benefits           enable row level security;
alter table reimbursements     enable row level security;
alter table community_posts    enable row level security;
alter table community_answers  enable row level security;
alter table push_notifications enable row level security;
alter table faqs               enable row level security;
alter table emergency_contacts enable row level security;
alter table club_settings      enable row level security;
alter table provider_favorites enable row level security;
alter table provider_reviews   enable row level security;
alter table post_likes         enable row level security;
alter table answer_likes       enable row level security;
alter table health_declarations enable row level security;

-- Catálogo público (planes, beneficios, faqs, ajustes, prestadores verificados)
create policy "planes visibles"    on plans      for select using (true);
create policy "faqs visibles"      on faqs       for select using (true);
create policy "ajustes visibles"   on club_settings for select using (true);
create policy "beneficios visibles" on benefits  for select using (status = 'activo' or is_admin());
create policy "prestadores visibles" on providers for select using (status = 'verificado' or is_admin() or owner_id = auth.uid());

-- Perfiles: cada quien ve/edita el suyo; admin ve todo
create policy "perfil propio - select" on profiles for select using (id = auth.uid() or is_admin());
-- Ojo: la RLS es por fila, no por columna. El trigger `profiles_campos_guard`
-- (ver migraciones) es lo que impide que un socio se cambie el rol o el estado.
create policy "perfil propio - update" on profiles for update using (id = auth.uid() or is_admin());
create policy "perfil propio - insert" on profiles for insert with check (id = auth.uid());

-- Mascotas y vacunas: del dueño; admin ve todo
create policy "mascotas del dueño" on pets for all
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());
create policy "vacunas del dueño" on vaccinations for all
  using (exists (select 1 from pets p where p.id = pet_id and (p.owner_id = auth.uid() or is_admin())))
  with check (exists (select 1 from pets p where p.id = pet_id and (p.owner_id = auth.uid() or is_admin())));

-- Declaración jurada: se lee y se firma, no se edita ni se borra. Una
-- declaración que el firmante puede reescribir después no declara nada, así que
-- a propósito NO hay políticas de update ni de delete: ni el socio ni el admin
-- pueden tocarla desde la app.
create policy "el socio ve su declaración" on health_declarations for select
  using (auth.uid() = member_id or is_admin());
create policy "el socio firma su declaración" on health_declarations for insert
  with check (auth.uid() = member_id);

-- Reintegros: el socio ve/crea los suyos; solo admin cambia estado
create policy "reintegros del socio - select" on reimbursements for select
  using (member_id = auth.uid() or is_admin());
create policy "reintegros del socio - insert" on reimbursements for insert
  with check (member_id = auth.uid());
create policy "reintegros - admin update" on reimbursements for update using (is_admin());

-- Comunidad: lectura pública, escritura autenticada; admin modera
create policy "posts visibles"  on community_posts for select using (true);
create policy "posts crear"     on community_posts for insert with check (author_id = auth.uid());
create policy "posts editar"    on community_posts for update using (author_id = auth.uid() or is_admin());
create policy "posts borrar"    on community_posts for delete using (author_id = auth.uid() or is_admin());
create policy "respuestas visibles" on community_answers for select using (true);
create policy "respuestas crear"    on community_answers for insert with check (author_id = auth.uid());
create policy "respuestas moderar"  on community_answers for update using (author_id = auth.uid() or is_admin());
create policy "respuestas borrar"   on community_answers for delete using (author_id = auth.uid() or is_admin());

-- Likes: se cuentan en público, cada socio maneja los suyos
create policy "likes visibles" on post_likes for select using (true);
create policy "like propio"    on post_likes for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "likes de respuesta visibles" on answer_likes for select using (true);
create policy "like de respuesta propio"    on answer_likes for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Contactos de emergencia: del dueño
create policy "emergencias del dueño" on emergency_contacts for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Guardados: cada socio ve y maneja solo los suyos (el admin no los necesita)
create policy "guardados del socio" on provider_favorites for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Reseñas: las de un prestador publicado son públicas; cada socio edita la suya
create policy "reseñas visibles" on provider_reviews for select
  using (exists (select 1 from providers p where p.id = provider_id and p.status = 'verificado') or member_id = auth.uid() or is_admin());
create policy "reseña propia - insert" on provider_reviews for insert
  with check (member_id = auth.uid());
create policy "reseña propia - update" on provider_reviews for update
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "reseña propia - delete" on provider_reviews for delete
  using (member_id = auth.uid() or is_admin());

-- Notificaciones push: solo admin gestiona
create policy "push admin" on push_notifications for all using (is_admin()) with check (is_admin());

-- Beneficios/planes/faqs/prestadores: solo admin escribe
create policy "beneficios admin write" on benefits  for all using (is_admin()) with check (is_admin());
create policy "planes admin write"     on plans     for all using (is_admin()) with check (is_admin());
create policy "faqs admin write"       on faqs      for all using (is_admin()) with check (is_admin());
create policy "ajustes admin write"    on club_settings for all using (is_admin()) with check (is_admin());
create policy "prestadores admin write" on providers for update using (is_admin());
create policy "prestadores alta"        on providers for insert with check (owner_id = auth.uid() or is_admin());
-- El dueño edita y borra su negocio; el estado lo sigue manejando el club (ver
-- el trigger `providers_status_guard` en las migraciones).
create policy "prestador edita lo suyo" on providers for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "prestador borra lo suyo" on providers for delete
  using (owner_id = auth.uid() or is_admin());

-- ============================================================
--  REALTIME  (todo se actualiza en vivo)
--  Publicá en la publication `supabase_realtime` las tablas que
--  la UI escucha con subscribeTable() (ver packages/shared/src/supabase.ts).
-- ============================================================
alter publication supabase_realtime add table reimbursements;
alter publication supabase_realtime add table providers;
alter publication supabase_realtime add table benefits;
alter publication supabase_realtime add table community_posts;
alter publication supabase_realtime add table community_answers;
alter publication supabase_realtime add table push_notifications;

-- Para que los UPDATE/DELETE lleguen con la fila completa por Realtime:
alter table reimbursements    replica identity full;
alter table community_posts   replica identity full;
alter table providers         replica identity full;
