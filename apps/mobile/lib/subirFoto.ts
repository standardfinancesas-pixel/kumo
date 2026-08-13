import * as ImagePicker from 'expo-image-picker';
import { motivoFotoInvalida, rutaFoto } from '@kumo/shared';
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

  const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
  const tipo = asset.mimeType ?? MIME[ext] ?? 'image/jpeg';
  const bytes = bytesDeBase64(asset.base64);

  const invalida = motivoFotoInvalida(tipo, bytes.length);
  if (invalida) return { error: invalida };

  const path = rutaFoto(ownerId, ext, prefijo);
  const { error: subida } = await supabase.storage.from('pet-photos').upload(path, bytes, { contentType: tipo });
  if (subida) return { error: 'No pudimos subir la foto. Probá de nuevo.' };

  return { url: supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl };
}
