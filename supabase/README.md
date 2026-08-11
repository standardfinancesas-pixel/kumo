# Supabase · Kumo

- `schema.sql` — esquema canónico legible (tablas, RLS, Realtime).
- `migrations/` — mismo esquema como migración inicial que aplica el CLI.
- `seed.sql` — datos de catálogo del prototipo.
- `config.toml` — configuración del entorno local del CLI.

## Uso

```bash
# 1. instalar el CLI de Supabase (una vez)
npm i -g supabase

# 2. arrancar el entorno local (Postgres + Studio + Realtime)
supabase start

# 3. aplicar esquema + seed desde cero
supabase db reset
```

Realtime queda habilitado en: `reimbursements`, `providers`, `benefits`,
`community_posts`, `community_answers`, `push_notifications`.
