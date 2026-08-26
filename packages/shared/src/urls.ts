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
 * La cuenta de Instagram del club, que es la única red que existe hoy.
 *
 * Va acá y no escrita en la landing porque el footer del sitio y el de la página
 * de prestadores la muestran los dos, y un handle escrito dos veces se cambia una
 * sola: el día que la cuenta cambie de nombre, uno de los dos iconos queda
 * llevando a una cuenta que no existe.
 */
export const INSTAGRAM = 'https://www.instagram.com/kumo_app/';

/**
 * Quién administra Kumo, para el pie de página.
 *
 * El CUIT va aparte del resto de la frase porque en el pie se renderiza sin corte:
 * la línea está alineada a la derecha y el navegador parte donde encuentra un guion,
 * así que el número quedaba cortado en dos renglones ("33-" en uno y "71928936-9" en
 * el otro), que para un dato fiscal se lee como un error de tipeo.
 */
export const EMPRESA = {
  legal: 'Kumo y Kumo App son marcas registradas y están administradas por Standard Finance S.A.S.,',
  cuit: 'CUIT 33-71928936-9',
} as const;

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
 * Cuánto pueden pesar TODAS las fotos del alta juntas.
 *
 * Es un límite distinto del de arriba, y hace falta porque el alta es el único
 * lugar que manda VARIAS fotos en UN solo pedido: una por mascota, en un
 * multipart a `/api/onboarding`. El resto de la app sube de a una y directo al
 * bucket de Supabase, donde `FOTO_MAX` (5 MB por foto) es correcto.
 *
 * El techo real lo pone Vercel: rechaza cualquier pedido con cuerpo mayor a
 * 4,5 MB (FUNCTION_PAYLOAD_TOO_LARGE) y lo hace ANTES de ejecutar la función.
 * Eso significa que no queda log del lado del servidor y que del lado del
 * teléfono se ve como un error de conexión — así apareció: un tester no podía
 * completar el alta y el mensaje decía "revisá tu conexión", con la conexión
 * perfecta.
 *
 * Con 5 MB por foto permitidos, UNA SOLA mascota ya podía pasarse. Se valida la
 * suma antes de mandar, con margen para el JSON del payload y el overhead del
 * multipart.
 *
 * Si algún día el alta sube las fotos directo al bucket (como hace el resto de
 * la app) este límite deja de tener sentido y se puede borrar.
 */
/** 3 MB y no 4: desde la app las fotos viajan en base64 (ver postAlta), que
 *  infla un 33%. 3 MB de fotos son ~4 MB de cuerpo, y el techo de Vercel es 4,5. */
export const ALTA_FOTOS_MAX = 3 * 1024 * 1024;

/**
 * El motivo por el que las fotos del alta no se pueden mandar juntas, o `null`.
 *
 * Devuelve un mensaje que dice qué hacer: sacar alguna foto y cargarla después
 * desde el carnet, que es donde igual se pueden cambiar. Sin esto el pedido sale
 * igual y muere sin explicación.
 */
export function motivoFotosDelAltaPesan(total: number, cuantas: number): string | null {
  if (total <= ALTA_FOTOS_MAX) return null;
  const mb = (total / 1024 / 1024).toFixed(1);
  const max = ALTA_FOTOS_MAX / 1024 / 1024;
  return cuantas === 1
    ? `La foto pesa ${mb} MB y para el alta el máximo es ${max} MB. Elegí una más liviana, o seguí sin foto y cargala después desde el carnet.`
    : `Las ${cuantas} fotos pesan ${mb} MB juntas y para el alta el máximo es ${max} MB. Sacá alguna y cargala después desde el carnet, o elegí fotos más livianas.`;
}

/**
 * Ruta dentro del bucket. La primera carpeta TIENE que ser el id del socio: la
 * RLS del bucket se apoya en esa convención para aislar a un socio de otro. Si
 * cambia el formato, se rompe el aislamiento.
 */
export const rutaFoto = (ownerId: string, ext: string, prefijo = ''): string =>
  `${ownerId}/${prefijo}${Date.now()}.${ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'}`;
