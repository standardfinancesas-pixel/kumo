-- Los topes dejan de ser una frase y pasan a cumplirse.
--
-- Cada plan publica un tope de reintegros ("Tope mensual $5.400", "Tope anual
-- $180.000") y hasta hoy eso era TEXTO: no lo verificaba la app, ni el servidor,
-- ni la base. Se podían pedir todos los reintegros del mes y nada avisaba. Lo
-- tapaba a medias que un admin aprueba a mano, o sea que el único control era
-- que alguien se acordara del número mientras miraba la cola.
--
-- Van al lado de `refund_pct`, por lo mismo: el club los edita desde el panel y
-- la línea que el socio LEE se arma con estos campos, así no pueden decir una
-- cosa y hacer otra.
alter table plans add column if not exists tope_mensual integer not null default 0;
alter table plans add column if not exists tope_anual   integer not null default 0;

-- 0 = sin tope. AMIGO no publica tope anual.
update plans set tope_mensual = 5400,  tope_anual = 0      where name = 'AMIGO';
update plans set tope_mensual = 12500, tope_anual = 180000 where name = 'FAMILIA';
update plans set tope_mensual = 15000, tope_anual = 495000 where name = 'VIP';

-- ── El trigger los aplica ──
--
-- Decidido con el club el 28/09/2026:
--
--  · El tope es POR SOCIO, no por mascota: es lo que dice el texto publicado,
--    que habla del plan.
--  · Al pasarse NO se rechaza el pedido: se paga hasta donde llega el tope. Si a
--    un AMIGO le corresponden $6.000 y le quedan $5.400, se registran $5.400.
--    Rechazarlo entero lo dejaría sin cobrar lo que sí le corresponde.
--  · Si no le queda NADA, ahí sí se corta, porque un reintegro de $0 no es un
--    reintegro: es una solicitud que ocupa la cola del club para nada.
--
-- Cuenta todo lo que no esté rechazado, incluido lo que está en revisión: un
-- pedido pendiente ya es un compromiso contra el tope del mes. Si contara sólo
-- lo acreditado, alcanzaba con mandar diez seguidos antes de que el club mire.
create or replace function reimbursements_estado_del_club()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pct        integer;
  tope_mes   integer;
  tope_anio  integer;
  usado      integer;
  queda      integer;
begin
  if is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- El club decide si se aprueba y se acredita.
    new.status := 'en_revision';

    select p.refund_pct, p.tope_mensual, p.tope_anual
      into pct, tope_mes, tope_anio
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

    if tope_mes is not null and tope_mes > 0 then
      select coalesce(sum(refund), 0) into usado
        from reimbursements
       where member_id = new.member_id
         and status <> 'rechazado'
         and requested_on >= date_trunc('month', new.requested_on)::date
         and requested_on <  (date_trunc('month', new.requested_on) + interval '1 month')::date;
      queda := tope_mes - usado;
      if queda <= 0 then
        raise exception 'Llegaste al tope de reintegros de tu plan para este mes.'
          using errcode = 'check_violation';
      end if;
      if new.refund > queda then
        new.refund := queda;
      end if;
    end if;

    if tope_anio is not null and tope_anio > 0 then
      select coalesce(sum(refund), 0) into usado
        from reimbursements
       where member_id = new.member_id
         and status <> 'rechazado'
         and requested_on >= date_trunc('year', new.requested_on)::date
         and requested_on <  (date_trunc('year', new.requested_on) + interval '1 year')::date;
      queda := tope_anio - usado;
      if queda <= 0 then
        raise exception 'Llegaste al tope de reintegros de tu plan para este año.'
          using errcode = 'check_violation';
      end if;
      if new.refund > queda then
        new.refund := queda;
      end if;
    end if;
  else
    new.status := old.status;
    new.refund := old.refund;
    new.refund_pct := old.refund_pct;
    new.amount := old.amount;
  end if;
  return new;
end $$;
