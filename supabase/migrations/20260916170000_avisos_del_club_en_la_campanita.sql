-- El club sólo podía mandar avisos que se perdían.
--
-- La pantalla Push del panel arma un mensaje y lo manda al teléfono. Si el socio
-- no lo ve en el momento, o tiene las notificaciones apagadas, ese aviso no
-- queda en ningún lado: la campanita de adentro de la app no lo muestra, porque
-- se arma sola con los hechos del socio —vacunas, reintegros, su servicio, el
-- foro, la cuota— y no hay dónde escribirle un aviso del club.
--
-- Ahora el club elige dónde aparece cada aviso: en la campanita, en el push, o
-- en los dos.
--
-- Va sobre `push_notifications` y no en una tabla nueva a propósito: es el mismo
-- aviso mirado desde dos lados, y con dos tablas el panel tendría dos historiales
-- que contar por separado. El nombre de la tabla queda como está — es interno, y
-- renombrarlo es tocar cinco archivos para no ganar nada.

alter table push_notifications
  add column if not exists en_campanita boolean not null default false,
  add column if not exists en_push      boolean not null default true,
  -- Hasta cuándo se muestra en la campanita. Obligatorio en la práctica (el panel
  -- lo pone siempre): sin fecha de corte la campanita se llena de avisos viejos y
  -- deja de servir para lo que sirve. Null = no vence, y sólo lo usan las filas
  -- viejas, que además no van a la campanita.
  add column if not exists vigente_hasta date;

comment on column push_notifications.en_campanita is
  'Si el aviso aparece en la campanita de la app. Las filas anteriores al 16/09/2026 quedan en false: fueron push y sólo push, y meterlas ahora sería poner en la campanita cosas que nadie mandó pensando que iban a quedar.';

/*
 * Los avisos del club que le tocan a quien pregunta.
 *
 * Va como función `security definer` y no como una política de lectura por dos
 * razones, y la segunda es la importante:
 *
 *  1. La audiencia ('Todos los socios', 'Plan FAMILIA', 'Socios gratuitos') se
 *     resuelve contra el perfil del socio, y ese cruce lo necesitan las dos
 *     superficies. Escrito dos veces, empieza a divergir.
 *  2. Si filtrara la app, la fila igual sería legible: un socio AMIGO podría leer
 *     los avisos dirigidos a VIP con sólo mirar la consulta. Acá el filtro pasa
 *     del lado del servidor y lo que no le toca no sale.
 *
 * No incluye 'Vacunas pendientes': esa audiencia se resuelve contra las mascotas
 * y sus vacunas, y como aviso guardado en la campanita envejece mal —el socio da
 * la vacuna y el cartel sigue ahí—. Para eso ya está el recordatorio automático
 * del carnet, que se calcula en vivo.
 */
create or replace function avisos_del_club(p_member uuid)
returns table (
  id         uuid,
  title      text,
  body       text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_plan text;
  v_gratuito boolean;
begin
  -- Un socio sólo puede pedir los suyos. `security definer` se saltea las
  -- políticas, así que el permiso se pone acá. El servidor (sin auth.uid()) sí
  -- puede pedir los de cualquiera.
  if auth.uid() is not null and p_member is distinct from auth.uid() then
    raise exception 'Solo podés pedir tus propios avisos';
  end if;

  /*
   * Gratuito se define por la CUOTA y no por el plan, igual que
   * `tokensDeAudiencia` en lib/push: el que eligió un plan y abandonó el pago
   * tiene plan escrito y no paga, así que mirando el plan se escaparía justo de
   * la audiencia a la que hay que hablarle. Si las dos definiciones no
   * coincidieran, el mismo aviso llegaría a gente distinta según el canal.
   */
  select p.name::text,
         (pr.paid_until is null or pr.paid_until < (now() at time zone 'America/Argentina/Buenos_Aires')::date)
    into v_plan, v_gratuito
  from profiles pr left join plans p on p.id = pr.plan_id
  where pr.id = p_member;

  return query
  select n.id, n.title, n.body, n.created_at
  from push_notifications n
  where n.en_campanita
    and n.sent_at is not null
    and (n.vigente_hasta is null or n.vigente_hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
    and (
      n.audience = 'Todos los socios'
      or (n.audience = 'Socios gratuitos' and coalesce(v_gratuito, true))
      or (v_plan is not null and n.audience = 'Plan ' || v_plan)
    )
  order by n.created_at desc;
end $$;

-- OJO CON `anon`: Supabase otorga toda función nueva de `public` a `anon` y
-- `authenticated` por default privileges, y ese permiso es explícito sobre el
-- rol — `revoke ... from public` no lo toca. La clave anónima viaja dentro del
-- bundle de la app, así que sin esta línea cualquiera lee los avisos del club
-- sin tener cuenta. Ya pasó con `avisos_del_foro`.
revoke all on function avisos_del_club(uuid) from public;
revoke all on function avisos_del_club(uuid) from anon;
grant execute on function avisos_del_club(uuid) to authenticated, service_role;

comment on function avisos_del_club is
  'Los avisos que el club mandó a la campanita y que le corresponden a ese socio por su audiencia, vigentes a hoy. La presentación (agrupado por fecha, ícono) vive en buildNotifs de @kumo/shared.';
