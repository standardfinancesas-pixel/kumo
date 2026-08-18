import { NextResponse } from 'next/server';
import { urls } from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';

/**
 * Vuelta del login con Google.
 *
 * Google sirve para entrar Y para arrancar el alta. Lo que no puede es
 * reemplazarla: solo aporta nombre y mail, mientras el alta necesita plan,
 * mascota, declaración jurada de salud y medio de pago. Así que una cuenta de
 * Google sin perfil de socio no se rechaza —como hacía antes, cerrándole la
 * sesión— sino que se manda al formulario con la identidad ya resuelta y sin
 * paso de contraseña.
 *
 * La sesión queda abierta a propósito. Un usuario autenticado sin perfil no
 * puede hacer nada más que crear el suyo: la RLS de `profiles` solo deja
 * insertar la fila cuyo id es su propio `auth.uid()`, no puede leer perfiles
 * ajenos, y `/app` lo devuelve a la portada mientras no tenga uno.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  // El usuario canceló en la pantalla de Google, o Google devolvió un error.
  if (oauthError || !code) {
    return NextResponse.redirect(new URL(oauthError ? '/?login=cancelado' : '/', url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL('/?login=error', url.origin));
  }

  /*
   * `next` es para el link de recuperar contraseña: el mail vuelve acá, se canjea
   * el código por sesión y de ahí sigue a elegir la clave nueva.
   *
   * Solo se aceptan rutas internas que empiecen con una barra: si se redirigiera a
   * cualquier cosa que venga en la query, este endpoint serviría para mandar a un
   * socio recién autenticado a un sitio ajeno con un link que parece de Kumo.
   */
  const next = url.searchParams.get('next');
  if (next && /^\/[A-Za-z0-9/_-]*$/.test(next)) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  // Tiene Google pero todavía no es socio: al alta, con la sesión puesta.
  if (!perfil) {
    return NextResponse.redirect(new URL('/?alta=google', url.origin));
  }

  const destino = perfil.role === 'admin' ? urls.admin : urls.webapp;
  return NextResponse.redirect(new URL(destino, url.origin));
}
