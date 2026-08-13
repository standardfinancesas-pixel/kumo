/**
 * Genera los íconos y el splash nativos desde el logo vectorial.
 *
 *   node scripts/generar-iconos.mjs
 *
 * Los PNG están commiteados porque EAS los necesita en el build, pero se generan
 * desde acá y no a mano: si cambia el logo, se corre el script y salen los cinco
 * archivos con las medidas y las zonas seguras que pide cada plataforma. Un ícono
 * dibujado a ojo en un editor no se puede volver a hacer igual.
 *
 * La marca sale del sistema de diseño (V1 2026): el avatar, el icono de la app y
 * el favicon son la "K" lima sobre el cuadrado violeta; el splash lleva el
 * wordmark "Kumo" en blanco. La gota que estaba antes (y que sigue en el header
 * de la web, de `apps/web/app/icon.svg`) no figura en ninguna variante del kit.
 *
 * sharp no es dependencia del proyecto (la trae Next para optimizar imágenes),
 * así que se resuelve desde el store de pnpm. Si falla, instalarlo suelto:
 *   pnpm dlx sharp-cli --version   (o agregar sharp como devDependency)
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';

const aca = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aca, '../../..');
const assets = resolve(aca, '../assets');
const require = createRequire(import.meta.url);

/** sharp vive en el store de pnpm sin estar linkeado a ningún workspace. */
function cargarSharp() {
  try {
    return require('sharp');
  } catch {
    const store = join(raiz, 'node_modules/.pnpm');
    const dir = readdirSync(store).find((d) => /^sharp@/.test(d));
    if (!dir) throw new Error('No encontré sharp. Instalalo: pnpm add -D sharp --filter @kumo/mobile');
    return require(join(store, dir, 'node_modules/sharp'));
  }
}

/** El TTF de Baloo 2 ExtraBold que ya usa la app, para que el wordmark sea el mismo. */
function buscarFuente() {
  const store = join(raiz, 'node_modules/.pnpm');
  const dir = readdirSync(store).find((d) => /^@expo-google-fonts\+baloo-2@/.test(d));
  if (!dir) throw new Error('No encontré @expo-google-fonts/baloo-2 en node_modules.');
  const ttf = join(store, dir, 'node_modules/@expo-google-fonts/baloo-2/800ExtraBold/Baloo2_800ExtraBold.ttf');
  if (!existsSync(ttf)) throw new Error('No encontré el TTF de Baloo 2 ExtraBold.');
  return ttf;
}

const VIOLETA = '#5D5491';
const LIMA = '#E1FB62';

/** La gota, en un viewBox de 100×100, con el color y la escala que se le pidan. */
const gota = (color) => `
  <path d="M50 26 A24 24 0 0 1 74 50 A24 24 0 0 1 50 74 L31 74 A5 5 0 0 1 26 69 L26 50 A24 24 0 0 1 50 26 Z"
        fill="${color}" transform="rotate(45 50 50)"/>`;

const svgGota = (lado, color) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 100 100">${gota(color)}</svg>`);

/**
 * La gota recortada a su caja real y escalada al lado pedido.
 *
 * El `rotate(45)` del path deja la forma descentrada dentro del viewBox de
 * 100×100 —la esquina en punta rompe la simetría—, así que compuesta tal cual
 * salía corrida y chica. Se rasteriza grande, se recorta lo transparente y se
 * escala: así el centro óptico coincide con el del ícono.
 */
const gotaCentrada = async (lado, color) => {
  const tight = await sharp(svgGota(1024, color)).png().trim().toBuffer();
  return sharp(tight)
    .resize({ width: lado, height: lado, fit: 'contain', background: '#00000000' })
    .png()
    .toBuffer();
};

/**
 * La "K" del avatar, recortada a su caja real y escalada al lado pedido.
 *
 * El sistema de diseño (V1 2026) define que el avatar, el ícono de la app y el
 * favicon son la "K" en el cuadrado violeta — no la gota, que no aparece en
 * ninguna de las variantes de marca del kit. La gota se sigue usando en el
 * header de la web, que viene del prototipo.
 *
 * Se recorta con `trim` por lo mismo que la gota: la caja de una letra trae
 * mucho aire arriba y abajo (ascendentes y descendentes), y sin recortar queda
 * chica y desalineada respecto del centro óptico del ícono.
 */
const letraCentrada = async (lado, color) => {
  const grande = await sharp({
    text: { text: `<span foreground="${color}">K</span>`, font: 'Baloo 2 ExtraBold 200', fontfile, dpi: 300, rgba: true },
  })
    .png()
    .toBuffer();
  const tight = await sharp(grande).trim().toBuffer();
  return sharp(tight)
    .resize({ width: lado, height: lado, fit: 'contain', background: '#00000000' })
    .png()
    .toBuffer();
};

const sharp = cargarSharp();
const fontfile = buscarFuente();
mkdirSync(assets, { recursive: true });

const fondo = (lado, color) =>
  sharp({ create: { width: lado, height: lado, channels: 4, background: color } });

/**
 * "Kumo" en Baloo 2 ExtraBold, con la tipografía real y no una parecida.
 *
 * El tamaño va en la descripción de la fuente (Pango) y no en `height`: pasarlo
 * aparte lo ignora y el texto sale de 7 píxeles. Se renderiza grande una vez y
 * se escala al ancho pedido, que da un resultado predecible.
 */
const wordmark = async (ancho, color) => {
  const grande = await sharp({
    text: { text: `<span foreground="${color}">Kumo</span>`, font: 'Baloo 2 ExtraBold 100', fontfile, dpi: 300, rgba: true },
  })
    .png()
    .toBuffer();
  return sharp(grande).resize({ width: ancho }).png().toBuffer();
};

const salidas = [];

// 1. icon.png — el que usa iOS y del que Expo deriva varios tamaños. A sangre:
//    el sistema le aplica la máscara redondeada, así que las esquinas no van acá.
{
  const L = 1024;
  const g = await letraCentrada(Math.round(L * 0.5), LIMA);
  await fondo(L, VIOLETA)
    .composite([{ input: g, gravity: 'centre' }])
    .png()
    .toFile(join(assets, 'icon.png'));
  salidas.push(['icon.png', `${L}×${L}`, 'violeta a sangre + la K']);
}

// 2. adaptive-icon.png — Android recorta con máscaras distintas (círculo, squircle,
//    trébol) y solo garantiza el 66% central. La K va chica y centrada; el
//    violeta lo pone `backgroundColor` en app.json, no la imagen.
{
  const L = 1024;
  const g = await letraCentrada(Math.round(L * 0.42), LIMA);
  await sharp({ create: { width: L, height: L, channels: 4, background: '#00000000' } })
    .composite([{ input: g, gravity: 'centre' }])
    .png()
    .toFile(join(assets, 'adaptive-icon.png'));
  salidas.push(['adaptive-icon.png', `${L}×${L}`, 'la K al 42% (zona segura del 66%)']);
}

// 3. splash.png — el wordmark solo, en blanco sobre el violeta que pone
//    app.json. Va la palabra y no la "K" porque el splash ocupa la pantalla: la
//    versión avatar existe para donde la marca se ve del tamaño de una uña. Y no
//    lleva la gota: no aparece en ninguna variante del sistema de diseño.
{
  const L = 1024;
  const texto = await wordmark(Math.round(L * 0.56), '#FFFFFF');
  const { width: tw, height: th } = await sharp(texto).metadata();
  await sharp({ create: { width: L, height: L, channels: 4, background: '#00000000' } })
    .composite([{ input: texto, gravity: 'centre' }])
    .png()
    .toFile(join(assets, 'splash.png'));
  salidas.push(['splash.png', `${L}×${L}`, `"Kumo" en Baloo 2 (${tw}×${th})`]);
}

// 4. favicon.png — para la versión web de Expo.
{
  const L = 196;
  const g = await letraCentrada(Math.round(L * 0.56), LIMA);
  await fondo(L, VIOLETA).composite([{ input: g, gravity: 'centre' }]).png().toFile(join(assets, 'favicon.png'));
  salidas.push(['favicon.png', `${L}×${L}`, 'violeta + la K']);
}

// 5. notification-icon.png — Android lo pinta de un solo color, así que va la
//    silueta en blanco sobre transparente. Con color se ve un cuadrado gris.
{
  const L = 96;
  const g = await letraCentrada(Math.round(L * 0.72), '#FFFFFF');
  await sharp({ create: { width: L, height: L, channels: 4, background: '#00000000' } })
    .composite([{ input: g, gravity: 'centre' }])
    .png()
    .toFile(join(assets, 'notification-icon.png'));
  salidas.push(['notification-icon.png', `${L}×${L}`, 'silueta blanca (Android la tiñe)']);
}

// 6. El favicon del navegador, que vive en la web pero es la MISMA marca que el
//    ícono de la app. Sale de acá y no de un SVG aparte justamente para que no se
//    separen: antes eran dos dibujos distintos mantenidos a mano y terminaron
//    siendo la gota en el navegador y la K en el celular.
//
//    Va como PNG y no como SVG porque un favicon no puede cargar la tipografía:
//    la "K" hay que rasterizarla con Baloo 2 acá. Next lo toma solo por estar en
//    `app/icon.png`.
{
  const L = 512;
  const g = await letraCentrada(Math.round(L * 0.5), LIMA);
  const destino = resolve(raiz, 'apps/web/app/icon.png');
  await fondo(L, VIOLETA).composite([{ input: g, gravity: 'centre' }]).png().toFile(destino);
  salidas.push(['../../web/app/icon.png', `${L}×${L}`, 'favicon del navegador, la misma K']);
}

for (const [archivo, medida, que] of salidas) {
  console.log(`  ${archivo.padEnd(28)} ${medida.padEnd(11)} ${que}`);
}
