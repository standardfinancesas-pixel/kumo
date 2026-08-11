import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente anon sin sesión, para el contenido público de la landing (planes,
 * FAQ, contacto). No lee cookies a propósito: así la página se puede cachear.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
