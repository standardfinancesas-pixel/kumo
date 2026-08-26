import { NextResponse, after } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';
import { geocodificarDomicilio } from '@/lib/geocodificar';
import { quienPide } from '@/lib/quien-pide';
import { FOTO_TIPOS, FOTO_MAX, armarDeclaraciones, leerBodyAlta, cuotaMensual, MAX_MASCOTAS_ALTA, type BodyAlta, type BancoAlta, claveValida, fnacValida, fnacAISO, avisoFnac, EDAD_MINIMA, hoyISO, CLAVE_MINIMA } from '@kumo/shared';
import { sendAdminAltaNueva, sendBienvenida } from '@/lib/mail';

/**
 * Alta real de socio. Corre en el servidor con la service-role key e inserta el
 * perfil, las mascotas y sus declaraciones juradas.
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
 * **El plan es opcional**: entrar a Kumo es gratis, y lo que se paga son los
 * reintegros y los beneficios. `plan: null` es un alta gratuita legítima;
 * `undefined` o vacío es un pedido roto y da 400 (así una app vieja no crea
 * socios gratuitos por accidente).
 *
 * De la tarjeta ya no llega nada: se tipea en el sitio de Mercado Pago. Y los datos
 * bancarios tampoco se piden acá — se piden al cargar el primer reintegro, que es
 * cuando recién hacen falta.
 */

const PET_TYPE: Record<string, string> = { Perro: 'perro', Gato: 'gato', Otro: 'otro' };
const PET_SEX: Record<string, string> = { Macho: 'macho', Hembra: 'hembra' };

/* La conversión y el chequeo de la fecha viven en `@kumo/shared` (`fnacAISO`), que
   además valida que la fecha EXISTA: la versión que estaba acá aceptaba 31/02 y
   99/99/9999 y los guardaba como fecha de nacimiento. */
function leadingNumber(s: string): number | null {
  const m = /(\d+([.,]\d+)?)/.exec(s ?? '');
  return m?.[1] ? Number(m[1].replace(',', '.')) : null;
}

export async function POST(req: Request) {
  /*
   * El pedido llega como multipart (el JSON en `payload` y las fotos aparte). Si
   * viene mal armado esto tiraba un 500 sin mensaje, que es lo peor para
   * diagnosticar desde un teléfono: la app arma el multipart distinto que el
   * navegador y un campo mal puesto no se ve por ningún lado.
   */
  let cuerpo: BodyAlta;
  let banco: Partial<BancoAlta> | undefined;
  let form: FormData;
  try {
    form = await req.formData();
    /*
     * `leerBodyAlta` normaliza la forma vieja del pedido (una sola mascota en
     * `pet`, la declaración aparte). Hay APKs instalados que la siguen mandando: sin
     * esto, el alta desde esos teléfonos empieza a fallar con 400 y desde afuera
     * parece que la app no anda.
     */
    const leido = leerBodyAlta(JSON.parse(form.get('payload') as string));
    if (!leido) throw new Error('el payload no tiene mascotas ni pet');
    cuerpo = leido.body;
    banco = leido.banco;
  } catch (e) {
    console.error('[onboarding] pedido mal armado:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'No pudimos leer los datos del alta. Probá de nuevo.' }, { status: 400 });
  }
  const { socio, mascotas, plan, odonto, firma, aceptaCuota } = cuerpo;

  // Sin contraseña en el payload = alta con Google. No hace falta un flag del
  // cliente: en ese modo la identidad sale de la sesión, así que no hay nada que
  // pueda falsear declarándose de un modo u otro.
  const conGoogle = !socio?.password;

  if (!socio?.nombre || !Array.isArray(mascotas) || mascotas.length === 0 || !mascotas.every((m) => m?.nombre?.trim())) {
    return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
  }
  if (mascotas.length > MAX_MASCOTAS_ALTA) {
    return NextResponse.json({ error: 'Son demasiadas mascotas para un alta. Cargá las demás desde tu cuenta.' }, { status: 400 });
  }
  if (!conGoogle && !socio?.email) {
    return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
  }
  /*
   * La clave se valida ACÁ además de en la pantalla, con la misma regla de shared:
   * una regla que solo vive en el formulario no es una regla, porque este endpoint es
   * público y recibe lo que le manden. El mensaje dice qué falta en vez de "faltan
   * datos" porque hay APKs instalados que todavía mandan claves de 6 caracteres.
   */
  /*
   * El titular tiene que ser mayor de edad: firma el contrato de membresía y una
   * declaración jurada. Se valida acá además de en la pantalla porque este endpoint
   * es público, y con la misma función de shared para que no se separen.
   */
  if (!fnacValida(socio.fnac, hoyISO())) {
    // El motivo exacto sale de la misma función que usa el formulario, así que el
    // socio lee lo mismo venga de donde venga el pedido.
    const porque = avisoFnac(socio.fnac, hoyISO());
    return NextResponse.json({
      error: porque ?? `Revisá la fecha de nacimiento: el titular tiene que ser mayor de ${EDAD_MINIMA}.`,
    }, { status: 400 });
  }
  if (!conGoogle && !claveValida(socio.password)) {
    return NextResponse.json({
      error: `La contraseña necesita al menos ${CLAVE_MINIMA} caracteres y una mayúscula.`,
    }, { status: 400 });
  }
  /*
   * `null` es "sin plan" (alta gratuita) y es válido. `undefined` o vacío es otra
   * cosa: un pedido al que le falta el campo, y ahí sí corta. La diferencia importa
   * porque una app vieja manda `plan: ''` cuando el socio no eligió, y tratarlo como
   * gratuito daría de alta socios sin plan sin que nadie lo haya pedido.
   */
  if (plan === undefined || (typeof plan === 'string' && plan.trim().length === 0)) {
    return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
  }

  /*
   * Las declaraciones juradas se arman acá con la lista canónica de preguntas, no
   * con el enunciado que manda el navegador. Una por mascota, todas con la MISMA
   * firma: es un solo acto legal con N anexos.
   *
   * Y se exigen: son la base para resolver un reintegro por preexistencia, así que
   * un alta sin ellas dejaría al club sin nada firmado (el paso 4 ya las pide en la
   * pantalla, esto cierra el atajo de postear al endpoint directo).
   */
  const firmadas = armarDeclaraciones(mascotas, firma ?? '');
  if (!firmadas) {
    return NextResponse.json({ error: 'Falta completar y firmar la declaración jurada de salud.' }, { status: 400 });
  }

  const limpio = (v?: string) => v?.trim() || null;
  const db = getServiceClient();

  const { data: planRow, error: planErr } = plan
    ? await db.from('plans').select('id, base_price').eq('name', plan).single()
    : { data: null, error: null };
  if (plan && (planErr || !planRow)) {
    console.error('[onboarding] plan lookup failed', { plan, planErr });
    return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 });
  }

  /*
   * Las fotos: `photo_0`, `photo_1`… en el mismo orden que las mascotas.
   *
   * Repetir la clave `photo` sería ambiguo cuando solo la segunda mascota tiene
   * foto. Si una no se puede guardar, el alta sigue igual —sería peor dejar a
   * alguien afuera del club por una imagen— pero se avisa en la respuesta, y el
   * aviso NOMBRA a la mascota: con varias, "no pudimos guardar la foto" no dice
   * cuál.
   */
  const fotos: (string | null)[] = [];
  const avisos: string[] = [];
  for (let i = 0; i < mascotas.length; i++) {
    const archivo = form.get(`photo_${i}`);
    const nombre = mascotas[i]!.nombre;

    /*
     * Dos formas de la misma foto, según de dónde venga el alta:
     *
     *   · la WEB manda un File, como siempre.
     *   · la APP manda un string: un JSON con { base64, type, name }. El objeto
     *     de archivo del FormData de React Native quedó roto en el runtime del
     *     SDK 57 ("Unsupported FormDataPart implementation"), así que la app
     *     dejó de poder mandar File. Ver postAlta en apps/mobile/lib/api.ts.
     *
     * Acá los dos caminos convergen en (bytes, tipo, ext) y el resto no cambia.
     */
    let bytes: ArrayBuffer | Buffer | null = null;
    let tipo = '';
    let ext = 'jpg';
    if (archivo instanceof File && archivo.size > 0) {
      bytes = await archivo.arrayBuffer();
      tipo = archivo.type;
      ext = archivo.name.split('.').pop() || 'jpg';
    } else if (typeof archivo === 'string' && archivo) {
      try {
        const { base64, type, name } = JSON.parse(archivo) as { base64?: string; type?: string; name?: string };
        if (base64) {
          bytes = Buffer.from(base64, 'base64');
          tipo = type || 'image/jpeg';
          ext = (name || '').split('.').pop() || 'jpg';
        }
      } catch {
        /* un string que no es el JSON esperado se trata como "sin foto" */
      }
    }
    if (!bytes || ('byteLength' in bytes ? bytes.byteLength : 0) === 0) { fotos.push(null); continue; }

    if (!FOTO_TIPOS.includes(tipo as (typeof FOTO_TIPOS)[number])) {
      avisos.push(`No pudimos guardar la foto de ${nombre}: el formato ${tipo || 'del archivo'} no está soportado.`);
      fotos.push(null);
      continue;
    }
    if (bytes.byteLength > FOTO_MAX) {
      avisos.push(`No pudimos guardar la foto de ${nombre} porque pesa más de 5 MB.`);
      fotos.push(null);
      continue;
    }
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await db.storage.from('pet-photos').upload(path, bytes, { contentType: tipo });
    if (uploadErr) {
      console.error('[onboarding] photo upload failed', uploadErr);
      avisos.push(`No pudimos guardar la foto de ${nombre}. La podés cargar después desde el carnet.`);
      fotos.push(null);
      continue;
    }
    fotos.push(db.storage.from('pet-photos').getPublicUrl(path).data.publicUrl);
  }
  const photoError = avisos.length ? avisos.join(' ') : null;

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
   * referencia con ON DELETE CASCADE, así que se lleva el perfil, las mascotas y
   * sus declaraciones, sean una o cinco. Con Google el usuario de auth es de la
   * persona y preexiste al alta, así que borrarlo sería sacarle la cuenta: se
   * limpian solo las filas que creamos acá.
   */
  const revertir = async () => {
    if (conGoogle) {
      await db.from('pets').delete().eq('owner_id', userId);
      await db.from('profiles').delete().eq('id', userId);
    } else {
      await db.auth.admin.deleteUser(userId);
    }
  };

  // El add-on sin plan es una mentira: no hay cuota donde cobrarlo.
  const conOdonto = odonto === true && !!planRow;

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
      birth_date: fnacAISO(socio.fnac),
      // Null = socio gratuito. No es un dato faltante: es un estado válido, y lo
      // que decide el acceso a reintegros y beneficios es `paid_until`, no esto.
      plan_id: planRow?.id ?? null,
      addon_odonto: conOdonto,
      // La cuota la calcula el servidor con el precio real del plan: si la
      // mandara el cliente, se podría firmar por una cuota de $1.
      monthly_fee_agreed: planRow ? cuotaMensual(planRow.base_price, conOdonto) : null,
      // Sin plan no hay cuota ni carencias que aceptar.
      contract_accepted_at: planRow && aceptaCuota ? new Date().toISOString() : null,
      /*
       * Los datos bancarios ya no se piden en el alta: son el destino de los
       * REINTEGROS y se piden al cargar el primero, que es cuando hacen falta. Acá
       * quedan solo por si el pedido vino de una app vieja que todavía los manda.
       */
      bank_holder: limpio(banco?.holder),
      bank_holder_dni: limpio(banco?.holderDni),
      bank_cuit: limpio(banco?.cuit),
      bank_name: limpio(banco?.bank),
      bank_cbu: limpio(banco?.cbu)?.replace(/\D/g, '') || null,
      bank_alias: limpio(banco?.alias),
    })
    .select('member_no')
    .single();

  if (profileErr || !profileRow) {
    console.error('[onboarding] profile insert failed', profileErr);
    await revertir();
    return NextResponse.json({ error: 'No se pudo crear el perfil del socio.' }, { status: 500 });
  }

  /*
   * Las mascotas y sus declaraciones, en UNA transacción de la base.
   *
   * No son inserts sueltos a propósito: para colgarle a cada declaración su
   * `pet_id` habría que emparejar por orden de devolución, y una posición desfasada
   * produce una declaración jurada firmada que dice cosas de otro animal. Si la
   * tercera falla, no queda ninguna.
   */
  const { data: cuantas, error: petsErr } = await db.rpc('crear_mascotas_del_alta', {
    p_member: userId,
    p_version: firmadas[0]!.version,
    p_firma: firmadas[0]!.signature,
    p_mascotas: mascotas.map((m, i) => ({
      nombre: m.nombre,
      tipo: PET_TYPE[m.especie] ?? 'otro',
      raza: m.raza || null,
      sexo: PET_SEX[m.sexo] ?? null,
      castrada: m.castrado === 'Sí',
      edad: leadingNumber(m.edad),
      peso: leadingNumber(m.peso),
      microchip: m.microchip || null,
      vet: m.vet || null,
      foto: fotos[i],
      answers: firmadas[i]!.answers,
      sanitary: firmadas[i]!.sanitary,
    })),
  });

  if (petsErr || !cuantas) {
    console.error('[onboarding] crear_mascotas_del_alta failed', petsErr);
    await revertir();
    return NextResponse.json({ error: 'No se pudieron guardar las mascotas. No se creó la cuenta.' }, { status: 500 });
  }

  // El alta ya está hecha; el mail es un extra. Si falla no se revierte nada ni
  // se le devuelve error al socio: quedaría afuera del club por un problema de
  // mails, que sería peor.
  await sendBienvenida({
    to: email,
    firstName: socio.nombre.split(' ')[0] || socio.nombre,
    mascotas: mascotas.map((m) => m.nombre),
    memberNo: profileRow.member_no,
    planName: plan,
  });

  /*
   * Y al club. A diferencia de los otros tres avisos internos, un alta SÍ deja
   * rastro —aparece en la lista de Socios—, pero el mail distingue lo que la
   * lista no: si eligió plan o entró gratis. El alta sin plan es una oportunidad
   * de conversión que ahí adentro se mezcla con todo lo demás.
   *
   * Sin `await`, como el resto de los internos: el alta ya está hecha.
   */
  void sendAdminAltaNueva({
    socio: socio.nombre,
    memberNo: profileRow.member_no,
    email,
    mascotas: mascotas.map((m) => m.nombre),
    plan,
  });

  /*
   * El domicilio, convertido en un punto del mapa.
   *
   * Va en `after`: la respuesta del alta no espera a un servicio de terceros —el
   * socio ya es socio y lo único que falta es dónde centrarle el mapa—. Y no
   * revierte nada si falla: un domicilio que Nominatim no encuentra es un mapa
   * centrado en CABA, no un alta fallida.
   */
  after(async () => {
    const ubicacion = await geocodificarDomicilio({
      address: socio.domicilio, city: socio.localidad, province: socio.provincia,
    });
    if (!ubicacion) return;
    const { error: geoErr } = await db
      .from('profiles')
      .update({ lat: ubicacion.lat, lng: ubicacion.lng, geo_origen: ubicacion.origen })
      .eq('id', userId);
    if (geoErr) console.error('[onboarding] no pude guardar la ubicación', geoErr);
  });

  return NextResponse.json({ memberNo: profileRow.member_no, photoError });
}
