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

/**
 * Formatos y tamaño que acepta el bucket `pet-photos` de Supabase.
 *
 * Están acá para que el navegador valide lo mismo que el servidor: si no
 * coinciden, el alta responde "listo" y la foto se pierde en silencio (pasó con
 * un archivo que llegó como application/octet-stream).
 *
 * Si se cambian, hay que actualizar también allowed_mime_types del bucket.
 */
export const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const FOTO_MAX = 5 * 1024 * 1024;
