-- La edad de una mascota era un número, y los números envejecen mal.
--
-- `pets.age_years` guarda un número de años que alguien escribió una vez. El
-- cachorro que hoy se carga con 3 meses va a seguir diciendo 3 meses el año que
-- viene, porque nadie vuelve a entrar a corregirlo. Y ni siquiera se podían poner
-- meses: el campo pide años, así que un cachorro de 3 meses entraba como 0.
--
-- Con la fecha de nacimiento la edad se calcula sola y nunca queda vieja. Para una
-- app de salud eso no es cosmética: el calendario de vacunas de un cachorro se
-- mide en SEMANAS —las primeras dosis van a las 6, 8 y 12— y contra una edad
-- congelada esa cuenta no se puede hacer nunca.
--
-- `age_years` NO se borra: las mascotas ya cargadas conservan su número y se
-- muestran con él hasta que alguien las edite. Inventarles una fecha a partir de
-- "5 años" sería escribir un dato que nadie dijo.
--
-- Las dos funciones que insertan mascotas se recrean con la columna nueva. El
-- cuerpo es el mismo de la migración del 20/08 (la última que las definió): acá
-- sólo se agrega `birth_date`.

alter table pets add column if not exists birth_date date;

comment on column public.pets.birth_date is
  'Fecha de nacimiento. Es lo que se pide desde el 28/09/2026: la edad se calcula de acá y no envejece. `age_years` queda para las mascotas cargadas antes.';

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

    insert into pets (owner_id, name, type, breed, sex, neutered, age_years, birth_date, weight_kg, microchip, vet_name, photo_url)
    values (
      p_member,
      trim(m->>'nombre'),
      coalesce(nullif(m->>'tipo', ''), 'perro')::pet_type,
      nullif(trim(coalesce(m->>'raza', '')), ''),
      nullif(trim(coalesce(m->>'sexo', '')), ''),
      coalesce((m->>'castrada')::boolean, false),
      (m->>'edad')::numeric,
      nullif(trim(coalesce(m->>'fnac', '')), '')::date,
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
end $$;;

-- Se recrea entera porque cambia la firma: ver la nota de abajo.
drop function if exists public.agregar_mascota(text, text, text, text, boolean, numeric, numeric, text, text, text, integer, jsonb, jsonb, text);

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
  p_signature text,
  p_birth_date date default null
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

  insert into pets (owner_id, name, type, breed, sex, neutered, age_years, birth_date, weight_kg, microchip, vet_name, photo_url)
  values (
    quien, trim(p_name), coalesce(nullif(p_type, ''), 'perro')::pet_type, nullif(trim(coalesce(p_breed, '')), ''),
    nullif(trim(coalesce(p_sex, '')), ''), coalesce(p_neutered, false), p_age_years, p_birth_date, p_weight_kg,
    nullif(trim(coalesce(p_microchip, '')), ''), nullif(trim(coalesce(p_vet_name, '')), ''),
    nullif(trim(coalesce(p_photo_url, '')), '')
  )
  returning id into nueva;

  insert into health_declarations (member_id, pet_id, pet_name, version, answers, sanitary, signature)
  values (quien, nueva, trim(p_name), p_version, p_answers, p_sanitary, trim(p_signature));

  return nueva;
end $$;;


-- El drop es necesario y no es opcional: `create or replace` no puede cambiar la
-- firma, así que agregar un parámetro crearía una SEGUNDA función con el mismo
-- nombre. Con las dos vivas, una llamada por nombre queda ambigua y PostgREST
-- responde que la función no es única. Y como el drop se lleva los permisos, hay
-- que reponerlos.

comment on function public.crear_mascotas_del_alta(uuid, integer, text, jsonb) is
  'Crea las N mascotas del alta con su declaracion jurada, en una transaccion: si una falla no queda ninguna. El socio viaja por parametro porque en el alta con contrasena todavia no hay sesion, y por eso SOLO la puede llamar el servidor (ver el revoke).';
revoke all on function public.crear_mascotas_del_alta(uuid, integer, text, jsonb) from public, anon, authenticated;
