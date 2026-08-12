-- Un socio podía hacerse admin a sí mismo.
--
-- La política "perfil propio - update" deja a cada uno editar su fila, y la RLS de
-- Postgres es por fila y no por columna: nada impedía un
--   PATCH /rest/v1/profiles?id=eq.<su-id>  {"role":"admin"}
-- Probado con la sesión de un socio real: devolvía 200 y quedaba admin, con lo
-- que a partir de ahí veía todos los perfiles, reintegros y datos bancarios del
-- club. Se revirtió a mano.
--
-- El arreglo va en trigger porque es lo único que puede comparar el valor viejo
-- con el nuevo. Se ignora el cambio en vez de fallar: así el update del resto de
-- los campos sigue funcionando y nadie queda con una pantalla trabada.

create or replace function profiles_campos_protegidos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;

  -- El rol y el número de socio los define el club.
  new.role := old.role;
  new.member_no := old.member_no;
  new.joined_on := old.joined_on;

  -- El estado también, con una excepción: darse de baja es decisión del socio.
  -- Lo que no puede es volver a ponerse 'activo' si el club lo marcó moroso.
  if new.status <> old.status and new.status <> 'baja' then
    new.status := old.status;
  end if;

  return new;
end $$;

drop trigger if exists profiles_campos_guard on profiles;
create trigger profiles_campos_guard before update on profiles
  for each row execute function profiles_campos_protegidos();
