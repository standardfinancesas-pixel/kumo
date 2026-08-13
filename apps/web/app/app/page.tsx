import { redirect } from 'next/navigation';
import { urls, diaISO, diasHasta, providerBadge, tarjetaLabel, type NotifInput, type VaccineKind, type Review } from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import AppClient, { type PlanVM, type Profile, type Pet, type Vac, type Reint, type EmergencyContact, type ProviderVM, type BenefitVM, type ForumPost, type MiNegocio } from './AppClient';

/** Landing: ahí está el login si no hay sesión. */
const LANDING = urls.landing;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDate(iso: string | null): string {
  if (!iso) return 'a definir';
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
/** Ojo: esto corre en el servidor (Vercel, en UTC), así que el "hoy" tiene que
 *  venir del calendario argentino y no del reloj de la máquina. */
function daysUntil(iso: string | null): number | null {
  return iso ? diasHasta(iso) : null;
}

type VaccinationRow = { id: string; name: string; kind: VaccineKind; status: string; applied_on: string | null; due_on: string | null };
function mapVac(v: VaccinationRow): Vac {
  const base = { id: v.id, name: v.name, kind: v.kind ?? 'Vacuna', appliedOn: v.applied_on, dueOn: v.due_on };
  if (v.status === 'aplicada') {
    return { ...base, sub: `Aplicada ${fmtDate(v.applied_on)}`, status: 'Al día ✓', tone: 'green' };
  }
  const days = daysUntil(v.due_on);
  const near = days !== null && days <= 3;
  return {
    ...base,
    sub: `Próxima: ${fmtDate(v.due_on)}`,
    status: days === null ? 'Pendiente' : days < 0 ? 'Vencida' : `En ${days} día${days === 1 ? '' : 's'}`,
    tone: near ? 'lime' : 'amber',
    reminder: near ? '⏰ Recordatorio: aplicala pronto' : undefined,
    mark: true,
  };
}

/** En la base las fotos se guardan como nombre de archivo (seed) o URL de Storage. */
function imgSrc(photoUrl: string | null, fallback = 'default-pet.webp'): string {
  const v = photoUrl ?? fallback;
  return v.startsWith('http') ? v : `/img/${v}`;
}

type PetRow = { id: string; name: string; breed: string | null; age_years: number | null; weight_kg: number | null; microchip: string | null; neutered: boolean; photo_url: string | null; vaccinations: VaccinationRow[] };
function mapPet(row: PetRow, memberNo: number, planName: string): Pet {
  return {
    id: row.id,
    name: row.name,
    plan: planName,
    socio: `#${memberNo}`,
    photo: imgSrc(row.photo_url),
    breed: [row.breed ?? 'Mestizo', row.age_years != null ? `${row.age_years} años` : null, row.weight_kg != null ? `${row.weight_kg} kg` : null].filter(Boolean).join(' · '),
    microchip: row.microchip ?? 'Sin chip',
    castrado: row.neutered ? 'Sí' : 'No',
    odonto: 'No activo',
    vaccines: (row.vaccinations ?? []).map(mapVac),
  };
}

function relTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hs = Math.round(mins / 60);
  if (hs < 24) return `hace ${hs}h`;
  const days = Math.round(hs / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

/** Distancia aproximada al centro de CABA (no tenemos la ubicación real del socio). */
const CABA_LAT = -34.6037;
const CABA_LNG = -58.3816;
function haversineKm(lat: number, lng: number): number {
  const R = 6371;
  const dLat = ((lat - CABA_LAT) * Math.PI) / 180;
  const dLng = ((lng - CABA_LNG) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((CABA_LAT * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

type ProviderRow = { id: string; name: string; category: string; zone: string; address: string | null; phone: string | null; instagram: string | null; website: string | null; about: string; rating: number; reviews: number; price: number | null; price_unit: string | null; photo_url: string | null; lat: number | null; lng: number | null; status: string };
function mapProvider(row: ProviderRow): ProviderVM {
  const km = row.lat != null && row.lng != null ? haversineKm(row.lat, row.lng) : 5;
  return {
    id: row.id, name: row.name, category: row.category, zone: row.zone, address: row.address ?? '', phone: row.phone ?? '',
    instagram: row.instagram, website: row.website, about: row.about, rating: row.rating, reviews: row.reviews,
    price: row.price ?? 0, priceUnit: row.price_unit ?? '', photoUrl: imgSrc(row.photo_url), km,
    // El sello sale del estado que puso el admin, no del rating.
    verificado: row.status === 'verificado',
    badge: providerBadge(row.status, row.rating, row.reviews),
  };
}

function benefitIcon(category: string): BenefitVM['icon'] {
  const c = category.toLowerCase();
  if (/baño|estétic/.test(c)) return 'droplet';
  if (/aliment|accesorio|juguete/.test(c)) return 'store';
  if (/consulta|cirug/.test(c)) return 'cross';
  return 'tag';
}
type BenefitRow = { id: string; name: string; category: string; discount: string; description: string; zone: string; days: string[]; hours: string; valid_until: string | null; plan_requirement: string };
function mapBenefit(row: BenefitRow): BenefitVM {
  return {
    id: row.id, name: row.name, category: row.category, discount: row.discount, icon: benefitIcon(row.category),
    description: row.description ?? '', zone: row.zone ?? '', days: row.days ?? [], hours: row.hours ?? '',
    validUntil: row.valid_until, planRequirement: row.plan_requirement,
  };
}

type AnswerRow = { id: string; text: string; likes: number; best: boolean; created_at: string; author_name: string; author_id: string | null };
type PostRow = { id: string; category: string; title: string; body: string; photo_url: string | null; zone: string | null; replies: number; likes: number; created_at: string; author_name: string; author_id: string | null; community_answers: AnswerRow[] };
/** El nombre viene en la fila: el join a `profiles` devolvía null por la RLS y
 *  todos los autores salían como "Socio". */
function authorName(nombre: string | null): string {
  return nombre?.trim().split(' ')[0] || 'Socio';
}
function mapPost(row: PostRow, userId: string): ForumPost {
  return {
    id: row.id,
    cat: row.category,
    trend: row.likes >= 20,
    author: authorName(row.author_name),
    meta: `${row.zone ?? 'General'} · ${relTime(row.created_at)}`,
    title: row.title,
    body: row.body,
    photo: row.photo_url,
    replies: row.replies,
    likes: row.likes,
    propia: row.author_id === userId,
    answers: (row.community_answers ?? [])
      .slice()
      .sort((a, b) => (b.best ? 1 : 0) - (a.best ? 1 : 0) || Date.parse(a.created_at) - Date.parse(b.created_at))
      .map((a) => ({ id: a.id, author: authorName(a.author_name), when: relTime(a.created_at), text: a.text, likes: a.likes, best: a.best, propia: a.author_id === userId })),
  };
}

const REINT_STATUS: Record<string, Reint['status']> = { en_revision: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado', acreditado: 'Acreditado' };
type ReintRow = {
  id: string; provider_name: string; concept: string; amount: number; refund: number; refund_pct: number;
  status: string; requested_on: string; resolved_at: string | null; created_at: string; receipt_no: string | null; receipt_path: string | null;
  bank_holder: string | null; bank_holder_dni: string | null; bank_cuit: string | null;
  bank_name: string | null; bank_cbu: string | null; bank_alias: string | null;
  pets: { name: string } | { name: string }[] | null;
};
function mapReint(row: ReintRow): Reint {
  const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
  return {
    id: row.id,
    place: row.provider_name,
    concept: row.concept,
    detail: `${row.concept} · ${fmtDate(row.requested_on)}`,
    fecha: fmtDate(row.requested_on),
    spent: row.amount,
    refund: row.refund,
    refundPct: row.refund_pct,
    status: REINT_STATUS[row.status] ?? 'En revisión',
    statusRaw: row.status,
    requestedOn: row.requested_on,
    resueltoEl: row.resolved_at ? fmtDate(diaISO(row.resolved_at)) : '',
    pet: pet?.name ?? '—',
    receiptNo: row.receipt_no,
    receiptPath: row.receipt_path,
    bank: {
      holder: row.bank_holder, dni: row.bank_holder_dni, cuit: row.bank_cuit,
      name: row.bank_name, cbu: row.bank_cbu, alias: row.bank_alias,
    },
  };
}

export default async function Page() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(LANDING);

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('member_no, full_name, email, phone, address, city, province, dni, addon_odonto, monthly_fee_agreed, bank_holder, bank_cuit, bank_cbu, bank_alias, card_brand, card_last4, plans(name, base_price)')
    .eq('id', auth.user.id)
    .single();
  if (!profileRow) redirect(LANDING);

  const plan = Array.isArray(profileRow.plans) ? profileRow.plans[0] : profileRow.plans;
  const profile: Profile = {
    id: auth.user.id,
    firstName: profileRow.full_name.split(' ')[0] ?? profileRow.full_name,
    fullName: profileRow.full_name,
    memberNo: profileRow.member_no,
    planName: plan?.name ?? '—',
    // La cuota que aceptó al firmar, no el precio de lista: con la cobertura
    // odontológica paga $12.000 más y antes acá se mostraba de menos.
    planPrice: profileRow.monthly_fee_agreed ?? plan?.base_price ?? 0,
    addonOdonto: profileRow.addon_odonto ?? false,
    email: profileRow.email,
    phone: profileRow.phone,
    address: profileRow.address,
    city: profileRow.city,
    province: profileRow.province,
    dni: profileRow.dni,
    banco: {
      holder: profileRow.bank_holder,
      cuit: profileRow.bank_cuit,
      cbu: profileRow.bank_cbu,
      alias: profileRow.bank_alias,
    },
    tarjeta: tarjetaLabel(profileRow.card_brand, profileRow.card_last4),
  };

  const { data: petsRows } = await supabase
    .from('pets')
    .select('id, name, breed, age_years, weight_kg, microchip, neutered, photo_url, vaccinations(id, name, kind, status, applied_on, due_on)')
    .eq('owner_id', auth.user.id);
  const pets: Pet[] = (petsRows ?? []).map((r) => mapPet(r as PetRow, profile.memberNo, profile.planName));

  const { data: reintRows } = await supabase
    .from('reimbursements')
    .select('id, provider_name, concept, amount, refund, refund_pct, status, requested_on, resolved_at, created_at, receipt_no, receipt_path, bank_holder, bank_holder_dni, bank_cuit, bank_name, bank_cbu, bank_alias, pets(name)')
    .eq('member_id', auth.user.id)
    .order('requested_on', { ascending: false });
  const reintegros: Reint[] = (reintRows ?? []).map((r) => mapReint(r as ReintRow));

  const { data: contactRows } = await supabase
    .from('emergency_contacts')
    .select('id, name, phone, type, address, hours')
    .eq('owner_id', auth.user.id);
  const contacts: EmergencyContact[] = (contactRows ?? []).map((c) => ({ ...c, address: c.address ?? '', hours: c.hours ?? '' }));

  const { data: providerRows } = await supabase
    .from('providers')
    .select('id, name, category, zone, address, phone, instagram, website, about, rating, reviews, price, price_unit, photo_url, lat, lng, status')
    .eq('status', 'verificado');
  const providers: ProviderVM[] = (providerRows ?? []).map((r) => mapProvider(r as ProviderRow));

  // Reseñas de los prestadores publicados, más nuevas primero.
  const { data: reviewRows } = await supabase
    .from('provider_reviews')
    .select('id, provider_id, member_id, rating, text, author_name, created_at')
    .order('created_at', { ascending: false });
  const reviews: Record<string, Review[]> = {};
  for (const r of reviewRows ?? []) {
    (reviews[r.provider_id] ??= []).push({
      id: r.id, author: r.author_name, rating: r.rating, text: r.text,
      createdAt: r.created_at, propia: r.member_id === auth.user.id,
    });
  }

  // El negocio propio del socio, si dio de alta uno. Va aparte de `providers`
  // porque ese listado solo trae los verificados y acá interesa verlo aunque
  // esté pendiente o lo hayan rechazado.
  const { data: negocioRow } = await supabase
    .from('providers')
    .select('id, name, category, zone, phone, about, status, rating, reviews, created_at, price, price_unit, instagram, website')
    .eq('owner_id', auth.user.id)
    .maybeSingle();
  const negocio: MiNegocio | null = negocioRow
    ? {
        id: negocioRow.id, name: negocioRow.name, category: negocioRow.category, zone: negocioRow.zone,
        phone: negocioRow.phone, about: negocioRow.about, status: negocioRow.status,
        rating: negocioRow.rating, reviews: negocioRow.reviews,
        price: negocioRow.price, priceUnit: negocioRow.price_unit, instagram: negocioRow.instagram, website: negocioRow.website,
      }
    : null;

  const { data: benefitRows } = await supabase.from('benefits').select('id, name, category, discount, description, zone, days, hours, valid_until, plan_requirement').eq('status', 'activo');
  const benefits: BenefitVM[] = (benefitRows ?? []).map((r) => mapBenefit(r as BenefitRow));

  const { data: postRows } = await supabase
    .from('community_posts')
    .select('id, category, title, body, photo_url, zone, replies, likes, created_at, author_name, author_id, community_answers(id, text, likes, best, created_at, author_name, author_id)')
    .order('created_at', { ascending: false });
  const posts: ForumPost[] = (postRows ?? []).map((r) => mapPost(r as unknown as PostRow, auth.user.id));

  // Qué likeó el socio, para pintar el corazón lleno y no dejarlo likear dos veces.
  const [{ data: postLikeRows }, { data: ansLikeRows }] = await Promise.all([
    supabase.from('post_likes').select('post_id').eq('member_id', auth.user.id),
    supabase.from('answer_likes').select('answer_id').eq('member_id', auth.user.id),
  ]);
  const misLikes = {
    posts: (postLikeRows ?? []).map((l) => l.post_id),
    answers: (ansLikeRows ?? []).map((l) => l.answer_id),
  };

  // Las notificaciones se derivan de estas mismas filas (no hay tabla propia).
  // Se manda la materia prima y no la lista armada: los textos de tiempo
  // ("Hace 2 h") se calculan en el cliente, donde se ven.
  const notifInput: NotifInput = {
    pets: (petsRows ?? []).map((p) => ({
      name: p.name,
      vaccines: ((p.vaccinations ?? []) as VaccinationRow[]).map((v) => ({ id: v.id, name: v.name, status: v.status, dueOn: v.due_on })),
    })),
    reintegros: ((reintRows ?? []) as ReintRow[]).map((r) => ({
      id: r.id, providerName: r.provider_name, refund: r.refund, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at,
    })),
    negocio: negocioRow ? { name: negocioRow.name, status: negocioRow.status, createdAt: negocioRow.created_at } : null,
  };

  const { data: favRows } = await supabase.from('provider_favorites').select('provider_id').eq('member_id', auth.user.id);
  const guardados: string[] = (favRows ?? []).map((f) => f.provider_id);

  const { data: planRows } = await supabase.from('plans').select('id, name, base_price, tagline').order('base_price');
  const planes: PlanVM[] = (planRows ?? []).map((p) => ({ id: p.id, name: p.name, price: p.base_price, tagline: p.tagline }));

  return <AppClient profile={profile} pets={pets} reintegros={reintegros} contacts={contacts} providers={providers} benefits={benefits} posts={posts} negocio={negocio} notifInput={notifInput} guardados={guardados} reviews={reviews} misLikes={misLikes} planes={planes} />;
}
