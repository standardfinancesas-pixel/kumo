# Guía para Claude Code · Kumo

Monorepo pnpm + Turborepo. Dos superficies: `apps/web` (Next.js) y `apps/mobile`
(Expo), sobre una capa compartida `packages/shared` y backend Supabase.

`apps/web` contiene las tres secciones en una sola app, así comparten origen y
la sesión de Supabase sin configurar nada:

| Ruta     | Qué es              | Código                |
| -------- | ------------------- | --------------------- |
| `/`      | la web pública      | `app/page.tsx`        |
| `/app`   | la cuenta del socio | `app/app/`            |
| `/admin` | el panel del club   | `app/admin/`          |

## Reglas del proyecto
- **Identidad visual**: usar SIEMPRE los tokens de `@kumo/shared` (colores,
  fuentes Baloo 2 + DM Sans). No hardcodear colores nuevos.
- **Tipos**: `packages/shared/src/types.ts` es la fuente de verdad y debe
  quedar alineado con `supabase/schema.sql`. Si cambia uno, cambiar el otro.
- **Referencia visual**: `reference/kumo-prototype.html` es el diseño exacto a
  reproducir. Abrilo para ver el detalle de cualquier pantalla antes de portarla.
- **CSS**: un solo `app/globals.css` para las tres secciones. Las clases de cada
  una van prefijadas (`.r-` público, `.wa-` socio, `.adm-` panel) para que no se
  pisen. El fondo propio del panel se aplica en `app/admin/layout.tsx`.
- **Rutas entre secciones**: usar `urls` de `@kumo/shared`, nunca hardcodear.
- **Realtime**: para datos que se actualizan en vivo, usar `subscribeTable`
  de `@kumo/shared` (ver firma en `packages/shared/src/supabase.ts`). Todavía
  no está adoptado en ninguna pantalla.
- **Clientes de Supabase** (`apps/web/lib/`), cada uno con su propósito:
  `supabase-browser` (navegador, sesión en cookies), `supabase-server`
  (Server Components, lee la sesión), `supabase-public` (anon sin cookies, para
  contenido cacheable) y `supabase-service` (service-role, ignora RLS: SOLO en
  route handlers).
- **Secretos**: la `SUPABASE_SERVICE_ROLE_KEY` solo en código de servidor.
- **React**: `apps/web` usa React 19 (lo exige el App Router de Next 15) y
  `apps/mobile` React 18.2.0 (lo exige Expo 51). No unificar.
- **`.npmrc`**: no volver a poner `node-linker=hoisted` — rompe el build de
  producción de Next (ver el comentario en el archivo).

## Comandos
- `pnpm install` — instalar todo.
- `pnpm dev:web` — el sitio en el puerto 3000 (las tres secciones).
- `pnpm dev:mobile` — la app Expo.
- `pnpm --filter @kumo/mobile run web` — la app Expo en el navegador (puerto 8081).
- `pnpm typecheck` / `pnpm lint` — chequeos.
- `pnpm --filter @kumo/web run build` — build de producción (correrlo antes de
  deployar: hay errores que solo aparecen ahí).
- `supabase db reset` — recrear la base local con schema + seed.

## Idioma
- Producto y UI en español rioplatense (Argentina). Moneda ARS.
