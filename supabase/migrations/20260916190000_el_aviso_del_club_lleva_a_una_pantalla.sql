-- El aviso del club no llevaba a ningún lado.
--
-- El push ya viajaba con un dato `pantalla` que la app lee al abrirlo —así
-- funcionan los avisos automáticos, que te dejan en el carnet o en reintegros—,
-- pero el que escribe el club mandaba siempre 'inicio', que no matchea con
-- ninguna pantalla válida: abría la app y nada más. "Nuevo beneficio en tu zona"
-- te dejaba en Inicio a buscarlo.
--
-- La elección es UNA y vale para los dos canales. Que el push te lleve a
-- Beneficios y el mismo aviso en la campanita no haga nada sería una diferencia
-- que nadie puede explicar.
--
-- Null = no lleva a ningún lado, y es el default: un aviso puede ser sólo un
-- cartel, y mandar a una pantalla que no tiene que ver es peor que no hacer nada.

alter table push_notifications add column if not exists destino text;

comment on column push_notifications.destino is
  'A qué pantalla lleva el aviso al tocarlo, en el push y en la campanita: carnet | servicios | beneficios | reintegros | foros | minegocio | perfil. Null = no lleva a ningún lado.';

/*
 * La función tiene que devolver el destino, y agregar una columna de salida no
 * se puede con `create or replace`: hay que borrarla y crearla de nuevo. Los
 * permisos se pierden con el drop, así que se vuelven a poner abajo — incluido
 * el revoke a `anon`, que es el que importa.
 */
drop function if exists avisos_del_club(uuid);

create function avisos_del_club(p_member uuid)
returns table (
  id         uuid,
  title      text,
  body       text,
  destino    text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_plan text;
  v_gratuito boolean;
begin
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
  select n.id, n.title, n.body, n.destino, n.created_at
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
-- `authenticated` por default privileges, y el drop de arriba borró los revokes
-- que ya habíamos puesto. Sin estas líneas la función vuelve a quedar abierta a
-- la clave anónima, que viaja dentro del bundle de la app.
revoke all on function avisos_del_club(uuid) from public;
revoke all on function avisos_del_club(uuid) from anon;
grant execute on function avisos_del_club(uuid) to authenticated, service_role;

comment on function avisos_del_club is
  'Los avisos que el club mandó a la campanita y que le corresponden a ese socio por su audiencia, vigentes a hoy, con la pantalla a la que lleva cada uno. La presentación vive en buildNotifs de @kumo/shared.';
