import { redirect } from 'next/navigation';
import { urls, mesActualISO } from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import AppClient, {
  type AdminProfile, type KpiVM, type DistRow, type SocioRow, type ColaRow, type HistRow,
  type BenefitAdminVM, type PlanAdminVM, type FaqVM, type SettingsVM, type ProviderAdminRow,
  type ReportRow, type AudienceVM, type SentPushVM,
} from './AppClient';

const LANDING = urls.landing;
const WEBAPP = urls.webapp;

const money = (n: number) => '$' + n.toLocaleString('es-AR');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtShort(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDay(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
}
function relTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hs = Math.round(mins / 60);
  if (hs < 24) return `hace ${hs}h`;
  const days = Math.round(hs / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}
const ESTADO_SOCIO: Record<string, string> = { activo: 'Al día', moroso: 'En mora', baja: 'Suspendido' };

export default async function Page() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(LANDING);

  const { data: myProfile } = await supabase.from('profiles').select('role, full_name').eq('id', auth.user.id).single();
  if (!myProfile || myProfile.role !== 'admin') redirect(WEBAPP);
  const profile: AdminProfile = { id: auth.user.id, fullName: myProfile.full_name };

  // ── Socios (para KPIs, distribución y la tabla) ──
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, member_no, full_name, status, joined_on, plans(name, base_price), pets(name)')
    .eq('role', 'socio');
  const socioList = profileRows ?? [];
  const planOf = (p: (typeof socioList)[number]) => (Array.isArray(p.plans) ? p.plans[0] : p.plans);

  const totalSocios = socioList.length;
  const activos = socioList.filter((s) => s.status === 'activo').length;
  const bajas = socioList.filter((s) => s.status === 'baja').length;
  // El mes arranca según el calendario argentino: acá corre en UTC, y el 1° antes
  // de las 21:00 de Buenos Aires el servidor todavía cree que es el mes anterior.
  const inicioDeMes = mesActualISO();
  const nuevosEsteMes = socioList.filter((s) => s.joined_on && s.joined_on >= inicioDeMes).length;
  const mrr = socioList.filter((s) => s.status === 'activo').reduce((acc, s) => acc + (planOf(s)?.base_price ?? 0), 0);
  const churnPct = totalSocios > 0 ? Math.round((bajas / totalSocios) * 1000) / 10 : 0;

  const { data: reintPend } = await supabase.from('reimbursements').select('refund').eq('status', 'en_revision');
  const reintPendCount = reintPend?.length ?? 0;
  const reintPendSum = (reintPend ?? []).reduce((a, r) => a + r.refund, 0);

  const kpi: KpiVM = { totalSocios, activos, nuevosEsteMes, mrr, reintPendCount, reintPendSum, churnPct, bajas };

  const PLAN_ORDER = ['AMIGO', 'FAMILIA', 'VIP'];
  const distMap = new Map<string, number>();
  for (const s of socioList) { const n = planOf(s)?.name; if (n) distMap.set(n, (distMap.get(n) ?? 0) + 1); }
  const dist: DistRow[] = [...distMap.entries()]
    .map(([plan, n]) => ({ plan, socios: n, pct: totalSocios ? Math.round((n / totalSocios) * 100) : 0 }))
    .sort((a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan));

  const socios: SocioRow[] = socioList.map((s) => ({
    id: s.id, n: `#${s.member_no}`, nombre: s.full_name, mascota: (s.pets ?? []).map((p: { name: string }) => p.name).join(' + ') || '—',
    plan: planOf(s)?.name ?? '—', desde: s.joined_on ? fmtShort(s.joined_on) : '—', estado: ESTADO_SOCIO[s.status] ?? s.status,
  }));

  // ── Reintegros: cola + historial ──
  const { data: colaRows } = await supabase
    .from('reimbursements')
    .select('id, provider_name, concept, amount, refund, requested_on, flag, receipt_path, profiles(member_no, full_name)')
    .eq('status', 'en_revision')
    .order('requested_on', { ascending: true });
  const cola: ColaRow[] = (colaRows ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { id: r.id, socio: `#${p?.member_no} · ${p?.full_name?.split(' ')[0]}`, prestador: r.provider_name, concepto: r.concept, fecha: fmtDay(r.requested_on), gastado: r.amount, reintegro: r.refund, flag: r.flag ?? undefined, receiptPath: r.receipt_path ?? null };
  });

  const { data: histRows } = await supabase
    .from('reimbursements')
    .select('provider_name, concept, amount, refund, status, profiles(member_no, full_name)')
    .in('status', ['acreditado', 'rechazado'])
    .order('requested_on', { ascending: false })
    .limit(20);
  const hist: HistRow[] = (histRows ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { socio: `#${p?.member_no} · ${p?.full_name?.split(' ')[0]}`, prestador: r.provider_name, concepto: r.concept, gastado: r.amount, reintegro: r.refund, estado: r.status === 'acreditado' ? 'Acreditado' : 'Rechazado' };
  });

  // ── Beneficios ──
  const { data: benefitRows } = await supabase.from('benefits').select('id, name, category, discount, plan_requirement, status');
  const benefits: BenefitAdminVM[] = (benefitRows ?? []).map((b) => ({ id: b.id, name: b.name, category: b.category, discount: b.discount, planRequirement: b.plan_requirement, status: b.status }));

  // ── Planes ──
  // Por precio: da AMIGO → FAMILIA → VIP. Sin orden explícito, editar un plan
  // lo manda al final de la lista (Postgres reubica la fila al hacer update).
  const { data: planRows } = await supabase.from('plans').select('id, name, tagline, base_price, perks, featured').order('base_price');
  const plans: PlanAdminVM[] = (planRows ?? []).map((p) => ({ id: p.id, name: p.name, tagline: p.tagline, basePrice: p.base_price, perks: p.perks ?? [], featured: p.featured }));

  // ── FAQ ──
  const { data: faqRows } = await supabase.from('faqs').select('id, question, answer').order('order', { ascending: true });
  const faqs: FaqVM[] = faqRows ?? [];

  // ── Ajustes ──
  const { data: settingsRow } = await supabase.from('club_settings').select('whatsapp, email').eq('id', 1).single();
  const settings: SettingsVM = { whatsapp: settingsRow?.whatsapp ?? '', email: settingsRow?.email ?? '' };

  // ── Prestadores / Negocios (misma tabla, distinto recorte) ──
  const { data: providerRows } = await supabase.from('providers').select('id, name, category, zone, rating, reviews, status, created_at');
  const providers: ProviderAdminRow[] = (providerRows ?? []).map((p) => ({
    id: p.id, nombre: p.name, rubro: p.category, zona: p.zone, rating: p.reviews > 0 ? p.rating.toFixed(1) : '—',
    estado: p.status === 'verificado' ? 'Verificado' : p.status === 'rechazado' ? 'Rechazado' : 'Pendiente', solicitado: relTime(p.created_at),
  }));

  // ── Moderación ──
  // El autor sale de la fila, igual que en la webapp del socio.
  const { data: reportRows } = await supabase.from('community_posts').select('id, category, title, author_name').eq('reported', true);
  const reports: ReportRow[] = (reportRows ?? []).map((r) => ({
    id: r.id, cat: r.category,
    autor: r.author_name?.trim() ? `por ${r.author_name.trim().split(' ')[0]}` : 'por socio',
    titulo: r.title, motivo: 'Reportado por la comunidad',
  }));

  // ── Push: audiencias reales + historial de envíos ──
  const { data: pendVaxPets } = await supabase.from('vaccinations').select('pet_id').eq('status', 'pendiente');
  const audiences: AudienceVM[] = [
    { label: 'Todos los socios', n: totalSocios },
    ...dist.map((d) => ({ label: `Plan ${d.plan}`, n: d.socios })),
    { label: 'Vacunas pendientes', n: new Set((pendVaxPets ?? []).map((v) => v.pet_id)).size },
  ];
  const { data: sentRows } = await supabase.from('push_notifications').select('title, audience, sent_at').order('sent_at', { ascending: false }).limit(10);
  const sent: SentPushVM[] = (sentRows ?? []).map((s) => ({ title: s.title, audience: s.audience, when: s.sent_at ? relTime(s.sent_at) : '—' }));

  return (
    <AppClient
      profile={profile} kpi={kpi} dist={dist} socios={socios} cola={cola} hist={hist}
      benefits={benefits} plans={plans} faqs={faqs} settings={settings}
      providers={providers} reports={reports} audiences={audiences} sent={sent}
    />
  );
}
