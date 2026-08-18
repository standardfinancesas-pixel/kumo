import { createClient } from './supabase-server';
import { getServiceClient } from './supabase-service';

/**
 * Quién está haciendo el pedido, venga de la web o de la app.
 *
 * La webapp manda la sesión en cookies (las escribe `@supabase/ssr`). La app del
 * celular no tiene cookies: guarda el token de Supabase en el teléfono y lo manda
 * en `Authorization: Bearer ...`. Sin esto, las rutas de la cuota sólo funcionaban
 * desde el navegador y en mobile el muro no tenía botón que apretar.
 *
 * El token NO se cree por venir en el header: se valida contra Supabase, que es
 * quien lo firmó. Un JWT que uno se inventa no pasa este chequeo.
 */
export type Pedido = { id: string; desdeLaApp: boolean };

/** `desdeLaApp` distingue quién llama, y no es un detalle: define a dónde vuelve
 *  el socio después de pagar. El navegador puede volver a la webapp; el celular
 *  tiene que volver a la app, y la web no puede adivinarlo. */
export async function quienPide(req: Request): Promise<Pedido | null> {
  const auth = req.headers.get('authorization');
  const token = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;

  if (token) {
    const { data, error } = await getServiceClient().auth.getUser(token);
    if (error || !data.user) {
      /*
       * Se loguea el motivo porque sin esto "Sin sesión" es indistinguible de
       * tres cosas muy distintas: que no vino el header, que el token venció, o
       * que el token es de otro proyecto. Pasó con la app: el socio veía "Sin
       * sesión" al querer pagar y desde afuera no había forma de saber cuál de
       * las tres era.
       *
       * Va el motivo y el largo del token, NUNCA el token: es una credencial
       * viva, y los logs los lee más gente que la que puede usarla.
       */
      console.error('[quienPide] token rechazado ·', error?.message ?? 'sin usuario', '· largo', token.length);
      return null;
    }
    return { id: data.user.id, desdeLaApp: true };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) console.error('[quienPide] sin token en el header y sin sesión en cookies');
  return data.user ? { id: data.user.id, desdeLaApp: false } : null;
}
