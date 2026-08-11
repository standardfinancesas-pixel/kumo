'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { urls } from '@kumo/shared';
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
export type SocioRow = { n: string; nombre: string; mascota: string; plan: string; desde: string; estado: string };
export type ColaRow = { id: string; socio: string; prestador: string; concepto: string; fecha: string; gastado: number; reintegro: number; flag?: string; receiptPath: string | null };
export type HistRow = { socio: string; prestador: string; concepto: string; gastado: number; reintegro: number; estado: string };
export type BenefitAdminVM = { id: string; name: string; category: string; discount: string; planRequirement: string; status: string };
export type PlanAdminVM = { id: string; name: string; tagline: string; basePrice: number; perksCount: number; featured: boolean };
export type FaqVM = { id: string; question: string; answer: string };
export type SettingsVM = { whatsapp: string; email: string };
export type ProviderAdminRow = { id: string; nombre: string; rubro: string; zona: string; rating: string; estado: string; solicitado: string };
export type ReportRow = { id: string; cat: string; autor: string; titulo: string; motivo: string };
export type AudienceVM = { label: string; n: number };
export type SentPushVM = { title: string; audience: string; when: string };

/* ── Iconos del sidebar ────────────────────────────────────────── */
const I = (inner: React.ReactNode) => (
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
  ajustes: I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7" /></>),
  prestadores: I(<><circle cx="5.5" cy="10" r="1.7" /><circle cx="9.7" cy="6.4" r="1.8" /><circle cx="14.3" cy="6.4" r="1.8" /><circle cx="18.5" cy="10" r="1.7" /><path d="M8 14.2c-1.3 1-1.9 2.4-1.5 3.8.3 1.3 1.5 2 2.9 1.7 1-.2 1.6-.6 2.6-.6s1.6.4 2.6.6c1.4.3 2.6-.4 2.9-1.7.4-1.4-.2-2.8-1.5-3.8-1.1-.9-2.1-1.5-4-1.5s-2.9.6-4 1.5z" /></>),
  negocios: I(<><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>),
  moderacion: I(<><path d="M12 3l8 4v5c0 4.4-3.4 7.5-8 9-4.6-1.5-8-4.6-8-9V7z" /><path d="M9.5 12l1.8 1.8L15 10" /></>),
  menu: I(<><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>),
};

type Screen = 'dashboard' | 'socios' | 'reintegros' | 'beneficios' | 'planes' | 'faq' | 'push' | 'ajustes' | 'prestadores' | 'negocios' | 'moderacion';
const NAV: { k: Screen; label: string; icon: React.ReactNode }[] = [
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
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e6e3f0', borderRadius: 16, padding: 18 };
const h1: React.CSSProperties = { fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' };
const sub: React.CSSProperties = { color: '#8781a0', fontSize: 15, margin: '0 0 24px' };
const th: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', textAlign: 'left', padding: '10px 14px', textTransform: 'uppercase' };
const td: React.CSSProperties = { fontSize: 14, color: '#211e33', padding: '13px 14px', borderTop: '1px solid #eeecf5' };
const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', border: '1.5px solid #e6e3f0', borderRadius: 10, fontSize: 14, fontFamily: '"DM Sans"', outline: 'none', boxSizing: 'border-box', background: '#fff' };
const badge = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 100, display: 'inline-block' });
const estadoBadge = (e: string) => e === 'Al día' || e === 'Verificado' || e === 'Validado' || e === 'Acreditado' || e === 'Activo'
  ? badge('rgb(226,245,234)', 'rgb(47,143,91)')
  : e === 'En mora' || e === 'Pendiente' || e === 'En revisión' || e === 'Pausado'
  ? badge('rgb(251,243,226)', 'rgb(184,134,11)')
  : badge('rgb(251,232,239)', 'rgb(193,77,122)');

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
function Socios({ socios }: { socios: SocioRow[] }) {
  const [plan, setPlan] = useState('Todos');
  const [estado, setEstado] = useState('Todos');
  const list = socios.filter((s) => (plan === 'Todos' || s.plan === plan) && (estado === 'Todos' || s.estado === estado));
  const chip = (active: boolean): React.CSSProperties => ({ border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 100, background: active ? 'rgb(93,84,145)' : '#fff', color: active ? '#fff' : '#5b5670', boxShadow: active ? 'none' : '0 0 0 1px #e6e3f0' });
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Socios</h1>
      <p style={sub}>{socios.length.toLocaleString('es-AR')} socios · hacé clic en un socio para ver su ficha</p>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>PLAN</div>
          <div style={{ display: 'flex', gap: 8 }}>{['Todos', 'AMIGO', 'FAMILIA', 'VIP'].map((p) => <button key={p} onClick={() => setPlan(p)} style={chip(plan === p)}>{p}</button>)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>ESTADO</div>
          <div style={{ display: 'flex', gap: 8 }}>{['Todos', 'Al día', 'En mora', 'Suspendido'].map((e) => <button key={e} onClick={() => setEstado(e)} style={chip(estado === e)}>{e}</button>)}</div>
        </div>
      </div>
      <div className="adm-tablewrap" style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['N°', 'NOMBRE', 'MASCOTA', 'PLAN', 'DESDE', 'ESTADO'].map((hd) => <th key={hd} style={th}>{hd}</th>)}</tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.n} className="adm-row" style={{ cursor: 'pointer' }}>
                <td style={{ ...td, color: '#8781a0', fontWeight: 600 }}>{s.n}</td>
                <td style={{ ...td, fontWeight: 600 }}>{s.nombre}</td>
                <td style={td}>{s.mascota}</td>
                <td style={td}>{s.plan}</td>
                <td style={{ ...td, color: '#8781a0' }}>{s.desde}</td>
                <td style={td}><span style={estadoBadge(s.estado)}>{s.estado}</span></td>
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
/** Visor del comprobante. El bucket es privado, así que pedimos una URL
 *  firmada al abrir y la descartamos al cerrar. */
function ComprobanteModal({ row, onClose }: { row: ColaRow; onClose: () => void }) {
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
        <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
          <div><div style={{ fontSize: 11, color: '#a29dba' }}>Gastado</div><div style={{ fontWeight: 700, fontSize: 16 }}>{money(row.gastado)}</div></div>
          <div><div style={{ fontSize: 11, color: '#a29dba' }}>Reintegro</div><div style={{ fontWeight: 700, fontSize: 16, color: 'rgb(93,84,145)' }}>{money(row.reintegro)}</div></div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>COMPROBANTE</div>
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
      </div>
    </div>
  );
}

function Reintegros({ cola, hist }: { cola: ColaRow[]; hist: HistRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ColaRow | null>(null);
  const act = async (id: string, status: 'acreditado' | 'rechazado') => {
    setBusyId(id);
    await supabase.from('reimbursements').update({ status }).eq('id', id);
    router.refresh();
    setBusyId(null);
  };
  return (
    <div>
      {detalle && <ComprobanteModal row={detalle} onClose={() => setDetalle(null)} />}
      <h1 className="adm-h1" style={h1}>Cola de reintegros</h1>
      <p style={sub}>Revisá y acreditá las solicitudes de los socios</p>
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
function Beneficios({ benefits }: { benefits: BenefitAdminVM[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const toggle = async (id: string, status: string) => {
    setBusyId(id);
    await supabase.from('benefits').update({ status: status === 'activo' ? 'pausado' : 'activo' }).eq('id', id);
    router.refresh();
    setBusyId(null);
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div><h1 className="adm-h1" style={{ ...h1, margin: 0 }}>Beneficios</h1><p style={{ ...sub, margin: '4px 0 0' }}>Comercios y descuentos de la red.</p></div>
        <button style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, padding: '11px 18px', borderRadius: 12, cursor: 'pointer' }}>+ Nuevo beneficio</button>
      </div>
      <div className="adm-tablewrap" style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['COMERCIO', 'CATEGORÍA', 'DESCUENTO', 'PLANES', 'ESTADO', ''].map((hd, i) => <th key={i} style={th}>{hd}</th>)}</tr></thead>
          <tbody>
            {benefits.map((b) => (
              <tr key={b.id}>
                <td style={{ ...td, fontWeight: 600 }}>{b.name}</td>
                <td style={{ ...td, color: '#8781a0' }}>{b.category}</td>
                <td style={td}><span style={badge('rgb(225,251,98)', 'rgb(33,30,51)')}>{b.discount}</span></td>
                <td style={{ ...td, color: '#8781a0', fontSize: 12.5 }}>{b.planRequirement}</td>
                <td style={td}><span style={estadoBadge(b.status === 'activo' ? 'Activo' : 'Pausado')}>{b.status === 'activo' ? 'Activo' : 'Pausado'}</span></td>
                <td style={td}><button disabled={busyId === b.id} onClick={() => toggle(b.id, b.status)} style={{ background: '#fff', border: '1px solid #e6e3f0', color: '#5b5670', fontWeight: 600, fontSize: 12.5, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', opacity: busyId === b.id ? 0.6 : 1 }}>{b.status === 'activo' ? 'Pausar' : 'Activar'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Planes ────────────────────────────────────────────────────── */
function Planes({ plans }: { plans: PlanAdminVM[] }) {
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Planes</h1>
      <p style={sub}>Editá precios, descripciones y beneficios. Los cambios se reflejan en la landing.</p>
      <div className="adm-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {plans.map((p) => (
          <div key={p.id} style={{ ...card, padding: 22, ...(p.featured ? { border: '2px solid rgb(93,84,145)' } : {}) }}>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18, color: 'rgb(93,84,145)' }}>{p.name}</div>
            <div style={{ fontSize: 13, color: '#8781a0', marginBottom: 12 }}>{p.tagline}</div>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 30 }}>{money(p.basePrice)}</div>
            <div style={{ fontSize: 12.5, color: '#8781a0', marginBottom: 16 }}>por mes · {p.perksCount} beneficios</div>
            <button style={{ width: '100%', background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontWeight: 700, fontSize: 14, padding: 11, borderRadius: 11, cursor: 'pointer' }}>Editar plan</button>
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
  const send = async () => {
    if (!titulo.trim() || busy) return;
    setBusy(true);
    await supabase.from('push_notifications').insert({ title: titulo, body: msg, audience: audiences[aud]?.label ?? 'Todos los socios', sent_at: new Date().toISOString() });
    setTitulo(''); setMsg('');
    router.refresh();
    setBusy(false);
  };
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Notificaciones push</h1>
      <p style={sub}>Enviá avisos a los socios directo a su celular.</p>
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
              {sent.map((s, i) => <div key={i} style={{ ...card, padding: 12 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</div><div style={{ fontSize: 12, color: '#8781a0' }}>→ {s.audience} · {s.when}</div></div>)}
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
  const inpWide: React.CSSProperties = { ...inp, maxWidth: 420 };
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
        <p style={{ fontSize: 12.5, color: '#8781a0', margin: '8px 0 0' }}>Se muestra en el footer de la landing.</p>
      </div>
    </div>
  );
}

/* ── Prestadores / Negocios (misma tabla, distinto recorte) ────── */
function Prestadores({ providers }: { providers: ProviderAdminRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const verify = async (id: string) => {
    setBusyId(id);
    await supabase.from('providers').update({ status: 'verificado' }).eq('id', id);
    router.refresh();
    setBusyId(null);
  };
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Prestadores</h1>
      <p style={sub}>Validá la identidad y documentación de quienes ofrecen servicios</p>
      <div className="adm-tablewrap" style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['NOMBRE', 'RUBRO', 'ZONA', 'RATING', 'ESTADO', ''].map((hd, i) => <th key={i} style={th}>{hd}</th>)}</tr></thead>
          <tbody>
            {providers.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 600 }}>{r.nombre}</td>
                <td style={{ ...td, color: '#8781a0' }}>{r.rubro}</td>
                <td style={td}>{r.zona}</td>
                <td style={td}>{r.rating !== '—' ? `★ ${r.rating}` : '—'}</td>
                <td style={td}><span style={estadoBadge(r.estado)}>{r.estado}</span></td>
                <td style={td}>{r.estado === 'Pendiente' && <button disabled={busyId === r.id} onClick={() => verify(r.id)} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12.5, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', opacity: busyId === r.id ? 0.6 : 1 }}>Verificar</button>}</td>
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
  const pendientes = providers.filter((r) => r.estado === 'Pendiente');
  const validate = async (id: string) => {
    setBusyId(id);
    await supabase.from('providers').update({ status: 'verificado' }).eq('id', id);
    router.refresh();
    setBusyId(null);
  };
  return (
    <div>
      <h1 className="adm-h1" style={h1}>Negocios</h1>
      <p style={sub}>{pendientes.length} solicitudes de alta pendientes de validación</p>
      <div className="adm-tablewrap" style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['NOMBRE', 'RUBRO', 'ZONA', 'SOLICITADO', 'ESTADO', ''].map((hd, i) => <th key={i} style={th}>{hd}</th>)}</tr></thead>
          <tbody>
            {providers.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 600 }}>{r.nombre}</td>
                <td style={{ ...td, color: '#8781a0' }}>{r.rubro}</td>
                <td style={td}>{r.zona}</td>
                <td style={{ ...td, color: '#8781a0' }}>{r.solicitado}</td>
                <td style={td}><span style={estadoBadge(r.estado)}>{r.estado}</span></td>
                <td style={td}>{r.estado === 'Pendiente' && <button disabled={busyId === r.id} onClick={() => validate(r.id)} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12.5, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', opacity: busyId === r.id ? 0.6 : 1 }}>Validar</button>}</td>
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
    await supabase.from('community_posts').update({ reported: false }).eq('id', id);
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
