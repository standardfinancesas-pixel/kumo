import { FOTO_CALIDAD, FOTO_LADO_MAX, FOTO_MAX, FOTO_TIPOS, motivoFotoInvalida } from '@kumo/shared';

/**
 * Dejar una foto lista para subir: achicarla y decir si aun así no sirve.
 *
 * El problema que resuelve: una foto sacada con el teléfono pesa 3–8 MB y tiene
 * 4000 px de lado, y termina mostrándose en un carnet a 84 px. Antes se subía tal
 * cual, así que el alta tardaba un minuto y —peor— podía pasarse del techo de
 * Vercel y morir en el ÚLTIMO paso, después de haber llenado todo el formulario.
 *
 * Ahora se achica al adjuntarla y el problema desaparece antes de existir. Y si
 * después de achicarla sigue sin entrar, se dice ahí mismo, con la foto todavía
 * en la mano: es el momento en que la persona puede elegir otra sin perder nada.
 *
 * Nunca tira un error por no poder comprimir: si el navegador no puede (formato
 * raro, canvas bloqueado), devuelve la original y decide el control de tamaño. Un
 * fallo del compresor no puede ser un fallo del uploader.
 */
export async function prepararFoto(f: File): Promise<{ file: File } | { error: string }> {
  /* El formato se mira ANTES de comprimir: un PDF o un HEIC no se pueden dibujar
     en un canvas, y el mensaje que corresponde es el del formato, no "pesa". */
  if (!FOTO_TIPOS.includes(f.type as (typeof FOTO_TIPOS)[number])) {
    return { error: motivoFotoInvalida(f.type, 0) ?? 'Ese formato no lo podemos usar.' };
  }

  const lista = await achicar(f);
  const invalida = motivoFotoInvalida(lista.type, lista.size);
  return invalida ? { error: invalida } : { file: lista };
}

/** Cuándo NO vale la pena tocar la foto: ya es chica y entra holgada. Recomprimir
 *  una imagen que ya está bien solo la degrada. */
const yaEstaBien = (f: File, ancho: number, alto: number) =>
  f.size <= FOTO_MAX / 3 && Math.max(ancho, alto) <= FOTO_LADO_MAX;

async function achicar(f: File): Promise<File> {
  /* Los GIF se dejan como están: pasarlos por el canvas los convierte en una foto
     fija y se pierde la animación, que es todo el punto de un GIF. */
  if (f.type === 'image/gif') return f;

  try {
    const bitmap = await createImageBitmap(f);
    const { width, height } = bitmap;
    if (yaEstaBien(f, width, height)) { bitmap.close(); return f; }

    const escala = Math.min(1, FOTO_LADO_MAX / Math.max(width, height));
    const w = Math.max(1, Math.round(width * escala));
    const h = Math.max(1, Math.round(height * escala));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return f; }
    /* Fondo blanco antes de dibujar: el JPEG no tiene transparencia, y sin esto
       un PNG recortado (una mascota sin fondo) sale con el fondo NEGRO. */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', FOTO_CALIDAD));
    /* Si por lo que sea la versión comprimida salió más pesada, se queda la
       original: el objetivo es que pese menos, no cambiarle el formato porque sí. */
    if (!blob || blob.size >= f.size) return f;

    const nombre = f.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${nombre}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    /* Navegador sin createImageBitmap, imagen corrupta, canvas bloqueado por una
       extensión: se sigue con la original y el control de tamaño decide. */
    return f;
  }
}
