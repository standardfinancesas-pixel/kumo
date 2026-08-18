'use client';
import type { CSSProperties, ReactNode } from 'react';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeTable, urls, fmtFechaCorta } from '@kumo/shared';
import { supabase } from '@/lib/supabase-browser';

/*
 * Panel de administración de Kumo — vista "Admin" del prototipo (reference/kumo-prototype.html).
 * Sidebar oscuro + 11 secciones. Datos reales desde Supabase (ver app/page.tsx).
 */

const money = (n: number) => '$' + n.toLocaleString('es-AR');

/* ── Tipos de las vistas (mapeados desde Supabase en page.tsx) ──── */
export type AdminProfile = { id: string; fullName: string };
export type KpiVM = { totalSocios: number; activos: number; nuevosEsteMes: number; mrr: number; reintPendCount: number; reintPendSum: number; churnPct: number; bajas: number };
export type DistRow = { plan: string; socios: number; pct: number };
export type SocioRow = { id: string; n: string; nombre: string; mascota: string; plan: string; desde: string; estado: string; estadoRaw: string; cuotaHasta: string | null; cuotaAlDia: boolean };
/**
 * Una solicitud en la cola. Trae todo lo que el club necesita para resolverla sin
 * salir de la pantalla: antes había que ir a Socios, buscar a la persona y abrir
 * su ficha para saber a qué CBU transferirle.
 */
export type ColaRow = {
  id: string; socio: string; prestador: string; concepto: string; fecha: string;
  gastado: number; reintegro: number; pct: number; plan: string;
  flag?: string; receiptPath: string | null; receiptNo: string | null;
  /** DNI del socio, para contrastarlo con el del titular de la cuenta. */
  socioDni: string | null;
  banco: { titular: string | null; titularDni: string | null; cuit: string | null; nombre: string | null; cbu: string | null; alias: string | null };
  mascota: { nombre: string; info: string; vacunas: { nombre: string; estado: string; cuando: string }[] } | null;
};
export type HistRow = { socio: string; prestador: string; concepto: string; gastado: number; reintegro: number; estado: string };
export type BenefitAdminVM = { id: string; name: string; category: string; discount: string; planRequirement: string; status: string; description: string; zone: string; hours: string; validUntil: string | null; days: string[] };
export type PlanAdminVM = { id: string; name: string; tagline: string; basePrice: number; perks: string[]; featured: boolean };
export type FaqVM = { id: string; question: string; answer: string };
export type SettingsVM = { whatsapp: string; email: string };
/** Un prestador con lo que hace falta para validarlo sin salir de la pantalla. */
export type ProviderAdminRow = {
  id: string; nombre: string; rubro: string; zona: string; rating: string; estado: string; solicitado: string;
  about: string; direccion: string | null; telefono: string | null; instagram: string | null; web: string | null;
  reseñas: number; precio: string | null;
  /** Quién está detrás. Null si el club lo cargó a mano y no tiene cuenta. */
  dueño: { nombre: string; email: string } | null;
};
export type ReportRow = { id: string; cat: string; autor: string; titulo: string; motivo: string };
export type AudienceVM = { label: string; n: number };
export type SentPushVM = { id: string; title: string; audience: string; when: string };

/* ── Iconos del sidebar ────────────────────────────────────────── */
const I = (inner: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>{inner}</svg>
);
const icons = {
  dashboard: I(<><path d="M4 13h6V4H4z" /><path d="M14 20h6v-9h-6z" /><path d="M14 4h6v4h-6z" /><path d="M4 20h6v-4H4z" /></>),
  socios: I(<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 3.5a3 3 0 0 1 0 5.8M21 20c0-2.5-1.3-4.3-3.5-5" /></>),
  reintegros: I(<><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2" /><rect x="2" y="7" width="20" height="12" rx="2" /><path d="M22 11h-4a2 2 0 0 0 0 4h4" /></>),
  beneficios: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.1" /><path d="M6.2 16c.5-1.5 1.9-2.4 3.3-2.4s2.8.9 3.3 2.4" /><line x1="14" y1="9" x2="17.5" y2="9" /><line x1="14" y1="13" x2="16.5" y2="13" /></>),
  planes: I(<><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 10h18" /></>),
  faq: I(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
  push: I(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>),
  // La tuerca completa. La anterior era este mismo path CORTADO: terminaba en
  // "2.6 7" y nunca cerraba la vuelta de arriba, así que la corona quedaba abierta
  // de un lado y se veía deforme.
  ajustes: I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
  prestadores: I(<><circle cx="5.5" cy="10" r="1.7" /><circle cx="9.7" cy="6.4" r="1.8" /><circle cx="14.3" cy="6.4" r="1.8" /><circle cx="18.5" cy="10" r="1.7" /><path d="M8 14.2c-1.3 1-1.9 2.4-1.5 3.8.3 1.3 1.5 2 2.9 1.7 1-.2 1.6-.6 2.6-.6s1.6.4 2.6.6c1.4.3 2.6-.4 2.9-1.7.4-1.4-.2-2.8-1.5-3.8-1.1-.9-2.1-1.5-4-1.5s-2.9.6-4 1.5z" /></>),
  negocios: I(<><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>),
  moderacion: I(<><path d="M12 3l8 4v5c0 4.4-3.4 7.5-8 9-4.6-1.5-8-4.6-8-9V7z" /><path d="M9.5 12l1.8 1.8L15 10" /></>),
  menu: I(<><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>),
};

type Screen = 'dashboard' | 'socios' | 'reintegros' | 'beneficios' | 'planes' | 'faq' | 'push' | 'ajustes' | 'prestadores' | 'negocios' | 'moderacion';
const NAV: { k: Screen; label: string; icon: ReactNode }[] = [
  { k: 'dashboard', label: 'Dashboard', icon: icons.dashboard },
  { k: 'socios', label: 'Socios', icon: icons.socios },
  { k: 'reintegros', label: 'Reintegros', icon: icons.reintegros },
  { k: 'beneficios', label: 'Beneficios', icon: icons.beneficios },
  { k: 'planes', label: 'Planes', icon: icons.planes },
  { k: 'faq', label: 'FAQ', icon: icons.faq },
  { k: 'push', label: 'Push', icon: icons.push },
  { k: 'ajustes', label: 'Ajustes', icon: icons.ajustes },
  { k: 'prestadores', label: 'Prestadores', icon: icons.prestadores },
  { k: 'negocios', label: 'Negocios', icon: icons.negocios },
  { k: 'moderacion', label: 'Moderación', icon: icons.moderacion },
];

/* ── Estilos reutilizables ─────────────────────────────────────── */
const card: CSSProperties = { background: '#fff', border: '1px solid #e6e3f0', borderRadius: 16, padding: 18 };
const h1: CSSProperties = { fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' };
const sub: CSSProperties = { color: '#8781a0', fontSize: 15, margin: '0 0 24px' };
const th: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', textAlign: 'left', padding: '10px 14px', textTransform: 'uppercase' };
const td: CSSProperties = { fontSize: 14, color: '#211e33', padding: '13px 14px', borderTop: '1px solid #eeecf5' };
const inp: CSSProperties = { width: '100%', padding: '11px 13px', border: '1.5px solid #e6e3f0', borderRadius: 10, fontSize: 14, fontFamily: '"DM Sans"', outline: 'none', boxSizing: 'border-box', background: '#fff' };
const badge = (bg: string, fg: string): CSSProperties => ({ background: bg, color: fg, fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 100, display: 'inline-block' });
const estadoBadge = (e: string) => e === 'Al día' || e === 'Verificado' || e === 'Validado' || e === 'Acreditado' || e === 'Activo'
  ? badge('rgb(226,245,234)', 'rgb(47,143,91)')
  : e === 'En mora' || e === 'Pendiente' || e === 'En revisión' || e === 'Pausado'
  ? badge('rgb(251,243,226)', 'rgb(184,134,11)')
  : badge('rgb(251,232,239)', 'rgb(193,77,122)');

/* ── Menú de acciones ──────────────────────────────────────────── */
/**
 * El "⋯" de una fila, con sus acciones adentro.
 *
 * Va en menú y no como botones sueltos porque las filas ya tienen cinco o seis
 * columnas: cuatro botones al final las volvían ilegibles y encima empujaban la
 * tabla a scrollear en pantallas chicas. Y porque hay acciones que no conviene
 * tener a un clic de distancia, como eliminar.
 *
 * Cada acción declara si es destructiva (se pinta en rojo) y si pide confirmación.
 * El menú se cierra al elegir, al tocar afuera o con Escape.
 */
type Accion = { label: string; onClick: () => void; destructiva?: boolean; confirmar?: string };

function MenuAcciones({ acciones, disabled }: { acciones: Accion[]; disabled?: boolean }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    const conEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    // `click` en captura: si esperara al bubbling, el click que abre el menú lo
    // cerraría en el mismo gesto.
    window.addEventListener('click', cerrar);
    window.addEventListener('keydown', conEsc);
    return () => { window.removeEventListener('click', cerrar); window.removeEventListener('keydown', conEsc); };
  }, [abierto]);

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end' }}>
      <button
        aria-label="Acciones"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setAbierto((s) => !s); }}
        style={{ background: abierto ? 'rgb(240,237,249)' : '#fff', border: '1px solid #e6e3f0', color: '#5b5670', fontWeight: 700, fontSize: 15, lineHeight: 1, padding: '6px 10px', borderRadius: 9, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
      >
        ⋯
      </button>
      {abierto && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 30, background: '#fff', border: '1px solid #e6e3f0', borderRadius: 12, boxShadow: '0 12px 28px rgba(33,30,51,0.14)', padding: 6, minWidth: 180 }}
        >
          {acciones.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                setAbierto(false);
                if (a.confirmar && !confirm(a.confirmar)) return;
                a.onClick();
              }}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: a.destructiva ? 'rgb(193,77,122)' : '#3f3a55', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13.5, padding: '9px 10px', borderRadius: 8, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = a.destructiva ? 'rgb(251,232,239)' : 'rgb(247,246,250)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Modal ─────────────────────────────────────────────────────── */
const fieldLabel: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 6, display: 'block' };
const btnPrimary: CSSProperties = { background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, padding: '12px 18px', borderRadius: 11, cursor: 'pointer' };
const btnGhost: CSSProperties = { background: '#fff', border: '1px solid #e6e3f0', color: '#5b5670', fontWeight: 600, fontSize: 14, padding: '12px 18px', borderRadius: 11, cursor: 'pointer' };

function Modal({ title, sub: subtitle, onClose, children, width = 520 }: { title: string; sub?: string; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(33,30,51,0.6)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 22, maxWidth: width, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: '#8781a0', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: '#f4f2f9', border: 'none', borderRadius: 9, width: 30, height: 30, cursor: 'pointer', color: '#5b5670', fontSize: 16, flex: '0 0 auto' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────── */
function Dashboard({ go, kpi, dist }: { go: (s: Screen) => void; kpi: KpiVM; dist: DistRow[] }) {
  const kpis = [
    { label: 'Socios activos', value: kpi.activos.toLocaleString('es-AR'), delta: `+${kpi.nuevosEsteMes} este mes`, pos: true },
    { label: 'Ingresos mensuales', value: money(kpi.mrr), delta: `${kpi.activos} socios pagantes`, pos: true },
    { label: 'Reintegros pendientes', value: String(kpi.reintPendCount), delta: `${money(kpi.reintPendSum)} por acreditar`, pos: false },
    { label: 'Bajas', value: `${kpi.churnPct}%`, delta: `${kpi.bajas} socios de baja`, pos: kpi.churnPct < 5 },
  ];
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Dashboard</h1>
      <p style={sub}>Resumen general del club</p>
      <div className="adm-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} style={card}>
            <div style={{ fontSize: 13, color: '#8781a0', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 30 }}>{k.value}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6, color: k.pos ? 'rgb(47,143,91)' : 'rgb(184,134,11)' }}>{k.delta}</div>
          </div>
        ))}
      </div>
      <div className="adm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ ...card, padding: 24 }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18, marginBottom: 18 }}>Distribución por plan</div>
          {dist.map((d) => (
            <div key={d.plan} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{d.plan}</span>
                <span style={{ fontSize: 13, color: '#8781a0' }}>{d.socios.toLocaleString('es-AR')} socios · {d.pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 100, background: '#eeecf5', overflow: 'hidden' }}>
                <div style={{ width: `${d.pct * 2}%`, maxWidth: '100%', height: '100%', borderRadius: 100, background: d.plan === 'VIP' ? 'rgb(225,251,98)' : 'rgb(93,84,145)' }} />
              </div>
            </div>
          ))}
          {dist.length === 0 && <div style={{ color: '#8781a0', fontSize: 14 }}>Todavía no hay socios.</div>}
        </div>
        <div style={{ background: 'rgb(93,84,145)', borderRadius: 18, padding: 24, color: '#fff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18 }}>Reintegros a resolver</div>
          <div style={{ color: 'rgb(201,195,227)', fontSize: 13, marginBottom: 18 }}>{kpi.reintPendCount} solicitudes en cola</div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 40, color: 'rgb(225,251,98)' }}>{money(kpi.reintPendSum)}</div>
          <div style={{ color: 'rgb(201,195,227)', fontSize: 13, marginBottom: 20 }}>monto total pendiente de acreditar</div>
          <button onClick={() => go('reintegros')} style={{ alignSelf: 'flex-start', background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', border: 'none', fontWeight: 700, fontSize: 14, padding: '12px 20px', borderRadius: 12, cursor: 'pointer' }}>Revisar cola →</button>
        </div>
      </div>
    </div>
  );
}

/* ── Socios ────────────────────────────────────────────────────── */
type FichaData = {
  email: string; phone: string | null; address: string | null; city: string | null; province: string | null;
  dni: string | null; joinedOn: string | null;
  planName: string | null; planPrice: number | null;
  // Lo que contrató en el alta: la cuota que aceptó puede no ser el precio de
  // lista de hoy, y con la cobertura odontológica paga $12.000 más.
  addonOdonto: boolean; monthlyFeeAgreed: number | null; payMethod: string | null;
  // A dónde transferirle los reintegros, y con qué se le cobra la cuota.
  bank: { holder: string | null; holderDni: string | null; cuit: string | null; name: string | null; cbu: string | null; alias: string | null };
  card: { brand: string | null; last4: string | null; exp: string | null; holder: string | null };
  pets: { id: string; name: string; type: string; breed: string | null; ageYears: number | null; microchip: string | null }[];
  /** Si además ofrece servicios en el club: en Kumo un prestador es un socio con
   *  un negocio, así que la ficha tiene que decirlo (lo pide el prototipo). */
  negocios: { id: string; name: string; category: string; zone: string; status: string }[];
  reintegros: { id: string; providerName: string; concept: string; amount: number; refund: number; status: string }[];
  declaraciones: { id: string; petName: string; signature: string; signedAt: string; answers: { pregunta: string; respuesta: string }[]; sanitary: { pregunta: string; respuesta: string }[] }[];
};

/** Una fila "etiqueta · valor", que es como se leen todas las fichas del panel. */
const dato = (k: string, v: string) => (
  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #eeecf5', gap: 12 }}>
    <span style={{ fontSize: 13, color: '#8781a0' }}>{k}</span>
    <span style={{ fontSize: 13.5, fontWeight: 600, textAlign: 'right' }}>{v}</span>
  </div>
);

/** El detalle se pide al abrir la ficha, no con la tabla: son datos que solo se
 *  miran de a un socio y así la lista carga liviana. */
function FichaSocioModal({ socio, onClose }: { socio: SocioRow; onClose: () => void }) {
  const [data, setData] = useState<FichaData | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [perfil, mascotas, reint, declas, negocios] = await Promise.all([
        supabase.from('profiles').select('email, phone, address, city, province, dni, joined_on, addon_odonto, monthly_fee_agreed, pay_method, bank_holder, bank_holder_dni, bank_cuit, bank_name, bank_cbu, bank_alias, card_brand, card_last4, card_exp, card_holder, plans(name, base_price)').eq('id', socio.id).single(),
        supabase.from('pets').select('id, name, type, breed, age_years, microchip').eq('owner_id', socio.id),
        supabase.from('reimbursements').select('id, provider_name, concept, amount, refund, status').eq('member_id', socio.id).order('requested_on', { ascending: false }),
        supabase.from('health_declarations').select('id, pet_name, signature, signed_at, answers, sanitary').eq('member_id', socio.id).order('signed_at', { ascending: false }),
        supabase.from('providers').select('id, name, category, zone, status').eq('owner_id', socio.id),
      ]);
      if (!vivo) return;
      if (perfil.error || !perfil.data) { setEstado('error'); return; }
      const p = perfil.data;
      const plan = Array.isArray(p.plans) ? p.plans[0] : p.plans;
      setData({
        email: p.email, phone: p.phone, address: p.address, city: p.city, province: p.province,
        dni: p.dni, joinedOn: p.joined_on,
        planName: plan?.name ?? null, planPrice: plan?.base_price ?? null,
        addonOdonto: p.addon_odonto ?? false, monthlyFeeAgreed: p.monthly_fee_agreed, payMethod: p.pay_method,
        bank: { holder: p.bank_holder, holderDni: p.bank_holder_dni, cuit: p.bank_cuit, name: p.bank_name, cbu: p.bank_cbu, alias: p.bank_alias },
        card: { brand: p.card_brand, last4: p.card_last4, exp: p.card_exp, holder: p.card_holder },
        declaraciones: (declas.data ?? []).map((d) => ({
          id: d.id, petName: d.pet_name, signature: d.signature, signedAt: d.signed_at,
          answers: (d.answers ?? []) as { pregunta: string; respuesta: string }[],
          sanitary: (d.sanitary ?? []) as { pregunta: string; respuesta: string }[],
        })),
        pets: (mascotas.data ?? []).map((m) => ({ id: m.id, name: m.name, type: m.type, breed: m.breed, ageYears: m.age_years, microchip: m.microchip })),
        negocios: negocios.data ?? [],
        reintegros: (reint.data ?? []).map((r) => ({ id: r.id, providerName: r.provider_name, concept: r.concept, amount: r.amount, refund: r.refund, status: r.status })),
      });
      setEstado('listo');
    })();
    return () => { vivo = false; };
  }, [socio.id]);

  const acreditado = (data?.reintegros ?? []).filter((r) => r.status === 'acreditado').reduce((a, r) => a + r.refund, 0);

  return (
    <Modal title={socio.nombre} sub={`${socio.n} · socio desde ${socio.desde}`} onClose={onClose} width={580}>
      {estado === 'cargando' && <div style={{ padding: 36, textAlign: 'center', color: '#8781a0', fontSize: 14 }}>Cargando la ficha…</div>}
      {estado === 'error' && <div style={{ padding: 30, textAlign: 'center', color: '#8781a0', fontSize: 14 }}>No pudimos cargar la ficha.</div>}
      {estado === 'listo' && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={estadoBadge(socio.estado)}>{socio.estado}</span>
            {data.planName && <span style={badge('rgb(240,237,249)', 'rgb(93,84,145)')}>Plan {data.planName}{data.monthlyFeeAgreed ? ` · ${money(data.monthlyFeeAgreed)}/mes` : data.planPrice ? ` · ${money(data.planPrice)}/mes` : ''}</span>}
            {data.addonOdonto && <span style={badge('rgb(226,245,234)', 'rgb(47,143,91)')}>+ Odontológica</span>}
          </div>
          <div>
            <div style={fieldLabel}>DATOS PERSONALES</div>
            {dato('Email', data.email)}
            {dato('Teléfono', data.phone || '—')}
            {dato('DNI', data.dni || '—')}
            {dato('Domicilio', data.address || '—')}
            {dato('Localidad', data.city || '—')}
            {dato('Provincia', data.province || '—')}
          </div>
          {/* A dónde transferirle. La transferencia la hace el club a mano desde
              su home banking, así que esto es todo lo que necesita para pagarle
              un reintegro. Antes había que abrir la solicitud para verlo, y solo
              existía si ya había pedido uno. */}
          <div>
            <div style={fieldLabel}>DÓNDE COBRA SUS REINTEGROS</div>
            {data.bank.cbu
              ? (
                <>
                  {dato('CBU / CVU', data.bank.cbu)}
                  {data.bank.alias && dato('Alias', data.bank.alias)}
                  {dato('Titular', data.bank.holder || '—')}
                  {dato('CUIT / CUIL', data.bank.cuit || '—')}
                  {data.bank.name && dato('Banco', data.bank.name)}
                </>
              )
              : <div style={{ fontSize: 13.5, color: '#8781a0' }}>Todavía no cargó una cuenta. Se le pide al aprobar el primer reintegro.</div>}
          </div>
          <div>
            <div style={fieldLabel}>CÓMO PAGA LA CUOTA</div>
            {dato('Medio', data.payMethod === 'cbu' ? 'Débito de CBU/CVU' : data.payMethod === 'tarjeta' ? 'Tarjeta' : '—')}
            {data.card.last4 && dato('Tarjeta', `${data.card.brand ?? 'Tarjeta'} ···· ${data.card.last4}${data.card.exp ? ` · vence ${data.card.exp}` : ''}`)}
            {data.card.holder && dato('Titular', data.card.holder)}
            {data.monthlyFeeAgreed != null && dato('Cuota aceptada', `${money(data.monthlyFeeAgreed)}/mes`)}
          </div>
          <div>
            <div style={fieldLabel}>MASCOTAS ({data.pets.length})</div>
            {data.pets.length === 0
              ? <div style={{ fontSize: 13.5, color: '#8781a0' }}>Todavía no cargó ninguna.</div>
              : data.pets.map((m) => (
                  <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid #eeecf5' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name} <span style={{ fontWeight: 400, color: '#8781a0', fontSize: 13 }}>· {m.type}</span></div>
                    <div style={{ fontSize: 12.5, color: '#8781a0' }}>
                      {[m.breed, m.ageYears != null ? `${m.ageYears} años` : null, m.microchip ? `chip ${m.microchip}` : null].filter(Boolean).join(' · ') || 'sin datos'}
                    </div>
                  </div>
                ))}
          </div>
          {/* Si además presta servicios. En Kumo un prestador es un socio con un
              negocio, así que es la misma persona y la ficha lo tiene que decir:
              cambia cómo se lo trata (y si el negocio está pendiente, acá se ve). */}
          <div>
            <div style={fieldLabel}>¿PRESTA SERVICIOS?</div>
            {data.negocios.length === 0
              ? <div style={{ fontSize: 13.5, color: '#8781a0' }}>No ofrece servicios en el club.</div>
              : data.negocios.map((n) => (
                  <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #eeecf5' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{n.name}</div>
                      <div style={{ fontSize: 12.5, color: '#8781a0' }}>{n.category} · {n.zone}</div>
                    </div>
                    <span style={estadoBadge(n.status === 'verificado' ? 'Verificado' : n.status === 'rechazado' ? 'Rechazado' : 'Pendiente')}>
                      {n.status === 'verificado' ? 'Verificado' : n.status === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                    </span>
                  </div>
                ))}
          </div>
          {/* La declaración jurada del alta. Está acá porque es lo que hay que
              mirar antes de resolver un reintegro por preexistencia: las
              respuestas en "Sí" son las condiciones que el socio declaró. */}
          <div>
            <div style={fieldLabel}>DECLARACIÓN JURADA ({data.declaraciones.length})</div>
            {data.declaraciones.length === 0
              ? <div style={{ fontSize: 13.5, color: '#8781a0' }}>No hay ninguna firmada. Los socios dados de alta antes de que se empezara a guardar no tienen.</div>
              : data.declaraciones.map((d) => {
                  const declaradas = d.answers.filter((a) => a.respuesta === 'Sí');
                  const alDia = d.sanitary.filter((s) => s.respuesta === 'Sí').length;
                  return (
                    <div key={d.id} style={{ padding: '12px 0', borderBottom: '1px solid #eeecf5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{d.petName}</span>
                        <span style={{ fontSize: 12, color: '#8781a0' }}>firmó {new Date(d.signedAt).toLocaleDateString('es-AR')}</span>
                      </div>
                      {declaradas.length === 0
                        ? <div style={{ fontSize: 12.5, color: 'rgb(47,143,91)', fontWeight: 600 }}>Sin condiciones declaradas</div>
                        : declaradas.map((a) => (
                            <div key={a.pregunta} style={{ fontSize: 12.5, color: 'rgb(176,72,63)', lineHeight: 1.5 }}>· {a.pregunta}</div>
                          ))}
                      <div style={{ fontSize: 12.5, color: '#8781a0', marginTop: 6 }}>
                        Plan sanitario: {alDia} de {d.sanitary.length} al día · firma «{d.signature}»
                      </div>
                    </div>
                  );
                })}
          </div>
          <div>
            <div style={fieldLabel}>REINTEGROS ({data.reintegros.length})</div>
            {data.reintegros.length === 0
              ? <div style={{ fontSize: 13.5, color: '#8781a0' }}>Nunca pidió uno.</div>
              : (
                <>
                  {data.reintegros.map((r) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eeecf5', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.providerName}</div>
                        <div style={{ fontSize: 12.5, color: '#8781a0' }}>{r.concept} · gastó {money(r.amount)}</div>
                      </div>
                      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'rgb(93,84,145)' }}>{money(r.refund)}</div>
                        <div style={{ fontSize: 11.5, color: '#8781a0' }}>{r.status === 'en_revision' ? 'en revisión' : r.status}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontWeight: 700, fontSize: 14 }}>
                    <span>Total acreditado</span>
                    <span style={{ color: 'rgb(93,84,145)' }}>{money(acreditado)}</span>
                  </div>
                </>
              )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Socios({ socios }: { socios: SocioRow[] }) {
  const router = useRouter();
  const [plan, setPlan] = useState('Todos');
  const [estado, setEstado] = useState('Todos');
  const [cuotaF, setCuotaF] = useState('Todas');
  const [ficha, setFicha] = useState<SocioRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  /*
   * Suspender o reactivar a un socio.
   *
   * 'suspendido' es distinto de 'baja' a propósito: la baja la pide el socio y
   * cuenta para el churn del dashboard; la suspensión la decide el club y es
   * reversible. Con un solo estado para las dos cosas, el churn mentiría.
   *
   * Y tiene efecto real, no cosmético: un socio que no está activo no puede
   * entrar a la app (lo corta `/app` y también mobile al abrir).
   */
  const cambiarEstado = async (s: SocioRow, nuevo: 'activo' | 'suspendido') => {
    setBusyId(s.id); setAviso('');
    const { error } = await supabase.from('profiles').update({ status: nuevo }).eq('id', s.id);
    if (error) setAviso('No pudimos cambiar el estado. Probá de nuevo.');
    else setAviso(nuevo === 'suspendido'
      ? `${s.nombre} quedó suspendido: no va a poder entrar a la app hasta que lo reactives.`
      : `${s.nombre} está activo otra vez y ya puede entrar.`);
    router.refresh();
    setBusyId(null);
  };
  /*
   * Registrar un pago que el club cobró por fuera: efectivo, transferencia, un
   * Mercado Pago hecho a mano. Sin esto, un socio que pagó por transferencia se
   * queda con el muro puesto y el club no tiene cómo ponerlo al día.
   *
   * Va por la ruta del servidor y no por un update de `paid_until`: la cuenta de
   * los meses vive en `acreditar_pago()`, junto con los bloqueos y la
   * idempotencia. Dos caminos para sumar un mes es la forma segura de que uno de
   * los dos quede mal.
   */
  const registrarPago = async (s: SocioRow) => {
    setBusyId(s.id); setAviso('');
    try {
      const res = await fetch('/api/pagos/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: s.id }),
      });
      const data = await res.json();
      if (!res.ok) setAviso(data.error ?? 'No pudimos registrar el pago.');
      else setAviso(`Pago registrado: ${s.nombre} tiene la cuota paga hasta el ${fmtFechaCorta(data.hasta)}.`);
    } catch {
      setAviso('No pudimos registrar el pago. Revisá la conexión.');
    }
    router.refresh();
    setBusyId(null);
  };
  /*
   * El filtro de cuota es aparte del de estado a propósito: son dos preguntas
   * distintas y antes estaban mezcladas en una sola lista de chips, donde "En
   * mora" nunca devolvía nada porque ningún socio tenía ese estado.
   */
  const list = socios.filter((s) =>
    (plan === 'Todos' || s.plan === plan)
    && (estado === 'Todos' || s.estado === estado)
    && (cuotaF === 'Todas' || (cuotaF === 'Al día' ? s.cuotaAlDia : !s.cuotaAlDia)));
  const chip = (active: boolean): CSSProperties => ({ border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 100, background: active ? 'rgb(93,84,145)' : '#fff', color: active ? '#fff' : '#5b5670', boxShadow: active ? 'none' : '0 0 0 1px #e6e3f0' });
  return (
    <div>
      {ficha && <FichaSocioModal socio={ficha} onClose={() => setFicha(null)} />}
      <h1 className="adm-h1" style={h1}>Socios</h1>
      <p style={sub}>{socios.length.toLocaleString('es-AR')} socios · hacé clic en un socio para ver su ficha</p>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>PLAN</div>
          <div style={{ display: 'flex', gap: 8 }}>{['Todos', 'AMIGO', 'FAMILIA', 'VIP'].map((p) => <button key={p} onClick={() => setPlan(p)} style={chip(plan === p)}>{p}</button>)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>ESTADO</div>
          <div style={{ display: 'flex', gap: 8 }}>{['Todos', 'Activo', 'Suspendido', 'De baja'].map((e) => <button key={e} onClick={() => setEstado(e)} style={chip(estado === e)}>{e}</button>)}</div>
        </div>
        {/* La cuota va en su propio filtro y no mezclada con el estado: antes "En
            mora" era un chip de ESTADO y no devolvía nunca nada, porque ningún
            socio tenía ese estado. Son dos preguntas distintas. */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>CUOTA</div>
          <div style={{ display: 'flex', gap: 8 }}>{['Todas', 'Al día', 'Vencida'].map((c) => <button key={c} onClick={() => setCuotaF(c)} style={chip(cuotaF === c)}>{c}</button>)}</div>
        </div>
      </div>
      <Aviso texto={aviso} />
      <div className="adm-tablewrap" style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['N°', 'NOMBRE', 'MASCOTA', 'PLAN', 'DESDE', 'CUOTA', 'ESTADO', 'ACCIÓN'].map((hd) => <th key={hd} style={th}>{hd}</th>)}</tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.n} className="adm-row" onClick={() => setFicha(s)} style={{ cursor: 'pointer' }}>
                <td style={{ ...td, color: '#8781a0', fontWeight: 600 }}>{s.n}</td>
                <td style={{ ...td, fontWeight: 600 }}>{s.nombre}</td>
                <td style={td}>{s.mascota}</td>
                <td style={td}>{s.plan}</td>
                <td style={{ ...td, color: '#8781a0' }}>{s.desde}</td>
                {/* La cuota, que no es lo mismo que el estado: el estado lo decide
                    el club y la cuota la decide el pago. Un socio puede estar
                    perfecto con el club y deberle el mes. */}
                <td style={td}>
                  {s.cuotaAlDia
                    ? <span style={{ fontSize: 13, color: 'rgb(47,143,91)', fontWeight: 600 }}>Hasta {fmtFechaCorta(s.cuotaHasta!)}</span>
                    : <span style={{ fontSize: 13, color: s.cuotaHasta ? 'rgb(176,58,58)' : '#8781a0', fontWeight: 600 }}>{s.cuotaHasta ? `Vencida el ${fmtFechaCorta(s.cuotaHasta)}` : 'Sin pagar'}</span>}
                </td>
                <td style={td}><span style={estadoBadge(s.estado)}>{s.estado}</span></td>
                <td style={td}>
                  <MenuAcciones
                    disabled={busyId === s.id}
                    acciones={[
                      { label: 'Ver ficha', onClick: () => setFicha(s) },
                      {
                        label: 'Registrar pago de un mes',
                        confirmar: `¿Registrar un mes pagado para ${s.nombre}? Usalo cuando cobraste por fuera de la app (efectivo o transferencia).`,
                        onClick: () => registrarPago(s),
                      },
                      s.estadoRaw === 'activo' || s.estadoRaw === 'moroso'
                        ? {
                            label: 'Suspender el acceso',
                            destructiva: true,
                            confirmar: `¿Suspender a ${s.nombre}? No va a poder entrar a la app hasta que lo reactives.`,
                            onClick: () => cambiarEstado(s, 'suspendido'),
                          }
                        : { label: 'Reactivar', onClick: () => cambiarEstado(s, 'activo') },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#8781a0' }}>No hay socios con esos filtros.</div>}
      </div>
    </div>
  );
}

/* ── Reintegros ────────────────────────────────────────────────── */

/**
 * ¿El titular de la cuenta es el socio?
 *
 * Es el control que evita pagarle un reintegro a un tercero: los DNI se comparan
 * por dígitos, porque uno se carga "38.412.905" y el otro "38412905" y son el
 * mismo. Si falta alguno de los dos no se afirma nada — decir "no coincide"
 * cuando en realidad no hay dato sería peor que no decir nada.
 */
function dniCoincide(socioDni: string | null, titularDni: string | null): { ok: boolean | null; texto: string } {
  const soloDigitos = (s: string | null) => (s ?? '').replace(/\D/g, '');
  const a = soloDigitos(socioDni);
  const b = soloDigitos(titularDni);
  if (!a || !b) return { ok: null, texto: 'No podemos verificar el titular: falta el DNI del socio o el de la cuenta.' };
  if (a === b) return { ok: true, texto: 'El titular de la cuenta es el socio.' };
  return { ok: false, texto: 'El DNI del titular NO coincide con el del socio. Revisá antes de transferir.' };
}

/**
 * Detalle de una solicitud: a dónde va la plata, a quién, y por qué mascota.
 *
 * Antes esto era solo el visor del comprobante y el club tenía que ir a Socios a
 * buscar el CBU. Ahora está todo lo necesario para resolver acá, incluido el
 * chequeo de titularidad, que no existía en ninguna pantalla.
 */
function DetalleReintegroModal({ row, onClose, onResolver, busy }: {
  row: ColaRow;
  onClose: () => void;
  onResolver: (status: 'acreditado' | 'rechazado') => void;
  busy: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!row.receiptPath) { setEstado('error'); return; }
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(row.receiptPath, 300);
      if (!vivo) return;
      if (error || !data) { setEstado('error'); return; }
      setUrl(data.signedUrl);
      setEstado('listo');
    })();
    return () => { vivo = false; };
  }, [row.receiptPath]);

  const esPdf = !!row.receiptPath?.toLowerCase().endsWith('.pdf');
  const titular = dniCoincide(row.socioDni, row.banco.titularDni);
  const tonoTitular = titular.ok === true
    ? { bg: 'rgb(226,245,234)', fg: 'rgb(47,143,91)', icono: '✓' }
    : titular.ok === false
      ? { bg: 'rgb(251,232,239)', fg: 'rgb(176,72,63)', icono: '✕' }
      : { bg: 'rgb(251,243,226)', fg: 'rgb(146,105,10)', icono: '?' };
  const sinCuenta = !row.banco.cbu && !row.banco.alias;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(33,30,51,0.6)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 20, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 19 }}>{row.socio}</div>
            <div style={{ fontSize: 13, color: '#8781a0' }}>{row.prestador} · {row.concepto} · {row.fecha}</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: '#f4f2f9', border: 'none', borderRadius: 9, width: 30, height: 30, cursor: 'pointer', color: '#5b5670', fontSize: 16, flex: '0 0 auto' }}>×</button>
        </div>

        <div style={{ background: 'rgb(240,237,249)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#5b5670' }}>Reintegro a acreditar</div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 30, color: 'rgb(93,84,145)' }}>{money(row.reintegro)}</div>
          <div style={{ fontSize: 12.5, color: '#5b5670' }}>{row.pct}% de {money(row.gastado)} · plan {row.plan}</div>
        </div>

        {/* Titularidad primero: es lo que decide si se transfiere o no. */}
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: tonoTitular.bg, borderRadius: 12, padding: '11px 13px', marginBottom: 16 }}>
          <span style={{ fontWeight: 800, color: tonoTitular.fg, flex: '0 0 auto' }}>{tonoTitular.icono}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: tonoTitular.fg, lineHeight: 1.45 }}>{titular.texto}</span>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 4 }}>DATOS DE LA TRANSFERENCIA</div>
        {sinCuenta
          ? <div style={{ fontSize: 13.5, color: 'rgb(176,72,63)', fontWeight: 600, padding: '10px 0' }}>La solicitud vino sin CBU ni alias. Pedíselos antes de aprobar.</div>
          : (
            <div style={{ marginBottom: 16 }}>
              {dato('Titular', row.banco.titular || '—')}
              {dato('DNI del titular', row.banco.titularDni || '—')}
              {dato('DNI del socio', row.socioDni || '—')}
              {dato('CUIT / CUIL', row.banco.cuit || '—')}
              {dato('Banco', row.banco.nombre || '—')}
              {dato('CBU / CVU', row.banco.cbu || '—')}
              {dato('Alias', row.banco.alias || '—')}
            </div>
          )}

        {row.mascota && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 4 }}>MASCOTA</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{row.mascota.nombre}</div>
              <div style={{ fontSize: 12.5, color: '#8781a0' }}>{row.mascota.info || 'sin datos'}</div>
            </div>
            {/* El carnet, para poder mirar preexistencias y plan sanitario sin
                cambiar de pantalla: es lo que discute un reintegro. */}
            {row.mascota.vacunas.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {row.mascota.vacunas.map((v, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid #eeecf5', fontSize: 13 }}>
                    <span>{v.nombre}</span>
                    <span style={{ color: v.estado === 'Aplicada' ? 'rgb(47,143,91)' : 'rgb(184,134,11)', fontWeight: 600 }}>{v.estado} · {v.cuando}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>
          COMPROBANTE{row.receiptNo ? ` · ${row.receiptNo}` : ''}
        </div>
        {estado === 'cargando' && <div style={{ padding: 40, textAlign: 'center', color: '#8781a0', fontSize: 14 }}>Cargando…</div>}
        {estado === 'error' && (
          <div style={{ padding: 30, textAlign: 'center', color: '#8781a0', fontSize: 14, background: '#faf9fd', borderRadius: 12 }}>
            {row.receiptPath ? 'No pudimos abrir el comprobante.' : 'Esta solicitud se cargó sin comprobante.'}
          </div>
        )}
        {estado === 'listo' && url && (esPdf
          ? <iframe src={url} title="Comprobante" style={{ width: '100%', height: 460, border: '1px solid #e6e3f0', borderRadius: 12 }} />
          : <img src={url} alt="Comprobante" style={{ width: '100%', borderRadius: 12, border: '1px solid #e6e3f0', display: 'block' }} />
        )}

        {/* Resolver desde acá: el club acaba de mirar todo lo que necesitaba. */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button disabled={busy} onClick={() => onResolver('acreditado')} style={{ flex: '1 1 260px', background: 'rgb(93,84,145)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14.5, padding: '13px 16px', borderRadius: 12, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: '"DM Sans"' }}>
            {busy ? 'Resolviendo…' : `Aprobar y transferir ${money(row.reintegro)}`}
          </button>
          <button disabled={busy} onClick={() => onResolver('rechazado')} style={{ flex: '0 0 auto', background: 'rgb(251,232,239)', border: 'none', color: 'rgb(193,77,122)', fontWeight: 700, fontSize: 14.5, padding: '13px 18px', borderRadius: 12, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: '"DM Sans"' }}>
            Rechazar solicitud
          </button>
        </div>
      </div>
    </div>
  );
}

function Reintegros({ cola, hist }: { cola: ColaRow[]; hist: HistRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ColaRow | null>(null);
  const [aviso, setAviso] = useState('');
  const [enVivo, setEnVivo] = useState(false);
  /** Lo que el propio panel acaba de resolver: su evento de Realtime no tiene
   *  que anunciarse como novedad, porque ya lo hizo esta pantalla. */
  const propios = useRef<Set<string>>(new Set());
  const [novedades, setNovedades] = useState(0);

  /*
   * La cola en vivo. Sin esto, dos personas del club revisando al mismo tiempo
   * se pisaban: la segunda seguía viendo una solicitud ya resuelta y la resolvía
   * de nuevo (mandándole al socio un segundo mail).
   *
   * No se refresca sola: se avisa y el refresco lo pide quien está mirando. Si la
   * lista se reordenara sola debajo del cursor, el botón "Aprobar" que se está a
   * punto de tocar podría pasar a ser el de otra solicitud.
   */
  useEffect(() => {
    const canal = subscribeTable(
      supabase,
      'reimbursements',
      (payload) => {
        const fila = (payload as { new?: { id?: string } } | null)?.new;
        if (fila?.id && propios.current.has(fila.id)) { propios.current.delete(fila.id); return; }
        setNovedades((n) => n + 1);
      },
      undefined,
      (estado) => setEnVivo(estado === 'SUBSCRIBED'),
    );
    return () => { void supabase.removeChannel(canal); };
  }, []);

  const verNovedades = () => { setNovedades(0); router.refresh(); };

  // Pasa por el endpoint (no por supabase directo) porque además de resolver le
  // manda el mail al socio, y la API key de Resend es solo de servidor.
  const act = async (id: string, status: 'acreditado' | 'rechazado') => {
    setBusyId(id);
    setAviso('');
    propios.current.add(id);
    try {
      const res = await fetch('/api/reintegros/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) setAviso(data.error ?? 'No pudimos resolver la solicitud.');
      else if (!data.mailEnviado) setAviso('Se resolvió, pero no salió el mail al socio. Avisale por otro canal.');
    } catch {
      setAviso('No pudimos resolver la solicitud. Revisá la conexión.');
    }
    router.refresh();
    setBusyId(null);
  };

  return (
    <div>
      {detalle && (
        <DetalleReintegroModal
          row={detalle}
          busy={busyId === detalle.id}
          onClose={() => setDetalle(null)}
          onResolver={async (status) => { await act(detalle.id, status); setDetalle(null); }}
        />
      )}
      <h1 className="adm-h1" style={h1}>Cola de reintegros</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <p style={{ ...sub, margin: 0 }}>Revisá y acreditá las solicitudes de los socios</p>
        {enVivo && (
          <span title="La cola se actualiza sola cuando entra o se resuelve una solicitud" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'rgb(47,143,91)', background: 'rgb(226,245,234)', borderRadius: 100, padding: '4px 10px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgb(47,143,91)' }} />
            En vivo
          </span>
        )}
      </div>
      {novedades > 0 && (
        <button onClick={verNovedades} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'rgb(240,237,249)', border: '1px solid rgb(223,217,242)', color: 'rgb(93,84,145)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, fontWeight: 600, marginBottom: 16, cursor: 'pointer', fontFamily: '"DM Sans"' }}>
          {novedades === 1 ? 'Hay un cambio nuevo en la cola' : `Hay ${novedades} cambios nuevos en la cola`} · Actualizar
        </button>
      )}
      {aviso && (
        <div style={{ background: 'rgb(251,243,226)', color: 'rgb(146,105,10)', border: '1px solid rgb(240,226,190)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>
          {aviso}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {cola.map((c) => (
          <div key={c.id} className="adm-queue-card" style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {c.socio}
                {c.flag && <span style={badge('rgb(251,243,226)', 'rgb(184,134,11)')}>{c.flag}</span>}
                {!c.receiptPath && <span style={badge('rgb(251,232,239)', 'rgb(193,77,122)')}>Sin comprobante</span>}
              </div>
              <div style={{ fontSize: 13, color: '#8781a0', marginTop: 3 }}>{c.prestador} · {c.concepto} · {c.fecha}</div>
            </div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#a29dba' }}>Gastado</div><div style={{ fontWeight: 700 }}>{money(c.gastado)}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#a29dba' }}>Reintegro</div><div style={{ fontWeight: 700, color: 'rgb(93,84,145)' }}>{money(c.reintegro)}</div></div>
            <div className="adm-queue-actions" style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDetalle(c)} style={{ background: '#fff', border: '1px solid #e6e3f0', color: c.receiptPath ? 'rgb(93,84,145)' : '#8781a0', fontWeight: 600, fontSize: 13, padding: '9px 14px', borderRadius: 10, cursor: 'pointer' }}>Ver detalle</button>
              <button disabled={busyId === c.id} onClick={() => act(c.id, 'rechazado')} style={{ background: 'rgb(251,232,239)', border: 'none', color: 'rgb(193,77,122)', fontWeight: 700, fontSize: 13, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', opacity: busyId === c.id ? 0.6 : 1 }}>Rechazar</button>
              <button disabled={busyId === c.id} onClick={() => act(c.id, 'acreditado')} style={{ background: 'rgb(93,84,145)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer', opacity: busyId === c.id ? 0.6 : 1 }}>Aprobar</button>
            </div>
          </div>
        ))}
        {cola.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#8781a0', padding: 30 }}>No hay solicitudes en cola 🎉</div>}
      </div>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18, marginBottom: 2 }}>Historial de reintegros</div>
      <p style={{ color: '#8781a0', fontSize: 14, margin: '0 0 12px' }}>Solicitudes ya resueltas</p>
      <div className="adm-tablewrap" style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['SOCIO', 'PRESTADOR', 'CONCEPTO', 'GASTADO', 'REINTEGRO', 'ESTADO'].map((hd) => <th key={hd} style={th}>{hd}</th>)}</tr></thead>
          <tbody>
            {hist.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td, fontWeight: 600 }}>{r.socio}</td>
                <td style={td}>{r.prestador}</td>
                <td style={{ ...td, color: '#8781a0' }}>{r.concepto}</td>
                <td style={td}>{money(r.gastado)}</td>
                <td style={{ ...td, fontWeight: 700, color: 'rgb(93,84,145)' }}>{money(r.reintegro)}</td>
                <td style={td}><span style={estadoBadge(r.estado)}>{r.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {hist.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#8781a0' }}>Todavía no hay reintegros resueltos.</div>}
      </div>
    </div>
  );
}

/* ── Beneficios ────────────────────────────────────────────────── */
/** Categorías y alcances que ya usa el catálogo, para no inventar variantes. */
const BENEFIT_CATEGORIAS = ['Consultas y estudios', 'Cirugías y guardias', 'Alimentos y accesorios', 'Alimentos premium', 'Baño y estética'];
const BENEFIT_PLANES = ['Todos los planes', 'Amigo, Familia, VIP', 'Familia, VIP', 'VIP'];

const BENEFIT_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Alta y edición de un beneficio, en el mismo formulario.
 *
 * Antes solo se podía crear y pausar: un descuento mal cargado se pausaba y se
 * volvía a crear. Y el alta no pedía días, horario ni vigencia, que la tabla ya
 * guardaba y la ficha del socio muestra: un beneficio creado desde el panel salía
 * a la app con esos tres renglones vacíos.
 */
function BeneficioModal({ benefit, onClose, onSaved }: { benefit: BenefitAdminVM | null; onClose: () => void; onSaved: () => void }) {
  const editando = !!benefit;
  const [name, setName] = useState(benefit?.name ?? '');
  const [category, setCategory] = useState(benefit?.category ?? BENEFIT_CATEGORIAS[0]!);
  const [discount, setDiscount] = useState(benefit?.discount ?? '');
  const [planRequirement, setPlanRequirement] = useState(benefit?.planRequirement ?? BENEFIT_PLANES[0]!);
  const [description, setDescription] = useState(benefit?.description ?? '');
  const [zone, setZone] = useState(benefit?.zone ?? '');
  const [hours, setHours] = useState(benefit?.hours ?? '');
  const [validUntil, setValidUntil] = useState(benefit?.validUntil ?? '');
  const [days, setDays] = useState<string[]>(benefit?.days ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleDia = (d: string) => setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  const guardar = async () => {
    if (!name.trim()) { setError('Poné el nombre del comercio.'); return; }
    if (!discount.trim()) { setError('Poné el descuento (ej: -20%).'); return; }
    setBusy(true); setError('');
    const fila = {
      name: name.trim(), category, discount: discount.trim(), plan_requirement: planRequirement,
      description: description.trim(), zone: zone.trim(), hours: hours.trim(),
      // Los días se guardan en el orden de la semana y no en el que se tocaron.
      days: BENEFIT_DIAS.filter((d) => days.includes(d)),
      valid_until: validUntil || null,
    };
    const { error: e } = editando
      ? await supabase.from('benefits').update(fila).eq('id', benefit!.id)
      : await supabase.from('benefits').insert({ ...fila, status: 'activo' });
    if (e) { setError('No pudimos guardarlo. Probá de nuevo.'); setBusy(false); return; }
    onSaved();
    onClose();
  };

  return (
    <Modal
      title={editando ? `Editar ${benefit!.name}` : 'Nuevo beneficio'}
      sub={editando ? 'Los cambios se ven en la app enseguida.' : 'Se publica activo y ya se ve en la app de los socios.'}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={fieldLabel}>COMERCIO</label>
          <input value={name} onChange={(e) => { setName(e.target.value); setError(''); }} style={inp} placeholder="Veterinaria del Parque" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={fieldLabel}>CATEGORÍA</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inp}>
              {BENEFIT_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>DESCUENTO</label>
            <input value={discount} onChange={(e) => { setDiscount(e.target.value); setError(''); }} style={inp} placeholder="-20%" />
          </div>
        </div>
        <div>
          <label style={fieldLabel}>PARA QUÉ PLANES</label>
          <select value={planRequirement} onChange={(e) => setPlanRequirement(e.target.value)} style={inp}>
            {BENEFIT_PLANES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>ZONA</label>
          <input value={zone} onChange={(e) => setZone(e.target.value)} style={inp} placeholder="Palermo" />
        </div>
        {/* Los tres que faltaban. La ficha del socio los muestra, así que sin
            esto el beneficio salía a la app incompleto. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={fieldLabel}>HORARIO</label>
            <input value={hours} onChange={(e) => setHours(e.target.value)} style={inp} placeholder="9 a 18 h" />
          </div>
          <div>
            <label style={fieldLabel}>VIGENTE HASTA</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={inp} />
          </div>
        </div>
        <div>
          <label style={fieldLabel}>DÍAS CON DESCUENTO</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BENEFIT_DIAS.map((d) => (
              <button key={d} onClick={() => toggleDia(d)} style={{ border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 12.5, padding: '7px 12px', borderRadius: 100, background: days.includes(d) ? 'rgb(93,84,145)' : 'rgb(240,237,249)', color: days.includes(d) ? '#fff' : 'rgb(93,84,145)' }}>{d}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#a29dba', margin: '6px 0 0' }}>{days.length === 0 ? 'Sin días marcados, el socio lo ve como "todos los días".' : `${days.length} de 7`}</p>
        </div>
        <div>
          <label style={fieldLabel}>DETALLE</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Qué incluye el beneficio." />
        </div>
        {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button disabled={busy} onClick={guardar} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear beneficio'}</button>
        </div>
      </div>
    </Modal>
  );
}

function Beneficios({ benefits }: { benefits: BenefitAdminVM[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  /** null = cerrado; 'nuevo' = alta; un beneficio = edición. */
  const [modal, setModal] = useState<'nuevo' | BenefitAdminVM | null>(null);
  const [aviso, setAviso] = useState('');
  const toggle = async (id: string, status: string) => {
    setBusyId(id);
    await supabase.from('benefits').update({ status: status === 'activo' ? 'pausado' : 'activo' }).eq('id', id);
    router.refresh();
    setBusyId(null);
  };
  /*
   * Eliminar es distinto de pausar y conviene que se note: pausado deja de verse
   * en la app y se puede volver a activar; eliminado no vuelve. Por eso está
   * abajo del menú, en rojo, y pide confirmación con el nombre adentro.
   */
  const eliminar = async (b: BenefitAdminVM) => {
    setBusyId(b.id); setAviso('');
    const { error } = await supabase.from('benefits').delete().eq('id', b.id);
    if (error) setAviso('No pudimos eliminarlo. Probá de nuevo.');
    else setAviso(`"${b.name}" se eliminó.`);
    router.refresh();
    setBusyId(null);
  };
  return (
    <div>
      {modal && <BeneficioModal benefit={modal === 'nuevo' ? null : modal} onClose={() => setModal(null)} onSaved={() => router.refresh()} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div><h1 className="adm-h1" style={{ ...h1, margin: 0 }}>Beneficios</h1><p style={{ ...sub, margin: '4px 0 0' }}>Comercios y descuentos de la red.</p></div>
        <button onClick={() => setModal('nuevo')} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, padding: '11px 18px', borderRadius: 12, cursor: 'pointer' }}>+ Nuevo beneficio</button>
      </div>
      <Aviso texto={aviso} />
      <div className="adm-tablewrap" style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['COMERCIO', 'CATEGORÍA', 'DESCUENTO', 'PLANES', 'ESTADO', 'ACCIÓN'].map((hd, i) => <th key={i} style={th}>{hd}</th>)}</tr></thead>
          <tbody>
            {benefits.map((b) => (
              <tr key={b.id}>
                <td style={{ ...td, fontWeight: 600 }}>{b.name}</td>
                <td style={{ ...td, color: '#8781a0' }}>{b.category}</td>
                <td style={td}><span style={badge('rgb(225,251,98)', 'rgb(33,30,51)')}>{b.discount}</span></td>
                <td style={{ ...td, color: '#8781a0', fontSize: 12.5 }}>{b.planRequirement}</td>
                <td style={td}><span style={estadoBadge(b.status === 'activo' ? 'Activo' : 'Pausado')}>{b.status === 'activo' ? 'Activo' : 'Pausado'}</span></td>
                <td style={td}>
                  <MenuAcciones
                    disabled={busyId === b.id}
                    acciones={[
                      { label: 'Editar', onClick: () => setModal(b) },
                      b.status === 'activo'
                        ? { label: 'Pausar', onClick: () => toggle(b.id, b.status) }
                        : { label: 'Activar', onClick: () => toggle(b.id, b.status) },
                      {
                        label: 'Eliminar',
                        destructiva: true,
                        confirmar: `¿Eliminar "${b.name}"? No se puede deshacer. Si solo querés que deje de verse en la app, usá Pausar.`,
                        onClick: () => eliminar(b),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Planes ────────────────────────────────────────────────────── */
function EditarPlanModal({ plan, onClose, onSaved }: { plan: PlanAdminVM; onClose: () => void; onSaved: () => void }) {
  const [price, setPrice] = useState(String(plan.basePrice));
  const [tagline, setTagline] = useState(plan.tagline);
  // Un beneficio por línea: es la forma más simple de editar un array de textos.
  const [perks, setPerks] = useState(plan.perks.join('\n'));
  const [featured, setFeatured] = useState(plan.featured);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    const n = Number(price.replace(/\D/g, ''));
    if (!n) { setError('El precio tiene que ser un número.'); return; }
    setBusy(true); setError('');
    const lista = perks.split('\n').map((l) => l.trim()).filter(Boolean);
    const { error: e } = await supabase.from('plans')
      .update({ base_price: n, tagline: tagline.trim(), perks: lista, featured })
      .eq('id', plan.id);
    if (e) { setError('No pudimos guardar los cambios.'); setBusy(false); return; }
    onSaved();
    onClose();
  };

  return (
    <Modal title={`Plan ${plan.name}`} sub="Los cambios se ven en la web y en la app enseguida." onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={fieldLabel}>PRECIO POR MES (ARS)</label>
            <input value={price} onChange={(e) => { setPrice(e.target.value); setError(''); }} style={inp} inputMode="numeric" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#5b5670', cursor: 'pointer', paddingBottom: 11 }}>
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              Destacado
            </label>
          </div>
        </div>
        <div>
          <label style={fieldLabel}>BAJADA</label>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} style={inp} placeholder="El favorito de los socios" />
        </div>
        <div>
          <label style={fieldLabel}>BENEFICIOS · UNO POR LÍNEA</label>
          <textarea value={perks} onChange={(e) => setPerks(e.target.value)} rows={7} style={{ ...inp, resize: 'vertical', fontFamily: '"DM Sans"', lineHeight: 1.6 }} />
          <p style={{ fontSize: 12, color: '#a29dba', margin: '6px 0 0' }}>{perks.split('\n').filter((l) => l.trim()).length} beneficios</p>
        </div>
        {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button disabled={busy} onClick={guardar} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </Modal>
  );
}

function Planes({ plans }: { plans: PlanAdminVM[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<PlanAdminVM | null>(null);
  return (
    <div>
      {editando && <EditarPlanModal plan={editando} onClose={() => setEditando(null)} onSaved={() => router.refresh()} />}
      <h1 className="adm-h1" style={h1}>Planes</h1>
      <p style={sub}>Editá precios, descripciones y beneficios. Los cambios se reflejan en la landing.</p>
      <div className="adm-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {plans.map((p) => (
          <div key={p.id} style={{ ...card, padding: 22, ...(p.featured ? { border: '2px solid rgb(93,84,145)' } : {}) }}>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18, color: 'rgb(93,84,145)' }}>{p.name}</div>
            <div style={{ fontSize: 13, color: '#8781a0', marginBottom: 12 }}>{p.tagline}</div>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 30 }}>{money(p.basePrice)}</div>
            <div style={{ fontSize: 12.5, color: '#8781a0', marginBottom: 16 }}>por mes · {p.perks.length} beneficios</div>
            <button onClick={() => setEditando(p)} style={{ width: '100%', background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontWeight: 700, fontSize: 14, padding: 11, borderRadius: 11, cursor: 'pointer' }}>Editar plan</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── FAQ ───────────────────────────────────────────────────────── */
function FaqRow({ faq, index, onChanged }: { faq: FaqVM; index: number; onChanged: () => void }) {
  const [q, setQ] = useState(faq.question);
  const [a, setA] = useState(faq.answer);
  const [saved, setSaved] = useState(true);
  const save = async () => {
    await supabase.from('faqs').update({ question: q, answer: a }).eq('id', faq.id);
    setSaved(true);
    onChanged();
  };
  const del = async () => {
    await supabase.from('faqs').delete().eq('id', faq.id);
    onChanged();
  };
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em' }}>PREGUNTA {index + 1}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, color: 'rgb(47,143,91)', fontWeight: 600 }}>✓ Guardado</span>}
          <button onClick={del} style={{ background: 'none', border: 'none', color: 'rgb(193,77,122)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Eliminar</button>
        </div>
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setSaved(false); }} onBlur={save} style={{ ...inp, fontWeight: 700, marginBottom: 8 }} placeholder="Pregunta" />
      <textarea value={a} onChange={(e) => { setA(e.target.value); setSaved(false); }} onBlur={save} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Respuesta" />
    </div>
  );
}
function FaqAdmin({ faqs }: { faqs: FaqVM[] }) {
  const router = useRouter();
  const add = async () => {
    await supabase.from('faqs').insert({ question: '', answer: '', order: faqs.length });
    router.refresh();
  };
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Preguntas frecuentes</h1>
      <p style={sub}>Editá las preguntas y respuestas que se muestran en la landing.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {faqs.map((f, i) => <FaqRow key={f.id} faq={f} index={i} onChanged={() => router.refresh()} />)}
      </div>
      <button onClick={add} style={{ marginTop: 14, background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontWeight: 700, fontSize: 14, padding: '11px 18px', borderRadius: 12, cursor: 'pointer' }}>+ Agregar pregunta</button>
    </div>
  );
}

/* ── Push ──────────────────────────────────────────────────────── */
function Push({ audiences, sent }: { audiences: AudienceVM[]; sent: SentPushVM[] }) {
  const router = useRouter();
  const [aud, setAud] = useState(0);
  const [titulo, setTitulo] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState('');
  /*
   * Envía de verdad: la ruta resuelve los tokens de la audiencia y le pega a la
   * Expo Push API. Antes esto insertaba una fila y decía "Enviadas" sin que nada
   * saliera a ningún teléfono.
   *
   * El resultado se muestra tal cual —a cuántos llegó y a cuántos no— porque un
   * "listo" sobre cero dispositivos es la misma mentira de antes con otra cara.
   */
  const send = async () => {
    if (!titulo.trim() || busy) return;
    setBusy(true); setAviso('');
    try {
      const res = await fetch('/api/push/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, cuerpo: msg, audiencia: audiences[aud]?.label ?? 'Todos los socios' }),
      });
      const data = await res.json();
      if (!res.ok) setAviso(data.error ?? 'No pudimos enviar el aviso.');
      else if (data.entregados === 0) setAviso(`Quedó guardado, pero no llegó a ningún teléfono${data.dispositivos === 0 ? ': todavía nadie tiene la app con notificaciones activadas.' : `. ${data.detalle?.[0] ?? ''}`}`);
      else setAviso(`Llegó a ${data.entregados} dispositivo${data.entregados === 1 ? '' : 's'}${data.fallados ? ` · ${data.fallados} sin entregar` : ''}.`);
      if (res.ok) { setTitulo(''); setMsg(''); }
    } catch {
      setAviso('No pudimos enviar el aviso. Revisá la conexión.');
    }
    router.refresh();
    setBusy(false);
  };
  /** Saca un aviso del historial. Lo que ya llegó a los teléfonos no se puede
   *  volver atrás: esto limpia la lista del panel, nada más. */
  const borrar = async (id: string) => {
    const { error } = await supabase.from('push_notifications').delete().eq('id', id);
    setAviso(error ? 'No pudimos borrarlo. Probá de nuevo.' : 'Lo saqué del historial.');
    router.refresh();
  };
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Notificaciones push</h1>
      <p style={sub}>Enviá avisos a los socios directo a su celular.</p>
      <Aviso texto={aviso} />
      <div className="adm-push" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 10 }}>AUDIENCIA</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {audiences.map((a, i) => (
              <button key={a.label} onClick={() => setAud(i)} style={{ textAlign: 'left', border: '1.5px solid ' + (aud === i ? 'rgb(93,84,145)' : '#e6e3f0'), background: aud === i ? '#faf9fd' : '#fff', borderRadius: 12, padding: '11px 13px', cursor: 'pointer' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.label}</div>
                <div style={{ fontSize: 11.5, color: '#8781a0' }}>{a.n.toLocaleString('es-AR')} destinatarios</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>TÍTULO</div>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ ...inp, marginBottom: 12 }} placeholder="Título de la notificación" />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>MENSAJE</div>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', marginBottom: 14 }} placeholder="Acá va el texto que van a leer los socios." />
          <button disabled={busy} onClick={send} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, padding: '13px 20px', borderRadius: 12, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Enviar a {audiences[aud]?.label ?? 'Todos los socios'}</button>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 10 }}>VISTA PREVIA</div>
          <div style={{ background: '#211e33', borderRadius: 18, padding: 18, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 14, display: 'flex', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgb(93,84,145)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Baloo 2"', fontWeight: 800, flex: '0 0 auto' }}>K</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}><span style={{ fontWeight: 700, fontSize: 12 }}>KUMO</span><span style={{ fontSize: 11, color: '#a29dba' }}>ahora</span></div>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>{titulo || 'Título de la notificación'}</div>
                <div style={{ fontSize: 12.5, color: '#5b5670', marginTop: 2 }}>{msg || 'Acá va el texto que van a leer los socios.'}</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 10 }}>ENVIADAS</div>
          {sent.length === 0 ? <div style={{ fontSize: 13, color: '#8781a0' }}>Todavía no enviaste ninguna.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sent.map((s) => (
                <div key={s.id} style={{ ...card, padding: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: '#8781a0' }}>→ {s.audience} · {s.when}</div>
                  </div>
                  <MenuAcciones acciones={[{
                    label: 'Borrar del historial',
                    destructiva: true,
                    // Se aclara que el aviso ya salió: borrar la fila limpia esta
                    // lista, no la notificación que la gente ya tiene en el celular.
                    confirmar: `¿Borrar "${s.title}" del historial? El aviso ya salió a los celulares: esto solo lo saca de esta lista.`,
                    onClick: () => borrar(s.id),
                  }]} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Ajustes ───────────────────────────────────────────────────── */
function Ajustes({ settings }: { settings: SettingsVM }) {
  const router = useRouter();
  const [wa, setWa] = useState(settings.whatsapp);
  const [mail, setMail] = useState(settings.email);
  const [savedWa, setSavedWa] = useState(true);
  const [savedMail, setSavedMail] = useState(true);
  const inpWide: CSSProperties = { ...inp, maxWidth: 420 };
  const gLabel = (t: string, saved: boolean) => <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em' }}>{t}</span>{saved && <span style={{ fontSize: 12, color: 'rgb(47,143,91)', fontWeight: 600 }}>✓ Guardado</span>}</div>;
  const saveWa = async () => { await supabase.from('club_settings').update({ whatsapp: wa }).eq('id', 1); setSavedWa(true); router.refresh(); };
  const saveMail = async () => { await supabase.from('club_settings').update({ email: mail }).eq('id', 1); setSavedMail(true); router.refresh(); };
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Ajustes</h1>
      <p style={sub}>Datos de contacto del club.</p>
      <div style={{ ...card, maxWidth: 520, marginBottom: 16 }}>
        {gLabel('WHATSAPP DE CONTACTO', savedWa)}
        <input value={wa} onChange={(e) => { setWa(e.target.value); setSavedWa(false); }} onBlur={saveWa} style={inpWide} />
        <p style={{ fontSize: 12.5, color: '#8781a0', margin: '8px 0 0' }}>Se usa en el botón flotante de WhatsApp de la landing.</p>
      </div>
      <div style={{ ...card, maxWidth: 520 }}>
        {gLabel('MAIL DE CONTACTO', savedMail)}
        <input value={mail} onChange={(e) => { setMail(e.target.value); setSavedMail(false); }} onBlur={saveMail} style={inpWide} />
        <p style={{ fontSize: 12.5, color: '#8781a0', margin: '8px 0 0' }}>Se muestra en el footer de la landing y en la página legal, y es el remitente de los mails a los socios.</p>
      </div>
    </div>
  );
}

/* ── Prestadores / Negocios (misma tabla, distinto recorte) ────── */

/**
 * Publica o rechaza un negocio, y de paso le avisa al dueño por mail.
 *
 * Pasa por el endpoint y no por supabase directo por lo mismo que los
 * reintegros: la API key de Resend es de servidor, y resolver sin avisar dejaba
 * al prestador mirando "en revisión" cuando ya estaba publicado.
 *
 * Devuelve el motivo cuando el mail no salió — el caso más común no es un error
 * sino un negocio que el club cargó a mano y no tiene cuenta asociada, así que no
 * hay a quién escribirle.
 */
async function resolverNegocio(id: string, status: 'verificado' | 'rechazado'): Promise<string> {
  try {
    const res = await fetch('/api/prestadores/resolver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? 'No pudimos actualizar el negocio.';
    if (!data.mailEnviado) return data.motivo ?? 'Se guardó, pero no salió el mail al prestador. Avisale por otro canal.';
    return '';
  } catch {
    return 'No pudimos actualizar el negocio. Revisá la conexión.';
  }
}

/**
 * La ficha de un prestador, que es la misma para Prestadores y para Negocios: es
 * la misma tabla mirada con dos criterios distintos.
 *
 * Existe porque las dos pantallas pedían verificar a ciegas: la tabla mostraba
 * nombre, rubro y zona, y el botón "Verificar" estaba al lado sin nada para
 * mirar. Acá está lo que el club tiene para decidir — quién está detrás, cómo se
 * lo contacta y qué dice de sí mismo — y desde acá se resuelve.
 *
 * Lo que sigue faltando es la documentación (matrícula, habilitación): no hay
 * dónde guardarla todavía, y el aviso lo dice en vez de fingir que se validó.
 */
function FichaPrestadorModal({ p, onClose, onResolver, busy }: {
  p: ProviderAdminRow;
  onClose: () => void;
  onResolver: (status: 'verificado' | 'rechazado') => void;
  busy: boolean;
}) {
  const contacto: [string, string | null][] = [
    ['Teléfono', p.telefono],
    ['Instagram', p.instagram],
    ['Web', p.web],
    ['Dirección', p.direccion],
  ];
  return (
    <Modal title={p.nombre} sub={`${p.rubro} · ${p.zona}`} onClose={onClose} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={estadoBadge(p.estado)}>{p.estado}</span>
          <span style={{ fontSize: 13, color: '#8781a0' }}>
            {p.reseñas > 0 ? `★ ${p.rating} · ${p.reseñas} reseña${p.reseñas === 1 ? '' : 's'}` : 'Sin reseñas todavía'}
          </span>
          {p.precio && <span style={badge('rgb(240,237,249)', 'rgb(93,84,145)')}>{p.precio}</span>}
        </div>

        <div>
          <div style={fieldLabel}>QUIÉN ESTÁ DETRÁS</div>
          {p.dueño
            ? (<>{dato('Titular de la cuenta', p.dueño.nombre)}{dato('Mail', p.dueño.email)}</>)
            : (
              <div style={{ fontSize: 13.5, color: 'rgb(146,105,10)', fontWeight: 600, lineHeight: 1.5 }}>
                Sin cuenta asociada: lo cargó el club a mano. Nadie puede editar esta ficha
                salvo ustedes, y no hay a quién avisarle por mail cuando se resuelva.
              </div>
            )}
        </div>

        <div>
          <div style={fieldLabel}>CONTACTO</div>
          {contacto.some(([, v]) => v)
            ? contacto.filter(([, v]) => v).map(([k, v]) => dato(k, v!))
            : <div style={{ fontSize: 13.5, color: 'rgb(176,72,63)', fontWeight: 600 }}>No dejó ningún dato de contacto. Difícil de validar así.</div>}
        </div>

        <div>
          <div style={fieldLabel}>QUÉ OFRECE</div>
          <p style={{ fontSize: 13.5, color: '#5b5670', lineHeight: 1.6, margin: 0 }}>
            {p.about?.trim() || 'No escribió una descripción.'}
          </p>
        </div>

        <div style={{ background: 'rgb(251,243,226)', color: 'rgb(146,105,10)', border: '1px solid rgb(240,226,190)', borderRadius: 12, padding: '11px 13px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
          La documentación (matrícula, habilitación, seguro) todavía no se puede adjuntar:
          no hay dónde guardarla. Por ahora se valida con estos datos y lo que sepan por fuera.
        </div>

        {p.estado === 'Pendiente' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button disabled={busy} onClick={() => onResolver('verificado')} style={{ ...btnPrimary, flex: '1 1 200px', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Guardando…' : 'Verificar y publicar'}
            </button>
            <button disabled={busy} onClick={() => onResolver('rechazado')} style={{ background: 'rgb(251,232,239)', border: 'none', color: 'rgb(193,77,122)', fontWeight: 700, fontSize: 14, padding: '12px 18px', borderRadius: 11, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: '"DM Sans"' }}>
              Rechazar
            </button>
          </div>
        )}
        {p.estado === 'Rechazado' && (
          <button disabled={busy} onClick={() => onResolver('verificado')} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Guardando…' : 'Reconsiderar y publicar'}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Cartel de aviso del panel (mismo estilo que el de la cola de reintegros). */
function Aviso({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <div style={{ background: 'rgb(251,243,226)', color: 'rgb(146,105,10)', border: '1px solid rgb(240,226,190)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>
      {texto}
    </div>
  );
}

function Prestadores({ providers }: { providers: ProviderAdminRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [ficha, setFicha] = useState<ProviderAdminRow | null>(null);
  /** Sin rechazo, una solicitud que no pasa la validación quedaba pendiente para
   *  siempre: el socio nunca se enteraba y al club le quedaba en la cola. */
  const resolver = async (id: string, status: 'verificado' | 'rechazado') => {
    setBusyId(id);
    setAviso(await resolverNegocio(id, status));
    router.refresh();
    setBusyId(null);
  };
  return (
    <div>
      {ficha && (
        <FichaPrestadorModal
          p={ficha}
          busy={busyId === ficha.id}
          onClose={() => setFicha(null)}
          onResolver={async (status) => { await resolver(ficha.id, status); setFicha(null); }}
        />
      )}
      <h1 className="adm-h1" style={h1}>Prestadores</h1>
      <p style={sub}>Validá la identidad y documentación de quienes ofrecen servicios · tocá una fila para ver la ficha</p>
      <Aviso texto={aviso} />
      <div className="adm-tablewrap" style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['NOMBRE', 'RUBRO', 'ZONA', 'RATING', 'ESTADO', ''].map((hd, i) => <th key={i} style={th}>{hd}</th>)}</tr></thead>
          <tbody>
            {providers.map((r) => (
              <tr key={r.id} className="adm-row" onClick={() => setFicha(r)} style={{ cursor: 'pointer' }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.nombre}</td>
                <td style={{ ...td, color: '#8781a0' }}>{r.rubro}</td>
                <td style={td}>{r.zona}</td>
                <td style={td}>{r.rating !== '—' ? `★ ${r.rating}` : '—'}</td>
                <td style={td}><span style={estadoBadge(r.estado)}>{r.estado}</span></td>
                {/* Los botones paran el clic: si burbujeara, resolver también
                    abriría la ficha de la fila. */}
                <td style={td}>{r.estado === 'Pendiente' && (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button disabled={busyId === r.id} onClick={(e) => { e.stopPropagation(); resolver(r.id, 'verificado'); }} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12.5, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', opacity: busyId === r.id ? 0.6 : 1 }}>Verificar</button>
                    <button disabled={busyId === r.id} onClick={(e) => { e.stopPropagation(); resolver(r.id, 'rechazado'); }} style={{ background: 'rgb(251,232,239)', color: 'rgb(193,77,122)', border: 'none', fontWeight: 700, fontSize: 12.5, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', opacity: busyId === r.id ? 0.6 : 1 }}>Rechazar</button>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {providers.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#8781a0' }}>Todavía no hay prestadores.</div>}
      </div>
    </div>
  );
}

function Negocios({ providers }: { providers: ProviderAdminRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [ficha, setFicha] = useState<ProviderAdminRow | null>(null);
  const pendientes = providers.filter((r) => r.estado === 'Pendiente');
  const resolver = async (id: string, status: 'verificado' | 'rechazado') => {
    setBusyId(id);
    setAviso(await resolverNegocio(id, status));
    router.refresh();
    setBusyId(null);
  };
  return (
    <div>
      {ficha && (
        <FichaPrestadorModal
          p={ficha}
          busy={busyId === ficha.id}
          onClose={() => setFicha(null)}
          onResolver={async (status) => { await resolver(ficha.id, status); setFicha(null); }}
        />
      )}
      <h1 className="adm-h1" style={h1}>Negocios</h1>
      <p style={sub}>{pendientes.length} solicitudes de alta pendientes de validación · tocá una fila para ver la ficha</p>
      <Aviso texto={aviso} />
      <div className="adm-tablewrap" style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['NOMBRE', 'RUBRO', 'ZONA', 'SOLICITADO', 'ESTADO', ''].map((hd, i) => <th key={i} style={th}>{hd}</th>)}</tr></thead>
          <tbody>
            {providers.map((r) => (
              <tr key={r.id} className="adm-row" onClick={() => setFicha(r)} style={{ cursor: 'pointer' }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.nombre}</td>
                <td style={{ ...td, color: '#8781a0' }}>{r.rubro}</td>
                <td style={td}>{r.zona}</td>
                <td style={{ ...td, color: '#8781a0' }}>{r.solicitado}</td>
                <td style={td}><span style={estadoBadge(r.estado)}>{r.estado}</span></td>
                <td style={td}>{r.estado === 'Pendiente' && (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button disabled={busyId === r.id} onClick={(e) => { e.stopPropagation(); resolver(r.id, 'verificado'); }} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12.5, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', opacity: busyId === r.id ? 0.6 : 1 }}>Validar</button>
                    <button disabled={busyId === r.id} onClick={(e) => { e.stopPropagation(); resolver(r.id, 'rechazado'); }} style={{ background: 'rgb(251,232,239)', color: 'rgb(193,77,122)', border: 'none', fontWeight: 700, fontSize: 12.5, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', opacity: busyId === r.id ? 0.6 : 1 }}>Rechazar</button>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {providers.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#8781a0' }}>Todavía no hay negocios.</div>}
      </div>
    </div>
  );
}

/* ── Moderación ────────────────────────────────────────────────── */
function Moderacion({ reports }: { reports: ReportRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const keep = async (id: string) => {
    setBusyId(id);
    // Se limpia el motivo: si mañana lo reportan de nuevo, el club tiene que
    // leer el motivo nuevo y no el de la vez pasada.
    await supabase.from('community_posts').update({ reported: false, report_reason: null }).eq('id', id);
    router.refresh();
    setBusyId(null);
  };
  const remove = async (id: string) => {
    setBusyId(id);
    await supabase.from('community_posts').delete().eq('id', id);
    router.refresh();
    setBusyId(null);
  };
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Moderación</h1>
      <p style={sub}>Publicaciones reportadas por la comunidad</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reports.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={badge('rgb(240,237,249)', 'rgb(93,84,145)')}>{r.cat}</span>
              <span style={{ fontSize: 12.5, color: '#8781a0' }}>{r.autor}</span>
            </div>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{r.titulo}</div>
            <div style={{ fontSize: 12.5, color: 'rgb(193,77,122)', fontWeight: 600, marginBottom: 12 }}>⚑ {r.motivo}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={busyId === r.id} onClick={() => keep(r.id)} style={{ background: '#fff', border: '1px solid #e6e3f0', color: '#5b5670', fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer', opacity: busyId === r.id ? 0.6 : 1 }}>Mantener</button>
              <button disabled={busyId === r.id} onClick={() => remove(r.id)} style={{ background: 'rgb(251,232,239)', border: 'none', color: 'rgb(193,77,122)', fontWeight: 700, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer', opacity: busyId === r.id ? 0.6 : 1 }}>Eliminar</button>
            </div>
          </div>
        ))}
        {reports.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#8781a0', padding: 30 }}>No hay publicaciones reportadas 🎉</div>}
      </div>
    </div>
  );
}

/* ── Shell ─────────────────────────────────────────────────────── */
export default function AppClient({
  profile, kpi, dist, socios, cola, hist, benefits, plans, faqs, settings, providers, reports, audiences, sent,
}: {
  profile: AdminProfile; kpi: KpiVM; dist: DistRow[]; socios: SocioRow[]; cola: ColaRow[]; hist: HistRow[];
  benefits: BenefitAdminVM[]; plans: PlanAdminVM[]; faqs: FaqVM[]; settings: SettingsVM;
  providers: ProviderAdminRow[]; reports: ReportRow[]; audiences: AudienceVM[]; sent: SentPushVM[];
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const go = (s: Screen) => { setScreen(s); setNavOpen(false); };
  const logout = async () => { await supabase.auth.signOut(); router.push(urls.landing); };
  const current = NAV.find((n) => n.k === screen);
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Barra superior (solo abajo de 1024px) */}
      <div className="adm-topbar">
        <button onClick={() => setNavOpen(true)} aria-label="Abrir menú" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}>
          {icons.menu}
        </button>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 19 }}>Kumo</div>
        <div style={{ fontSize: 13, color: 'rgb(195,190,219)', marginLeft: 'auto' }}>{current?.label}</div>
      </div>
      {navOpen && <button className="adm-scrim" aria-label="Cerrar menú" onClick={() => setNavOpen(false)} />}
      {/* Sidebar */}
      <div className={navOpen ? 'adm-side adm-side-open' : 'adm-side'} style={{ width: 236, flex: '0 0 auto', background: 'rgb(33,30,51)', color: '#fff', display: 'flex', flexDirection: 'column', padding: '22px 16px', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box' }}>
        <div style={{ padding: '0 8px 20px' }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 26 }}>Kumo</div>
          <div style={{ fontSize: 12, color: 'rgb(140,134,168)' }}>Panel del club</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflowY: 'auto' }}>
          {NAV.map((n) => {
            const active = screen === n.k;
            return (
              <button key={n.k} onClick={() => go(n.k)} className={active ? undefined : 'adm-nav'} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, width: '100%', textAlign: 'left', transition: 'background 0.15s', background: active ? 'rgb(93,84,145)' : 'transparent', color: active ? '#fff' : 'rgb(195,190,219)' }}>
                {n.icon}<span>{n.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'rgb(140,134,168)' }}>Administrador/a</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{profile.fullName}</div>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'rgb(195,190,219)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>Cerrar sesión</button>
        </div>
      </div>
      {/* Main */}
      <div style={{ flex: '1 1 0%', minWidth: 0 }}>
        <div className="adm-main" style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 40px 60px' }}>
          {screen === 'dashboard' && <Dashboard go={go} kpi={kpi} dist={dist} />}
          {screen === 'socios' && <Socios socios={socios} />}
          {screen === 'reintegros' && <Reintegros cola={cola} hist={hist} />}
          {screen === 'beneficios' && <Beneficios benefits={benefits} />}
          {screen === 'planes' && <Planes plans={plans} />}
          {screen === 'faq' && <FaqAdmin faqs={faqs} />}
          {screen === 'push' && <Push audiences={audiences} sent={sent} />}
          {screen === 'ajustes' && <Ajustes settings={settings} />}
          {screen === 'prestadores' && <Prestadores providers={providers} />}
          {screen === 'negocios' && <Negocios providers={providers} />}
          {screen === 'moderacion' && <Moderacion reports={reports} />}
        </div>
      </div>
    </div>
  );
}
