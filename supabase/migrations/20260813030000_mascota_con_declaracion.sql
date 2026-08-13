-- No se agrega una mascota sin declararla.
--
-- El alta ya exige la declaración jurada, pero las preguntas son POR MASCOTA y
-- "Agregar mascota" no pedía nada: desde Mis mascotas y desde mobile se insertaba
-- directo en `pets` con nombre y raza. O sea que alguien se daba de alta con una
-- mascota sana y sumaba después la enferma sin declarar nada. El mismo agujero
-- que cerramos en el alta, entrando por otra puerta.
--
-- Se cierra en la base y no en la pantalla: si dependiera de la UI, un POST a
-- /rest/v1/pets lo saltearía igual. Ahora el socio NO puede insertar en `pets`
-- directamente — tiene que pasar por `agregar_mascota()`, que crea la mascota y
-- su declaración en la misma transacción. Si algo falla, no queda ninguna de las
-- dos. Seguir viendo, editando y borrando las propias no cambia.
--
-- El alta corre con la service-role key, que ignora la RLS, así que no se toca.

-- ── Cuántas preguntas tiene cada versión del cuestionario ──
-- Está en la base para que la función valide que la declaración esté completa sin
-- tener el cuestionario escrito adentro: cuando cambie, se agrega una fila con la
-- versión nueva y las declaraciones viejas siguen siendo válidas.
create table if not exists declaracion_versions (
  version             integer primary key,
  preguntas_salud     integer not null,
  preguntas_sanitario integer not null
);

insert into declaracion_versions (version, preguntas_salud, preguntas_sanitario)
  values (1, 7, 4)
  on conflict (version) do update
    set preguntas_salud = excluded.preguntas_salud,
        preguntas_sanitario = excluded.preguntas_sanitario;

alter table declaracion_versions enable row level security;
drop policy if exists "versiones visibles" on declaracion_versions;
create policy "versiones visibles" on declaracion_versions for select using (true);

-- ── Alta de mascota + declaración, en una sola transacción ──
create or replace function agregar_mascota(
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
  quien   uuid := auth.uid();
  nueva   uuid;
  esperadas record;
begin
  if quien is null then
    raise exception 'Hay que estar identificado para agregar una mascota.';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'La mascota necesita un nombre.';
  end if;

  select preguntas_salud, preguntas_sanitario into esperadas
  from declaracion_versions where version = p_version;
  if not found then
    raise exception 'Versión de declaración desconocida: %', p_version;
  end if;

  -- La declaración tiene que estar completa y firmada. Media declaración jurada
  -- no se firma, y una con menos respuestas de las que tiene el cuestionario es
  -- una declaración recortada.
  if p_signature is null or length(trim(p_signature)) < 3 then
    raise exception 'Falta firmar la declaración jurada.';
  end if;
  if jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) <> esperadas.preguntas_salud
     or jsonb_array_length(coalesce(p_sanitary, '[]'::jsonb)) <> esperadas.preguntas_sanitario then
    raise exception 'La declaración jurada está incompleta.';
  end if;

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

revoke all on function agregar_mascota(text, text, text, text, boolean, numeric, numeric, text, text, text, integer, jsonb, jsonb, text) from public;
grant execute on function agregar_mascota(text, text, text, text, boolean, numeric, numeric, text, text, text, integer, jsonb, jsonb, text) to authenticated;

-- ── El socio ya no inserta en `pets` directamente ──
-- La política era `for all`, que incluía el insert. Se abre en tres para dejar
-- select/update/delete como estaban y quitar solo el insert: la única vía es la
-- función, que obliga a la declaración.
drop policy if exists "mascotas del dueño" on pets;

create policy "mascotas del dueño - select" on pets for select
  using (owner_id = auth.uid() or is_admin());
create policy "mascotas del dueño - update" on pets for update
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());
create policy "mascotas del dueño - delete" on pets for delete
  using (owner_id = auth.uid() or is_admin());
-- Insert: solo admin. El socio pasa por agregar_mascota(); el alta corre con la
-- service-role key y no mira políticas.
create policy "mascotas - alta del admin" on pets for insert
  with check (is_admin());
