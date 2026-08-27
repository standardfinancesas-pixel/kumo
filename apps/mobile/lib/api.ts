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
  /*
   * Una parte por mascota, en el mismo orden que el payload: repetir la clave
   * `photo` sería ambigua cuando solo la segunda mascota tiene foto.
   *
   * La foto va como STRING (un JSON con el base64), no como objeto de archivo.
   * El `{ uri, name, type }` que el FormData de React Native aceptó siempre tira
   * "Unsupported FormDataPart implementation" desde el runtime del SDK 57
   * (RN 0.86): el cuerpo no se llega a armar, el fetch muere antes de salir del
   * teléfono, y en pantalla se ve como "revisá tu conexión". Así se rompió el
   * alta con foto para todos los Android — reproducido en un emulador, con el
   * motivo en el logcat.
   *
   * Un string viaja bien en cualquier runtime, y el servidor distingue: File es
   * la web, string es la app.
   */
  fotos.forEach((f, i) => {
    if (f?.base64) form.append(`photo_${i}`, JSON.stringify({ base64: f.base64, type: f.type, name: f.name }));
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
    /*
     * El código HTTP va en el mensaje cuando el servidor no manda uno propio.
     *
     * Un 413 (cuerpo demasiado grande) y un 500 son problemas opuestos y hasta
     * acá se veían iguales: "No se pudo completar el alta". El número no le dice
     * nada a un socio, pero convierte el reporte de un tester en algo accionable
     * en vez de una adivinanza.
     */
    if (!res.ok) return { ok: false, error: json.error || `No se pudo completar el alta (error ${res.status}).` };
    return { ok: true, memberNo: json.memberNo ?? 0, avisoFoto: json.photoError ?? null };
  } catch (e) {
    /*
     * El motivo real va en el mensaje, y no es cosmético: este `catch` se comía
     * la única pista que había.
     *
     * Todo lo que puede fallar acá termina en el mismo lugar —el archivo de la
     * foto que ya no se puede leer, el cuerpo rechazado antes de llegar, un DNS
     * que no resuelve, la conexión que se corta— y hasta ahora los cuatro se
     * mostraban como "revisá tu conexión". Un tester quedó trabado en este paso y
     * no había forma de saber cuál de los cuatro era, ni desde acá ni desde los
     * logs del servidor (si el pedido no llega, no hay log).
     *
     * La frase de siempre queda primero porque es la que le sirve a un socio; el
     * motivo técnico va atrás y entre paréntesis, para que entre en una captura.
     */
    const motivo = e instanceof Error ? e.message : String(e);
    console.warn('[alta] el envío falló →', motivo);
    return { ok: false, error: `No pudimos conectar. Revisá tu conexión y probá de nuevo. (${motivo})` };
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
  /** Ya tenia el debito autorizado y solo cambio de plan: el servidor le cambio el
   *  monto en Mercado Pago y no hay nada que ir a autorizar. */
  | { actualizada: true; monto: number }
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
    return { res, data: (await res.json().catch(() => ({}))) as { initPoint?: string; yaAutorizada?: boolean; actualizada?: boolean; monto?: number; error?: string } };
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

    if (intento.data.actualizada) return { actualizada: true, monto: intento.data.monto ?? 0 };
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
/**
 * `preapprovalId` viene del deep link de la vuelta de Mercado Pago, y le sirve al
 * servidor cuando el perfil todavía no tiene ninguna suscripción guardada — que
 * con el cobro por plan es SIEMPRE en la primera vuelta: la suscripción la crea
 * MP y el perfil se entera por el webhook, segundos después. Es el mismo dato que
 * la web ya mandaba (lib/confirmarPago.ts lo saca de su URL).
 */
export async function confirmarSuscripcion(preapprovalId?: string | null): Promise<{ hasta: string | null; acreditado: boolean } | null> {
  try {
    const { data: ses } = await supabase.auth.getSession();
    const token = ses.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${apiKumo}/api/pagos/confirmar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preapprovalId ? { preapprovalId } : {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as { hasta: string | null; acreditado: boolean };
  } catch {
    return null;
  }
}

/**
 * "Me mudé": recalcular las coordenadas del domicilio.
 *
 * Se llama después de guardar los datos, y solo si el domicilio cambió. La ruta no
 * recibe la dirección —la lee de la fila del socio— así que acá no hay nada que
 * mandar. Si falla no se avisa: lo único que queda mal es el centro del mapa, y se
 * arregla la próxima vez que edite sus datos.
 */
export async function recalcularUbicacion(): Promise<void> {
  try {
    const { data: ses } = await supabase.auth.getSession();
    const token = ses.session?.access_token;
    if (!token) return;
    await fetch(`${apiKumo}/api/perfil/ubicacion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // sin ubicación nueva: el mapa sigue centrado donde estaba
  }
}
/**
 * El pin del negocio en el mapa, después de darlo de alta o de mudar el local.
 *
 * La ruta solo recibe el id: la dirección la lee de la fila y chequea que el
 * negocio sea de quien pide. Si falla no se avisa — queda en la lista sin
 * distancia, que es como aparecen los que no cargaron dirección.
 */
export async function ubicarNegocio(id: string): Promise<void> {
  try {
    const { data: ses } = await supabase.auth.getSession();
    const token = ses.session?.access_token;
    if (!token) return;
    await fetch(`${apiKumo}/api/prestadores/ubicacion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  } catch {
    // sin pin: el negocio sigue en la lista, sin distancia
  }
}