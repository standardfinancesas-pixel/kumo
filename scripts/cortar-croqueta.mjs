/**
 * Separa la croqueta del perro del hero en dos PNG.
 *
 * La foto original (`asset-837cff30.png`) trae la croqueta volando pegada al
 * hocico, dentro de la misma imagen: sin cortarla no hay nada que animar. No se
 * puede separar por "islas" de píxeles porque la croqueta toca el hocico, y
 * tampoco por color, porque el hocico tiene marrones y rosas que caen en el
 * mismo rango. Así que va por rectángulo, elegido mirando la zona ampliada: el
 * borde derecho de la croqueta está en x≈168 y el pelo del hocico arranca en
 * x≈177, así que cortar en 173 no se lleva nada del perro.
 *
 * Los dos PNG salen del MISMO tamaño de lienzo que el original (1123x1147), con
 * todo transparente menos su parte. Eso es lo que hace que las dos capas se
 * alineen solas: el CSS las dibuja con el mismo `contain` y la misma posición,
 * así que la croqueta cae exactamente donde estaba, en cualquier ancho de
 * pantalla, sin números mágicos en el CSS.
 *
 * Correr con: node scripts/cortar-croqueta.mjs
 */
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require(path.resolve('node_modules/.pnpm/sharp@0.34.5/node_modules/sharp'));

const ORIGEN = 'apps/web/public/img/asset-837cff30.png';
const DESTINO_PERRO = 'apps/web/public/img/hero-perro.png';
const DESTINO_CROQUETA = 'apps/web/public/img/hero-croqueta.png';

/** La caja de la croqueta, con el halo blanco de la foto adentro. */
const CAJA = { x: 40, y: 208, w: 133, h: 98 };

const { data, info } = await sharp(ORIGEN).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

const perro = Buffer.from(data);
const croqueta = Buffer.alloc(W * H * 4, 0);

for (let y = CAJA.y; y < CAJA.y + CAJA.h; y++) {
  for (let x = CAJA.x; x < CAJA.x + CAJA.w; x++) {
    const i = (y * W + x) * 4;
    // La croqueta se lleva el píxel tal cual...
    croqueta[i] = data[i];
    croqueta[i + 1] = data[i + 1];
    croqueta[i + 2] = data[i + 2];
    croqueta[i + 3] = data[i + 3];
    // ...y en el perro queda transparente, si no se ve dos veces.
    perro[i] = 0; perro[i + 1] = 0; perro[i + 2] = 0; perro[i + 3] = 0;
  }
}

const png = (buf, salida) =>
  sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(salida);

await png(perro, DESTINO_PERRO);
await png(croqueta, DESTINO_CROQUETA);

const centro = { x: CAJA.x + CAJA.w / 2, y: CAJA.y + CAJA.h / 2 };
console.log(`perro     → ${DESTINO_PERRO}`);
console.log(`croqueta  → ${DESTINO_CROQUETA}`);
console.log(`El centro de la croqueta cae en ${((centro.x / W) * 100).toFixed(1)}% / ${((centro.y / H) * 100).toFixed(1)}% del lienzo`);
console.log('(sirve como transform-origin, para que gire sobre sí misma y no orbite)');
