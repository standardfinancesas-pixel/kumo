-- "Plan AMIGO" tenía que significar lo mismo en los tres lados.
--
-- El panel contaba los socios de un plan CON LA CUOTA AL DÍA, y el push se lo
-- mandaba a cualquiera que tuviera el plan escrito, pagara o no. El club veía "2
-- destinatarios" y el aviso llegaba a 4 — pasó el 16/09/2026 con un envío a Plan
-- AMIGO, y así se descubrió todo esto.
--
-- Desde hoy el plan se escribe en el perfil cuando ENTRA LA PLATA y no cuando el
-- socio lo elige, así que casi no quedan perfiles con plan sin pagar. Pero queda
-- un caso que no cubre eso: el que pagó y se le venció. Ése conserva el plan
-- escrito y no está al día, y sin esta condición seguiría recibiendo los avisos
-- de "Plan AMIGO" — cuando la audiencia que le corresponde es la de gratuitos,
-- que existe justamente para decirle "activá tu cuota".

create or replace function avisos_del_club(p_member uuid)
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
  v_vacunas boolean;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if auth.uid() is not null and p_member is distinct from auth.uid() then
    raise exception 'Solo podés pedir tus propios avisos';
  end if;

  /*
   * El plan cuenta SÓLO si la cuota está al día, y gratuito es exactamente lo
   * contrario. Las dos definiciones son las mismas que usa `tokensDeAudiencia`
   * en lib/push: si no coincidieran, el mismo aviso llegaría a gente distinta
   * según el canal.
   */
  select case when pr.paid_until is not null and pr.paid_until >= hoy then p.name::text end,
         (pr.paid_until is null or pr.paid_until < hoy)
    into v_plan, v_gratuito
  from profiles pr left join plans p on p.id = pr.plan_id
  where pr.id = p_member;

  select exists (
    select 1 from vaccinations v
    join pets pe on pe.id = v.pet_id
    where pe.owner_id = p_member and v.status = 'pendiente'
  ) into v_vacunas;

  return query
  select n.id, n.title, n.body, n.destino, n.created_at
  from push_notifications n
  where n.en_campanita
    and n.sent_at is not null
    and (n.vigente_hasta is null or n.vigente_hasta >= hoy)
    and (
      n.audience = 'Todos los socios'
      or (n.audience = 'Socios gratuitos' and coalesce(v_gratuito, true))
      or (n.audience = 'Vacunas pendientes' and coalesce(v_vacunas, false))
      or (v_plan is not null and n.audience = 'Plan ' || v_plan)
    )
  order by n.created_at desc;
end $$;
