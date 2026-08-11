-- Comprobantes de reintegro (facturas).
--
-- A diferencia de 'pet-photos', este bucket es PRIVADO: una factura tiene
-- datos personales y montos, así que no puede quedar accesible con una URL
-- pública adivinable. Se lee con URL firmada de corta duración.

-- 1. Guardamos el path dentro del bucket, no una URL (las firmadas expiran).
alter table reimbursements add column if not exists receipt_path text;

-- 2. Bucket privado.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 3. RLS de storage. La convención de ruta es '{member_id}/{archivo}', así que
--    la primera carpeta identifica al dueño.
drop policy if exists "comprobantes - socio sube los suyos" on storage.objects;
create policy "comprobantes - socio sube los suyos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprobantes - ve el dueño o un admin" on storage.objects;
create policy "comprobantes - ve el dueño o un admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

-- El socio puede reemplazar el comprobante mientras la solicitud siga en
-- revisión; una vez resuelta, el archivo queda como respaldo.
drop policy if exists "comprobantes - borra el dueño" on storage.objects;
create policy "comprobantes - borra el dueño"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
