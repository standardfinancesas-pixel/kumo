-- Hasta cuándo llegó cada cron.
--
-- El resumen diario de "me gusta" del foro (`/api/cron/foro-likes`) miraba "las
-- últimas 24 horas" contadas desde el momento en que corría. Eso asume que el
-- cron dispara exactamente cada 24 horas, y ninguna plataforma promete eso:
--
--  · si una corrida sale ANTES de las 24 h de la anterior, el pedazo que se
--    solapa se avisa DOS VECES — al socio le llegan las mismas personas otra vez;
--  · si sale DESPUÉS, los me gusta de ese hueco no se avisan NUNCA, que es peor
--    porque no se nota.
--
-- El tamaño del problema es el tamaño del desfasaje. Con esta tabla la ventana
-- va desde donde terminó la corrida anterior, así que encajan solas pase lo que
-- pase con el reloj: ni repite ni pierde.
--
-- Es genérica a propósito (`job` es el nombre del cron) para que el próximo que
-- necesite lo mismo no invente otra tabla. El de vacunas NO la necesita: ese
-- lleva marca por vacuna en `vaccine_reminders`, que es más preciso todavía.
create table if not exists cron_runs (
  job      text primary key,
  last_run timestamptz not null
);

-- Igual que `vaccine_reminders`: RLS prendida y SIN políticas. Nadie con sesión
-- tiene nada que hacer acá; solo la service-role, que se saltea RLS.
alter table cron_runs enable row level security;
