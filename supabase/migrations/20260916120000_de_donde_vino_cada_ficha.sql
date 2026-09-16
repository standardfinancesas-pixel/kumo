-- De dónde vino cada ficha de Servicios.
--
-- El panel decía "Sin cuenta asociada: lo cargó el club a mano" para toda ficha
-- sin `owner_id`, y era verdad mientras hubo dos orígenes: el club a mano, o un
-- socio desde la app. El 15/09/2026 apareció un tercero —el formulario público
-- de la landing, que crea fichas sin dueño— y esa frase pasó a afirmar algo que
-- ya no se puede deducir de la fila.
--
-- No es sólo un texto mal puesto: el mismo cartel decía "no hay a quién avisarle
-- por mail", que para una solicitud de la landing es cierto y engañoso al mismo
-- tiempo. No hay mail porque ahí no se pide, pero el WhatsApp es OBLIGATORIO
-- justamente para poder contestar — y está tres líneas más arriba en la misma
-- ficha. El club leía "no hay forma de contactarlo" con el teléfono a la vista.
--
-- Valores: 'landing' (formulario público), 'socio' (alta desde la app) y 'club'
-- (lo cargó el club). Las que ya existen quedan en NULL, que es la verdad: no
-- sabemos cuál de las tres fue, y el panel lo dice así en vez de inventarlo.
--
-- Es texto libre y no un enum a propósito: un enum nuevo hay que migrarlo para
-- sumarle un valor, y esto es una etiqueta de procedencia, no una regla.

alter table providers add column if not exists origen text;

comment on column providers.origen is
  'De dónde vino la ficha: landing | socio | club. NULL en las anteriores al 16/09/2026.';
