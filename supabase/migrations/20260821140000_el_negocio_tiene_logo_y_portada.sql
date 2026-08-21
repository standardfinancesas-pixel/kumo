-- El negocio tiene logo Y portada, que son dos imágenes distintas.
--
-- `providers` tenía una sola (`photo_url`) y la pantalla la usaba para los dos
-- trabajos: la portada de la ficha y el cuadradito redondo del listado. Con una
-- foto de local, el cuadradito muestra un recorte del medio de la pared; con un
-- logo, la portada sale un logo estirado a lo ancho. Son dos encuadres y dos
-- funciones, y el prototipo (reference/kumo-prototype.html) siempre pidió las dos:
-- "Logo de la marca" y "Foto de portada".
--
-- Aditiva y sin default: `logo_url` en null es "todavía no subió logo", y ahí la
-- pantalla cae en la portada y después en el ícono del rubro. Los negocios que ya
-- existen no cambian de aspecto: lo que tienen cargado es la portada.

alter table providers add column if not exists logo_url text;

comment on column providers.photo_url is
  'La foto de portada: la banda de arriba de la ficha y el fondo del listado.';
comment on column providers.logo_url is
  'El logo de la marca, cuadrado: el avatar de la ficha y el cuadradito del listado. Null = no subió logo, se usa la portada.';
