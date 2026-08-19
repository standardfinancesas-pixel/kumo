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
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? SITIO}${
          origen === 'app' ? '/auth/abrir-app' : '/auth/nueva-clave'
        }`,
      },
    });

    // Mail que no existe, o cuenta que entró con Google y no tiene contraseña:
    // no hay nada que mandar, y tampoco se lo cuenta.
    if (error || !data?.properties?.action_link) {
      console.warn('[auth/recuperar] sin link para', dir, error?.message ?? 'sin action_link');
      return listo;
    }

    const nombre = (data.user?.user_metadata?.full_name as string | undefined)?.split(' ')[0];
    await sendRecuperarClave({
      to: dir,
      firstName: nombre || 'Hola',
      link: data.properties.action_link,
    });
  } catch (e) {
    // Tampoco se le informa: el que pide el link no tiene por qué enterarse de
    // nuestros problemas, y el aviso de "revisá tu casilla" ya está en pantalla.
    console.error('[auth/recuperar]', e);
  }

  return listo;
}
