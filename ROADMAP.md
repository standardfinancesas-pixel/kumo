# Roadmap · Kumo

El prototipo original en `reference/kumo-prototype.html` es la guía visual 1:1
de cada pantalla.

## Fase 0 — Base (hecho ✅)
- [x] Monorepo (pnpm + Turborepo), tooling, TypeScript.
- [x] `@kumo/shared`: tokens, tipos, cliente Supabase.
- [x] Assets extraídos (imágenes + Baloo 2).
- [x] Supabase: schema + RLS + Realtime + seed.
- [x] Las 4 superficies portadas 1:1 del prototipo.

## Fase 1 — Backend real (hecho ✅)
- [x] Proyecto Supabase creado, schema + seed corridos.
- [x] Alta de socio real (auth user + `profiles` + `pets` + foto a Storage).
- [x] Login real con sesión compartida entre apps web (cookies vía `@supabase/ssr`).
- [x] Redirect por rol: admin → panel, socio → webapp.
- [x] Webapp: lectura y escritura reales (perfil, mascotas, vacunas, reintegros,
      contactos, foros).
- [x] Admin: las 11 secciones con datos y mutaciones reales.
- [x] Mobile: login propio (AsyncStorage) + datos y mutaciones reales.
- [x] Landing: planes, FAQ y contacto leídos de Supabase (editables desde el admin).

## Fase 2 — Lo que falta para poder operar de verdad
- [x] **Comprobante de reintegro a Storage**. Bucket privado `receipts` (no
      público como `pet-photos`: una factura tiene datos personales), path
      `{member_id}/{timestamp}.{ext}` y RLS por carpeta. El socio sube desde la
      webapp y el celular, el admin lo ve en "Ver detalle" con URL firmada a 5
      minutos. Verificado: ni un anónimo ni otro socio autenticado pueden leer
      un comprobante ajeno.
- [x] **Mail transaccional con Resend**: bienvenida al alta y aviso de reintegro
      aprobado/rechazado, con templates propios. Si el mail falla la operación no
      se revierte: el panel avisa para que el admin use otro canal.
      Dominio `kumo.pet` verificado (SPF + DKIM en GoDaddy, región `sa-east-1`) y
      `RESEND_FROM` = `Kumo <hola@kumo.pet>`. Hasta acá el remitente de prueba
      solo entregaba a la casilla dueña de la cuenta de Resend, o sea que **ningún
      socio recibía nada**. Probado de punta a punta con las dos plantillas.
      La casilla no recibe (un dominio verificado sirve para mandar, y sin MX la
      respuesta rebota), así que los mails mandan al WhatsApp del club, leído de
      `club_settings`.
- [x] **Los 13 mails del ciclo completo**, escritos en `lib/mail.ts`. Enganchados
      donde el disparador ya existe: acuse del pedido de reintegro, baja de la
      membresía y alta de negocio (los tres desde la webapp y desde mobile, vía
      `/api/avisos`), y publicado/rechazado del negocio desde el panel (vía
      `/api/prestadores/resolver`, que ahora resuelve y avisa en la misma
      operación, como el de reintegros). Los de vacuna, cambio de plan y cobro
      quedan escritos y sin llamador a propósito: el primero necesita el cron y
      los otros el cobro, y cada uno lo dice en su comentario.
      Detalles que costaron: los textos estaban en **femenino** para todo el mundo
      ("¡Bienvenida!", "sos la socia #55") y el club nunca pregunta el género, así
      que van en neutro; y mobile no tiene cookies, así que manda la sesión en
      `Authorization: Bearer` (ver `lib/avisos.ts` y `lib/quien-pide.ts`) — sin eso
      el mismo botón mandaba o no mandaba el aviso según el aparato.
      **Falta**: la plantilla de recuperar contraseña sigue siendo la de Supabase,
      en inglés y sin la marca. Se cambia en el panel de Supabase, no en el código.
- [x] **El número de socio es de los socios.** Era un `serial` que corría para
      cualquier perfil: un admin quedaba como "socio #60" y cada usuario de prueba
      se llevaba un número, dejando huecos. Ahora lo asigna un trigger solo si el
      perfil es de un socio, una vez, y no cambia nunca más —ni al cambiar de rol,
      porque un número que cambia no identifica a nadie—. Los tres socios se
      renumeraron a 1, 2 y 3, que era la última oportunidad: ninguno había visto su
      número en un carnet. De acá en adelante los huecos se aceptan.
      Ojo con dos cosas al tocar esto: el trigger se llama
      `profiles_numero_de_socio` para que corra DESPUÉS de `profiles_campos_guard`
      (Postgres los ordena alfabéticamente y el guard congela `member_no`), y ese
      mismo guard obliga a apagarlo un instante en cualquier corrección hecha desde
      el editor de SQL, donde `is_admin()` da false.
- [x] **Login con Google**, solo para entrar: quien no es socio recibe un aviso
      y se le cierra la sesión, porque el alta pide plan, mascota y medio de pago.
      **La config ya está hecha** (credenciales de Google Cloud con el redirect
      `https://oabkyafennfsrmnaroao.supabase.co/auth/v1/callback`, pegadas en
      Supabase → Authentication → Providers → Google). Se puede verificar sin
      entrar a ningún panel, porque Supabase publica los proveedores activos:
      `curl "$SUPABASE_URL/auth/v1/settings" -H "apikey: $ANON_KEY"` devuelve
      `external.google: true`. Vale la pena chequearlo antes de cada publicación
      en Play: el botón está visible en las dos superficies, y si el proveedor se
      cae el revisor lo toca, se rompe y rechaza la app.
- [x] **ABM del admin**: "+ Nuevo beneficio" (inserta en `benefits`), "Editar
      plan" (precio, bajada, destacado y perks) y la ficha del socio (datos,
      mascotas y reintegros, pedidos al abrir el modal). El "Ver detalle" de la
      cola de reintegros ya muestra el comprobante.
- [x] **Alta real de prestador**: el socio se da de alta en "Mi negocio" (queda
      pendiente), el admin lo valida en Negocios y aparece en Servicios. El
      estado sale de la base, no del selector DEMO del prototipo, que se
      eliminó de la web y de mobile.
- [x] **Registrarse con Google, no solo entrar.** Antes una cuenta de Google sin
      perfil se rechazaba y se le cerraba la sesión. Ahora arranca el alta con el
      nombre y el mail cargados y sin paso de contraseña; el resto del formulario
      es igual, porque Google no aporta plan, mascota, declaración ni CBU. La
      identidad sale de la SESIÓN del servidor y nunca del payload: probado
      mandando el mail de otra persona con la sesión propia, rechazado.
- [x] **Contactos de emergencia en mobile.** El carnet los lista y se agregan y
      borran desde ahí, igual que en la webapp.
- [x] **Mi perfil y Mi negocio en mobile, a la par de la webapp.** Mi perfil edita
      datos, cuenta bancaria y plan, y da de baja la membresía; Mi negocio edita
      la ficha y la da de baja. Arrastraban los defectos que la web ya tenía
      arreglados (guardar decía "listo" sin escribir nada, y la baja del negocio
      no hacía nada por falta de políticas de UPDATE/DELETE sobre `providers`).
- [x] **Foto de la mascota, unificada.** En mobile no existía NINGUNA forma de
      ponerla —el selector de imágenes estaba solo para el comprobante del
      reintegro— y en la webapp faltaba al agregar. Ahora hay foto al agregar en
      las dos, y en mobile se cambia tocándola en la ficha. Las reglas de formato
      y peso y la convención de ruta viven en `@kumo/shared`
      (`motivoFotoInvalida`, `rutaFoto`): el mensaje estaba escrito dos veces y
      había empezado a divergir. En mobile los bytes salen del base64 del picker,
      con un decodificador a mano, para no meter `expo-file-system` —un módulo
      nativo obligaría a un build en vez de salir por OTA.
- [ ] **Cuatro decisiones de schema para Mi negocio**, todas cosas que el
      prototipo muestra y la base no tiene dónde guardar: galería de fotos (tabla
      aparte), logo del negocio (columna), horarios de atención (hoy solo hay
      días y un rango de texto) y tarifas múltiples (hoy es un único
      `price` + `price_unit`).
- [x] **Un cambio de precio alcanza a los ya suscriptos.** Antes el precio nuevo
      regía solo para los que se sumaban después: la suscripción de Mercado Pago
      debita para siempre el monto con el que se creó. Ahora el precio pasa por
      `/api/planes/precio` (el modal del panel ya no lo escribe directo), que
      actualiza `plans.base_price`, la cuota acordada de cada socio del plan
      (con su add-on) y el débito de las suscripciones vivas — y avisa por mail
      a cada socio activo cuya cuota cambió (mail 15). Si algún PUT a Mercado
      Pago falla, el perfil de ese socio no se toca y el panel ofrece reintentar
      guardando de nuevo; el mail no se duplica. **Falta la prueba con datos
      reales**: guardar un precio con un socio suscripto y ver débito + mail.
- [ ] **Cambio de plan: hoy es gratis.** El socio cambia de plan desde Mi perfil
      y la escritura es real (`profiles.plan_id`), pero como no hay cobro, nada
      impide pasarse solo de AMIGO a VIP y quedarse con los topes del plan más
      caro sin pagar la diferencia. Por eso `plan_id` quedó fuera de los campos
      protegidos por trigger: la UI lo escribe. Definir si el cambio pasa por la
      pasarela, desde cuándo aplica (¿ciclo siguiente?) y si el downgrade tiene
      restricciones. Va atado al cobro de la cuota.
- [x] **El alta guarda los 5 pasos** (antes guardaba dos y medio). Se agregaron:
      la declaración jurada completa en `health_declarations` —con el texto de
      cada pregunta al lado de la respuesta, armado en el servidor, y sin
      políticas de update/delete para que no se pueda reescribir—, la cobertura
      odontológica, la cuota aceptada (calculada en el servidor), el medio de
      pago, y el domicilio partido en `address` / `city` / `province`. El alta
      ahora **exige** la declaración: sin ella responde 400 y no crea la cuenta.
      De la tarjeta se guarda solo marca, últimos 4, vencimiento y titular,
      calculados en el navegador; el número completo no llega al servidor ni de
      paso y el CVV no sale del formulario (PCI DSS).
      Los datos bancarios pasaron al perfil: el club transfiere el reintegro a
      mano y ahora los ve en la ficha desde el alta, en vez de tener que abrir una
      solicitud. El formulario de reintegro los prefija en web y en mobile.
- [ ] **Los socios que ya existen no tienen declaración jurada.** No se puede
      inventar: hay que pedírsela. La ficha del panel lo dice explícitamente en
      vez de mostrar un vacío ambiguo. Falta definir si la app se la pide al
      entrar.
- [x] **Editar y borrar mascotas, y borrar lo propio en el foro.** Las políticas
      estaban (menos la de borrar respuestas, que faltaba entera); lo que no había
      era interfaz. Editar reusa el formulario del alta sin volver a pedir la
      declaración: se firma una vez y no se reescribe. Ojo con un detalle que casi
      se colaba: la tarjeta muestra la raza armada ("Mestizo · 3 años · 18 kg") y
      "Sin chip" cuando está vacío, así que prellenar con lo que se ve convertía
      esos textos en datos reales al guardar. La hoja lee los valores CRUDOS.
      Los borrados avisan qué se llevan: un post arrastra las respuestas de otros
      (cascada) y una mascota su carnet; los reintegros y la declaración jurada
      sobreviven porque son `on delete set null`.
- [ ] **Bloque de contacto del prestador: falta el email.** `instagram` y
      `website` ya están en `providers`, se editan desde Mi negocio y se muestran
      en la ficha de Servicios, en web y en mobile. Pero el bloque de contacto del
      prototipo tiene además una fila de **Email**, y `providers` no tiene esa
      columna. Definir si va (y si es el mail de contacto público del negocio o el
      del dueño, que ya está en `profiles`).
- [x] **Mail de contacto del club, unificado.** `club_settings.email` pasó a
      `hola@kumo.pet` y /legal lo lee de ahí —igual que la landing— en vez de
      tenerlo escrito a mano dos veces. Importaba porque son las cláusulas de datos
      personales y de arrepentimiento (Ley 24.240): es la dirección donde el socio
      ejerce sus derechos, y apuntaba a un dominio viejo. De paso el WhatsApp va
      como link tocable y sale de la misma tabla.
- [ ] **`hola@kumo.pet` todavía no recibe.** `kumo.pet` no tiene MX (el único MX
      es el de `send.kumo.pet`, que es el feedback de Resend), así que hoy todo lo
      que le escriban rebota. Resend sirve para MANDAR, no para recibir. Hace falta
      una casilla o un reenvío: lo más rápido es el forwarding gratis de GoDaddy
      hacia flor@cambalache.studio; lo prolijo, Google Workspace. Hasta que esté,
      el canal que el club atiende de verdad es el WhatsApp.
- [x] **Cobro de la cuota mensual, hecho.** Suscripción de Mercado Pago con débito
      automático: el socio no ve la app hasta que la cuota está paga (muro en la
      webapp y en la app, con los tres planes y la cobertura odontológica adentro),
      autoriza una vez en el sitio de MP —la tarjeta nunca pasa por Kumo— y de ahí
      MP debita todos los meses. El acceso lo da **solo** el webhook, nunca la
      vuelta del navegador: `?suscripcion=ok` lo puede tipear cualquiera, y el que
      pagó puede cerrar el navegador antes de volver. El webhook verifica la firma,
      no le cree al cuerpo del aviso (le pregunta a MP por el id) y acredita en una
      función de la base que bloquea las filas: cinco avisos simultáneos del mismo
      cobro acreditan uno solo. Si la tarjeta rebota, MP reintenta unos días, cada
      intento queda registrado con su motivo, y el socio recibe mail y push — el
      acceso no se corta ese día, sino cuando se le termina el mes que ya pagó. La
      baja del débito está en Mi perfil en las dos superficies. El club lo ve todo
      en **Cobros**, y tiene "Registrar pago" para el efectivo y las
      transferencias. Los estados y la concurrencia están probados (14 chequeos).
      **Falta la corrida real contra MP**: que acepte la suscripción con un pagador
      de prueba y si la vuelta al sitio es automática.
- [ ] **Limpiar el paso 5 del alta, que quedó desfasado.** Ahí se elige "tarjeta o
      CBU" y ya no define nada del cobro: la cuota la cobra Mercado Pago y la
      tarjeta se pone en su sitio. Los últimos 4 de la tarjeta que quedan en el
      perfil son decorativos. Y la opción "CBU" en realidad carga la **cuenta de
      los reintegros**, que es el flujo contrario: son dos cosas distintas y en esa
      pantalla se ven como una sola. Decisión del cliente (18/08: prefiere dejarlo
      como está por ahora, entendiendo que ese paso es para el reintegro).
      Ojo con la confusión de fondo, que ya se dio: el reintegro **no** se paga a
      la tarjeta, sale por transferencia al CBU del socio, y **la hace el club a
      mano** desde su home banking. El sistema no mueve esa plata: solo le muestra
      al admin a dónde mandarla.
- [x] **Fecha de resolución de un reintegro** (`resolved_at`). La escribe el route
      handler que resuelve, que es el único lugar donde un reintegro cambia de
      estado. El seguimiento fecha el estado FINAL al que llegó y deja los
      intermedios hechos pero sin fecha: con una sola fecha no se pueden inventar
      dos. Las notificaciones ahora se fechan por la resolución y no por el pedido,
      que podía ser semanas antes. Los reintegros resueltos antes de la columna
      quedan sin fecha, que es la verdad.
- [ ] **Definir si hay tope anual de reintegros.** La pantalla del prototipo dice
      "de $180.000 de tope anual", sus Términos dicen "No existe tope anual: los
      topes mensual y por evento reemplazan cualquier límite anual", y los perks
      del plan en el seed dicen "Tope anual $180.000". Si hay tope, va como
      columna de `plans` (hoy no existe) y se muestra en la tarjeta de Reintegros.

## Fase 3 — Deploy y operación
- [x] **Un solo proyecto en Vercel** (equipo `kumo`), con las tres secciones en
      `apps/web`: `/`, `/app` y `/admin`. En vivo en https://www.kumo.pet.
- [x] Variables de entorno de producción, declaradas también en `turbo.json`
      (si no, no llegan al build). La `SUPABASE_SERVICE_ROLE_KEY` está
      encriptada y es la única sensible.
- [x] URLs entre secciones por `urls` de `@kumo/shared`, sin `localhost`.
- [ ] **Activar el débito automático desde Mi perfil.** Hoy el único lugar donde se
      ofrece suscribirse es el muro de la cuota, así que un socio que pagó por
      transferencia —o que está al día por un "Registrar pago" del panel— no tiene
      forma de activar el débito: no tiene muro. Y el estado `pending` es invisible:
      si dejó una suscripción a medias, Mi perfil dice "sin débito automático" y no
      que la empezó. Las dos cosas se arreglan con una fila en Mi perfil que use la
      misma ruta `/api/pagos/crear`. Salió al mirar por qué no aparecía el botón de
      baja — correcto que no aparezca: solo existe con la suscripción autorizada.
- [x] **El email de una cuenta de prueba se DEDUCE del nombre de usuario**, y eso
      es lo que destrabó el sandbox después de varios días (19/08). El panel de MP
      no lo muestra en ningún lado; se saca de los dígitos del usuario:
      `TESTUSER328791889392025651` → `test_user_328791889392025651@testuser.com`.
      Verificado contra la API: con ese email la suscripción se crea (201, con su
      `init_point`); dos variantes inventadas dieron 500, así que sirve exactamente
      el derivado del usuario comprador. Iba en `MP_PAYER_EMAIL_PRUEBA`.
      **OBSOLETO desde el flujo por plan (27/08)**: el servidor ya no declara
      ningún pagador —la suscripción la crea Mercado Pago con la cuenta con la que
      el socio inicia sesión en el checkout—, así que la variable no la lee nadie.
      **Borrarla de Vercel**; para probar en sandbox alcanza con entrar al checkout
      como el comprador de prueba. El email derivado sigue siendo el dato para ESE
      login.
- [x] **Cobro por plan-por-socio (27/08): el mail de Mercado Pago ya no tiene que
      coincidir con el de Kumo.** El flujo viejo creaba el PreApproval desde el
      servidor con `payer_email`, y MP valida ese campo contra cuentas reales: en
      el checkout exige iniciar sesión con una cuenta cuyo email coincida
      exactamente, y el que tiene la cuenta en otro país ni llega (400 «Payer is
      associated with a different site»). Tampoco hay email astuto: uno sintético
      pasa la CREACIÓN y falla recién al autorizar («Tu e-mail no coincide con el
      de la suscripción») — probar la creación no prueba nada.
      Ahora se crea un **PreApprovalPlan POR SOCIO** (`mp_member_plans` mapea
      `mp_plan_id` → socio) y se lo manda al init_point del plan: la suscripción
      la crea MP con la cuenta que el socio tenga. La atribución va por el mapeo
      —el webhook resuelve por `preapproval_plan_id` y después escribe
      `external_reference` en la suscripción, así los avisos siguientes no
      dependen de la tabla—. Los mapeos NO se borran al recrear un plan: un
      checkout abierto en una pestaña vieja puede terminar en una suscripción
      real, y sin la fila ese cobro queda sin dueño. Si aun así llega una
      suscripción inatribuible, sale una ALERTA por mail al club, no un log.
      Guardas nuevas en el webhook: una cancelación de una suscripción ya
      reemplazada no pisa el perfil, y una suscripción nueva autorizada cancela a
      la anterior viva (MP acepta dos y cobra dos).
      **FALTA para darlo por bueno**: correr la migración
      `20260827120000_un_plan_de_mp_por_socio.sql` (antes de deployar: el código
      corta el pago con error si la tabla no está, a propósito), y al menos un
      pago COMPLETO en sandbox — la mitad de las restricciones de MP se aplican
      al autorizar, así que crear el plan no prueba nada. Ojo en local: el
      `back_url` de MP rechaza `localhost` (400) pero acepta `127.0.0.1`.
- [ ] **Las credenciales de MP que hacen falta son DOS, y ninguna es la que
      probamos el 18/08.** Con el token de **prueba de la cuenta real** del club
      (`TEST-…`) las suscripciones no funcionan de ninguna forma, y MP lo dice
      desde los dos lados: con un pagador de prueba responde *"Both payer and
      collector must be real or test users"* (400), y con un pagador real, el
      checkout corta con *"una de las partes es de prueba"*. Para MP, ese token
      hace que **el que cobra sea "de prueba"**, así que no hay pagador que
      combine. Sirvió para verificar que la integración habla con MP y nada más.
      Hacen falta:
      1. **Token de una aplicación creada DENTRO de una cuenta de prueba
         vendedora** (pestaña *Vendedor* en Cuentas de prueba) → para probar sin
         plata, con la cuenta de prueba compradora como socio.
      2. **Token de producción de la cuenta real** (`APP_USR-…`) → para cobrar de
         verdad.
      Ojo: cada aplicación tiene su propia clave de webhook, así que al cambiar el
      token hay que cambiar también `MP_WEBHOOK_SECRET` y reconfigurar la URL en el
      panel de esa aplicación.
- [ ] **BLOQUEANTE antes del primer socio real: volver al token de producción de
      Mercado Pago.** Para probar se usa el token de una cuenta de PRUEBA (una
      cuenta distinta de la del club, no un "modo"), y va a quedar puesta varios
      días. Mientras esté, un socio que se suscriba entra al club y **la plata no
      entra a ningún lado**: el error no da ninguna señal, nadie se queja y se
      descubre al cierre del mes. Hoy no hay socios reales pagando, así que no
      corre riesgo; el día que se invite al primero, esto tiene que estar hecho.
      Hay una capa parcial (los cobros que llegan por un aviso de prueba quedan
      marcados en la fila y los totales de Cobros no los suman), pero avisa
      después del cobro. Falta la capa que evita el olvido: un cartel en el panel
      cuando la cuenta de cobro configurada es de prueba — el dato sale de
      preguntarle a MP por la cuenta del token (`/users/me` devuelve el mail y si
      es `test_user`). Son veinte minutos. Con el flujo por plan (27/08) las
      variables a tocar el día del cambio quedaron en DOS: el token
      (`MP_ACCESS_TOKEN` → `APP_USR-…`) y borrar `MP_WEBHOOK_SECRET_TEST`.
      `MP_PAYER_EMAIL_PRUEBA` ya no la lee nadie.
- [ ] **Autorizar la GitHub App de Vercel en la organización** para tener
      deploys automáticos y preview URLs. Lo tiene que hacer un owner de la org
      del cliente; hoy cada deploy sale a mano desde el CLI.
- [x] **Dominio propio `kumo.pet`**, con el DNS en GoDaddy (no en Vercel: solo
      alojan la zona de dominios comprados ahí). `A @ → 76.76.21.21` y
      `CNAME www → cname.vercel-dns.com`; el apex redirige a www. Dos cosas que
      costaron: había tres A en el apex — dos IPs de parking de GoDaddy que
      redirigían kumo.pet a kumo.pet, o sea un loop infinito en 2 de cada 3
      visitas — y el certificado nunca se emitió, porque se pidió mientras el DNS
      todavía daba SERVFAIL y Vercel no reintentó. Se forzó con `vercel certs
      issue`.
- [ ] **`RESEND_FROM` en el entorno Preview.** Está en Production y Development;
      el CLI se cuelga pidiendo rama de git al agregarlo a Preview, incluso con la
      forma que él mismo sugiere. Es un click en Vercel → Settings → Environment
      Variables. Sin eso los deploys de preview mandan desde `onboarding@resend.dev`.
- [ ] Analítica y monitoreo de errores.

## Fase 4 — Mapas, push y comunidad
- [ ] Google Maps real en webapp y mobile (hoy los mapas son SVG decorativos con
      pins posicionados a mano; la distancia en km sí es real, por Haversine).
- [x] **Push notifications, hechas.** Tabla `push_tokens` (el token de Expo es la
      dirección del aparato Y la credencial), la app registrándose al entrar y
      olvidándose al salir, `/api/push/enviar` que resuelve la audiencia y le pega
      a la Expo Push API, y el panel mostrando a cuántos llegó de verdad en vez de
      decir "Enviadas" sobre cero. Los tokens muertos (`DeviceNotRegistered`) se
      borran en el mismo envío: si no, el número de entregados deja de significar
      nada. Y un cron diario (`/api/cron/vacunas`, 09:00 de Buenos Aires) avisa las
      vacunas que vencen dentro de 3 días, por push Y por mail — antes el aviso
      existía solo DENTRO de la app y se calculaba cuando el socio la abría, así que
      a quien no entraba no le llegaba nada, que es justo el caso que un
      recordatorio tiene que cubrir. La marca de "ya avisado" es por vacuna, y un
      trigger la borra si la vacuna se aplica o se reprograma.
      **La config, ya hecha:** `CRON_SECRET` en Vercel (el cron se niega a correr
      en producción sin ella: mejor que no funcione y avise, que quedar abierto a
      cualquiera que sepa la URL), credenciales de FCM subidas a EAS —sin eso
      Android no entrega en el APK instalado, porque Expo usa FCM por debajo— y el
      build nuevo, que hacía falta porque `expo-notifications` es módulo nativo y
      no sale por OTA. Envío verificado: "llegó a 1 dispositivo".
      **Para iOS falta cuenta de Apple Developer** (usa APNs, no Firebase).
- [x] **El socio decide si los quiere.** El switch "Push y recordatorios" de la
      pantalla de Notificaciones estaba pintado prendido y no había nada atrás.
      Ahora prende y apaga de verdad, y solo en la app: en la webapp el switch
      se eliminó en vez de cablearlo, porque en el navegador el push es otro
      mecanismo (Web Push con service worker y VAPID, que además Safari en
      iPhone solo entrega si el sitio está agregado a la pantalla de inicio).
      Apagarlo borra el token, y lo que corta el
      envío es el token que no está — el club le manda a los tokens que tiene, así
      que no hace falta que cada envío pregunte por una preferencia. La preferencia
      vive en el teléfono, no en el perfil: es del aparato, no de la persona.
      Y tocar un aviso abre la pantalla del aviso: todos viajaban con
      `data.pantalla` desde el cron y el panel, y nadie lo leía.
- [ ] **Probar de punta a punta el push de "reintegro resuelto" y "negocio
      publicado".** El código está y usa el mismo envío que ya entregó, pero
      dispararlo manda un mail real al socio, así que quedó sin probar en vivo.

- [x] **Reseñas de prestadores reales** (`provider_reviews`): el socio califica y
      comenta, una reseña por prestador y editable. El promedio y el conteo los
      recalcula el trigger `provider_reviews_sync`, así que la estrella de la
      lista nunca se desfasa. Los ratings del seed quedaron en cero: eran
      inventados.
- [x] **Favoritos** (`provider_favorites`): el corazón de la ficha, la tarjeta
      "Guardados" de Servicios y "Mis guardados" del menú, compartidos entre la
      webapp y la app.
- [x] **Foro completo**: hilo con respuestas, responder de verdad
      (`community_answers`) y likes persistentes en post y en respuesta
      (`post_likes` / `answer_likes`), uno por socio. Los contadores `likes` y
      `replies` los mantienen triggers, así que la tarjeta del listado y el hilo
      no se desfasan.
- [x] **Borrar lo propio en el foro** y **los contadores, que nunca se movían**.
      Este último salió midiendo el borrado: dos triggers se pisaban. El que
      protege las columnas del club congelaba `likes` y `replies` para que nadie
      los infle, y con eso descartaba el recuento del trigger de sincronización,
      que pasa por el mismo BEFORE UPDATE. Resultado: todo el foro decía "0
      respuestas · 0 me gusta". Ahora en vez de congelar se recalcula, así los dos
      caminos convergen y un `PATCH` con `likes: 9999` igual termina en el número
      real. Verificado subiendo, bajando y tratando de inflarlo.
- [x] Marcar "mejor respuesta", en las dos superficies: el control lo ve solo quien
      preguntó, y sobre respuestas ajenas. Se desmarcan las otras primero, porque
      "la mejor" es una sola y eso es regla del producto, no de la tabla.
- [x] Foto en la publicación (`community_posts.photo_url`). La fila "Agregá una
      foto · Opcional" del prototipo, en la webapp y en mobile: sube al bucket y
      guarda la URL pública (el prototipo la perdía al publicar, era un data-URL
      en memoria). Se muestra en el hilo.
- [x] Realtime con `subscribeTable` en la cola de reintegros del admin: chip "En
      vivo" —que solo aparece si el canal realmente se conectó— y un aviso de
      "hay cambios nuevos" que refresca cuando el admin lo pide. No se reordena
      sola: la lista no puede moverse debajo del cursor justo antes de un clic en
      "Aprobar". Ignora los cambios que hizo este mismo panel. Verificado de
      punta a punta: evento recibido, aviso, refresco y la solicitud en la cola.

## Fase 5 — Móvil nativo
- [ ] Navegación con Expo Router (hoy es un `App.tsx` con estado local).
- [x] **Íconos, splash y assets nativos.** Generados desde el logo vectorial con
      `scripts/generar-iconos.mjs` y el TTF real de Baloo 2, no dibujados a mano.
      El ícono lleva solo la gota: cuatro letras a 48dp son un manchón, y el
      launcher ya escribe "Kumo" debajo. La palabra va en el splash.
- [x] **Builds con EAS y OTA.** APK andando (`pet.kumo.app`, proyecto
      `@flor2021/kumo`) y `expo-updates` configurado: los cambios de JS y de
      assets salen con `eas update --branch apk` y llegan sin reinstalar. Lo
      nativo (ícono, splash, package name, módulos nuevos) sigue necesitando
      build. Ojo: `runtimeVersion` está atado a la versión de la app, así que
      subir `version` en `app.json` corta los updates para los celulares que
      tengan la anterior.
- [x] **Upgrade a Expo SDK 57** (desde el 51), que era condición para publicar:
      Google exige que las apps nuevas targeteen Android 16 (API 36) y el SDK 51
      compila contra Android 14. Arrastró React 18 → 19, React Native 0.74 → 0.86
      y Node 20 → 22. Tres cosas que costaron encontrar:
      **(1)** los 200 errores de "'Svg' cannot be used as a JSX component" no eran
      de react-native-svg sino del `.npmrc`: `hoist-pattern[]=!@types/react` dejaba
      a los paquetes anidados sin los tipos de React, y con `skipLibCheck` el error
      no aparecía ahí sino en el código de la app. Esa exclusión existía porque
      mobile iba en @types/react 18 y la web en 19; al unificarse en 19, se sacó.
      **(2)** el `splash` de `app.json` se movió al plugin `expo-splash-screen`.
      **(3)** `getLastNotificationResponseAsync` pasó de no-op a tirar excepción en
      web, y sin guarda la app no renderizaba.
- [x] **El edge-to-edge en Android, verificado en dispositivo.** Desde el SDK 54
      la app dibuja abajo de la barra de estado y de la de navegación, y no se
      puede desactivar. Se migró de `SafeAreaView` de react-native (deprecado, en
      Android nunca reservó nada) a `react-native-safe-area-context`, con el
      provider en `index.tsx`.
      **El dato que importa para la próxima vez**: el `overflow: 'hidden'` que
      arregla las esquinas cuadradas hizo falta SOLO en las vistas de tamaño fijo
      ajustado alrededor de un ícono (los cuadraditos y los círculos). Las ~31
      tarjetas, filas y chips que además llevan texto NUNCA estuvieron rotas y
      quedaron sin tocar a propósito: ahí `overflow: 'hidden'` puede cortar el
      texto, y habría sido cambiar un bug visual por uno que esconde contenido.
      Si algún día reaparece el síntoma, mirar primero ese subconjunto, no todo.
- [x] **Prueba de humo del upgrade en un Android real**: subir foto de mascota
      (`expo-image-picker`, saltó 15 mayores), el mapa de Servicios
      (`react-native-maps` 1.14 → 1.27), recibir un push (cambió la API del
      handler), cerrar sesión y volver a entrar (`AsyncStorage` 1.x → 2.x, ahí
      vive la sesión) y el flujo de pago (sale al navegador y vuelve por deep
      link). Los cinco andan. Es lo que el typecheck no puede probar: el bug de
      las esquinas pasó todos los chequeos automáticos y estaba roto igual.
- [ ] **Publicar en Google Play**: perfil `production` (genera el .aab, que es lo
      único que acepta la tienda). La cuenta del cliente ya está y con permisos de
      administrador, así que se puede crear la service account y usar `eas submit`
      (no hace falta una primera subida manual). Falta confirmar si la cuenta es de
      organización o personal: si es personal y es post-noviembre 2023, antes de
      producción hay que correr un closed testing con 12 testers durante 14 días
      corridos. Para iOS hace falta cuenta de Apple Developer.

## Pendiente de diseño
- [x] Responsividad de las 3 superficies web. Abajo de 1024px el sidebar de la
      webapp y del admin se convierte en un drawer que se abre desde una barra
      superior; las tablas del admin scrollean en horizontal y las grillas bajan
      a 2 y 1 columna. Verificado en 375, 768 y 1280 px.
