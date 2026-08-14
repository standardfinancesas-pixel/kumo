import { getServiceClient } from './supabase-service';

/**
 * Envío de notificaciones push por la Expo Push API.
 *
 * Por qué Expo y no FCM directo: la app se distribuye con EAS, así que cada
 * dispositivo tiene un token de Expo (`ExponentPushToken[...]`). Expo se encarga
 * de hablar con FCM (Android) y APNs (iOS) y de devolver los tokens muertos. Ir
 * directo a FCM obligaría a manejar dos protocolos y a guardar credenciales de
 * Apple del lado nuestro.
 *
 * No hace falta ninguna API key para mandar: el token del dispositivo ES la
 * credencial. Lo que SÍ hace falta, y es config de la cuenta y no código, son las
 * credenciales de FCM subidas a EAS para que Android entregue en el APK instalado
 * (ver el ROADMAP).
 */
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

/** Expo acepta hasta 100 mensajes por pedido. */
const LOTE = 100;

export type ResultadoPush = { entregados: number; fallados: number; detalle: string[] };

type TicketExpo = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

/**
 * Manda un aviso a los tokens dados y limpia los que ya no existen.
 *
 * Los tokens muertos (`DeviceNotRegistered`: el socio desinstaló la app) se borran
 * en el mismo movimiento. Si no, la tabla acumula basura y cada envío siguiente
 * arrastra más errores hasta que el número de "entregados" no significa nada.
 */
export async function mandarPush(tokens: string[], titulo: string, cuerpo: string, datos?: Record<string, string>): Promise<ResultadoPush> {
  if (tokens.length === 0) return { entregados: 0, fallados: 0, detalle: ['No hay ningún dispositivo registrado.'] };

  let entregados = 0;
  let fallados = 0;
  const detalle: string[] = [];
  const muertos: string[] = [];

  for (let i = 0; i < tokens.length; i += LOTE) {
    const lote = tokens.slice(i, i + LOTE);
    const mensajes = lote.map((to) => ({
      to,
      title: titulo,
      body: cuerpo,
      sound: 'default' as const,
      // `data` viaja con la notificación: la app lo usa para abrir la pantalla
      // que corresponde en lugar del inicio.
      data: datos ?? {},
    }));

    try {
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(mensajes),
      });
      const json = (await res.json()) as { data?: TicketExpo[]; errors?: { message: string }[] };
      if (json.errors?.length) {
        fallados += lote.length;
        detalle.push(json.errors[0]!.message);
        continue;
      }
      (json.data ?? []).forEach((t, j) => {
        if (t.status === 'ok') { entregados++; return; }
        fallados++;
        if (t.details?.error === 'DeviceNotRegistered') muertos.push(lote[j]!);
        else if (t.message && !detalle.includes(t.message)) detalle.push(t.message);
      });
    } catch (e) {
      fallados += lote.length;
      detalle.push(e instanceof Error ? e.message : 'error de red');
    }
  }

  if (muertos.length > 0) {
    await getServiceClient().from('push_tokens').delete().in('token', muertos);
    detalle.push(`${muertos.length} dispositivo${muertos.length === 1 ? '' : 's'} ya no ${muertos.length === 1 ? 'tiene' : 'tienen'} la app instalada: se ${muertos.length === 1 ? 'quitó' : 'quitaron'} de la lista.`);
  }

  return { entregados, fallados, detalle };
}

/**
 * Los tokens de una audiencia del panel.
 *
 * Las audiencias son las mismas que muestra la pantalla de Push, y se resuelven
 * acá y no en el cliente: el navegador no puede leer los tokens de otros socios
 * (la RLS lo impide, y está bien que lo impida).
 */
export async function tokensDeAudiencia(audiencia: string): Promise<string[]> {
  const svc = getServiceClient();

  // Plan X → los socios activos de ese plan.
  const plan = /^Plan (.+)$/.exec(audiencia)?.[1];
  if (plan) {
    const { data: planRow } = await svc.from('plans').select('id').eq('name', plan).single();
    if (!planRow) return [];
    const { data } = await svc.from('profiles').select('id').eq('role', 'socio').eq('status', 'activo').eq('plan_id', planRow.id);
    return tokensDe(svc, (data ?? []).map((p) => p.id));
  }

  // Vacunas pendientes → los dueños de una mascota con algo por vencer.
  if (audiencia === 'Vacunas pendientes') {
    const { data } = await svc.from('vaccinations').select('pets(owner_id)').eq('status', 'pendiente');
    type Fila = { pets: { owner_id: string } | { owner_id: string }[] | null };
    const ids = new Set<string>();
    for (const v of (data ?? []) as Fila[]) {
      const p = Array.isArray(v.pets) ? v.pets[0] : v.pets;
      if (p?.owner_id) ids.add(p.owner_id);
    }
    return tokensDe(svc, [...ids]);
  }

  // Todos los socios: los de baja no reciben avisos del club.
  const { data } = await svc.from('profiles').select('id').eq('role', 'socio').neq('status', 'baja');
  return tokensDe(svc, (data ?? []).map((p) => p.id));
}

async function tokensDe(svc: ReturnType<typeof getServiceClient>, memberIds: string[]): Promise<string[]> {
  if (memberIds.length === 0) return [];
  const { data } = await svc.from('push_tokens').select('token').in('member_id', memberIds);
  return (data ?? []).map((t) => t.token as string);
}
