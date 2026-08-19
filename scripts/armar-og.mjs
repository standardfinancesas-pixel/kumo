/**
 * Dibuja la imagen que se ve cuando alguien comparte kumo.pet.
 *
 * Sale un archivo, no una ruta: `apps/web/app/opengraph-image.jpg`. Next lo
 * engancha solo por el nombre y agrega las etiquetas `og:image` y
 * `twitter:image`, igual que si fuera generado en vivo.
 *
 * Por qué hecha de antemano y no en cada visita (que es lo que hace la variante
 * `opengraph-image.tsx` con `ImageResponse`):
 *  · Peso. `ImageResponse` solo sabe escribir PNG, y con la foto del perro
 *    adentro son 476 KB. En JPG son 73. WhatsApp —que es por donde se va a
 *    compartir esto— no muestra la vista previa si la imagen es muy grande, así
 *    que el PNG se arriesga a que el link vuelva a viajar pelado.
 *  · Nada que fallar en producción. La versión en vivo necesita que la fuente y
 *    la foto viajen al servidor, y el rastreo de archivos de Next no las detecta
 *    porque se leen a mano: hay que declararlas en `outputFileTracingIncludes` y
 *    confiar. Un archivo estático se sirve desde el CDN y listo.
 *
 * El precio es acordarse de correr esto cuando cambie el texto o la marca:
 *
 *   node scripts/armar-og.mjs
 *
 * Los dos ingredientes salen del repo, así que el resultado es reproducible: la
 * foto es la misma del hero y la tipografía es la que ya usa el sitio. Ojo con
 * el formato de la fuente: `ImageResponse` acepta ttf, otf y woff, NO woff2.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/*
 * Todo se pide prestado a `apps/web`: en la raíz del monorepo no hay ni React ni
 * Next instalados, y sharp vive en el almacén de pnpm porque nadie lo declara
 * (viene con Next). Mismo camino que usa `cortar-croqueta.mjs`.
 */
const require = createRequire(import.meta.url);
const React = require(path.resolve('apps/web/node_modules/react'));
const sharp = require(path.resolve('node_modules/.pnpm/sharp@0.34.5/node_modules/sharp'));
// En Windows un import() con ruta absoluta necesita file://, si no protesta por el 'c:'.
const { ImageResponse } = await import(pathToFileURL(path.resolve('apps/web/node_modules/next/og.js')).href);

const MEDIDAS = { width: 1200, height: 630 };
const PANEL_PERRO = { width: 560, height: 630 };
const MORADO = '#4A4177';
const LIMA = '#E1FB62';
const VERDE = '#C7E04F';
const DESTINO = 'apps/web/app/opengraph-image.jpg';

/*
 * El perro recortado mide 978x1111 y el panel 560x630: la misma proporción. Por
 * eso alcanza con `cover`, que entra entero sin que haya que elegir un recorte.
 * El PNG viene con fondo transparente, así que se apoya sobre el morado de la
 * marca antes de convertirlo.
 */
const perro = await sharp('apps/web/public/img/hero-perro.png')
  .trim({ threshold: 1 })
  .resize({ ...PANEL_PERRO, fit: 'cover' })
  .flatten({ background: MORADO })
  .jpeg({ quality: 92, mozjpeg: true })
  .toBuffer();
const perroSrc = `data:image/jpeg;base64,${perro.toString('base64')}`;

const baloo = require('fs').readFileSync(
  createRequire(path.resolve('apps/web/package.json')).resolve('@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff'),
);

/*
 * Los estilos van a mano porque acá no corre el CSS del sitio. Y todo bloque con
 * más de un hijo lleva `display: flex` explícito: el motor que dibuja esto
 * (satori) no asume nada y falla con "Expected <div> to have explicit
 * display: flex" — de ahí que los dos renglones del título sean dos filas y no
 * un `<br>`.
 */
const h = React.createElement;
const tarjeta = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', background: MORADO, fontFamily: 'Baloo' } },
  // Izquierda: la marca y la promesa, con los mismos textos que la portada, para
  // que quien llega desde el link no sienta que entró a otro lugar.
  h(
    'div',
    { style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 64px' } },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 18, marginBottom: 34 } },
      h(
        'div',
        { style: { width: 68, height: 68, borderRadius: 20, background: LIMA, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        h('span', { style: { fontSize: 52, color: MORADO, lineHeight: 1 } }, 'K'),
      ),
      h('span', { style: { fontSize: 62, color: '#fff', letterSpacing: -1 } }, 'Kumo'),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', marginBottom: 22 } },
      h('span', { style: { fontSize: 46, color: '#fff', lineHeight: 1.15 } }, 'App de mascotas'),
      h(
        'span',
        { style: { display: 'flex', fontSize: 46, lineHeight: 1.15 } },
        h('span', { style: { color: '#fff' } }, 'con '),
        h('span', { style: { color: VERDE } }, 'beneficios'),
      ),
    ),
    h(
      'div',
      { style: { fontSize: 25, color: '#D8D3EC', lineHeight: 1.35, maxWidth: 470 } },
      'Descuentos en veterinarias, carnet digital y reintegros de tus gastos.',
    ),
  ),
  // Derecha: el perro del hero.
  h('img', { src: perroSrc, width: PANEL_PERRO.width, height: PANEL_PERRO.height, style: { objectFit: 'cover' } }),
);

const png = Buffer.from(
  await new ImageResponse(tarjeta, {
    ...MEDIDAS,
    fonts: [{ name: 'Baloo', data: baloo, style: 'normal', weight: 800 }],
  }).arrayBuffer(),
);

const jpg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
await writeFile(DESTINO, jpg);
console.log(`${DESTINO}: ${MEDIDAS.width}x${MEDIDAS.height}, ${Math.round(jpg.length / 1024)} KB`);
