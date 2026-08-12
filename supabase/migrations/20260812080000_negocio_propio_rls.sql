-- El dueño no podía tocar su propio negocio.
--
-- `providers` solo tenía política de UPDATE para el admin y ninguna de DELETE, así
-- que dos cosas que la interfaz ofrecía fallaban en silencio: editar los datos del
-- negocio publicado (el update afectaba 0 filas y la app se recargaba como si
-- hubiera guardado) y "Dar de baja mi negocio" (el delete no borraba nada).
--
-- El estado sigue siendo cosa del club: el dueño puede editar sus datos pero no
-- auto-verificarse, así que el update le prohíbe mover `status`.

drop policy if exists "prestador edita lo suyo" on providers;
create policy "prestador edita lo suyo" on providers for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "prestador borra lo suyo" on providers;
create policy "prestador borra lo suyo" on providers for delete
  using (owner_id = auth.uid() or is_admin());

-- Que el dueño no pueda cambiarse el estado a sí mismo. Un trigger y no la
-- política, porque la RLS no puede comparar el valor viejo con el nuevo.
create or replace function providers_status_solo_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and not is_admin() then
    new.status := old.status;
  end if;
  return new;
end $$;

drop trigger if exists providers_status_guard on providers;
create trigger providers_status_guard before update on providers
  for each row execute function providers_status_solo_admin();
