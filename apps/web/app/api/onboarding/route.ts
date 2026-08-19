import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';
import { quienPide } from '@/lib/quien-pide';
import { FOTO_TIPOS, FOTO_MAX, armarDeclaracion, cuotaMensual } from '@kumo/shared';
import { sendBienvenida } from '@/lib/mail';

/**
 * Alta real de socio. Corre en el servidor con la service-role key e inserta el
 * perfil, la mascota y la declaración jurada. Guarda los 5 pasos.
 *
 * Tiene dos modos, según cómo se identifique la persona:
 *
 *   - **Con contraseña**: crea el usuario de auth ya confirmado (sin depender
 *     del mail de verificación) y el cliente hace login después con ese mail y
 *     esa contraseña.
 *   - **Con Google**: el usuario de auth YA existe —lo creó Google— y llega con
 *     la sesión puesta. Acá no se crea nada de auth: se le cuelga el perfil a esa
 *     identidad. El id y el mail se leen de la sesión, nunca de lo que manda el
 *     cliente, así que nadie puede pedir un alta a nombre de otro. La sesión la
 *     resuelve `quienPide`, que entiende las dos formas: cookies (el navegador) y
 *     `Authorization: Bearer` (la app del celular, que no tiene cookies).
 *
 * De la tarjeta llega solo el medio elegido: el CVV no se puede almacenar y el
 * número obliga a certificar PCI DSS. Cuando entre Mercado Pago se guardan el
 * token y los últimos 4 dígitos.
 */

type Body = {
  socio: { nombre: string; dni: string; fnac: string; domicilio: string; localidad: string; provincia: string; tel: string; email: string; password: string };
  pet: { nombre: string; especie: string; sexo: string; castrado: string; raza: string; edad: string; peso: string; microchip: string; vet: string; foto: string };
  plan: string;
  odonto?: boolean;
  declaracion?: { health: Record<number, string>; sanit: Record<number, string>; firma: string };
  pago?: {
    metodo?: string;
    aceptaCuota?: boolean;
    /** A dónde el club le transfiere los reintegros. La transferencia la hace el
     *  club a mano: el sistema no mueve plata, solo guarda el destino. */
    banco?: { holder?: string; holderDni?: string; cuit?: string; bank?: string; cbu?: string; alias?: string };
    /** Marca, últimos 4 y vencimiento, ya calculados en el navegador. El número
     *  completo y el CVV no llegan hasta acá a propósito (PCI DSS). */
    tarjeta?: { brand: string; last4: string; exp: string; holder: string } | null;
  };
};

const PET_TYPE: Record<string, string> = { Perro: 'perro', Gato: 'gato', Otro: 'otro' };
const PET_SEX: Record<string, string> = { Macho: 'macho', Hembra: 'hembra' };

function fnacToIso(fnac: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fnac.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}
function leadingNumber(s: string): number | null {
  const m = /(\d+([.,]\d+)?)/.exec(s ?? '');
  return m?.[1] ? Number(m[1].replace(',', '.')) : null;
}

export async function POST(req: Request) {
  /*
   * El pedido llega como multipart (el JSON en `payload` y la foto aparte). Si
   * viene mal armado esto tiraba un 500 sin mensaje, que es lo peor para
   * diagnosticar desde un teléfono: la app arma el multipart distinto que el
   * navegador y un campo mal puesto no se ve por ningún lado.
   */
  let cuerpo: Body;
  let photoFile: FormDataEntryValue | null;
  try {
    const form = await req.formData();
    cuerpo = JSON.parse(form.get('payload') as string) as Body;
    photoFile = form.get('photo');
  } catch (e) {
    console.error('[onboarding] pedido mal armado:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'No pudimos leer los datos del alta. Probá de nuevo.' }, { status: 400 });
  }
  const { socio, pet, plan, odonto, declaracion, pago } = cuerpo;

  // Sin contraseña en el payload = alta con Google. No hace falta un flag del
  // cliente: en ese modo la identidad sale de la sesión, así que no hay nada que
  // pueda falsear declarándose de un modo u otro.
  const conGoogle = !socio?.password;

  if (!socio?.nombre || !pet?.nombre || !plan) {
    return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
  }
  if (!conGoogle && (!socio?.email || socio.password.length < 6)) {
    return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
  }

  // La declaración jurada se arma acá con la lista canónica de preguntas, no con
  // el enunciado que manda el navegador. Y se exige: es la base para resolver un
  // reintegro por preexistencia, así que un alta sin ella dejaría al club sin
  // nada firmado (el paso 4 ya la pide en la pantalla, esto cierra el atajo de
  // postear al endpoint directo).
  const firmada = armarDeclaracion({
    health: declaracion?.health ?? {},
    sanit: declaracion?.sanit ?? {},
    firma: declaracion?.firma ?? '',
  });
  if (!firmada) {
    return NextResponse.json({ error: 'Falta completar y firmar la declaración jurada de salud.' }, { status: 400 });
  }

  const payMethod = pago?.metodo === 'cbu' ? 'cbu' : pago?.metodo === 'tarjeta' ? 'tarjeta' : null;

  const limpio = (v?: string) => v?.trim() || null;
  const banco = pago?.banco;
  // Los últimos 4 se guardan solo si son 4 dígitos: la columna tiene un check y
  // un "últimos 4" de dos dígitos es peor que no tener nada.
  const tarjeta = pago?.tarjeta && /^\d{4}$/.test(pago.tarjeta.last4) ? pago.tarjeta : null;

  const db = getServiceClient();

  let uploadedPhotoUrl: string | null = null;
  // Si la foto no se puede guardar, el alta sigue igual (sería peor dejar a
  // alguien afuera del club por una imagen) pero se avisa en la respuesta: antes
  // devolvía "listo" y el socio descubría el problema al ver su carnet vacío.
  let photoError: string | null = null;
  if (photoFile instanceof File && photoFile.size > 0) {
    if (!FOTO_TIPOS.includes(photoFile.type as (typeof FOTO_TIPOS)[number])) {
      photoError = `No pudimos guardar la foto: el formato ${photoFile.type || 'del archivo'} no está soportado.`;
    } else if (photoFile.size > FOTO_MAX) {
      photoError = 'No pudimos guardar la foto porque pesa más de 5 MB.';
    } else {
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await db.storage.from('pet-photos').upload(path, await photoFile.arrayBuffer(), { contentType: photoFile.type });
      if (!uploadErr) {
        uploadedPhotoUrl = db.storage.from('pet-photos').getPublicUrl(path).data.publicUrl;
      } else {
        console.error('[onboarding] photo upload failed', uploadErr);
        photoError = 'No pudimos guardar la foto. Podés cargarla después desde el carnet.';
      }
    }
  }

  const { data: planRow, error: planErr } = await db.from('plans').select('id, base_price').eq('name', plan).single();
  if (planErr || !planRow) {
    console.error('[onboarding] plan lookup failed', { plan, planErr });
    return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 });
  }

  /** Con Google la identidad ya existe; con contraseña hay que crearla. */
  let userId: string;
  let email: string;

  if (conGoogle) {
    // El id y el mail salen de la SESIÓN, no del payload: si vinieran del
    // cliente, cualquiera podría pedir un alta a nombre de otra persona.
    const quien = await quienPide(req);
    if (!quien?.email) {
      return NextResponse.json({ error: 'Se cerró la sesión de Google. Volvé a entrar con Google y seguí desde ahí.' }, { status: 401 });
    }
    userId = quien.id;
    email = quien.email;

    // Que no se dé de alta dos veces. La restricción real es la clave primaria
    // de `profiles`, pero así el mensaje es entendible en vez de un error de
    // base de datos.
    const { data: yaEsta } = await db.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (yaEsta) {
      return NextResponse.json({ error: 'Esa cuenta ya es socia de Kumo. Entrá con Google.' }, { status: 400 });
    }
  } else {
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: socio.email,
      password: socio.password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      const msg = /already registered|already exists/i.test(createErr?.message ?? '') ? 'Ya existe una cuenta con ese email.' : (createErr?.message ?? 'No se pudo crear la cuenta.');
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    userId = created.user.id;
    email = socio.email;
  }

  /**
   * Deshacer un alta a medio hacer.
   *
   * Con contraseña alcanza con borrar el usuario de auth: `profiles.id` lo
   * referencia con ON DELETE CASCADE, así que se lleva el perfil y las mascotas.
   * Con Google el usuario de auth es de la persona y preexiste al alta, así que
   * borrarlo sería sacarle la cuenta: se limpian solo las filas que creamos acá.
   */
  const revertir = async () => {
    if (conGoogle) {
      await db.from('pets').delete().eq('owner_id', userId);
      await db.from('profiles').delete().eq('id', userId);
    } else {
      await db.auth.admin.deleteUser(userId);
    }
  };

  const { data: profileRow, error: profileErr } = await db
    .from('profiles')
    .insert({
      id: userId,
      full_name: socio.nombre,
      email,
      phone: socio.tel || null,
      // El domicilio va en tres columnas: concatenado no se puede segmentar por
      // localidad ni provincia, y el club se organiza por zonas.
      address: socio.domicilio || null,
      city: socio.localidad || null,
      province: socio.provincia || null,
      dni: socio.dni || null,
      birth_date: fnacToIso(socio.fnac),
      plan_id: planRow.id,
      addon_odonto: odonto === true,
      // La cuota la calcula el servidor con el precio real del plan: si la
      // mandara el cliente, se podría firmar por una cuota de $1.
      monthly_fee_agreed: cuotaMensual(planRow.base_price, odonto === true),
      pay_method: payMethod,
      contract_accepted_at: pago?.aceptaCuota ? new Date().toISOString() : null,
      // Destino de los reintegros. El club transfiere a mano, así que esto es
      // todo lo que necesita saber para pagarle.
      bank_holder: limpio(banco?.holder),
      bank_holder_dni: limpio(banco?.holderDni),
      bank_cuit: limpio(banco?.cuit),
      bank_name: limpio(banco?.bank),
      bank_cbu: limpio(banco?.cbu)?.replace(/\D/g, '') || null,
      bank_alias: limpio(banco?.alias),
      // Medio de cobro de la cuota: metadata, no el instrumento.
      card_brand: tarjeta?.brand ?? null,
      card_last4: tarjeta?.last4 ?? null,
      card_exp: tarjeta?.exp ?? null,
      card_holder: tarjeta?.holder ?? null,
    })
    .select('member_no')
    .single();

  if (profileErr || !profileRow) {
    await revertir();
    return NextResponse.json({ error: 'No se pudo crear el perfil del socio.' }, { status: 500 });
  }

  const { data: petRow, error: petErr } = await db.from('pets').insert({
    owner_id: userId,
    name: pet.nombre,
    type: PET_TYPE[pet.especie] ?? 'otro',
    breed: pet.raza || null,
    age_years: leadingNumber(pet.edad),
    weight_kg: leadingNumber(pet.peso),
    microchip: pet.microchip || null,
    neutered: pet.castrado === 'Sí',
    sex: PET_SEX[pet.sexo] ?? null,
    vet_name: pet.vet || null,
    // Solo la foto que subió. Antes se aceptaba una ruta de /img/ porque el alta
    // ofrecía fotos de ejemplo; se sacaron (un carnet con la mascota de otro es peor
    // que uno sin foto), así que esa rama ya no puede pasar.
    photo_url: uploadedPhotoUrl,
  })
    .select('id')
    .single();

  if (petErr || !petRow) {
    await revertir();
    return NextResponse.json({ error: 'No se pudo crear la mascota.' }, { status: 500 });
  }

  // La declaración va después de la mascota porque la referencia. Si no se puede
  // guardar, el alta se revierte entera: dejar un socio adentro del club sin su
  // declaración jurada es justamente el agujero que esto viene a cerrar.
  const { error: decErr } = await db.from('health_declarations').insert({
    member_id: userId,
    pet_id: petRow.id,
    pet_name: pet.nombre,
    version: firmada.version,
    answers: firmada.answers,
    sanitary: firmada.sanitary,
    signature: firmada.signature,
  });

  if (decErr) {
    console.error('[onboarding] health declaration failed', decErr);
    await revertir();
    return NextResponse.json({ error: 'No se pudo guardar la declaración jurada. No se creó la cuenta.' }, { status: 500 });
  }

  // El alta ya está hecha; el mail es un extra. Si falla no se revierte nada ni
  // se le devuelve error al socio: quedaría afuera del club por un problema de
  // mails, que sería peor.
  await sendBienvenida({
    to: email,
    firstName: socio.nombre.split(' ')[0] || socio.nombre,
    petName: pet.nombre,
    memberNo: profileRow.member_no,
    planName: plan,
  });

  return NextResponse.json({ memberNo: profileRow.member_no, photoError });
}
