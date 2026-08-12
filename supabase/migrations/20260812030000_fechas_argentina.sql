-- Las fechas por defecto salían en UTC.
--
-- `current_date` usa la zona horaria de la sesión de Postgres, y en Supabase es
-- UTC: un reintegro cargado a las 22:00 de Buenos Aires quedaba con la fecha del
-- día siguiente, y lo mismo el alta de un socio. Ahora el día lo define el
-- calendario argentino, igual que en el código de las apps
-- (packages/shared/src/fechas.ts).

alter table reimbursements
  alter column requested_on set default (now() at time zone 'America/Argentina/Buenos_Aires')::date;

alter table profiles
  alter column joined_on set default (now() at time zone 'America/Argentina/Buenos_Aires')::date;

-- Nota: `created_at` en todas las tablas queda como está. Es `timestamptz`, o sea
-- un instante absoluto: se guarda en UTC y se muestra en la zona de quien lo lee,
-- así que no tiene este problema.
