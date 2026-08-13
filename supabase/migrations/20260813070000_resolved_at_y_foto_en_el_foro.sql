-- Dos columnas que faltaban.
--
-- 1) `reimbursements.resolved_at`: hasta ahora solo se guardaba cuándo se pidió
--    el reintegro. El seguimiento del detalle marcaba los pasos como hechos pero
--    sin fecha, y las notificaciones fechaban "acreditado" con el día del pedido,
--    que puede ser semanas antes. La escribe el route handler que resuelve, que
--    es el único lugar donde un reintegro cambia de estado.
--
-- 2) `community_posts.photo_url`: el prototipo ofrece adjuntar una foto a la
--    publicación y la tabla no tenía dónde guardarla, así que el botón no se
--    podía construir. Va la URL pública del bucket `pet-photos`, igual que las
--    fotos de mascota y la portada del negocio.

alter table reimbursements
  add column if not exists resolved_at timestamptz;

comment on column reimbursements.resolved_at is
  'Cuándo el club lo acreditó o rechazó. Null mientras está en revisión.';

-- Los que ya están resueltos no tienen fecha y no se puede inventar: se deja en
-- null y la pantalla muestra el paso hecho sin fecha, que es la verdad.

alter table community_posts
  add column if not exists photo_url text;

-- El guard de columnas del club no la toca: no es un contador ni un campo de
-- moderación, es contenido del autor. Y la política de update de `community_posts`
-- ya es solo para el autor o el admin.
