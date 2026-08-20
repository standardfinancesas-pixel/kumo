-- ============================================================
--  Los beneficios, también en el mapa
-- ============================================================
-- Un beneficio es un descuento en un comercio, y de ese comercio la tabla sabía
-- el nombre y la zona ("Palermo") y nada más. Así, la pantalla de Beneficios no
-- podía contestar la única pregunta que importa cuando uno va a usar un
-- descuento: si le queda cerca. Los prestadores ya se ubican por su dirección
-- (ver la migración anterior) y los beneficios quedaban como la mitad suelta.
--
-- Estas tres columnas son lo mismo que se le agregó a `providers`: la dirección
-- que carga el club en el panel, y el punto que el servidor resuelve a partir de
-- ella con Nominatim (OpenStreetMap). Una consulta por beneficio, guardada acá.
--
-- La dirección es opcional a propósito y sin ella no hay coordenadas: resolver la
-- zona pondría a todos los comercios de Palermo en el mismo punto del mapa, unos
-- tapando a otros. Sin coordenadas el beneficio se sigue viendo en la lista, con
-- su zona escrita, y sin distancia — que es la verdad.
alter table public.benefits
  add column if not exists address text,
  add column if not exists lat     double precision,
  add column if not exists lng     double precision;

comment on column public.benefits.address is
  'Dirección del comercio, opcional. La carga el club en el panel y es lo que pone al beneficio en el mapa y le da distancia.';
comment on column public.benefits.lat is
  'Latitud del comercio, resuelta por el servidor a partir de address + zone (Nominatim/OpenStreetMap). Null = sin dirección o no se pudo resolver: el beneficio se ve en la lista sin distancia.';
comment on column public.benefits.lng is
  'Longitud del comercio. Ver benefits.lat.';
