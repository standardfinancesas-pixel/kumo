import { SITIO } from '@kumo/shared';
import { supabase } from './supabase';

/**
 * Los mails que dispara la app: el pedido de reintegro, el alta del negocio y la
 * baja de la membresía.
 *
 * Van contra `/api/avisos` de la webapp porque la API key de Resend es de
 * servidor y no puede vivir en el bundle de la app. La escritura la sigue
 * haciendo Supabase directo desde la pantalla (la RLS ya la cubre): esto solo
 * avisa, y por eso nunca hace fallar la operación.
 *
 * Va la sesión en `Authorization: Bearer` porque la app no tiene cookies. El
 * servidor valida el token contra Supabase y decide qué contar leyendo la base:
 * lo único que viaja desde acá es un id.
 */
const apiKumo = process.env.EXPO_PUBLIC_SITE_URL || SITIO;

export async function avisar(tipo: string, id?: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${apiKumo}/api/avisos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tipo, id }),
    });
  } catch {
    /* sin señal: el socio no tiene por qué enterarse por esto */
  }
}
