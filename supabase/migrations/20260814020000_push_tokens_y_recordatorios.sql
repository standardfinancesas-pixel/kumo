-- Push notifications: a dónde mandarlas y qué ya se mandó.
--
-- El panel guardaba los avisos en `push_notifications` y nadie los entregaba,
-- porque faltaban las dos mitades: los tokens de los dispositivos y una marca de
-- lo ya enviado para no repetir el mismo recordatorio todos los días.

-- ── 1 · Los tokens ──
-- Un socio puede tener varios: el celular, la tablet, el celular nuevo. Se guarda
-- el token de Expo (no el de FCM) porque el envío pasa por la Expo Push API, que
-- es la que sabe hablar con Apple y con Google.
create table if not exists public.push_tokens (
  token       text primary key,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  platform    text not null check (platform in ('android', 'ios', 'web')),
  -- Para poder limpiar los que dejaron de existir: Expo responde
  -- DeviceNotRegistered cuando el socio desinstaló la app.
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists push_tokens_member_idx on public.push_tokens(member_id);

alter table public.push_tokens enable row level security;

-- Cada quien registra y borra los suyos; el club los lee todos para poder enviar.
drop policy if exists "tokens propios - select" on public.push_tokens;
create policy "tokens propios - select" on public.push_tokens for select
  using (member_id = auth.uid() or is_admin());

drop policy if exists "tokens propios - insert" on public.push_tokens;
create policy "tokens propios - insert" on public.push_tokens for insert
  with check (member_id = auth.uid());

drop policy if exists "tokens propios - update" on public.push_tokens;
create policy "tokens propios - update" on public.push_tokens for update
  using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "tokens propios - delete" on public.push_tokens;
create policy "tokens propios - delete" on public.push_tokens for delete
  using (member_id = auth.uid() or is_admin());

-- ── 2 · Qué se envió de cada aviso ──
-- `push_notifications` guarda el aviso que el club redactó. Estas dos columnas
-- guardan el resultado del envío: sin esto, "Enviadas" mostraba avisos que nunca
-- salieron y no había forma de saber a cuántos llegó.
alter table public.push_notifications
  add column if not exists delivered integer,
  add column if not exists failed    integer;

comment on column public.push_notifications.delivered is
  'A cuántos dispositivos se entregó. Null = todavía no se envió.';

-- ── 3 · Recordatorios de vacuna ya avisados ──
-- El cron corre todos los días y una vacuna vence una sola vez: sin esta tabla, el
-- socio recibiría el mismo aviso cada mañana durante 30 días. La clave es la
-- vacuna, no la fecha, así que reprogramarla (nuevo `due_on`) vuelve a habilitar
-- el aviso solo si se borra la marca — que es lo que hace el trigger de abajo.
create table if not exists public.vaccine_reminders (
  vaccination_id uuid primary key references public.vaccinations(id) on delete cascade,
  due_on         date not null,
  sent_at        timestamptz not null default now()
);

alter table public.vaccine_reminders enable row level security;
-- Solo el servidor (service-role) la toca; nadie más necesita verla.

-- Si la vacuna cambia de fecha o se aplica, el recordatorio viejo ya no aplica.
create or replace function public.vaccine_reminder_reset()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.due_on is distinct from old.due_on or new.status is distinct from old.status then
    delete from vaccine_reminders where vaccination_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists vaccine_reminder_reset on public.vaccinations;
create trigger vaccine_reminder_reset after update on public.vaccinations
  for each row execute function public.vaccine_reminder_reset();
