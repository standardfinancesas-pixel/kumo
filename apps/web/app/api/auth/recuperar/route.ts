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
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
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
        // La vuelta pasa por el callback, que canjea el código por sesión y de ahí
        // manda a elegir la contraseña nueva.
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? SITIO}/auth/callback?next=/auth/nueva-clave`,
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
