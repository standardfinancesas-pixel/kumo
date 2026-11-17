import { NextResponse } from 'next/server';
import { quienPide } from '@/lib/quien-pide';
import { getServiceClient } from '@/lib/supabase-service';
import { cercaDeSuCiudad, geocodificarDomicilio } from '@/lib/geocodificar';

/**
 * Vuelve a poner al socio en el mapa después de que cambió su domicilio.
 *
 * El domicilio se geocodifica en el alta, pero se puede editar desde "Mis datos"
 * (en la webapp y en la app), y si las coordenadas se quedaran con la dirección
 * vieja el mapa mostraría prestadores cerca de donde el socio ya no vive. Esto lo
 * llaman las dos superficies justo después de guardar, y solo cuando el domicilio
 * cambió de verdad.
 *
 * No recibe nada: el domicilio lo lee de la fila del socio que pide, no del cuerpo
 * del pedido. Así nadie puede escribirle coordenadas a mano ni mover a otro.
 *
 * Si no se puede resolver, las coordenadas quedan en null y la pantalla vuelve a
 * medir desde el centro de CABA diciéndolo ("del centro"). Es mejor eso que dejar
 * las de la casa anterior.
 */

/*
 * Un freno por socio, para no golpear a Nominatim si alguien guarda diez veces
 * seguidas. Es en memoria y por instancia —en serverless no hay una sola—, así
 * que es un amortiguador, no una garantía: la garantía es que la pantalla llama
 * únicamente cuando el domicilio cambió.
 */
const ultimoPedido = new Map<string, number>();
const ESPERA_MS = 60_000;

export async function POST(req: Request) {
  const quien = await quienPide(req);
  if (!quien) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const ahora = Date.now();
  const previo = ultimoPedido.get(quien.id) ?? 0;
  if (ahora - previo < ESPERA_MS) return NextResponse.json({ ok: false, motivo: 'muy seguido' });
  ultimoPedido.set(quien.id, ahora);

  const svc = getServiceClient();
  const { data: socio } = await svc
    .from('profiles')
    .select('address, city, province')
    .eq('id', quien.id)
    .single();
  if (!socio) return NextResponse.json({ error: 'No encontramos tu perfil.' }, { status: 404 });

  /*
   * El punto que la persona ELIGIÓ de la lista, si vino.
   *
   * Hasta ahora esta ruta no recibía nada a propósito: "nadie puede escribirle
   * coordenadas a mano ni mover a otro". Ese criterio sigue en pie — por eso el
   * punto no se acepta porque sí, sino solo si cae cerca de la ciudad que el
   * socio tiene declarada en su fila. Alguien puede corregir su casa tres
   * cuadras; nadie puede mudarse a otra provincia desde el navegador.
   *
   * Vale la pena recibirlo porque es el punto EXACTO que mostró el callejero
   * cuando eligió, y volver a derivarlo del texto es lo que mandó a 7 socios a
   * otra ciudad (ver el comentario del reintento en lib/geocodificar).
   */
  const cuerpo = (await req.json().catch(() => null)) as { lat?: unknown; lng?: unknown } | null;
  const elegido =
    typeof cuerpo?.lat === 'number' && typeof cuerpo?.lng === 'number' && Number.isFinite(cuerpo.lat) && Number.isFinite(cuerpo.lng)
      ? { lat: cuerpo.lat, lng: cuerpo.lng }
      : null;

  const ubicacion = (elegido && (await cercaDeSuCiudad(elegido, socio.city, socio.province))
    ? { ...elegido, origen: 'domicilio' as const }
    : null) ?? await geocodificarDomicilio(socio);
  const { error } = await svc
    .from('profiles')
    .update({
      lat: ubicacion?.lat ?? null,
      lng: ubicacion?.lng ?? null,
      geo_origen: ubicacion?.origen ?? null,
    })
    .eq('id', quien.id);
  if (error) {
    console.error('[perfil/ubicacion] no pude guardar', error);
    return NextResponse.json({ error: 'No pudimos guardar tu ubicación.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ubicacion });
}
