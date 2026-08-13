-- Guardar todo lo que el socio carga en los 5 pasos del alta.
--
-- Hasta acá el alta pedía cinco pasos de datos y guardaba dos y medio. Lo que se
-- descartaba al apretar "Confirmar y unirme":
--
--   A) La declaración jurada de salud completa (paso 4): 7 respuestas sobre
--      preexistencias, 4 sobre plan sanitario, la firma y la aceptación. Es lo
--      más grave: es la base para rechazar un reintegro por preexistencia, y el
--      texto le dice al socio que su firma "equivale a tu firma según la Ley
--      25.506". Pedir una firma invocando una ley y después tirarla es peor que
--      no pedirla.
--   B) La cobertura odontológica (paso 3), que son +$12.000/mes sumados a la
--      cuota que el socio ve y acepta. O sea: plata sin registro.
--   C) El medio de pago elegido y la aceptación del débito (paso 5).
--   D) El domicilio se guardaba concatenado en una sola columna
--      ("calle, localidad, provincia"), así que no se podía segmentar por
--      localidad ni provincia — y el club se organiza por zonas.
--
-- De la tarjeta no se guarda nada y así queda: el CVV no se puede almacenar y
-- guardar el número obliga a certificar PCI DSS. Cuando entre Mercado Pago se
-- guarda el token y los últimos 4 dígitos, que es lo que corresponde.

-- ── Paso 2: el domicilio en tres columnas ──
alter table profiles
  add column if not exists city     text,
  add column if not exists province text;

-- Backfill partiendo desde la derecha, no desde la izquierda: la calle puede
-- tener comas ("Av. Santa Fe 3200, Piso 2") y la provincia es siempre el último
-- segmento. Partir por el primero le asignaría el piso a la localidad.
with partido as (
  select id, string_to_array(address, ',') as parts
  from profiles
  where address is not null and city is null and province is null
)
update profiles p set
  address  = nullif(trim(array_to_string(t.parts[1 : array_length(t.parts, 1) - 2], ',')), ''),
  city     = nullif(trim(t.parts[array_length(t.parts, 1) - 1]), ''),
  province = nullif(trim(t.parts[array_length(t.parts, 1)]), '')
from partido t
where p.id = t.id and array_length(t.parts, 1) >= 3;

-- ── Pasos 3 y 5: lo que el socio contrató y aceptó ──
alter table profiles
  add column if not exists addon_odonto         boolean not null default false,
  add column if not exists monthly_fee_agreed   integer,
  add column if not exists pay_method           text,
  add column if not exists contract_accepted_at timestamptz;

do $$ begin
  alter table profiles add constraint profiles_pay_method_check
    check (pay_method in ('tarjeta', 'cbu'));
exception when duplicate_object then null; end $$;

-- `monthly_fee_agreed` es la cuota que el socio aceptó al firmar, no la de hoy:
-- el precio del plan cambia y el add-on se suma aparte, así que sin este número
-- no se puede reconstruir a qué se comprometió.
comment on column profiles.monthly_fee_agreed is
  'Cuota mensual en ARS que el socio aceptó al darse de alta (plan + add-ons).';

-- ── Paso 4: la declaración jurada ──
-- Guarda el texto de las preguntas junto con las respuestas, no solo un índice:
-- el cuestionario va a cambiar, y una respuesta sin su pregunta no sirve para
-- sostener nada. El servidor arma el par desde la lista canónica de
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

alter table health_declarations enable row level security;

-- Se lee y se inserta, no se edita ni se borra: una declaración jurada que el
-- firmante puede reescribir después no declara nada. Sin políticas de update y
-- delete, ni el socio ni el admin pueden tocarla desde la app (solo la
-- service-role key, que no se usa para esto).
drop policy if exists "el socio ve su declaración" on health_declarations;
create policy "el socio ve su declaración" on health_declarations for select
  using (auth.uid() = member_id or is_admin());

drop policy if exists "el socio firma su declaración" on health_declarations;
create policy "el socio firma su declaración" on health_declarations for insert
  with check (auth.uid() = member_id);
