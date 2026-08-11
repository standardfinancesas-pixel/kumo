-- Permisos de escritura para las fotos de mascotas.
--
-- El bucket `pet-photos` se creó a mano y nunca tuvo políticas: solo podía
-- escribir en él la service-role key (el alta de socio, que corre en el
-- servidor). Por eso un socio no podía cambiar la foto de su mascota desde su
-- cuenta: la RLS lo rechazaba con "new row violates row-level security policy".
--
-- El bucket sigue siendo PÚBLICO para lectura (una foto de mascota no es dato
-- sensible y así se puede mostrar con una URL directa, sin firmar).
-- La convención de ruta es '{owner_id}/{archivo}', igual que en `receipts`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-photos', 'pet-photos', true, 5242880,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "fotos de mascota - sube el dueño" on storage.objects;
create policy "fotos de mascota - sube el dueño"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reemplazar la foto: el socio sobrescribe o borra la anterior en su carpeta.
drop policy if exists "fotos de mascota - actualiza el dueño" on storage.objects;
create policy "fotos de mascota - actualiza el dueño"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos de mascota - borra el dueño" on storage.objects;
create policy "fotos de mascota - borra el dueño"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
