import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * "Sumate como prestador", desde la landing pública.
 *
 * Existe porque ese formulario era una maqueta: pedía rubro, nombre, zona,
 * WhatsApp, descripción, mail y contraseña, decía "Crear cuenta y enviar
 * solicitud", y lo único que hacía era mostrar "¡Solicitud enviada! Te
 * contactamos en 48 hs". No guardaba nada. La gente se anotaba, esperaba dos
 * días y el club nunca se enteraba de que existía — de hecho así se descubrió,
 * porque alguien preguntó por qué no aparecía.
 *
 * Va por el servidor y no desde el navegador porque la política de `providers`
 * exige `owner_id = auth.uid()`, y acá no hay sesión: quien completa esto
 * todavía no es socio.
 *
 * La ficha nace `pendiente` y sin dueño, que es un estado que el producto ya
 * maneja: el club la ve en el panel y decide. Sin dueño se comporta como las
 * fichas que cargó el club a mano, que también lo están.
 *
 * Es un endpoint público que escribe, así que valida todo y recorta: lo peor
 * que puede hacer alguien es llenar el panel de solicitudes basura, que un admin
 * borra. Nada de lo que entra por acá se publica solo.
 */

/** Los rubros que ofrece el formulario. Se valida contra la lista y no se acepta
 *  texto libre: `category` decide el ícono y el filtro de Servicios. */
const RUBROS = ['Paseador', 'Guardería', 'Adiestrador', 'Baño y estética', 'Cuidador', 'Otro'] as const;

const limpiar = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!cuerpo) return NextResponse.json({ error: 'No pudimos leer el formulario.' }, { status: 400 });

  const nombre = limpiar(cuerpo.nombre, 80);
  const zona = limpiar(cuerpo.zona, 80);
  const whatsapp = limpiar(cuerpo.whatsapp, 40);
  const about = limpiar(cuerpo.about, 600);
  const rubro = limpiar(cuerpo.rubro, 40);

  if (!nombre) return NextResponse.json({ error: 'Poné el nombre de tu servicio o empresa.' }, { status: 400 });
  if (!zona) return NextResponse.json({ error: 'Poné la zona donde trabajás.' }, { status: 400 });
  /* El WhatsApp es obligatorio y no un dato más: es el único canal por el que el
     club puede contestarle, porque acá no se crea cuenta ni se pide mail. */
  if (whatsapp.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'Poné un WhatsApp donde podamos escribirte.' }, { status: 400 });
  if (!RUBROS.includes(rubro as (typeof RUBROS)[number])) return NextResponse.json({ error: 'Elegí un rubro.' }, { status: 400 });

  const { error } = await getServiceClient().from('providers').insert({
    name: nombre,
    category: rubro,
    zone: zona,
    phone: whatsapp,
    about,
    status: 'pendiente',
    owner_id: null,
  });
  if (error) {
    console.error('[prestadores/solicitud] no se pudo guardar', error);
    return NextResponse.json({ error: 'No pudimos enviar tu solicitud. Probá de nuevo en un rato.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
