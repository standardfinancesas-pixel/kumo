import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para la app nativa. A diferencia de las apps web (que
 * comparten la sesión por cookies), acá la sesión se guarda en AsyncStorage.
 */
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

/*
 * El token se renueva cada vez que la app vuelve al frente.
 *
 * `autoRefreshToken: true` sola no alcanza en una app nativa: el temporizador que
 * renueva el token no corre mientras la app está en segundo plano, así que si el
 * socio la deja abierta y vuelve a la hora, el token guardado ya venció. Todo lo
 * que hable con Supabase falla, y lo que pega a nuestro servidor recibe un
 * "Sin sesión" — que es exactamente lo que pasó al tocar "Suscribirme con
 * Mercado Pago" desde el muro de la cuota.
 *
 * Está en el módulo del cliente y no en una pantalla a propósito: es del cliente,
 * y si viviera en un componente se apagaría cuando ese componente se desmonte.
 */
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
// La app arranca en primer plano: el primer 'change' llega recién cuando se va al
// fondo, así que sin esta línea el refresco no empezaría nunca.
supabase.auth.startAutoRefresh();
