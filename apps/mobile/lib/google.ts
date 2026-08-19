import { Linking } from 'react-native';
import { supabase } from './supabase';

/**
 * Entrar (o registrarse) con Google desde la app.
 *
 * Abre la pantalla de Google en el navegador del sistema y vuelve a la app por
 * `kumo://auth`. Eso NO es una limitación: Google rechaza los webviews embebidos
 * para su login, y el navegador del sistema es lo que pide para apps nativas. Es
 * además el mismo salto que la app ya hace para pagar con Mercado Pago.
 *
 * Va con `Linking` de React Native y no con `expo-web-browser`, que sería un módulo
 * nativo nuevo y obligaría a compilar un APK: así esto sale por OTA.
 *
 * `skipBrowserRedirect` es obligatorio: sin eso el cliente de Supabase intenta
 * navegar con `window.location`, que en React Native no existe, y no pasa nada
 * (falla en silencio, que es lo peor).
 */
export async function entrarConGoogle(): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'kumo://auth', skipBrowserRedirect: true },
  });

  if (error) {
    // Mientras Google no esté habilitado en Supabase, el mensaje es este y no un
    // "algo salió mal": es config que falta, no un problema de la persona.
    if (/not enabled|provider/i.test(error.message)) {
      return { error: 'El ingreso con Google todavía no está configurado. Entrá con tu mail y contraseña.' };
    }
    return { error: 'No pudimos abrir Google. Probá de nuevo.' };
  }
  if (!data?.url) return { error: 'No pudimos abrir Google. Probá de nuevo.' };

  const puede = await Linking.canOpenURL(data.url);
  if (!puede) return { error: 'No encontramos un navegador para abrir Google.' };
  await Linking.openURL(data.url);
  return { ok: true };
}
