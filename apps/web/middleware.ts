import { createServerClient } from '@supabase/ssr';
import { urls } from '@kumo/shared';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refresca la sesión de Supabase en cada request (necesario para que los
 * Server Components siempre vean un token vigente).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: auth } = await supabase.auth.getUser();

  // Quien ya entró no tiene por qué ver la landing con "Iniciar sesión": va a su
  // sección. El redirect vive acá y no en la página para que la landing siga
  // siendo estática y cacheada para las visitas anónimas, que son la mayoría.
  // Mismo criterio de rol que el callback del login.
  if (auth.user && request.nextUrl.pathname === '/') {
    const { data: perfil } = await supabase.from('profiles').select('role, status').eq('id', auth.user.id).single();
    // Sin perfil no es socio (p. ej. entró con Google sin estar dado de alta):
    // se lo deja en la landing, que es donde el aviso tiene sentido.
    if (perfil) {
      /*
       * OJO: al socio sin acceso NO se lo manda a `/app`.
       *
       * `/app` corta al suspendido y al de baja devolviéndolo a la portada, y este
       * redirect lo mandaba de vuelta: rebote infinito, la pantalla en blanco y el
       * servidor contestando 307 sin parar. Se ve solo si uno lo prueba entrando
       * con la cuenta suspendida, que es lo que pasó.
       *
       * El estado del admin no se mira: no es socio, su acceso no depende de eso.
       */
      const sinAcceso = perfil.role === 'socio' && (perfil.status === 'suspendido' || perfil.status === 'baja');
      if (!sinAcceso) {
        const destino = perfil.role === 'admin' ? urls.admin : urls.webapp;
        return NextResponse.redirect(new URL(destino, request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
