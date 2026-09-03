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
  -- 'suspendido' es el club cortándole el acceso; 'baja' es el socio que se fue
  -- (y es la única que cuenta para el churn). No son lo mismo.
  create type member_status as enum ('activo', 'moroso', 'suspendido', 'baja');
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
  -- Solo los socios tienen número, y lo asigna el trigger
  -- `profiles_numero_de_socio` (más abajo) una vez y para siempre. No es un
  -- `serial`: como contador de todos los perfiles, un admin quedaba como
  -- "socio #60" y cada usuario de prueba se llevaba un número.
  member_no    integer unique,
  full_name    text        not null,
  email        text        not null,
  phone        text,
  -- El domicilio en tres columnas y no concatenado: el club se organiza por
  -- zonas, así que hay que poder segmentar por localidad y provincia.
  address      text,
  city         text,
  province     text,
  -- El domicilio convertido en un punto del mapa: lo escribe el servidor
  -- geocodificando las tres columnas de arriba con Nominatim (OpenStreetMap), una
  -- vez por socio. Es el centro del mapa de prestadores y el origen de todos los
  -- "a 5,9 km de tu casa", que antes se medían desde el Obelisco.
  -- `geo_origen` dice con qué precisión se resolvió, y de eso depende el texto:
  -- 'domicilio' → "de tu casa", 'localidad' → "de tu zona", null → "del centro".
  lat          double precision,
  lng          double precision,
  geo_origen   text constraint profiles_geo_origen_valido check (geo_origen is null or geo_origen in ('domicilio', 'localidad')),
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

-- Cuántas preguntas tiene cada versión del cuestionario. Está en la base para que
-- `agregar_mascota()` valide que la declaración esté completa sin tener el
-- cuestionario escrito adentro: cuando cambie, se agrega una fila con la versión
-- nueva y las declaraciones ya firmadas siguen siendo legibles.
create table if not exists declaracion_versions (
  version             integer primary key,
  preguntas_salud     integer not null,
  preguntas_sanitario integer not null
);

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

-- Bloquear a una persona en el foro: esconde de TU foro lo que escribió, sin
-- avisarle y sin borrarla. Lo exige la regla 1.2 de la App Store junto con
-- reportar (ver la migración 20260903120000).
create table if not exists member_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  -- El nombre va copiado, igual que en `community_posts.author_name` y por lo
  -- mismo: la RLS de `profiles` no deja leer el perfil de otro socio, así que sin
  -- esto la lista de "Personas bloqueadas" sería una lista de identificadores. Lo
  -- manda el cliente desde el nombre que ya tiene en pantalla; acá no hace falta
  -- trigger como en las publicaciones, porque esta fila la ve una sola persona
  -- —quien bloqueó— y firmarla mal solo se confunde a sí misma.
  blocked_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_bloquearse_solo check (blocker_id <> blocked_id)
);
create index if not exists member_blocks_blocker_idx on member_blocks (blocker_id);

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
  -- Dos imagenes y no una: la portada es la banda de arriba de la ficha y el logo
  -- es el avatar cuadrado. Ver la migracion 20260821140000.
  photo_url    text,
  logo_url     text,
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
  -- La dirección del comercio y su punto en el mapa. La dirección la carga el
  -- club en el panel y el servidor la geocodifica (Nominatim/OpenStreetMap); es
  -- opcional, y sin ella el beneficio se ve en la lista sin distancia — resolver
  -- la zona pondría a todos los de Palermo en el mismo punto, tapándose entre sí.
  address          text,
  lat              double precision,
  lng              double precision,
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
  -- Cuando el club lo acredito o rechazo. Null mientras esta en revision: el
  -- seguimiento marcaba los pasos hechos pero sin fecha, y las notificaciones
  -- fechaban "acreditado" con el dia del pedido.
  resolved_at    timestamptz,
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
  -- Por qué lo reportaron. La escribe reportar_post() (más abajo).
  report_reason text,
  -- Foto de la publicacion, en el bucket pet-photos. El prototipo la ofrece y la
  -- tabla no tenia donde guardarla, asi que el boton no se podia construir.
  photo_url   text,
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
--  El número de socio: solo para socios, y una sola vez
-- ============================================================
create sequence if not exists profiles_member_no_seq as integer start 1;

create or replace function profiles_numero_de_socio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'socio' and new.member_no is null then
    new.member_no := nextval('profiles_member_no_seq');
  end if;
  return new;
end $$;

-- OJO CON EL NOMBRE: con varios triggers BEFORE del mismo tipo, Postgres los
-- corre en orden alfabético, y este tiene que ir DESPUÉS de
-- `profiles_campos_guard` (ver las migraciones), que para quien no es admin hace
-- `new.member_no := old.member_no`. Si corriera antes, el guard borraría el
-- número recién asignado. 'profiles_campos_guard' < 'profiles_numero_de_socio'.
drop trigger if exists profiles_numero_de_socio on profiles;
create trigger profiles_numero_de_socio before insert or update on profiles
  for each row execute function profiles_numero_de_socio();

-- ============================================================
--  PUSH: a dónde mandar y qué ya se mandó
-- ============================================================
-- El token de Expo es la dirección del aparato Y la credencial: quien lo tiene
-- puede notificar a ese teléfono. Un socio puede tener varios (celular, tablet).
create table if not exists push_tokens (
  token       text primary key,
  member_id   uuid not null references profiles(id) on delete cascade,
  platform    text not null check (platform in ('android', 'ios', 'web')),
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists push_tokens_member_idx on push_tokens(member_id);

-- ============================================================
--  Mercado Pago: un plan de suscripción POR SOCIO
-- ============================================================
create table if not exists mp_member_plans (
  -- Lo que devuelve el webhook en `preapproval_plan_id`: es la llave del cruce.
  mp_plan_id   text primary key,
  member_id    uuid    not null references profiles(id) on delete cascade,
  plan_id      uuid    not null references plans(id)    on delete cascade,
  addon_odonto boolean not null default false,
  -- La cuota con la que se creó el plan (ARS). Si el precio cambió, el plan
  -- guardado ya no sirve y se crea otro: comparar este número es lo que lo dice.
  amount       integer not null,
  -- A dónde vuelve el socio al terminar. Va acá porque el plan lo fija al
  -- crearse y la vuelta es distinta según la superficie (webapp, app, alta):
  -- reutilizar un plan con otra vuelta mandaría al socio al lugar equivocado.
  back_url     text    not null,
  created_at   timestamptz not null default now()
);

create index if not exists mp_member_plans_member_idx on mp_member_plans(member_id);

-- Sin políticas a propósito: esta tabla la leen y escriben solo los route
-- handlers con la service-role (pagos/crear, el webhook y pagos/confirmar).
-- Ningún cliente tiene nada que hacer acá — un socio que pudiera escribirla se
-- atribuiría los pagos de otro.
alter table mp_member_plans enable row level security;

comment on table mp_member_plans is
  'Un PreApprovalPlan de Mercado Pago por socio. El webhook resuelve de quién es una suscripción nacida del flujo por plan cruzando preapproval_plan_id contra esta tabla. Solo service-role.';


-- El cron de vacunas corre todos los días y una vacuna vence una sola vez: sin
-- esta marca, el socio recibiría el mismo aviso cada mañana durante un mes.
-- Hasta cuándo llegó cada cron. Sin esto, un cron que mira "las últimas 24 horas"
-- repite o pierde apenas el reloj se corre un poco (ver la migración
-- 20260902180000). La ventana va desde donde terminó la corrida anterior.
create table if not exists cron_runs (
  job      text primary key,
  last_run timestamptz not null
);

create table if not exists vaccine_reminders (
  vaccination_id uuid primary key references vaccinations(id) on delete cascade,
  due_on         date not null,
  sent_at        timestamptz not null default now()
);

-- Si la vacuna se aplica o se reprograma, el recordatorio viejo ya no aplica.
create or replace function vaccine_reminder_reset()
returns trigger language plpgsql security definer set search_path = public as $
begin
  if new.due_on is distinct from old.due_on or new.status is distinct from old.status then
    delete from vaccine_reminders where vaccination_id = new.id;
  end if;
  return new;
end $;

drop trigger if exists vaccine_reminder_reset on vaccinations;
create trigger vaccine_reminder_reset after update on vaccinations
  for each row execute function vaccine_reminder_reset();

-- ============================================================
--  Reportar una publicación del foro
-- ============================================================
-- Va por función y no por política: la RLS es por fila, así que dejar que
-- cualquiera marque `reported` también lo habilitaría a reescribir el título y el
-- cuerpo de un post ajeno. Sin esto, Moderación no podía recibir nada.
create or replace function reportar_post(p_post_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Hay que tener sesión para reportar.';
  end if;
  -- Las funciones `security definer` se saltean las políticas, así que sin este
  -- chequeo quedaban como la puerta de atrás del socio sin acceso.
  if not tiene_acceso() then
    raise exception 'Tu cuenta no está activa.';
  end if;
  -- El primer motivo es el que queda, y nadie se reporta a sí mismo.
  update community_posts
     set reported      = true,
         report_reason = coalesce(nullif(btrim(p_motivo), ''), 'Sin motivo')
   where id = p_post_id
     and not reported
     and author_id is distinct from auth.uid();
end $$;

revoke all on function reportar_post(uuid, text) from public;
grant execute on function reportar_post(uuid, text) to authenticated;

-- ============================================================
--  Helper: ¿el usuario actual es admin?
-- ============================================================
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
--  Helper: ¿el que pide tiene acceso al club?
-- ============================================================
-- El corte del socio suspendido o de baja también vive en las pantallas, pero un
-- token ya emitido sigue sirviendo hasta vencer (una hora) y con él la API
-- contesta igual. Las políticas mandan más que cualquier pantalla, así que el
-- estado se chequea también acá (ver las políticas más abajo).
create or replace function tiene_acceso()
returns boolean language sql stable security definer set search_path = public as $
  -- Lista blanca y no negra: si mañana aparece un estado nuevo, lo seguro es
  -- que no dé acceso hasta que alguien lo decida.
  -- Al prestador y al admin no los toca: su acceso no depende de la cuota.
  select coalesce(
    (select p.role <> 'socio' or p.status in ('activo', 'moroso')
       from profiles p where p.id = auth.uid()),
    false);
$;

/**
 * ¿Tiene la cuota paga?
 *
 * Es la OTRA pregunta, y por eso es otra función: `tiene_acceso()` dice cómo está
 * la relación con el club (activo, suspendido, baja) y esta dice si pagó. Entrar a
 * Kumo es gratis; los reintegros y los beneficios no, y esas dos políticas piden
 * las dos funciones.
 *
 * Mira `paid_until` y NO `plan_id`: quien elige un plan, va a Mercado Pago y no
 * paga queda con el plan escrito y sin haber pagado nada, así que con el plan como
 * criterio se llevaría todo gratis. El día es el argentino porque la base corre en
 * UTC y de noche `current_date` ya es mañana.
 */
create or replace function tiene_plan_pago()
returns boolean language sql stable security definer set search_path = public as $
  select coalesce(
    (select p.role <> 'socio'
              or (p.paid_until is not null
                  and p.paid_until >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
       from profiles p where p.id = auth.uid()),
    false);
$;

-- ============================================================
--  Alta de mascota + su declaración jurada, en una transacción
-- ============================================================
-- El socio no puede insertar en `pets` (ver sus políticas): esta es la única vía,
-- y exige la declaración. Si falla cualquiera de los dos inserts no queda
-- ninguno, así que no puede existir una mascota sin declarar.
insert into declaracion_versions (version, preguntas_salud, preguntas_sanitario)
  values (1, 7, 4)
  on conflict (version) do update
    set preguntas_salud = excluded.preguntas_salud,
        preguntas_sanitario = excluded.preguntas_sanitario;

/* ── La regla de la declaración, en un solo lugar ────────────── */
-- Estaba escrita dentro de `agregar_mascota`. Ahora la piden las dos funciones, y
-- dos copias de una validación legal es la forma segura de que una quede vieja.
create or replace function public.chequear_declaracion(
  p_version   integer,
  p_answers   jsonb,
  p_sanitary  jsonb,
  p_signature text
) returns void language plpgsql stable set search_path = public as $$
declare esperadas record;
begin
  select preguntas_salud, preguntas_sanitario into esperadas
  from declaracion_versions where version = p_version;
  if not found then
    raise exception 'Version de declaracion desconocida: %', p_version;
  end if;
  if p_signature is null or length(trim(p_signature)) < 3 then
    raise exception 'Falta firmar la declaracion jurada.';
  end if;
  if jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) <> esperadas.preguntas_salud
     or jsonb_array_length(coalesce(p_sanitary, '[]'::jsonb)) <> esperadas.preguntas_sanitario then
    raise exception 'La declaracion jurada esta incompleta.';
  end if;
end $$;

comment on function public.chequear_declaracion(integer, jsonb, jsonb, text) is
  'Valida una declaracion jurada contra declaracion_versions: que la version exista, que este firmada y que tenga la cantidad exacta de respuestas. La usan agregar_mascota y crear_mascotas_del_alta.';

/* ── Las mascotas del alta, todas o ninguna ──────────────────── */
create or replace function public.crear_mascotas_del_alta(
  p_member   uuid,
  p_version  integer,
  p_firma    text,
  p_mascotas jsonb
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  m       jsonb;
  nueva   uuid;
  cuantas integer := 0;
begin
  if p_member is null then
    raise exception 'Falta el socio.';
  end if;
  if p_mascotas is null or jsonb_array_length(p_mascotas) = 0 then
    raise exception 'El alta necesita al menos una mascota.';
  end if;
  -- Tope de seguridad, más arriba que el de la pantalla: no es una regla de
  -- producto, es que un pedido armado a mano no pueda insertar mil filas.
  if jsonb_array_length(p_mascotas) > 10 then
    raise exception 'Demasiadas mascotas en un alta.';
  end if;

  for m in select * from jsonb_array_elements(p_mascotas) loop
    if coalesce(trim(m->>'nombre'), '') = '' then
      raise exception 'Cada mascota necesita un nombre.';
    end if;
    -- Se valida ANTES de insertar la mascota: si la declaración está mal, no queda
    -- ni la mascota. Igual toda la función es una transacción, pero falla más claro.
    perform chequear_declaracion(p_version, m->'answers', m->'sanitary', p_firma);

    insert into pets (owner_id, name, type, breed, sex, neutered, age_years, weight_kg, microchip, vet_name, photo_url)
    values (
      p_member,
      trim(m->>'nombre'),
      coalesce(nullif(m->>'tipo', ''), 'perro')::pet_type,
      nullif(trim(coalesce(m->>'raza', '')), ''),
      nullif(trim(coalesce(m->>'sexo', '')), ''),
      coalesce((m->>'castrada')::boolean, false),
      (m->>'edad')::numeric,
      (m->>'peso')::numeric,
      nullif(trim(coalesce(m->>'microchip', '')), ''),
      nullif(trim(coalesce(m->>'vet', '')), ''),
      nullif(trim(coalesce(m->>'foto', '')), '')
    )
    returning id into nueva;

    -- La misma firma para todas: es un solo acto legal con N anexos. Cada fila
    -- guarda su pet_id y sus propias respuestas.
    insert into health_declarations (member_id, pet_id, pet_name, version, answers, sanitary, signature)
    values (p_member, nueva, trim(m->>'nombre'), p_version, m->'answers', m->'sanitary', trim(p_firma));

    cuantas := cuantas + 1;
  end loop;

  return cuantas;
end $$;

comment on function public.crear_mascotas_del_alta(uuid, integer, text, jsonb) is
  'Crea las N mascotas del alta con su declaracion jurada, en una transaccion: si una falla no queda ninguna. El socio viaja por parametro porque en el alta con contrasena todavia no hay sesion, y por eso SOLO la puede llamar el servidor (ver el revoke).';

-- Solo el servidor. Con el socio por parámetro, dejarla abierta a `authenticated`
-- sería dejar que cualquiera cree mascotas a nombre de otro. Mismo criterio que
-- `acreditar_cuota` y `marcar_suscripcion`.
revoke all on function public.crear_mascotas_del_alta(uuid, integer, text, jsonb) from public, anon, authenticated;

/* ── agregar_mascota pasa a usar la regla compartida ─────────── */
-- Mismo comportamiento y misma firma: lo único que cambia es que la validación de la
-- declaración ya no está copiada acá.
create or replace function public.agregar_mascota(
  p_name      text,
  p_type      text,
  p_breed     text,
  p_sex       text,
  p_neutered  boolean,
  p_age_years numeric,
  p_weight_kg numeric,
  p_microchip text,
  p_vet_name  text,
  p_photo_url text,
  p_version   integer,
  p_answers   jsonb,
  p_sanitary  jsonb,
  p_signature text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  quien uuid := auth.uid();
  nueva uuid;
begin
  if quien is null then
    raise exception 'Hay que estar identificado para agregar una mascota.';
  end if;
  if not tiene_acceso() then
    raise exception 'Tu cuenta no está activa: no podés agregar mascotas.';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'La mascota necesita un nombre.';
  end if;

  perform chequear_declaracion(p_version, p_answers, p_sanitary, p_signature);

  insert into pets (owner_id, name, type, breed, sex, neutered, age_years, weight_kg, microchip, vet_name, photo_url)
  values (
    quien, trim(p_name), coalesce(nullif(p_type, ''), 'perro')::pet_type, nullif(trim(coalesce(p_breed, '')), ''),
    nullif(trim(coalesce(p_sex, '')), ''), coalesce(p_neutered, false), p_age_years, p_weight_kg,
    nullif(trim(coalesce(p_microchip, '')), ''), nullif(trim(coalesce(p_vet_name, '')), ''),
    nullif(trim(coalesce(p_photo_url, '')), '')
  )
  returning id into nueva;

  insert into health_declarations (member_id, pet_id, pet_name, version, answers, sanitary, signature)
  values (quien, nueva, trim(p_name), p_version, p_answers, p_sanitary, trim(p_signature));

  return nueva;
end $$;

revoke all on function public.agregar_mascota(text, text, text, text, boolean, numeric, numeric, text, text, text, integer, jsonb, jsonb, text) from public;
grant execute on function public.agregar_mascota(text, text, text, text, boolean, numeric, numeric, text, text, text, integer, jsonb, jsonb, text) to authenticated;

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table profiles           enable row level security;
alter table plans              enable row level security;
alter table pets               enable row level security;
alter table vaccinations       enable row level security;
alter table member_blocks      enable row level security;
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
alter table declaracion_versions enable row level security;
alter table push_tokens        enable row level security;
alter table vaccine_reminders  enable row level security;
alter table cron_runs          enable row level security;
create policy "versiones visibles" on declaracion_versions for select using (true);

-- Catálogo público (planes, beneficios, faqs, ajustes, prestadores verificados)
create policy "planes visibles"    on plans      for select using (true);
create policy "faqs visibles"      on faqs       for select using (true);
create policy "ajustes visibles"   on club_settings for select using (true);
-- Los beneficios son del socio con la cuota paga. Antes se leían SIN sesión, con
-- la anon key: el catálogo que el club negoció con los comercios estaba abierto.
create policy "beneficios del socio con plan" on benefits for select
  using ((status = 'activo' and tiene_acceso() and tiene_plan_pago()) or is_admin());
-- El directorio se lee CON SESIÓN: la anon key va en el bundle del navegador, así
-- que con ella cualquiera se bajaba los prestadores con teléfono y dirección sin
-- ser socio. El corte es `tiene_acceso()` y no `tiene_plan_pago()`, porque
-- Servicios es gratis para el socio; `is_admin()` va aparte porque el panel
-- necesita ver además los pendientes y los rechazados.
create policy "prestadores visibles" on providers for select
  using ((status = 'verificado' and tiene_acceso()) or is_admin() or owner_id = auth.uid());

-- Perfiles: cada quien ve/edita el suyo; admin ve todo
-- El socio suspendido o de baja SÍ puede leer su perfil: es lo que la portada
-- necesita para poder decirle por qué no entra en lugar de dejarlo adivinando.
-- Editarlo, no.
create policy "perfil propio - select" on profiles for select using (id = auth.uid() or is_admin());
-- Ojo: la RLS es por fila, no por columna. El trigger `profiles_campos_guard`
-- (ver migraciones) es lo que impide que un socio se cambie el rol o el estado.
create policy "perfil propio - update" on profiles for update
  using ((id = auth.uid() and tiene_acceso()) or is_admin());
create policy "perfil propio - insert" on profiles for insert with check (id = auth.uid());

-- Los tokens de push: cada quien registra y borra los suyos; el club los lee para
-- poder enviar. `vaccine_reminders` no lleva políticas a propósito: solo la
-- service-role key la toca, desde el cron.
-- El delete queda sin chequeo de acceso a propósito: es lo que corre la app al
-- cerrar sesión, y que el token del suspendido se borre está bien.
create policy "tokens propios - select" on push_tokens for select using (member_id = auth.uid() or is_admin());
create policy "tokens propios - insert" on push_tokens for insert with check (member_id = auth.uid() and tiene_acceso());
create policy "tokens propios - update" on push_tokens for update
  using (member_id = auth.uid() and tiene_acceso()) with check (member_id = auth.uid() and tiene_acceso());
create policy "tokens propios - delete" on push_tokens for delete using (member_id = auth.uid() or is_admin());

-- Mascotas: del dueño, pero el INSERT va aparte. Las preguntas de salud son por
-- mascota, así que dejar insertar directo permitía sumar una mascota después del
-- alta sin declararla — el mismo agujero que cierra el alta, por otra puerta. El
-- socio pasa por `agregar_mascota()`, que crea la mascota y su declaración en una
-- transacción; el alta corre con la service-role key y no mira políticas.
create policy "mascotas del dueño - select" on pets for select
  using ((owner_id = auth.uid() and tiene_acceso()) or is_admin());
create policy "mascotas del dueño - update" on pets for update
  using ((owner_id = auth.uid() and tiene_acceso()) or is_admin())
  with check ((owner_id = auth.uid() and tiene_acceso()) or is_admin());
create policy "mascotas del dueño - delete" on pets for delete
  using ((owner_id = auth.uid() and tiene_acceso()) or is_admin());
create policy "mascotas - alta del admin" on pets for insert
  with check (is_admin());

-- Cada socio ve y maneja SÓLO sus bloqueos. Nadie puede averiguar quién lo bloqueó.
create policy "mis bloqueos - ver" on member_blocks for select
  using (blocker_id = auth.uid());
create policy "mis bloqueos - bloquear" on member_blocks for insert
  with check (blocker_id = auth.uid());
create policy "mis bloqueos - desbloquear" on member_blocks for delete
  using (blocker_id = auth.uid());

create policy "vacunas del dueño" on vaccinations for all
  using (exists (select 1 from pets p where p.id = pet_id and ((p.owner_id = auth.uid() and tiene_acceso()) or is_admin())))
  with check (exists (select 1 from pets p where p.id = pet_id and ((p.owner_id = auth.uid() and tiene_acceso()) or is_admin())));

-- Declaración jurada: se lee y se firma, no se edita ni se borra. Una
-- declaración que el firmante puede reescribir después no declara nada, así que
-- a propósito NO hay políticas de update ni de delete: ni el socio ni el admin
-- pueden tocarla desde la app.
create policy "el socio ve su declaración" on health_declarations for select
  using ((auth.uid() = member_id and tiene_acceso()) or is_admin());
create policy "el socio firma su declaración" on health_declarations for insert
  with check (auth.uid() = member_id and tiene_acceso());

-- Reintegros: el socio ve/crea los suyos; solo admin cambia estado. El chequeo de
-- acceso es el que más importa de todos: sin él, una cuenta suspendida podía
-- seguir pidiendo plata.
-- Las dos preguntas encadenadas: el suspendido no pide plata (tiene_acceso) y el
-- socio gratuito tampoco (tiene_plan_pago).
create policy "reintegros del socio - select" on reimbursements for select
  using ((member_id = auth.uid() and tiene_acceso() and tiene_plan_pago()) or is_admin());
create policy "reintegros del socio - insert" on reimbursements for insert
  with check (member_id = auth.uid() and tiene_acceso() and tiene_plan_pago());
create policy "reintegros - admin update" on reimbursements for update using (is_admin());

-- Comunidad: se lee y se escribe con sesión; el admin modera.
--
-- La lectura era pública ("el foro se ve sin cuenta") y se cerró: un posteo lleva
-- el nombre del autor, su zona y a veces la dirección de una mascota perdida, y con
-- la anon key —que es pública por diseño— eso se leía sin tener cuenta.
create policy "posts visibles"  on community_posts for select using (tiene_acceso());
create policy "posts crear"     on community_posts for insert with check (author_id = auth.uid() and tiene_acceso());
create policy "posts editar"    on community_posts for update using ((author_id = auth.uid() and tiene_acceso()) or is_admin());
create policy "posts borrar"    on community_posts for delete using ((author_id = auth.uid() and tiene_acceso()) or is_admin());
create policy "respuestas visibles" on community_answers for select using (tiene_acceso());
create policy "respuestas crear"    on community_answers for insert with check (author_id = auth.uid() and tiene_acceso());
create policy "respuestas moderar"  on community_answers for update using ((author_id = auth.uid() and tiene_acceso()) or is_admin());
-- Sin política de delete nadie borra: la respuesta propia quedaba para siempre.
create policy "respuestas borrar"   on community_answers for delete using ((author_id = auth.uid() and tiene_acceso()) or is_admin());

-- Likes: se cuentan para quien entró al club, y cada socio maneja los suyos.
create policy "likes visibles" on post_likes for select using (tiene_acceso());
create policy "like propio"    on post_likes for all
  using (member_id = auth.uid() and tiene_acceso()) with check (member_id = auth.uid() and tiene_acceso());
create policy "likes de respuesta visibles" on answer_likes for select using (tiene_acceso());
create policy "like de respuesta propio"    on answer_likes for all
  using (member_id = auth.uid() and tiene_acceso()) with check (member_id = auth.uid() and tiene_acceso());

-- Contactos de emergencia: del dueño
create policy "emergencias del dueño" on emergency_contacts for all
  using (owner_id = auth.uid() and tiene_acceso()) with check (owner_id = auth.uid() and tiene_acceso());

-- Guardados: cada socio ve y maneja solo los suyos (el admin no los necesita)
create policy "guardados del socio" on provider_favorites for all
  using (member_id = auth.uid() and tiene_acceso()) with check (member_id = auth.uid() and tiene_acceso());

-- Reseñas: las de un prestador publicado son públicas; cada socio edita la suya
create policy "reseñas visibles" on provider_reviews for select
  using (exists (select 1 from providers p where p.id = provider_id and p.status = 'verificado') or member_id = auth.uid() or is_admin());
create policy "reseña propia - insert" on provider_reviews for insert
  with check (member_id = auth.uid() and tiene_acceso());
create policy "reseña propia - update" on provider_reviews for update
  using (member_id = auth.uid() and tiene_acceso()) with check (member_id = auth.uid() and tiene_acceso());
create policy "reseña propia - delete" on provider_reviews for delete
  using ((member_id = auth.uid() and tiene_acceso()) or is_admin());

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
--  LA CUOTA
-- ============================================================
-- Ver las migraciones `20260818120000_cuota_y_pagos.sql` y
-- `20260818130000_acreditar_pago_arreglos.sql`, que son la fuente de verdad de
-- esta parte: ahí están `acreditar_pago()` —que es donde vive todo lo delicado de
-- concurrencia— y el permiso mínimo que necesita el trigger de perfiles.
--
-- Acá queda la forma de las tablas, para que `supabase db reset` la levante y para
-- que esto siga siendo comparable con `packages/shared/src/types.ts`.
do $$ begin
  create type payment_status as enum ('pendiente', 'aprobado', 'rechazado', 'devuelto');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_method as enum ('mercadopago', 'manual');
exception when duplicate_object then null; end $$;

-- `profiles.paid_until`: hasta cuándo tiene la cuota paga. Null = nunca pagó. Si
-- es menor a hoy, la webapp le pone el muro. Solo la escribe acreditar_pago().
alter table profiles add column if not exists paid_until date;

create table if not exists payments (
  id          uuid primary key default uuid_generate_v4(),
  member_id   uuid not null references profiles(id) on delete cascade,
  -- El plan y el monto quedan congelados: el precio cambia y un pago tiene que
  -- poder explicarse a sí mismo dentro de dos años.
  plan_id     uuid references plans(id),
  plan_name   text,
  amount      integer not null check (amount > 0),
  status      payment_status not null default 'pendiente',
  method      payment_method not null default 'mercadopago',
  -- Hasta dónde llevó la cuota este pago. Se calcula al acreditar, no al crear.
  covers_until date,
  external_reference text unique,
  mp_preference_id   text,
  mp_payment_id      text,
  init_point  text,
  registered_by uuid references profiles(id),
  detail      text,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);

-- Un pago de Mercado Pago se acredita UNA vez, por más veces que avise.
create unique index if not exists payments_mp_payment_id_uniq
  on payments (mp_payment_id) where mp_payment_id is not null;
-- Un solo intento abierto por socio: dos clics en "Pagar" reusan la preferencia.
create unique index if not exists payments_un_pendiente_por_socio
  on payments (member_id) where status = 'pendiente';
create index if not exists payments_member_idx on payments (member_id, created_at desc);

alter table payments enable row level security;
-- El socio ve su historial de cuotas pero no escribe ninguna: los pagos los crea
-- el servidor y los acredita acreditar_pago(). Si pudiera insertar, se regalaría
-- el acceso al club.
create policy "pagos propios - select" on payments for select
  using (member_id = auth.uid() or is_admin());
create policy "pagos - admin escribe" on payments for all
  using (is_admin()) with check (is_admin());

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

-- ============================================================
--  Lo que el alta dejó de escribir cuando entrar pasó a ser gratis
-- ============================================================
comment on column public.profiles.pay_method is
  'Como paga la cuota. El alta ya NO lo escribe: el medio real es Mercado Pago, y el check de la columna solo acepta tarjeta o cbu. Queda para los socios que se dieron de alta antes.';

comment on column public.profiles.card_last4 is
  'Ultimos 4 de la tarjeta. El alta ya NO los pide: la tarjeta se tipea en el sitio de Mercado Pago y Kumo no la ve. Queda para los socios viejos; lo correcto a futuro es tomarlos del pago que informa el webhook.';

comment on column public.profiles.bank_cbu is
  'Cuenta donde el club transfiere los REINTEGROS (no es el medio de cobro de la cuota). Ya no se pide en el alta: se pide al cargar el primer reintegro, que es cuando recien hace falta.';

comment on column public.profiles.contract_accepted_at is
  'Cuando acepto las condiciones de la cuota. Null en las altas gratuitas: no hay cuota ni carencias que aceptar, asi que ademas marca a los socios que si firmaron una cuota.';

-- ============================================================
--  Borrar un socio (con todo lo suyo) y borrar un cobro
-- ============================================================
-- El panel solo podia dar de BAJA, que es reversible. Esto borra de verdad: hace
-- falta para limpiar socios de prueba y para cumplir un pedido de supresion de
-- datos (Ley 25.326). Ver el detalle en la migracion 20260820180000.
/* ── Borrar un socio ────────────────────────────────────────── */
create or replace function public.borrar_socio(p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  quien    record;
  negocios integer;
  posts    integer;
  respuest integer;
  mascotas integer;
  reint    integer;
  pagos    integer;
begin
  select id, role, full_name, member_no into quien from public.profiles where id = p_member_id;
  if not found then
    raise exception 'No existe ese socio.';
  end if;
  /*
   * Solo socios. Dos motivos: un admin borrado se lleva puesto el
   * `payments.registered_by` de cada cobro que registró a mano (la FK no cascadea y
   * el borrado fallaría a mitad de camino), y un prestador con cuenta se maneja
   * desde su propia pantalla.
   */
  if quien.role <> 'socio' then
    raise exception 'Solo se pueden borrar socios (este perfil es %).', quien.role;
  end if;

  -- Se cuenta ANTES de borrar: después no hay a quién preguntarle.
  select count(*) into mascotas from public.pets where owner_id = p_member_id;
  select count(*) into reint from public.reimbursements where member_id = p_member_id;
  select count(*) into pagos from public.payments where member_id = p_member_id;

  with fuera as (
    delete from public.community_answers where author_id = p_member_id returning 1
  ) select count(*) into respuest from fuera;

  with fuera as (
    delete from public.community_posts where author_id = p_member_id returning 1
  ) select count(*) into posts from fuera;

  with fuera as (
    delete from public.providers where owner_id = p_member_id returning 1
  ) select count(*) into negocios from fuera;

  -- Y el perfil, que arrastra todo lo que cascadea.
  delete from public.profiles where id = p_member_id;

  return jsonb_build_object(
    'socio', quien.full_name,
    'numero', quien.member_no,
    'mascotas', mascotas,
    'reintegros', reint,
    'pagos', pagos,
    'negocios', negocios,
    'publicaciones', posts,
    'respuestas', respuest
  );
end $$;

comment on function public.borrar_socio(uuid) is
  'Borra un socio y todo lo suyo en una transaccion, y devuelve el resumen de lo borrado. NO cancela la suscripcion de Mercado Pago ni borra las fotos del bucket ni el usuario de auth: eso lo hace /api/socios/borrar antes y despues. Solo la service-role puede llamarla.';

revoke all on function public.borrar_socio(uuid) from public, anon, authenticated;

/* ── Borrar un cobro ────────────────────────────────────────── */
-- `paid_until` queda donde llegan los cobros que sobreviven, no restando un mes:
-- restando, borrar un cobro del medio dejaba la fecha peleada con lo que declaran
-- los cobros que quedan. Ver la migración 20260820200000.
create or replace function public.borrar_pago(p_pago_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pago  record;
  antes date;
  nueva date;
begin
  select id, member_id, amount, status, method
    into pago
    from public.payments
   where id = p_pago_id;
  if not found then
    raise exception 'No existe ese cobro.';
  end if;

  select paid_until into antes from public.profiles where id = pago.member_id for update;

  delete from public.payments where id = p_pago_id;

  -- Un cobro rechazado o pendiente nunca movió la cuota, así que no hay nada que
  -- recalcular: se borra la fila y listo.
  if pago.status = 'aprobado' then
    select max(covers_until) into nueva
      from public.payments
     where member_id = pago.member_id and status = 'aprobado';

    perform set_config('kumo.acreditando', 'on', true);
    update public.profiles set paid_until = nueva where id = pago.member_id;
    perform set_config('kumo.acreditando', 'off', true);
  else
    nueva := antes;
  end if;

  return jsonb_build_object(
    'socio', pago.member_id,
    'monto', pago.amount,
    'estado', pago.status,
    'pagaba_hasta', antes,
    'paga_hasta', nueva
  );
end $$;

comment on function public.borrar_pago(uuid) is
  'Borra un cobro y deja `paid_until` en la fecha mas lejana que declaren los cobros aprobados que quedan (null si no queda ninguno). No resta meses: restando, borrar un cobro del medio dejaba la cuota peleada con lo que dicen los cobros que sobreviven. Solo la service-role.';

revoke all on function public.borrar_pago(uuid) from public, anon, authenticated;

