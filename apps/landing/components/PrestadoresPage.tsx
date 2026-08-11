'use client';

import { useState } from 'react';

/*
 * Landing de PRESTADORES — se abre desde "Quiero ofrecer servicios →" de la landing
 * principal. Reproduce la página del prototipo (badge "Prestadores", hero morado,
 * stats, beneficios, 3 pasos, planes Básico/Pro y CTA) + el modal "Sumate como
 * prestador" (alta de rubro + cuenta). Presentado como página web completa.
 */

const BRAND = '#5D5491';
const LIME = '#E1FB62';
const INK = '#211E33';

const baloo = (size: number, color = INK): React.CSSProperties => ({ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: size, color, margin: 0, letterSpacing: '-0.01em' });
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#5b5670', marginBottom: 6 };
const input: React.CSSProperties = { width: '100%', padding: '13px 14px', border: '1.5px solid #e6e3f0', borderRadius: 12, fontSize: 15, background: '#fff', color: INK, outline: 'none', fontFamily: '"DM Sans"', boxSizing: 'border-box' };

const S = ({ d, size = 22, color = BRAND }: { d: React.ReactNode; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const IC = {
  person: <><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  idcard: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.1" /><path d="M6.2 16c.5-1.5 1.9-2.4 3.3-2.4s2.8.9 3.3 2.4" /><line x1="14" y1="9" x2="17.5" y2="9" /><line x1="14" y1="13" x2="16.5" y2="13" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2" /><rect x="2" y="7" width="20" height="12" rx="2" /><path d="M22 11h-4a2 2 0 0 0 0 4h4" /></>,
  tag: <><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r="1.2" /></>,
  shield: <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />,
  house: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></>,
  paw: <><circle cx="5.5" cy="10" r="1.5" fill={BRAND} stroke="none" /><circle cx="9.7" cy="6.6" r="1.6" fill={BRAND} stroke="none" /><circle cx="14.3" cy="6.6" r="1.6" fill={BRAND} stroke="none" /><circle cx="18.5" cy="10" r="1.5" fill={BRAND} stroke="none" /><path d="M8 14.2c-1.3 1-1.9 2.4-1.5 3.8.3 1.3 1.5 2 2.9 1.7 1-.2 1.6-.6 2.6-.6s1.6.4 2.6.6c1.4.3 2.6-.4 2.9-1.7.4-1.4-.2-2.8-1.5-3.8-1.1-.9-2.1-1.5-4-1.5s-2.9.6-4 1.5z" fill={BRAND} stroke="none" /></>,
  droplet: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
};

const FEATURES: { icon: keyof typeof IC; t: string; d: string }[] = [
  { icon: 'person', t: 'Clientes verificados', d: 'Recibí consultas de socios reales de Kumo, con perfil y mascota validados.' },
  { icon: 'chat', t: 'Reseñas que suman', d: 'Cada trabajo bien hecho mejora tu reputación y te acerca más clientes.' },
  { icon: 'idcard', t: 'Agenda integrada', d: 'Gestioná reservas, disponibilidad y recordatorios desde un solo panel.' },
  { icon: 'wallet', t: 'Cobros simples', d: 'Recibí pagos por la app y llevá el control de tus ingresos sin vueltas.' },
  { icon: 'tag', t: 'Visibilidad local', d: 'Aparecé en el mapa y en las búsquedas de los socios de tu zona.' },
  { icon: 'shield', t: 'Soporte del club', d: 'Un equipo que te acompaña ante cualquier duda o inconveniente.' },
];
const STEPS = [
  { n: 1, t: 'Registrate', d: 'Completá tus datos, elegí tu rubro y contanos qué ofrecés. Lleva menos de 5 minutos.' },
  { n: 2, t: 'Validamos tu perfil', d: 'Revisamos tu información y activamos tu perfil de prestador en el club.' },
  { n: 3, t: 'Recibí clientes', d: 'Los socios te encuentran, reservan y te dejan reseñas. Vos gestionás todo desde la app.' },
];
const RUBROS: { label: string; icon: keyof typeof IC }[] = [
  { label: 'Paseador', icon: 'paw' }, { label: 'Guardería', icon: 'house' }, { label: 'Adiestrador', icon: 'idcard' },
  { label: 'Baño y estética', icon: 'droplet' }, { label: 'Cuidador', icon: 'person' }, { label: 'Otro', icon: 'paw' },
];

function RegModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rubro, setRubro] = useState('Paseador');
  const [sent, setSent] = useState(false);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(33,30,51,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 24, padding: 30, margin: 'auto', boxShadow: '0 30px 70px rgba(33,30,51,0.4)', position: 'relative', animation: 'kpop 0.18s ease-out' }}>
        <button onClick={onClose} aria-label="Cerrar" style={{ position: 'absolute', top: 18, right: 18, width: 34, height: 34, border: 'none', background: '#f0edf9', borderRadius: 10, cursor: 'pointer', color: BRAND, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#eef7d6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}><S d={<path d="M4 12l5 5L20 6" />} size={30} color="#6f9a1f" /></div>
            <h2 style={baloo(24)}>¡Solicitud enviada!</h2>
            <p style={{ color: '#5b5670', fontSize: 15, lineHeight: 1.55, margin: '10px auto 22px', maxWidth: 360 }}>Revisamos tus datos y activamos tu perfil de prestador en el club. Te contactamos en 48 hs.</p>
            <button onClick={onClose} style={{ background: BRAND, color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: '13px 26px', borderRadius: 13, cursor: 'pointer' }}>Volver</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 12, height: 12, borderRadius: '50% 50% 50% 3px', background: LIME, transform: 'rotate(45deg)' }} /></div>
              <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, color: BRAND }}>Kumo</span>
            </div>
            <h2 style={{ ...baloo(24), margin: '6px 0 4px' }}>Sumate como prestador</h2>
            <p style={{ color: '#8781a0', fontSize: 14, margin: '0 0 20px' }}>Elegí tu rubro y contanos sobre tu servicio. Te contactamos en 48 hs.</p>

            <label style={label}>¿Qué servicio ofrecés?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {RUBROS.map((r) => {
                const on = rubro === r.label;
                return (
                  <button key={r.label} type="button" onClick={() => setRubro(r.label)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 13, border: '1.5px solid ' + (on ? BRAND : '#e6e3f0'), background: on ? '#faf9fd' : '#fff', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, color: INK }}>
                    <S d={IC[r.icon]} size={19} /> {r.label}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: 14 }}><label style={label}>Nombre o empresa</label><input placeholder="Ej: Paseos Palermo / Lucas M." style={input} /></div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}><label style={label}>Zona</label><input placeholder="Palermo, CABA" style={input} /></div>
              <div style={{ flex: 1 }}><label style={label}>WhatsApp</label><input placeholder="+54 11 ..." style={input} /></div>
            </div>
            <div style={{ marginBottom: 20 }}><label style={label}>Contanos sobre tu servicio</label><textarea placeholder="Experiencia, disponibilidad, precios de referencia…" style={{ ...input, minHeight: 92, resize: 'vertical' }} /></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
              <S d={<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>} size={17} color="#8781a0" />
              <span style={{ fontWeight: 700, fontSize: 15, color: INK }}>Creá tu cuenta de prestador</span>
            </div>
            <div style={{ marginBottom: 14 }}><label style={label}>Email</label><input type="email" placeholder="tuempresa@email.com" style={input} /></div>
            <div style={{ marginBottom: 22 }}><label style={label}>Contraseña</label><input type="password" placeholder="Mínimo 8 caracteres" style={input} /></div>

            <button onClick={() => setSent(true)} style={{ width: '100%', background: BRAND, color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: 15, borderRadius: 14, boxShadow: '0 8px 20px rgba(93,84,145,0.28)', cursor: 'pointer' }}>Crear cuenta y enviar solicitud</button>
          </>
        )}
      </div>
    </div>
  );
}

export function PrestadoresPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [reg, setReg] = useState(false);
  if (!open) return null;
  const limeBtn: React.CSSProperties = { background: LIME, color: INK, border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: '15px 28px', borderRadius: 14, cursor: 'pointer', display: 'inline-block' };
  const check = <S d={<path d="M4 12l5 5L20 6" />} size={16} color="#6f9a1f" />;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: '#f5f4f8', overflowY: 'auto' }}>
      {/* Nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(245,244,248,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e6e3f0' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, color: BRAND }}>Kumo</span>
            <span style={{ background: LIME, color: INK, fontWeight: 700, fontSize: 12, padding: '4px 10px', borderRadius: 100 }}>Prestadores</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5b5670', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>← Volver a Kumo</button>
            <button onClick={() => setReg(true)} style={{ background: BRAND, color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: '11px 22px', borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 12px rgba(93,84,145,0.25)' }}>Registrarme</button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#5D5491,#463f70)', color: '#fff' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px 64px', display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: 40, alignItems: 'center' }} className="r-prov-hero">
          <div>
            <span style={{ display: 'inline-block', background: LIME, color: INK, fontWeight: 700, fontSize: 13, padding: '6px 14px', borderRadius: 100, marginBottom: 20 }}>Ganá con tu pasión por las mascotas</span>
            <h1 style={{ ...baloo(46, '#fff'), lineHeight: 1.05, marginBottom: 18 }}>Tu servicio, frente a miles de dueños</h1>
            <p style={{ color: '#d8d3ec', fontSize: 17, lineHeight: 1.55, marginBottom: 28, maxWidth: 440 }}>Sumate como paseador, guardería, adiestrador, baño y estética o cuidador. Kumo te conecta con socios verificados de todo el país y te da las herramientas para crecer.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setReg(true)} style={limeBtn}>Quiero ofrecer mis servicios →</button>
              <a href="#prov-como" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: '15px 26px', borderRadius: 14, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Cómo funciona</a>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[['+12k', 'socios activos buscando servicios para su mascota'], ['48h', 'promedio para conseguir tu primer cliente'], ['0%', 'comisión sobre tus clientes propios']].map(([n, d]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 18, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: '18px 22px' }}>
                <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 34, color: LIME, flex: '0 0 auto', minWidth: 74 }}>{n}</span>
                <span style={{ color: '#d8d3ec', fontSize: 14.5, lineHeight: 1.4 }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Por qué sumarte */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ ...baloo(34), textAlign: 'center', marginBottom: 8 }}>Por qué sumarte a Kumo</h2>
        <p style={{ textAlign: 'center', color: '#8781a0', fontSize: 16, marginBottom: 40 }}>Todo lo que necesitás para conseguir clientes y gestionar tu servicio, sin comisiones</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
          {FEATURES.map((f) => (
            <div key={f.t} style={{ background: '#fff', border: '1px solid #eeecf5', borderRadius: 20, padding: 26 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f0edf9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><S d={IC[f.icon]} size={23} /></div>
              <h3 style={{ ...baloo(19), marginBottom: 8 }}>{f.t}</h3>
              <p style={{ color: '#5b5670', fontSize: 14.5, lineHeight: 1.5, margin: 0 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Empezá en 3 pasos */}
      <div id="prov-como" style={{ background: '#efecf7', scrollMarginTop: 70 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '64px 24px' }}>
          <h2 style={{ ...baloo(34), textAlign: 'center', marginBottom: 40 }}>Empezá en 3 pasos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ background: '#fff', border: '1px solid #eeecf5', borderRadius: 20, padding: 26 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: LIME, color: INK, fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>{s.n}</div>
                <h3 style={{ ...baloo(19), marginBottom: 8 }}>{s.t}</h3>
                <p style={{ color: '#5b5670', fontSize: 14.5, lineHeight: 1.5, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Planes */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ ...baloo(34), textAlign: 'center', marginBottom: 8 }}>Sin costo para empezar</h2>
        <p style={{ textAlign: 'center', color: '#8781a0', fontSize: 16, marginBottom: 40, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>Publicá tu perfil gratis. Solo pagás una comisión baja cuando concretás un servicio a través de Kumo.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20, maxWidth: 820, margin: '0 auto' }}>
          {/* Básico */}
          <div style={{ background: '#fff', border: '1px solid #eeecf5', borderRadius: 22, padding: 30 }}>
            <h3 style={{ ...baloo(20), marginBottom: 8 }}>Perfil Básico</h3>
            <div style={{ ...baloo(40, BRAND), marginBottom: 4 }}>Gratis</div>
            <p style={{ color: '#8781a0', fontSize: 13.5, marginBottom: 22 }}>Ideal para empezar</p>
            {['Perfil público en el club', 'Aparecés en búsquedas', 'Reseñas de socios'].map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 14.5, color: '#211E33' }}>{check}{t}</div>
            ))}
          </div>
          {/* Pro */}
          <div style={{ background: 'linear-gradient(135deg,#5D5491,#463f70)', borderRadius: 22, padding: 30, position: 'relative', color: '#fff' }}>
            <span style={{ position: 'absolute', top: -12, right: 24, background: LIME, color: INK, fontWeight: 700, fontSize: 12, padding: '5px 14px', borderRadius: 100 }}>Recomendado</span>
            <h3 style={{ ...baloo(20, '#fff'), marginBottom: 8 }}>Perfil Pro</h3>
            <div style={{ marginBottom: 4 }}><span style={baloo(40, LIME)}>$4.990</span><span style={{ fontSize: 15, color: '#d8d3ec' }}>/mes</span></div>
            <p style={{ color: '#d8d3ec', fontSize: 13.5, marginBottom: 22 }}>Más visibilidad y clientes</p>
            {['Todo lo del plan Básico', 'Destacado en el mapa y el buscador', 'Estadísticas de tu perfil', 'Insignia "Pro" verificada'].map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 14.5, color: '#fff' }}><S d={<path d="M4 12l5 5L20 6" />} size={16} color={LIME} />{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA final */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{ background: 'linear-gradient(135deg,#5D5491,#463f70)', borderRadius: 28, padding: '56px 24px', textAlign: 'center', color: '#fff' }}>
          <h2 style={{ ...baloo(38, '#fff'), marginBottom: 14 }}>Sumá tu servicio hoy</h2>
          <p style={{ color: '#d8d3ec', fontSize: 16.5, lineHeight: 1.5, margin: '0 auto 28px', maxWidth: 460 }}>Registrarte lleva menos de 5 minutos. Empezá a recibir clientes esta misma semana.</p>
          <button onClick={() => setReg(true)} style={limeBtn}>Registrarme como prestador →</button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e6e3f0' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, color: BRAND }}>Kumo</span>
          <span style={{ fontSize: 12.5, color: '#a29dba', maxWidth: 560, textAlign: 'right' }}>Administradora del club con sede en CABA, Argentina, habilitada a operar en todo el territorio nacional. Kumo no es un seguro ni una prepaga.</span>
        </div>
      </div>

      <RegModal open={reg} onClose={() => setReg(false)} />
    </div>
  );
}
