# Kumo 🐾

Monorepo del club de beneficios para mascotas **Kumo**. Reúne las cuatro
superficies del producto y una capa compartida de diseño, datos y backend.

```
kumo/
├── apps/
│   ├── landing/   → Sitio público (Next.js)        · http://localhost:3000
│   ├── admin/     → Panel del club (Next.js)        · http://localhost:3001
│   ├── webapp/    → App del socio en la compu (Next.js) · http://localhost:3002
│   └── mobile/    → App del socio Android/iOS (Expo)
├── packages/
│   └── shared/    → Tokens de diseño, tipos y cliente Supabase
├── supabase/      → schema.sql, migrations/ y seed.sql (Postgres + RLS + Realtime)
└── reference/     → Prototipo HTML original, intacto (referencia visual 1:1)
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Web (landing, admin, webapp) | Next.js 15 · React 18 · TypeScript · Tailwind CSS |
| Móvil (app) | Expo · React Native · TypeScript |
| Backend | Supabase (Postgres, Auth, Storage, **Realtime**, RLS) |
| Mails | Resend |
| Mapas | Google Maps |
| Deploy web | Vercel |
| Monorepo | pnpm workspaces + Turborepo |

## Puesta en marcha

```bash
# 1. Requisitos: Node 20+, pnpm 9+
corepack enable && corepack prepare pnpm@9.12.0 --activate

# 2. Instalar dependencias de todo el monorepo
pnpm install

# 3. Variables de entorno
cp .env.example apps/landing/.env.local   # repetir en admin, webapp y mobile
#   completar Supabase / Resend / Google Maps

# 4. Backend local (opcional, requiere el CLI de Supabase + Docker)
npm i -g supabase
supabase start
supabase db reset        # aplica schema + seed

# 5. Levantar las apps
pnpm dev                 # todas a la vez (Turborepo)
pnpm dev:landing         # o una sola
pnpm dev:admin
pnpm dev:webapp
pnpm dev:mobile          # Expo
```

## Realtime (todo se actualiza en vivo)

Supabase Realtime está habilitado sobre `reimbursements`, `providers`,
`benefits`, `community_posts`, `community_answers` y `push_notifications`.
El patrón está en `packages/shared/src/supabase.ts` (`subscribeTable`) y hay
un ejemplo funcionando en `apps/admin/components/ReintegrosLive.tsx`.

## Estado actual

- ✅ Estructura del monorepo, tooling y capa compartida.
- ✅ Assets del prototipo extraídos (imágenes + tipografía Baloo 2).
- ✅ Schema de Supabase con RLS + Realtime y seed de catálogo.
- ✅ **Landing** portada a Next.js con la copy y las imágenes reales.
- 🚧 Admin / webapp / mobile: scaffold con una pantalla representativa cada uno.
- ⏳ El resto de las pantallas se portan desde `reference/` (ver ROADMAP.md).

Ver `ARCHITECTURE.md` para el detalle técnico y `ROADMAP.md` para los próximos pasos.
