-- El nombre del autor lo pone la base, no el cliente.
--
-- Al copiar `author_name` en las filas (para esquivar que la RLS de `profiles` no
-- deja leer el perfil ajeno) quedó como texto libre que manda la app. Probado con
-- la sesión de un socio real: podía publicar en el foro y dejar reseñas firmando
-- "Florencia". Suplantación de identidad dentro del club.
--
-- Se resuelve tomando el nombre del perfil del autor en el trigger e ignorando lo
-- que venga del cliente. Así sigue sirviendo para mostrarlo sin joins, pero ya no
-- se puede falsear.

create or replace function autor_desde_el_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare quien uuid;
declare nombre text;
begin
  quien := coalesce(new.author_id, new.member_id);
  if quien is null then
    return new;
  end if;
  select split_part(full_name, ' ', 1) into nombre from profiles where id = quien;
  new.author_name := coalesce(nullif(trim(nombre), ''), 'Socio');
  return new;
end $$;

drop trigger if exists posts_autor_guard on community_posts;
create trigger posts_autor_guard before insert or update on community_posts
  for each row execute function autor_desde_el_perfil();

drop trigger if exists answers_autor_guard on community_answers;
create trigger answers_autor_guard before insert or update on community_answers
  for each row execute function autor_desde_el_perfil();

drop trigger if exists reviews_autor_guard on provider_reviews;
create trigger reviews_autor_guard before insert or update on provider_reviews
  for each row execute function autor_desde_el_perfil();

-- Realinear lo que ya está cargado con el nombre real de cada autor.
update community_posts p set author_name = coalesce(nullif(trim(split_part(pr.full_name, ' ', 1)), ''), 'Socio')
  from profiles pr where pr.id = p.author_id;
update community_answers a set author_name = coalesce(nullif(trim(split_part(pr.full_name, ' ', 1)), ''), 'Socio')
  from profiles pr where pr.id = a.author_id;
update provider_reviews r set author_name = coalesce(nullif(trim(split_part(pr.full_name, ' ', 1)), ''), 'Socio')
  from profiles pr where pr.id = r.member_id;
