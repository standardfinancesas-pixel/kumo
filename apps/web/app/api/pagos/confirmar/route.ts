import { NextResponse } from 'next/server';
import { quienPide } from '@/lib/quien-pide';
import { getServiceClient } from '@/lib/supabase-service';
import { MercadoPagoSinConfigurar, buscarDebitos, traerSuscripcion } from '@/lib/mp';
import { acreditarDebito } from '@/lib/cobrar';

/**
 * La vuelta de Mercado Pago, resuelta preguntando en vez de esperando.
 *
 * Antes esto lo contestaba solo el webhook, y ahí está el problema: medido contra
 * la cuenta real, Mercado Pago debitó 18 segundos después de que el socio autorizó,
 * pero su aviso llegó 2 minutos más tarde. O sea que el socio volvía a un cartel de
 * "estamos confirmando tu pago" y se quedaba mirándolo un rato largo por algo que
 * ya había pasado. Acá se consulta la API con el token: la suscripción y sus
 * débitos, en el momento.
 *
 * Lo que NO cambia: el acceso lo sigue dando un pago acreditado de verdad. Que la
 * suscripción esté `authorized` no alcanza — cuando a un socio le rebota el débito
 * Mercado Pago reintenta y la suscripción SIGUE `authorized`, así que dar el mes
 * por ese estado es regalarle la cuota a una tarjeta rechazada. Lo que cambió es
 * quién trae la novedad, no la regla.
 *
 * El webhook queda igual y hace falta igual: cubre el caso en que el cobro tarda
 * más que la paciencia del socio, los meses siguientes y las cancelaciones. Los dos
 * caminos pueden ver el mismo débito: `acreditar_cuota` deduplica por el id del
 * pago y sólo el primero suma el mes.
 */
export async function POST(req: Request) {
  const { preapprovalId } = (await req.json().catch(() => ({}))) as { preapprovalId?: string };

  // `quienPide` y no la sesión de cookies: la app del celular no tiene cookies y
  // manda el token en el header. Esta pantalla existe en las dos superficies.
  const quien = await quienPide(req);
  if (!quien) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const svc = getServiceClient();
  const { data: socio } = await svc
    .from('profiles')
    .select('id, paid_until, mp_preapproval_id, mp_subscription_status')
    .eq('id', quien.id)
    .maybeSingle();
  if (!socio) return NextResponse.json({ error: 'Todavía no sos socio.' }, { status: 404 });

  /*
   * Qué suscripción mirar.
   *
   * La guardada tiene prioridad, y la de la URL sólo se acepta si el socio no tiene
   * ninguna: el `preapproval_id` viene en la barra de direcciones, así que es texto
   * que escribe cualquiera. Aun así no se le cree: abajo se verifica que el
   * `external_reference` de esa suscripción sea este mismo socio, que es el dato que
   * pusimos nosotros al crearla y que Mercado Pago devuelve firmado por su API.
   */
  const id = socio.mp_preapproval_id || (preapprovalId ?? '').trim();
  if (!id) {
    return NextResponse.json({ ok: true, suscripcion: null, hasta: socio.paid_until, acreditado: false });
  }

  let sus;
  try {
    sus = await traerSuscripcion(id);
  } catch (e) {
    if (e instanceof MercadoPagoSinConfigurar) {
      return NextResponse.json({ error: 'Los pagos todavía no están configurados.' }, { status: 503 });
    }
    console.error('[pagos/confirmar] no pudimos traer la suscripción', id, e);
    return NextResponse.json({ error: 'No pudimos consultar tu suscripción.' }, { status: 502 });
  }

  if (sus.external_reference !== socio.id) {
    console.error('[pagos/confirmar] suscripción de otro socio', id, sus.external_reference, '≠', socio.id);
    return NextResponse.json({ error: 'Esa suscripción no es tuya.' }, { status: 403 });
  }

  // El estado de la suscripción se guarda siempre, incluso si todavía no hay cobro:
  // es lo que le deja decir a la pantalla "tu plan quedó activo" sin mentir.
  if (sus.status !== socio.mp_subscription_status || socio.mp_preapproval_id !== sus.id) {
    await svc.rpc('marcar_suscripcion', {
      p_member_id: socio.id,
      p_preapproval_id: sus.id,
      p_status: sus.status,
    });
  }

  /*
   * Los débitos. Se acreditan TODOS los que estén aprobados y no sólo el último:
   * si el socio no volvió al sitio en dos meses y el webhook se perdió un aviso,
   * esta pasada lo pone al día. Los repetidos no suman nada.
   */
  let debitos;
  try {
    debitos = await buscarDebitos(sus.id);
  } catch (e) {
    console.error('[pagos/confirmar] no pudimos buscar los débitos', sus.id, e);
    // La suscripción ya quedó guardada: se contesta lo que sabemos y el webhook
    // termina el trabajo. Un error acá no es un pago fallido.
    return NextResponse.json({ ok: true, suscripcion: sus.status, hasta: socio.paid_until, acreditado: false });
  }

  let acreditado = false;
  let hasta = socio.paid_until;
  for (const debito of debitos) {
    // Que el débito sea de ESTA suscripción, aunque la búsqueda ya filtre por eso:
    // es una línea, y sin ella un cambio en el SDK que ignore el filtro convertiría
    // este bucle en "acreditá todo lo que encuentres en la cuenta".
    if (debito.preapproval_id !== sus.id) continue;
    if (debito.payment?.status !== 'approved') continue;
    try {
      const r = await acreditarDebito(svc, debito);
      if (r.estado === 'acreditado') { acreditado = true; hasta = r.hasta ?? hasta; }
      else if (r.estado === 'repetido') { hasta = r.hasta ?? hasta; }
    } catch {
      // Ya está logueado adentro. Se sigue con los demás débitos: uno que falle no
      // tiene por qué tapar a otro que sí se puede acreditar.
    }
  }

  return NextResponse.json({ ok: true, suscripcion: sus.status, hasta, acreditado });
}
