/**
 * Kumo · Cliente de Supabase (compartido)
 *
 * Fábricas mínimas de cliente para reutilizar en las apps web (Next.js)
 * y en la app móvil (Expo). Cada app inyecta sus propias variables de
 * entorno (NEXT_PUBLIC_* o EXPO_PUBLIC_*) al llamar estas funciones.
 *
 * Realtime viene incluido en @supabase/supabase-js: ver `subscribeTable`
 * más abajo para escuchar cambios en vivo (cola de reintegros, foro, etc.).
 */
import {
  createClient,
  type SupabaseClient,
  type RealtimeChannel,
} from '@supabase/supabase-js';

export type CreateClientOptions = {
  url: string;
  anonKey: string;
  /** Persistencia de sesión: true en apps con auth de usuario. */
  persistSession?: boolean;
};

/** Cliente para el navegador / la app móvil (usa la anon key + RLS). */
export function createBrowserClient({
  url,
  anonKey,
  persistSession = true,
}: CreateClientOptions): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('[kumo] Faltan SUPABASE_URL / SUPABASE_ANON_KEY');
  }
  return createClient(url, anonKey, {
    auth: { persistSession, autoRefreshToken: true, detectSessionInUrl: persistSession },
  });
}

/**
 * Cliente para el servidor con service-role key (route handlers, edge
 * functions). Ignora RLS — usar SOLO en el backend, nunca en el cliente.
 */
export function createServiceClient(url: string, serviceRoleKey: string): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error('[kumo] Faltan SUPABASE_URL / SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Suscripción Realtime a los cambios de una tabla.
 * Ej: subscribeTable(supabase, 'reimbursements', (payload) => refetch())
 */
export function subscribeTable(
  client: SupabaseClient,
  table: string,
  onChange: (payload: unknown) => void,
  filter?: string
): RealtimeChannel {
  const channel = client
    .channel(`realtime:${table}`)
    .on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table, filter } as never,
      onChange as never
    )
    .subscribe();
  return channel;
}
