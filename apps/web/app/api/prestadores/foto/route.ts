import { NextResponse } from 'next/server';
import { motivoFotoInvalida } from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * El club cambia el logo o la portada de una ficha de Servicios.
 *
 * Es la otra mitad de "Editar datos": los textos los arregla el panel contra la
 * base, pero las imágenes no podía tocarlas nadie. Para una ficha sin dueño
 * —todas las que entran por el formulario público— eso significaba que la foto
 * que mandó el prestador el primer día era la única que iba a tener nunca.
 *
 * Va por el servidor y no desde el navegador por la ruta del archivo: la RLS del
 * bucket exige que la primera carpeta sea el id de quien sube, así que un admin
 * subiendo desde el navegador dejaría la portada de un pet shop colgada de su
 * propia carpeta. Con la service key el archivo se guarda en `fichas/` y el
 * nombre lleva el id de la ficha, que es de quien realmente es.
 *
 * Borra la anterior después de guardar la nueva. El orden importa: si se borrara
 * primero y fallara la subida, la ficha quedaría sin foto y sin la vieja.
 */

/** La ruta adentro del bucket, a partir de su URL pública. `null` si la URL no es
 *  de este bucket: no vamos a borrar nada que no hayamos subido. */
function rutaEnElBucket(url: string | null): string | null {
  if (!url) return null;
  const marca = '/storage/v1/object/public/pet-photos/';
  const i = url.indexOf(marca);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length));
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'No pudimos leer el archivo.' }, { status: 400 });

  const id = typeof form.get('id') === 'string' ? (form.get('id') as string) : '';
  const cual = form.get('cual') === 'logo' ? 'logo' : form.get('cual') === 'portada' ? 'portada' : null;
  const archivo = form.get('archivo');
  if (!id || !cual) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  if (!(archivo instanceof File) || archivo.size === 0) return NextResponse.json({ error: 'No llegó ninguna imagen.' }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede cambiar las imágenes.' }, { status: 403 });

  const invalida = motivoFotoInvalida(archivo.type, archivo.size);
  if (invalida) return NextResponse.json({ error: invalida }, { status: 400 });

  const svc = getServiceClient();
  const { data: ficha } = await svc.from('providers').select('logo_url, photo_url').eq('id', id).single();
  if (!ficha) return NextResponse.json({ error: 'Esa ficha ya no está.' }, { status: 404 });

  const ext = archivo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const ruta = `fichas/${id}-${cual}-${Date.now()}.${ext}`;
  const { error: eSubida } = await svc.storage.from('pet-photos').upload(ruta, archivo, { contentType: archivo.type });
  if (eSubida) {
    console.error('[prestadores/foto] no se pudo subir', eSubida);
    return NextResponse.json({ error: 'No pudimos subir la imagen. Probá de nuevo.' }, { status: 500 });
  }
  const url = svc.storage.from('pet-photos').getPublicUrl(ruta).data.publicUrl;

  const columna = cual === 'logo' ? 'logo_url' : 'photo_url';
  const { data: filas, error } = await svc.from('providers').update({ [columna]: url }).eq('id', id).select('id');
  if (error || !filas?.length) {
    console.error('[prestadores/foto] subió pero no se guardó', error);
    return NextResponse.json({ error: 'Subimos la imagen pero no pudimos guardarla.' }, { status: 500 });
  }

  /* La anterior, ahora que la nueva ya está guardada. Si no se puede borrar no
     pasa nada grave —queda un archivo suelto— y no tiene sentido fallar por eso
     cuando el cambio que pidió el club ya está hecho. */
  const vieja = rutaEnElBucket(cual === 'logo' ? ficha.logo_url : ficha.photo_url);
  if (vieja && vieja !== ruta) await svc.storage.from('pet-photos').remove([vieja]);

  return NextResponse.json({ ok: true, url });
}
