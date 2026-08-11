import { NextResponse } from 'next/server';
import { urls } from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';

/**
 * Vuelta del login con Google.
 *
 * Google solo sirve para ENTRAR, no para asociarse: el alta pide plan, mascota,
 * DNI y medio de pago, y eso no se puede saltear con un click. Así que si la
 * cuenta no tiene perfil de socio se cierra la sesión y se explica en la
 * portada, en lugar de dejarla en un limbo con sesión pero sin club.
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

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!perfil) {
    // Tiene cuenta de Google pero no es socio: se deshace la sesión para no
    // dejarlo a medio camino.
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/?login=no-socio', url.origin));
  }

  const destino = perfil.role === 'admin' ? urls.admin : urls.webapp;
  return NextResponse.redirect(new URL(destino, url.origin));
}
