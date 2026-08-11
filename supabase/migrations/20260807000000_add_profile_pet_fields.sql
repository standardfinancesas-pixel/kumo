-- ============================================================
--  Kumo · Agrega campos capturados en el alta de socio (onboarding)
--  que no tenían columna: DNI y fecha de nacimiento del socio;
--  sexo y veterinario habitual de la mascota.
-- ============================================================

alter table profiles add column if not exists dni text;
alter table profiles add column if not exists birth_date date;

alter table pets add column if not exists sex text;
alter table pets add column if not exists vet_name text;
