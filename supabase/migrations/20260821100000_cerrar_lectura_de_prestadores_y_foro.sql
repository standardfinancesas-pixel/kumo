-- ============================================================
--  El directorio y el foro se leen solo con sesión
-- ============================================================
-- La anon key va en el bundle del navegador: es pública por diseño. Con ella, sin
-- ninguna sesión, se bajaba el directorio completo del club — los cinco
-- prestadores con nombre, teléfono, dirección e Instagram, que son datos de
-- contacto de personas. Y el foro tenía `using (true)`: hoy no filtraba nada
-- porque no hay posteos, pero el primero que se publique se leería sin sesión, y
-- ahí van cosas como una mascota perdida con su dirección.
--
-- Los beneficios se cerraron en la Fase 1 por este mismo motivo; estas dos
-- quedaron abiertas.
--
-- La puerta correcta es `tiene_acceso()` y NO `tiene_plan_pago()`: Servicios y el
-- foro son gratis para el socio, así que el corte es "entró al club", no "pagó".
-- `tiene_acceso()` ya deja pasar al admin y al prestador (su primera condición es
-- `role <> 'socio'`), así que el panel sigue viendo todo sin agregar nada.
--
-- Solo cambian políticas de SELECT. Las de escritura —crear posteo, editar,
-- moderar, dar de alta un negocio— quedan intactas.

-- Prestadores. `is_admin()` va explícito porque el panel necesita ver además los
-- pendientes y los rechazados, que no tienen status 'verificado'.
drop policy if exists "prestadores visibles" on providers;
create policy "prestadores visibles" on providers for select
  using ((status = 'verificado' and tiene_acceso()) or is_admin() or owner_id = auth.uid());

-- El foro: posteos, respuestas y los dos likes.
drop policy if exists "posts visibles" on community_posts;
create policy "posts visibles" on community_posts for select using (tiene_acceso());

drop policy if exists "respuestas visibles" on community_answers;
create policy "respuestas visibles" on community_answers for select using (tiene_acceso());

drop policy if exists "likes visibles" on post_likes;
create policy "likes visibles" on post_likes for select using (tiene_acceso());

drop policy if exists "likes de respuesta visibles" on answer_likes;
create policy "likes de respuesta visibles" on answer_likes for select using (tiene_acceso());

-- Lo que sigue abierto a propósito, porque es lo único que la landing pública lee
-- con la anon key: `plans`, `faqs` y `club_settings`.
