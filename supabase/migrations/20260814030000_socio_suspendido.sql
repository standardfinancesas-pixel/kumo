-- El club puede suspender a un socio, y eso no es lo mismo que una baja.
--
-- `member_status` tenía 'activo', 'moroso' y 'baja'. Para "el club lo desactivó"
-- se podría reusar 'baja', pero significan cosas distintas y se mezclarían justo
-- donde importa: 'baja' es el socio que se fue —cuenta para el churn del
-- dashboard— y 'suspendido' es el club que le corta el acceso, que sigue siendo un
-- socio y puede volver. Con un solo estado para las dos cosas, el churn mentiría.
--
-- Ojo con Postgres: `alter type ... add value` no puede usarse en la MISMA
-- transacción que lo agrega, así que este archivo solo agrega el valor. Quien lo
-- usa es la app, después.

do $$ begin
  alter type member_status add value if not exists 'suspendido';
exception when others then null; end $$;

comment on column public.profiles.status is
  'activo = al día · moroso = debe la cuota · suspendido = el club le cortó el acceso · baja = se fue (cuenta para el churn).';
