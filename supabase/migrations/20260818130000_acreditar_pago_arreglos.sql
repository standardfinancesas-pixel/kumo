-- ============================================================
--  Dos agujeros de la cuota, encontrados probándola
-- ============================================================
-- Salieron de correr la prueba de concurrencia contra la cuenta de demo, no de
-- leer el código. Los dos son del mismo tipo: "funciona" salvo por quién es el
-- que ejecuta.

-- ── 1 · Un socio podía acreditarse la cuota sin pagar ──
--
-- `revoke all ... from public` no alcanza: Supabase le da EXECUTE explícito a
-- `anon` y `authenticated` sobre las funciones del esquema public, y revocarle a
-- `public` no toca esos permisos. Resultado: con su propio token, un socio podía
--   POST /rest/v1/rpc/acreditar_pago
-- con la referencia de SU pago pendiente y quedar al día sin pagar un peso.
-- Probado: devolvía 200.
revoke all on function public.acreditar_pago(text, text, integer) from anon, authenticated;

-- ── 2 · La acreditación no escribía `paid_until` ──
--
-- El trigger `profiles_campos_guard` protege las columnas que decide el club, y
-- para eso pregunta `is_admin()`, que mira `auth.uid()`. El webhook corre con la
-- service-role key, que NO es admin: `auth.uid()` es null, así que el guard
-- revertía el `paid_until` recién escrito. La función devolvía "acreditado" y el
-- socio se quedaba con el muro puesto habiendo pagado — el peor de los dos
-- errores posibles, porque la plata entró.
--
-- Se abre una sola puerta, la mínima: la función de acreditar avisa con un flag
-- de transacción, y el guard deja pasar `paid_until` únicamente cuando ese flag
-- está. Cualquier otro camino (el socio, el panel, un PATCH suelto) sigue sin
-- poder tocarlo.
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

  -- Y la cuota paga la define un pago acreditado, no el socio. `acreditar_pago()`
  -- prende este flag (local a la transacción) justo antes de escribir.
  if coalesce(current_setting('kumo.acreditando', true), '') <> 'on' then
    new.paid_until := old.paid_until;
  end if;

  -- El estado también, con una excepción: darse de baja es decisión del socio.
  -- Lo que no puede es volver a ponerse 'activo' si el club lo marcó moroso.
  if new.status <> old.status and new.status <> 'baja' then
    new.status := old.status;
  end if;

  return new;
end $$;

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

  if pago.status = 'aprobado' then
    if pago.mp_payment_id = p_mp_payment_id then
      return query select false, (select p.paid_until from public.profiles p where p.id = pago.member_id), 'ya estaba acreditado';
      return;
    end if;
    update public.payments
       set detail = coalesce(detail || ' · ', '') || 'llegó un segundo pago (' || p_mp_payment_id || ') para esta misma preferencia: revisar si hay que devolverlo'
     where id = pago.id;
    return query select false, null::date, 'pago duplicado sobre la misma preferencia';
    return;
  end if;

  if p_amount < pago.amount then
    update public.payments
       set status = 'rechazado',
           mp_payment_id = p_mp_payment_id,
           detail = 'llegó $' || p_amount || ' y la cuota era $' || pago.amount
     where id = pago.id;
    return query select false, null::date, 'el monto pagado no alcanza';
    return;
  end if;

  select p.paid_until into desde from public.profiles p where p.id = pago.member_id for update;
  nueva := (greatest(coalesce(desde, hoy), hoy) + interval '1 month')::date;

  -- El permiso para escribir `paid_until`, sólo en esta transacción y sólo para
  -- el update de abajo (ver el trigger, arriba).
  perform set_config('kumo.acreditando', 'on', true);

  update public.profiles
     set paid_until = nueva,
         status = case when status = 'moroso' then 'activo'::member_status else status end
   where id = pago.member_id;

  perform set_config('kumo.acreditando', 'off', true);

  update public.payments
     set status = 'aprobado',
         mp_payment_id = p_mp_payment_id,
         covers_until = nueva,
         paid_at = now()
   where id = pago.id;

  return query select true, nueva, 'acreditado';
end $$;

revoke all on function public.acreditar_pago(text, text, integer) from public, anon, authenticated;
