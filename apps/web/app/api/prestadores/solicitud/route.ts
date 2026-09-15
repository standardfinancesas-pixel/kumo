import { NextResponse } from 'next/server';
import { RUBROS, motivoFotoInvalida, type ProviderCategory } from '@kumo/shared';
import { geocodificarComercio } from '@/lib/geocodificar';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * "Sumate como prestador", desde la landing pública.
 *
 * Existe porque ese formulario era una maqueta: pedía rubro, nombre, zona,
 * WhatsApp, descripción, mail y contraseña, decía "Crear cuenta y enviar
 * solicitud", y lo único que hacía era mostrar "¡Solicitud enviada! Te
 * contactamos en 48 hs". No guardaba nada. La gente se anotaba, esperaba dos
 * días y el club nunca se enteraba de que existía — de hecho así se descubrió,
 * porque alguien preguntó por qué no aparecía.
 *
 * Pide LO MISMO que el alta de adentro de la app (`Prestar`, en la webapp del
 * socio): dirección, Instagram, sitio, tarifa, logo y portada. No por simetría:
 * la ficha que entra sin esos datos sale publicada sin precio, sin foto y sin
 * pin, y el prestador de la landing no tiene cuenta para volver a entrar a
 * completarla. O entra bien ahora, o queda a medias para siempre.
 *
 * Va por el servidor y no desde el navegador porque la política de `providers`
 * exige `owner_id = auth.uid()`, y acá no hay sesión: quien completa esto
 * todavía no es socio. Por lo mismo las fotos las sube la service key: la RLS
 * del bucket exige que la primera carpeta sea el id del que sube.
 *
 * La ficha nace `pendiente` y sin dueño, que es un estado que el producto ya
 * maneja: el club la ve en el panel y decide. Sin dueño se comporta como las
 * fichas que cargó el club a mano, que también lo están.
 *
 * Es un endpoint público que escribe y que además recibe archivos, así que
 * valida todo, recorta y tiene freno por IP. Lo peor que puede hacer alguien es
 * llenar el panel de solicitudes basura, que un admin borra. Nada de lo que
 * entra por acá se publica solo: lo publica el club, y desde el 15/09 la ficha
 * del panel muestra las fotos, así que las mira antes de hacerlo.
 */

/* Freno por IP, del mismo tipo que el de /api/lugares: en memoria y por
   instancia, así que es un amortiguador y no una garantía. Alcanza para lo que
   protege — que una sola persona no llene el panel ni el bucket de una sentada—
   y el número es alto para lo que es mandar una solicitud de verdad: quien se
   está anotando lo hace una vez. */
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 5;
const porIp = new Map<string, { desde: number; cuantas: number }>();

const limpiar = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/** Vacío es `null` y no '': la ficha pregunta "¿tiene Instagram?", y un string
 *  vacío contesta que sí y después no muestra nada. */
const oNada = (t: string) => t || null;

/**
 * Sube una imagen de la solicitud y devuelve su URL pública.
 *
 * `solicitudes/` como carpeta porque la convención del bucket es
 * `{id del socio}/archivo` y acá no hay socio. No colisiona: ningún uuid se
 * llama así.
 *
 * Devuelve `{ error }` en vez de tirar, y el que llama corta: una foto que no
 * sube no puede hacerse pasar por una solicitud enviada, que es exactamente el
 * bug que este endpoint vino a arreglar.
 */
async function subirImagen(archivo: File, prefijo: string): Promise<{ url: string } | { error: string }> {
  const invalida = motivoFotoInvalida(archivo.type, archivo.size);
  if (invalida) return { error: invalida };

  const ext = archivo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const ruta = `solicitudes/${prefijo}-${crypto.randomUUID()}.${ext}`;
  const svc = getServiceClient();
  const { error } = await svc.storage.from('pet-photos').upload(ruta, archivo, { contentType: archivo.type });
  if (error) {
    console.error('[prestadores/solicitud] no se pudo subir la imagen', error);
    return { error: 'No pudimos subir la imagen. Probá de nuevo, o mandá la solicitud sin ella.' };
  }
  return { url: svc.storage.from('pet-photos').getPublicUrl(ruta).data.publicUrl };
}

/** El archivo del campo, o null si no mandó ninguno. Un input de archivo vacío
 *  llega como un File de 0 bytes en algunos navegadores, no como ausencia. */
function archivoDe(form: FormData, campo: string): File | null {
  const v = form.get(campo);
  return v instanceof File && v.size > 0 ? v : null;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'sin-ip';
  const ahora = Date.now();
  const marca = porIp.get(ip);
  if (!marca || ahora - marca.desde > VENTANA_MS) {
    porIp.set(ip, { desde: ahora, cuantas: 1 });
  } else if (marca.cuantas >= MAX_POR_VENTANA) {
    return NextResponse.json({ error: 'Mandaste varias solicitudes seguidas. Esperá unos minutos.' }, { status: 429 });
  } else {
    marca.cuantas += 1;
  }

  /* Multipart y no JSON porque vienen las dos imágenes. Los campos de texto
     viajan igual, así que el formulario manda una sola cosa. */
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'No pudimos leer el formulario.' }, { status: 400 });

  const nombre = limpiar(form.get('nombre'), 80);
  const zona = limpiar(form.get('zona'), 80);
  const whatsapp = limpiar(form.get('whatsapp'), 40);
  const about = limpiar(form.get('about'), 600);
  const rubro = limpiar(form.get('rubro'), 40);
  const direccion = limpiar(form.get('direccion'), 120);
  const instagram = limpiar(form.get('instagram'), 60);
  const sitio = limpiar(form.get('sitio'), 120);
  const unidad = limpiar(form.get('unidad'), 20);
  const precio = Number(limpiar(form.get('precio'), 12).replace(/\D/g, '')) || null;

  if (!nombre) return NextResponse.json({ error: 'Poné el nombre de tu servicio o empresa.' }, { status: 400 });
  if (!zona) return NextResponse.json({ error: 'Poné la zona donde trabajás.' }, { status: 400 });
  /* El WhatsApp es obligatorio y no un dato más: es el único canal por el que el
     club puede contestarle, porque acá no se crea cuenta ni se pide mail. */
  if (whatsapp.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'Poné un WhatsApp donde podamos escribirte.' }, { status: 400 });
  /* Contra la lista compartida y no contra una escrita acá: `category` es texto
     libre en la base y decide el ícono y el filtro de Servicios, que compara el
     texto exacto. Una categoría inventada entra igual y después no la encuentra
     nadie. */
  if (!RUBROS.includes(rubro as ProviderCategory)) return NextResponse.json({ error: 'Elegí un rubro.' }, { status: 400 });

  /* Las imágenes ANTES del insert: si una falla, no queda una ficha a medias
     que nadie puede completar después (el prestador de la landing no tiene
     cuenta para volver a entrar). El navegador ya las achicó con `prepararFoto`;
     esto es el control de este lado, que es el que cuenta. */
  let logoUrl: string | null = null;
  let portadaUrl: string | null = null;
  const logo = archivoDe(form, 'logo');
  const portada = archivoDe(form, 'portada');
  if (logo) {
    const subido = await subirImagen(logo, 'logo');
    if ('error' in subido) return NextResponse.json({ error: subido.error }, { status: 400 });
    logoUrl = subido.url;
  }
  if (portada) {
    const subido = await subirImagen(portada, 'portada');
    if ('error' in subido) return NextResponse.json({ error: subido.error }, { status: 400 });
    portadaUrl = subido.url;
  }

  /*
   * El pin, acá mismo y no por /api/prestadores/ubicacion: ese endpoint pide
   * sesión de dueño o admin, y acá no hay ninguna de las dos.
   *
   * Sin dirección no hay pin y está bien que así sea (ver `consultasDeComercio`):
   * geolocalizar por zona apilaría a todos los de Palermo en el mismo punto. El
   * prestador aparece igual en la lista, sin distancia.
   *
   * Si el geocodificador no contesta, la solicitud se guarda lo mismo: un
   * servicio de terceros caído no puede voltear un alta.
   */
  const ubicacion = direccion ? await geocodificarComercio({ address: direccion, zone: zona }) : null;

  const { error } = await getServiceClient().from('providers').insert({
    name: nombre,
    category: rubro,
    zone: zona,
    address: oNada(direccion),
    phone: whatsapp,
    instagram: oNada(instagram),
    website: oNada(sitio),
    price: precio,
    price_unit: oNada(unidad),
    about,
    logo_url: logoUrl,
    photo_url: portadaUrl,
    lat: ubicacion?.lat ?? null,
    lng: ubicacion?.lng ?? null,
    status: 'pendiente',
    owner_id: null,
  });
  if (error) {
    console.error('[prestadores/solicitud] no se pudo guardar', error);
    return NextResponse.json({ error: 'No pudimos enviar tu solicitud. Probá de nuevo en un rato.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
