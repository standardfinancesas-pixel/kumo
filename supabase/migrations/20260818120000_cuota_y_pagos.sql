-- ============================================================
--  La cuota del socio: pagos y hasta cuándo tiene acceso
-- ============================================================
-- El club cobra la cuota mes a mes por Mercado Pago (Checkout Pro), y hasta que
-- no está paga el socio no entra a la app.
--
-- Todo lo delicado de esto es de concurrencia, así que vive acá y no en el
-- código: varios socios pagando a la vez, el MISMO socio con dos pestañas
-- abiertas, y Mercado Pago avisando dos y tres veces del mismo pago (reintenta,
-- y además manda un aviso por `payment` y otro por `merchant_order`). Si la
-- suma de meses se hiciera leyendo en JS y escribiendo después, dos avisos
-- simultáneos leerían el mismo valor viejo y uno de los dos pagos se perdería.

-- ── Estados ──
do $$ begin
  create type payment_status as enum ('pendiente', 'aprobado', 'rechazado', 'devuelto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('mercadopago', 'manual');
exception when duplicate_object then null; end $$;

-- ── Hasta cuándo tiene acceso ──
-- Una sola fecha, y no un booleano "al día": el booleano hay que apagarlo con un
-- cron todas las noches y mientras no corre miente. La fecha se compara con hoy
-- y siempre dice la verdad.
alter table public.profiles add column if not exists paid_until date;

comment on column public.profiles.paid_until is
  'Hasta cuándo tiene la cuota paga. Null = nunca pagó. Si es menor a hoy, la app le pide pagar. Solo la escribe acreditar_pago().';

-- ── Los pagos ──
create table if not exists public.payments (
  id          uuid primary key default uuid_generate_v4(),
  member_id   uuid not null references public.profiles(id) on delete cascade,
  -- El plan y el monto quedan congelados en la fila: el precio del plan cambia y
  -- un pago tiene que poder explicarse a sí mismo dentro de dos años.
  plan_id     uuid references public.plans(id),
  plan_name   text,
  amount      integer not null check (amount > 0),
  status      payment_status not null default 'pendiente',
  method      payment_method not null default 'mercadopago',
  -- Hasta dónde llevó la cuota este pago. Se calcula al acreditar, no al crear:
  -- si se guardara "el mes que paga" desde el principio, un pago que aprueba
  -- tarde (una transferencia, un Rapipago) acreditaría un mes ya vencido.
  covers_until date,
  -- Lo que viaja a Mercado Pago y vuelve en el aviso. Es la llave para cruzar el
  -- aviso con esta fila, así que es única.
  external_reference text unique,
  mp_preference_id   text,
  mp_payment_id      text,
  -- El link de pago, para poder reusar el mismo intento en lugar de crear otro.
  init_point  text,
  -- Si lo registró el club a mano (efectivo, transferencia): quién.
  registered_by uuid references public.profiles(id),
  detail      text,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);

-- Un pago de Mercado Pago se acredita UNA vez, por más veces que avise.
create unique index if not exists payments_mp_payment_id_uniq
  on public.payments (mp_payment_id) where mp_payment_id is not null;

-- Un solo intento abierto por socio: dos clics seguidos en "Pagar" —o dos
-- pestañas— reusan la misma preferencia en lugar de dejar pagos fantasma.
create unique index if not exists payments_un_pendiente_por_socio
  on public.payments (member_id) where status = 'pendiente';

create index if not exists payments_member_idx on public.payments (member_id, created_at desc);

-- ── Quién ve y quién escribe ──
alter table public.payments enable row level security;

-- El socio ve los suyos (necesita ver su historial de cuotas) pero no escribe
-- ninguno: los pagos los crea el servidor con la service-role key y los acredita
-- acreditar_pago(). Si el socio pudiera insertar, se regalaría el acceso.
drop policy if exists "pagos propios - select" on public.payments;
create policy "pagos propios - select" on public.payments for select
  using (member_id = auth.uid() or is_admin());

drop policy if exists "pagos - admin escribe" on public.payments;
create policy "pagos - admin escribe" on public.payments for all
  using (is_admin()) with check (is_admin());

-- El socio tampoco puede escribirse `paid_until`. Mismo criterio y mismo lugar
-- que el rol y el estado: la RLS es por fila, no por columna.
create or replace function public.profiles_campos_protegidos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;

  -- El rol y el número de socio los define el club.
  new.role := old.role;
  new.member_no := old.member_no;
  new.joined_on := old.joined_on;
  -- Y la cuota paga la define el pago, no el socio.
  new.paid_until := old.paid_until;

  -- El estado también, con una excepción: darse de baja es decisión del socio.
  -- Lo que no puede es volver a ponerse 'activo' si el club lo marcó moroso.
  if new.status <> old.status and new.status <> 'baja' then
    new.status := old.status;
  end if;

  return new;
end $$;

-- ============================================================
--  Acreditar un pago
-- ============================================================
-- Toda la operación en una transacción y con las filas bloqueadas, porque acá es
-- donde chocan los avisos repetidos de Mercado Pago.
--
-- Devuelve `acreditado = false` cuando el aviso era repetido: no es un error, es
-- lo normal, y el webhook tiene que contestarle 200 igual para que MP deje de
-- reintentar.
create or replace function public.acreditar_pago(
  p_external_reference text,
  p_mp_payment_id      text,
  p_amount             integer
) returns table (acreditado boolean, hasta date, motivo text)
language plpgsql security definer set search_path = public as $$
declare
  pago    public.payments;
  desde   date;
  nueva   date;
  hoy     date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  -- `for update` es el corazón del asunto: el segundo aviso del mismo pago espera
  -- acá hasta que el primero termine, y entonces ve el estado ya acreditado.
  select * into pago from public.payments
   where external_reference = p_external_reference
   for update;

  if not found then
    return query select false, null::date, 'no existe un pago con esa referencia';
    return;
  end if;

  -- ¿Ya lo acreditamos? Puede ser el mismo aviso repetido (lo normal) o, si el id
  -- no coincide, dos pagos distintos contra la misma preferencia: eso es plata que
  -- entró dos veces y lo tiene que ver una persona.
  if pago.status = 'aprobado' then
    if pago.mp_payment_id = p_mp_payment_id then
      return query select false, (select p.paid_until from public.profiles p where p.id = pago.member_id), 'ya estaba acreditado';
    end if;
    update public.payments
       set detail = coalesce(detail || ' · ', '') || 'llegó un segundo pago (' || p_mp_payment_id || ') para esta misma preferencia: revisar si hay que devolverlo'
     where id = pago.id;
    return query select false, null::date, 'pago duplicado sobre la misma preferencia';
    return;
  end if;

  -- Que lo pagado alcance. No debería fallar nunca (el monto lo fija el servidor
  -- al crear la preferencia), pero si alguna vez no coincide es mejor no dar
  -- acceso y que quede el rastro, que acreditar de menos sin que nadie se entere.
  if p_amount < pago.amount then
    update public.payments
       set status = 'rechazado',
           mp_payment_id = p_mp_payment_id,
           detail = 'llegó $' || p_amount || ' y la cuota era $' || pago.amount
     where id = pago.id;
    return query select false, null::date, 'el monto pagado no alcanza';
    return;
  end if;

  -- El perfil también bloqueado, y la cuenta la hace la base: sumar un mes sobre
  -- lo que YA está en la fila. Así dos pagos del mismo socio dan dos meses en vez
  -- de pisarse.
  select p.paid_until into desde from public.profiles p where p.id = pago.member_id for update;

  -- Si estaba al día, el mes nuevo se encima al final del anterior (no le
  -- regalamos ni le comemos días). Si estaba vencido, arranca hoy.
  nueva := (greatest(coalesce(desde, hoy), hoy) + interval '1 month')::date;

  update public.profiles
     set paid_until = nueva,
         -- Pagar saca de moroso. Suspendido y baja NO: los decidió el club y se
         -- levantan a mano desde el panel.
         status = case when status = 'moroso' then 'activo'::member_status else status end
   where id = pago.member_id;

  update public.payments
     set status = 'aprobado',
         mp_payment_id = p_mp_payment_id,
         covers_until = nueva,
         paid_at = now()
   where id = pago.id;

  return query select true, nueva, 'acreditado';
end $$;

revoke all on function public.acreditar_pago(text, text, integer) from public;
-- Solo el servidor: la llama el webhook con la service-role key. Ni el socio ni
-- el navegador tienen por qué poder acreditarse un pago.
comment on function public.acreditar_pago(text, text, integer) is
  'Acredita un pago y mueve profiles.paid_until un mes, en una transacción y con las filas bloqueadas. Idempotente: el mismo mp_payment_id dos veces acredita una sola. La llama el webhook de Mercado Pago con la service-role key.';

comment on table public.payments is
  'Cuotas del socio. Una fila por intento de pago. Las crea el servidor al armar la preferencia de Mercado Pago (o el panel, si el club cobró a mano) y las acredita acreditar_pago().';
