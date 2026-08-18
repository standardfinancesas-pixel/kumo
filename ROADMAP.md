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
      **Falta config**: crear las credenciales en Google Cloud (redirect
      `https://oabkyafennfsrmnaroao.supabase.co/auth/v1/callback`) y pegarlas en
      Supabase → Authentication → Providers → Google.
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
- [ ] **Cobro de la cuota mensual — no existe.** El paso 5 valida la tarjeta y la
      descarta (bien: el CVV no se puede almacenar y el número obliga a certificar
      PCI DSS), así que **el socio queda `activo` sin que se le cobre nada**. El
      medio de pago ya queda identificado en el perfil (marca, últimos 4,
      vencimiento) y la cuota aceptada también, así que lo que falta es el cobro
      en sí: **suscripción de Mercado Pago** (decidido) — tokenizar con el SDK de
      MP en el navegador, crear el `preapproval`, guardar su id, y un webhook con
      validación HMAC que mueva al socio entre `activo` y `moroso`. Necesita el
      Access Token y la Public Key de la cuenta del cliente, y definir si se cobra
      desde el día 1 o hay período de gracia.
      **A confirmar con la API de MP** (no de memoria; hay un MCP de Mercado Pago
      que hay que autorizar desde una sesión interactiva): si el preapproval
      soporta debitar de un CBU. Hoy el paso 5 ofrece "Débito por CBU/CVU" y a
      quien lo elige no se le guarda tarjeta, así que no habría con qué debitarle.
      Ojo, son dos flujos opuestos y no hay que mezclarlos: el reintegro **no** se
      paga a la tarjeta, sale por transferencia al CBU del socio, y **la hace el
      club a mano** desde su home banking. El sistema no mueve plata: solo le
      muestra al admin a dónde mandarla.
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
      es `test_user`). Son veinte minutos.
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
      Ahora prende y apaga de verdad: apagarlo borra el token, y lo que corta el
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
- [ ] **Publicar en Google Play**: perfil `production` (genera el .aab, que es lo
      único que acepta la tienda). Necesita la cuenta de desarrollador de Google
      del cliente (USD 25 únicos) y decidir si el proyecto de Expo se transfiere a
      su nombre. Para iOS hace falta cuenta de Apple Developer.

## Pendiente de diseño
- [x] Responsividad de las 3 superficies web. Abajo de 1024px el sidebar de la
      webapp y del admin se convierte en un drawer que se abre desde una barra
      superior; las tablas del admin scrollean en horizontal y las grillas bajan
      a 2 y 1 columna. Verificado en 375, 768 y 1280 px.
