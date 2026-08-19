-- ============================================================
--  Entrar es gratis. Los reintegros y los beneficios, no.
-- ============================================================
-- Hasta acá el corte era uno solo y vivía en la pantalla: `MuroCuota` tapaba la
-- webapp y la app enteras si `paid_until` estaba vencido. La RLS no miraba la cuota
-- para nada —`tiene_acceso()` es solo `status = 'activo'`—, así que las políticas
-- ya dejaban pasar al socio que no pagó: lo único que lo frenaba era un div encima.
--
-- Desde acá el socio entra gratis y tiene todo menos dos cosas: los reintegros y
-- los beneficios. Y esas dos se cortan ACÁ y no en la pantalla, porque el token de
-- un socio gratuito es un token válido: con él se le puede pedir a la API lo que la
-- pantalla no muestra. Hoy `benefits` se lee incluso SIN sesión.
--
-- La pregunta nueva es "¿tiene la cuota paga?" y va en una función aparte.
-- `tiene_acceso()` no se toca: contesta otra cosa —la relación con el club: activo,
-- suspendido, baja—, la usan 24 políticas y dos funciones, y meterle la cuota
-- adentro le cortaría el carnet, las mascotas, el foro y el perfil al socio
-- gratuito, que es justo lo que queremos que SÍ tenga. Son dos preguntas y son dos
-- funciones; las políticas de reintegros piden las dos.

/* ── El predicado nuevo ─────────────────────────────────────── */
create or replace function public.tiene_plan_pago()
returns boolean language sql stable security definer set search_path = public as $$
  /*
   * Es `paid_until` y NO `plan_id`, y esa es la decisión de fondo.
   *
   * Quien elige un plan, va a Mercado Pago y no paga queda con el plan escrito en
   * el perfil (dato de venta: el club sabe a quién llamar) y sin haber pagado un
   * peso. Con "tiene plan elegido" como criterio, ese socio se llevaría los
   * reintegros y los beneficios gratis con solo empezar un pago y abandonarlo. El
   * único dato que prueba un pago es la fecha que escribe `acreditar_cuota()`.
   *
   * El día es el del calendario argentino y no el del servidor: la base corre en
   * UTC, y entre las 21:00 y la medianoche de Buenos Aires `current_date` ya es
   * mañana. Es el mismo criterio que usa `acreditar_cuota()` al calcular hasta
   * cuándo cubre un pago, y el mismo que usa `hoyISO()` de `@kumo/shared`, que es
   * quien decide en las pantallas si el menú muestra las secciones pagas. Si los
   * dos no coinciden, la base y el menú se contradicen un rato todas las noches.
   *
   * Al admin y al prestador no los toca: su acceso no depende de una cuota que no
   * pagan. Mismo escape y mismo orden que `tiene_acceso()`.
   *
   * Sin sesión da false por el coalesce, así que el anónimo queda afuera. Para
   * `benefits` eso es un cambio real: hasta hoy se leía con la anon key.
   */
  select coalesce(
    (select p.role <> 'socio'
              or (p.paid_until is not null
                  and p.paid_until >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
       from profiles p where p.id = auth.uid()),
    false);
$$;

comment on function public.tiene_plan_pago() is
  'Tiene la cuota paga el que pide? Es paid_until contra el dia argentino, NO plan_id: el que eligio plan y abandono Mercado Pago tiene plan y no pago. Decide reintegros y beneficios. No dice nada de la relacion con el club: eso es tiene_acceso(), y las politicas piden las dos.';

/* ── Beneficios: dejan de ser públicos ──────────────────────── */
-- Era `using (status = 'activo' or is_admin())`: cualquiera con la anon key se
-- llevaba el catálogo entero, que es el activo que el club negoció con los
-- comercios. Se puede cortar sin romper nada público porque la landing NO lee esta
-- tabla (muestra tres tarjetas escritas a mano en `LandingClient.tsx`), y los
-- únicos lectores son la webapp, la app y el panel. El panel los sigue viendo
-- —incluidos los pausados— por `is_admin()`.
--
-- OJO si algún día la landing quiere mostrar la red real de comercios: la salida es
-- una vista o una política aparte para lo público, NO volver esta tabla a abierta.
drop policy if exists "beneficios visibles" on public.benefits;
create policy "beneficios del socio con plan" on public.benefits for select
  using ((status = 'activo' and tiene_acceso() and tiene_plan_pago()) or is_admin());

/* ── Reintegros ─────────────────────────────────────────────── */
-- Las dos preguntas encadenadas: el suspendido sigue sin poder pedir plata
-- (`tiene_acceso`) y el gratuito tampoco (`tiene_plan_pago`).
drop policy if exists "reintegros del socio - select" on public.reimbursements;
create policy "reintegros del socio - select" on public.reimbursements for select
  using ((member_id = auth.uid() and tiene_acceso() and tiene_plan_pago()) or is_admin());

drop policy if exists "reintegros del socio - insert" on public.reimbursements;
create policy "reintegros del socio - insert" on public.reimbursements for insert
  with check (member_id = auth.uid() and tiene_acceso() and tiene_plan_pago());

-- "reintegros - admin update" queda como está, a propósito: el club resuelve la
-- cola sin importar en qué quedó la cuota del socio, y tiene que seguir siendo así
-- (un reintegro pedido cuando estaba al día se paga igual).

/* ── Las dos columnas que ahora significan otra cosa ────────── */
comment on column public.profiles.plan_id is
  'El plan contratado. Null = socio gratuito, y no hay que migrar nada para eso: la columna ya era nullable. Que este ESCRITO no significa que pague (ver tiene_plan_pago()). No se agrega GRATIS al enum plan_name: sacar un valor de un enum en Postgres es reescribir la columna, y el null ya dice lo mismo.';

comment on column public.profiles.paid_until is
  'Hasta cuando tiene la cuota paga. Null = nunca pago (socio gratuito). Solo la escribe acreditar_cuota(). Es el unico dato que decide si ve reintegros y beneficios: ya no hay muro, hay dos secciones que aparecen o no.';
