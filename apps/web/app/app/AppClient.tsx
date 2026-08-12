'use client';
import type { CSSProperties, FormEvent, ReactNode } from 'react';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  urls, FOTO_TIPOS, FOTO_MAX,
  buildNotifs, contarNoLeidas, notifTiempo, NOTIF_STYLE, type NotifInput, type NotifGroup,
  buildCalMes, buildPickerMes, calMesLabel, calDiaLabel, fmtFechaCorta, hoyISO, CAL_TONE, CAL_DIAS, VACUNA_KINDS, KIND_ICON,
  type CalCell, type VaccineKind,
} from '@kumo/shared';
import { supabase } from '@/lib/supabase-browser';

/*
 * Webapp del socio — vista "App compu" del prototipo (reference/kumo-prototype.html).
 * Shell con sidebar + navegación entre pantallas. Reproducción 1:1, dinámica.
 * Pantallas listas: Inicio, Carnet. El resto se va completando.
 */

/** Landing: login, planes y destino al cerrar sesión. */
const LANDING = urls.landing;

/* ── Iconos ────────────────────────────────────────────────────── */
const ic = (inner: ReactNode, filled = false, size = 19) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>{inner}</svg>
);
const paw = <><circle cx="5.5" cy="10" r="1.7" /><circle cx="9.7" cy="6.4" r="1.8" /><circle cx="14.3" cy="6.4" r="1.8" /><circle cx="18.5" cy="10" r="1.7" /><path d="M8 14.2c-1.3 1-1.9 2.4-1.5 3.8.3 1.3 1.5 2 2.9 1.7 1-.2 1.6-.6 2.6-.6s1.6.4 2.6.6c1.4.3 2.6-.4 2.9-1.7.4-1.4-.2-2.8-1.5-3.8-1.1-.9-2.1-1.5-4-1.5s-2.9.6-4 1.5z" /></>;
const house = <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></>;
const plusCircle = <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>;
const wallet = <><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2" /><rect x="2" y="7" width="20" height="12" rx="2" /><path d="M22 11h-4a2 2 0 0 0 0 4h4" /></>;
const idCard = <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.1" /><path d="M6.2 16c.5-1.5 1.9-2.4 3.3-2.4s2.8.9 3.3 2.4" /><line x1="14" y1="9" x2="17.5" y2="9" /><line x1="14" y1="13" x2="16.5" y2="13" /></>;
const chat = <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
const person = <><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>;
const shieldPath = <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />;
const pillPath = <><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z" /><line x1="8.5" y1="8.5" x2="15.5" y2="15.5" /></>;
const bellPath = <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>;

/** `notif` no va en el sidebar: se llega por la campanita, como en el prototipo. */
type Screen = 'inicio' | 'carnet' | 'servicios' | 'reintegros' | 'beneficios' | 'foros' | 'negocio' | 'perfil' | 'notif';

const NAV: { key: Screen; label: string; icon: ReactNode }[] = [
  { key: 'inicio', label: 'Inicio', icon: ic(house) },
  { key: 'carnet', label: 'Carnet', icon: ic(plusCircle) },
  { key: 'servicios', label: 'Servicios', icon: ic(paw, true) },
  { key: 'reintegros', label: 'Reintegros', icon: ic(wallet) },
  { key: 'beneficios', label: 'Beneficios', icon: ic(idCard) },
  { key: 'foros', label: 'Foros', icon: ic(chat) },
  { key: 'negocio', label: 'Mi negocio', icon: ic(house) },
  { key: 'perfil', label: 'Mi perfil', icon: ic(person) },
];

/* ── Datos (mock del prototipo) ────────────────────────────────── */
/** `appliedOn`/`dueOn` van crudas además de formateadas en `sub`: el calendario las necesita para ubicar el día. */
export type Vac = { id: string; name: string; kind: VaccineKind; sub: string; status: string; tone: 'green' | 'lime' | 'amber'; appliedOn: string | null; dueOn: string | null; reminder?: string; mark?: boolean };
export type Pet = { id: string; name: string; plan: string; socio: string; photo: string; breed: string; microchip: string; castrado: string; odonto: string; vaccines: Vac[] };
export type EmergencyContact = { id: string; name: string; phone: string; type: string; address: string; hours: string };
export type ProviderVM = { id: string; name: string; category: string; zone: string; address: string; phone: string; instagram: string | null; website: string | null; about: string; rating: number; reviews: number; price: number; priceUnit: string; photoUrl: string; km: number; badge?: string };
export type BenefitVM = { id: string; name: string; category: string; discount: string; icon: 'cross' | 'store' | 'tag' | 'droplet' };
/** El negocio propio del socio: puede estar pendiente de validación o rechazado, así que no sale del listado de prestadores verificados. */
export type MiNegocio = { id: string; name: string; category: string; zone: string; phone: string | null; about: string; status: string; rating: number; reviews: number };
export type ForumPost = { id: string; cat: string; trend: boolean; author: string; meta: string; title: string; body: string; replies: number; likes: number; answers: { author: string; when: string; text: string; likes: number; best: boolean }[] };

/** Datos del socio logueado, resueltos en el Server Component (app/page.tsx). */
export type Profile = { id: string; firstName: string; fullName: string; memberNo: number; planName: string; planPrice: number; email: string; phone: string | null; address: string | null; dni: string | null };

/** Las mismas cinco promos que la app móvil, con sus colores: eran tres y con
 *  otras fotos, así que las dos superficies mostraban cosas distintas. */
const promos = [
  { title: 'Buscá tu paseador', sub: 'Cerca tuyo, verificados', bg: '#5D5491', fg: '#fff', subFg: '#d8d3ec', img: '/img/dog-walk.webp' },
  { title: 'Baño y peluquería', sub: 'A domicilio, con descuento', bg: '#E1FB62', fg: '#211E33', subFg: '#3d3a52', img: '/img/dog-bath-happy.webp' },
  { title: 'Guardería para el finde', sub: 'Lugares de confianza', bg: '#ECE7F7', fg: '#211E33', subFg: '#6b6485', img: '/img/cat-guarderia.webp' },
  { title: 'Adiestrá con expertos', sub: 'Clases y resultados', bg: '#E1FB62', fg: '#211E33', subFg: '#3d3a52', img: '/img/plan-dalmata-cut.webp' },
  { title: 'Encontrá un cuidador', sub: 'Alguien de confianza', bg: '#5D5491', fg: '#fff', subFg: '#d8d3ec', img: '/img/woman-cat.webp' },
];

/* ── Selector de mascota (chips) ───────────────────────────────── */
function PetChips({ idx, setIdx, pets }: { idx: number; setIdx: (i: number) => void; pets: Pet[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      {pets.map((p, i) => (
        <button key={p.name} onClick={() => setIdx(i)} style={{ fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 13, padding: '9px 18px', borderRadius: 100, border: 'none', cursor: 'pointer', background: i === idx ? 'rgb(225,251,98)' : 'rgb(240,237,249)', color: i === idx ? 'rgb(33,30,51)' : 'rgb(135,129,160)' }}>{p.name}</button>
      ))}
    </div>
  );
}

/* ── Pantalla: Inicio ──────────────────────────────────────────── */
function Inicio({ go, petIdx, setPetIdx, pets, profile, noLeidas }: { go: (s: Screen) => void; petIdx: number; setPetIdx: (i: number) => void; pets: Pet[]; profile: Profile; noLeidas: number }) {
  const [promoIdx, setPromoIdx] = useState(0);
  const pet = pets[petIdx] ?? pets[0];
  const promo = promos[promoIdx] ?? promos[0]!;
  useEffect(() => {
    const t = setInterval(() => setPromoIdx((i) => (i + 1) % promos.length), 4000);
    return () => clearInterval(t);
  }, []);

  const quick: { label: string; icon: ReactNode; to: Screen }[] = [
    { label: 'Carnet', icon: ic(idCard, false, 22), to: 'carnet' },
    { label: 'Foros', icon: ic(chat, false, 22), to: 'foros' },
    { label: 'Reintegro', icon: ic(wallet, false, 22), to: 'reintegros' },
    { label: 'Servicios', icon: ic(paw, true, 22), to: 'servicios' },
  ];

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, position: 'relative' }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgb(162,157,186)' }}>Hola de nuevo</div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 23 }}>{profile.firstName}</div>
        </div>
        <button onClick={() => go('notif')} style={{ width: 44, height: 44, borderRadius: 14, background: 'rgb(240,237,249)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }} aria-label={noLeidas > 0 ? `Notificaciones (${noLeidas} sin leer)` : 'Notificaciones'}>
          <span style={{ color: '#5D5491' }}>{ic(bellPath, false, 21)}</span>
          {noLeidas > 0 && <span style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: '50%', background: 'rgb(225,251,98)', border: '2px solid rgb(240,237,249)' }} />}
        </button>
      </div>

      <PetChips idx={petIdx} setIdx={setPetIdx} pets={pets} />

      {pet ? (
        <div style={{ background: 'linear-gradient(135deg, rgb(93,84,145), rgb(70,63,112))', borderRadius: 24, padding: 20, marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', animation: 'kshine 4.5s ease-in-out infinite', pointerEvents: 'none', zIndex: 2 }} />
          <div style={{ position: 'absolute', right: -14, top: -14, opacity: 0.1 }}>
            <svg width="104" height="104" viewBox="0 0 24 24" fill="#fff" style={{ display: 'block' }}>{paw}</svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, overflow: 'hidden', flex: '0 0 auto', background: `url(${pet.photo}) center/cover, rgb(230,227,240)` }} />
            <div style={{ flex: '1 1 0%' }}>
              <div style={{ color: '#fff', fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 19 }}>{pet.name}</div>
              <div style={{ color: 'rgb(201,195,227)', fontSize: 12 }}>Plan {pet.plan} · Socio {pet.socio}</div>
            </div>
            <span style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontWeight: 700, fontSize: 10, padding: '4px 9px', borderRadius: 100 }}>ACTIVO</span>
          </div>
        </div>
      ) : (
        <div onClick={() => go('perfil')} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 24, padding: 24, marginBottom: 18, textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: 'rgb(240,237,249)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#5D5491" style={{ display: 'block' }}>{paw}</svg>
          </div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 17 }}>Todavía no cargaste mascotas</div>
          <div style={{ fontSize: 13, color: 'rgb(91,86,112)', marginTop: 5 }}>Agregá a tu peludo desde tu perfil para tener su carnet digital.</div>
        </div>
      )}

      <div className="wa-quick" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
        {quick.map((q) => (
          <button key={q.label} onClick={() => go(q.to)} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '14px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#5D5491' }}>{q.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgb(91,86,112)' }}>{q.label}</span>
          </button>
        ))}
      </div>

      {/* El banner, igual que en reference/kumo-prototype.html: la foto va en
          82x82 con `contain` —entera, no recortada— apoyada abajo a la derecha
          y con sombra. Con `cover` se veía cortada y desproporcionada. */}
      <div onClick={() => go('servicios')} style={{ position: 'relative', overflow: 'hidden', background: promo.bg, borderRadius: 18, padding: '16px 18px', display: 'flex', alignItems: 'center', marginBottom: 22, cursor: 'pointer', minHeight: 78 }}>
        <div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }} />
        <div style={{ flex: '1 1 0%', position: 'relative', zIndex: 1, paddingRight: 96 }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 15, color: promo.fg, lineHeight: 1.15 }}>{promo.title}</div>
          <div style={{ fontSize: 12, color: promo.subFg, marginTop: 1 }}>{promo.sub}</div>
        </div>
        <div key={promo.img} style={{ position: 'absolute', right: 8, bottom: 0, height: 82, width: 82, zIndex: 1, pointerEvents: 'none', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))', backgroundImage: `url(${promo.img})`, backgroundSize: 'contain', backgroundPosition: 'right bottom', backgroundRepeat: 'no-repeat', animation: 'kfade 0.5s ease' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        <div className="wa-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={() => go('carnet')} className="wa-card" style={{ textAlign: 'left', background: 'rgb(247,246,250)', borderRadius: 12, padding: 14, border: '1px solid rgb(238,236,245)', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120 }}>
            <div style={{ width: 32, height: 32, background: 'rgb(225,251,98)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'rgb(33,30,51)' }}>Próximas vacunas</div>
              <div style={{ fontSize: 11, color: 'rgb(93,84,145)', fontWeight: 600, marginTop: 6 }}>Ver más →</div>
            </div>
          </button>
          <button onClick={() => go('beneficios')} style={{ textAlign: 'left', borderRadius: 12, padding: 14, color: '#fff', cursor: 'pointer', border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 120, background: 'linear-gradient(rgba(33,30,51,0) 30%, rgba(33,30,51,0.75) 100%), url(/img/dog-bath-happy.webp) center/cover', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Beneficios</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>Descuentos exclusivos</div>
          </button>
        </div>
        <div className="wa-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={() => go('servicios')} style={{ textAlign: 'left', borderRadius: 12, padding: 14, color: '#fff', cursor: 'pointer', border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 120, background: 'linear-gradient(rgba(33,30,51,0) 30%, rgba(33,30,51,0.75) 100%), url(/img/prestador-caregiver.webp) center top/cover', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Servicios</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>Encontrá prestadores cerca tuyo</div>
          </button>
          <button onClick={() => go('negocio')} className="wa-card" style={{ textAlign: 'left', background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 12, padding: 14, color: 'rgb(33,30,51)', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120 }}>
            <div style={{ width: 32, height: 32, background: 'rgb(225,251,98)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Mi negocio</div>
              <div style={{ fontSize: 11, color: 'rgb(135,129,160)' }}>Publicá y gestioná tu servicio</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Pantalla: Carnet ──────────────────────────────────────────── */
const toneCfg = {
  green: { card: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', iconBg: 'rgb(226,245,234)', iconStroke: '#2f8f5b', status: 'rgb(47,143,91)' },
  lime: { card: 'rgb(238,247,214)', border: '1.5px solid rgb(225,251,98)', iconBg: 'rgb(223,240,168)', iconStroke: '#6f9a1f', status: 'rgb(111,154,31)' },
  amber: { card: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', iconBg: 'rgb(251,243,226)', iconStroke: '#b8860b', status: 'rgb(184,134,11)' },
};

function Carnet({ petIdx, setPetIdx, pets, profile, contacts }: { petIdx: number; setPetIdx: (i: number) => void; pets: Pet[]; profile: Profile; contacts: EmergencyContact[] }) {
  const router = useRouter();
  const pet = pets[petIdx] ?? pets[0];
  const [showCal, setShowCal] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddC, setShowAddC] = useState(false);
  const [cn, setCn] = useState('');
  const [cp, setCp] = useState('');
  const [busy, setBusy] = useState(false);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [fotoError, setFotoError] = useState('');
  const allVacs = pet?.vaccines ?? [];

  /** Cambiar la foto de la mascota. Antes no se podía desde ninguna pantalla:
   *  si en el alta salía mal, había que tocar la base a mano. */
  const cambiarFoto = async (f?: File) => {
    if (!f || !pet) return;
    if (!FOTO_TIPOS.includes(f.type as (typeof FOTO_TIPOS)[number])) {
      setFotoError(`Ese formato no lo podemos usar (${f.type || 'desconocido'}). Probá con JPG, PNG o WEBP.`);
      return;
    }
    if (f.size > FOTO_MAX) {
      setFotoError(`La foto pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es 5 MB.`);
      return;
    }
    setFotoBusy(true);
    setFotoError('');
    const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg';
    // Carpeta por socio: la RLS del bucket exige que la primera carpeta sea su id.
    const path = `${profile.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('pet-photos').upload(path, f, { contentType: f.type });
    if (upErr) {
      setFotoError('No pudimos subir la foto. Probá de nuevo.');
      setFotoBusy(false);
      return;
    }
    const url = supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl;
    const { error: dbErr } = await supabase.from('pets').update({ photo_url: url }).eq('id', pet.id);
    if (dbErr) {
      // No dejamos la imagen huérfana si no se pudo asociar a la mascota.
      await supabase.storage.from('pet-photos').remove([path]);
      setFotoError('Subimos la foto pero no pudimos guardarla. Probá de nuevo.');
      setFotoBusy(false);
      return;
    }
    router.refresh();
    setFotoBusy(false);
  };

  const markApplied = async (vacId: string) => {
    setBusy(true);
    // `due_on` se conserva: deja el registro de cuándo tocaba. Nada lo muestra
    // una vez aplicada, pero borrarlo perdía el dato sin ganar nada.
    await supabase.from('vaccinations').update({ status: 'aplicada', applied_on: hoyISO() }).eq('id', vacId);
    router.refresh();
    setBusy(false);
  };
  const addVac = async ({ kind, name, aplicada, fecha }: { kind: VaccineKind; name: string; aplicada: boolean; fecha: string | null }) => {
    if (!pet) return;
    setBusy(true);
    await supabase.from('vaccinations').insert({
      pet_id: pet.id, name, kind,
      status: aplicada ? 'aplicada' : 'pendiente',
      applied_on: aplicada ? fecha : null,
      due_on: aplicada ? null : fecha,
    });
    setShowAdd(false);
    router.refresh();
    setBusy(false);
  };
  const addContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!cn.trim()) return;
    setBusy(true);
    await supabase.from('emergency_contacts').insert({ owner_id: profile.id, name: cn, type: 'Veterinaria', phone: cp || null });
    setCn(''); setCp(''); setShowAddC(false);
    router.refresh();
    setBusy(false);
  };

  const vacIcon = (kind: VaccineKind, stroke: string) => {
    const t = KIND_ICON[kind];
    const inner = t === 'shield' ? shieldPath : t === 'pill' ? pillPath : plusCircle;
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>{inner}</svg>;
  };

  if (!pet) {
    return (
      <div style={{ padding: '8px 20px 24px' }}>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 16 }}>Carnet digital</div>
        <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 20, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 30, background: 'rgb(240,237,249)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#5D5491" style={{ display: 'block' }}>{paw}</svg>
          </div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18 }}>Todavía no cargaste mascotas</div>
          <div style={{ fontSize: 13.5, color: 'rgb(91,86,112)', marginTop: 6, lineHeight: 1.5 }}>Agregá a tu peludo desde tu perfil y acá vas a ver su carnet con vacunas y recordatorios.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 16 }}>Carnet digital</div>
      <PetChips idx={petIdx} setIdx={setPetIdx} pets={pets} />

      {/* Card mascota */}
      <div style={{ background: 'linear-gradient(135deg, rgb(93,84,145), rgb(70,63,112))', borderRadius: 24, padding: 22, marginBottom: 18, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', animation: 'kshine 4.5s ease-in-out infinite', pointerEvents: 'none', zIndex: 2 }} />
        <div style={{ position: 'absolute', right: -14, top: -14, opacity: 0.1 }}><svg width="104" height="104" viewBox="0 0 24 24" fill="#fff" style={{ display: 'block' }}>{paw}</svg></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, position: 'relative' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {/* La foto es el disparador para cambiarla: es donde el socio la busca. */}
            <label title="Cambiar la foto" style={{ width: 60, height: 60, borderRadius: 18, overflow: 'hidden', flex: '0 0 auto', background: `url(${pet.photo}) center/cover, rgb(230,227,240)`, cursor: fotoBusy ? 'default' : 'pointer', position: 'relative', display: 'block' }}>
              <span className="scpu" style={{ position: 'absolute', inset: 0, background: 'rgba(33,30,51,0.55)', color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: fotoBusy ? 1 : 0, transition: 'opacity 0.15s', lineHeight: 1.2 }}>
                {fotoBusy ? 'Subiendo…' : 'Cambiar foto'}
              </span>
              <input type="file" accept={FOTO_TIPOS.join(',')} disabled={fotoBusy} style={{ display: 'none' }} onChange={(e) => cambiarFoto(e.target.files?.[0])} />
            </label>
            <div>
              <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 22 }}>{pet.name}</div>
              <div style={{ color: 'rgb(201,195,227)', fontSize: 12 }}>{pet.breed}</div>
              {fotoError && <div style={{ color: 'rgb(225,251,98)', fontSize: 11.5, fontWeight: 600, marginTop: 4, maxWidth: 220, lineHeight: 1.35 }}>{fotoError}</div>}
            </div>
          </div>
          <span style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontWeight: 700, fontSize: 10, padding: '4px 9px', borderRadius: 100 }}>ACTIVO</span>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          {[['Microchip', pet.microchip], ['Castrado', pet.castrado], ['Odontológico', pet.odonto]].map(([k, v]) => (
            <div key={k} style={{ flex: '1 1 0%', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 11px' }}>
              <div style={{ fontSize: 10, color: 'rgb(201,195,227)' }}>{k}</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Salud y vacunas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Salud y vacunas</div>
        <button onClick={() => setShowCal(true)} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Ver calendario</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {allVacs.map((v) => {
          const done = v.tone === 'green';
          const tone = toneCfg[v.tone];
          return (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: tone.card, border: tone.border, borderRadius: 14, padding: '13px 14px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tone.iconBg }}>
                {vacIcon(v.kind, tone.iconStroke)}
              </div>
              <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{v.sub}</div>
                {!done && v.reminder && <div style={{ fontSize: 11, color: 'rgb(111,154,31)', fontWeight: 700, marginTop: 2 }}>{v.reminder}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ color: tone.status, fontWeight: 700, fontSize: 12 }}>{v.status}</span>
                {!done && v.mark && (
                  <button disabled={busy} onClick={() => markApplied(v.id)} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' }}>Marcar aplicada</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* En pantallas angostas los dos textos completos no entran en una fila, así
          que el de agregar baja a su propio renglón en vez de quedar apretado. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setShowCal(true)} style={{ flex: '0 0 auto', background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontWeight: 700, fontSize: 14, padding: '14px 16px', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></svg>Calendario
        </button>
        <button onClick={() => setShowAdd(true)} style={{ flex: '1 1 220px', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Agregar estudio o vacuna</button>
      </div>
      {showCal && <CalendarioSheet vacs={allVacs} onClose={() => setShowCal(false)} />}
      {showAdd && <AgregarSheet petName={pet.name} onClose={() => setShowAdd(false)} onSave={addVac} />}

      {/* Contactos de emergencia */}
      <div style={{ padding: '20px 0 0', borderTop: '1px solid rgb(238,236,245)', marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c14d7a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>Contactos de emergencia
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {contacts.map((c) => (
            <div key={c.id} style={{ background: 'rgb(251,232,239)', border: '1px solid rgb(245,214,227)', borderRadius: 14, padding: 12, display: 'flex', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', fontSize: 18 }}>🏥</div>
              <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'rgb(33,30,51)' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'rgb(162,157,186)', marginBottom: 3 }}>{c.type}</div>
                <a href={`tel:${c.phone}`} style={{ color: 'rgb(193,77,122)', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>{c.phone}</a>
                <div style={{ fontSize: 11, color: 'rgb(135,129,160)', marginTop: 4 }}>{c.address} · {c.hours}</div>
              </div>
            </div>
          ))}
        </div>
        {showAddC && (
          <form onSubmit={addContact} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, padding: 14, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', animation: 'kpop 0.2s ease' }}>
            <input value={cn} onChange={(e) => setCn(e.target.value)} placeholder="Nombre (ej: Vet 24h Palermo)" style={{ flex: '2 1 160px', padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
            <input value={cp} onChange={(e) => setCp(e.target.value)} placeholder="Teléfono" style={{ flex: '1 1 130px', padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
            <button type="submit" disabled={busy} style={{ flex: '0 0 auto', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, padding: '11px 18px', borderRadius: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>Agregar</button>
          </form>
        )}
        <button onClick={() => setShowAddC((s) => !s)} style={{ width: '100%', background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontWeight: 700, fontSize: 14, padding: 12, borderRadius: 12, cursor: 'pointer', marginBottom: 20 }}>+ Agregar contacto</button>
      </div>
    </div>
  );
}

/* ── Pantalla: Servicios ───────────────────────────────────────── */
const chips = [
  { label: 'Todos', cat: null },
  { label: 'Paseos', cat: 'Paseador' },
  { label: 'Guardería', cat: 'Guardería' },
  { label: 'Baño', cat: 'Baño y estética' },
  { label: 'Adiestrador', cat: 'Adiestrador' },
  { label: 'Cuidador', cat: 'Cuidador' },
];
const catPin = (cat: string) => {
  if (cat === 'Paseador') return { inner: paw, filled: true };
  if (cat === 'Guardería') return { inner: house, filled: false };
  if (cat === 'Baño y estética') return { inner: <path d="M12 3s6 5.7 6 10a6 6 0 0 1-12 0c0-4.3 6-10 6-10z" />, filled: false };
  if (cat === 'Adiestrador') return { inner: <><path d="M22 9 12 5 2 9l10 4 10-4z" /><path d="M6 11v5c0 1.3 2.7 3 6 3s6-1.7 6-3v-5" /></>, filled: false };
  return { inner: person, filled: false };
};
const pinSlots = [{ left: '30%', top: '34%' }, { left: '66%', top: '30%' }, { left: '50%', top: '60%' }];
const star = <svg width="12" height="12" viewBox="0 0 24 24" fill="#f5b301" style={{ display: 'inline', verticalAlign: -1 }}><path d="M12 3.4 14.6 9l6 .5-4.6 4 1.4 5.9L12 18l-5.4 3.2 1.4-5.9-4.6-4 6-.5z" /></svg>;

function Servicios({ go, providers }: { go: (s: Screen) => void; providers: ProviderVM[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [radio, setRadio] = useState(5);
  const [openId, setOpenId] = useState<string | null>(null);
  const ql = q.trim().toLowerCase();
  const list = providers.filter((p) => {
    if (p.km > radio) return false;
    if (cat && p.category !== cat) return false;
    if (ql && !(`${p.name} ${p.category} ${p.zone}`.toLowerCase().includes(ql))) return false;
    return true;
  });
  const pct = ((radio - 1) / 24) * 100;
  const circle = Math.min(radio * 22, 240);

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Servicios</div>
          <div style={{ color: 'rgb(135,129,160)', fontSize: 14 }}>Contratá prestadores verificados u ofrecé el tuyo</div>
        </div>
        <button onClick={() => go('negocio')} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 7, background: 'rgb(225,251,98)', border: 'none', borderRadius: 13, padding: '10px 14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,251,98,0.4)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          <span style={{ color: 'rgb(33,30,51)', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>Prestar servicio</span>
        </button>
      </div>

      {/* Buscador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgb(247,246,250)', border: '1.5px solid rgb(238,236,245)', borderRadius: 14, padding: '11px 14px', marginBottom: 14 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8781a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paseador, guardería, zona…" style={{ flex: '1 1 0%', border: 'none', outline: 'none', background: 'none', fontSize: 14, fontFamily: '"DM Sans"', color: 'rgb(33,30,51)' }} />
      </div>

      {/* Chips categoría */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 14 }}>
        {chips.map((c) => {
          const active = cat === c.cat;
          return (
            <button key={c.label} onClick={() => setCat(c.cat)} style={{ border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 100, whiteSpace: 'nowrap', background: active ? 'rgb(93,84,145)' : 'rgb(240,237,249)', color: active ? '#fff' : 'rgb(93,84,145)' }}>{c.label}</button>
          );
        })}
      </div>

      {/* Radio */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'rgb(91,86,112)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>Radio de búsqueda
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'rgb(93,84,145)' }}>{radio} km</span>
      </div>
      <div style={{ padding: '4px 2px 6px', marginBottom: 14 }}>
        <input type="range" min={1} max={25} step={1} value={radio} onChange={(e) => setRadio(Number(e.target.value))} style={{ width: '100%', display: 'block', appearance: 'none', height: 6, borderRadius: 100, outline: 'none', cursor: 'pointer', background: `linear-gradient(to right, rgb(93,84,145) 0%, rgb(93,84,145) ${pct}%, rgb(238,236,245) ${pct}%, rgb(238,236,245) 100%)` } as CSSProperties} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
          <span style={{ fontSize: 11, color: 'rgb(162,157,186)' }}>1 km</span>
          <span style={{ fontSize: 11, color: 'rgb(162,157,186)' }}>25 km</span>
        </div>
      </div>

      {/* Mapa */}
      <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: 250, marginBottom: 14, border: '1px solid rgb(230,227,240)', background: 'rgb(233,235,241)' }}>
        <svg viewBox="0 0 320 250" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <rect width="320" height="250" fill="#e9ebf1" />
          <rect x="26" y="24" width="80" height="58" rx="4" fill="#dfe2ea" /><rect x="128" y="18" width="70" height="66" rx="4" fill="#dfe2ea" /><rect x="220" y="30" width="74" height="52" rx="4" fill="#dfe2ea" />
          <rect x="20" y="138" width="86" height="72" rx="4" fill="#dfe2ea" /><rect x="128" y="132" width="66" height="84" rx="4" fill="#dfe2ea" /><rect x="214" y="138" width="86" height="78" rx="4" fill="#dfe2ea" />
          <path d="M0 112 H320 M0 120 H320" stroke="#cfd3de" strokeWidth="8" /><path d="M112 0 V250 M206 0 V250" stroke="#cfd3de" strokeWidth="8" /><path d="M0 116 H320" stroke="#fff" strokeWidth="1" strokeDasharray="6 6" />
        </svg>
        <div style={{ position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%, -50%)', width: circle, height: circle, borderRadius: '50%', background: 'rgba(93,84,145,0.1)', border: '1.5px dashed rgba(93,84,145,0.5)', zIndex: 1, transition: 'width 0.4s cubic-bezier(0.2,0.8,0.3,1), height 0.4s cubic-bezier(0.2,0.8,0.3,1)' }} />
        {list.slice(0, 3).map((p, i) => {
          const pin = catPin(p.category);
          return (
            <div key={p.id} style={{ position: 'absolute', left: pinSlots[i]!.left, top: pinSlots[i]!.top, transform: 'translate(-50%, -100%)', zIndex: 2, animation: 'kpin 0.6s cubic-bezier(0.2,0.8,0.3,1.5) both' } as CSSProperties}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 10, padding: '3px 8px', borderRadius: 100, whiteSpace: 'nowrap', boxShadow: '0 3px 8px rgba(0,0,0,0.2)', marginBottom: 3 }}>{p.name}</div>
                <div style={{ width: 30, height: 30, borderRadius: '50% 50% 50% 2px', background: 'rgb(93,84,145)', transform: 'rotate(45deg)', boxShadow: '0 3px 8px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgb(225,251,98)' }}>
                  <span style={{ transform: 'rotate(-45deg)', display: 'flex' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={pin.filled ? '#E1FB62' : 'none'} stroke={pin.filled ? 'none' : '#E1FB62'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{pin.inner}</svg>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%, -50%)', zIndex: 3 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgb(42,120,214)', border: '3px solid #fff', boxShadow: '0 0 0 6px rgba(42,120,214,0.18)' }} />
        </div>
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: 'rgb(135,129,160)' }}><strong style={{ color: 'rgb(33,30,51)' }}>{list.length}</strong> prestadores en {radio} km</span>
        <span style={{ fontSize: 12, color: 'rgb(162,157,186)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a29dba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10M11 12h10M11 19h10M4 5h.01M4 12h.01M4 19h.01" /></svg>Más cercano
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map((p) => {
          const openP = openId === p.id;
          const wa = 'https://wa.me/' + (p.phone ?? "").replace(/\D/g, '');
          return (
            <div key={p.id} className="wa-card" onClick={() => setOpenId(openP ? null : p.id)} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 18, padding: 14, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 50, height: 50, borderRadius: 15, background: `url(${p.photoUrl}) center/cover, rgb(226,245,234)`, flex: '0 0 auto' }} />
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                    {p.badge && <span style={{ background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5 }}>{p.badge}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{p.category} · {p.zone} · <span style={{ color: 'rgb(93,84,145)', fontWeight: 600 }}>{p.km} km</span></div>
                  <div style={{ fontSize: 12, color: 'rgb(91,86,112)', marginTop: 3 }}>{star} {p.rating} ({p.reviews}) · <span style={{ color: 'rgb(93,84,145)', fontWeight: 700 }}>${p.price.toLocaleString('es-AR')}{p.priceUnit}</span></div>
                </div>
                <span style={{ color: 'rgb(199,194,218)', fontSize: 18, transform: openP ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>›</span>
              </div>
              {openP && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, borderTop: '1px solid rgb(238,236,245)', paddingTop: 12 }}>
                  <p style={{ fontSize: 13, color: 'rgb(91,86,112)', lineHeight: 1.55, margin: '0 0 8px' }}>{p.about}</p>
                  <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)', marginBottom: 12 }}>
                    {p.address}{p.instagram ? ` · ${p.instagram}` : ''}{p.website ? ` · ${p.website}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={wa} target="_blank" rel="noopener" style={{ flex: '1 1 0%', textAlign: 'center', background: 'rgb(37,211,102)', color: '#fff', fontWeight: 700, fontSize: 13, padding: 11, borderRadius: 10, textDecoration: 'none' }}>Contactar por WhatsApp</a>
                    <a href={`tel:${p.phone}`} style={{ flex: '1 1 0%', textAlign: 'center', background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 13, padding: 11, borderRadius: 10, textDecoration: 'none' }}>Llamar</a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <div style={{ color: 'rgb(135,129,160)', fontSize: 14, padding: '10px 2px' }}>No hay prestadores con esos filtros. Probá ampliar el radio.</div>}
      </div>
    </div>
  );
}

/* ── Pantalla: Reintegros ──────────────────────────────────────── */
export type Reint = { id: string; place: string; detail: string; spent: number; refund: number; status: 'Acreditado' | 'Aprobado' | 'En revisión' | 'Rechazado' };
const m$ = (n: number) => '$' + n.toLocaleString('es-AR');

function Reintegros({ initialReintegros, planName, memberId }: { initialReintegros: Reint[]; planName: string; memberId: string }) {
  const router = useRouter();
  const items = initialReintegros;
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [detail, setDetail] = useState('');
  const [spent, setSpent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = items.filter((i) => i.status === 'Acreditado').reduce((a, i) => a + i.refund, 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Adjuntá la foto de la factura.'); return; }
    const s = Number(spent) || 0;
    setBusy(true);
    setError('');

    // El bucket 'receipts' es privado y la RLS exige que la primera carpeta
    // del path sea el id del socio.
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${memberId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (upErr) {
      setError('No pudimos subir la factura. Probá de nuevo.');
      setBusy(false);
      return;
    }

    const { error: insErr } = await supabase.from('reimbursements').insert({
      member_id: memberId, plan_name: planName, provider_name: place || 'Comprobante', concept: detail || 'Comprobante',
      amount: s, refund: Math.round(s * 0.5), refund_pct: 50, status: 'en_revision', receipt_path: path,
    });
    if (insErr) {
      // Si falla la solicitud, no dejamos el archivo huérfano en el bucket.
      await supabase.storage.from('receipts').remove([path]);
      setError('No pudimos registrar la solicitud. Probá de nuevo.');
      setBusy(false);
      return;
    }

    setPlace(''); setDetail(''); setSpent(''); setFile(null); setOpen(false);
    router.refresh();
    setBusy(false);
  };

  const badge = (st: Reint['status']): { bg: string; fg: string } => {
    if (st === 'Acreditado' || st === 'Aprobado') return { bg: 'rgb(226,245,234)', fg: 'rgb(47,143,91)' };
    if (st === 'Rechazado') return { bg: 'rgb(251,232,239)', fg: 'rgb(176,72,63)' };
    return { bg: 'rgb(251,243,226)', fg: 'rgb(184,134,11)' };
  };

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 16 }}>Reintegros</div>

      <div style={{ background: 'linear-gradient(135deg, rgb(93,84,145), rgb(70,63,112))', borderRadius: 20, padding: 24, marginBottom: 16, textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: 13, color: 'rgb(201,195,227)' }}>Reintegrado este año</div>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 40, color: 'rgb(225,251,98)', lineHeight: 1.1, margin: '4px 0' }}>{m$(total)}</div>
        <div style={{ fontSize: 12.5, color: 'rgb(201,195,227)' }}>plan {planName}</div>
      </div>

      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 14, cursor: 'pointer', marginBottom: 16 }}>+ Subir factura</button>

      {open && (
        <form onSubmit={submit} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Veterinaria / comercio" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
          <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Detalle (ej: Consulta)" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
          <input value={spent} onChange={(e) => setSpent(e.target.value)} type="number" placeholder="Monto gastado ($)" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: '1.5px dashed rgb(203,197,227)', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>
            <span style={{ display: 'flex', color: 'rgb(93,84,145)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6M9 15h6" /></svg>
            </span>
            <span style={{ fontSize: 13.5, color: file ? 'rgb(33,30,51)' : 'rgb(135,129,160)', fontWeight: file ? 600 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file ? file.name : 'Foto de la factura (obligatoria)'}
            </span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); }} style={{ display: 'none' }} />
          </label>
          {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600 }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, padding: 12, borderRadius: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Enviando…' : 'Enviar comprobante'}</button>
        </form>
      )}

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Historial</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((it) => {
          const b = badge(it.status);
          return (
            <div key={it.id} className="wa-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: 'rgb(33,30,51)' }}>{it.place}</div>
                <div style={{ fontSize: 12, color: 'rgb(162,157,186)', marginBottom: 8 }}>{it.detail}</div>
                <div style={{ fontSize: 13, color: 'rgb(135,129,160)' }}>Gastado {m$(it.spent)}</div>
              </div>
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <span style={{ background: b.bg, color: b.fg, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100 }}>{it.status}</span>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'rgb(93,84,145)', marginTop: 18 }}>Reintegro {m$(it.refund)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Pantalla: Beneficios ──────────────────────────────────────── */
const crossIcon = <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>;
const storeIcon = <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>;
const tagIcon = <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.2" /></>;
const dropletIcon = <path d="M12 3s6 5.7 6 10a6 6 0 0 1-12 0c0-4.3 6-10 6-10z" />;
const benefitIcons: Record<BenefitVM['icon'], ReactNode> = { cross: crossIcon, store: storeIcon, tag: tagIcon, droplet: dropletIcon };
const benefPins = [{ left: '38%', top: '30%' }, { left: '78%', top: '26%' }, { left: '28%', top: '52%' }, { left: '58%', top: '52%' }, { left: '86%', top: '52%' }];

function Beneficios({ benefits }: { benefits: BenefitVM[] }) {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const list = benefits.filter((b) => !ql || `${b.name} ${b.category}`.toLowerCase().includes(ql));
  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Beneficios</div>
      <div style={{ color: 'rgb(135,129,160)', fontSize: 14, marginBottom: 14 }}>Descuentos en la red de veterinarias y pet shops</div>

      {/* Mapa con pins de % */}
      <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: 200, marginBottom: 14, border: '1px solid rgb(230,227,240)', background: 'rgb(233,235,241)' }}>
        <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <rect width="320" height="200" fill="#e9ebf1" />
          <rect x="26" y="18" width="80" height="48" rx="4" fill="#dfe2ea" /><rect x="128" y="14" width="70" height="54" rx="4" fill="#dfe2ea" /><rect x="220" y="22" width="74" height="44" rx="4" fill="#dfe2ea" />
          <rect x="20" y="112" width="86" height="60" rx="4" fill="#dfe2ea" /><rect x="128" y="106" width="66" height="70" rx="4" fill="#dfe2ea" /><rect x="214" y="112" width="86" height="66" rx="4" fill="#dfe2ea" />
          <path d="M0 90 H320 M0 98 H320" stroke="#cfd3de" strokeWidth="8" /><path d="M112 0 V200 M206 0 V200" stroke="#cfd3de" strokeWidth="8" /><path d="M0 94 H320" stroke="#fff" strokeWidth="1" strokeDasharray="6 6" />
        </svg>
        {benefPins.map((slot, i) => (
          <div key={i} style={{ position: 'absolute', left: slot.left, top: slot.top, transform: 'translate(-50%, -100%)', zIndex: 2, animation: 'kpin 0.6s cubic-bezier(0.2,0.8,0.3,1.5) both' } as CSSProperties}>
            <div style={{ width: 30, height: 30, borderRadius: '50% 50% 50% 2px', background: 'rgb(93,84,145)', transform: 'rotate(45deg)', boxShadow: '0 3px 8px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgb(225,251,98)' }}>
              <span style={{ transform: 'rotate(-45deg)', color: 'rgb(225,251,98)', fontWeight: 800, fontSize: 13 }}>%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Buscar dirección */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: '1 1 0%', display: 'flex', alignItems: 'center', gap: 9, background: 'rgb(247,246,250)', border: '1.5px solid rgb(238,236,245)', borderRadius: 14, padding: '11px 14px' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8781a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ingresá tu dirección" style={{ flex: '1 1 0%', border: 'none', outline: 'none', background: 'none', fontSize: 14, fontFamily: '"DM Sans"', color: 'rgb(33,30,51)' }} />
        </div>
        <button style={{ flex: '0 0 auto', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, padding: '0 22px', borderRadius: 14, cursor: 'pointer' }}>Buscar</button>
      </div>

      {/* Banner carnet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgb(93,84,145)', borderRadius: 18, padding: '16px 18px', marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgb(225,251,98)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{tagIcon}</svg>
        </div>
        <div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 16, color: '#fff' }}>Mostrá tu carnet y ahorrá</div>
          <div style={{ fontSize: 12.5, color: 'rgb(201,195,227)' }}>Presentá el carnet digital en cada local</div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map((b) => (
          <div key={b.id} className="wa-card" style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 14, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', border: '1px solid rgb(238,236,245)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{benefitIcons[b.icon]}</svg>
            </div>
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'rgb(33,30,51)' }}>{b.name}</div>
              <div style={{ fontSize: 12.5, color: 'rgb(162,157,186)' }}>{b.category}</div>
            </div>
            <span style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontWeight: 800, fontSize: 14, padding: '6px 12px', borderRadius: 100, flex: '0 0 auto' }}>{b.discount}</span>
          </div>
        ))}
        {list.length === 0 && <div style={{ color: 'rgb(135,129,160)', fontSize: 14, padding: '10px 2px' }}>Sin resultados para “{q}”.</div>}
      </div>
    </div>
  );
}

/* ── Pantalla: Foros / Comunidad ───────────────────────────────── */
const heartFill = <path d="M12 20s-7-4.3-9.2-8.6C1.3 8.3 2.6 5 6 5c2 0 3.3 1.2 4 2.3C10.7 6.2 12 5 14 5c3.4 0 4.7 3.3 3.2 6.4C19 15.7 12 20 12 20z" />;
const capPath = <><path d="M22 9 12 5 2 9l10 4 10-4z" /><path d="M6 11v5c0 1.3 2.7 3 6 3s6-1.7 6-3v-5" /></>;
const catCfg: Record<string, { iconBg: string; icon: ReactNode; tagBg: string; tagFg: string }> = {
  Paseadores: { iconBg: 'rgb(34,160,107)', icon: paw, tagBg: 'rgb(226,245,234)', tagFg: 'rgb(31,125,80)' },
  Salud: { iconBg: 'rgb(93,84,145)', icon: plusCircle, tagBg: 'rgb(240,237,249)', tagFg: 'rgb(93,84,145)' },
  Guarderías: { iconBg: 'rgb(217,138,43)', icon: house, tagBg: 'rgb(251,243,226)', tagFg: 'rgb(176,111,24)' },
  Adiestramiento: { iconBg: 'rgb(42,120,214)', icon: capPath, tagBg: 'rgb(230,240,251)', tagFg: 'rgb(42,120,214)' },
  Cruzas: { iconBg: 'rgb(193,77,122)', icon: heartFill, tagBg: 'rgb(251,232,239)', tagFg: 'rgb(193,77,122)' },
  Razas: { iconBg: 'rgb(37,150,150)', icon: paw, tagBg: 'rgb(224,244,244)', tagFg: 'rgb(23,120,120)' },
};
const foroChips = ['Todos', 'Paseadores', 'Salud', 'Guarderías', 'Adiestramiento', 'Alimentación', 'Cruzas', 'Razas'];

function Foros({ initialPosts, profile }: { initialPosts: ForumPost[]; profile: Profile }) {
  const router = useRouter();
  const posts = initialPosts;
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todos');
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [nt, setNt] = useState('');
  const [nb, setNb] = useState('');
  const [busy, setBusy] = useState(false);

  const ql = q.trim().toLowerCase();
  const list = posts.filter((p) => {
    if (cat !== 'Todos' && p.cat !== cat) return false;
    if (ql && !`${p.title} ${p.body} ${p.author}`.toLowerCase().includes(ql)) return false;
    return true;
  });

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    if (!nt.trim()) return;
    setBusy(true);
    await supabase.from('community_posts').insert({ author_id: profile.id, category: cat === 'Todos' ? 'Salud' : cat, title: nt, body: nb || '—' });
    setNt(''); setNb(''); setOpen(false);
    router.refresh();
    setBusy(false);
  };

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22 }}>Comunidad</div>
        <button onClick={() => setOpen((o) => !o)} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, padding: '9px 16px', borderRadius: 100, cursor: 'pointer' }}>+ Publicar</button>
      </div>

      {open && (
        <form onSubmit={publish} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={nt} onChange={(e) => setNt(e.target.value)} placeholder="Título de tu consulta" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
          <textarea value={nb} onChange={(e) => setNb(e.target.value)} placeholder="Contanos más…" rows={3} style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"', resize: 'vertical' }} />
          <button type="submit" disabled={busy} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, padding: 12, borderRadius: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Publicando…' : 'Publicar'}</button>
        </form>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgb(247,246,250)', border: '1.5px solid rgb(238,236,245)', borderRadius: 14, padding: '11px 14px', marginBottom: 14 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8781a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la comunidad…" style={{ flex: '1 1 0%', border: 'none', outline: 'none', background: 'none', fontSize: 14, fontFamily: '"DM Sans"', color: 'rgb(33,30,51)' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 12 }}>
        {foroChips.map((c) => {
          const active = cat === c;
          return <button key={c} onClick={() => setCat(c)} style={{ border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 100, whiteSpace: 'nowrap', background: active ? 'rgb(93,84,145)' : 'rgb(240,237,249)', color: active ? '#fff' : 'rgb(93,84,145)' }}>{c}</button>;
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'rgb(135,129,160)' }}>{list.length} publicaciones</span>
        <span style={{ fontSize: 13, color: 'rgb(91,86,112)', display: 'flex', alignItems: 'center', gap: 6, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 10, padding: '7px 12px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8781a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></svg>Todas
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map((p) => {
          const cfg = catCfg[p.cat] ?? catCfg.Salud!;
          const isLiked = liked[p.id];
          const likeInner = cfg.icon;
          return (
            <div key={p.id} className="wa-card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 18, padding: 16 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: cfg.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={p.cat === 'Paseadores' || p.cat === 'Cruzas' ? '#fff' : 'none'} stroke={p.cat === 'Paseadores' || p.cat === 'Cruzas' ? 'none' : '#fff'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{likeInner}</svg>
              </div>
              <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cfg.tagFg, background: cfg.tagBg, padding: '3px 9px', borderRadius: 6 }}>{p.cat}</span>
                  {p.trend && <span style={{ fontSize: 10, fontWeight: 800, color: 'rgb(33,30,51)', background: 'rgb(225,251,98)', padding: '3px 8px', borderRadius: 6, letterSpacing: '0.03em' }}>EN TENDENCIA</span>}
                  <span style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{p.author} · {p.meta}</span>
                </div>
                <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 16, lineHeight: 1.25, marginBottom: 6, color: 'rgb(33,30,51)' }}>{p.title}</div>
                <div style={{ fontSize: 13, color: 'rgb(122,117,146)', lineHeight: 1.5, marginBottom: 12 }}>{p.body}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 12.5, padding: '5px 11px', borderRadius: 100 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{chat}</svg>{p.replies}
                  </span>
                  <button onClick={() => setLiked((s) => ({ ...s, [p.id]: !s[p.id] }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgb(251,232,239)', color: 'rgb(193,77,122)', border: 'none', fontWeight: 600, fontSize: 12.5, padding: '5px 11px', borderRadius: 100, cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#c14d7a">{heartFill}</svg>{p.likes + (isLiked ? 1 : 0)}
                  </button>
                  <button onClick={() => setOpenThread(openThread === p.id ? null : p.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}>{openThread === p.id ? 'Cerrar hilo ▴' : 'Ver hilo ›'}</button>
                </div>
                {openThread === p.id && (
                  <div style={{ marginTop: 12, borderTop: '1px solid rgb(238,236,245)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {p.answers.map((a) => (
                      <div key={a.author + a.when} style={{ background: '#fff', border: '1px solid rgb(238,236,245)', borderRadius: 12, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 12.5 }}>{a.author}</span>
                          <span style={{ fontSize: 11, color: 'rgb(162,157,186)' }}>{a.when}</span>
                          {a.best && <span style={{ fontSize: 9.5, fontWeight: 800, color: 'rgb(31,125,80)', background: 'rgb(226,245,234)', padding: '2px 7px', borderRadius: 5 }}>MEJOR RESPUESTA</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'rgb(193,77,122)', fontWeight: 600 }}>♥ {a.likes}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'rgb(91,86,112)', lineHeight: 1.5 }}>{a.text}</div>
                      </div>
                    ))}
                    {p.answers.length === 0 && (
                      <div style={{ fontSize: 13, color: 'rgb(135,129,160)' }}>Todavía no hay respuestas. ¡Sé la primera persona en responder!</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div style={{ color: 'rgb(135,129,160)', fontSize: 14, padding: '10px 2px' }}>No hay publicaciones con esos filtros.</div>}
      </div>
    </div>
  );
}

/* ── Pantalla: Mi negocio ──────────────────────────────────────── */
const RUBROS = ['Paseador', 'Guardería', 'Adiestrador', 'Baño y estética', 'Cuidador'];

function Negocio({ go, negocio, profile }: { go: (s: Screen) => void; negocio: MiNegocio | null; profile: Profile }) {
  const router = useRouter();
  const [showAlta, setShowAlta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rubro, setRubro] = useState(RUBROS[0]!);
  const [zona, setZona] = useState('');
  const [tel, setTel] = useState(profile.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // El estado sale del negocio real, no de un switch: sin negocio, esperando la
  // validación del club, publicado, o rechazado.
  const state: 'sin' | 'revision' | 'activo' | 'rechazado' =
    !negocio ? 'sin' : negocio.status === 'verificado' ? 'activo' : negocio.status === 'rechazado' ? 'rechazado' : 'revision';

  const enviarAlta = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Poné el nombre de tu negocio.'); return; }
    if (!zona.trim()) { setError('Poné la zona donde trabajás.'); return; }
    setBusy(true); setError('');
    const { error: e2 } = await supabase.from('providers').insert({
      owner_id: profile.id, name: nombre.trim(), category: rubro, zone: zona.trim(),
      phone: tel.trim() || null, status: 'pendiente',
    });
    if (e2) { setError('No pudimos enviar la solicitud. Probá de nuevo.'); setBusy(false); return; }
    setShowAlta(false);
    router.refresh();
    setBusy(false);
  };

  const darDeBaja = async () => {
    if (!negocio) return;
    setBusy(true);
    await supabase.from('providers').delete().eq('id', negocio.id);
    router.refresh();
    setBusy(false);
  };

  /** Ficha del negocio. Con `soloContacto` se usa junto a una tarjeta que ya
   *  muestra el nombre, para no repetirlo. */
  const negCard = (soloContacto = false) => negocio && (
    <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
      {!soloContacto && (
        <>
          <div style={{ fontSize: 12, color: 'rgb(162,157,186)', marginBottom: 2 }}>Tu negocio</div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 18 }}>{negocio.name}</div>
          <div style={{ fontSize: 13, color: 'rgb(135,129,160)' }}>{negocio.category} · {negocio.zone}</div>
        </>
      )}
      {negocio.phone && (
        <div>
          <div style={{ fontSize: 10, color: 'rgb(162,157,186)', marginTop: soloContacto ? 0 : 12 }}>WHATSAPP DE CONTACTO</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{negocio.phone}</div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Mi negocio</div>
      <div style={{ color: 'rgb(135,129,160)', fontSize: 14, marginBottom: 18 }}>Ofrecé tus servicios a la comunidad de Kumo.</div>

      {state === 'sin' && (
        <div>
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 20, padding: 28, textAlign: 'center', marginBottom: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgb(225,251,98)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{storeIcon}</svg>
            </div>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, lineHeight: 1.15 }}>¿Ofrecés un servicio para mascotas?</div>
            <p style={{ color: 'rgb(122,117,146)', fontSize: 14, lineHeight: 1.55, margin: '10px auto 20px', maxWidth: 460 }}>Dá de alta tu negocio como paseador, guardería, adiestrador, baño o cuidador. El club valida tus datos y quedás visible para miles de socios.</p>
            <button onClick={() => setShowAlta((s) => !s)} style={{ display: 'inline-block', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, padding: '14px 26px', borderRadius: 14, cursor: 'pointer' }}>Dar de alta mi negocio →</button>
            {showAlta && (
              <form onSubmit={enviarAlta} style={{ marginTop: 18, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, animation: 'kpop 0.2s ease' }}>
                <input value={nombre} onChange={(e) => { setNombre(e.target.value); setError(''); }} placeholder="Nombre de tu negocio" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
                <select value={rubro} onChange={(e) => setRubro(e.target.value)} style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }}>
                  {RUBROS.map((r) => <option key={r}>{r}</option>)}
                </select>
                <input value={zona} onChange={(e) => { setZona(e.target.value); setError(''); }} placeholder="Zona (ej: Palermo, CABA)" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
                <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="WhatsApp de contacto" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
                {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600 }}>{error}</div>}
                <button type="submit" disabled={busy} style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', border: 'none', fontWeight: 700, fontSize: 14, padding: 12, borderRadius: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
              </form>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Miles de socios buscando tu servicio', 'Sello "Verificado por Kumo"', 'Reseñas y contactos en un solo lugar'].map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgb(226,245,234)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f8f5b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                </div>
                <span style={{ fontSize: 14, color: 'rgb(33,30,51)', fontWeight: 600 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {state === 'revision' && (
        <div>
          <div style={{ background: 'rgb(251,243,226)', border: '1px solid rgb(240,224,180)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 17, color: 'rgb(184,134,11)' }}>En revisión</div>
            <div style={{ fontSize: 13, color: 'rgb(140,110,40)', marginTop: 2 }}>El club está validando los datos de tu negocio. Te avisamos en 48 hs hábiles.</div>
          </div>
          {negCard()}
          <div style={{ fontWeight: 700, fontSize: 15, margin: '18px 0 12px' }}>Estado de tu solicitud</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { t: 'Solicitud enviada', d: 'Recibimos los datos de tu negocio', done: true },
              { t: 'Validación del club', d: 'Verificamos identidad y datos · en curso', current: true },
              { t: 'Negocio publicado', d: 'Quedás visible en Servicios' },
            ].map((s, i, arr) => (
              <div key={s.t} style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: s.done ? 'rgb(47,143,91)' : s.current ? 'rgb(93,84,145)' : 'rgb(230,227,240)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>{s.done ? '✓' : ''}</div>
                  {i < arr.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 28, background: 'rgb(230,227,240)' }} />}
                </div>
                <div style={{ paddingBottom: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.t}</div>
                  <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)' }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state === 'activo' && (
        <div>
          <div style={{ background: 'rgb(226,245,234)', border: '1px solid rgb(183,224,199)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 17, color: 'rgb(31,125,80)' }}>¡Negocio aprobado! 🎉</div>
            <div style={{ fontSize: 13, color: 'rgb(45,110,80)', marginTop: 2 }}>El club validó tus datos. Ya estás visible en Servicios.</div>
          </div>
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>Tu negocio</div>
                <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 18 }}>{negocio?.name}</div>
                <div style={{ fontSize: 13, color: 'rgb(135,129,160)' }}>{negocio?.category} · {negocio?.zone}</div>
              </div>
              <span style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontWeight: 700, fontSize: 10, padding: '4px 9px', borderRadius: 100, flex: '0 0 auto' }}>Publicado</span>
            </div>
            {/* Solo lo que la base realmente registra. Vistas y contactos no se
                miden todavía, así que no se muestran números inventados. */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: '1 1 0%', background: '#fff', border: '1px solid rgb(238,236,245)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, color: 'rgb(93,84,145)' }}>{negocio && negocio.reviews > 0 ? `${negocio.rating.toFixed(1)}★` : '—'}</div>
                <div style={{ fontSize: 11, color: 'rgb(135,129,160)' }}>{negocio && negocio.reviews > 0 ? `${negocio.reviews} reseñas` : 'sin reseñas'}</div>
              </div>
            </div>
          </div>
          {negCard(true)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => go('servicios')} style={{ background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontWeight: 700, fontSize: 14, padding: 13, borderRadius: 12, cursor: 'pointer' }}>Ver perfil público</button>
            <button onClick={darDeBaja} disabled={busy} style={{ background: 'none', color: 'rgb(176,72,63)', border: 'none', fontWeight: 600, fontSize: 13, padding: 6, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Dando de baja…' : 'Dar de baja mi negocio'}</button>
          </div>
        </div>
      )}

      {state === 'rechazado' && (
        <div>
          <div style={{ background: 'rgb(251,232,239)', border: '1px solid rgb(240,200,215)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 17, color: 'rgb(176,72,63)' }}>No pudimos aprobar tu negocio</div>
            <div style={{ fontSize: 13, color: 'rgb(150,70,70)', marginTop: 2 }}>Escribinos y lo revisamos con vos. Podés dar de baja la solicitud y volver a empezar cuando quieras.</div>
          </div>
          {negCard()}
          <button onClick={darDeBaja} disabled={busy} style={{ background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontWeight: 700, fontSize: 14, padding: 13, borderRadius: 12, cursor: busy ? 'default' : 'pointer', width: '100%', opacity: busy ? 0.6 : 1 }}>{busy ? 'Borrando…' : 'Borrar la solicitud'}</button>
        </div>
      )}
    </div>
  );
}

/* ── Pantalla: Mi perfil ───────────────────────────────────────── */
function Perfil({ go, profile, pets, reintegradoTotal }: { go: (s: Screen) => void; profile: Profile; pets: Pet[]; reintegradoTotal: number }) {
  const router = useRouter();
  const misMascotas = pets.map((p) => ({ name: p.name, sub: p.breed, photo: p.photo }));
  const [showAddPet, setShowAddPet] = useState(false);
  const [pn, setPn] = useState('');
  const [pr, setPr] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [datos, setDatos] = useState({ dom: profile.address ?? '—', tel: profile.phone ?? '—', email: profile.email });
  const [card, setCard] = useState('4287');
  const [editCard, setEditCard] = useState(false);
  const addPet = async (e: FormEvent) => {
    e.preventDefault();
    if (!pn.trim()) return;
    setBusy(true);
    await supabase.from('pets').insert({ owner_id: profile.id, name: pn, breed: pr || null });
    setPn(''); setPr(''); setShowAddPet(false);
    router.refresh();
    setBusy(false);
  };
  const row = (title: string, sub: string, action: ReactNode, onClick?: () => void) => (
    <button onClick={onClick} className="wa-card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, padding: '13px 15px', cursor: onClick ? 'pointer' : 'default', width: '100%' }}>
      <div style={{ flex: '1 1 0%', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)' }}>{sub}</div>
      </div>
      {action}
    </button>
  );
  const chevron = <span style={{ color: 'rgb(199,194,218)', fontSize: 18 }}>›</span>;
  const dato = (k: string, v: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgb(238,236,245)' }}>
      <span style={{ fontSize: 13, color: 'rgb(135,129,160)' }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{v}</span>
    </div>
  );
  const pagos = [
    ['10 jul 2026', '$18.000'], ['10 jun 2026', '$18.000'], ['10 may 2026', '$16.500'], ['10 abr 2026', '$16.500'],
  ];

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      {/* Header perfil */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgb(93,84,145)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, flex: '0 0 auto' }}>{profile.firstName[0]}</div>
        <div style={{ flex: '1 1 0%' }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20 }}>{profile.fullName}</div>
          <div style={{ fontSize: 13, color: 'rgb(135,129,160)' }}>Socio #{profile.memberNo} · Plan {profile.planName}</div>
        </div>
        <button onClick={() => setEditing((s) => !s)} style={{ background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontWeight: 700, fontSize: 13, padding: '8px 14px', borderRadius: 100, cursor: 'pointer' }}>{editing ? 'Listo' : 'Editar'}</button>
      </div>

      {/* Mis mascotas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Mis mascotas</span>
        <button onClick={() => setShowAddPet((s) => !s)} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Agregar</button>
      </div>
      {showAddPet && (
        <form onSubmit={addPet} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, animation: 'kpop 0.2s ease' }}>
          <input value={pn} onChange={(e) => setPn(e.target.value)} placeholder="Nombre" style={{ flex: '1 1 120px', padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
          <input value={pr} onChange={(e) => setPr(e.target.value)} placeholder="Raza y edad" style={{ flex: '1 1 140px', padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
          <button type="submit" disabled={busy} style={{ flex: '0 0 auto', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, padding: '11px 18px', borderRadius: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>Agregar</button>
        </form>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {misMascotas.map((m) => (
          <button key={m.name} onClick={() => go('carnet')} className="wa-card" style={{ textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, padding: 12, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `url(${m.photo}) center/cover, rgb(230,227,240)`, flex: '0 0 auto' }} />
            <div style={{ flex: '1 1 0%' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: 'rgb(135,129,160)' }}>{m.sub}</div>
            </div>
            <span style={{ color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 13 }}>Ver carnet ›</span>
          </button>
        ))}
      </div>

      {/* Mi cuenta */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Mi cuenta</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {row('Mi negocio', 'Ofrecé tu servicio en Kumo', chevron, () => go('negocio'))}
        {row('Mis reintegros', `${m$(reintegradoTotal)} reintegrados este año`, chevron, () => go('reintegros'))}
        {row('Membresía', `Plan ${profile.planName} · ${m$(profile.planPrice)}/mes · próx. cobro 10/08`, <span style={{ color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 13 }}>Cambiar</span>, () => { window.location.href = `${LANDING}/#planes`; })}
        {row('Medio de pago', `Visa ····${card}`, <span style={{ color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 13 }}>{editCard ? 'Cerrar' : 'Editar'}</span>, () => setEditCard((s) => !s))}
        {editCard && (
          <form onSubmit={(e) => { e.preventDefault(); setEditCard(false); }} style={{ display: 'flex', gap: 10, animation: 'kpop 0.2s ease' }}>
            <input value={card} onChange={(e) => setCard(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Últimos 4 dígitos" style={{ flex: '1 1 0%', padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
            <button type="submit" style={{ flex: '0 0 auto', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, padding: '11px 18px', borderRadius: 10, cursor: 'pointer' }}>Guardar</button>
          </form>
        )}
      </div>

      {/* Datos personales */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Datos personales</div>
      <div style={{ marginBottom: 20 }}>
        {dato('DNI', profile.dni ?? '—')}
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0' }}>
            <input value={datos.dom} onChange={(e) => setDatos((d) => ({ ...d, dom: e.target.value }))} style={{ padding: '10px 12px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 13, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
            <input value={datos.tel} onChange={(e) => setDatos((d) => ({ ...d, tel: e.target.value }))} style={{ padding: '10px 12px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 13, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
            <input value={datos.email} onChange={(e) => setDatos((d) => ({ ...d, email: e.target.value }))} style={{ padding: '10px 12px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 13, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
            <button onClick={() => setEditing(false)} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, padding: 11, borderRadius: 10, cursor: 'pointer' }}>Guardar cambios</button>
          </div>
        ) : (
          <>
            {dato('Domicilio', datos.dom)}
            {dato('Teléfono', datos.tel)}
            {dato('Email', datos.email)}
          </>
        )}
      </div>

      {/* Historial de pagos */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Historial de pagos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {pagos.map(([d, amt]) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 12, padding: '12px 14px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Cuota mensual · Plan FAMILIA</div>
              <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{d}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{amt}</div>
              <span style={{ fontSize: 11, color: 'rgb(47,143,91)', fontWeight: 700 }}>Pagado</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href="https://wa.me/5491125168802" target="_blank" rel="noopener" style={{ textAlign: 'center', background: 'rgb(37,211,102)', color: '#fff', fontWeight: 700, fontSize: 14, padding: 13, borderRadius: 12, cursor: 'pointer', textDecoration: 'none' }}>Ayuda por WhatsApp</a>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = LANDING; }} style={{ textAlign: 'center', background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontWeight: 700, fontSize: 14, padding: 13, borderRadius: 12, cursor: 'pointer' }}>Cerrar sesión</button>
        <a href="mailto:hola@kumoclub.com.ar?subject=Quiero darme de baja" style={{ textAlign: 'center', background: 'none', color: 'rgb(176,72,63)', fontWeight: 600, fontSize: 13, padding: 6, cursor: 'pointer', textDecoration: 'none' }}>Darme de baja</a>
      </div>
    </div>
  );
}

/* ── Placeholder ───────────────────────────────────────────────── */
/* ── Hoja inferior (los sheets del prototipo) ──────────────────── */
function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(33,30,51,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'kfade 0.2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: '24px 24px 0 0', padding: '16px 20px 26px', animation: 'kslideup 0.28s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 100, background: 'rgb(224,220,236)', margin: '0 auto 16px' }} />
        {children}
      </div>
    </div>
  );
}
const sheetBtn = (fill: boolean): CSSProperties => ({
  background: fill ? 'rgb(93,84,145)' : 'rgb(240,237,249)', color: fill ? '#fff' : 'rgb(93,84,145)',
  border: 'none', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 14, cursor: 'pointer', fontFamily: '"DM Sans"',
});
/** Botón de un grupo de opciones tipo pastilla (Tipo, Estado). */
const segBtn = (active: boolean): CSSProperties => ({
  flex: '1 1 0%', border: `1.5px solid ${active ? 'rgb(93,84,145)' : 'rgb(230,227,240)'}`, background: active ? 'rgb(93,84,145)' : '#fff',
  color: active ? '#fff' : 'rgb(91,86,112)', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13, padding: '10px 6px', borderRadius: 11, cursor: 'pointer',
});
const sheetLabel: CSSProperties = { display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 8 };
const sheetInput: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid rgb(230,227,240)', borderRadius: 12, padding: '12px 14px', fontFamily: '"DM Sans"', fontSize: 14, outline: 'none' };

/* ── Hoja: Calendario de salud ─────────────────────────────────── */
function CalendarioSheet({ vacs, onClose }: { vacs: Vac[]; onClose: () => void }) {
  const hoy = new Date();
  const [mes, setMes] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
  const [dia, setDia] = useState<CalCell | null>(null);
  const cells = buildCalMes(vacs, mes.y, mes.m);
  const mover = (delta: number) => setMes(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 2 }}>Calendario de salud</div>
      <div style={{ fontSize: 13, color: 'rgb(135,129,160)', marginBottom: 18 }}>Cuándo aplicaste cada vacuna y cuándo toca la próxima.</div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button onClick={() => mover(-1)} aria-label="Mes anterior" style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>‹</button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{calMesLabel(mes.y, mes.m)}</div>
          <button onClick={() => mover(1)} aria-label="Mes siguiente" style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 }}>
          {CAL_DIAS.map((d) => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgb(162,157,186)', padding: '6px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((c, i) => {
            if (c.num === null) return <div key={`h${i}`} />;
            const tone = c.mark ? CAL_TONE[c.mark] : null;
            const marcado = c.vaxes.length > 0;
            return (
              <button key={c.iso} onClick={marcado ? () => setDia(c) : undefined} title={marcado ? c.vaxes.map((v) => v.name).join(', ') : undefined}
                style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 8, background: tone?.bg ?? '#fff', border: `1px solid ${tone?.border ?? 'rgb(238,236,245)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontFamily: '"DM Sans"', color: 'rgb(33,30,51)', cursor: marcado ? 'pointer' : 'default', padding: 0 }}>
                {c.num}
                {marcado && <span style={{ position: 'absolute', bottom: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: tone!.dot }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgb(238,236,245)', paddingTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Leyenda</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          {([['aplicada', 'Vacuna aplicada'], ['pronto', 'Próxima en 3 días'], ['pendiente', 'Próxima pendiente']] as const).map(([k, txt]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: CAL_TONE[k].bg, border: `1.5px solid ${CAL_TONE[k].border}` }} />
              <span>{txt}</span>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onClose} style={{ ...sheetBtn(false), width: '100%', marginTop: 6 }}>Cerrar</button>

      {dia && (
        <Sheet onClose={() => setDia(null)}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Vacunas del {calDiaLabel(dia.iso!)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dia.vaxes.map((v, i) => (
              <div key={v.name + i} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgb(93,84,145)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#fff' }}>{ic(shieldPath, false, 20)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: 'rgb(135,129,160)', marginTop: 2 }}>{v.estado}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setDia(null)} style={{ ...sheetBtn(false), width: '100%', marginTop: 20 }}>Cerrar</button>
        </Sheet>
      )}
    </Sheet>
  );
}

/* ── Hoja: Agregar al carnet ───────────────────────────────────── */
function AgregarSheet({ petName, onClose, onSave }: { petName: string; onClose: () => void; onSave: (v: { kind: VaccineKind; name: string; aplicada: boolean; fecha: string | null }) => Promise<void> }) {
  const hoy = new Date();
  const [kind, setKind] = useState<VaccineKind>('Vacuna');
  const [name, setName] = useState('');
  const [aplicada, setAplicada] = useState(true);
  const [fecha, setFecha] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pMes, setPMes] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
  const [busy, setBusy] = useState(false);
  const puedeGuardar = name.trim().length > 0 && !busy;
  const moverP = (delta: number) => setPMes(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const guardar = async () => {
    if (!puedeGuardar) return;
    setBusy(true);
    await onSave({ kind, name: name.trim(), aplicada, fecha });
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Agregar al carnet</div>
      <div style={{ fontSize: 13, color: 'rgb(135,129,160)', marginBottom: 18 }}>Sumá una vacuna, estudio o antiparasitario al historial de {petName}.</div>

      <label style={sheetLabel}>Tipo</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {VACUNA_KINDS.map((k) => <button key={k} onClick={() => setKind(k)} style={segBtn(kind === k)}>{k}</button>)}
      </div>

      <label style={sheetLabel} htmlFor="av-name">Nombre</label>
      <input id="av-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Quíntuple, Análisis de sangre…" style={{ ...sheetInput, marginBottom: 16 }} />

      <label style={sheetLabel}>Estado</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button onClick={() => setAplicada(true)} style={segBtn(aplicada)}>Sí, ya aplicada</button>
        <button onClick={() => setAplicada(false)} style={segBtn(!aplicada)}>No, es próxima</button>
      </div>

      <label style={sheetLabel}>{aplicada ? 'Fecha de aplicación' : 'Próxima fecha'}</label>
      <button onClick={() => setPickerOpen((o) => !o)} style={{ ...sheetInput, textAlign: 'left', marginBottom: 8, background: '#fff', cursor: 'pointer', color: fecha ? 'rgb(33,30,51)' : 'rgb(162,157,186)' }}>
        {fecha ? fmtFechaCorta(fecha) : 'Seleccionar fecha'}
      </button>
      {pickerOpen && (
        <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button onClick={() => moverP(-1)} aria-label="Mes anterior" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 6px' }}>←</button>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{calMesLabel(pMes.y, pMes.m)}</span>
            <button onClick={() => moverP(1)} aria-label="Mes siguiente" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 6px' }}>→</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center' }}>
            {buildPickerMes(pMes.y, pMes.m).map((d, i) => d.num === null
              ? <div key={`h${i}`} />
              : (
                <button key={d.iso} onClick={() => { setFecha(d.iso); setPickerOpen(false); }}
                  style={{ background: fecha === d.iso ? 'rgb(93,84,145)' : '#fff', border: `1px solid ${fecha === d.iso ? 'rgb(93,84,145)' : 'rgb(238,236,245)'}`, borderRadius: 6, padding: '5px 2px', cursor: 'pointer', fontSize: 11, fontFamily: '"DM Sans"', color: fecha === d.iso ? '#fff' : 'rgb(33,30,51)', fontWeight: fecha === d.iso ? 600 : 400 }}>{d.num}</button>
              ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={{ ...sheetBtn(false), flex: 'none', padding: '14px 20px' }}>Cancelar</button>
        <button onClick={guardar} disabled={!puedeGuardar} style={{ ...sheetBtn(true), flex: 1, background: puedeGuardar ? 'rgb(93,84,145)' : 'rgb(199,193,222)', cursor: puedeGuardar ? 'pointer' : 'not-allowed' }}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Sheet>
  );
}

/* ── Pantalla: Notificaciones ──────────────────────────────────── */
const NOTIF_IC = { bell: bellPath, wallet, shield: shieldPath } as const;
/** Cada notificación lleva a la pantalla donde el socio puede hacer algo con ella. */
const NOTIF_DESTINO: Record<'carnet' | 'reintegros' | 'minegocio', Screen> = { carnet: 'carnet', reintegros: 'reintegros', minegocio: 'negocio' };

function Notificaciones({ go, groups, visto, marcarLeidas }: { go: (s: Screen) => void; groups: NotifGroup[]; visto: string | null; marcarLeidas: () => void }) {
  const vistoMs = visto ? new Date(visto).getTime() : 0;
  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22 }}>Notificaciones</div>
        {groups.length > 0 && <button onClick={marcarLeidas} style={{ background: 'none', border: 'none', color: '#5D5491', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: '"DM Sans"' }}>Marcar leídas</button>}
      </div>

      {groups.length === 0 ? (
        <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 18, padding: 26, textAlign: 'center' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgb(240,237,249)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5D5491' }}>{ic(bellPath, false, 22)}</div>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>No tenés notificaciones</div>
          <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)', marginTop: 4, lineHeight: 1.45 }}>Acá te avisamos cuando venza una vacuna, cuando se resuelva un reintegro o cuando aprobemos tu negocio.</div>
        </div>
      ) : groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a29dba', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{g.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {g.items.map((n) => {
              const st = NOTIF_STYLE[n.kind];
              const unread = new Date(n.date).getTime() > vistoMs;
              return (
                <button key={n.id} onClick={() => go(NOTIF_DESTINO[n.to])} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderRadius: 16, padding: '13px 14px', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: '"DM Sans"', background: unread ? '#faf9fd' : '#fff', border: unread ? '1px solid #e6e1f2' : '1px solid #eeecf5' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: st.chip, color: st.color }}>{ic(NOTIF_IC[st.ic], false, 20)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#211E33', marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 12.5, color: '#8781a0', lineHeight: 1.45 }}>{n.body}</div>
                    <div style={{ fontSize: 11, color: '#bdb8cf', marginTop: 5 }}>{n.timeLabel ?? notifTiempo(n.date)}</div>
                  </div>
                  {unread && <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#5D5491', flex: 'none', marginTop: 5 }} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Del prototipo. El push todavía no está implementado, así que el switch
          es decorativo: no hay nada que apagar. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f7f6fa', border: '1px solid #eeecf5', borderRadius: 16, padding: '14px 16px', marginTop: 4 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Push y recordatorios</div>
          <div style={{ fontSize: 12, color: '#a29dba' }}>Vacunas, reintegros y beneficios</div>
        </div>
        <div style={{ width: 44, height: 26, borderRadius: 100, background: '#5D5491', position: 'relative', flex: 'none' }}>
          <span style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
        </div>
      </div>
    </div>
  );
}

function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <h1 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 26, margin: '0 0 8px' }}>{titulo}</h1>
      <p style={{ color: 'rgb(135,129,160)', fontSize: 15 }}>Pantalla en construcción — la estoy portando del prototipo.</p>
    </div>
  );
}

/* ── Shell ─────────────────────────────────────────────────────── */
/** Última vez que el socio miró las notificaciones. No hay tabla: alcanza con el navegador. */
const VISTO_KEY = 'kumo:notif-visto';

export default function AppClient({ profile, pets, reintegros, contacts, providers, benefits, posts, negocio, notifInput }: { profile: Profile; pets: Pet[]; reintegros: Reint[]; contacts: EmergencyContact[]; providers: ProviderVM[]; benefits: BenefitVM[]; posts: ForumPost[]; negocio: MiNegocio | null; notifInput: NotifInput }) {
  const [screen, setScreen] = useState<Screen>('inicio');
  const [petIdx, setPetIdx] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const go = (s: Screen) => { setScreen(s); setNavOpen(false); };
  const reintegradoTotal = reintegros.filter((r) => r.status === 'Acreditado').reduce((a, r) => a + r.refund, 0);
  const current = NAV.find((n) => n.key === screen);

  const notifGroups = useMemo(() => buildNotifs(notifInput), [notifInput]);
  // El "visto" vive en localStorage, así que solo se conoce después de montar:
  // hasta entonces no se pinta el punto, si no el HTML del server no coincide.
  const [visto, setVisto] = useState<string | null>(null);
  const [vistoListo, setVistoListo] = useState(false);
  useEffect(() => { setVisto(localStorage.getItem(VISTO_KEY)); setVistoListo(true); }, []);
  const noLeidas = vistoListo ? contarNoLeidas(notifGroups, visto) : 0;
  const marcarLeidas = () => { const ahora = new Date().toISOString(); localStorage.setItem(VISTO_KEY, ahora); setVisto(ahora); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
      {/* Barra superior (solo abajo de 1024px) */}
      <div className="wa-topbar">
        <button onClick={() => setNavOpen(true)} aria-label="Abrir menú" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'rgb(93,84,145)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" style={{ display: 'block' }}><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
        </button>
        <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 21, color: 'rgb(93,84,145)' }}>Kumo</span>
        <span style={{ fontSize: 13.5, color: 'rgb(91,86,112)', fontWeight: 600, marginLeft: 'auto' }}>{screen === 'notif' ? 'Notificaciones' : current?.label}</span>
      </div>
      {navOpen && <button className="wa-scrim" aria-label="Cerrar menú" onClick={() => setNavOpen(false)} />}
      <div className={navOpen ? 'wa-side wa-side-open' : 'wa-side'} style={{ width: 220, flex: '0 0 auto', borderRight: '1px solid rgb(238,236,245)', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => go('inicio')} style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, color: 'rgb(93,84,145)', padding: '4px 14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>Kumo</button>
        {NAV.map((n) => {
          const active = screen === n.key;
          return (
            <button key={n.key} onClick={() => go(n.key)} className={active ? undefined : 'wa-navitem'} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, width: '100%', textAlign: 'left', transition: 'background 0.15s', background: active ? 'rgb(93,84,145)' : 'none', color: active ? '#fff' : 'rgb(91,86,112)' }}>
              {n.icon}
              <span>{n.label}</span>
            </button>
          );
        })}
      </div>
      <div className="wa-content" style={{ flex: '1 1 0%', overflowY: 'auto', maxHeight: '100vh' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', width: '100%', paddingTop: 16 }}>
          {screen === 'inicio' && <Inicio go={go} petIdx={petIdx} setPetIdx={setPetIdx} pets={pets} profile={profile} noLeidas={noLeidas} />}
          {screen === 'carnet' && <Carnet petIdx={petIdx} setPetIdx={setPetIdx} pets={pets} profile={profile} contacts={contacts} />}
          {screen === 'servicios' && <Servicios go={go} providers={providers} />}
          {screen === 'reintegros' && <Reintegros initialReintegros={reintegros} planName={profile.planName} memberId={profile.id} />}
          {screen === 'beneficios' && <Beneficios benefits={benefits} />}
          {screen === 'foros' && <Foros initialPosts={posts} profile={profile} />}
          {screen === 'negocio' && <Negocio go={go} negocio={negocio} profile={profile} />}
          {screen === 'perfil' && <Perfil go={go} profile={profile} pets={pets} reintegradoTotal={reintegradoTotal} />}
          {screen === 'notif' && <Notificaciones go={go} groups={notifGroups} visto={visto} marcarLeidas={marcarLeidas} />}
        </div>
      </div>
    </div>
  );
}
