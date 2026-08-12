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
- [ ] **Contactos de emergencia en mobile** (la webapp ya los tiene).
- [ ] **Mi perfil y Mi negocio en mobile.** En la webapp quedaron funcionando de
      verdad; en mobile hay que revisar la paridad, porque arrastran los mismos
      defectos que tenía la web antes de arreglarla (guardar decía "listo" y no
      escribía nada, y "dar de baja mi negocio" no hacía nada por falta de
      políticas de UPDATE/DELETE sobre `providers`, ya corregidas en la base).
- [ ] **Cambiar la foto de la mascota desde la tarjeta del Inicio.** Se salteó a
      propósito: el path de subida ya está escrito tres veces (alta, Mis mascotas
      y mobile) y una cuarta copia pide antes unificarlo en un helper.
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
- [ ] **Repasar campo por campo los datos que pide el alta.** Hoy guarda nombre,
      email, teléfono, DNI, fecha de nacimiento y domicilio. El domicilio se
      concatena en una sola columna (`address` = domicilio + localidad +
      provincia), así que no se puede filtrar ni segmentar por localidad ni por
      provincia — y el club se organiza por zonas. Definir qué campos se piden,
      cuáles son obligatorios y cuáles conviene separar.
- [ ] **Bloque de contacto del prestador: falta el email.** `instagram` y
      `website` ya están en `providers`, se editan desde Mi negocio y se muestran
      en la ficha de Servicios, en web y en mobile. Pero el bloque de contacto del
      prototipo tiene además una fila de **Email**, y `providers` no tiene esa
      columna. Definir si va (y si es el mail de contacto público del negocio o el
      del dueño, que ya está en `profiles`).
- [ ] **Unificar el mail de contacto del club.** `club_settings.email` dice
      `hola@kumoclub.com.ar` y /legal lo tiene hardcodeado dos veces, justo en las
      cláusulas de datos personales y de arrepentimiento (Ley 24.240). Con los
      mails saliendo de `kumo.pet`, la página legal manda a los socios a otro
      dominio. Va a `hola@kumo.pet` y /legal debería leerlo de `club_settings`
      como hace la landing, no tenerlo escrito a mano.
- [ ] **Cobro de la cuota mensual — no existe.** El paso 5 del alta pide número,
      vencimiento y CVV, los valida y los descarta: al servidor solo viajan
      `{ socio, pet, plan }`. Está bien que no se guarden (el CVV no se puede
      almacenar y guardar el número obliga a certificar PCI DSS), pero significa
      que **el socio queda `activo` sin que se le cobre nada**. Lo que falta:
      tokenizar la tarjeta contra la pasarela (Mercado Pago) y guardar solo el
      token y los últimos 4 dígitos; suscripción recurrente; webhook de pago que
      mueva el socio entre `activo` y `moroso`; y mostrar el medio de pago en Mi
      perfil. Necesita las credenciales del cliente.
      Ojo: el reintegro **no** se paga a la tarjeta sino por transferencia al
      CBU/CVU que ahora se pide en la solicitud. Son dos flujos distintos.
- [ ] **Fecha de resolución de un reintegro** (`resolved_at`). Hoy solo se guarda
      cuándo se pidió, así que el seguimiento del detalle marca los pasos hechos
      pero sin fecha, y las notificaciones fechan el reintegro por el pedido.
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
- [ ] Push notifications reales con Expo (el admin ya las guarda en
      `push_notifications`, pero nadie las envía). Falta: `expo-notifications` en
      la app pidiendo permiso, una tabla de tokens de dispositivo por socio, el
      envío a la Expo Push API y un cron que revise vacunas por vencer — hoy las
      notificaciones se calculan recién cuando el socio abre la app
      (`packages/shared/src/notifs.ts`). El switch "Push y recordatorios" de la
      pantalla de notificaciones es decorativo hasta entonces, igual que en el
      prototipo. En la webapp sería Web Push, otro mecanismo.
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
- [ ] Marcar "mejor respuesta": falta el control en la UI. La base ya lo permite
      — la política deja setear `best` al autor del post y el trigger impide que
      lo haga el de la respuesta — pero en la webapp y en mobile el badge solo se
      muestra, no hay con qué marcarla.
- [ ] Foto en la publicación: el prototipo la ofrece pero `community_posts` no
      tiene dónde guardarla.
- [ ] Realtime con `subscribeTable` en la cola de reintegros del admin.

## Fase 5 — Móvil nativo
- [ ] Navegación con Expo Router (hoy es un `App.tsx` con estado local).
- [ ] Íconos, splash y assets nativos (faltan en `app.json`).
- [ ] Builds con EAS y publicación en App Store y Google Play.

## Pendiente de diseño
- [x] Responsividad de las 3 superficies web. Abajo de 1024px el sidebar de la
      webapp y del admin se convierte en un drawer que se abre desde una barra
      superior; las tablas del admin scrollean en horizontal y las grillas bajan
      a 2 y 1 columna. Verificado en 375, 768 y 1280 px.
