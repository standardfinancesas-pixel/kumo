import { createClient as createServerClient } from './supabase-server';
import { createClient as createAnonClient } from './supabase-public';

/**
 * Quién hace el pedido a un route handler, sirva desde la webapp o desde la app
 * móvil.
 *
 * La webapp manda la sesión en cookies (`@supabase/ssr`), pero la app móvil no
 * tiene cookies: guarda la sesión en el storage de Expo y puede mandar el token
 * en `Authorization: Bearer`. Sin esto, los mails que dispara el socio saldrían
 * solo cuando la acción se hace desde la web, y el mismo botón mandaría o no
 * mandaría el aviso según el aparato — que es peor que no tenerlo.
 *
 * El token lo valida Supabase (`getUser` chequea la firma contra el proyecto),
 * así que un token inventado o vencido devuelve null. Nunca se confía en un id
 * que venga en el body.
 */
export async function quienPide(req: Request): Promise<{ id: string } | null> {
  const cabecera = req.headers.get('authorization');
  if (cabecera?.toLowerCase().startsWith('bearer ')) {
    const { data } = await createAnonClient().auth.getUser(cabecera.slice(7).trim());
    return data.user ? { id: data.user.id } : null;
  }
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id } : null;
}
