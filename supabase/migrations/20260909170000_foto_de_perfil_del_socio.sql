-- La foto de perfil del socio.
--
-- Hasta acá el foro mostraba solo el nombre del autor. Con la foto, una respuesta
-- pasa a tener cara — que es la diferencia entre un foro y un tablón de anuncios.
--
-- Tres piezas, y la tercera es la que tiene truco.

-- ── 1. Dónde se guarda la dirección de la foto ──
alter table profiles add column if not exists photo_url text;

comment on column profiles.photo_url is
  'Foto de perfil del socio, en el bucket member-photos. Null = todavía no subió ninguna, y la pantalla dibuja sus iniciales.';

-- ── 2. Dónde se guarda la foto ──
--
-- Bucket propio y no `pet-photos`: una cara y un perro no son el mismo dato, y
-- mezclarlos hace que el día que haya que tratarlos distinto —borrarlas, firmarlas,
-- caducarlas— no se pueda separar una cosa de la otra.
--
-- Público para lectura, igual que las fotos de mascotas: así se muestra con una URL
-- directa, sin firmar, y el navegador la cachea. Implica que cualquiera con el link
-- ve la foto, aunque el foro sea solo para socios. Es la misma decisión que toma casi
-- cualquier app con avatares, y está tomada a sabiendas.
--
-- La convención de ruta es '{socio_id}/{archivo}', igual que en `pet-photos` y
-- `receipts`, y las políticas la usan para que cada uno escriba solo en su carpeta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', true, 5242880,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "foto de perfil - sube el dueño" on storage.objects;
create policy "foto de perfil - sube el dueño"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "foto de perfil - actualiza el dueño" on storage.objects;
create policy "foto de perfil - actualiza el dueño"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "foto de perfil - borra el dueño" on storage.objects;
create policy "foto de perfil - borra el dueño"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3. Cómo ve el foro la foto de OTRO socio ──
--
-- Acá está el problema real. La RLS de `profiles` es por FILA: la política
-- "perfil propio - select" deja a cada uno leer la suya y nada más. Por eso el foro
-- guarda `author_name` copiado en cada publicación, y por eso no alcanza con hacer
-- un join a `profiles` para traer la foto: devolvería null para todo el mundo menos
-- para uno mismo.
--
-- Copiar también la foto adentro de cada publicación —como el nombre— sería lo más
-- corto, pero deja la foto congelada: el socio se cambia el avatar y sus mensajes
-- viejos siguen con el anterior para siempre.
--
-- Entonces: una vista que expone SOLO el id y la foto. No el nombre (ese ya viaja en
-- la publicación), no el mail, no el DNI, no los datos bancarios. Lo único que
-- alguien puede aprender de acá es "el socio tal tiene esta foto", y esa foto ya está
-- en un bucket público. Sin `security_invoker`, así que la vista lee `profiles`
-- salteando la RLS —que es justamente lo que hace falta— con la superficie recortada
-- a dos columnas.
create or replace view fotos_de_socios as
  select id, photo_url from profiles where photo_url is not null;

comment on view fotos_de_socios is
  'Id y foto de los socios que subieron una. Existe porque la RLS de profiles es por fila y el foro necesita la foto del autor de cada publicación. Expone dos columnas a propósito: cualquier cosa que se agregue acá la puede leer cualquier socio.';

revoke all on fotos_de_socios from anon;
grant select on fotos_de_socios to authenticated;
