import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * El club borra un negocio, de verdad y para siempre.
 *
 * Faltaba: el panel sólo sabía verificar y rechazar, y las dos dejan la fila.
 * Alcanza mientras lo que llega son solicitudes legítimas —un rechazado es
 * información: ya lo miramos y dijimos que no—, pero no alcanza para lo que
 * siempre termina apareciendo: una prueba, un duplicado, una ficha cargada mal,
 * spam del formulario público. Eso no se rechaza, se saca, y hasta hoy había que
 * entrar a la base para hacerlo.
 *
 * Rechazar sigue siendo lo normal. Esto es para lo que no debería haber existido.
 *
 * Pasa por el servidor y no por Supabase directo —la RLS ya deja borrar a un
 * admin— por las FOTOS: borrar la fila no borra los archivos, storage no es SQL.
 * Sin esto cada negocio borrado dejaría su logo y su portada colgados en el
 * bucket para siempre, y las de las solicitudes de la landing las subió
 * cualquiera desde una página pública.
 *
 * Lo que se va con la fila, por cascada de la base: las reseñas y los favoritos.
 * Por eso el panel lo dice ANTES, con el número, en el cartel de confirmación: el
 * que borra tiene que saber que también se lleva ocho reseñas.
 */

/** La ruta del archivo adentro del bucket, a partir de su URL pública. `null` si
 *  la URL no es de este bucket: no vamos a borrar nada que no hayamos subido. */
function rutaEnElBucket(url: string | null): string | null {
  if (!url) return null;
  const marca = '/storage/v1/object/public/pet-photos/';
  const i = url.indexOf(marca);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length));
}

export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Falta el negocio.' }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { data: yo } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'Solo un admin puede borrar negocios.' }, { status: 403 });

  const svc = getServiceClient();
  const { data: negocio } = await svc.from('providers').select('name, logo_url, photo_url').eq('id', id).single();
  if (!negocio) return NextResponse.json({ error: 'Ese negocio ya no está.' }, { status: 404 });

  /* La fila primero. Si fallara, las fotos siguen donde estaban y el negocio
     también: nada a medias. */
  const { data: borradas, error } = await svc.from('providers').delete().eq('id', id).select('id');
  if (error || !borradas?.length) {
    console.error('[prestadores/borrar] no se pudo borrar', error);
    return NextResponse.json({ error: 'No pudimos borrar el negocio.' }, { status: 500 });
  }

  /* Y después los archivos. Si esto falla no se deshace el borrado —el negocio ya
     no está, que es lo que se pidió—, pero se avisa: un archivo huérfano no
     rompe nada y alguien tiene que saber que quedó. */
  const rutas = [rutaEnElBucket(negocio.logo_url), rutaEnElBucket(negocio.photo_url)].filter((r): r is string => !!r);
  let fotosHuerfanas = 0;
  if (rutas.length) {
    const { error: eFotos } = await svc.storage.from('pet-photos').remove(rutas);
    if (eFotos) {
      console.error('[prestadores/borrar] la fila se borró pero las fotos quedaron', rutas, eFotos);
      fotosHuerfanas = rutas.length;
    }
  }

  return NextResponse.json({ ok: true, nombre: negocio.name, fotosHuerfanas });
}
