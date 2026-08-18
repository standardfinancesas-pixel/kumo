-- ============================================================
--  "En mora" deja de ser un estado
-- ============================================================
-- El panel mostraba ESTADO "Al día" y CUOTA "Sin pagar" en la misma fila, sobre
-- socios que no pagaron nunca. Las dos no pueden ser ciertas.
--
-- El origen: `member_status` mezclaba dos preguntas distintas.
--   · la relación con el club  → activo / suspendido / baja   (la decide una persona)
--   · la cuota                 → paid_until contra hoy        (la decide un pago)
--
-- Y 'moroso' era la mezcla de las dos. Buscamos quién lo escribía y no lo
-- escribía NADIE: no había pantalla, ni cron, ni acción en el panel. Un valor que
-- se leía en cinco lugares y no se seteaba en ninguno, con el filtro "En mora"
-- del panel devolviendo vacío para siempre.
--
-- Desde acá, "debe la cuota" no se guarda: se calcula con `paid_until < hoy`.
-- Guardarlo duplicaba la verdad, y cuando la verdad vive en dos lugares uno de
-- los dos se equivoca. Es el mismo criterio por el que la cuota es una fecha y no
-- un booleano "al día".
--
-- 'moroso' queda en el enum (sacar un valor de un enum en Postgres es reescribir
-- la columna y no vale la pena) pero deja de usarse. Se verificó antes de correr
-- esto que no hay ningún perfil con ese estado.

comment on column public.profiles.status is
  'La relación del socio con el club: activo · suspendido (el club le cortó el acceso) · baja (se fue, cuenta para el churn). NO dice nada de la cuota: eso es paid_until. "moroso" quedó del modelo anterior y no se usa: nadie lo escribía.';

-- El acceso mira solamente `activo`. Antes dejaba pasar también a `moroso`, que
-- era la forma de decir "debe la cuota pero puede entrar" — y ahora eso lo
-- resuelve el muro de la cuota, que es lo que corresponde: al que debe el mes se
-- le pide pagar, no se lo echa del club.
create or replace function public.tiene_acceso()
returns boolean language sql stable security definer set search_path = public as $$
  -- Lista blanca y no negra: si mañana aparece un estado nuevo, lo seguro es que
  -- no dé acceso hasta que alguien lo decida.
  -- Al prestador y al admin no los toca: su acceso no depende de la cuota.
  select coalesce(
    (select p.role <> 'socio' or p.status = 'activo'
       from profiles p where p.id = auth.uid()),
    false);
$$;
