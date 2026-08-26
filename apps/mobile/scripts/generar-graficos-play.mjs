/**
 * Genera los gráficos que pide la ficha de Google Play.
 *
 *   node scripts/generar-graficos-play.mjs
 *
 * Salen en `scripts/salida-play/` y NO van commiteados: son para subir a mano al
 * Play Console, no los usa ningún build. Por eso esta carpeta está ignorada.
 *
 * Va por script y no a ojo en un editor por lo mismo que `generar-iconos.mjs`:
 * si cambia la marca, se corre de nuevo y salen iguales. Un gráfico armado a mano
 * no se puede volver a hacer idéntico, y la ficha de la tienda es lo primero que
 * ve alguien que todavía no instaló nada.
 *
 * Lo que produce:
 *   - icono-512.png          512x512, el ícono de la ficha
 *   - grafico-destacado.png  1024x500, el gráfico que Play muestra al destacar
 *
 * Las capturas de pantalla NO se generan acá: tienen que salir de un Android real
 * mostrando la app de verdad. Play rechaza mockups que no correspondan a lo que
 * el usuario va a ver.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readdirSync, mkdirSync } from 'node:fs';

const aca = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aca, '../../..');
const assets = resolve(aca, '../assets');
const salida = resolve(aca, 'salida-play');
const require = createRequire(import.meta.url);

/** Igual que en generar-iconos.mjs: sharp vive en el store de pnpm sin linkear. */
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

const VIOLETA = '#5D5491';

const sharp = cargarSharp();
mkdirSync(salida, { recursive: true });

/**
 * El wordmark sale de `assets/splash.png`, NO se vuelve a renderizar.
 *
 * Se intentó rehacerlo con sharp y el TTF de Baloo 2, como hace
 * generar-iconos.mjs, y no funciona en cualquier máquina: si fontconfig no tiene
 * un archivo de configuración (macOS sin Homebrew, entre otros), sharp ignora el
 * `fontfile` y cae a una fuente del sistema SIN avisar. Se verifica rápido —
 * renderizar con y sin `fontfile` y comparar los bytes: si dan iguales, el TTF no
 * se aplicó— y en esta máquina daban iguales. El gráfico salía con una fuente
 * parecida pero ajena a la marca, que es peor que no tener gráfico.
 *
 * El splash ya es el wordmark "Kumo" en blanco sobre transparente, generado con
 * la tipografía real y commiteado. Usarlo garantiza que la ficha de la tienda y
 * la pantalla de arranque muestren exactamente la misma marca.
 */
const wordmarkReal = async (ancho) => {
  // `trim` saca el aire transparente alrededor: el splash es un lienzo cuadrado
  // de 1024 con el wordmark centrado, y sin recortar el texto queda diminuto.
  const recortado = await sharp(join(assets, 'splash.png')).trim().toBuffer();
  return sharp(recortado).resize({ width: ancho }).png().toBuffer();
};

/* ── El ícono de la ficha ────────────────────────────────────── */
// Sale del mismo icon.png que usa la app, no de una versión aparte: si la ficha
// y el launcher muestran íconos distintos, el que instala duda de haber bajado
// lo que vio.
await sharp(join(assets, 'icon.png'))
  .resize(512, 512)
  .png()
  .toFile(join(salida, 'icono-512.png'));

/* ── El gráfico destacado ────────────────────────────────────── */
/*
 * Play puede recortarlo y superponerle su propia interfaz —el botón de instalar,
 * el nombre—, así que todo lo importante va al centro y lejos de los bordes.
 *
 * Sin capturas de pantalla adentro y sin "descargá ya": las dos cosas están en
 * los lineamientos de Play como motivo de rechazo. Es la marca y una frase.
 */
const ANCHO = 1024;
const ALTO = 500;

/*
 * Va SOLO el wordmark, sin bajada.
 *
 * No es minimalismo por gusto: la bajada necesitaría renderizar texto, y eso es
 * justamente lo que no se puede garantizar acá (ver el comentario de
 * `wordmarkReal`). Entre una frase en una fuente que no es la de la marca y
 * ninguna frase, gana ninguna — y los lineamientos de Play piden poco texto en
 * este gráfico, así que no se pierde nada.
 */
const wordmark = await wordmarkReal(380);
const meta = await sharp(wordmark).metadata();

await sharp({ create: { width: ANCHO, height: ALTO, channels: 4, background: VIOLETA } })
  .composite([
    { input: wordmark, top: Math.round((ALTO - meta.height) / 2), left: Math.round((ANCHO - meta.width) / 2) },
  ])
  .png()
  .toFile(join(salida, 'grafico-destacado.png'));

console.log('Listos en', salida);
for (const f of readdirSync(salida)) {
  const m = await sharp(join(salida, f)).metadata();
  console.log(`  ${f}  ${m.width}x${m.height}`);
}
