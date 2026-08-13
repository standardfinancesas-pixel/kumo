/**
 * Rutas de las tres secciones del sitio.
 *
 * Las tres viven en la misma app (`apps/web`), así que son rutas relativas: el
 * socio entra por `/app` y el admin por `/admin`. Al ser un solo origen, la
 * sesión de Supabase se comparte sin configurar nada — que es justamente el
 * problema que había cuando cada una corría en su propio puerto.
 */
export const urls = {
  landing: '/',
  admin: '/admin',
  webapp: '/app',
} as const;

/**
 * Origen del sitio en producción.
 *
 * La app móvil necesita URLs absolutas para hablar con los route handlers (los
 * mails salen de ahí, porque la API key de Resend es de servidor) y no tiene
 * dónde leerlas: los `EXPO_PUBLIC_*` se hornean en el bundle y agregar uno nuevo
 * obliga a tocar las variables de la cuenta de Expo, que no está en el repo. Va
 * como constante porque para la app instalada este valor no cambia nunca: siempre
 * habla con producción. Para probar contra la máquina local, `EXPO_PUBLIC_SITE_URL`
 * lo pisa (ver `apiKumo` en apps/mobile/lib/avisos.ts).
 */
export const SITIO = 'https://www.kumo.pet';

/**
 * Link de WhatsApp a partir del número que el admin carga en `club_settings`.
 *
 * wa.me solo acepta dígitos, y el número se guarda con el formato legible
 * ("+54 9 11 2516-8802") porque es el que se muestra. Está acá para que la
 * landing y los mails armen el mismo link: es el único canal de contacto del
 * club que se puede contestar (el remitente de los mails no recibe).
 */
export const waLink = (numero: string) => `https://wa.me/${numero.replace(/\D/g, '')}`;

/**
 * Formatos y tamaño que acepta el bucket `pet-photos` de Supabase.
 *
 * Están acá para que el navegador valide lo mismo que el servidor: si no
 * coinciden, el alta responde "listo" y la foto se pierde en silencio (pasó con
 * un archivo que llegó como application/octet-stream).
 *
 * Si se cambian, hay que actualizar también allowed_mime_types del bucket.
 */
export const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const FOTO_MAX = 5 * 1024 * 1024;

/**
 * El motivo por el que una foto no se puede usar, o `null` si está bien.
 *
 * El mensaje sale de acá y no de cada pantalla porque el mismo control corre en
 * el alta, en el carnet, al agregar una mascota y en mobile: estaba escrito dos
 * veces y ya había empezado a divergir.
 */
export function motivoFotoInvalida(tipo: string, tamaño: number): string | null {
  if (!FOTO_TIPOS.includes(tipo as (typeof FOTO_TIPOS)[number])) {
    return `Ese formato no lo podemos usar (${tipo || 'desconocido'}). Probá con JPG, PNG o WEBP. Si es una foto de iPhone, mandala desde "Fotos" y se convierte sola.`;
  }
  if (tamaño > FOTO_MAX) {
    return `La foto pesa ${(tamaño / 1024 / 1024).toFixed(1)} MB y el máximo es 5 MB. Probá con una más chica.`;
  }
  return null;
}

/**
 * Ruta dentro del bucket. La primera carpeta TIENE que ser el id del socio: la
 * RLS del bucket se apoya en esa convención para aislar a un socio de otro. Si
 * cambia el formato, se rompe el aislamiento.
 */
export const rutaFoto = (ownerId: string, ext: string, prefijo = ''): string =>
  `${ownerId}/${prefijo}${Date.now()}.${ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'}`;
