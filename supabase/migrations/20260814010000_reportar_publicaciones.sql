-- Reportar una publicación del foro.
--
-- La pantalla de Moderación del panel existe y funciona, pero **nunca podía
-- recibir nada**: ninguna pantalla del socio ponía `reported = true`, así que
-- estaba condenada a mostrar "no hay publicaciones reportadas" para siempre.
--
-- No se puede resolver abriendo la política de update de `community_posts`: es
-- por fila, no por columna, así que dejar que cualquiera marque `reported`
-- también lo dejaría reescribir el título y el cuerpo de un post ajeno. Va por
-- una función `security definer`, que es la única forma de permitir exactamente
-- una cosa.
--
-- Y se guarda el MOTIVO: el panel mostraba "Reportado por la comunidad" fijo para
-- todos, con lo que quien modera no sabía si el problema era spam o una agresión.

alter table public.community_posts
  add column if not exists report_reason text;

comment on column public.community_posts.report_reason is
  'Por qué lo reportaron. La escribe reportar_post(); el club la limpia al mantener la publicación.';

create or replace function public.reportar_post(p_post_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Hay que tener sesión para reportar.';
  end if;

  -- `not reported` hace que el primer motivo sea el que queda: un segundo reporte
  -- no lo pisa, así el club lee por qué se reportó primero. Y `author_id <>
  -- auth.uid()` porque reportarse a uno mismo no significa nada.
  update community_posts
     set reported      = true,
         report_reason = coalesce(nullif(btrim(p_motivo), ''), 'Sin motivo')
   where id = p_post_id
     and not reported
     and author_id is distinct from auth.uid();
end $$;

revoke all on function public.reportar_post(uuid, text) from public;
grant execute on function public.reportar_post(uuid, text) to authenticated;
