-- Bloquear a una persona en el foro.
--
-- Lo exige la regla 1.2 de la App Store: una app con contenido de usuarios tiene
-- que ofrecer las TRES cosas —filtrar, reportar y bloquear— más un contacto
-- publicado. Kumo tenía reportar y le faltaba bloquear, y Apple lo pidió por
-- escrito al revisar la primera versión (03/09/2026).
--
-- Pero además hace falta igual: reportar es pedirle algo al club y esperar. Con
-- alguien que te molesta, la persona necesita poder cortar el contacto ella misma
-- y en el momento, sin depender de que un admin llegue a mirarlo.
--
-- El bloqueo es de ida y de una sola dirección: esconde de TU foro lo que escribió
-- esa persona (publicaciones y respuestas). No la borra ni le avisa —avisarle es
-- exactamente lo que hace escalar un conflicto— y no le impide seguir usando el
-- club: para eso está el reporte, que sí llega al club y puede terminar en una
-- suspensión.
create table if not exists member_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  -- El nombre va copiado, igual que en `community_posts.author_name` y por lo
  -- mismo: la RLS de `profiles` no deja leer el perfil de otro socio, así que sin
  -- esto la lista de "Personas bloqueadas" sería una lista de identificadores. Lo
  -- manda el cliente desde el nombre que ya tiene en pantalla; acá no hace falta
  -- trigger como en las publicaciones, porque esta fila la ve una sola persona
  -- —quien bloqueó— y firmarla mal solo se confunde a sí misma.
  blocked_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  -- Bloquearse a uno mismo esconde el propio foro: no es un caso de uso, es un bug.
  constraint no_bloquearse_solo check (blocker_id <> blocked_id)
);

-- Para resolver rápido "a quién bloqueé", que es la consulta de cada carga del foro.
create index if not exists member_blocks_blocker_idx on member_blocks (blocker_id);

alter table member_blocks enable row level security;

-- Cada socio ve y maneja SÓLO sus propios bloqueos. Nadie puede averiguar quién lo
-- bloqueó a él: eso es información sobre otra persona, y saberlo es justo lo que
-- convierte un bloqueo silencioso en una pelea.
drop policy if exists "mis bloqueos - ver" on member_blocks;
create policy "mis bloqueos - ver" on member_blocks for select
  using (blocker_id = auth.uid());

drop policy if exists "mis bloqueos - bloquear" on member_blocks;
create policy "mis bloqueos - bloquear" on member_blocks for insert
  with check (blocker_id = auth.uid());

drop policy if exists "mis bloqueos - desbloquear" on member_blocks;
create policy "mis bloqueos - desbloquear" on member_blocks for delete
  using (blocker_id = auth.uid());
