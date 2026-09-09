-- La campanita se leía por aparato, no por socio.
--
-- "Última vez que el socio miró las notificaciones" vivía en el localStorage del
-- navegador y en el AsyncStorage del teléfono, cada uno por su lado. Con eso,
-- marcarlas leídas en un lugar no las marcaba en los otros: el socio abría la
-- campanita en el celular, entraba después por la web y el contador seguía
-- prendido. Con dos computadoras y el teléfono, nunca se apagaba en todos.
--
-- Y había un segundo problema del mismo origen: la clave era una sola
-- (`kumo:notif-visto`, sin el id del socio), así que en un mismo navegador dos
-- cuentas compartían el "visto" — entrar con una marcaba leídas las de la otra.
--
-- Va en el perfil, que es de quien es el dato. NO se agrega a
-- `profiles_campos_protegidos` a propósito: esto lo tiene que poder escribir el
-- socio, es lo único que la campanita guarda y no habilita nada. La política
-- "perfil propio - update" ya alcanza, y pasa por `tiene_acceso()`, que mira el
-- estado del socio y no la cuota: el carnet y los foros son gratis, así que la
-- campanita de un socio sin plan también tiene que poder apagarse.

alter table profiles add column if not exists notifs_seen_at timestamptz;

comment on column profiles.notifs_seen_at is
  'Última vez que el socio abrió la campanita. Un aviso se muestra sin leer si su fecha es posterior a esto.';
