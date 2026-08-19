import type { MetadataRoute } from 'next';
import { SITIO } from '@kumo/shared';

/**
 * Qué puede recorrer un buscador. Next sirve esto como /robots.txt.
 *
 * La cuenta del socio y el panel del club quedan afuera: son pantallas con
 * sesión, no tienen nada que mostrar en un resultado de búsqueda y un "Ingresá
 * a tu cuenta" indexado solo confunde. Lo público —la portada y las páginas
 * legales— es lo que sí queremos que Google lea.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/admin', '/api/'] }],
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
