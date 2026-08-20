-- ============================================================
--  El mapa arranca en la casa del socio
-- ============================================================
-- Hasta ahora todo lo que decía "a 5,9 km de tu casa" se medía desde el Obelisco:
-- un punto fijo escrito a mano en la web y en la app, con un comentario que lo
-- admitía ("no tenemos la ubicación real del socio"). El domicilio estaba ahí
-- —lo pide el alta desde el primer día— pero nadie lo usaba, así que el número
-- era cierto para el centro de CABA y falso para el socio.
--
-- Estas tres columnas son el domicilio convertido en coordenadas. Las escribe el
-- servidor geocodificando `address + city + province` con Nominatim (el
-- geocodificador de OpenStreetMap, el mismo proyecto que las teselas del mapa):
-- una consulta por socio, en el alta y cuando cambia su domicilio, guardada acá
-- para que ninguna pantalla tenga que preguntar de nuevo.
--
-- Son aditivas y no tocan ningún dato existente. Los socios que ya estaban se
-- rellenaron de a uno con el mismo código.
alter table public.profiles
  add column if not exists lat        double precision,
  add column if not exists lng        double precision,
  add column if not exists geo_origen text;

comment on column public.profiles.lat is
  'Latitud del domicilio del socio. La escribe el servidor geocodificando address+city+province. Null = no se pudo resolver: el mapa y las distancias caen al centro de CABA, y la pantalla dice "del centro" en vez de "de tu casa".';
comment on column public.profiles.lng is
  'Longitud del domicilio del socio. Ver profiles.lat.';
comment on column public.profiles.geo_origen is
  'Con qué precisión se resolvió el domicilio: "domicilio" = la calle y la altura (la pantalla dice "de tu casa"), "localidad" = solo la ciudad (dice "de tu zona"). Null junto con lat/lng nulos.';

-- Que no entre cualquier cosa: el texto lo lee la pantalla para elegir entre "de
-- tu casa" y "de tu zona", y un tercer valor la dejaría muda.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_geo_origen_valido') then
    alter table public.profiles
      add constraint profiles_geo_origen_valido
      check (geo_origen is null or geo_origen in ('domicilio', 'localidad'));
  end if;
end $$;

-- Nada que agregar en las políticas ni en el trigger de campos protegidos: el
-- socio ya puede escribir su propia fila, y estas tres columnas no son un permiso
-- —mover su propio mapa no le da acceso a nada—. Por eso no se blindan como
-- `paid_until` o `mp_*`.
