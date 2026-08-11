import { createBrowserClient } from '@supabase/ssr';

/** Cliente de Supabase para el navegador (anon key + RLS), sesión en cookies. */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
