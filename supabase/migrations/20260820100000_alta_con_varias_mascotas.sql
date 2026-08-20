-- ============================================================
--  El alta puede traer varias mascotas, y entran todas o ninguna
-- ============================================================
-- Hasta acá el alta creaba UNA mascota y su declaración jurada con dos inserts
-- sueltos del route handler. Con varias, esos inserts sueltos tienen un problema
-- peor que la atomicidad: para colgarle a cada declaración su `pet_id` habría que
-- insertar las mascotas de una y emparejar las declaraciones **por orden de
-- devolución**. Postgres devuelve las filas de un VALUES múltiple en orden, pero eso
-- no es un contrato de PostgREST, y una posición desfasada produce una declaración
-- jurada FIRMADA que dice cosas de otro animal. Emparejar por nombre tampoco sirve:
-- dos mascotas se pueden llamar igual.
--
-- Así que el alta de mascotas se cierra en la base, en una transacción: si la
-- tercera falla, no queda ninguna.
--
-- Por qué no se reusa `agregar_mascota()`: esa saca el dueño de `auth.uid()` y exige
-- `tiene_acceso()`. En el alta con contraseña todavía no hay sesión de ninguna clase
-- (el cliente de service-role tiene `auth.uid()` nulo), así que tiraría "hay que
-- estar identificado". Acá el socio viaja por parámetro — y por eso el `revoke` de
-- abajo no es opcional: sin él, cualquier socio podría insertar mascotas a nombre de
-- otro.

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

/* ── Lo que el alta dejó de escribir ────────────────────────── */
comment on column public.profiles.pay_method is
  'Como paga la cuota. El alta ya NO lo escribe: el medio real es Mercado Pago, y el check de la columna solo acepta tarjeta o cbu. Queda para los socios que se dieron de alta antes.';

comment on column public.profiles.card_last4 is
  'Ultimos 4 de la tarjeta. El alta ya NO los pide: la tarjeta se tipea en el sitio de Mercado Pago y Kumo no la ve. Queda para los socios viejos; lo correcto a futuro es tomarlos del pago que informa el webhook.';

comment on column public.profiles.bank_cbu is
  'Cuenta donde el club transfiere los REINTEGROS (no es el medio de cobro de la cuota). Ya no se pide en el alta: se pide al cargar el primer reintegro, que es cuando recien hace falta.';

comment on column public.profiles.contract_accepted_at is
  'Cuando acepto las condiciones de la cuota. Null en las altas gratuitas: no hay cuota ni carencias que aceptar, asi que ademas marca a los socios que si firmaron una cuota.';
