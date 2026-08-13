-- A dónde va la plata, en las dos direcciones.
--
-- Son dos flujos opuestos que el paso 5 del alta mezclaba en un solo formulario:
--
--   Club → socio (reintegro): sale por TRANSFERENCIA. Se necesita CBU/CVU,
--   titular y CUIT. A una tarjeta no se le puede transferir. Hoy esos datos se
--   piden en CADA solicitud de reintegro (`reimbursements.bank_*`), así que el
--   socio los retipea siempre y el club no los tiene hasta el primer pedido.
--   Se pasan al perfil: se piden una vez en el alta y el reintegro los prefiltra.
--
--   Socio → club (cuota): entra por TARJETA, con la suscripción de Mercado Pago.
--   De la tarjeta se guarda solo lo que identifica el medio de pago. El número
--   completo y el CVV no: el CVV lo prohíbe PCI DSS después de autorizar (sin
--   excepciones) y el PAN obliga a certificar. Los últimos 4 y la marca los
--   calcula el navegador, así el número no llega ni de paso al servidor.
--
-- Además: el paso 5 mostraba los campos de tarjeta incluso eligiendo "Débito por
-- CBU/CVU", y el CBU no se pedía en ningún momento del alta.

-- ── Club → socio: dónde cobra el reintegro ──
alter table profiles
  add column if not exists bank_holder     text,
  add column if not exists bank_holder_dni text,
  add column if not exists bank_cuit       text,
  add column if not exists bank_name       text,
  add column if not exists bank_cbu        text,
  add column if not exists bank_alias      text;

comment on column profiles.bank_cbu is
  'CBU/CVU donde el club le transfiere los reintegros. Se pide una vez en el alta.';

-- Los socios que ya existen no tienen estos datos en el perfil, pero sí en su
-- último reintegro: se sube desde ahí para no volver a pedírselos.
with ultimo as (
  select distinct on (member_id) member_id, bank_holder, bank_holder_dni, bank_cuit, bank_name, bank_cbu, bank_alias
  from reimbursements
  where bank_cbu is not null
  order by member_id, requested_on desc
)
update profiles p set
  bank_holder     = u.bank_holder,
  bank_holder_dni = u.bank_holder_dni,
  bank_cuit       = u.bank_cuit,
  bank_name       = u.bank_name,
  bank_cbu        = u.bank_cbu,
  bank_alias      = u.bank_alias
from ultimo u
where p.id = u.member_id and p.bank_cbu is null;

-- ── Socio → club: con qué se le cobra la cuota ──
-- Metadata del medio de pago, nunca el instrumento. Cuando entre Mercado Pago se
-- suma acá el `preapproval_id` de la suscripción, que es lo que permite debitar
-- sin volver a tener la tarjeta.
alter table profiles
  add column if not exists card_brand  text,
  add column if not exists card_last4  text,
  add column if not exists card_exp    text,
  add column if not exists card_holder text;

do $$ begin
  alter table profiles add constraint profiles_card_last4_check
    check (card_last4 is null or card_last4 ~ '^[0-9]{4}$');
exception when duplicate_object then null; end $$;

comment on column profiles.card_last4 is
  'Últimos 4 dígitos, calculados en el navegador. El número completo y el CVV no se guardan (PCI DSS).';
