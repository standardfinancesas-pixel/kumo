-- El plan y la cuota los define el club, no el socio.
--
-- `profiles_campos_protegidos` ya blindaba el rol, el número de socio, el estado y
-- la fecha de la cuota, pero NO `plan_id`, `monthly_fee_agreed` ni `addon_odonto`.
-- Y la RLS de Postgres es por fila, no por columna: la política "perfil propio -
-- update" deja a cada socio editar su fila entera, así que esos tres quedaban a
-- tiro de un PATCH desde el navegador.
--
-- El camino concreto, encontrado revisando permisos el 03/09/2026:
--
--   1. PATCH /rest/v1/profiles?id=eq.<el suyo>  {"plan_id": null,
--                                                "monthly_fee_agreed": 1}
--   2. POST /api/pagos/crear sin elegir plan. Con `plan_id` en null la ruta usaba
--      `monthly_fee_agreed` como monto, así que creaba una suscripción de $1.
--   3. Cuando entra ese peso, `acreditar_cuota` compara lo que llegó contra lo que
--      Kumo registró —ambos $1— y acredita EL MES COMPLETO.
--
-- O sea: club completo por un peso. Hay que llamar la API a mano, no sale de la
-- pantalla, pero eso no es una defensa.
--
-- El arreglo va en el mismo trigger y detrás del MISMO flag que la cuota, porque
-- el problema es idéntico: hay un escritor legítimo que no es admin —las rutas del
-- servidor con la service-role key— y `is_admin()` mira `auth.uid()`, que ahí es
-- null. Sin una puerta, cerrar los campos rompería el cambio de plan.

create or replace function public.profiles_campos_protegidos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;

  new.role := old.role;
  new.member_no := old.member_no;
  new.joined_on := old.joined_on;

  -- La cuota paga, la suscripción y AHORA TAMBIÉN el plan contratado: los define
  -- un aviso de Mercado Pago verificado o una ruta del servidor, no el navegador.
  -- El flag es local a la transacción y lo prenden `acreditar_cuota()`,
  -- `marcar_suscripcion()` y `asignar_plan()` justo antes de escribir.
  if coalesce(current_setting('kumo.acreditando', true), '') <> 'on' then
    new.paid_until := old.paid_until;
    new.mp_preapproval_id := old.mp_preapproval_id;
    new.mp_subscription_status := old.mp_subscription_status;
    new.plan_id := old.plan_id;
    new.monthly_fee_agreed := old.monthly_fee_agreed;
    new.addon_odonto := old.addon_odonto;
  end if;

  if new.status <> old.status and new.status <> 'baja' then
    new.status := old.status;
  end if;

  return new;
end $$;

-- ── La única puerta para asignar un plan ──
--
-- El monto viaja como parámetro, igual que en `marcar_suscripcion`, y NO se
-- calcula acá a propósito: el precio del add-on odontológico es una constante de
-- @kumo/shared (`ODONTO_PRECIO`), y copiarla al SQL crea dos números que dicen lo
-- mismo hasta el día que uno cambia. Que el socio no pueda inventar el monto no
-- lo da el cálculo: lo da el `revoke` de abajo, que deja esta función SOLO para la
-- service-role key. Desde el navegador no se puede llamar.
--
-- Igual se valida lo que se puede: que el plan exista, y que el monto no sea
-- menor al precio de lista de ese plan. Eso ataja el error honesto —una cuenta mal
-- hecha en la ruta— sin duplicar la tabla de precios acá.
create or replace function public.asignar_plan(
  p_member_id uuid,
  p_plan_id   uuid,
  p_odonto    boolean,
  p_monto     integer
) returns table (plan_name text, monto integer)
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select id, name, base_price into p from public.plans where id = p_plan_id;
  if not found then
    raise exception 'Ese plan no existe.';
  end if;
  if p_monto is null or p_monto < p.base_price then
    raise exception 'La cuota no puede ser menor al precio del plan (% < %).', p_monto, p.base_price;
  end if;

  perform set_config('kumo.acreditando', 'on', true);
  update public.profiles
     set plan_id = p.id,
         addon_odonto = coalesce(p_odonto, false),
         monthly_fee_agreed = p_monto
   where id = p_member_id;
  perform set_config('kumo.acreditando', 'off', true);

  return query select p.name::text, p_monto;
end $$;

revoke all on function public.asignar_plan(uuid, uuid, boolean, integer) from public, anon, authenticated;

comment on function public.asignar_plan(uuid, uuid, boolean, integer) is
  'Asigna el plan y la cuota en el perfil. La llaman las rutas del servidor con la service-role key: el socio no puede elegirse el plan ni la cuota desde el navegador (ver la migración 20260903190000).';
