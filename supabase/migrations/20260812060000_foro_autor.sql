-- El nombre del autor en el foro.
--
-- Las pantallas resolvían el autor con un join a `profiles`, pero la RLS de esa
-- tabla solo deja que cada uno lea su propio perfil, así que el join devolvía
-- null y todos los posts de otros socios aparecían firmados como "Socio".
-- Verificado con un post real de otro socio antes de este cambio.
--
-- Se copia el nombre en la fila en vez de abrir `profiles`: la RLS es por fila,
-- no por columna, así que dejar leer el perfil ajeno expondría también mail,
-- teléfono, DNI y domicilio.

alter table community_posts   add column if not exists author_name text not null default '';
alter table community_answers add column if not exists author_name text not null default '';

-- Lo ya cargado se completa desde el perfil (esta migración corre sin RLS).
update community_posts p set author_name = pr.full_name
  from profiles pr where pr.id = p.author_id and p.author_name = '';
update community_answers a set author_name = pr.full_name
  from profiles pr where pr.id = a.author_id and a.author_name = '';
