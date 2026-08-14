-- ============================================================
--  El estado del socio también manda en la RLS
-- ============================================================
-- Hasta acá el corte del socio sin acceso vivía en las pantallas: /app, el
-- middleware y la app móvil lo devuelven a la portada. Pero el token que el
-- celular ya tenía guardado sigue sirviendo hasta que venza (una hora), y con
-- ese token la API contestaba igual: podía leer su carnet y hasta cargar un
-- reintegro nuevo. Las políticas mandan más que cualquier pantalla, así que el
-- estado se chequea acá.
--
-- Se deja pasar a propósito la LECTURA del propio perfil: es lo que la portada
-- necesita para poder decirle "tu cuenta está suspendida" en vez de dejarlo
-- adivinando por qué no entra.

-- ¿El que está pidiendo tiene acceso al club?
create or replace function tiene_acceso()
returns boolean language sql stable security definer set search_path = public as $$
  -- Lista blanca y no negra: si mañana aparece un estado nuevo, lo seguro es
  -- que no dé acceso hasta que alguien lo decida.
  -- Al prestador y al admin no los toca: su acceso no depende de la cuota.
  select coalesce(
    (select p.role <> 'socio' or p.status in ('activo', 'moroso')
       from profiles p where p.id = auth.uid()),
    false);
$$;

-- Perfil: leerlo sí (para el aviso), editarlo no.
drop policy if exists "perfil propio - update" on profiles;
create policy "perfil propio - update" on profiles for update
  using ((id = auth.uid() and tiene_acceso()) or is_admin());

-- Push: no registra dispositivos nuevos. El delete queda libre a propósito: es
-- lo que corre la app al cerrar sesión, y que el token se borre está bien.
drop policy if exists "tokens propios - insert" on push_tokens;
create policy "tokens propios - insert" on push_tokens for insert
  with check (member_id = auth.uid() and tiene_acceso());
drop policy if exists "tokens propios - update" on push_tokens;
create policy "tokens propios - update" on push_tokens for update
  using (member_id = auth.uid() and tiene_acceso())
  with check (member_id = auth.uid() and tiene_acceso());

-- Mascotas y carnet
drop policy if exists "mascotas del dueño - select" on pets;
create policy "mascotas del dueño - select" on pets for select
  using ((owner_id = auth.uid() and tiene_acceso()) or is_admin());
drop policy if exists "mascotas del dueño - update" on pets;
create policy "mascotas del dueño - update" on pets for update
  using ((owner_id = auth.uid() and tiene_acceso()) or is_admin())
  with check ((owner_id = auth.uid() and tiene_acceso()) or is_admin());
drop policy if exists "mascotas del dueño - delete" on pets;
create policy "mascotas del dueño - delete" on pets for delete
  using ((owner_id = auth.uid() and tiene_acceso()) or is_admin());

drop policy if exists "vacunas del dueño" on vaccinations;
create policy "vacunas del dueño" on vaccinations for all
  using (exists (select 1 from pets p where p.id = pet_id and ((p.owner_id = auth.uid() and tiene_acceso()) or is_admin())))
  with check (exists (select 1 from pets p where p.id = pet_id and ((p.owner_id = auth.uid() and tiene_acceso()) or is_admin())));

drop policy if exists "el socio ve su declaración" on health_declarations;
create policy "el socio ve su declaración" on health_declarations for select
  using ((auth.uid() = member_id and tiene_acceso()) or is_admin());
drop policy if exists "el socio firma su declaración" on health_declarations;
create policy "el socio firma su declaración" on health_declarations for insert
  with check (auth.uid() = member_id and tiene_acceso());

-- Reintegros: lo más importante de cerrar. Sin esto, una cuenta suspendida
-- podía seguir pidiendo plata.
drop policy if exists "reintegros del socio - select" on reimbursements;
create policy "reintegros del socio - select" on reimbursements for select
  using ((member_id = auth.uid() and tiene_acceso()) or is_admin());
drop policy if exists "reintegros del socio - insert" on reimbursements;
create policy "reintegros del socio - insert" on reimbursements for insert
  with check (member_id = auth.uid() and tiene_acceso());

-- Comunidad: la lectura sigue siendo pública (el foro se ve sin cuenta), lo que
-- se corta es escribir.
drop policy if exists "posts crear" on community_posts;
create policy "posts crear" on community_posts for insert
  with check (author_id = auth.uid() and tiene_acceso());
drop policy if exists "posts editar" on community_posts;
create policy "posts editar" on community_posts for update
  using ((author_id = auth.uid() and tiene_acceso()) or is_admin());
drop policy if exists "posts borrar" on community_posts;
create policy "posts borrar" on community_posts for delete
  using ((author_id = auth.uid() and tiene_acceso()) or is_admin());

drop policy if exists "respuestas crear" on community_answers;
create policy "respuestas crear" on community_answers for insert
  with check (author_id = auth.uid() and tiene_acceso());
drop policy if exists "respuestas moderar" on community_answers;
create policy "respuestas moderar" on community_answers for update
  using ((author_id = auth.uid() and tiene_acceso()) or is_admin());
drop policy if exists "respuestas borrar" on community_answers;
create policy "respuestas borrar" on community_answers for delete
  using ((author_id = auth.uid() and tiene_acceso()) or is_admin());

drop policy if exists "like propio" on post_likes;
create policy "like propio" on post_likes for all
  using (member_id = auth.uid() and tiene_acceso())
  with check (member_id = auth.uid() and tiene_acceso());
drop policy if exists "like de respuesta propio" on answer_likes;
create policy "like de respuesta propio" on answer_likes for all
  using (member_id = auth.uid() and tiene_acceso())
  with check (member_id = auth.uid() and tiene_acceso());

drop policy if exists "emergencias del dueño" on emergency_contacts;
create policy "emergencias del dueño" on emergency_contacts for all
  using (owner_id = auth.uid() and tiene_acceso())
  with check (owner_id = auth.uid() and tiene_acceso());

drop policy if exists "guardados del socio" on provider_favorites;
create policy "guardados del socio" on provider_favorites for all
  using (member_id = auth.uid() and tiene_acceso())
  with check (member_id = auth.uid() and tiene_acceso());

-- Reseñas: las de un prestador publicado siguen siendo públicas; lo que se
-- corta es dejar una nueva o tocar la propia.
drop policy if exists "reseña propia - insert" on provider_reviews;
create policy "reseña propia - insert" on provider_reviews for insert
  with check (member_id = auth.uid() and tiene_acceso());
drop policy if exists "reseña propia - update" on provider_reviews;
create policy "reseña propia - update" on provider_reviews for update
  using (member_id = auth.uid() and tiene_acceso())
  with check (member_id = auth.uid() and tiene_acceso());
drop policy if exists "reseña propia - delete" on provider_reviews;
create policy "reseña propia - delete" on provider_reviews for delete
  using ((member_id = auth.uid() and tiene_acceso()) or is_admin());

-- ============================================================
--  Las dos funciones `security definer` también chequean
-- ============================================================
-- Corren con los permisos del que las creó, así que se saltean las políticas de
-- arriba: sin este chequeo quedaban como la puerta de atrás justo de las dos
-- cosas que el socio no puede hacer con un update común.

create or replace function reportar_post(p_post_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Hay que tener sesión para reportar.';
  end if;
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
  quien     uuid := auth.uid();
  nueva     uuid;
  esperadas record;
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
