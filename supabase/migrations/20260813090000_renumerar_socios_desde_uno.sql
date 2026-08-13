-- Los socios arrancan en el 1.
--
-- El contador venía de un `serial` que corría para todos los perfiles, así que
-- los tres socios que existen tenían los números 20, 26 y 61 —los huecos son
-- perfiles de prueba que se crearon y se borraron— y el próximo iba a ser el 64.
-- Un padrón que arranca en 20 y salta a 61 no se puede explicar.
--
-- ESTO SE HACE UNA SOLA VEZ Y AHORA: renumerar es aceptable únicamente porque
-- todavía no hay ningún socio real que haya visto su número en un carnet. Con
-- socios de verdad, cambiarle el número a alguien es cambiarle la identidad; a
-- partir de acá los huecos se aceptan y no se renumera nunca más.
--
-- El orden es por `created_at` (cuándo se creó la fila) y no por `joined_on`: el
-- socio de demostración tiene una fecha de alta inventada y anterior, y ordenando
-- por ahí se quedaba con el #1.

alter table public.profiles disable trigger profiles_campos_guard;

-- Dos pasos por la restricción de unicidad: si se asignara 1, 2, 3 de una, un
-- número destino podría chocar con el que todavía tiene otra fila. Se los corre
-- fuera de rango primero.
update public.profiles
   set member_no = member_no + 10000
 where role = 'socio' and member_no is not null;

with orden as (
  select id, row_number() over (order by created_at) as nuevo
    from public.profiles
   where role = 'socio' and member_no is not null
)
update public.profiles p
   set member_no = o.nuevo
  from orden o
 where p.id = o.id;

alter table public.profiles enable trigger profiles_campos_guard;

-- La secuencia sigue desde el último número en uso: el próximo socio es el 4.
select setval(
  'public.profiles_member_no_seq',
  (select coalesce(max(member_no), 0) from public.profiles where member_no is not null),
  true
);
