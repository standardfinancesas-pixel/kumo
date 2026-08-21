/**
 * Kumo · Tipos del dominio
 * Modelo derivado del prototipo. Alineado 1:1 con las tablas de
 * supabase/schema.sql. Ajustar en conjunto cuando cambie el schema.
 */

export type PlanName = 'AMIGO' | 'FAMILIA' | 'VIP';

export type UserRole = 'socio' | 'prestador' | 'admin';

export type Plan = {
  id: string;
  name: PlanName;
  basePrice: number; // ARS / mes, IVA incluido
  tagline: string;
  perks: string[];
  featured?: boolean;
};

export type PetType = 'perro' | 'gato' | 'otro';

export type PetSex = 'macho' | 'hembra';

export type Pet = {
  id: string;
  ownerId: string;
  name: string;
  type: PetType;
  breed: string | null;
  ageYears: number | null;
  weightKg: number | null;
  microchip: string | null;
  neutered: boolean;
  sex: PetSex | null;
  vetName: string | null;
  photoUrl: string | null;
};

export type VaccineStatus = 'aplicada' | 'pendiente' | 'vencida';

export type VaccineKind = 'Vacuna' | 'Estudio' | 'Antiparasitario';

export type Vaccination = {
  id: string;
  petId: string;
  name: string;
  kind: VaccineKind;
  status: VaccineStatus;
  appliedOn: string | null; // ISO date
  dueOn: string | null; // ISO date
  nextOn: string | null; // ISO date
};

import type { TarjetaMeta } from './pagos';

export type Member = {
  id: string;
  memberNo: number; // #10428
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null; // calle y número
  city: string | null;
  province: string | null;
  dni: string | null;
  birthDate: string | null; // ISO date
  planId: string;
  /** La relación con el club, no la cuota: para la cuota está `paidUntil`. */
  status: 'activo' | 'suspendido' | 'baja';
  joinedOn: string; // ISO date
  // Lo contratado y aceptado en el alta. `monthlyFeeAgreed` es la cuota que
  // firmó, no la de hoy: el precio del plan cambia.
  addonOdonto: boolean;
  monthlyFeeAgreed: number | null;
  payMethod: 'tarjeta' | 'cbu' | null;
  contractAcceptedAt: string | null; // ISO timestamp
  /** Club → socio: a dónde se le transfiere el reintegro (la transferencia la
   *  hace el club a mano). Es el mismo `BankDetails` de la solicitud. */
  bank: BankDetails | null;
  /** Socio → club: con qué se le cobra la cuota. Solo metadata — el número
   *  completo y el CVV no se guardan (PCI DSS). */
  card: TarjetaMeta | null;
  /** Hasta cuándo tiene la cuota paga (ISO date). Null = nunca pagó. Si es menor
   *  a hoy, la webapp le pone el muro de la cuota y no ve nada hasta pagar. La
   *  escribe únicamente `acreditar_pago()` en la base. */
  paidUntil: string | null;
};

/**
 * Una cuota. Hay una fila por INTENTO, no por mes: los rechazados y los
 * abandonados quedan, porque son lo que explica por qué un socio no entró.
 *
 * `coversUntil` es hasta dónde llevó la cuota este pago, y se decide al
 * acreditar y no al crear: un pago que aprueba tarde —una transferencia, un
 * Rapipago— no puede acreditar un mes que ya venció.
 */
export type Payment = {
  id: string;
  memberId: string;
  planId: string | null;
  planName: string | null;
  amount: number;
  status: 'pendiente' | 'aprobado' | 'rechazado' | 'devuelto';
  method: 'mercadopago' | 'manual';
  coversUntil: string | null;
  /** Lo que viaja a Mercado Pago y vuelve en el aviso: es la llave para cruzar el
   *  aviso con la fila. */
  externalReference: string | null;
  mpPreferenceId: string | null;
  mpPaymentId: string | null;
  initPoint: string | null;
  /** Quién lo registró, si el club lo cobró por fuera (efectivo, transferencia). */
  registeredBy: string | null;
  detail: string | null;
  createdAt: string;
  paidAt: string | null;
};

/**
 * Declaración jurada de salud firmada en el alta. Inmutable: se inserta y se
 * lee, nunca se edita (ver las políticas de `health_declarations`).
 */
export type HealthDeclaration = {
  id: string;
  memberId: string;
  petId: string | null;
  petName: string;
  version: number;
  answers: { pregunta: string; respuesta: 'Sí' | 'No' }[];
  sanitary: { pregunta: string; respuesta: 'Sí' | 'No' }[];
  signature: string;
  signedAt: string; // ISO timestamp
};

export type ReimbursementStatus = 'en_revision' | 'aprobado' | 'rechazado' | 'acreditado';

export type BankDetails = {
  holder: string;
  holderDni: string;
  cuit: string;
  bank: string;
  cbu: string;
  alias: string;
};

export type Reimbursement = {
  id: string;
  memberId: string;
  petId: string;
  planName: PlanName;
  providerName: string; // veterinaria / comercio
  concept: string;
  amount: number;
  refund: number;
  refundPct: number;
  status: ReimbursementStatus;
  requestedOn: string; // ISO date
  receiptNo: string | null;
  /** Path en el bucket privado 'receipts'. Se lee con URL firmada. */
  receiptPath: string | null;
  bank: BankDetails;
  flag: string | null; // ej: "Revisar tope"
};

/**
 * Los rubros de un prestador, que es lo mismo que decir de un negocio: un paseador
 * y una veterinaria van a la misma tabla y a la misma sección Servicios.
 *
 * Vive acá y no en cada pantalla porque estaba escrito dos veces —webapp y app— y
 * las dos listas tenían CINCO de los siete que el tipo ya contemplaba: Veterinaria y
 * Otros existían en el tipo y no se podían elegir en ninguna parte, así que un
 * comercio que no fuera uno de los cinco no tenía dónde encajar.
 *
 * El tipo se deriva de la lista: agregar un rubro es una línea y no se pueden
 * desincronizar. En la base `category` es texto libre, así que no hace falta
 * migración para sumar uno.
 */
export const RUBROS = ['Paseador', 'Guardería', 'Adiestrador', 'Baño y estética', 'Cuidador', 'Veterinaria', 'Otros'] as const;
export type ProviderCategory = (typeof RUBROS)[number];

export type ProviderStatus = 'pendiente' | 'verificado' | 'rechazado';

export type Provider = {
  id: string;
  name: string;
  category: ProviderCategory;
  zone: string;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  about: string;
  rating: number;
  reviews: number;
  price: number | null;
  priceUnit: string | null;
  status: ProviderStatus;
  /** La foto de portada: la banda de arriba de la ficha. */
  photoUrl: string | null;
  /** El logo de la marca, cuadrado: el avatar. Null = no subio, se usa la portada. */
  logoUrl: string | null;
  /** Ubicación para Google Maps */
  lat: number | null;
  lng: number | null;
};

export type BenefitStatus = 'activo' | 'pausado';

export type Benefit = {
  id: string;
  name: string;
  category: string;
  discount: string; // "-25%"
  planRequirement: string;
  status: BenefitStatus;
  description: string;
  validUntil: string | null;
  zone: string;
  days: string[]; // ['L','M','X','J','V']
  hours: string;
};

export type CommunityAnswer = {
  author: string;
  when: string;
  text: string;
  likes: number;
  best: boolean;
};

export type CommunityPost = {
  id: string;
  category: string;
  author: string;
  zone: string | null;
  createdMeta: string; // "Palermo · hace 2h"
  title: string;
  body: string;
  replies: number;
  likes: number;
  answers: CommunityAnswer[];
};

export type PushAudience = 'todos' | 'plan_amigo' | 'plan_familia' | 'plan_vip' | 'morosos';

export type PushNotification = {
  id: string;
  title: string;
  body: string;
  audience: PushAudience;
  sentAt: string | null;
};

export type Faq = { id: string; question: string; answer: string; order: number };

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  type: string;
  address: string;
  hours: string;
};

export type ClubSettings = {
  whatsapp: string;
  email: string;
};
