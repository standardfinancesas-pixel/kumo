/**
 * URLs de las tres superficies web.
 *
 * En dev cada app corre en su puerto de localhost; en producción son dominios
 * distintos. Se resuelven por variable de entorno con el puerto local como
 * fallback, así el flujo landing → webapp → admin no queda atado a localhost.
 *
 * Tienen que ser `NEXT_PUBLIC_*` porque se usan en componentes de cliente
 * (redirects después del login, "Cerrar sesión", etc.).
 */
export const urls = {
  landing: process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000',
  admin: process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001',
  webapp: process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3002',
} as const;
