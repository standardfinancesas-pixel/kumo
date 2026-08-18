import { redirect } from 'next/navigation';
import { urls, mesActualISO, hoyISO } from '@kumo/shared';
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
/** Cómo se lee cada estado en el panel. 'suspendido' (lo corta el club) y 'baja'
 *  (se fue el socio) son distintos a propósito: solo la baja cuenta para el churn. */
const ESTADO_SOCIO: Record<string, string> = { activo: 'Al día', moroso: 'En mora', suspendido: 'Suspendido', baja: 'De baja' };

export default async function Page() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(LANDING);

  const { data: myProfile } = await supabase.from('profiles').select('role, full_name').eq('id', auth.user.id).single();
  if (!myProfile || myProfile.role !== 'admin') redirect(WEBAPP);
  const profile: AdminProfile = { id: auth.user.id, fullName: myProfile.full_name };

  /*
   * Todo junto, no una atrás de la otra: ninguna consulta depende del resultado
   * de otra. Antes eran nueve viajes de ida y vuelta EN FILA a Supabase, y el
   * panel los pagaba de nuevo en cada `router.refresh()` —o sea, cada vez que el
   * club aprueba, pausa o edita algo—. Eso es lo que se sentía lento.
   */
  const [
    { data: profileRows },
    { data: reintPend },
    { data: colaRows },
    { data: histRows },
    { data: benefitRows },
    { data: planRows },
    { data: faqRows },
    { data: settingsRow },
    { data: providerRows },
    { data: reportRows },
    { data: pendVaxPets },
    { data: sentRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, member_no, full_name, status, joined_on, paid_until, monthly_fee_agreed, plans(name, base_price), pets(name)')
      .eq('role', 'socio'),
    supabase.from('reimbursements').select('refund').eq('status', 'en_revision'),
    // Se piden también los datos de la transferencia, el DNI del socio y la
    // mascota con su carnet: es lo que hay que mirar para resolver, y estaba a dos
    // pantallas de distancia.
    supabase
      .from('reimbursements')
      .select(`
        id, provider_name, concept, amount, refund, refund_pct, plan_name, requested_on, flag, receipt_path, receipt_no,
        bank_holder, bank_holder_dni, bank_cuit, bank_name, bank_cbu, bank_alias,
        profiles(member_no, full_name, dni),
        pets(name, type, breed, age_years, weight_kg, vaccinations(name, status, applied_on, due_on))
      `)
      .eq('status', 'en_revision')
      .order('requested_on', { ascending: true }),
    supabase
      .from('reimbursements')
      .select('provider_name, concept, amount, refund, status, profiles(member_no, full_name)')
      .in('status', ['acreditado', 'rechazado'])
      .order('requested_on', { ascending: false })
      .limit(20),
    supabase.from('benefits').select('id, name, category, discount, plan_requirement, status, description, zone, hours, valid_until, days'),
    // Por precio: da AMIGO → FAMILIA → VIP. Sin orden explícito, editar un plan lo
    // manda al final de la lista (Postgres reubica la fila al hacer update).
    supabase.from('plans').select('id, name, tagline, base_price, perks, featured').order('base_price'),
    supabase.from('faqs').select('id, question, answer').order('order', { ascending: true }),
    supabase.from('club_settings').select('whatsapp, email').eq('id', 1).single(),
    // Con la ficha: el subtítulo de la pantalla dice "validá la identidad y la
    // documentación", y con solo el nombre y el rubro no había nada que validar.
    // El join va con el nombre de la clave: `providers` se relaciona con
    // `profiles` por dos caminos (el dueño y la tabla de favoritos), y sin
    // desambiguar PostgREST responde 300 y la lista queda vacía.
    supabase
      .from('providers')
      .select('id, name, category, zone, address, phone, instagram, website, about, price, price_unit, rating, reviews, status, created_at, owner_id, profiles!providers_owner_id_fkey(full_name, email)'),
    // El autor sale de la fila, igual que en la webapp del socio.
    supabase.from('community_posts').select('id, category, title, author_name, report_reason').eq('reported', true),
    supabase.from('vaccinations').select('pet_id').eq('status', 'pendiente'),
    supabase.from('push_notifications').select('id, title, audience, sent_at').order('sent_at', { ascending: false }).limit(10),
  ]);
  const socioList = profileRows ?? [];
  const planOf = (p: (typeof socioList)[number]) => (Array.isArray(p.plans) ? p.plans[0] : p.plans);

  const totalSocios = socioList.length;
  const activos = socioList.filter((s) => s.status === 'activo').length;
  const bajas = socioList.filter((s) => s.status === 'baja').length;
  // El mes arranca según el calendario argentino: acá corre en UTC, y el 1° antes
  // de las 21:00 de Buenos Aires el servidor todavía cree que es el mes anterior.
  const inicioDeMes = mesActualISO();
  const nuevosEsteMes = socioList.filter((s) => s.joined_on && s.joined_on >= inicioDeMes).length;
  // La cuota que cada socio ACEPTÓ, no el precio de lista del plan: con la
  // cobertura odontológica paga $12.000 más, y sumando `base_price` el panel
  // mostraba menos ingresos de los que el club factura.
  const mrr = socioList
    .filter((s) => s.status === 'activo')
    .reduce((acc, s) => acc + (s.monthly_fee_agreed ?? planOf(s)?.base_price ?? 0), 0);
  const churnPct = totalSocios > 0 ? Math.round((bajas / totalSocios) * 1000) / 10 : 0;

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
    // El estado crudo, para que la acción sepa si toca suspender o reactivar.
    estadoRaw: s.status,
    // La cuota es aparte del estado: el estado lo decide el club, la cuota la
    // decide el pago. Se compara con hoy y no se guarda un "al día", que habría
    // que apagar con un cron y mentiría hasta que corriera.
    cuotaHasta: s.paid_until ?? null,
    cuotaAlDia: !!s.paid_until && s.paid_until >= hoyISO(),
  }));

  const cola: ColaRow[] = (colaRows ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const m = Array.isArray(r.pets) ? r.pets[0] : r.pets;
    type VacRow = { name: string; status: string; applied_on: string | null; due_on: string | null };
    return {
      id: r.id,
      socio: `#${p?.member_no} · ${p?.full_name?.split(' ')[0]}`,
      prestador: r.provider_name, concepto: r.concept, fecha: fmtDay(r.requested_on),
      gastado: r.amount, reintegro: r.refund, pct: r.refund_pct, plan: r.plan_name,
      flag: r.flag ?? undefined, receiptPath: r.receipt_path ?? null, receiptNo: r.receipt_no ?? null,
      socioDni: p?.dni ?? null,
      banco: {
        titular: r.bank_holder, titularDni: r.bank_holder_dni, cuit: r.bank_cuit,
        nombre: r.bank_name, cbu: r.bank_cbu, alias: r.bank_alias,
      },
      mascota: m
        ? {
            nombre: m.name,
            info: [m.type, m.breed, m.age_years != null ? `${m.age_years} años` : null, m.weight_kg != null ? `${m.weight_kg} kg` : null].filter(Boolean).join(' · '),
            vacunas: ((m.vaccinations ?? []) as VacRow[])
              .slice()
              .sort((a, b) => (b.applied_on ?? b.due_on ?? '').localeCompare(a.applied_on ?? a.due_on ?? ''))
              .map((v) => ({
                nombre: v.name,
                estado: v.status === 'aplicada' ? 'Aplicada' : 'Pendiente',
                cuando: v.status === 'aplicada' ? (v.applied_on ? fmtDay(v.applied_on) : '—') : v.due_on ? `vence ${fmtDay(v.due_on)}` : '—',
              })),
          }
        : null,
    };
  });

  const hist: HistRow[] = (histRows ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { socio: `#${p?.member_no} · ${p?.full_name?.split(' ')[0]}`, prestador: r.provider_name, concepto: r.concept, gastado: r.amount, reintegro: r.refund, estado: r.status === 'acreditado' ? 'Acreditado' : 'Rechazado' };
  });

  const benefits: BenefitAdminVM[] = (benefitRows ?? []).map((b) => ({
    id: b.id, name: b.name, category: b.category, discount: b.discount, planRequirement: b.plan_requirement, status: b.status,
    description: b.description ?? '', zone: b.zone ?? '', hours: b.hours ?? '', validUntil: b.valid_until, days: b.days ?? [],
  }));

  const plans: PlanAdminVM[] = (planRows ?? []).map((p) => ({ id: p.id, name: p.name, tagline: p.tagline, basePrice: p.base_price, perks: p.perks ?? [], featured: p.featured }));

  const faqs: FaqVM[] = faqRows ?? [];

  const settings: SettingsVM = { whatsapp: settingsRow?.whatsapp ?? '', email: settingsRow?.email ?? '' };

  const providers: ProviderAdminRow[] = (providerRows ?? []).map((p) => {
    const dueño = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return {
      id: p.id, nombre: p.name, rubro: p.category, zona: p.zone, rating: p.reviews > 0 ? p.rating.toFixed(1) : '—',
      estado: p.status === 'verificado' ? 'Verificado' : p.status === 'rechazado' ? 'Rechazado' : 'Pendiente',
      solicitado: relTime(p.created_at),
      about: p.about ?? '', direccion: p.address, telefono: p.phone, instagram: p.instagram, web: p.website,
      reseñas: p.reviews,
      precio: p.price != null ? `${money(p.price)}${p.price_unit ? ` ${p.price_unit}` : ''}` : null,
      dueño: p.owner_id && dueño ? { nombre: dueño.full_name, email: dueño.email } : null,
    };
  });

  const reports: ReportRow[] = (reportRows ?? []).map((r) => ({
    id: r.id, cat: r.category,
    autor: r.author_name?.trim() ? `por ${r.author_name.trim().split(' ')[0]}` : 'por socio',
    titulo: r.title,
    // El motivo que eligió quien reportó. Los reportes viejos no tienen.
    motivo: r.report_reason?.trim() || 'Reportado por la comunidad',
  }));

  const audiences: AudienceVM[] = [
    { label: 'Todos los socios', n: totalSocios },
    ...dist.map((d) => ({ label: `Plan ${d.plan}`, n: d.socios })),
    { label: 'Vacunas pendientes', n: new Set((pendVaxPets ?? []).map((v) => v.pet_id)).size },
  ];
  const sent: SentPushVM[] = (sentRows ?? []).map((s) => ({ id: s.id, title: s.title, audience: s.audience, when: s.sent_at ? relTime(s.sent_at) : '—' }));

  return (
    <AppClient
      profile={profile} kpi={kpi} dist={dist} socios={socios} cola={cola} hist={hist}
      benefits={benefits} plans={plans} faqs={faqs} settings={settings}
      providers={providers} reports={reports} audiences={audiences} sent={sent}
    />
  );
}
