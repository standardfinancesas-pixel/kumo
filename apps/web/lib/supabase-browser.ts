import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente de Supabase para el navegador (anon key + RLS). Persiste la sesión
 * en cookies (no localStorage) para que la webapp y el admin, en otro
 * puerto de localhost, puedan leer la misma sesión tras el login.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
