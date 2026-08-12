-- Prestadores guardados ("Guardados" en Servicios y "Mis guardados" en la app).
--
-- El corazón del detalle del prestador y la pantalla de guardados existían en la
-- interfaz pero no tenían dónde guardar nada: en el prototipo es estado local que
-- se pierde al recargar. Con esta tabla el guardado es real y lo comparten la
-- webapp y la app móvil.

create table if not exists provider_favorites (
  member_id   uuid not null references profiles(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (member_id, provider_id)
);

alter table provider_favorites enable row level security;

-- Cada socio ve y maneja solo los suyos. No hay caso de uso para que el admin
-- lea los favoritos de alguien, así que no se le da acceso.
drop policy if exists "guardados del socio" on provider_favorites;
create policy "guardados del socio" on provider_favorites for all
  using (member_id = auth.uid())
  with check (member_id = auth.uid());
