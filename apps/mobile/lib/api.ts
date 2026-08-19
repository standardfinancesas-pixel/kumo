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
export async function postAlta(payload: BodyAlta, foto?: FotoElegida | null): Promise<RespuestaAlta> {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  if (foto) {
    form.append('photo', { uri: foto.uri, name: foto.name, type: foto.type } as unknown as Blob);
  }

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
