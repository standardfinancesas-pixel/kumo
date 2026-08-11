/**
 * Rutas de las tres secciones del sitio.
 *
 * Las tres viven en la misma app (`apps/web`), así que son rutas relativas: el
 * socio entra por `/app` y el admin por `/admin`. Al ser un solo origen, la
 * sesión de Supabase se comparte sin configurar nada — que es justamente el
 * problema que había cuando cada una corría en su propio puerto.
 */
export const urls = {
  landing: '/',
  admin: '/admin',
  webapp: '/app',
} as const;
