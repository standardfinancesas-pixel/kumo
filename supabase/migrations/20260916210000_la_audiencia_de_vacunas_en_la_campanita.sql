-- "Vacunas pendientes" no le llegaba a nadie en la campanita.
--
-- Al escribir `avisos_del_club` dejé esa audiencia afuera a propósito, razonando
-- que un aviso guardado envejece mal: el socio da la vacuna y el cartel sigue
-- ahí. Pero el resultado no fue que se comportara distinto — fue que un aviso
-- mandado a esa audiencia con la campanita marcada no le aparece A NADIE, y
-- nada lo dice. El panel informa el envío igual.
--
-- Eso es la misma clase de bug que este panel ya tuvo con el push, cuando decía
-- "Enviadas" y no salía a ningún teléfono: una pantalla que asegura que algo
-- pasó cuando no pasó. Preferible tenerla andando y que el club acorte la
-- vigencia si el aviso no envejece bien.
--
-- Se resuelve igual que en `tokensDeAudiencia`: dueño de alguna mascota con una
-- vacuna pendiente. `exists` y no un join, que multiplicaría la fila del aviso
-- por cada vacuna.

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
    and (n.vigente_hasta is null or n.vigente_hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
    and (
      n.audience = 'Todos los socios'
      or (n.audience = 'Socios gratuitos' and coalesce(v_gratuito, true))
      or (n.audience = 'Vacunas pendientes' and coalesce(v_vacunas, false))
      or (v_plan is not null and n.audience = 'Plan ' || v_plan)
    )
  order by n.created_at desc;
end $$;

-- Acá alcanza con `create or replace` —no cambian las columnas de salida—, así
-- que los permisos de la función siguen como estaban y no hay que reponerlos.
