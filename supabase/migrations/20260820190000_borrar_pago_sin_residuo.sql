-- ============================================================
--  Borrar el último cobro deja la cuota sin pagar, no "paga hasta hoy"
-- ============================================================
-- `borrar_pago` descuenta un mes de `paid_until`, que es el inverso exacto de lo que
-- hizo `acreditar_cuota`… salvo en un caso: cuando el socio no tenía NINGÚN pago.
--
-- Ahí acreditar hace `hoy + 1 mes` (parte de hoy porque no hay fecha de la que
-- partir), así que descontar un mes devuelve **hoy** y no null. Resultado medido: se
-- borra el único cobro de un socio y queda "paga hasta hoy", o sea al día por un día
-- más. Justo el caso de limpiar datos de prueba, que es para lo que se pidió esto.
--
-- La regla correcta no es aritmética, es contable: si al socio no le queda ningún
-- cobro acreditado, nunca pagó, y `paid_until` tiene que ser null.
create or replace function public.borrar_pago(p_pago_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pago   record;
  antes  date;
  nueva  date;
  quedan integer;
begin
  select id, member_id, amount, status, method, mp_payment_id
    into pago
    from public.payments
   where id = p_pago_id;
  if not found then
    raise exception 'No existe ese cobro.';
  end if;

  select paid_until into antes from public.profiles where id = pago.member_id for update;

  delete from public.payments where id = p_pago_id;

  if pago.status = 'aprobado' and antes is not null then
    -- Se cuenta DESPUÉS de borrar: la pregunta es qué le queda, no qué tenía.
    select count(*) into quedan
      from public.payments
     where member_id = pago.member_id and status = 'aprobado';

    nueva := case when quedan = 0 then null else (antes - interval '1 month')::date end;

    perform set_config('kumo.acreditando', 'on', true);
    update public.profiles set paid_until = nueva where id = pago.member_id;
    perform set_config('kumo.acreditando', 'off', true);
  else
    nueva := antes;
  end if;

  return jsonb_build_object(
    'socio', pago.member_id,
    'monto', pago.amount,
    'estado', pago.status,
    'pagaba_hasta', antes,
    'paga_hasta', nueva
  );
end $$;

comment on function public.borrar_pago(uuid) is
  'Borra un cobro y le descuenta al socio el mes que ese cobro le habia sumado. Si no le queda ningun cobro acreditado, `paid_until` vuelve a null: nunca pago. Solo la service-role.';

revoke all on function public.borrar_pago(uuid) from public, anon, authenticated;
