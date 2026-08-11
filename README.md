# Kumo 🐾

Monorepo del club de beneficios para mascotas **Kumo**: el sitio web, la app
móvil y una capa compartida de diseño, datos y backend.

```
kumo/
├── apps/
│   ├── web/       → Sitio (Next.js) · http://localhost:3000
│   │               /        la web pública
│   │               /app     la cuenta del socio
│   │               /admin   el panel del club
│   └── mobile/    → App del socio Android/iOS (Expo)
├── packages/
│   └── shared/    → Tokens de diseño, tipos y cliente Supabase
├── supabase/      → schema.sql, migrations/ y seed.sql (Postgres + RLS + Realtime)
└── reference/     → Prototipo HTML original, intacto (referencia visual 1:1)
```

Las tres secciones viven en una sola app a propósito: al compartir origen, la
sesión de Supabase se comparte sin configurar dominios de cookies.

## Stack

| Capa | Tecnología |
|------|-----------|
| Web | Next.js 15 · React 19 · TypeScript · Tailwind CSS |
| Móvil | Expo 51 · React Native · React 18 · TypeScript |
| Backend | Supabase (Postgres, Auth, Storage, **Realtime**, RLS) |
| Mapas | Google Maps |
| Deploy web | Vercel |
| Monorepo | pnpm workspaces + Turborepo |

## Puesta en marcha

```bash
# 1. Requisitos: Node 20+, pnpm 10+
pnpm install

# 2. Variables de entorno
cp .env.example apps/web/.env.local     # y apps/mobile/.env
#   completar Supabase / Google Maps

# 3. Backend local (opcional, requiere el CLI de Supabase + Docker)
supabase start
supabase db reset        # aplica schema + seed

# 4. Levantar
pnpm dev:web             # el sitio completo en el 3000
pnpm dev:mobile          # Expo
```

## Realtime

Supabase Realtime está habilitado sobre `reimbursements`, `providers`,
`benefits`, `community_posts`, `community_answers` y `push_notifications`.
El patrón está en `packages/shared/src/supabase.ts` (`subscribeTable`), todavía
sin adoptar en pantallas.

## Estado actual

- ✅ Monorepo, tooling y capa compartida.
- ✅ Las cuatro superficies del prototipo reproducidas 1:1.
- ✅ Supabase real: alta, login con redirect por rol, y datos y escrituras
     reales en el sitio y en la app.
- ✅ Comprobantes de reintegro en un bucket privado (el socio ve el suyo, el
     admin todos, vía URL firmada).
- 🚧 Deploy en Vercel: proyecto creado, falta autorizar la integración con
     GitHub en la organización.
- ⏳ Ver `ROADMAP.md` para lo que sigue.

Ver `ARCHITECTURE.md` para el detalle técnico y `ROADMAP.md` para los próximos pasos.
