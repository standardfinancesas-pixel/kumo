-- El porcentaje de reintegro deja de vivir en el código.
--
-- Había TRES fuentes que decían cosas distintas y ninguna mandaba: la app usaba
-- 30/50/70, la webapp 50 fijo para todos, y los textos publicados de los planes
-- (`plans.perks`) dicen AMIGO 30, FAMILIA 50 y VIP 60. El mismo socio AMIGO con
-- el mismo gasto de $10.000 pedía $3.000 desde el teléfono y $5.000 desde el
-- navegador, y los dos números quedaban escritos en `refund_pct`: el panel veía
-- dos verdades para el mismo caso.
--
-- Ahora el número es un campo del plan. Importa que sea una COLUMNA y no una
-- constante: el club edita los planes desde el panel, y hasta hoy podía cambiar
-- el texto que dice "Reintegro 30%" sin que la cuenta se moviera un peso, porque
-- la cuenta estaba en el código y necesitaba un deploy y una OTA.
alter table plans add column if not exists refund_pct integer not null default 0;

update plans set refund_pct = 30 where name = 'AMIGO';
update plans set refund_pct = 50 where name = 'FAMILIA';
update plans set refund_pct = 60 where name = 'VIP';

-- ── Y lo calcula el servidor, no el cliente ──
--
-- El trigger ya existía (`20260812100000_columnas_del_club.sql`): fuerza que el
-- reintegro nazca en revisión y lo topea contra el gasto. Lo que NO hacía era
-- mirar el porcentaje: el comentario decía "lo calcula la app según el plan", o
-- sea que el monto lo mandaba el navegador y se guardaba tal cual.
--
-- Calcularlo acá arregla además a quien todavía no actualizó: una app vieja
-- sigue mandando su 70% de VIP y la base lo reescribe igual.
--
-- Si el socio no tiene plan —el caso "paga sin plan", que pasa cuando el cobro
-- se acredita y el plan no se llega a escribir— se deja lo que vino, topeado
-- contra el gasto, que es lo que hacía hasta hoy: mejor un número para revisar
-- que un reintegro de $0.
create or replace function reimbursements_estado_del_club()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pct integer;
begin
  if is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- El club decide si se aprueba y se acredita.
    new.status := 'en_revision';

    select p.refund_pct into pct
      from profiles pr
      join plans p on p.id = pr.plan_id
     where pr.id = new.member_id;

    if pct is not null and pct > 0 then
      new.refund_pct := pct;
      new.refund := round(new.amount::numeric * pct / 100)::integer;
    end if;

    -- Nunca más que el gasto: eso no es un plan, es un error o un abuso.
    if new.refund > new.amount then
      new.refund := new.amount;
    end if;
  else
    new.status := old.status;
    new.refund := old.refund;
    new.refund_pct := old.refund_pct;
    new.amount := old.amount;
  end if;
  return new;
end $$;
