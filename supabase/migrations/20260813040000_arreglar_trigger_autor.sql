-- Arreglo del trigger que puso el nombre del autor: rompía el foro y las reseñas.
--
-- La migración 20260812110000 dejó una función compartida por tres tablas que
-- hacía:
--
--     quien := coalesce(new.author_id, new.member_id);
--
-- En PL/pgSQL eso no es un coalesce de valores: referenciar un campo que la tabla
-- NO tiene revienta en tiempo de ejecución, aunque esté adentro de un coalesce.
-- `community_posts` y `community_answers` tienen `author_id` y no `member_id`;
-- `provider_reviews` tiene `member_id` y no `author_id`. Resultado: cada insert
-- moría con `record "new" has no field "member_id"`, y desde ayer no se podía
-- publicar en el foro, responder, ni dejar una reseña.
--
-- Se lee el campo por jsonb: una clave que no existe da NULL en vez de error, así
-- que la misma función sirve para las tres tablas sin saber cuál es cuál.
--
-- El motivo de que no se detectara: la prueba que encontró la suplantación se
-- corrió ANTES de escribir este trigger y no se volvió a correr después de
-- aplicarlo. Arreglar y verificar son dos pasos, no uno.

create or replace function autor_desde_el_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare quien uuid;
declare nombre text;
begin
  quien := coalesce(
    (to_jsonb(new) ->> 'author_id')::uuid,
    (to_jsonb(new) ->> 'member_id')::uuid
  );
  if quien is null then
    return new;
  end if;
  select split_part(full_name, ' ', 1) into nombre from profiles where id = quien;
  new.author_name := coalesce(nullif(trim(nombre), ''), 'Socio');
  return new;
end $$;
