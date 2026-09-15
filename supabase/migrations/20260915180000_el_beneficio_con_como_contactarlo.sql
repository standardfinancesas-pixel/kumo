-- El beneficio no tenía cómo contactar al comercio.
--
-- `benefits` guardaba nombre, categoría, descuento, plan, zona, dirección, días,
-- horario y detalle. Nada para llamar a nadie. La ficha del socio terminaba en
-- "Mostrar carnet": veía que la veterinaria le hace 30% y no tenía manera de
-- pedir un turno.
--
-- Se nota con los beneficios que son a domicilio o con turno previo, que es el
-- caso que lo destapó: una veterinaria de Godoy Cruz que atiende a domicilio no
-- tiene local al que ir, así que el contacto no es un dato más — es el único
-- camino que hay.
--
-- Las mismas tres columnas que ya tiene `providers`, con los mismos nombres: son
-- el mismo dato, las pantallas los muestran igual y las funciones que convierten
-- lo escrito en un link que funciona (urlWhatsapp, urlTel, urlInstagram,
-- urlSitio, en packages/shared) se usan para los dos sin tocar nada.
--
-- Las tres son opcionales: un beneficio sin contacto sigue siendo válido, y la
-- ficha simplemente no muestra la sección.

alter table benefits
  add column if not exists phone     text,
  add column if not exists instagram text,
  add column if not exists website   text;

comment on column benefits.phone is
  'Teléfono del comercio. Con esto la ficha del socio ofrece WhatsApp y llamar.';
