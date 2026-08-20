import { claveValida } from './clave';
import { HEALTH_Q, SANITARIO_Q, armarDeclaracion, type RespuestaDeclarada } from './declaracion';

/**
 * El alta de socio, en la parte que tiene que valer igual en la web y en la app.
 *
 * Antes vivía entera dentro del formulario web: las provincias, los formateadores
 * y —lo importante— la regla de "este paso está completo". Al portar el alta al
 * celular eso habría quedado escrito dos veces, y el primer síntoma no habría sido
 * una pantalla distinta sino un socio guardado con datos que una superficie acepta
 * y la otra no.
 *
 * Acá NO hay componentes ni estilos: la web usa DOM y el celular React Native, y
 * `CLAUDE.md` fija React 19 en una y 18.2.0 en la otra a propósito. Lo que se
 * comparte es la forma de los datos y las reglas.
 */

/** Las 24 jurisdicciones, para el selector de provincia. */
export const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
] as const;

/**
 * Cuántas mascotas se pueden cargar en un alta.
 *
 * No es un límite de producto —el club quiere que se puedan cargar todas—: es
 * defensa contra un pedido armado a mano. La pantalla esconde "agregar otra" al
 * llegar, y la función de la base corta más arriba todavía.
 */
export const MAX_MASCOTAS_ALTA = 6;

/* ── Formateadores: lo que el socio ve mientras tipea ─────────────── */

/** 12345678 → 12.345.678 */
export const formatDni = (raw: string) =>
  raw.replace(/\D/g, '').slice(0, 8).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 1155552024 → 11 5555 2024 */
export const formatTel = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  return [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10)].filter(Boolean).join(' ');
};

/**
 * 1121990 → 11/2/1990, con las barras puestas mientras se escribe.
 *
 * La web no formateaba la fecha: quien tipeaba `1/2/1990` no pasaba el chequeo
 * (que pide dos dígitos) y el botón se quedaba bloqueado sin explicar por qué. En
 * un teclado de teléfono eso es peor todavía, así que el formato lo pone el campo
 * y el socio no tiene que adivinar.
 */
export const formatFecha = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
};

/* ── La forma de los datos ─────────────────────────────────────────── */

export type SocioAlta = {
  nombre: string; dni: string; fnac: string; domicilio: string; localidad: string;
  provincia: string; tel: string; email: string; password: string;
};

/**
 * Los valores van con la etiqueta que ve el socio ("Perro", "Macho", "Sí") y el
 * servidor los traduce a los del enum de la base. Es a propósito: el que decide
 * cómo se llaman las cosas en la base es el schema, no el formulario.
 */
export type MascotaAlta = {
  nombre: string; especie: string; sexo: string; castrado: string; raza: string;
  edad: string; peso: string; microchip: string; vet: string; foto: string;
};

/**
 * Una mascota del formulario, con SUS respuestas de salud adentro.
 *
 * Las respuestas van acá y no en una lista aparte indexada igual: dos listas
 * paralelas se desincronizan solas —se borra la segunda mascota y la declaración de
 * la tercera queda pegada a la que quedó— y el resultado sería un documento jurado
 * que dice cosas de otro animal.
 *
 * `uid` existe porque dos mascotas se pueden llamar igual ("Negro" y "Negro") y hay
 * que poder borrar la fila correcta y encontrar su foto. No viaja al servidor.
 */
export type MascotaBorrador = {
  uid: string;
  datos: MascotaAlta;
  salud: Record<number, string>;
  sanit: Record<number, string>;
};

/** A dónde el club transfiere los reintegros. Ya no se pide en el alta: se pide al
 *  cargar el primer reintegro, que es cuando recién hace falta. El tipo queda para
 *  poder leer los pedidos de las apps viejas. */
export type BancoAlta = {
  holder: string; holderDni: string; cuit: string; bank: string; cbu: string; alias: string;
};

/**
 * Qué eligió en el paso del plan.
 *
 * Hacen falta TRES estados y no dos: `null` es "todavía no eligió" (y bloquea el
 * botón), `gratis` es una elección de verdad, y `pago` trae el plan. Sin la
 * distinción, el paso quedaba sin forma de avanzar para quien no quiere pagar.
 *
 * `aceptaCuota` vive adentro de la variante `pago` a propósito: no hay cuota que
 * aceptar en la rama gratuita, así que "socio gratuito que aceptó la cuota" no es
 * un estado representable.
 *
 * No se usa un plan centinela 'GRATIS': `plans.name` es un enum de Postgres y
 * consultarlo por un valor que no existe no devuelve vacío, tira error.
 */
export type EleccionPlan =
  | { modo: 'gratis' }
  /** `aceptaCuota` ya no sale de un tilde: se pone en true al elegir un plan pago,
   *  porque la aceptación es tocar el botón que dice "Ir a Mercado Pago" con las
   *  condiciones escritas al lado. Sigue viajando al servidor porque es lo que hace
   *  que se escriba `contract_accepted_at`: sin él, el alta pagada dejaría de
   *  registrar que el socio aceptó la cuota, y eso es justo lo que hay que poder
   *  mostrar si alguien discute un cargo. */
  | { modo: 'pago'; plan: string; aceptaCuota: boolean };

export type BorradorAlta = {
  socio: SocioAlta;
  mascotas: MascotaBorrador[];
  eleccion: EleccionPlan | null;
  odonto: boolean;
  /** Una firma para todas las mascotas: es un solo acto legal con N anexos. */
  firma: string;
  acepta: boolean;
};

/** Una mascota tal como viaja al servidor: sus datos y sus respuestas. */
export type MascotaBody = MascotaAlta & { salud: Record<number, string>; sanit: Record<number, string> };

/** El cuerpo que espera `POST /api/onboarding`. Lo importa el route handler para no
 *  volver a declararlo: dos copias del mismo contrato divergen solas. */
export type BodyAlta = {
  socio: SocioAlta;
  mascotas: MascotaBody[];
  /** `null` = alta gratuita. Ojo: `undefined` NO es lo mismo y da 400. */
  plan: string | null;
  odonto?: boolean;
  firma: string;
  aceptaCuota?: boolean;
};

let contador = 0;
/** Un id local para la lista del formulario. No es un uuid: no sale de la pantalla. */
const nuevoUid = () => 'm' + (contador += 1);

export function mascotaVacia(inicial?: { nombre?: string; especie?: string }): MascotaBorrador {
  return {
    uid: nuevoUid(),
    datos: {
      nombre: inicial?.nombre ?? '',
      especie: inicial?.especie === 'gato' ? 'Gato' : 'Perro',
      sexo: 'Macho', castrado: 'Sí', raza: '', edad: '', peso: '', microchip: '', vet: '', foto: '',
    },
    salud: {},
    sanit: {},
  };
}

/** Un borrador en blanco, con una mascota para arrancar. */
export function borradorVacio(inicial?: { nombre?: string; email?: string; mascota?: string; especie?: string }): BorradorAlta {
  return {
    socio: {
      nombre: inicial?.nombre ?? '', dni: '', fnac: '', domicilio: '', localidad: '',
      provincia: '', tel: '', email: inicial?.email ?? '', password: '',
    },
    mascotas: [mascotaVacia({ nombre: inicial?.mascota, especie: inicial?.especie })],
    eleccion: null,
    odonto: false,
    firma: '',
    acepta: false,
  };
}

/* ── Las reglas ────────────────────────────────────────────────────── */

export type ValidacionSocio = {
  nombre: boolean; dni: boolean; fnac: boolean; tel: boolean; email: boolean;
  password: boolean; ok: boolean;
};

/** Campo por campo, para poder marcar en rojo el que falla y no solo bloquear el
 *  botón: un formulario de nueve campos que no dice cuál está mal es una trampa. */
export function validarSocio(socio: SocioAlta, conGoogle = false): ValidacionSocio {
  const nombre = socio.nombre.trim().length > 1 && !socio.nombre.includes('@');
  const dni = /^\d{7,8}$/.test(socio.dni.replace(/\D/g, ''));
  const fnac = /^\d{2}\/\d{2}\/\d{4}$/.test(socio.fnac);
  const tel = socio.tel.replace(/\D/g, '').length === 10;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(socio.email);
  // Con Google no hay contraseña que validar: la identidad ya está resuelta.
  // La regla de la clave vive en : se elige una contraseña en cuatro
  // lugares y cada uno tenía su propio mínimo escrito a mano.
  const password = conGoogle || claveValida(socio.password);
  return {
    nombre, dni, fnac, tel, email, password,
    ok: nombre && dni && fnac && tel && email && password
      && socio.domicilio.trim().length > 0
      && socio.localidad.trim().length > 0
      && socio.provincia.length > 0,
  };
}

/** ¿Están las 11 respuestas de ESTA mascota? La firma se valida aparte: es una
 *  sola para todas. */
export function declaracionDeMascotaOk(m: MascotaBorrador): boolean {
  const completa = (preguntas: readonly string[], r: Record<number, string>) =>
    preguntas.every((_, i) => r[i] === 'Sí' || r[i] === 'No');
  return completa(HEALTH_Q, m.salud) && completa(SANITARIO_Q, m.sanit);
}

/** Todas las mascotas contestadas, firmado y aceptado. */
export function declaracionCompleta(b: BorradorAlta): boolean {
  return b.mascotas.length > 0
    && b.mascotas.every(declaracionDeMascotaOk)
    && b.firma.trim().length > 2
    && b.acepta;
}

export const esGratis = (e: EleccionPlan | null) => e?.modo === 'gratis';
export const planElegido = (e: EleccionPlan | null) => (e?.modo === 'pago' ? e.plan : null);

/** Cuántos pasos tiene el alta: el del pago no existe si eligió gratis. */
export const pasosDelAlta = (b: BorradorAlta) => (esGratis(b.eleccion) ? 4 : 5);

/** ¿Se puede pasar al paso siguiente? Una sola definición para las dos
 *  superficies: es lo que evita que un arreglo entre en una y no en la otra. */
export function pasoOk(paso: number, b: BorradorAlta, conGoogle = false): boolean {
  switch (paso) {
    // Todas las mascotas de la lista necesitan nombre: una fila vacía crearía una
    // mascota sin nombre, y el nombre es lo único que el alta pide de verdad.
    case 1: return b.mascotas.length > 0 && b.mascotas.every((m) => m.datos.nombre.trim().length > 0);
    case 2: return validarSocio(b.socio, conGoogle).ok;
    case 3: return b.eleccion !== null;
    case 4: return declaracionCompleta(b);
    // El paso del pago solo existe con plan, y lo único que pide es aceptar la
    // cuota: la tarjeta se pone en el sitio de Mercado Pago, no acá.
    /*
     * El paso de la cuota ya no espera un tilde: la aceptación pasó a estar en el
     * botón, con las condiciones escritas al lado ("Al continuar aceptás…"). Es el
     * mismo valor legal —lo que importa es que el texto esté a la vista y que el acto
     * de aceptar sea explícito— con un toque menos entre el socio y el pago.
     *
     * `aceptaCuota` sigue viajando al servidor, que es lo que escribe
     * `contract_accepted_at`: la aceptación se sigue registrando, solo cambió el gesto.
     */
    case 5: return b.eleccion?.modo === 'pago';
    default: return true;
  }
}

/** El borrador convertido en el cuerpo del pedido. */
export function payloadAlta(b: BorradorAlta): BodyAlta {
  return {
    socio: b.socio,
    mascotas: b.mascotas.map((m) => ({ ...m.datos, salud: m.salud, sanit: m.sanit })),
    plan: planElegido(b.eleccion),
    // Sin plan no hay cuota donde cobrar el add-on: guardarlo sería una mentira.
    odonto: b.eleccion?.modo === 'pago' ? b.odonto : false,
    firma: b.firma,
    aceptaCuota: b.eleccion?.modo === 'pago' ? b.eleccion.aceptaCuota : false,
  };
}

export type DeclaracionArmada = {
  nombre: string;
  version: number;
  answers: RespuestaDeclarada[];
  sanitary: RespuestaDeclarada[];
  signature: string;
};

/**
 * Una declaración jurada por mascota, todas con la MISMA firma.
 *
 * Es un solo acto legal con N anexos, que es exactamente lo que es. Devuelve `null`
 * si alguna está incompleta: media declaración jurada no se firma, y si una falla no
 * se guarda ninguna.
 */
export function armarDeclaraciones(mascotas: MascotaBody[], firma: string): DeclaracionArmada[] | null {
  if (mascotas.length === 0) return null;
  const salida: DeclaracionArmada[] = [];
  for (const m of mascotas) {
    const d = armarDeclaracion({ health: m.salud, sanit: m.sanit, firma });
    if (!d) return null;
    salida.push({ nombre: m.nombre, ...d });
  }
  return salida;
}

/**
 * Normaliza el cuerpo de un pedido viejo.
 *
 * Hay APKs instalados que siguen mandando la forma anterior: una sola mascota en
 * `pet`, la declaración en `declaracion`, y los datos bancarios en `pago`. Sin esto,
 * el alta desde esos teléfonos empieza a fallar con 400 y desde afuera parece que la
 * app no anda. Es pura conversión, así que se puede probar sin base ni red.
 *
 * De lo viejo se sigue honrando el banco (es el destino real de los reintegros) y el
 * "acepto la cuota"; se ignoran la tarjeta y el medio de pago, que describen algo
 * que ya no existe.
 */
export function leerBodyAlta(raw: unknown): { body: BodyAlta; banco?: Partial<BancoAlta> } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.mascotas)) return { body: r as unknown as BodyAlta };

  // Forma vieja: una mascota, la declaración aparte y el plan siempre presente.
  const pet = r.pet as MascotaAlta | undefined;
  if (pet && typeof pet === 'object') {
    const decl = (r.declaracion ?? {}) as { health?: Record<number, string>; sanit?: Record<number, string>; firma?: string };
    const pago = (r.pago ?? {}) as { aceptaCuota?: boolean; banco?: Partial<BancoAlta> };
    return {
      body: {
        socio: r.socio as SocioAlta,
        mascotas: [{ ...pet, salud: decl.health ?? {}, sanit: decl.sanit ?? {} }],
        /*
         * En la forma vieja el plan era obligatorio, así que un vacío es un pedido
         * roto y NO un alta gratuita: se deja pasar tal cual para que el chequeo del
         * servidor lo rechace con 400. Convertirlo a `null` acá daría de alta socios
         * gratuitos por accidente desde apps viejas.
         */
        plan: (typeof r.plan === 'string' && r.plan.length > 0 ? r.plan : undefined) as string,
        odonto: r.odonto === true,
        firma: decl.firma ?? '',
        aceptaCuota: pago.aceptaCuota === true,
      },
      banco: pago.banco,
    };
  }

  return null;
}

/**
 * Mete la identidad de Google en el borrador, si todavía no está.
 *
 * Hace falta porque el formulario se monta ANTES de saber quién entró: en la web
 * vive siempre en el árbol de la landing (se muestra u oculta con una prop), así que
 * su estado inicial se arma cuando la identidad de Google todavía es null, y el
 * inicializador de `useState` no vuelve a correr nunca. Resultado: la persona
 * llegaba a los pasos con el nombre y el mail vacíos, justo los dos datos que
 * Google ya había dado.
 *
 * Solo completa lo que está vacío: si la persona ya tipeó algo, gana lo tipeado.
 * Y devuelve el mismo objeto cuando no hay nada que cambiar, para que un efecto que
 * la llame no se dispare a sí mismo en un bucle.
 */
export function conIdentidad(b: BorradorAlta, identidad?: { nombre: string; email: string } | null): BorradorAlta {
  if (!identidad) return b;
  const nombre = b.socio.nombre.trim() ? b.socio.nombre : (identidad.nombre ?? '');
  const email = b.socio.email.trim() ? b.socio.email : (identidad.email ?? '');
  if (nombre === b.socio.nombre && email === b.socio.email) return b;
  return { ...b, socio: { ...b.socio, nombre, email } };
}

/**
 * Lo que la persona ya eligió en la web pública, metido en el borrador del alta.
 *
 * La landing pide el nombre de la mascota y la especie en el hero, y ofrece "Elegir
 * FAMILIA" en las tarjetas de planes. Los tres datos se perdían al abrir el
 * formulario: la persona tipeaba el nombre de su perro, tocaba Continuar y el paso 1
 * aparecía vacío. Preguntar dos veces lo mismo es la forma más rápida de que alguien
 * abandone un alta de cinco pasos.
 *
 * Igual que `conIdentidad`, solo completa lo que está vacío —lo tipeado siempre
 * gana— y devuelve el mismo objeto cuando no hay nada que cambiar, para que un
 * efecto que la llame no se dispare a sí mismo. Hace falta que sea un efecto y no el
 * estado inicial porque el formulario se monta ANTES: en la web vive siempre en el
 * árbol de la landing y su `useState` corrió cuando el hero todavía estaba vacío.
 */
export function conArranque(
  b: BorradorAlta,
  arranque?: { mascota?: string; especie?: string; plan?: string } | null,
): BorradorAlta {
  if (!arranque) return b;
  const primera = b.mascotas[0];
  const nombre = primera && !primera.datos.nombre.trim() && arranque.mascota?.trim()
    ? arranque.mascota.trim()
    : null;
  const especie = primera && arranque.especie && primera.datos.especie !== arranque.especie
    && !primera.datos.nombre.trim()
    ? arranque.especie
    : null;
  const plan = !b.eleccion && arranque.plan ? arranque.plan : null;
  if (!nombre && !especie && !plan) return b;

  return {
    ...b,
    mascotas: nombre || especie
      ? b.mascotas.map((m, i) => (i === 0
        ? { ...m, datos: { ...m.datos, ...(nombre ? { nombre } : {}), ...(especie ? { especie } : {}) } }
        : m))
      : b.mascotas,
    // `aceptaCuota` en true por lo mismo que al elegir el plan adentro del alta: la
    // aceptación es el botón del último paso, con las condiciones al lado.
    eleccion: plan ? { modo: 'pago', plan, aceptaCuota: true } : b.eleccion,
  };
}
