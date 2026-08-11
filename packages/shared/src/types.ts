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

export type Vaccination = {
  id: string;
  petId: string;
  name: string;
  status: VaccineStatus;
  appliedOn: string | null; // ISO date
  dueOn: string | null; // ISO date
  nextOn: string | null; // ISO date
};

export type Member = {
  id: string;
  memberNo: number; // #10428
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  dni: string | null;
  birthDate: string | null; // ISO date
  planId: string;
  status: 'activo' | 'moroso' | 'baja';
  joinedOn: string; // ISO date
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

export type ProviderCategory =
  | 'Paseador'
  | 'Guardería'
  | 'Adiestrador'
  | 'Baño y estética'
  | 'Cuidador'
  | 'Veterinaria'
  | 'Otros';

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
  photoUrl: string | null;
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
