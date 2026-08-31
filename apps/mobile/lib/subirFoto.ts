import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { FOTO_CALIDAD, FOTO_LADO_MAX, motivoFotoInvalida, rutaFoto } from '@kumo/shared';
import { supabase } from './supabase';

/**
 * Elegir una foto del celular y subirla al bucket `pet-photos`.
 *
 * En mobile no había ninguna forma de poner la foto de una mascota: el selector
 * de imágenes existía solo para el comprobante del reintegro. Esto lo resuelve
 * para el alta de mascota y para cambiarla después.
 *
 * Sube los bytes decodificados del base64 que devuelve el picker, y NO usa
 * expo-file-system para leer el archivo: sería un módulo nativo nuevo y obligaría
 * a un build entero en vez de salir por OTA. El decodificador de base64 va a mano
 * por lo mismo — `atob` no está garantizado en Hermes y `Buffer` no existe.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesDeBase64(b64: string): Uint8Array {
  const limpio = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const largo = Math.floor((limpio.length * 3) / 4);
  const out = new Uint8Array(largo);
  let acumulado = 0;
  let bits = 0;
  let i = 0;
  for (const c of limpio) {
    acumulado = (acumulado << 6) | B64.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[i++] = (acumulado >> bits) & 0xff;
    }
  }
  return out;
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

export type ResultadoFoto = { url: string } | { error: string } | { cancelado: true };

/**
 * Una foto elegida. Lleva el base64 ADEMÁS de la uri, y no es redundancia:
 *
 * El FormData de React Native aceptaba `{ uri, name, type }` como parte de
 * archivo, y desde el runtime del SDK 57 (RN 0.86, arquitectura nueva) eso tira
 * "Unsupported FormDataPart implementation" al armar el cuerpo — el envío muere
 * ANTES de salir del teléfono y se ve como un error de conexión. Así se rompió
 * el alta con foto para todos los Android, y costó encontrarlo porque no deja
 * log en ningún servidor.
 *
 * Un string sí viaja bien en el FormData, así que la foto va como base64 y el
 * servidor la decodifica. La uri se conserva para mostrar la miniatura.
 */
export type FotoElegida = { uri: string; name: string; type: string; bytes: number; base64?: string };
export type ResultadoElegir = { foto: FotoElegida } | { error: string } | { cancelado: true };

/**
 * Elegir una foto, sin subirla.
 *
 * Es lo que usa el alta: ahí todavía no hay sesión, así que no hay `ownerId` con
 * el que armar la ruta del bucket, y la foto viaja al servidor dentro del mismo
 * pedido del alta (que la sube con la service-role, igual que hace la web).
 *
 * `name` y `type` no son decorativos: el servidor saca de ahí la extensión y el
 * tipo del archivo, y si vienen vacíos descarta la foto y el alta se completa sin
 * ella. Por eso se derivan acá y se validan antes de mandar nada.
 */
/**
 * Achica la foto antes de mandarla a ningún lado.
 *
 * Una foto de teléfono son 4000 px y varios MB, y termina viéndose en un carnet a
 * 84 px: subirla entera es tiempo de la persona tirado y, en el alta, el riesgo de
 * pasarse del techo de Vercel y perder el alta completa en el último paso.
 *
 * Devuelve `null` si no se pudo —y ahí se sigue con la original, que es lo que se
 * hacía siempre—: no poder comprimir no puede impedir subir una foto.
 *
 * OJO: esto es un módulo NATIVO. A diferencia del resto de la app, no viaja por
 * OTA: hasta que no salga un build nuevo, los teléfonos que ya tienen la app
 * instalada siguen subiendo la foto tal cual la tomó el picker.
 */
async function achicar(uri: string, ancho: number, alto: number): Promise<{ base64: string; bytes: Uint8Array } | null> {
  try {
    const contexto = ImageManipulator.manipulate(uri);
    /* Se redimensiona por el lado MAYOR y se deja el otro en automático: fijar los
       dos deforma las fotos verticales, que son la mayoría de las de un teléfono. */
    if (Math.max(ancho, alto) > FOTO_LADO_MAX) {
      contexto.resize(ancho >= alto ? { width: FOTO_LADO_MAX } : { height: FOTO_LADO_MAX });
    }
    const render = await contexto.renderAsync();
    const salida = await render.saveAsync({ compress: FOTO_CALIDAD, format: SaveFormat.JPEG, base64: true });
    if (!salida.base64) return null;
    return { base64: salida.base64, bytes: bytesDeBase64(salida.base64) };
  } catch {
    return null;
  }
}

export async function elegirFoto(): Promise<ResultadoElegir> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    return { error: 'Necesitamos permiso para ver tus fotos. Podés dárselo desde los ajustes del teléfono.' };
  }
  const elegida = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.6,
    // El base64 es lo que de verdad viaja al servidor (ver FotoElegida): el
    // objeto {uri} en FormData está roto en el runtime nuevo.
    base64: true,
  });
  if (elegida.canceled) return { cancelado: true };

  const asset = elegida.assets?.[0];
  if (!asset?.uri) return { error: 'No pudimos leer la foto. Probá con otra.' };

  // El ?? de atrás no es de más: con `noUncheckedIndexedAccess` el split devuelve
  // `string | undefined`, y de `ext` depende el tipo que se le declara al servidor.
  const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().split('?')[0] ?? 'jpg';

  /* Achicada queda en JPEG, así que el tipo y la extensión pasan a ser los del
     resultado y no los del archivo original. Si no se pudo, sigue la original. */
  const chica = await achicar(asset.uri, asset.width ?? 0, asset.height ?? 0);
  const type = chica ? 'image/jpeg' : (asset.mimeType ?? MIME[ext] ?? 'image/jpeg');
  const nombre = chica ? 'mascota.jpg' : `mascota.${MIME[ext] ? ext : 'jpg'}`;
  const bytes = chica ? chica.bytes.length : (asset.fileSize ?? 0);

  // El peso puede venir sin dato (`fileSize` es opcional según la plataforma):
  // en ese caso no se rechaza acá y decide el servidor, que siempre lo mide.
  const invalida = motivoFotoInvalida(type, bytes || 1);
  if (invalida) return { error: invalida };

  return { foto: { uri: asset.uri, name: nombre, type, bytes, base64: chica?.base64 ?? asset.base64 ?? undefined } };
}

export async function elegirYSubirFoto(ownerId: string, prefijo = ''): Promise<ResultadoFoto> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    return { error: 'Necesitamos permiso para ver tus fotos. Podés dárselo desde los ajustes del teléfono.' };
  }

  const elegida = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    // base64 para no depender de expo-file-system, y calidad baja porque la foto
    // viaja entera en memoria: una de 12 MP sin comprimir no entra.
    base64: true,
    quality: 0.6,
  });
  if (elegida.canceled) return { cancelado: true };

  const asset = elegida.assets?.[0];
  if (!asset?.base64) return { error: 'No pudimos leer la foto. Probá con otra.' };

  const original = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
  const chica = await achicar(asset.uri, asset.width ?? 0, asset.height ?? 0);
  const ext = chica ? 'jpg' : original;
  const tipo = chica ? 'image/jpeg' : (asset.mimeType ?? MIME[original] ?? 'image/jpeg');
  const bytes = chica ? chica.bytes : bytesDeBase64(asset.base64);

  const invalida = motivoFotoInvalida(tipo, bytes.length);
  if (invalida) return { error: invalida };

  const path = rutaFoto(ownerId, ext, prefijo);
  const { error: subida } = await supabase.storage.from('pet-photos').upload(path, bytes, { contentType: tipo });
  if (subida) return { error: 'No pudimos subir la foto. Probá de nuevo.' };

  return { url: supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl };
}
