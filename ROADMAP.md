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
- [ ] **Mail transaccional** (Resend o similar): bienvenida al alta y aviso de
      reintegro aprobado/rechazado.
- [ ] **Login con Google**: el botón existe en el modal pero está deshabilitado.
- [x] **ABM del admin**: "+ Nuevo beneficio" (inserta en `benefits`), "Editar
      plan" (precio, bajada, destacado y perks) y la ficha del socio (datos,
      mascotas y reintegros, pedidos al abrir el modal). El "Ver detalle" de la
      cola de reintegros ya muestra el comprobante.
- [ ] **Alta real de prestador**: "Prestar servicio" / "Mi negocio" hoy no
      escriben en `providers` (mobile todavía usa el toggle DEMO del prototipo).
- [ ] **Contactos de emergencia en mobile** (la webapp ya los tiene).

## Fase 3 — Deploy y operación
- [x] **Un solo proyecto en Vercel** (equipo `kumo`), con las tres secciones en
      `apps/web`: `/`, `/app` y `/admin`. Publicado y andando en
      https://kumo-landing.vercel.app (el subdominio quedó con el nombre viejo
      del proyecto; se reemplaza cuando se conecte el dominio propio).
- [x] Variables de entorno de producción, declaradas también en `turbo.json`
      (si no, no llegan al build). La `SUPABASE_SERVICE_ROLE_KEY` está
      encriptada y es la única sensible.
- [x] URLs entre secciones por `urls` de `@kumo/shared`, sin `localhost`.
- [ ] **Autorizar la GitHub App de Vercel en la organización** para tener
      deploys automáticos y preview URLs. Lo tiene que hacer un owner de la org
      del cliente; hoy cada deploy sale a mano desde el CLI.
- [ ] Dominio propio: kumoclub.com.ar.
- [ ] Analítica y monitoreo de errores.

## Fase 4 — Mapas, push y comunidad
- [ ] Google Maps real en webapp y mobile (hoy los mapas son SVG decorativos con
      pins posicionados a mano; la distancia en km sí es real, por Haversine).
- [ ] Push notifications reales con Expo (el admin ya las guarda en
      `push_notifications`, pero nadie las envía).
- [ ] Reseñas de prestadores (hoy `rating` y `reviews` vienen del seed).
- [ ] Favoritos ("Mis guardados") y likes de foro persistentes — faltan tabla y
      políticas RLS.
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
