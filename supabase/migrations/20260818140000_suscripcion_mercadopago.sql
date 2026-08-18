-- ============================================================
--  De pago mes a mes a suscripción con débito automático
-- ============================================================
-- El socio autoriza una vez y Mercado Pago le debita todos los meses. Cambia el
-- producto de MP (Suscripciones / "preapproval" en lugar de Checkout Pro) y los
-- avisos que escuchamos, pero no el modelo: sigue siendo `paid_until` contra hoy,
-- con una fila en `payments` por cada debito.
--
-- Un club con cuota pierde socios por olvido, no por decision: el que tiene que
-- acordarse de pagar todos los meses se cae en tres o cuatro, y el panel se llena
-- de morosos que en realidad son distraidos.

-- ── La suscripción vive en el perfil ──
-- Es una sola por socio: la de MP, con su estado. `mp_preapproval_id` es lo que
-- permite darla de baja y lo que viene en los avisos de cada débito.
alter table public.profiles add column if not exists mp_preapproval_id text;
alter table public.profiles add column if not exists mp_subscription_status text
  check (mp_subscription_status is null or mp_subscription_status in ('pending', 'authorized', 'paused', 'cancelled'));

comment on column public.profiles.mp_preapproval_id is
  'Id de la suscripción de Mercado Pago (preapproval). Null = todavía no se suscribió. Con esto se la da de baja y se cruzan los avisos de cada débito.';

-- El socio no se los escribe, igual que el rol, el estado y la cuota: el estado
-- de la suscripción lo dice Mercado Pago, no el navegador.
create or replace function public.profiles_campos_protegidos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;

  new.role := old.role;
  new.member_no := old.member_no;
  new.joined_on := old.joined_on;

  -- La cuota paga y la suscripción las define un aviso de Mercado Pago
  -- verificado, no el socio. `acreditar_cuota()` y las rutas del servidor prenden
  -- este flag (local a la transacción) justo antes de escribir.
  if coalesce(current_setting('kumo.acreditando', true), '') <> 'on' then
    new.paid_until := old.paid_until;
    new.mp_preapproval_id := old.mp_preapproval_id;
    new.mp_subscription_status := old.mp_subscription_status;
  end if;

  if new.status <> old.status and new.status <> 'baja' then
    new.status := old.status;
  end if;

  return new;
end $$;

-- ── Guardar el estado de la suscripción ──
-- Hace falta una función porque el trigger de arriba protege esas dos columnas:
-- sin el flag no las escribe NADIE, ni la service-role key (que no es admin —
-- `is_admin()` mira `auth.uid()`). Esta es la única puerta, la abre el servidor y
-- solo para estos dos campos.
create or replace function public.marcar_suscripcion(
  p_member_id      uuid,
  p_preapproval_id text,
  p_status         text
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('kumo.acreditando', 'on', true);
  update public.profiles
     set mp_preapproval_id = p_preapproval_id,
         mp_subscription_status = p_status
   where id = p_member_id;
  perform set_config('kumo.acreditando', 'off', true);
end $$;

revoke all on function public.marcar_suscripcion(uuid, text, text) from public, anon, authenticated;

comment on function public.marcar_suscripcion(uuid, text, text) is
  'Guarda el id y el estado de la suscripción de Mercado Pago en el perfil. La llaman las rutas del servidor con la service-role key: el socio no puede declararse suscripto desde el navegador.';

-- ── Un intento abierto por socio ya no aplica ──
-- Ese índice existía para que dos clics en "Pagar" no crearan dos cobros de
-- Checkout Pro. Con suscripción no hay cobros que el socio inicie: los crea el
-- débito de MP, y ahí lo que evita duplicados es `mp_payment_id` único.
drop index if exists public.payments_un_pendiente_por_socio;

-- ── Acreditar un débito ──
-- Reemplaza a `acreditar_pago()`: ahora la fila del pago NO existe antes (el
-- débito lo decide MP, no nosotros), así que se crea y se acredita en la misma
-- transacción. Sigue siendo idempotente y sigue bloqueando el perfil, que es lo
-- que serializa los avisos repetidos del mismo socio.
create or replace function public.acreditar_cuota(
  p_member_id      uuid,
  p_mp_payment_id  text,
  p_amount         integer,
  p_method         payment_method default 'mercadopago',
  p_detalle        text default null,
  p_registrado_por uuid default null
) returns table (acreditado boolean, hasta date, motivo text)
language plpgsql security definer set search_path = public as $$
declare
  ya      public.payments;
  desde   date;
  nueva   date;
  plan    record;
  hoy     date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if p_mp_payment_id is null or btrim(p_mp_payment_id) = '' then
    raise exception 'Falta el id del pago: sin eso no se puede evitar acreditar dos veces.';
  end if;

  -- ¿Este débito ya está acreditado? Es el caso normal, no un error: Mercado Pago
  -- reintenta el aviso y manda más de un evento por el mismo pago.
  select * into ya from public.payments where mp_payment_id = p_mp_payment_id for update;
  if found then
    return query select false, (select p.paid_until from public.profiles p where p.id = ya.member_id), 'ya estaba acreditado';
    return;
  end if;

  -- El perfil bloqueado: dos débitos del mismo socio entrando juntos se hacen
  -- fila acá, y cada uno suma su mes sobre el valor ya escrito por el anterior.
  select p.paid_until into desde from public.profiles p where p.id = p_member_id for update;
  if not found then
    return query select false, null::date, 'no existe ese socio';
    return;
  end if;

  select pl.id, pl.name into plan
    from public.profiles p left join public.plans pl on pl.id = p.plan_id
   where p.id = p_member_id;

  nueva := (greatest(coalesce(desde, hoy), hoy) + interval '1 month')::date;

  insert into public.payments (member_id, plan_id, plan_name, amount, status, method, covers_until, mp_payment_id, external_reference, detail, registered_by, paid_at)
  values (p_member_id, plan.id, plan.name, p_amount, 'aprobado', p_method, nueva, p_mp_payment_id, p_mp_payment_id, p_detalle, p_registrado_por, now());

  perform set_config('kumo.acreditando', 'on', true);
  update public.profiles
     set paid_until = nueva,
         -- Pagar saca de moroso. Suspendido y baja NO: los decidió el club.
         status = case when status = 'moroso' then 'activo'::member_status else status end
   where id = p_member_id;
  perform set_config('kumo.acreditando', 'off', true);

  return query select true, nueva, 'acreditado';
exception
  -- Dos avisos idénticos entrando en el mismo instante: el índice único de
  -- `mp_payment_id` hace fallar al segundo. No es un error para quien llama.
  when unique_violation then
    return query select false, (select p.paid_until from public.profiles p where p.id = p_member_id), 'ya estaba acreditado';
end $$;

revoke all on function public.acreditar_cuota(uuid, text, integer, payment_method, text, uuid) from public, anon, authenticated;

comment on function public.acreditar_cuota(uuid, text, integer, payment_method, text, uuid) is
  'Crea y acredita un débito de la cuota, en una transacción y con el perfil bloqueado. Idempotente por mp_payment_id. La llaman el webhook de Mercado Pago y el "Registrar pago" del panel, siempre con la service-role key.';

-- La anterior ya no se usa: la suscripción no crea la fila antes de cobrar.
drop function if exists public.acreditar_pago(text, text, integer);
