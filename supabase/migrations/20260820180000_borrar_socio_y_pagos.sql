-- ============================================================
--  Borrar un socio (con todo lo suyo) y borrar un cobro
-- ============================================================
-- Hasta acá el panel solo podía dar de BAJA (`status = 'baja'`), que es reversible y
-- cuenta para el churn. Faltaba lo otro: borrar de verdad. Hace falta para dos cosas
-- muy distintas y las dos son reales: limpiar los socios de prueba, y cumplir cuando
-- alguien pide que le borren los datos (Ley 25.326 de Protección de Datos Personales,
-- derecho de supresión).
--
-- Va como función de base y no como una tanda de deletes desde el route handler por
-- la razón de siempre: o se borra todo o no se borra nada. Un borrado a medias deja
-- una mascota sin dueño y una declaración jurada firmada por un socio que no existe.
--
-- Lo que el `on delete cascade` de `profiles` YA se lleva: mascotas (y con ellas sus
-- vacunas y las fotos de la tabla), declaraciones, reintegros, contactos de
-- emergencia, guardados, likes, reseñas, tokens de push y pagos.
--
-- Lo que NO se lleva y por eso se borra a mano acá:
--   · `providers` — el negocio del socio, que está como `on delete set null` y
--     quedaría publicado en el directorio sin dueño.
--   · `community_posts` / `community_answers` — también `set null`, y ojo: la tabla
--     guarda `author_name` COPIADO, así que el nombre de la persona seguiría
--     visible en el foro después de borrarla. Para un pedido de supresión eso es
--     justamente lo que no puede pasar.
--
-- Lo que esta función NO puede hacer, y hace el route handler antes de llamarla:
--   1. Cancelar la suscripción de Mercado Pago. Es lo más importante de todo: sin
--      eso, MP le sigue debitando la tarjeta a alguien que ya no existe en Kumo.
--   2. Borrar las fotos del bucket `pet-photos` (storage no es SQL).
--   3. Borrar el usuario de `auth.users` (lo hace la service-role con su API).

/* ── Borrar un socio ────────────────────────────────────────── */
create or replace function public.borrar_socio(p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  quien    record;
  negocios integer;
  posts    integer;
  respuest integer;
  mascotas integer;
  reint    integer;
  pagos    integer;
begin
  select id, role, full_name, member_no into quien from public.profiles where id = p_member_id;
  if not found then
    raise exception 'No existe ese socio.';
  end if;
  /*
   * Solo socios. Dos motivos: un admin borrado se lleva puesto el
   * `payments.registered_by` de cada cobro que registró a mano (la FK no cascadea y
   * el borrado fallaría a mitad de camino), y un prestador con cuenta se maneja
   * desde su propia pantalla.
   */
  if quien.role <> 'socio' then
    raise exception 'Solo se pueden borrar socios (este perfil es %).', quien.role;
  end if;

  -- Se cuenta ANTES de borrar: después no hay a quién preguntarle.
  select count(*) into mascotas from public.pets where owner_id = p_member_id;
  select count(*) into reint from public.reimbursements where member_id = p_member_id;
  select count(*) into pagos from public.payments where member_id = p_member_id;

  with fuera as (
    delete from public.community_answers where author_id = p_member_id returning 1
  ) select count(*) into respuest from fuera;

  with fuera as (
    delete from public.community_posts where author_id = p_member_id returning 1
  ) select count(*) into posts from fuera;

  with fuera as (
    delete from public.providers where owner_id = p_member_id returning 1
  ) select count(*) into negocios from fuera;

  -- Y el perfil, que arrastra todo lo que cascadea.
  delete from public.profiles where id = p_member_id;

  return jsonb_build_object(
    'socio', quien.full_name,
    'numero', quien.member_no,
    'mascotas', mascotas,
    'reintegros', reint,
    'pagos', pagos,
    'negocios', negocios,
    'publicaciones', posts,
    'respuestas', respuest
  );
end $$;

comment on function public.borrar_socio(uuid) is
  'Borra un socio y todo lo suyo en una transaccion, y devuelve el resumen de lo borrado. NO cancela la suscripcion de Mercado Pago ni borra las fotos del bucket ni el usuario de auth: eso lo hace /api/socios/borrar antes y despues. Solo la service-role puede llamarla.';

revoke all on function public.borrar_socio(uuid) from public, anon, authenticated;

/* ── Borrar un cobro ────────────────────────────────────────── */
-- El club registró un pago que no era, o hay que limpiar los de prueba.
--
-- Lo delicado no es borrar la fila: es que un pago APROBADO le sumó un mes a
-- `paid_until` cuando se acreditó (`acreditar_cuota` suma exactamente uno). Si se
-- borra la fila y no se devuelve el mes, el socio se queda con acceso que nadie
-- pagó y el panel deja de poder explicar de dónde salió esa fecha. Así que se
-- descuenta un mes, que es el inverso exacto de lo que se hizo al acreditar.
--
-- `kumo.acreditando` es el flag que abre el trigger de `profiles`: `paid_until` no
-- lo puede escribir nadie sin él, ni la service-role.
create or replace function public.borrar_pago(p_pago_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pago  record;
  antes date;
  nueva date;
begin
  select id, member_id, amount, status, method, mp_payment_id
    into pago
    from public.payments
   where id = p_pago_id;
  if not found then
    raise exception 'No existe ese cobro.';
  end if;

  select paid_until into antes from public.profiles where id = pago.member_id for update;

  if pago.status = 'aprobado' and antes is not null then
    nueva := (antes - interval '1 month')::date;
    perform set_config('kumo.acreditando', 'on', true);
    update public.profiles set paid_until = nueva where id = pago.member_id;
    perform set_config('kumo.acreditando', 'off', true);
  else
    nueva := antes;
  end if;

  delete from public.payments where id = p_pago_id;

  return jsonb_build_object(
    'socio', pago.member_id,
    'monto', pago.amount,
    'estado', pago.status,
    'pagaba_hasta', antes,
    'paga_hasta', nueva
  );
end $$;

comment on function public.borrar_pago(uuid) is
  'Borra un cobro y, si estaba aprobado, le descuenta al socio el mes que ese cobro le habia sumado: es el inverso exacto de acreditar_cuota. Solo la service-role.';

revoke all on function public.borrar_pago(uuid) from public, anon, authenticated;
