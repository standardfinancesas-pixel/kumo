import { SITIO, type BodyAlta } from '@kumo/shared';
import { supabase } from './supabase';
import type { FotoElegida } from './subirFoto';

/**
 * Lo que la app le pide al backend de Kumo.
 *
 * La app habla con Supabase directo para leer y escribir (la RLS la cubre), y con
 * estas rutas solo para lo que necesita un secreto de servidor: crear el usuario
 * del alta (service-role) y mandar mails (la API key de Resend).
 *
 * `EXPO_PUBLIC_SITE_URL` está para poder apuntar a un Next local mientras se
 * desarrolla. Ojo si se prueba en un teléfono: `localhost` es el teléfono, no la
 * computadora, así que ahí va la IP de la red.
 */
export const apiKumo = process.env.EXPO_PUBLIC_SITE_URL || SITIO;

export type RespuestaAlta =
  | { ok: true; memberNo: number; avisoFoto: string | null }
  | { ok: false; error: string };

/**
 * El alta de socio. Va contra la MISMA ruta que usa la web (`/api/onboarding`),
 * que es la que crea el usuario, el perfil, la mascota y la declaración jurada, y
 * revierte todo si algo falla en el camino. Acá no se duplica nada de eso.
 *
 * Dos cosas del envío que importan:
 *
 *  · Es multiparte, con el JSON en `payload` y la foto aparte, igual que la web.
 *    React Native serializa `{uri, name, type}` como archivo; el servidor saca de
 *    ahí la extensión y el tipo, y si vienen vacíos descarta la foto y el alta se
 *    completa sin ella (por eso `elegirFoto` los deriva y los valida).
 *
 *  · El `Content-Type` NO se pone a mano: lo tiene que armar React Native con su
 *    boundary. Declararlo rompe el multiparte de una forma difícil de ver, porque
 *    el pedido "sale bien" y el servidor recibe basura.
 *
 * El token va solo cuando existe: el alta con contraseña no tiene sesión todavía
 * (la crea este mismo pedido), y el alta con Google sí — y ahí el servidor saca la
 * identidad de la sesión, nunca del cuerpo.
 */
export async function postAlta(payload: BodyAlta, fotos: (FotoElegida | undefined)[] = []): Promise<RespuestaAlta> {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  // Una parte por mascota, en el mismo orden que el payload: repetir la clave
  // la clave `photo` sería ambigua cuando solo la segunda mascota tiene foto.
  fotos.forEach((f, i) => {
    if (f) form.append(`photo_${i}`, { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
  });

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  try {
    const res = await fetch(`${apiKumo}/api/onboarding`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as { memberNo?: number; photoError?: string | null; error?: string };
    if (!res.ok) return { ok: false, error: json.error || 'No se pudo completar el alta.' };
    return { ok: true, memberNo: json.memberNo ?? 0, avisoFoto: json.photoError ?? null };
  } catch {
    return { ok: false, error: 'No pudimos conectar. Revisá tu conexión y probá de nuevo.' };
  }
}

/**
 * Pide el mail con el link para elegir una contraseña nueva.
 *
 * `origen: 'app'` hace que el link del mail vuelva a la app en vez de a la web. La
 * respuesta es siempre la misma, haya cuenta o no: si dijera "ese mail no existe",
 * cualquiera podría averiguar quién es socio del club probando direcciones.
 */
export async function pedirLinkDeClave(email: string): Promise<void> {
  try {
    await fetch(`${apiKumo}/api/auth/recuperar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, origen: 'app' }),
    });
  } catch {
    /* Sin señal a propósito: la pantalla ya dice "mirá tu casilla", y contar que
       falló la red no ayuda a nadie a recuperar la clave. */
  }
}

export type RespuestaCobro =
  | { ok: true; initPoint: string }
  | { yaAutorizada: true }
  | { error: string };

/**
 * Abre el cobro de la cuota y devuelve a dónde hay que mandar al socio.
 *
 * Vivía dentro del muro. Se mudó acá porque ahora lo piden dos pantallas: la hoja
 * del plan y la pantalla final del alta.
 *
 * El reintento con el token renovado NO es de más: pasó de verdad — con la app un
 * rato en segundo plano el token guardado ya había vencido, el servidor contestaba
 * "Sin sesión" y el socio quedaba sin poder pagar sin entender por qué.
 */
export async function crearSuscripcion(opts: { plan: string; odonto: boolean; desde?: 'alta' }): Promise<RespuestaCobro> {
  const pedir = async (token: string) => {
    const res = await fetch(`${apiKumo}/api/pagos/crear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    return { res, data: (await res.json().catch(() => ({}))) as { initPoint?: string; yaAutorizada?: boolean; error?: string } };
  };

  try {
    const { data: ses } = await supabase.auth.getSession();
    let token = ses.session?.access_token;
    if (!token) return { error: 'Se cerró tu sesión. Volvé a entrar y probá de nuevo.' };

    let intento = await pedir(token);
    if (intento.res.status === 401) {
      const { data: nueva } = await supabase.auth.refreshSession();
      token = nueva.session?.access_token;
      if (!token) return { error: 'Se cerró tu sesión. Volvé a entrar y probá de nuevo.' };
      intento = await pedir(token);
    }

    if (intento.data.yaAutorizada) return { yaAutorizada: true };
    if (!intento.res.ok || !intento.data.initPoint) return { error: intento.data.error ?? 'No pudimos abrir la suscripción.' };
    return { ok: true, initPoint: intento.data.initPoint };
  } catch {
    return { error: 'No pudimos abrir la suscripción. Revisá la conexión.' };
  }
}

/**
 * Preguntarle a Mercado Pago cómo salió el cobro, sin esperar su aviso.
 *
 * Misma ruta que usa la web (`/api/pagos/confirmar`): es el servidor el que habla
 * con Mercado Pago, porque el token de la cuenta no puede vivir en la app —
 * cualquiera puede abrir el bundle de un APK.
 *
 * No devuelve error a la pantalla: si no se pudo confirmar, la espera sigue su
 * curso y el webhook termina el trabajo. Que la consulta falle no es un pago
 * fallido, y decírselo al socio sería asustarlo por nada.
 */
export async function confirmarSuscripcion(): Promise<{ hasta: string | null; acreditado: boolean } | null> {
  try {
    const { data: ses } = await supabase.auth.getSession();
    const token = ses.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${apiKumo}/api/pagos/confirmar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return (await res.json()) as { hasta: string | null; acreditado: boolean };
  } catch {
    return null;
  }
}
