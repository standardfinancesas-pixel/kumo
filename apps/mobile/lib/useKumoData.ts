import { useCallback, useEffect, useState } from 'react';
import { diasHasta, type NotifInput, type VaccineKind } from '@kumo/shared';
import { supabase } from './supabase';

/* ── Formas que consumen las pantallas ─────────────────────────── */
/** `appliedOn`/`dueOn` van crudas además de formateadas en `sub`: el calendario las necesita para ubicar el día. */
export type Vac = { id: string; name: string; kind: VaccineKind; sub: string; status: string; tone: 'green' | 'lime' | 'amber'; appliedOn: string | null; dueOn: string | null; mark: boolean; remind: boolean };
export type Pet = {
  id: string; name: string; species: string; plan: string; socio: string; photo: string;
  breed: string; age: string; microchip: string; castrado: string; odonto: string; next: string; vaccines: Vac[];
};
export type Profile = {
  id: string; firstName: string; fullName: string; memberNo: string; planName: string; planPrice: number;
  email: string; phone: string; address: string; dni: string;
};
export type ProviderVM = {
  id: string; name: string; category: string; zone: string; km: number; badge?: string;
  rating: number; reviews: number; price: number; priceUnit: string; phone: string; photo: string;
};
export type BenefitVM = { id: string; name: string; cat: string; disc: string; icon: 'hospital' | 'store' | 'pill' | 'droplet' };
export type ReintVM = { id: string; place: string; det: string; spent: number; refund: number; estado: string };
export type ForumPost = { id: string; cat: string; author: string; title: string; replies: number; likes: number };

export type KumoData = {
  profile: Profile | null;
  pets: Pet[];
  providers: ProviderVM[];
  benefits: BenefitVM[];
  reintegros: ReintVM[];
  reintTotal: number;
  posts: ForumPost[];
  /** El negocio propio, si dio de alta uno. Puede estar pendiente o rechazado, así que no sale del listado de verificados. */
  negocio: MiNegocio | null;
  /** Materia prima de las notificaciones: la lista la arma `buildNotifs` de @kumo/shared, igual que la webapp. */
  notifInput: NotifInput;
};

export type MiNegocio = { id: string; name: string; category: string; zone: string; phone: string | null; status: string; rating: number; reviews: number };

/* ── Helpers de formato ────────────────────────────────────────── */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const asDate = (iso: string) => new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = asDate(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtShort(iso: string | null): string {
  if (!iso) return '—';
  const d = asDate(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
}
const daysUntil = (iso: string | null): number | null => (iso ? diasHasta(iso) : null);
function relTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${Math.max(mins, 1)} min`;
  const hs = Math.round(mins / 60);
  if (hs < 24) return `hace ${hs}h`;
  const days = Math.round(hs / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

/* Distancia real desde un punto de referencia en CABA (no hay geolocalización todavía). */
const CABA_LAT = -34.6037, CABA_LNG = -58.3816;
function haversineKm(lat: number | null, lng: number | null): number {
  if (lat == null || lng == null) return 0;
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat - CABA_LAT), dLng = toRad(lng - CABA_LNG);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(CABA_LAT)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

const PET_FALLBACK = ['happy-dog.webp', 'plan-cat.webp'];
const PROVIDER_FALLBACK = 'prestador-walker.webp';

function benefitIcon(category: string): BenefitVM['icon'] {
  const c = category.toLowerCase();
  if (c.includes('baño') || c.includes('estética')) return 'droplet';
  if (c.includes('medicamento') || c.includes('pipeta')) return 'pill';
  if (c.includes('aliment') || c.includes('accesorio') || c.includes('juguete')) return 'store';
  return 'hospital';
}

const ESTADO_REINT: Record<string, string> = {
  en_revision: 'En revisión', acreditado: 'Acreditado', rechazado: 'Rechazado', pendiente: 'Pendiente',
};

type VacRow = { id: string; name: string; kind: VaccineKind; applied_on: string | null; due_on: string | null; status: string };
function mapVac(v: VacRow): Vac {
  const d = daysUntil(v.due_on);
  const base = { id: v.id, name: v.name, kind: v.kind ?? 'Vacuna', appliedOn: v.applied_on, dueOn: v.due_on };
  if (v.status === 'aplicada' || v.due_on == null) {
    return { ...base, sub: `Aplicada ${fmtDate(v.applied_on)}`, status: 'Al día ✓', tone: 'green', mark: false, remind: false };
  }
  const label = d == null ? '—' : d < 0 ? 'Vencida' : d === 0 ? 'Hoy' : `En ${d} días`;
  const tone: Vac['tone'] = d != null && d <= 7 ? 'lime' : 'amber';
  return { ...base, sub: `Próxima: ${fmtDate(v.due_on)}`, status: label, tone, mark: true, remind: tone === 'lime' };
}

/* ── Hook ──────────────────────────────────────────────────────── */
export function useKumoData(userId: string | null) {
  const [data, setData] = useState<KumoData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setData(null); setLoading(false); return; }

    const [profileRes, petsRes, reintRes, provRes, benefRes, postsRes, negocioRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, member_no, email, phone, address, dni, plans(name, base_price)').eq('id', userId).single(),
      supabase.from('pets').select('id, name, type, breed, age_years, weight_kg, microchip, neutered, photo_url, vaccinations(id, name, kind, status, applied_on, due_on)').eq('owner_id', userId),
      supabase.from('reimbursements').select('id, provider_name, concept, amount, refund, status, requested_on, created_at').eq('member_id', userId).order('requested_on', { ascending: false }),
      supabase.from('providers').select('id, name, category, zone, rating, reviews, price, price_unit, phone, photo_url, lat, lng').eq('status', 'verificado'),
      supabase.from('benefits').select('id, name, category, discount').eq('status', 'activo'),
      supabase.from('community_posts').select('id, category, title, replies, likes, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(20),
      supabase.from('providers').select('id, name, category, zone, phone, status, rating, reviews, created_at').eq('owner_id', userId).maybeSingle(),
    ]);

    const p = profileRes.data;
    const plan = p ? (Array.isArray(p.plans) ? p.plans[0] : p.plans) : null;
    const planName = plan?.name ?? '—';
    const memberNo = p ? `#${p.member_no}` : '—';

    const profile: Profile | null = p ? {
      id: p.id, firstName: p.full_name.split(' ')[0] ?? p.full_name, fullName: p.full_name, memberNo,
      planName, planPrice: plan?.base_price ?? 0, email: p.email, phone: p.phone ?? '—',
      address: p.address ?? '—', dni: p.dni ?? '—',
    } : null;

    const pets: Pet[] = (petsRes.data ?? []).map((row, i) => {
      const vacs = (row.vaccinations ?? []).map(mapVac);
      const upcoming = (row.vaccinations ?? [])
        .filter((v: VacRow) => v.due_on && v.status !== 'aplicada')
        .sort((a: VacRow, b: VacRow) => (a.due_on! < b.due_on! ? -1 : 1))[0];
      const breedParts = [
        row.breed ?? 'Mestizo',
        row.age_years != null ? `${row.age_years} años` : null,
        row.weight_kg != null ? `${row.weight_kg} kg` : null,
      ].filter(Boolean);
      const species = row.type === 'gato' ? 'Gato' : 'Perro';
      return {
        id: row.id, name: row.name, species, plan: planName, socio: memberNo,
        photo: row.photo_url ?? PET_FALLBACK[i % PET_FALLBACK.length]!,
        breed: breedParts.join(' · '),
        age: row.age_years != null ? `${species} · ${row.age_years} años` : species,
        microchip: row.microchip ?? '—',
        castrado: row.neutered ? 'Sí' : 'No',
        odonto: 'No activo',
        next: upcoming ? `Próxima: ${fmtShort(upcoming.due_on)}` : 'Todo al día',
        vaccines: vacs,
      };
    });

    const providers: ProviderVM[] = (provRes.data ?? []).map((r) => ({
      id: r.id, name: r.name, category: r.category, zone: r.zone,
      km: haversineKm(r.lat, r.lng), badge: r.rating >= 4.9 && r.reviews > 0 ? 'Top rated' : 'Verificado',
      rating: r.rating, reviews: r.reviews, price: r.price, priceUnit: r.price_unit,
      phone: r.phone ?? '', photo: r.photo_url ?? PROVIDER_FALLBACK,
    })).sort((a, b) => a.km - b.km);

    const benefits: BenefitVM[] = (benefRes.data ?? []).map((b) => ({
      id: b.id, name: b.name, cat: b.category, disc: b.discount, icon: benefitIcon(b.category),
    }));

    const reintegros: ReintVM[] = (reintRes.data ?? []).map((r) => ({
      id: r.id, place: r.provider_name, det: `${r.concept} · ${fmtDate(r.requested_on)}`,
      spent: r.amount, refund: r.refund, estado: ESTADO_REINT[r.status] ?? r.status,
    }));
    const reintTotal = (reintRes.data ?? []).filter((r) => r.status === 'acreditado').reduce((a, r) => a + r.refund, 0);

    const posts: ForumPost[] = (postsRes.data ?? []).map((row) => {
      const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id, cat: row.category, title: row.title,
        author: `${author?.full_name?.split(' ')[0] ?? 'Socio'} · ${relTime(row.created_at)}`,
        replies: row.replies, likes: row.likes,
      };
    });

    const n = negocioRes.data;
    const negocio: MiNegocio | null = n
      ? { id: n.id, name: n.name, category: n.category, zone: n.zone, phone: n.phone, status: n.status, rating: n.rating, reviews: n.reviews }
      : null;

    const notifInput: NotifInput = {
      pets: (petsRes.data ?? []).map((row) => ({
        name: row.name,
        vaccines: ((row.vaccinations ?? []) as VacRow[]).map((v) => ({ id: v.id, name: v.name, status: v.status, dueOn: v.due_on })),
      })),
      reintegros: (reintRes.data ?? []).map((r) => ({
        id: r.id, providerName: r.provider_name, refund: r.refund, status: r.status, createdAt: r.created_at,
      })),
      negocio: n ? { name: n.name, status: n.status, createdAt: n.created_at } : null,
    };

    setData({ profile, pets, providers, benefits, reintegros, reintTotal, posts, negocio, notifInput });
    setLoading(false);
  }, [userId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return { data, loading, reload: load };
}
