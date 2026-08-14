import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Registro del dispositivo para recibir notificaciones push.
 *
 * El token de Expo (`ExponentPushToken[...]`) es la dirección del aparato y, a la
 * vez, la credencial: quien lo tiene puede mandarle una notificación. Se guarda en
 * `push_tokens` con el id del socio, y esa tabla tiene RLS por dueño — cada uno ve
 * y borra los suyos, el club los lee para poder enviar.
 *
 * Ojo con las tres condiciones que hacen que esto NO funcione, y no son errores:
 *   1. En un emulador o en la web no hay push. Se sale sin ruido.
 *   2. Si el socio niega el permiso, no se insiste: se vuelve a pedir recién
 *      cuando lo habilite desde los ajustes del teléfono.
 *   3. En el APK instalado, Android entrega solo si el proyecto de EAS tiene
 *      credenciales de FCM subidas. Sin eso, el token se genera igual y el envío
 *      falla del lado de Expo (ver el ROADMAP).
 */

/** Con la app abierta, la notificación se muestra igual: si no, el socio no ve
 *  nada y parece que no llegó. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type ResultadoRegistro = { ok: true; token: string } | { ok: false; motivo: string };

export async function registrarDispositivo(memberId: string): Promise<ResultadoRegistro> {
  if (!Device.isDevice) return { ok: false, motivo: 'Los push solo funcionan en un teléfono real.' };

  // Android necesita un canal declarado o las notificaciones no suenan ni vibran.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos de Kumo',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#5D5491',
    });
  }

  const permiso = await Notifications.getPermissionsAsync();
  let concedido = permiso.granted;
  if (!concedido && permiso.canAskAgain) {
    concedido = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!concedido) return { ok: false, motivo: 'El socio no dio permiso para notificaciones.' };

  // El projectId sale de app.json (`extra.eas.projectId`): sin él, en un build de
  // producción `getExpoPushTokenAsync` no sabe a qué proyecto pedirle el token.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return { ok: false, motivo: 'Falta el projectId de EAS en app.json.' };

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    // `upsert` por el token, que es la clave primaria: reinstalar la app da un
    // token nuevo, y volver a abrirla con el mismo solo actualiza `last_seen`.
    const { error } = await supabase.from('push_tokens').upsert(
      { token, member_id: memberId, platform: Platform.OS === 'ios' ? 'ios' : 'android', last_seen: new Date().toISOString() },
      { onConflict: 'token' },
    );
    if (error) return { ok: false, motivo: error.message };
    return { ok: true, token };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'no pudimos obtener el token' };
  }
}

/** Al cerrar sesión: el aparato deja de ser de esa persona. */
export async function olvidarDispositivo(): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId || !Device.isDevice) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    /* si no se puede, el token queda y se limpia solo cuando Expo lo reporte muerto */
  }
}
