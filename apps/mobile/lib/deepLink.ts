import { supabase } from './supabase';

/**
 * Lo que llega cuando algo abre la app por su esquema (`kumo://`).
 *
 * Hoy son dos cosas: la vuelta del login con Google y el link del mail para elegir
 * una contraseña nueva. Las dos traen una sesión adentro de la URL, y las dos hay
 * que resolverlas a mano: el cliente de Supabase de la app tiene
 * `detectSessionInUrl: false` porque en un teléfono no hay una "URL de la página"
 * de la que leerla sola.
 *
 * Se aceptan las TRES formas en que Supabase puede mandar la sesión, y no una:
 * el fragmento (`#access_token=…`), un código (`?code=`) o un token de un solo uso
 * (`?token_hash=`). Cuál manda depende de cómo se generó el link y de la versión
 * del servicio, así que reconocer solo una era pedir que se rompa cuando cambie.
 */

export type LinkEntrante =
  | { tipo: 'recuperar' | 'google' }
  | { tipo: 'pago'; preapprovalId: string | null }
  | { tipo: 'error'; motivo: string }
  | null;

/** Los pares de un fragmento o de una query, sin importar cuál venga. */
function parametros(url: string): URLSearchParams {
  const cortado = url.split('#');
  const fragmento = cortado[1] ?? '';
  const query = (cortado[0] ?? '').split('?')[1] ?? '';
  return new URLSearchParams(fragmento || query);
}

/** `kumo://nueva-clave?...` → `nueva-clave`. */
function ruta(url: string): string {
  return (url.split('://')[1] ?? '').split(/[?#]/)[0] ?? '';
}

export async function resolverURL(url: string): Promise<LinkEntrante> {
  if (!url.startsWith('kumo://')) return null;

  const p = parametros(url);
  const camino = ruta(url);

  /*
   * La vuelta de Mercado Pago (`kumo://pago?preapproval_id=…`, la arma
   * /suscripcion/listo). Trae el id de la suscripción recién autorizada, y hace
   * falta DE VERDAD: con el cobro por plan, el perfil no conoce la suscripción
   * hasta el webhook, así que sin este id la app no tiene qué preguntarle a
   * Mercado Pago y se queda mostrando el plan inactivo. El id no da acceso —el
   * servidor verifica que la suscripción sea de quien pregunta— así que traerlo
   * en una URL no es un riesgo, igual que en la web.
   */
  if (camino.startsWith('pago')) {
    return { tipo: 'pago', preapprovalId: p.get('preapproval_id') };
  }
  // `nueva-clave` viene del mail; cualquier otra cosa con sesión es Google.
  const tipo = camino.startsWith('nueva-clave') ? 'recuperar' : 'google';

  // El socio canceló en la pantalla de Google, o el link ya venció.
  const error = p.get('error_description') || p.get('error');
  if (error) {
    return { tipo: 'error', motivo: /expired|invalid/i.test(error)
      ? 'El link ya no sirve: vencen en una hora y se usan una sola vez. Pedí uno nuevo.'
      : 'No pudimos completar el ingreso. Probá de nuevo.' };
  }

  const access = p.get('access_token');
  const refresh = p.get('refresh_token');
  if (access && refresh) {
    const { error: e } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    return e ? { tipo: 'error', motivo: 'No pudimos abrir tu sesión. Probá de nuevo.' } : { tipo };
  }

  const code = p.get('code');
  if (code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(code);
    return e ? { tipo: 'error', motivo: 'No pudimos abrir tu sesión. Probá de nuevo.' } : { tipo };
  }

  const tokenHash = p.get('token_hash') || p.get('token');
  if (tokenHash) {
    const { error: e } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    return e
      ? { tipo: 'error', motivo: 'El link ya no sirve: vencen en una hora y se usan una sola vez. Pedí uno nuevo.' }
      : { tipo: 'recuperar' };
  }

  // Abrió la app por el esquema pero sin nada adentro (un `kumo://` pelado, como
  // era la vuelta de Mercado Pago antes de que trajera el id). No es un error.
  return null;
}
