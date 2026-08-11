# Arquitectura · Kumo

## Visión general

Kumo es un monorepo con cuatro superficies que comparten un mismo dominio
(socios, mascotas, planes, reintegros, prestadores, beneficios, comunidad) a
través del paquete `@kumo/shared`. El backend es Supabase; el deploy web es
Vercel; los mails son de Resend; los mapas, Google Maps.

```
                         ┌─────────────────────────┐
                         │      Supabase (BaaS)     │
                         │  Postgres · Auth ·       │
                         │  Storage · Realtime · RLS│
                         └────────────┬─────────────┘
                                      │  @supabase/supabase-js
        ┌──────────────┬─────────────┼──────────────┬───────────────┐
        │              │             │              │               │
   ┌────▼───┐    ┌─────▼────┐   ┌────▼────┐    ┌────▼─────┐    ┌────▼──────┐
   │ landing│    │  admin   │   │ webapp  │    │  mobile  │    │  Resend   │
   │ (Next) │    │  (Next)  │   │ (Next)  │    │  (Expo)  │    │  (mails)  │
   └────────┘    └──────────┘   └─────────┘    └──────────┘    └───────────┘
        └──────────────┴──── @kumo/shared ──────┴──────────────┘
                 (tokens, tipos, datos, cliente Supabase)
```

## Paquete compartido `@kumo/shared`

- **`tokens.ts`** — colores (`#5D5491` púrpura, `#E1FB62` lima), tipografías
  (Baloo 2 + DM Sans), radios y sombras. Tailwind (web) y el theme de RN
  (móvil) leen de acá, así la identidad visual es única.
- **`types.ts`** — tipos del dominio, alineados 1:1 con `supabase/schema.sql`.
- **`data/`** — datos de ejemplo del prototipo. Doble uso: desarrollar UI sin
  backend y generar el seed.
- **`supabase.ts`** — `createBrowserClient`, `createServiceClient` y
  `subscribeTable` (helper de Realtime).

## Modelo de datos (Supabase)

Tablas: `profiles` (extiende `auth.users`, con rol socio/prestador/admin),
`plans`, `pets`, `vaccinations`, `providers`, `benefits`, `reimbursements`
(+ datos bancarios), `community_posts`, `community_answers`,
`push_notifications`, `faqs`, `emergency_contacts`, `club_settings`.

**RLS**: cada socio ve/edita solo lo suyo (perfil, mascotas, reintegros); el
catálogo (planes, beneficios activos, prestadores verificados, faqs) es
público; el admin (rol en `profiles`) tiene acceso total vía la función
`is_admin()`.

**Realtime**: habilitado en las tablas que la UI escucha en vivo. La cola de
reintegros del admin y el foro de la comunidad se actualizan sin recargar.

## Superficies

- **landing** — marketing, planes, alta de socios y prestadores. SSR/SSG para SEO.
- **admin** — panel interno: dashboard, socios, cola de reintegros (Realtime),
  prestadores, negocios, beneficios, notificaciones push, moderación, ajustes.
- **webapp** — versión de escritorio de la app del socio: carnet, reintegros,
  beneficios, servicios, comunidad.
- **mobile** — misma app para Android/iOS con Expo; comparte tokens, tipos,
  datos y cliente Supabase con la webapp.

## Servicios externos

- **Resend** — mails transaccionales (verificación de cuenta, avisos de
  reintegro, alta de prestador). Se invoca desde route handlers de Next o
  edge functions de Supabase con la `SUPABASE_SERVICE_ROLE_KEY` / `RESEND_API_KEY`.
- **Google Maps** — ubicación de prestadores por zona. En web,
  `@vis.gl/react-google-maps`; en móvil, `react-native-maps`. Las coordenadas
  (`lat`/`lng`) ya están en la tabla `providers`.

## Convenciones

- TypeScript estricto en todo el repo (`tsconfig.base.json`).
- Los tipos del dominio son la fuente de verdad; al cambiar el schema, se
  actualizan `types.ts` y el seed en conjunto.
- Nada de secretos en el cliente: la `service_role` key solo en servidor.
