'use client';
import type { CSSProperties, ReactNode } from 'react';

import { useState } from 'react';
import { data, urls, FOTO_TIPOS, FOTO_MAX } from '@kumo/shared';
import { supabase } from '@/lib/supabase-browser';

/*
 * Onboarding de alta de socio — 5 pasos (igual al prototipo, pero presentado como WEB,
 * no dentro de un marco de teléfono). Lo abren "Empezar / Unirme al club / Elegir plan".
 * Pasos: 1) Tu mascota  2) Tus datos  3) Elegí tu plan  4) Declaración jurada
 * 5) Medio de pago → sheet "Confirmá tu alta" → pantalla final "¡Bienvenido al club!".
 */

const WEBAPP = urls.webapp;
const money = (n: number) => '$' + n.toLocaleString('es-AR');

const PROVINCIAS = ['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];

const HEALTH_Q = [
  '¿Tu mascota tiene o tuvo diagnóstico de enfermedad oncológica?',
  '¿Tiene enfermedades crónicas con medicación o control continuo?',
  '¿Tiene enfermedades hereditarias o congénitas diagnosticadas?',
  '¿Está actualmente en tratamiento veterinario?',
  '¿Fue operada en los últimos 12 meses?',
  '¿Tiene alguna condición ortopédica diagnosticada (displasia u otra)?',
  '¿Está en gestación o lactancia?',
];
const SANITARIO_Q = [
  'Vacuna antirrábica al día',
  'Vacuna polivalente al día',
  'Desparasitación interna en los últimos 6 meses',
  'Desparasitación externa en los últimos 3 meses',
];

const PLAN_META: Record<string, { desc: string; perks: string[] }> = {
  AMIGO: {
    desc: 'Descuentos, carnet digital y reintegro 30%.',
    perks: ['Descuentos en red veterinaria', 'Carnet digital de salud', 'Recordatorios de vacunas', 'Reintegro 30% consultas y vacunas', 'Tope mensual $5.400'],
  },
  FAMILIA: {
    desc: 'Consultas online ilimitadas y reintegro hasta 50%.',
    perks: ['Todo lo de AMIGO', 'Chat con veterinarias ilimitado', 'Asesor por WhatsApp', 'Reintegro 50% consultas · 40% estudios', 'Tope mensual $12.500'],
  },
  VIP: {
    desc: 'Cobertura máxima y reintegro 60% en todo.',
    perks: ['Todo lo de FAMILIA', 'Atención prioritaria', 'WhatsApp prioritario', 'Reintegro 60% en todo', 'Tope mensual $15.000'],
  },
};

const PAY_METHODS: { key: 'tarjeta' | 'cbu'; label: string; icon: ReactNode }[] = [
  { key: 'tarjeta', label: 'Tarjeta de crédito/débito', icon: <><rect x="2" y="5" width="20" height="14" rx="2.5" /><line x1="2" y1="10" x2="22" y2="10" /></> },
  { key: 'cbu', label: 'Débito por CBU/CVU', icon: <><path d="M3 10.5 12 4l9 6.5" /><path d="M5 10v9h14v-9" /><line x1="9" y1="13" x2="9" y2="19" /><line x1="15" y1="13" x2="15" y2="19" /></> },
];

const formatDni = (raw: string) => raw.replace(/\D/g, '').slice(0, 8).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const formatTel = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  return [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10)].filter(Boolean).join(' ');
};
const todayShort = () => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };

const input: CSSProperties = { width: '100%', padding: '13px 14px', border: '1.5px solid #e6e3f0', borderRadius: 12, fontSize: 15, background: '#fff', color: '#211E33', outline: 'none', fontFamily: '"DM Sans"', boxSizing: 'border-box' };
const label: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#5b5670', marginBottom: 6 };
const field = (l: ReactNode, node: ReactNode) => (<div style={{ marginBottom: 14 }}><label style={label}>{l}</label>{node}</div>);
const Ic = ({ d, size = 20, color = '#5D5491' }: { d: ReactNode; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const Radio = ({ on }: { on: boolean }) => (
  <span style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid ' + (on ? '#5D5491' : '#e6e3f0'), flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {on && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#5D5491' }} />}
  </span>
);

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)} style={{ flex: 1, padding: '11px 8px', borderRadius: 12, border: '1.5px solid ' + (value === o ? '#5D5491' : '#e6e3f0'), background: value === o ? '#5D5491' : '#fff', color: value === o ? '#fff' : '#5b5670', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: '0.15s' }}>{o}</button>
      ))}
    </div>
  );
}

export function Onboarding({ open, onClose, initialPet, initialType, plans = data.plans }: { open: boolean; onClose: () => void; initialPet?: string; initialType?: string; plans?: typeof data.plans }) {
  const [step, setStep] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [memberNo, setMemberNo] = useState<number | null>(null);
  const [avisoFoto, setAvisoFoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // paso 1
  const [pet, setPet] = useState({ nombre: initialPet ?? '', especie: initialType === 'gato' ? 'Gato' : 'Perro', sexo: 'Macho', castrado: 'Sí', raza: '', edad: '', peso: '', microchip: '', vet: '', foto: '' });
  const [petPhotoFile, setPetPhotoFile] = useState<File | null>(null);
  const [fotoError, setFotoError] = useState('');

  /** Se valida acá y no solo en el servidor: si el tipo no entra, antes el alta
   *  respondía "listo" y la foto se perdía sin que nadie se enterara. */
  const elegirFoto = (f?: File) => {
    if (!f) return;
    if (!FOTO_TIPOS.includes(f.type as (typeof FOTO_TIPOS)[number])) {
      setFotoError(`Ese formato no lo podemos usar (${f.type || 'desconocido'}). Probá con JPG, PNG o WEBP. Si es una foto de iPhone, mandala desde "Fotos" y se convierte sola.`);
      return;
    }
    if (f.size > FOTO_MAX) {
      setFotoError(`La foto pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es 5 MB. Probá con una más chica.`);
      return;
    }
    setFotoError('');
    setPet((p) => ({ ...p, foto: URL.createObjectURL(f) }));
    setPetPhotoFile(f);
  };

  const usarEjemplo = (src: string) => {
    if (petPhotoFile && !confirm('Si elegís una foto de ejemplo se descarta la que subiste. ¿Seguro?')) return;
    setFotoError('');
    setPet((p) => ({ ...p, foto: src }));
    setPetPhotoFile(null);
  };
  // paso 2
  const [socio, setSocio] = useState({ nombre: '', dni: '', fnac: '', domicilio: '', localidad: '', provincia: '', tel: '', email: '', password: '' });
  // paso 3
  const [plan, setPlan] = useState<string | null>(null);
  const [odonto, setOdonto] = useState(false);
  // paso 4
  const [health, setHealth] = useState<Record<number, string>>({});
  const [sanit, setSanit] = useState<Record<number, string>>({});
  const [firma, setFirma] = useState('');
  const [acepta, setAcepta] = useState(false);
  // paso 5
  const [payMethod, setPayMethod] = useState<'tarjeta' | 'cbu'>('tarjeta');
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [acceptaCuota, setAcceptaCuota] = useState(false);

  if (!open) return null;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(socio.email);
  const dniOk = /^\d{7,8}$/.test(socio.dni.replace(/\D/g, ''));
  const telOk = socio.tel.replace(/\D/g, '').length === 10;
  const fnacOk = /^\d{2}\/\d{2}\/\d{4}$/.test(socio.fnac);
  const passwordOk = socio.password.length >= 6;
  // Un socio se dio de alta con el mail en el campo del nombre (probablemente
  // por el autocompletado) y el saludo de su cuenta quedó mostrando el mail.
  const nombreOk = socio.nombre.trim().length > 1 && !socio.nombre.includes('@');
  const step1Ok = pet.nombre.trim().length > 0;
  const step2Ok = nombreOk && dniOk && fnacOk && socio.domicilio.trim() && socio.localidad.trim() && socio.provincia && telOk && emailOk && passwordOk;
  const step3Ok = !!plan;
  const step4Ok = Object.keys(health).length === HEALTH_Q.length && Object.keys(sanit).length === SANITARIO_Q.length && firma.trim().length > 2 && acepta;
  const step5Ok = cardNum.replace(/\D/g, '').length >= 13 && cardExp.trim().length >= 4 && cardCvv.trim().length >= 3 && acceptaCuota;

  const canNext = step === 1 ? step1Ok : step === 2 ? step2Ok : step === 3 ? step3Ok : step === 4 ? step4Ok : step === 5 ? step5Ok : true;
  const next = () => { if (step < 5) setStep(step + 1); else if (step === 5 && canNext) setConfirmOpen(true); };
  const back = () => { if (step > 1) setStep(step - 1); else onClose(); };

  const selectedPlan = plans.find((p) => p.name === plan);
  const planPrice = (selectedPlan?.basePrice ?? 0) + (odonto ? 12000 : 0);

  const confirmAlta = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const form = new FormData();
      form.set('payload', JSON.stringify({ socio, pet, plan }));
      if (petPhotoFile) form.set('photo', petPhotoFile);
      const res = await fetch('/api/onboarding', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo completar el alta.');
      await supabase.auth.signInWithPassword({ email: socio.email, password: socio.password });
      setMemberNo(json.memberNo);
      setAvisoFoto(json.photoError ?? null);
      setConfirmOpen(false);
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'No se pudo completar el alta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: '#f5f4f8', overflowY: 'auto' }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'rgba(245,244,248,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #e6e3f0' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {!done && <button onClick={back} style={{ background: '#fff', border: '1px solid #e6e3f0', color: '#5D5491', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, padding: '9px 14px', borderRadius: 11, cursor: 'pointer', boxShadow: '0 4px 14px rgba(93,84,145,0.1)', whiteSpace: 'nowrap' }}>← {step === 1 ? 'Volver a la landing' : 'Atrás'}</button>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#8781a0', fontWeight: 600, marginBottom: 6 }}>{done ? 'Completado' : `Paso ${step} de 5`}</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} style={{ flex: 1, height: 5, borderRadius: 100, background: done || n <= step ? '#5D5491' : '#e6e3f0', transition: '0.3s' }} />
              ))}
            </div>
          </div>
          <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, color: '#5D5491' }}>Kumo</span>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 120px' }}>
        {/* PASO 1 */}
        {!done && step === 1 && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>Tu mascota</h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 22px' }}>Contanos sobre quién vas a cuidar.</p>
            {/* Foto: la propia o una de ejemplo. Antes elegir un ejemplo
                descartaba la foto subida en silencio y el socio se enteraba
                recién al ver su carnet sin su mascota. Ahora siempre se dice
                cuál de las dos está en uso, y se avisa al reemplazarla. */}
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Foto</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <label style={{ width: 84, height: 84, borderRadius: 16, border: petPhotoFile ? '2.5px solid #5D5491' : '1.5px dashed #c9c3e3', background: '#faf9fd', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flex: '0 0 auto' }}>
                  {pet.foto
                    ? <img src={pet.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8781a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="15" rx="2.5" /><circle cx="12" cy="12" r="3.2" /><path d="M8 5l1.5-2h5L16 5" /></svg><span style={{ fontSize: 10.5, color: '#8781a0', marginTop: 6 }}>Subí una foto</span></>}
                  <input type="file" accept={FOTO_TIPOS.join(',')} style={{ display: 'none' }} onChange={(e) => elegirFoto(e.target.files?.[0])} />
                </label>
                {['/img/happy-dog.webp', '/img/plan-cat.webp', '/img/plan-dalmata-cut.webp'].map((src) => (
                  <button key={src} type="button" onClick={() => usarEjemplo(src)} style={{ width: 62, height: 62, borderRadius: 14, overflow: 'hidden', border: !petPhotoFile && pet.foto === src ? '2.5px solid #5D5491' : '2px solid #e6e3f0', padding: 0, cursor: 'pointer', background: '#fff', flex: '0 0 auto' }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
              {fotoError
                ? <p style={{ fontSize: 12.5, color: '#b0483f', fontWeight: 600, margin: '8px 0 0' }}>{fotoError}</p>
                : petPhotoFile
                ? <p style={{ fontSize: 12.5, color: '#2f8f5b', fontWeight: 600, margin: '8px 0 0' }}>Vas a usar tu foto: {petPhotoFile.name}</p>
                : pet.foto
                ? <p style={{ fontSize: 12.5, color: '#8781a0', margin: '8px 0 0' }}>Estás usando una foto de ejemplo. Tocá el recuadro para subir la de tu mascota.</p>
                : <p style={{ fontSize: 12.5, color: '#8781a0', margin: '8px 0 0' }}>Subí una foto de tu mascota, o elegí una de ejemplo por ahora.</p>}
            </div>
            {field('Nombre', <input value={pet.nombre} onChange={(e) => setPet({ ...pet, nombre: e.target.value })} placeholder="Ej. Manchas" style={input} />)}
            {field('Especie', <Segmented options={['Perro', 'Gato', 'Otro']} value={pet.especie} onChange={(v) => setPet({ ...pet, especie: v })} />)}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>{field('Sexo', <Segmented options={['Macho', 'Hembra']} value={pet.sexo} onChange={(v) => setPet({ ...pet, sexo: v })} />)}</div>
              <div style={{ flex: 1 }}>{field('Castrado/a', <Segmented options={['Sí', 'No']} value={pet.castrado} onChange={(v) => setPet({ ...pet, castrado: v })} />)}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 2 }}>{field('Raza', <input value={pet.raza} onChange={(e) => setPet({ ...pet, raza: e.target.value })} placeholder="Ej. Mestizo" style={input} />)}</div>
              <div style={{ flex: 1 }}>{field('Edad aprox.', <input value={pet.edad} onChange={(e) => setPet({ ...pet, edad: e.target.value })} placeholder="4 años" style={input} />)}</div>
              <div style={{ flex: 1 }}>{field('Peso', <input value={pet.peso} onChange={(e) => setPet({ ...pet, peso: e.target.value })} placeholder="12 kg" style={input} />)}</div>
            </div>
            {field(<>N° de microchip <span style={{ color: '#a29dba', fontWeight: 500 }}>(si tiene)</span></>, <input value={pet.microchip} onChange={(e) => setPet({ ...pet, microchip: e.target.value })} placeholder="982 000 000 000" style={input} />)}
            {field('Veterinario habitual / Clínica', <input value={pet.vet} onChange={(e) => setPet({ ...pet, vet: e.target.value })} placeholder="Ej. Veterinaria Norte" style={input} />)}
          </div>
        )}

        {/* PASO 2 */}
        {!done && step === 2 && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>Tus datos</h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 22px' }}>Datos del socio titular.</p>
            {field('Apellido y nombre', <input autoComplete="name" value={socio.nombre} onChange={(e) => setSocio({ ...socio, nombre: e.target.value })} placeholder="Ej. Valentina Ruiz" style={input} />)}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>{field('DNI', <input autoComplete="off" value={socio.dni} onChange={(e) => setSocio({ ...socio, dni: formatDni(e.target.value) })} placeholder="00.000.000" style={{ ...input, borderColor: socio.dni && !dniOk ? '#c14d7a' : '#e6e3f0' }} />)}</div>
              <div style={{ flex: 1 }}>{field('Fecha de nac.', <input autoComplete="bday" value={socio.fnac} onChange={(e) => setSocio({ ...socio, fnac: e.target.value })} placeholder="dd/mm/aaaa" style={{ ...input, borderColor: socio.fnac && !fnacOk ? '#c14d7a' : '#e6e3f0' }} />)}</div>
            </div>
            {field('Domicilio', <input autoComplete="street-address" value={socio.domicilio} onChange={(e) => setSocio({ ...socio, domicilio: e.target.value })} placeholder="Calle y número" style={input} />)}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>{field('Localidad', <input autoComplete="address-level2" value={socio.localidad} onChange={(e) => setSocio({ ...socio, localidad: e.target.value })} placeholder="Ej. Palermo" style={input} />)}</div>
              <div style={{ flex: 1 }}>{field('Provincia', <select value={socio.provincia} onChange={(e) => setSocio({ ...socio, provincia: e.target.value })} style={input}><option value="">Elegí una provincia</option>{PROVINCIAS.map((p) => <option key={p}>{p}</option>)}</select>)}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>{field('Teléfono', <input autoComplete="tel" value={socio.tel} onChange={(e) => setSocio({ ...socio, tel: formatTel(e.target.value) })} placeholder="11 5555 2024" style={{ ...input, borderColor: socio.tel && !telOk ? '#c14d7a' : '#e6e3f0' }} />)}</div>
              <div style={{ flex: 1 }}>{field('Email', <input type="email" autoComplete="email" value={socio.email} onChange={(e) => setSocio({ ...socio, email: e.target.value })} placeholder="tu@email.com" style={{ ...input, borderColor: socio.email && !emailOk ? '#c14d7a' : '#e6e3f0' }} />)}</div>
            </div>
            {field('Contraseña', <input type="password" autoComplete="new-password" value={socio.password} onChange={(e) => setSocio({ ...socio, password: e.target.value })} placeholder="Mínimo 6 caracteres" style={{ ...input, borderColor: socio.password && !passwordOk ? '#c14d7a' : '#e6e3f0' }} />)}
            <p style={{ fontSize: 12.5, color: '#a29dba', margin: '-8px 0 0' }}>La vas a usar para entrar a la app cuando quieras.</p>
          </div>
        )}

        {/* PASO 3 */}
        {!done && step === 3 && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>Elegí tu plan</h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 22px' }}>Podés cambiarlo o cancelarlo cuando quieras.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {plans.map((p) => {
                const on = plan === p.name;
                const feat = !!p.featured;
                const meta = PLAN_META[p.name];
                return (
                  <div key={p.id} onClick={() => setPlan(p.name)} style={{ position: 'relative', border: '2px solid ' + (on ? '#5D5491' : '#e6e3f0'), background: on ? '#faf9fd' : '#fff', borderRadius: 18, padding: 20, cursor: 'pointer', transition: '0.15s' }}>
                    {feat && <span style={{ position: 'absolute', top: -11, left: 20, background: '#E1FB62', color: '#211E33', fontWeight: 700, fontSize: 11, padding: '4px 12px', borderRadius: 100 }}>MÁS ELEGIDO</span>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18, color: '#5D5491' }}>{p.name}</span>
                      <Radio on={on} />
                    </div>
                    <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginTop: 6 }}>{money(p.basePrice)}<span style={{ fontSize: 13, color: '#8781a0', fontWeight: 500 }}>/mes</span></div>
                    <div style={{ fontSize: 13.5, color: '#5b5670', margin: '4px 0 12px' }}>{meta?.desc}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                      {meta?.perks.map((perk) => (
                        <div key={perk} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: '#4a4560' }}>
                          <span style={{ color: '#5D5491', fontWeight: 700, flex: '0 0 auto' }}>✓</span><span>{perk}</span>
                        </div>
                      ))}
                    </div>
                    <label onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#5b5670', cursor: 'pointer', background: '#f7f6fa', border: '1px solid #eeecf5', borderRadius: 11, padding: '10px 12px' }}>
                      <input type="checkbox" checked={odonto} onChange={(e) => setOdonto(e.target.checked)} style={{ width: 17, height: 17, accentColor: '#5D5491' }} />
                      ¿Sumar cobertura odontológica? <strong>+$12.000/mes</strong>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PASO 4 */}
        {!done && step === 4 && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>Declaración jurada</h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 14px' }}>Contanos cómo está la salud de {pet.nombre || 'tu mascota'}. Con esta info definimos qué reintegros aplican desde el día uno.</p>
            <div style={{ background: '#f0edf9', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#5b5670', marginBottom: 18 }}>Tus respuestas son confidenciales y solo se usan para validar reintegros. Declarar con honestidad protege tu membresía.</div>
            {HEALTH_Q.map((q, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, color: '#211E33', marginBottom: 7 }}>{q}</div>
                <Segmented options={['Sí', 'No']} value={health[i] ?? ''} onChange={(v) => setHealth({ ...health, [i]: v })} />
              </div>
            ))}
            <div style={{ fontWeight: 700, fontSize: 15, margin: '22px 0 12px' }}>Plan sanitario</div>
            {SANITARIO_Q.map((q, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, color: '#211E33', marginBottom: 7 }}>{q}</div>
                <Segmented options={['Sí', 'No']} value={sanit[i] ?? ''} onChange={(v) => setSanit({ ...sanit, [i]: v })} />
              </div>
            ))}
            <div style={{ fontWeight: 700, fontSize: 15, margin: '22px 0 8px' }}>Firma digital</div>
            <p style={{ fontSize: 13, color: '#8781a0', margin: '0 0 8px' }}>Escribí tu nombre completo tal cual figura en tu DNI. Equivale a tu firma según la Ley 25.506.</p>
            <input value={firma} onChange={(e) => setFirma(e.target.value)} placeholder="Tu nombre y apellido" style={{ ...input, fontFamily: '"Baloo 2"', fontSize: 18, textAlign: 'center', fontWeight: 700 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#8781a0' }}>Fecha: {todayShort()}</span>
              <span style={{ fontSize: 12, color: firma.trim().length > 2 ? '#2f8f5b' : '#8781a0', fontWeight: 600 }}>{firma.trim().length > 2 ? '✓ Firma registrada' : 'Pendiente de firma'}</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, fontSize: 13, color: '#5b5670', cursor: 'pointer' }}>
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ width: 17, height: 17, accentColor: '#5D5491', flex: '0 0 auto', marginTop: 2 }} />
              Declaro bajo juramento que la información es verdadera y completa, y me comprometo a mantener el plan sanitario al día y a notificar cualquier diagnóstico relevante dentro de los 30 días.
            </label>
          </div>
        )}

        {/* PASO 5 */}
        {!done && step === 5 && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>Medio de pago</h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 22px' }}>Tu cuota incluye IVA. Sin permanencia.</p>
            <div style={{ background: '#5D5491', borderRadius: 16, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ color: '#c9c3e3', fontSize: 13 }}>Plan {plan ?? '—'}</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Cuota mensual</div>
              </div>
              <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, color: '#E1FB62' }}>{money(planPrice)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
              {PAY_METHODS.map((m) => {
                const on = payMethod === m.key;
                return (
                  <button key={m.key} type="button" onClick={() => setPayMethod(m.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', border: '1.5px solid ' + (on ? '#5D5491' : '#e6e3f0'), background: on ? '#faf9fd' : '#fff', borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}>
                    <Ic d={m.icon} size={21} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: '#211E33' }}>{m.label}</span>
                    <Radio on={on} />
                  </button>
                );
              })}
            </div>
            {field('', <input value={cardNum} onChange={(e) => setCardNum(e.target.value)} placeholder="Número de tarjeta" style={input} />)}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>{field('', <input value={cardExp} onChange={(e) => setCardExp(e.target.value)} placeholder="MM/AA" style={input} />)}</div>
              <div style={{ flex: 1 }}>{field('', <input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="CVV" style={input} />)}</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 4, fontSize: 13, color: '#5b5670', cursor: 'pointer' }}>
              <input type="checkbox" checked={acceptaCuota} onChange={(e) => setAcceptaCuota(e.target.checked)} style={{ width: 17, height: 17, accentColor: '#5D5491', flex: '0 0 auto', marginTop: 2 }} />
              Acepto que la cuota se actualiza cada 3 meses según IPC y los plazos de carencia (60/90/180 días). Tengo 10 días de arrepentimiento.
            </label>
          </div>
        )}

        {/* PANTALLA FINAL: ¡Bienvenido al club! */}
        {done && (
          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: '#E1FB62', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
            </div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 27, margin: '0 0 8px' }}>¡Bienvenido al club!</h2>
            <p style={{ color: '#5b5670', fontSize: 15, lineHeight: 1.55, margin: '0 auto 18px', maxWidth: 420 }}>Ya generamos el carnet digital de <strong>{pet.nombre || 'tu mascota'}</strong>. Tu N° de socio es <strong style={{ color: '#5D5491' }}>#{memberNo}</strong>.</p>
            {avisoFoto && (
              <div style={{ background: '#fbf3e2', border: '1px solid #f0e0be', color: '#92690a', fontSize: 13.5, lineHeight: 1.5, borderRadius: 12, padding: '11px 14px', margin: '0 auto 22px', maxWidth: 420, textAlign: 'left' }}>
                {avisoFoto}
              </div>
            )}
            <div style={{ background: '#5D5491', borderRadius: 20, padding: 22, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ color: '#c9c3e3', fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Carnet digital</span>
                <span style={{ background: '#E1FB62', color: '#211E33', fontWeight: 800, fontSize: 11, padding: '4px 12px', borderRadius: 100 }}>ACTIVO</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 58, height: 58, borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.15)', flex: '0 0 auto' }}>
                  {pet.foto && <img src={pet.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, color: '#fff' }}>{pet.nombre || '—'}</div>
                  <div style={{ color: '#c9c3e3', fontSize: 13 }}>{pet.especie}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}><div style={{ fontSize: 10, color: '#c9c3e3' }}>PLAN</div><div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{plan}</div></div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}><div style={{ fontSize: 10, color: '#c9c3e3' }}>N° SOCIO</div><div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>#{memberNo}</div></div>
              </div>
              <div>
                {[['Especie', pet.especie], ['Raza', pet.raza || '—'], ['Edad', pet.edad || '—'], ['Peso', pet.peso || '—'], ['Microchip', pet.microchip || 'Sin chip']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: 13 }}>
                    <span style={{ color: '#c9c3e3' }}>{k}</span><span style={{ color: '#fff', fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <a href={WEBAPP} style={{ display: 'block', marginTop: 26, textAlign: 'center', background: '#5D5491', color: '#fff', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: 15, borderRadius: 14, boxShadow: '0 8px 20px rgba(93,84,145,0.28)', textDecoration: 'none' }}>Ir a la app →</a>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {!done && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, #f5f4f8 60%, transparent)', padding: '18px 20px 24px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <button onClick={next} disabled={!canNext} style={{ width: '100%', background: canNext ? '#5D5491' : '#c9c3e3', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: 16, borderRadius: 14, boxShadow: canNext ? '0 8px 20px rgba(93,84,145,0.28)' : 'none', cursor: canNext ? 'pointer' : 'not-allowed', transition: '0.15s' }}>
              {step === 4 ? 'Firmar y continuar' : step === 5 ? 'Confirmar y unirme' : 'Continuar'}
            </button>
            {!canNext && <div style={{ textAlign: 'center', fontSize: 12.5, color: '#8781a0', marginTop: 8 }}>Completá los datos para continuar.</div>}
          </div>
        </div>
      )}

      {/* Sheet: Confirmá tu alta */}
      {confirmOpen && (
        <div onClick={() => setConfirmOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(33,30,51,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: '24px 24px 0 0', padding: '14px 24px 28px', boxShadow: '0 -20px 50px rgba(33,30,51,0.25)' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e6e3f0', margin: '0 auto 20px' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: '#E1FB62', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" /><path d="M9.5 12l2 2 3.5-3.5" /></svg>
              </div>
              <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, margin: '0 0 8px' }}>Confirmá tu alta</h2>
              <p style={{ color: '#8781a0', fontSize: 14, lineHeight: 1.5, margin: '0 auto 20px', maxWidth: 420 }}>Revisá los datos antes de confirmar. Vas a poder cambiar de plan o darte de baja cuando quieras.</p>
            </div>
            <div style={{ border: '1px solid #eeecf5', borderRadius: 14, padding: '4px 16px', marginBottom: 18 }}>
              {[['Socio', socio.nombre || '—'], ['Mascota', pet.nombre || '—'], ['Plan', plan ?? '—'], ['Cuota mensual', money(planPrice)], ['Medio de pago', PAY_METHODS.find((m) => m.key === payMethod)?.label ?? '—'], ['Firma digital', firma || '—']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0eef7', fontSize: 14 }}>
                  <span style={{ color: '#8781a0' }}>{k}</span><span style={{ fontWeight: 700, color: '#211E33' }}>{v}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: '#a29dba', lineHeight: 1.5, margin: '0 0 18px' }}>Al confirmar aceptás el contrato de membresía y la declaración jurada firmada en el paso anterior. Tenés 10 días de arrepentimiento (Ley 24.240).</p>
            {submitError && <div style={{ background: '#fbe8ef', color: '#c14d7a', fontSize: 13, borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>{submitError}</div>}
            <button onClick={confirmAlta} disabled={submitting} style={{ width: '100%', background: '#5D5491', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: 15, borderRadius: 14, boxShadow: '0 8px 20px rgba(93,84,145,0.28)', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, marginBottom: 10 }}>{submitting ? 'Confirmando…' : 'Confirmar y unirme'}</button>
            <button onClick={() => setConfirmOpen(false)} disabled={submitting} style={{ width: '100%', background: 'none', border: 'none', color: '#8781a0', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, padding: 8, cursor: 'pointer' }}>Revisar mis datos</button>
          </div>
        </div>
      )}
    </div>
  );
}
