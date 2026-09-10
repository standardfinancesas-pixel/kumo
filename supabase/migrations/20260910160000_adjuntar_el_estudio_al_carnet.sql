-- El PDF o la foto del estudio, adjuntos a la entrada del carnet.
--
-- Pedido del cliente: que el socio pueda subir el estudio o el certificado de la
-- vacuna y que quede como historial clínico. El historial ya existe —cada mascota
-- tiene su línea de tiempo con vacunas, estudios y reintegros— y las entradas ya
-- se pueden agregar y editar. Lo único que faltaba es el papel.
--
-- Se guarda el CAMINO dentro del bucket y no una URL, por lo mismo que los
-- comprobantes de reintegro: el bucket es privado y las URLs firmadas vencen, así
-- que una URL guardada sería un link muerto en unos minutos.
alter table vaccinations add column if not exists file_path text;

comment on column vaccinations.file_path is
  'Camino dentro del bucket `carnet` del PDF o la foto del estudio. Null = la entrada no tiene adjunto. Se lee con URL firmada.';

-- El bucket es PRIVADO, igual que `receipts` y a diferencia de `pet-photos`.
-- Un análisis de sangre es un dato de salud: no puede quedar detrás de una URL
-- pública que se adivina. La foto de un perro sí, y por eso ese bucket es abierto.
--
-- 10 MB porque un PDF de un estudio con imágenes pesa más que una foto, y los
-- tipos incluyen application/pdf, que es como los manda la veterinaria.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carnet', 'carnet', false, 10485760,
        array['image/png','image/jpeg','image/webp','image/gif','application/pdf'])
on conflict (id) do nothing;

-- La convención de ruta es '{dueño}/{archivo}', igual que en los otros dos
-- buckets, así que la primera carpeta identifica de quién es.
drop policy if exists "carnet - sube el dueño" on storage.objects;
create policy "carnet - sube el dueño"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'carnet'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lo ve el dueño o un admin: el club necesita poder mirarlo cuando el socio pide
-- un reintegro por ese estudio.
drop policy if exists "carnet - lo ve el dueño o un admin" on storage.objects;
create policy "carnet - lo ve el dueño o un admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'carnet'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

drop policy if exists "carnet - borra el dueño" on storage.objects;
create policy "carnet - borra el dueño"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'carnet'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
