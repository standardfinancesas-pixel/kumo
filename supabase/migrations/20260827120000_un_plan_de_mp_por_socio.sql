-- Un PreApprovalPlan de Mercado Pago POR SOCIO, y la tabla que dice de quién es.
--
-- El flujo viejo creaba el PreApproval desde el servidor, y eso obligaba a
-- declarar un `payer_email` que Mercado Pago valida contra cuentas REALES: en el
-- checkout exige iniciar sesión con una cuenta cuyo email coincida exactamente.
-- El socio que usa otro mail en Mercado Pago que en Kumo no podía pagar, y el
-- que tiene la cuenta en otro país ni llegaba al checkout (400 "Payer is
-- associated with a different site"). No son casos marginales.
--
-- La salida es dejar de crear nosotros el PreApproval: se crea un
-- PreApprovalPlan por socio, se lo manda a SU init_point, y Mercado Pago crea la
-- suscripción con la cuenta que el socio tenga — nunca nombramos al pagador, así
-- que no hay email ni país que puedan no coincidir.
--
-- El costo es la atribución: una suscripción nacida así llega al webhook SIN
-- external_reference y sin payer_email — el único identificador que viaja es
-- `preapproval_plan_id`. Por eso el plan es POR SOCIO y no por producto, y por
-- eso existe esta tabla: mp_plan_id → socio. Es la pieza que sostiene toda la
-- atribución (el webhook resuelve por acá y después escribe la referencia en la
-- suscripción, así los avisos siguientes no dependen de esta tabla).
--
-- Las filas NO se borran al recrear un plan por un cambio de precio: un checkout
-- abierto en otra pestaña sobre un link viejo puede terminar en una suscripción
-- real, y sin la fila ese cobro no se puede atribuir a nadie. Son fontanería
-- barata; se acumulan y no molestan. El CASCADE de las dos FK es por lo mismo
-- pero al revés: si el socio o el plan del club desaparecen, estas filas no
-- tienen a quién apuntar y no deben frenar el borrado.

create table if not exists mp_member_plans (
  -- Lo que devuelve el webhook en `preapproval_plan_id`: es la llave del cruce.
  mp_plan_id   text primary key,
  member_id    uuid    not null references profiles(id) on delete cascade,
  plan_id      uuid    not null references plans(id)    on delete cascade,
  addon_odonto boolean not null default false,
  -- La cuota con la que se creó el plan (ARS). Si el precio cambió, el plan
  -- guardado ya no sirve y se crea otro: comparar este número es lo que lo dice.
  amount       integer not null,
  -- A dónde vuelve el socio al terminar. Va acá porque el plan lo fija al
  -- crearse y la vuelta es distinta según la superficie (webapp, app, alta):
  -- reutilizar un plan con otra vuelta mandaría al socio al lugar equivocado.
  back_url     text    not null,
  created_at   timestamptz not null default now()
);

create index if not exists mp_member_plans_member_idx on mp_member_plans(member_id);

-- Sin políticas a propósito: esta tabla la leen y escriben solo los route
-- handlers con la service-role (pagos/crear, el webhook y pagos/confirmar).
-- Ningún cliente tiene nada que hacer acá — un socio que pudiera escribirla se
-- atribuiría los pagos de otro.
alter table mp_member_plans enable row level security;

comment on table mp_member_plans is
  'Un PreApprovalPlan de Mercado Pago por socio. El webhook resuelve de quién es una suscripción nacida del flujo por plan cruzando preapproval_plan_id contra esta tabla. Solo service-role.';
