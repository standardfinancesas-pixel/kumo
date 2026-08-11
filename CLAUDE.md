# Guía para Claude Code · Kumo

Monorepo pnpm + Turborepo. Cuatro superficies (`apps/landing`, `apps/admin`,
`apps/webapp` en Next.js; `apps/mobile` en Expo) sobre una capa compartida
`packages/shared` y backend Supabase.

## Reglas del proyecto
- **Identidad visual**: usar SIEMPRE los tokens de `@kumo/shared` (colores,
  fuentes Baloo 2 + DM Sans). No hardcodear colores nuevos.
- **Tipos**: `packages/shared/src/types.ts` es la fuente de verdad y debe
  quedar alineado con `supabase/schema.sql`. Si cambia uno, cambiar el otro.
- **Referencia visual**: `reference/kumo-prototype.html` es el diseño exacto a
  reproducir. Abrilo para ver el detalle de cualquier pantalla antes de portarla.
- **Realtime**: para datos que se actualizan en vivo, usar `subscribeTable`
  de `@kumo/shared` (ver firma en `packages/shared/src/supabase.ts`). Todavía
  no está adoptado en ninguna pantalla real; el placeholder de referencia
  (`apps/admin/components/ReintegrosLive.tsx`) se eliminó por no usarse.
- **Secretos**: la `SUPABASE_SERVICE_ROLE_KEY` solo en código de servidor.

## Comandos
- `pnpm install` — instalar todo.
- `pnpm dev:landing | dev:admin | dev:webapp | dev:mobile` — levantar una app.
- `pnpm --filter @kumo/mobile run web` — la app Expo en el navegador (puerto 8081).
- `pnpm typecheck` / `pnpm lint` — chequeos.
- `supabase db reset` — recrear la base local con schema + seed.

## Idioma
- Producto y UI en español rioplatense (Argentina). Moneda ARS.
