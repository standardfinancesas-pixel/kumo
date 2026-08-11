import { createServiceClient } from '@kumo/shared';

/**
 * Cliente de Supabase con la service-role key: ignora RLS. Usar SOLO desde
 * route handlers (server), nunca importar desde un componente de cliente.
 */
export function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
