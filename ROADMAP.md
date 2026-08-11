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
- [ ] **ABM que quedó sin acción en el admin**: "+ Nuevo beneficio",
      "Editar plan", ficha del socio.
- [ ] **Alta real de prestador**: "Prestar servicio" / "Mi negocio" hoy no
      escriben en `providers` (mobile todavía usa el toggle DEMO del prototipo).
- [ ] **Contactos de emergencia en mobile** (la webapp ya los tiene).

## Fase 3 — Deploy y operación
- [ ] 3 proyectos en Vercel (landing, admin, webapp) desde este repo.
- [ ] Dominios: kumoclub.com.ar, admin.kumoclub.com.ar, app.kumoclub.com.ar.
- [ ] Variables de entorno de producción (ojo: `SUPABASE_SERVICE_ROLE_KEY` solo
      en la landing, que es la única que la usa en el route handler).
- [ ] Reemplazar las URLs `localhost:300x` hardcodeadas por variables de entorno.
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
