-- Borrar lo que uno publicó en el foro.
--
-- El post propio ya se podía borrar por RLS ("posts borrar"), pero no había botón
-- en ninguna de las dos superficies, así que en la práctica no se podía. La
-- respuesta propia no se podía ni por RLS: `community_answers` tenía políticas de
-- select, insert y update, y ninguna de delete — sin política, nadie borra.
--
-- Los contadores se acomodan solos: `community_answers_count` y los de likes ya
-- corren `after insert or delete`, así que `replies` y `likes` se recalculan.
--
-- Ojo con el efecto en cascada, que es a propósito pero hay que tenerlo presente:
-- `community_answers.post_id` es ON DELETE CASCADE, así que borrar un post se
-- lleva TODAS sus respuestas, incluidas las de otros socios. La pantalla lo avisa
-- con la cantidad antes de confirmar; no se puede borrar "en silencio" algo que
-- se lleva el trabajo ajeno.

drop policy if exists "respuestas borrar" on community_answers;
create policy "respuestas borrar" on community_answers for delete
  using (author_id = auth.uid() or is_admin());
