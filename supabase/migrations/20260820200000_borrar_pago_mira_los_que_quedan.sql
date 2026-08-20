-- ============================================================
--  Borrar un cobro: la cuota queda donde llegan los cobros que sobreviven
-- ============================================================
-- Restar un mes de `paid_until` es el inverso exacto de acreditar SOLO si el cobro
-- borrado era el último. Borrando uno del medio, la fecha queda peleada con lo que
-- declaran los cobros que quedan.
--
-- Pasó de verdad y así se descubrió: Florencia tenía dos cobros —uno real de $44.000
-- por Mercado Pago (que declara cubrirla hasta el 19/09) y uno de prueba de $67.000
-- registrado a mano—. Al borrar el de prueba, la resta la dejó en 19/08: el panel le
-- decía "cuota vencida" a alguien cuyo único pago dice cubrirla un mes más.
--
-- La regla correcta no es aritmética: cada cobro ya guarda hasta dónde llevó la cuota
-- (`covers_until`), así que la respuesta es la fecha más lejana de los que quedan, y
-- null si no queda ninguno. Además se corrige sola: si alguna fecha quedó torcida por
-- una prueba vieja, el próximo borrado la vuelve a apoyar sobre los cobros reales.
create or replace function public.borrar_pago(p_pago_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pago  record;
  antes date;
  nueva date;
begin
  select id, member_id, amount, status, method
    into pago
    from public.payments
   where id = p_pago_id;
  if not found then
    raise exception 'No existe ese cobro.';
  end if;

  select paid_until into antes from public.profiles where id = pago.member_id for update;

  delete from public.payments where id = p_pago_id;

  -- Un cobro rechazado o pendiente nunca movió la cuota, así que no hay nada que
  -- recalcular: se borra la fila y listo.
  if pago.status = 'aprobado' then
    select max(covers_until) into nueva
      from public.payments
     where member_id = pago.member_id and status = 'aprobado';

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
  'Borra un cobro y deja `paid_until` en la fecha mas lejana que declaren los cobros aprobados que quedan (null si no queda ninguno). No resta meses: restando, borrar un cobro del medio dejaba la cuota peleada con lo que dicen los cobros que sobreviven. Solo la service-role.';

revoke all on function public.borrar_pago(uuid) from public, anon, authenticated;
