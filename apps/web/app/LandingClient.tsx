'use client';
import type { CSSProperties, FormEvent, ReactNode } from 'react';

import { createContext, useContext, useState, useEffect } from 'react';
import { data, urls, waLink } from '@kumo/shared';
import type { Faq, Plan } from '@kumo/shared';
import { Onboarding } from '@/components/Onboarding';
import { PrestadoresPage } from '@/components/PrestadoresPage';
import { supabase } from '@/lib/supabase-browser';

/*
 * Landing de Kumo — reproducción 1:1 del prototipo (reference/kumo-prototype.html).
 * Estilos inline y clases (r-*, scp*) tomados del diseño original; ver globals.css.
 * Interacciones: toggle Perro/Gato, checkbox odontología (+$12.000) y carrusel
 * de prestadores (auto-avance cada 3s), igual que el prototipo.
 */

const money = (n: number) => '$' + n.toLocaleString('es-AR');
const ODONTO = 12000;
const WEBAPP = urls.webapp;
const ADMIN = urls.admin;

/* ── Modal de auth (login/registro) — igual al prototipo (authOpen) ── */
type AuthMode = 'login' | 'register';
type View = AuthMode | 'prestador';
const AuthCtx = createContext<(m: View) => void>(() => {});
const useAuth = () => useContext(AuthCtx);

/** Contenido editable desde el panel admin (planes, FAQ y datos de contacto). */
export type LandingContent = { plans: Plan[]; faqs: Faq[]; whatsapp: string; email: string };
const ContentCtx = createContext<LandingContent>({ plans: [], faqs: [], whatsapp: '', email: '' });
const useContent = () => useContext(ContentCtx);

const AUTH_COPY: Record<AuthMode, { title: string; subtitle: string; cta: string }> = {
  login: { title: '¡Hola de nuevo!', subtitle: 'Ingresá para ver tu carnet, beneficios y reintegros.', cta: 'Ingresar' },
  register: { title: 'Creá tu cuenta', subtitle: 'Sumate al club y empezá a cuidar mejor a tu mascota.', cta: 'Crear cuenta' },
};
const authLabel: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#5b5670', marginBottom: 6 };
const authInput: CSSProperties = { width: '100%', padding: '13px 14px', border: '1.5px solid #e6e3f0', borderRadius: 12, fontSize: 15, background: '#fff', color: '#211E33', outline: 'none', fontFamily: '"DM Sans"', boxSizing: 'border-box' };

function AuthModal({ mode, onClose, aviso }: { mode: AuthMode | null; onClose: () => void; aviso?: string }) {
  const openAuth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (mode) { setEmail(''); setPassword(''); setError(''); } }, [mode]);
  if (!mode) return null;
  const copy = AUTH_COPY.login;
  const seg = (active: boolean): CSSProperties => ({ flex: 1, border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, padding: '8px 18px', borderRadius: 9, transition: 'all 0.15s', ...(active ? { background: '#5D5491', color: '#fff', boxShadow: '0 2px 8px rgba(93,84,145,0.3)' } : { background: 'transparent', color: '#c9c3e3' }) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.user) {
      setLoading(false);
      setError(signInError && /invalid login credentials/i.test(signInError.message) ? 'Email o contraseña incorrectos.' : signInError?.message ?? 'No se pudo iniciar sesión.');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', signInData.user.id).single();
    setLoading(false);
    window.location.href = profile?.role === 'admin' ? ADMIN : WEBAPP;
  };

  /** Google sirve para entrar, no para asociarse: /auth/callback verifica que la
   *  cuenta sea de un socio y, si no, la rebota con un aviso. */
  const entrarConGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (e) {
      setGoogleLoading(false);
      setError(/provider is not enabled/i.test(e.message)
        ? 'El ingreso con Google todavía no está configurado.'
        : 'No pudimos abrir el ingreso con Google.');
    }
    // Si sale bien, el navegador se va a Google: no hace falta apagar el loading.
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(33,30,51,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 24, padding: 32, boxShadow: '0 30px 70px rgba(33,30,51,0.4)', animation: 'kpop 0.18s ease-out', position: 'relative' }}>
        <button onClick={onClose} className="scpq" aria-label="Cerrar" style={{ position: 'absolute', top: 18, right: 18, width: 34, height: 34, border: 'none', background: '#f0edf9', borderRadius: 10, cursor: 'pointer', color: '#5D5491', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>✕</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#5D5491', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50% 50% 50% 3px', background: '#E1FB62', transform: 'rotate(45deg)' }} />
          </div>
          <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, color: '#5D5491' }}>Kumo</span>
        </div>
        <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, letterSpacing: '-0.01em', margin: '8px 0 4px' }}>{copy.title}</h2>
        <p style={{ color: '#8781a0', fontSize: 14, margin: '0 0 20px' }}>{copy.subtitle}</p>

        <div style={{ display: 'flex', gap: 4, background: '#f0edf9', padding: 4, borderRadius: 12, marginBottom: 20 }}>
          <button type="button" style={seg(true)}>Ingresar</button>
          <button type="button" onClick={() => openAuth('register')} style={seg(false)}>Crear cuenta</button>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={authLabel}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" style={authInput} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={authLabel}>Contraseña</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={authInput} />
          </div>
          <div style={{ textAlign: 'right', marginBottom: 14 }}><a href="#" style={{ fontSize: 13, color: '#5D5491', fontWeight: 600, textDecoration: 'none' }}>¿Olvidaste tu contraseña?</a></div>
          {aviso && !error && <div style={{ background: '#fbf3e2', color: '#92690a', fontSize: 13, lineHeight: 1.5, borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>{aviso}</div>}
          {error && <div style={{ background: '#fbe8ef', color: '#c14d7a', fontSize: 13, borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={loading} className="scpa" style={{ width: '100%', display: 'block', textAlign: 'center', background: '#5D5491', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: 15, borderRadius: 14, boxShadow: '0 8px 20px rgba(93,84,145,0.28)', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'background 0.15s' }}>{loading ? 'Ingresando…' : copy.cta}</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#eeecf5' }} /><span style={{ fontSize: 12, color: '#a29dba' }}>o</span><div style={{ flex: 1, height: 1, background: '#eeecf5' }} />
        </div>
        <button type="button" onClick={entrarConGoogle} disabled={googleLoading} className="scp6" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#fff', border: '1.5px solid #e6e3f0', borderRadius: 14, padding: 13, cursor: googleLoading ? 'default' : 'pointer', opacity: googleLoading ? 0.6 : 1, fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 15, color: '#211E33', transition: '0.15s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2a11 11 0 0 0 0 9.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.7l3.1-3.1A11 11 0 0 0 2 7.1l3.7 2.8C6.6 7.3 9.1 5.4 12 5.4z" /></svg>
          {googleLoading ? 'Abriendo Google…' : 'Continuar con Google'}
        </button>
      </div>
    </div>
  );
}
const IMG = (f: string) => `/img/${f}`;

/* ── Iconos (verbatim del prototipo) ───────────────────────────── */
const paw = (
  <>
    <circle cx="5.5" cy="10" r="1.7" />
    <circle cx="9.7" cy="6.4" r="1.8" />
    <circle cx="14.3" cy="6.4" r="1.8" />
    <circle cx="18.5" cy="10" r="1.7" />
    <path d="M8 14.2c-1.3 1-1.9 2.4-1.5 3.8.3 1.3 1.5 2 2.9 1.7 1-.2 1.6-.6 2.6-.6s1.6.4 2.6.6c1.4.3 2.6-.4 2.9-1.7.4-1.4-.2-2.8-1.5-3.8-1.1-.9-2.1-1.5-4-1.5s-2.9.6-4 1.5z" />
  </>
);
const chatPath = <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
const personPaths = (
  <>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </>
);
const idCardPaths = (
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2.1" />
    <path d="M6.2 16c.5-1.5 1.9-2.4 3.3-2.4s2.8.9 3.3 2.4" />
    <line x1="14" y1="9" x2="17.5" y2="9" />
    <line x1="14" y1="13" x2="16.5" y2="13" />
  </>
);
const plusCircle = (
  <>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </>
);
const heartPath = (
  <path d="M12 20s-7-4.3-9.2-8.6C1.3 8.3 2.6 5 6 5c2 0 3.3 1.2 4 2.3C10.7 6.2 12 5 14 5c3.4 0 4.7 3.3 3.2 6.4C19 15.7 12 20 12 20z" />
);

/* ── Nav ───────────────────────────────────────────────────────── */
function Nav() {
  const openAuth = useAuth();
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(245,244,248,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgb(230,227,240)' }}>
      <div className="r-nav" style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 'auto' }}>
          <span className="r-nav-logo" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 30, letterSpacing: '-0.01em', color: 'rgb(93,84,145)' }}>Kumo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => openAuth('login')} className="r-nav-login scp9" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 15, color: 'rgb(93,84,145)', padding: '10px 12px', borderRadius: 10, transition: 'background 0.15s' }}>Iniciar sesión</button>
          <button onClick={() => openAuth('register')} className="r-nav-cta scpa" style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: '11px 22px', borderRadius: 12, boxShadow: '0 4px 12px rgba(93,84,145,0.25)', cursor: 'pointer', transition: 'background 0.15s' }}>Empezar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Hero ──────────────────────────────────────────────────────── */
function Hero() {
  const openAuth = useAuth();
  const [pet, setPet] = useState<'perro' | 'gato'>('perro');
  const [name, setName] = useState('');
  const selStyle = (on: boolean) => ({ border: on ? '1.5px solid rgb(93,84,145)' : '1.5px solid rgb(230,227,240)', background: on ? 'rgb(240,237,249)' : '#fff', color: on ? 'rgb(93,84,145)' : 'rgb(168,160,181)' });
  return (
    <section className="r-hero scpb" style={{ position: 'relative', overflow: 'hidden', background: 'rgb(74,65,119)', transition: 'background 0.4s', width: '100%', minHeight: 660 }}>
      <div className="r-hero-row" style={{ position: 'relative', zIndex: 2, maxWidth: 1320, margin: '0 auto', padding: '36px 24px 30px', minHeight: 300, display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 0%', maxWidth: 560 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgb(236,233,245)', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 100, marginBottom: 22 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
            App de mascotas con beneficios
          </div>
          <h1 className="r-h1" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 58, lineHeight: 1.04, letterSpacing: '-0.02em', margin: '0 0 20px', color: '#fff' }}>
            Cuidar a tu mascota,<br />por fin <span style={{ color: 'rgb(199,224,79)' }}>simple</span> y{' '}
            <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>más barato
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 6, height: 12, background: 'rgb(199,224,79)', zIndex: -1, borderRadius: 3 }} />
            </span>.
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)', maxWidth: 480, margin: '0 0 30px' }}>
            Descuentos en veterinarias y pet shops, consultas online, carnet digital de salud y reintegros parciales de tus gastos. Todo en un solo lugar.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => openAuth('register')} className="scpc" style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: '15px 28px', borderRadius: 14, boxShadow: '0 8px 20px rgba(93,84,145,0.28)', display: 'inline-block', transition: '0.2s', cursor: 'pointer' }}>Unirme al club →</button>
            <a href="#planes" className="scpd" style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: '15px 28px', borderRadius: 14, textDecoration: 'none', display: 'inline-block', transition: '0.2s', cursor: 'pointer' }}>Ver planes</a>
          </div>
          {/* Card: nombre de mascota */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', background: '#fff', border: '1px solid rgb(217,208,238)', borderRadius: 22, padding: '20px 22px', margin: '34px 0 0', maxWidth: 520, boxShadow: '0 10px 30px rgba(93,84,145,0.1)' }}>
            <div style={{ flex: '1 1 0%', minWidth: 200, textAlign: 'left' }}>
              <label style={{ display: 'block', fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 15, color: 'rgb(33,30,51)', marginBottom: 10 }}>Escribí el nombre de tu mascota</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={() => setPet('perro')} style={{ flex: '1 1 0%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, padding: '11px 16px', borderRadius: 100, transition: '0.15s', ...selStyle(pet === 'perro') }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={pet === 'perro' ? '#5D5491' : '#a8a0b5'} stroke="none" style={{ display: 'block', flexShrink: 0 }}>{paw}</svg>
                  Perro
                </button>
                <button onClick={() => setPet('gato')} style={{ flex: '1 1 0%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, padding: '11px 16px', borderRadius: 100, transition: '0.15s', ...selStyle(pet === 'gato') }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={pet === 'gato' ? '#5D5491' : '#a8a0b5'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                    <path d="M4 4l3 4M20 4l-3 4" />
                    <path d="M5 10a7 5 0 0 1 14 0v4a6 6 0 0 1-12 0z" />
                    <line x1="9.5" y1="12" x2="9.5" y2="12.2" />
                    <line x1="14.5" y1="12" x2="14.5" y2="12.2" />
                    <path d="M10.5 15c.5.6 2.5.6 3 0" />
                    <line x1="8" y1="15" x2="5.5" y2="14.5" />
                    <line x1="16" y1="15" x2="18.5" y2="14.5" />
                  </svg>
                  Gato
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="El nombre de tu mascota" style={{ flex: '1 1 0%', minWidth: 160, padding: '14px 18px', border: '1.5px solid rgb(217,208,238)', borderRadius: 100, fontSize: 15, background: 'rgb(250,249,253)', color: 'rgb(33,30,51)', outline: 'none', fontFamily: '"DM Sans"' }} />
                <button onClick={() => openAuth('register')} className="scpc" style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: '14px 26px', borderRadius: 100, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(93,84,145,0.25)', transition: '0.2s', cursor: 'pointer' }}>Continuar →</button>
              </div>
            </div>
          </div>
        </div>
        <div className="r-hero-img-wrap" style={{ flex: '1 1 320px', minWidth: 0, alignSelf: 'flex-end', width: 709, maxWidth: 709, height: 715, position: 'relative' }}>
          <div className="r-hero-circle" style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', width: 520, height: 520, borderRadius: '50%', background: 'rgb(107,98,163)', zIndex: 0 }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', background: `url(${IMG('asset-837cff30.png')}) center center / contain no-repeat` }} />
        </div>
      </div>
    </section>
  );
}

/* ── Planes ────────────────────────────────────────────────────── */
const planMeta: Record<string, { peek: string; peekH: number; peekMB: number; btnBg: string; btnColor: string }> = {
  AMIGO: { peek: 'plan-amigo-cat.webp', peekH: 96, peekMB: -2, btnBg: 'rgb(240,237,249)', btnColor: 'rgb(93,84,145)' },
  FAMILIA: { peek: 'peek-dog1.webp', peekH: 128, peekMB: -46, btnBg: 'rgb(225,251,98)', btnColor: 'rgb(33,30,51)' },
  VIP: { peek: 'plan-vip.webp', peekH: 96, peekMB: -2, btnBg: 'rgb(93,84,145)', btnColor: '#fff' },
};

function Plans() {
  const openAuth = useAuth();
  const { plans } = useContent();
  const [odonto, setOdonto] = useState<Record<string, boolean>>({});
  return (
    <section id="planes" className="r-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '56px 24px', scrollMarginTop: 80 }}>
      <h2 className="r-h2" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 38, letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 8px' }}>Elegí tu plan</h2>
      <p style={{ textAlign: 'center', color: 'rgb(135,129,160)', fontSize: 17, margin: '0 0 90px' }}>Cuota mensual con IVA incluido. Cambiá o cancelá cuando quieras.</p>
      <div className="r-grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>
        {plans.map((p) => {
          const m = planMeta[p.name]!;
          const feat = !!p.featured;
          const on = !!odonto[p.id];
          return (
            <div key={p.id} className="scpe" style={{ background: feat ? 'rgb(93,84,145)' : '#fff', border: feat ? '2px solid rgb(93,84,145)' : '1px solid rgb(230,227,240)', borderRadius: 26, padding: 30, position: 'relative', overflow: 'visible', boxShadow: feat ? '0 24px 48px rgba(93,84,145,0.35)' : '0 2px 10px rgba(0,0,0,0.03)', transition: 'transform 0.22s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.22s' }}>
              <img src={IMG(m.peek)} alt={p.name} style={{ position: 'absolute', right: 26, bottom: '100%', marginBottom: m.peekMB, height: m.peekH, width: 'auto', objectFit: 'contain', zIndex: 3, pointerEvents: 'none', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.15))' }} />
              {feat && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontWeight: 700, fontSize: 12, padding: '5px 14px', borderRadius: 100, zIndex: 3 }}>MÁS ELEGIDO</div>
              )}
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 15, letterSpacing: '0.08em', color: feat ? 'rgb(225,251,98)' : 'rgb(93,84,145)', marginBottom: 6 }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 40, color: feat ? '#fff' : 'rgb(33,30,51)' }}>{money(p.basePrice + (on ? ODONTO : 0))}</span>
                  <span style={{ color: feat ? 'rgb(201,195,227)' : 'rgb(135,129,160)', fontSize: 15 }}>/mes</span>
                </div>
                <div style={{ color: feat ? 'rgb(201,195,227)' : 'rgb(135,129,160)', fontSize: 14, marginBottom: 10, minHeight: 30 }}>{p.tagline}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: feat ? 'rgb(232,228,245)' : 'rgb(74,69,96)', background: feat ? 'rgba(255,255,255,0.06)' : 'rgb(250,250,250)', border: feat ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgb(230,227,240)', borderRadius: 11, padding: '10px 12px', marginBottom: 22, cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => setOdonto((s) => ({ ...s, [p.id]: !s[p.id] }))} style={{ width: 16, height: 16, accentColor: feat ? 'rgb(225,251,98)' : 'rgb(93,84,145)', flex: '0 0 auto', cursor: 'pointer' }} />
                  <span>¿Querés sumar cobertura odontológica? <strong>+$12.000/mes</strong></span>
                </label>
                <button onClick={() => openAuth('register')} className="scpf" style={{ display: 'block', textAlign: 'center', width: '100%', border: 'none', background: m.btnBg, color: m.btnColor, fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 12, marginBottom: 22, boxSizing: 'border-box', transition: 'filter 0.15s', cursor: 'pointer' }}>Elegir {p.name}</button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {p.perks.filter((perk) => !/^Tope anual/i.test(perk)).map((perk) => (
                    <div key={perk} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 14, color: feat ? 'rgb(232,228,245)' : 'rgb(74,69,96)' }}>
                      <span style={{ color: feat ? 'rgb(225,251,98)' : 'rgb(93,84,145)', fontWeight: 700, flex: '0 0 auto' }}>✓</span>
                      <span>{perk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ textAlign: 'center', color: 'rgb(135,129,160)', fontSize: 14, margin: '26px 0 0' }}>Reintegros de 30% a 60% según plan · Topes mensuales de $5.400 a $15.000 · Consultá carencias abajo.</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap', background: 'rgb(33,30,51)', borderRadius: 22, padding: '24px 30px', margin: '38px 0 0', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ flex: '1 1 0%', minWidth: 220 }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 21, color: '#fff', lineHeight: 1.2 }}>¿Ofrecés servicios para mascotas?</div>
          <div style={{ color: 'rgb(179,171,214)', fontSize: 14.5, lineHeight: 1.5, marginTop: 4 }}>Sumate como paseador, guardería, adiestrador o veterinaria y llegá a miles de socios.</div>
        </div>
        <button onClick={() => openAuth('prestador')} className="scpg" style={{ flex: '0 0 auto', background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', border: 'none', fontWeight: 700, fontSize: 15.5, padding: '14px 26px', borderRadius: 13, cursor: 'pointer', transition: 'background 0.15s' }}>Quiero ofrecer servicios →</button>
      </div>
    </section>
  );
}

/* ── App del club + "Lo que el club sí es" ─────────────────────── */
function AppAndClub() {
  return (
    <section className="r-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px' }}>
      <div className="r-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>
        <div className="r-banner" style={{ background: 'rgb(93,84,145)', borderRadius: 28, padding: '48px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,251,98,0.22), transparent 70%)' }} />
          <div style={{ position: 'absolute', right: 24, bottom: 28, display: 'flex', gap: 10, opacity: 0.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgb(225,251,98)' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'rgb(225,251,98)', fontWeight: 700, fontSize: 14, marginBottom: 16, position: 'relative', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(225,251,98,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E1FB62" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="3" /><line x1="11" y1="18" x2="13" y2="18" /></svg>
            </span>La app del club
          </div>
          <h3 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.01em', color: '#fff', margin: '0 0 12px', position: 'relative' }}>Llevá Kumo en tu bolsillo</h3>
          <p style={{ margin: '0 0 22px', color: 'rgb(216,211,238)', fontSize: 16.5, lineHeight: 1.6, position: 'relative' }}>Carnet digital, reintegros y beneficios, siempre a mano. Descargá la app y gestioná todo desde tu celular.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', position: 'relative' }}>
            <a href={WEBAPP} className="scph" style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'rgb(33,30,51)', color: '#fff', borderRadius: 14, padding: '10px 18px', textDecoration: 'none', transition: 'background 0.15s' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M16 2c.1 1-.3 2-1 2.7-.7.8-1.8 1.4-2.8 1.3-.1-1 .4-2 1-2.7C13.9 2.5 15 2 16 2z" /><path d="M19.5 17c-.4 1-.6 1.4-1.1 2.3-.7 1.2-1.7 2.7-3 2.7-1.1 0-1.4-.7-2.9-.7s-1.9.7-3 .7c-1.3 0-2.2-1.3-3-2.5-2-3-2.2-6.5-1-8.4.9-1.4 2.3-2.2 3.6-2.2 1.3 0 2.2.8 3.3.8 1 0 1.7-.8 3.3-.8 1.1 0 2.3.6 3.2 1.7-2.8 1.5-2.4 5.4.6 6.4z" /></svg>
              <span style={{ lineHeight: 1.1 }}>
                <span style={{ display: 'block', fontSize: 10, color: 'rgb(201,195,227)' }}>Descargalo en</span>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>App Store</span>
              </span>
            </a>
            <a href={WEBAPP} className="scph" style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'rgb(33,30,51)', color: '#fff', borderRadius: 14, padding: '10px 18px', textDecoration: 'none', transition: 'background 0.15s' }}>
              <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 3.5c-.3.2-.5.6-.5 1v15c0 .4.2.8.5 1l9-9.5-9-7.5z" fill="#5cc8ff" /><path d="M16.5 9 6 3c-.3-.2-.6-.2-.9-.1L14 12l2.5-3z" fill="#7be08a" /><path d="M16.5 15 6 21c-.3.2-.6.2-.9.1L14 12l2.5 3z" fill="#ff6b6b" /><path d="m16.5 9 4 2.3c.7.4.7 1.4 0 1.8L16.5 15 14 12l2.5-3z" fill="#ffd24d" /></svg>
              <span style={{ lineHeight: 1.1 }}>
                <span style={{ display: 'block', fontSize: 10, color: 'rgb(201,195,227)' }}>Disponible en</span>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>Google Play</span>
              </span>
            </a>
          </div>
        </div>
        <div style={{ position: 'relative', borderRadius: 28, overflow: 'hidden', minHeight: 360, background: 'rgb(207,216,230)' }}>
          <img src={IMG('asset-a1e40f34.webp')} alt="Gato y perro" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(20,18,30,0.82) 0%, rgba(20,18,30,0.25) 45%, transparent 70%)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '32px 34px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'rgb(225,251,98)', fontWeight: 700, fontSize: 13, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(225,251,98,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E1FB62" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
              </span>Lo que el Club SÍ es
            </div>
            <h3 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, lineHeight: 1.1, color: '#fff', margin: '0 0 8px' }}>Beneficios reales, no letra chica</h3>
            <p style={{ color: 'rgb(232,228,245)', fontSize: 15, lineHeight: 1.55, margin: 0, maxWidth: 440 }}>Descuentos, consultas online, reintegros parciales y una comunidad de dueños responsables. Para vos y tu mascota.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Membresía ─────────────────────────────────────────────────── */
const membership = [
  { title: 'Descuentos en la red', desc: 'Tarifas preferenciales en +320 veterinarias y pet shops de todo el país.', svg: (<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r="1.2" /></svg>) },
  { title: 'Chat privado con profesionales', desc: 'Escribile directo a las veterinarias de la red para sacar turnos y consultar precios.', svg: (<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{chatPath}</svg>) },
  { title: 'Reintegros parciales', desc: 'Recuperá del 30% al 60% de lo que gastás en el veterinario.', svg: (<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2" /><rect x="2" y="7" width="20" height="12" rx="2" /><path d="M22 11h-4a2 2 0 0 0 0 4h4" /></svg>) },
];

function Membership() {
  return (
    <section id="beneficios" className="r-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px', scrollMarginTop: 80 }}>
      <h2 className="r-h2" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 38, letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 8px' }}>Todo lo que incluye tu membresía</h2>
      <p style={{ textAlign: 'center', color: 'rgb(135,129,160)', fontSize: 17, margin: '0 0 36px' }}>Un solo club, muchos beneficios reales.</p>
      <div className="r-grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
        {membership.map((c) => (
          <div key={c.title} className="scpi" style={{ background: '#fff', border: '1px solid rgb(230,227,240)', borderRadius: 24, padding: '36px 30px 34px', transition: 'box-shadow 0.15s, border-color 0.15s' }}>
            <div style={{ width: 66, height: 66, borderRadius: 20, background: 'rgb(225,251,98)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>{c.svg}</div>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 23, lineHeight: 1.15, letterSpacing: '-0.01em', marginBottom: 10 }}>{c.title}</div>
            <div style={{ color: 'rgb(122,117,146)', fontSize: 15.5, lineHeight: 1.55 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Servicios de la app ───────────────────────────────────────── */
const svcIcon = (inner: ReactNode, filled = false) => (
  <svg width="56" height="56" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>{inner}</svg>
);
const services = [
  { label: 'Paseos', meta: '86 paseadores', icon: svcIcon(paw, true) },
  { label: 'Baño y estética', meta: '54 pet shops', icon: svcIcon(<path d="M12 3s6 5.7 6 10a6 6 0 0 1-12 0c0-4.3 6-10 6-10z" />) },
  { label: 'Guarderías', meta: '31 espacios', icon: svcIcon(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></>) },
  { label: 'Adiestradores', meta: '22 profesionales', icon: svcIcon(<><path d="M22 9 12 5 2 9l10 4 10-4z" /><path d="M6 11v5c0 1.3 2.7 3 6 3s6-1.7 6-3v-5" /></>) },
  { label: 'Cuidadores', meta: '70 disponibles', icon: svcIcon(personPaths) },
  { label: 'Odontología', meta: '18 clínicas', icon: svcIcon(<path d="M12 5.4c-1.4-1-2.6-1.6-4.2-1.6C5.2 3.8 3.5 5.8 3.5 8.7c0 2 .6 3.3 1.1 5.2.5 1.9.6 3.6.9 5 .3 1.4 1 2.3 2 2.3 1.2 0 1.6-1.1 1.9-2.8.3-1.7.5-3.4 2.6-3.4s2.3 1.7 2.6 3.4c.3 1.7.7 2.8 1.9 2.8 1 0 1.7-.9 2-2.3.3-1.4.4-3.1.9-5 .5-1.9 1.1-3.2 1.1-5.2 0-2.9-1.7-4.9-4.3-4.9-1.6 0-2.8.6-4.2 1.6z" />) },
  { label: 'Carnet digital', meta: 'Vacunas y estudios', icon: svcIcon(idCardPaths) },
  { label: 'Recordatorios', meta: 'Avisos de vacunas', icon: svcIcon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></>) },
  { label: 'Guardia 24h', meta: 'Contactos de emergencia', icon: svcIcon(plusCircle) },
  { label: 'Comunidad', meta: 'Foros y reseñas', icon: svcIcon(chatPath) },
];

function Services() {
  return (
    <section style={{ background: 'rgb(93,84,145)', padding: '60px 0', marginTop: 20 }}>
      <div className="r-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 30, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 className="r-h2" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 38, letterSpacing: '-0.02em', color: '#fff', margin: '0 0 8px' }}>Servicios de la app</h2>
            <p style={{ color: 'rgb(201,195,227)', fontSize: 17, margin: 0 }}>Paseadores, guarderías, adiestradores y más — Con tarifas de socio.</p>
          </div>
          <a href={WEBAPP} className="scpg" style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontWeight: 700, fontSize: 15, padding: '13px 22px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s', textDecoration: 'none', display: 'inline-block' }}>Explorar en la app →</a>
        </div>
        <div className="r-grid5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {services.map((s) => (
            <div key={s.label} className="scpj" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '28px 18px', textAlign: 'center', color: 'rgb(225,251,98)', cursor: 'pointer', transition: 'background 0.2s, color 0.2s, transform 0.2s' }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 3, color: 'currentColor' }}>{s.label}</div>
              <div style={{ color: 'currentColor', opacity: 0.72, fontSize: 13 }}>{s.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Familia Kumo (marquee) ────────────────────────────────────── */
const socios = ['socio-perro1.webp', 'socio-catdog2.webp', 'socio-gato3.webp', 'socio-perro2.webp', 'socio-catdog.webp', 'socio-gato2.webp', 'socio-perro3.webp', 'socio-perro4.jpg'];
const sociosRot = [-2, 1.5, -1.5, -1, -2, 2, -2.5, 1.5];

function FamiliaKumo() {
  const card = (f: string, rot: number, i: number, dup: boolean) => (
    <div key={`${dup ? 'b' : 'a'}-${i}`} className={dup ? undefined : 'scpl'} style={{ width: 300, height: 380, borderRadius: 24, overflow: 'hidden', flex: '0 0 auto', boxShadow: '0 12px 30px rgba(93,84,145,0.14)', transform: `rotate(${rot}deg)`, transition: dup ? undefined : 'transform 0.25s', backgroundImage: `url(${IMG(f)})`, backgroundSize: 'cover', backgroundPosition: 'center center' }} />
  );
  return (
    <section style={{ padding: '56px 0 60px', overflow: 'hidden' }}>
      <div className="r-sec" style={{ maxWidth: 1180, margin: '0 auto 34px', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 12, padding: '7px 14px', borderRadius: 100, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>La familia Kumo</div>
        <h2 className="r-h2" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 38, letterSpacing: '-0.02em', margin: '0 0 10px', lineHeight: 1.05 }}>Algunos de nuestros{' '}
          <span style={{ position: 'relative', whiteSpace: 'nowrap', color: 'rgb(93,84,145)' }}>socios<span style={{ position: 'absolute', left: 0, right: 0, bottom: 4, height: 11, background: 'rgb(225,251,98)', zIndex: -1, borderRadius: 3 }} /></span>
        </h2>
        <p style={{ color: 'rgb(135,129,160)', fontSize: 16, margin: '0 auto', maxWidth: 520 }}>Miles de familias ya son parte del club. Estos son algunos de los peludos que cuidamos todos los días.</p>
      </div>
      <div className="scpk" style={{ display: 'flex', gap: 16, width: 'max-content', animation: 'kmarquee 46s linear infinite' }}>
        {socios.map((f, i) => card(f, sociosRot[i] ?? 0, i, false))}
        {socios.map((f, i) => card(f, sociosRot[i] ?? 0, i, true))}
      </div>
    </section>
  );
}

/* ── Prestadores ───────────────────────────────────────────────── */
const catIconInner: Record<string, { inner: ReactNode; filled?: boolean }> = {
  paseadores: { inner: paw, filled: true },
  guarderias: { inner: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></> },
  adiestradores: { inner: <><path d="M22 9 12 5 2 9l10 4 10-4z" /><path d="M6 11v5c0 1.3 2.7 3 6 3s6-1.7 6-3v-5" /></> },
  bano: { inner: <path d="M12 3s6 5.7 6 10a6 6 0 0 1-12 0c0-4.3 6-10 6-10z" /> },
  cuidadores: { inner: personPaths },
  otros: { inner: plusCircle },
};

function Prestadores() {
  const openAuth = useAuth();
  const cats = data.providerCategories;
  const [active, setActive] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setActive((i) => (i + 1) % cats.length), 3000);
    return () => clearInterval(iv);
  }, [cats.length]);
  const cur = cats[active] ?? cats[0]!;
  const icon = catIconInner[cur.key] ?? catIconInner.otros!;
  return (
    <section id="prestadores" className="r-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '60px 24px', scrollMarginTop: 80 }}>
      <div className="r-grid2" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 44, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontWeight: 700, fontSize: 13, padding: '7px 14px', borderRadius: 100, marginBottom: 18 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M20 7h-9M14 17H5M17 3l3 4-3 4M7 21l-3-4 3-4" /></svg>
            Para prestadores
          </div>
          <h2 className="r-h2" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 38, letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 14px' }}>¿Ofrecés servicios para mascotas?</h2>
          <p style={{ color: 'rgb(91,86,112)', fontSize: 17, lineHeight: 1.55, margin: '0 0 22px' }}>Sumate al club como <strong>paseador, guardería, adiestrador, baño y estética o cuidador</strong>. Llegá a miles de socios de Kumo, recibí reseñas verificadas y gestioná tu agenda desde un solo lugar.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 26 }}>
            {[
              { t: 'Miles de socios buscando tu servicio', i: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{personPaths}</svg> },
              { t: 'Reseñas verificadas que suben tu reputación', i: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{chatPath}</svg> },
              { t: 'Agenda y cobros en un solo lugar', i: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{idCardPaths}</svg> },
            ].map((b) => (
              <div key={b.t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{b.i}</div>
                <span style={{ fontSize: 15, color: 'rgb(33,30,51)', fontWeight: 600 }}>{b.t}</span>
              </div>
            ))}
          </div>
          <button onClick={() => openAuth('prestador')} className="scpa" style={{ display: 'inline-block', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: '15px 28px', borderRadius: 14, boxShadow: '0 10px 24px rgba(93,84,145,0.28)', cursor: 'pointer', transition: 'background 0.15s' }}>Quiero ofrecer mis servicios →</button>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ background: '#fff', border: '1.5px solid rgb(230,227,240)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 16px 40px rgba(93,84,145,0.12)' }}>
            <div className="r-rubro-img" style={{ height: 440, position: 'relative', background: 'rgb(231,225,245)', overflow: 'hidden' }}>
              <img key={cur.key} src={IMG(cur.photo)} alt={cur.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', animation: 'kfade 0.5s ease' }} />
            </div>
            <div style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill={icon.filled ? '#5D5491' : 'none'} stroke={icon.filled ? 'none' : '#5D5491'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{icon.inner}</svg>
              </div>
              <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 20, color: 'rgb(33,30,51)' }}>{cur.name}</div>
                <div style={{ fontSize: 14, color: 'rgb(135,129,160)' }}>{cur.count}</div>
              </div>
              <button className="scpa" onClick={() => setActive((i) => (i + 1) % cats.length)} style={{ width: 44, height: 44, borderRadius: 12, background: 'rgb(93,84,145)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', transition: 'background 0.15s' }}>→</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
            {cats.map((c, d) => (
              <button key={c.key} onClick={() => setActive(d)} aria-label={c.name} style={{ width: d === active ? 26 : 9, height: 9, borderRadius: 100, border: 'none', cursor: 'pointer', padding: 0, transition: '0.3s', background: d === active ? 'rgb(93,84,145)' : 'rgb(207,201,224)' }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Comunidad en vivo ─────────────────────────────────────────── */
const communityCards = [
  { tag: 'Paseadores', tagColor: 'rgb(31,125,80)', tagBg: 'rgb(226,245,234)', trend: true, meta: <><span>Cami</span> · <span>Palermo · hace 2h</span></>, title: '¿Alguien probó a Lucas de Paseos Palermo?', replies: 14, likes: 23, rot: -1.4, iconBg: 'rgb(34,160,107)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" stroke="none">{paw}</svg> },
  { tag: 'Salud', tagColor: 'rgb(93,84,145)', tagBg: 'rgb(240,237,249)', trend: true, meta: <><span>Nico</span> · <span>General · hace 5h</span></>, title: 'Mi gato no quiere la pastilla antipulgas, ¿tips?', replies: 31, likes: 47, rot: 1.1, iconBg: 'rgb(93,84,145)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{plusCircle}</svg> },
  { tag: 'Guarderías', tagColor: 'rgb(176,111,24)', tagBg: 'rgb(251,243,226)', trend: false, meta: <><span>Meli</span> · <span>Caballito · ayer</span></>, title: 'Recomendaciones de guardería para finde largo', replies: 9, likes: 12, rot: -0.7, iconBg: 'rgb(217,138,43)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg> },
];

function Community() {
  const stat = (num: string, label: string) => (
    <div>
      <div style={{ display: 'inline-block', fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, color: 'rgb(33,30,51)', position: 'relative' }}>
        <span style={{ position: 'relative', zIndex: 1 }}>{num}</span>
        <span style={{ position: 'absolute', left: -3, right: -3, bottom: 3, height: 11, background: 'rgb(225,251,98)', zIndex: 0, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 13, color: 'rgb(135,129,160)' }}>{label}</div>
    </div>
  );
  const divider = <div style={{ width: 1, background: 'rgb(217,208,238)' }} />;
  return (
    <section className="r-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px' }}>
      <div className="r-grid2 r-banner" style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgb(239,234,252) 0%, rgb(246,242,255) 60%, rgb(234,228,251) 100%)', border: '1px solid rgb(230,225,245)', borderRadius: 32, padding: '52px 48px', display: 'grid', gridTemplateColumns: '0.92fr 1.08fr', gap: 44, alignItems: 'center' }}>
        <div style={{ position: 'absolute', right: -70, top: -70, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,251,98,0.35), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 12, padding: '7px 14px', borderRadius: 100, marginBottom: 18, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(225,251,98)', animation: 'kpulse 1.8s ease-out infinite' }} />Comunidad Kumo · en vivo
          </div>
          <h2 className="r-h2" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 40, letterSpacing: '-0.02em', margin: '0 0 14px', lineHeight: 1.05 }}>Preguntá, opiná y<br />elegí <span style={{ position: 'relative', whiteSpace: 'nowrap', color: 'rgb(93,84,145)' }}>mejor<span style={{ position: 'absolute', left: 0, right: 0, bottom: 4, height: 11, background: 'rgb(225,251,98)', zIndex: -1, borderRadius: 3 }} /></span></h2>
          <p style={{ color: 'rgb(91,86,112)', fontSize: 17, lineHeight: 1.55, margin: '0 0 24px', maxWidth: 400 }}>Un foro de dueños responsables: compartí cómo te fue con un paseador, resolvé dudas y encontrá recomendaciones reales de otros socios.</p>
          <div style={{ display: 'flex', gap: 26, marginBottom: 26 }}>
            {stat('8.4k', 'socios activos')}
            {divider}
            {stat('1.2k', 'dudas resueltas')}
            {divider}
            {stat('24h', 'respuesta prom.')}
          </div>
          <a href={WEBAPP} className="scpm" style={{ background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 15, padding: '14px 26px', borderRadius: 14, cursor: 'pointer', boxShadow: '0 10px 24px rgba(93,84,145,0.28)', transition: 'transform 0.18s', textDecoration: 'none', display: 'inline-block' }}>Unirme a la conversación →</a>
        </div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {communityCards.map((c, i) => (
            <div key={i} className="scpn" style={{ background: '#fff', border: '1px solid rgb(236,234,244)', borderRadius: 20, padding: '18px 20px', boxShadow: '0 10px 30px rgba(93,84,145,0.09)', transform: `rotate(${c.rot}deg)`, transition: 'transform 0.22s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.22s' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', boxShadow: '0 4px 10px rgba(0,0,0,0.12)' }}>{c.icon}</div>
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.tagColor, background: c.tagBg, padding: '3px 9px', borderRadius: 6 }}>{c.tag}</span>
                    {c.trend && <span style={{ fontSize: 10, fontWeight: 800, color: 'rgb(33,30,51)', background: 'rgb(225,251,98)', padding: '3px 8px', borderRadius: 6, letterSpacing: '0.03em' }}>EN TENDENCIA</span>}
                    <span style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{c.meta}</span>
                  </div>
                  <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 16, lineHeight: 1.25, marginBottom: 12, color: 'rgb(33,30,51)' }}>{c.title}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 12.5, padding: '5px 11px', borderRadius: 100 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{chatPath}</svg>{c.replies}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgb(251,232,239)', color: 'rgb(193,77,122)', fontWeight: 600, fontSize: 12.5, padding: '5px 11px', borderRadius: 100 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#c14d7a">{heartPath}</svg>{c.likes}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Cómo funcionan los reintegros ─────────────────────────────── */
const steps = [
  { n: '1', t: 'Guardá la factura', d: 'Ticket fiscal a tu nombre, con detalle de la atención.' },
  { n: '2', t: 'Subila a la app', d: 'Por app, WhatsApp o email, dentro de los 30 días.' },
  { n: '3', t: 'Indicá tu CBU/CVU', d: 'Para que podamos acreditarte el dinero.' },
  { n: '4', t: 'Cobrá el reintegro', d: 'Lo acreditamos en hasta 30 días hábiles.' },
];
const carencias = [
  ['Consultas y vacunas', '60 días'], ['Estudios', '90 días'], ['Cirugías', '180 días'], ['Accidentes', '72 horas'],
];

function Reintegros() {
  return (
    <section className="r-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 24px 60px' }}>
      <div style={{ background: 'rgb(240,237,249)', borderRadius: 28, padding: 44 }}>
        <h2 className="r-h2" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 6px' }}>¿Cómo funcionan los reintegros?</h2>
        <p style={{ textAlign: 'center', color: 'rgb(135,129,160)', fontSize: 16, margin: '0 0 32px' }}>Una devolución parcial de lo que gastaste en el vet, en 4 pasos.</p>
        <div className="r-grid4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {steps.map((s) => (
            <div key={s.n} style={{ background: '#fff', borderRadius: 18, padding: 22 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgb(93,84,145)', color: 'rgb(225,251,98)', fontFamily: '"Baloo 2"', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{s.n}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5 }}>{s.t}</div>
              <div style={{ fontSize: 14, color: 'rgb(122,117,146)', lineHeight: 1.5 }}>{s.d}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 26 }}>
          {carencias.map(([k, v]) => (
            <div key={k} style={{ background: '#fff', border: '1px solid rgb(224,220,236)', borderRadius: 100, padding: '8px 16px', fontSize: 13, color: 'rgb(91,86,112)' }}>
              <strong style={{ color: 'rgb(93,84,145)' }}>{k}:</strong> carencia {v}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA final ─────────────────────────────────────────────────── */
function FinalCta() {
  const openAuth = useAuth();
  return (
    <section className="r-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px 70px' }}>
      <div className="r-cta-final" style={{ background: 'rgb(33,30,51)', borderRadius: 28, padding: '44px 0 44px 56px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'absolute', top: -40, right: -20, opacity: 0.06 }}>
          <svg width="180" height="180" viewBox="0 0 24 24" fill="#fff" style={{ display: 'block' }}>{paw}</svg>
        </div>
        <div style={{ flex: '1 1 300px', position: 'relative', zIndex: 2, minWidth: 0 }}>
          <h2 className="r-h2" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 40, lineHeight: 1.1, letterSpacing: '-0.02em', color: '#fff', margin: '0 0 12px', maxWidth: 380, textWrap: 'balance' } as CSSProperties}>Sumá a tu mascota al club</h2>
          <p style={{ color: 'rgb(179,171,214)', fontSize: 16.5, lineHeight: 1.5, margin: '0 0 24px', maxWidth: 400 }}>Desde $18.000/mes. Sin permanencia. Con derecho de arrepentimiento de 10 días.</p>
          <button onClick={() => openAuth('register')} className="scpg" style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', border: 'none', fontWeight: 700, fontSize: 17, padding: '16px 34px', borderRadius: 14, display: 'inline-block', transition: 'background 0.15s', cursor: 'pointer' }}>Unirme ahora →</button>
        </div>
        <img className="r-cta-img" src={IMG('asset-298f6560.webp')} alt="Mascotas" style={{ flex: '1 1 420px', minWidth: 0, maxWidth: 560, height: 245, objectFit: 'contain', objectPosition: 'right center', position: 'relative', zIndex: 2 }} />
      </div>
    </section>
  );
}

/* ── FAQ ───────────────────────────────────────────────────────── */
function Faqs() {
  const { faqs } = useContent();
  return (
    <section id="faq" className="r-sec" style={{ maxWidth: 1180, margin: '60px auto 0', padding: '60px 24px', scrollMarginTop: 80 }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 className="r-h2" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 40, color: 'rgb(33,30,51)', margin: '0 0 12px' }}>Preguntas frecuentes</h2>
        <p style={{ fontSize: 16, color: 'rgb(91,86,112)', margin: 0 }}>Todo lo que necesitás saber sobre Kumo</p>
      </div>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {faqs.map((f, i) => (
          <details key={f.id} open={i === 0} style={{ border: '1px solid rgb(230,227,240)', borderRadius: 12, padding: 20, cursor: 'pointer', background: '#fff', transition: '0.2s' }}>
            <summary style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 16, color: 'rgb(33,30,51)', cursor: 'pointer', userSelect: 'none' }}>{f.question}</summary>
            <p style={{ fontSize: 14, color: 'rgb(91,86,112)', margin: '12px 0 0', lineHeight: 1.55 }}>{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ── WhatsApp flotante ─────────────────────────────────────────── */
function WhatsApp() {
  const { whatsapp } = useContent();
  return (
    <a href={waLink(whatsapp)} target="_blank" rel="noopener" aria-label="WhatsApp" className="scpo" style={{ position: 'fixed', right: 24, bottom: 96, zIndex: 150, width: 58, height: 58, borderRadius: '50%', background: 'rgb(37,211,102)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37,211,102,0.4)', textDecoration: 'none', transition: 'transform 0.18s, box-shadow 0.18s' }}>
      <svg width="31" height="31" viewBox="0 0 24 24" fill="#fff" style={{ display: 'block' }}>
        <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.5-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.3 4.7.7.3 1.3.5 1.8.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4z" />
        <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
      </svg>
    </a>
  );
}

/* ── Footer ────────────────────────────────────────────────────── */
const buildFootCols = (email: string): { title: string; links: { l: string; h?: string; auth?: AuthMode }[] }[] => [
  { title: 'Producto', links: [
    { l: 'Planes y precios', h: '/#planes' },
    { l: 'Beneficios', h: '/#beneficios' },
    { l: 'Prestadores', h: '/#prestadores' },
    { l: 'Sumarme al club', auth: 'register' },
  ] },
  { title: 'Empresa', links: [
    { l: 'Sobre Kumo', h: '/#faq' },
    { l: 'Ofrecer un servicio', auth: 'register' },
    { l: 'Contacto', h: `mailto:${email}` },
    { l: email, h: `mailto:${email}` },
  ] },
  { title: 'Legal', links: [
    { l: 'Términos y condiciones', h: '/legal#terminos' },
    { l: 'Política de privacidad', h: '/legal#privacidad' },
    { l: 'Derecho de arrepentimiento', h: '/legal#arrepentimiento' },
  ] },
];

function Footer() {
  const openAuth = useAuth();
  const { email } = useContent();
  const footCols = buildFootCols(email);
  return (
    <footer style={{ borderTop: '1px solid rgb(230,227,240)', padding: '56px 24px 0', background: 'rgb(250,249,252)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div className="r-foot-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40, paddingBottom: 40 }}>
          <div>
            <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 26, letterSpacing: '-0.01em', color: 'rgb(93,84,145)' }}>Kumo</span>
            <p style={{ color: 'rgb(135,129,160)', fontSize: 14, lineHeight: 1.6, margin: '14px 0 18px', maxWidth: 260 }}>Club de beneficios para dueños de mascotas: descuentos, reintegros, carnet digital y una red de prestadores de confianza.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="#" className="scpp" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(93,84,145)', textDecoration: 'none' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c-5.4 0-9.8 4.4-9.8 9.8 0 4.9 3.6 8.9 8.3 9.7v-6.9H8.1v-2.8h2.4V9.8c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5v1.8h2.6l-.4 2.8h-2.2v6.9c4.7-.7 8.3-4.8 8.3-9.7 0-5.4-4.4-9.8-9.8-9.8z" /></svg>
              </a>
              <a href="#" className="scpp" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(93,84,145)', textDecoration: 'none' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><line x1="17.5" y1="6.5" x2="17.5" y2="6.5" /></svg>
              </a>
              <a href="#" className="scpp" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(93,84,145)', textDecoration: 'none' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M22 5.9c-.7.3-1.6.6-2.4.7.9-.5 1.5-1.4 1.9-2.3-.8.5-1.7.8-2.7 1a4.3 4.3 0 0 0-7.3 3.9A12.2 12.2 0 0 1 2.9 4.6a4.3 4.3 0 0 0 1.3 5.7c-.7 0-1.3-.2-1.9-.5v.1c0 2.1 1.5 3.8 3.4 4.2-.6.2-1.2.2-1.8.1.5 1.7 2.1 2.9 3.9 2.9A8.6 8.6 0 0 1 2 18.6a12.2 12.2 0 0 0 6.6 1.9c7.9 0 12.2-6.5 12.2-12.2v-.6c.8-.6 1.5-1.3 2.2-2.1z" /></svg>
              </a>
            </div>
          </div>
          {footCols.map((col) => (
            <div key={col.title}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'rgb(33,30,51)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>{col.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {col.links.map((x) => (
                  x.auth
                    ? <button key={x.l} onClick={() => openAuth(x.auth!)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, color: 'rgb(91,86,112)', fontSize: 14, fontFamily: '"DM Sans"', cursor: 'pointer' }}>{x.l}</button>
                    : <a key={x.l} href={x.h} style={{ color: 'rgb(91,86,112)', fontSize: 14, textDecoration: 'none' }}>{x.l}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgb(230,227,240)', padding: '22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'rgb(162,157,186)' }}>© 2026 Kumo. Todos los derechos reservados.</span>
          <span className="r-foot-legal" style={{ fontSize: 12.5, color: 'rgb(162,157,186)', maxWidth: 640, textAlign: 'right' }}>Administradora del club con sede en CABA, Argentina, habilitada a operar en todo el territorio nacional. Kumo no es un seguro ni una prepaga. Tus derechos como consumidor están protegidos por la Ley 24.240.</span>
        </div>
      </div>
    </footer>
  );
}

const AVISOS_LOGIN: Record<string, string> = {
  'no-socio': 'Esa cuenta de Google todavía no es socia de Kumo. Asociate primero y después podés entrar con Google.',
  cancelado: 'Cancelaste el ingreso con Google.',
  error: 'No pudimos completar el ingreso con Google. Probá de nuevo.',
};

export default function LandingClient({ content }: { content: LandingContent }) {
  // 'login' → modal de login; 'register' → onboarding de socio; 'prestador' → landing de prestadores
  const [view, setView] = useState<View | null>(null);
  const [avisoLogin, setAvisoLogin] = useState('');

  // Cuando /auth/callback rebota (por ejemplo, una cuenta de Google que no es
  // socia) vuelve con ?login=… : se abre el modal para explicarlo ahí mismo.
  // Se lee de window en vez de useSearchParams para no forzar el render en
  // cliente de una página que es estática.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('login');
    if (!p) return;
    setAvisoLogin(AVISOS_LOGIN[p] ?? AVISOS_LOGIN.error!);
    setView('login');
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  return (
    <ContentCtx.Provider value={content}>
    <AuthCtx.Provider value={(m) => setView(m)}>
      <main style={{ minHeight: '100vh' }}>
        <Nav />
        <Hero />
        <Plans />
        <AppAndClub />
        <Membership />
        <Services />
        <FamiliaKumo />
        <Prestadores />
        <Community />
        <Reintegros />
        <FinalCta />
        <Faqs />
        <WhatsApp />
        <Footer />
      </main>
      <AuthModal mode={view === 'login' ? 'login' : null} onClose={() => { setView(null); setAvisoLogin(''); }} aviso={avisoLogin} />
      <Onboarding open={view === 'register'} onClose={() => setView(null)} plans={content.plans} />
      <PrestadoresPage open={view === 'prestador'} onClose={() => setView(null)} />
    </AuthCtx.Provider>
    </ContentCtx.Provider>
  );
}
