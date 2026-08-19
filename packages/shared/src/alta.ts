import { HEALTH_Q, SANITARIO_Q } from './declaracion';
import { cbuValido, tarjetaMeta, type TarjetaMeta } from './pagos';

/**
 * El alta de socio, en la parte que tiene que valer igual en la web y en la app.
 *
 * Antes vivía entera dentro del formulario web (`apps/web/components/Onboarding.tsx`):
 * las provincias, los formateadores y —lo importante— la regla de "este paso está
 * completo". Al portar el alta al celular eso habría quedado escrito dos veces, y
 * el primer síntoma no habría sido una pantalla distinta sino un socio guardado
 * con datos que una superficie acepta y la otra no.
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

/** A dónde el club transfiere los reintegros. A una tarjeta no se le puede
 *  transferir, así que esto no es un lujo: sin CBU no se le puede pagar. */
export type BancoAlta = {
  holder: string; holderDni: string; cuit: string; bank: string; cbu: string; alias: string;
};

export type DeclaracionAlta = {
  health: Record<number, string>;
  sanit: Record<number, string>;
  firma: string;
  /** Solo del formulario: el servidor arma la declaración con su propia lista. */
  acepta: boolean;
};

export type PagoAlta = {
  metodo: 'tarjeta' | 'cbu';
  numero: string; exp: string; cvv: string; titular: string;
  banco: BancoAlta;
  aceptaCuota: boolean;
};

export type BorradorAlta = {
  socio: SocioAlta;
  pet: MascotaAlta;
  plan: string | null;
  odonto: boolean;
  declaracion: DeclaracionAlta;
  pago: PagoAlta;
};

/** El cuerpo que espera `POST /api/onboarding`. Lo importa el route handler para
 *  no volver a declararlo: dos copias del mismo contrato divergen solas. */
export type BodyAlta = {
  socio: SocioAlta;
  pet: MascotaAlta;
  plan: string;
  odonto?: boolean;
  declaracion?: { health: Record<number, string>; sanit: Record<number, string>; firma: string };
  pago?: {
    metodo?: string;
    aceptaCuota?: boolean;
    banco?: Partial<BancoAlta>;
    tarjeta?: TarjetaMeta | null;
  };
};

/** Un borrador en blanco, para arrancar el formulario. */
export function borradorVacio(inicial?: { nombre?: string; email?: string; mascota?: string; especie?: string }): BorradorAlta {
  return {
    socio: {
      nombre: inicial?.nombre ?? '', dni: '', fnac: '', domicilio: '', localidad: '',
      provincia: '', tel: '', email: inicial?.email ?? '', password: '',
    },
    pet: {
      nombre: inicial?.mascota ?? '', especie: inicial?.especie === 'gato' ? 'Gato' : 'Perro',
      sexo: 'Macho', castrado: 'Sí', raza: '', edad: '', peso: '', microchip: '', vet: '', foto: '',
    },
    plan: null,
    odonto: false,
    declaracion: { health: {}, sanit: {}, firma: '', acepta: false },
    pago: {
      metodo: 'tarjeta', numero: '', exp: '', cvv: '', titular: '',
      banco: { holder: '', holderDni: '', cuit: '', bank: '', cbu: '', alias: '' },
      aceptaCuota: false,
    },
  };
}

/* ── Las reglas ────────────────────────────────────────────────────── */

export type ValidacionSocio = {
  nombre: boolean; dni: boolean; fnac: boolean; tel: boolean; email: boolean;
  password: boolean; ok: boolean;
};

/** Campo por campo, para poder marcar en rojo el que falla y no solo bloquear el
 *  botón: un formulario de 9 campos que no dice cuál está mal es una trampa. */
export function validarSocio(socio: SocioAlta, conGoogle = false): ValidacionSocio {
  const nombre = socio.nombre.trim().length > 1 && !socio.nombre.includes('@');
  const dni = /^\d{7,8}$/.test(socio.dni.replace(/\D/g, ''));
  const fnac = /^\d{2}\/\d{2}\/\d{4}$/.test(socio.fnac);
  const tel = socio.tel.replace(/\D/g, '').length === 10;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(socio.email);
  // Con Google no hay contraseña que validar: la identidad ya está resuelta.
  const password = conGoogle || socio.password.length >= 6;
  return {
    nombre, dni, fnac, tel, email, password,
    ok: nombre && dni && fnac && tel && email && password
      && socio.domicilio.trim().length > 0
      && socio.localidad.trim().length > 0
      && socio.provincia.length > 0,
  };
}

/** Todas contestadas y firmada. El enunciado no se valida acá porque no lo manda
 *  el cliente: el servidor lo arma con `HEALTH_Q`/`SANITARIO_Q`. */
export function declaracionCompleta(d: DeclaracionAlta): boolean {
  return Object.keys(d.health).length === HEALTH_Q.length
    && Object.keys(d.sanit).length === SANITARIO_Q.length
    && d.firma.trim().length > 2
    && d.acepta;
}

/**
 * El medio de pago, validando SOLO la rama elegida.
 *
 * Acá estaba el bug que hacía imposible el alta por CBU: el formulario web
 * validaba siempre los campos de la tarjeta, así que quien elegía CBU veía
 * desaparecer esos campos y el botón "Confirmar y unirme" quedaba bloqueado para
 * siempre, sin ningún cartel. El club perdía esas altas sin enterarse.
 */
export function pagoOk(pago: PagoAlta): boolean {
  if (!pago.aceptaCuota) return false;
  if (pago.metodo === 'cbu') {
    return cbuValido(pago.banco.cbu) && pago.banco.holder.trim().length > 1;
  }
  return pago.numero.replace(/\D/g, '').length >= 13
    && pago.exp.trim().length >= 4
    && pago.cvv.trim().length >= 3;
}

/** ¿Se puede pasar al paso siguiente? Una sola definición para las dos
 *  superficies: es lo que evita que un arreglo entre en una y no en la otra. */
export function pasoOk(paso: number, b: BorradorAlta, conGoogle = false): boolean {
  switch (paso) {
    case 1: return b.pet.nombre.trim().length > 0;
    case 2: return validarSocio(b.socio, conGoogle).ok;
    case 3: return !!b.plan;
    case 4: return declaracionCompleta(b.declaracion);
    case 5: return pagoOk(b.pago);
    default: return true;
  }
}

/**
 * El borrador convertido en el cuerpo del pedido.
 *
 * De la tarjeta viajan solo la marca, los últimos 4 y el vencimiento, calculados
 * en el cliente: si el número completo llegara al servidor lo metería en el
 * alcance de PCI DSS aunque no se guarde. El CVV no sale del formulario.
 *
 * `acepta` se queda afuera: es la tilde del formulario, no parte de la
 * declaración que se guarda firmada.
 */
export function payloadAlta(b: BorradorAlta): BodyAlta {
  return {
    socio: b.socio,
    pet: b.pet,
    plan: b.plan ?? '',
    odonto: b.odonto,
    declaracion: { health: b.declaracion.health, sanit: b.declaracion.sanit, firma: b.declaracion.firma },
    pago: {
      metodo: b.pago.metodo,
      aceptaCuota: b.pago.aceptaCuota,
      banco: b.pago.banco,
      tarjeta: b.pago.metodo === 'tarjeta'
        ? tarjetaMeta({ numero: b.pago.numero, exp: b.pago.exp, holder: b.pago.titular })
        : null,
    },
  };
}
