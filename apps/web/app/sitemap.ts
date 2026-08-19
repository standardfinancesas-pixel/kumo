import type { MetadataRoute } from 'next';
import { SITIO } from '@kumo/shared';

/**
 * El mapa del sitio para los buscadores. Next lo sirve como /sitemap.xml.
 *
 * Son solo las páginas públicas: la portada y las legales. Las secciones con
 * sesión no van (además están bloqueadas en robots.txt).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITIO, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITIO}/legal`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
