import { NextResponse } from 'next/server';
import { SITIO } from '@kumo/shared';
import { getServiceClient } from '@/lib/supabase-service';
import { sendRecuperarClave } from '@/lib/mail';

/**
 * "¿Olvidaste tu contraseña?" — manda el link para elegir una nueva.
 *
 * Hasta acá ese link del modal de login era `href="#"`: no hacía nada. Un socio
 * que se olvidaba la contraseña no tenía forma de entrar, y tenía que escribir por
 * WhatsApp para que alguien se la cambiara a mano desde Supabase. Con una cuota
 * mensual de por medio, eso es alguien que paga y no puede usar lo que paga.
 *
 * El link lo genera Supabase (`generateLink`), porque es lo único que produce un
 * token válido, pero el mail lo mandamos nosotros con la plantilla de Kumo: el de
 * Supabase llega en inglés, sin marca y desde un remitente `supabase.co`, que es
 * indistinguible de un phishing.
 *
 * SIEMPRE contesta lo mismo, exista o no la cuenta. Si dijera "no encontramos ese
 * mail", cualquiera podría averiguar quién es socio del club probando direcciones.
 */
export async function POST(req: Request) {
  const { email, origen } = (await req.json().catch(() => ({}))) as { email?: string; origen?: string };
  const dir = email?.trim().toLowerCase();

  // La respuesta única. Se arma una vez para que no haya forma de que una rama
  // devuelva algo distinto por descuido.
  const listo = NextResponse.json({ ok: true });
  if (!dir || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dir)) return listo;

  try {
    const svc = getServiceClient();
    /* Los dos destinos posibles, elegidos por un enum y NO por una URL que mande
       el cliente: si el cliente pudiera elegirla, este endpoint serviría para
       mandar a alguien recién autenticado a un sitio ajeno con un link que parece
       de Kumo. */
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? SITIO;
    const destino = origen === 'app' ? '/auth/abrir-app' : '/auth/nueva-clave';
    const { data, error } = await svc.auth.admin.generateLink({
      type: 'recovery',
      email: dir,
      options: {
        /*
         * A dónde vuelve el socio con el link del mail. Son dos destinos NUESTROS,
         * elegidos por un enum y no por una URL que mande el cliente: si el cliente
         * pudiera elegir la URL, este endpoint serviría para mandar a alguien recién
         * autenticado a un sitio ajeno con un link que parece de Kumo.
         *
         * Ojo con la variante web: va DIRECTO a la página, no al callback. Supabase
         * devuelve la sesión en el fragmento de la URL (`#access_token=…`), que nunca
         * llega al servidor: el callback pedía un `?code=` que no existe y terminaba
         * rebotando a la portada, o sea que recuperar la clave no llegaba a ninguna
         * parte. La página del navegador sí lee el fragmento, sola.
         */
        redirectTo: `${base}${destino}`,
      },
    });

    // Mail que no existe, o cuenta que entró con Google y no tiene contraseña:
    // no hay nada que mandar, y tampoco se lo cuenta.
    if (error || !data?.properties?.hashed_token) {
      console.warn('[auth/recuperar] sin link para', dir, error?.message ?? 'sin hashed_token');
      return listo;
    }

    /*
     * El mail NO lleva el link de Supabase, y esto es lo que arregla el bug del
     * 24/09/2026: ese link es la URL que valida el token, así que se consume con
     * sólo ABRIRLO. Cualquiera que lo abra primero —el escáner de seguridad de un
     * correo corporativo, la previsualización de un cliente de mail— se lleva el
     * único uso, y el socio recibe "el link ya no sirve" sin haber hecho nada.
     * Pasó con Workspace y no es un caso raro: le puede pasar a cualquiera con
     * mail de empresa.
     *
     * Ahora el mail lleva a una página NUESTRA con el token en la URL, y el token
     * se canjea recién cuando la persona escribe la contraseña nueva y aprieta
     * guardar. Un visitazo de un robot no gasta nada, porque no hay nada que
     * gastar hasta que alguien completa el formulario.
     *
     * El destino de la app es el mismo de siempre: `abrir-app` reenvía la query
     * al esquema `kumo://` y ahí el canje lo hace la app, que un escáner no puede
     * abrir.
     */
    const link = `${base}${destino}?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;

    const nombre = (data.user?.user_metadata?.full_name as string | undefined)?.split(' ')[0];
    await sendRecuperarClave({
      to: dir,
      firstName: nombre || 'Hola',
      link,
    });
  } catch (e) {
    // Tampoco se le informa: el que pide el link no tiene por qué enterarse de
    // nuestros problemas, y el aviso de "revisá tu casilla" ya está en pantalla.
    console.error('[auth/recuperar]', e);
  }

  return listo;
}
