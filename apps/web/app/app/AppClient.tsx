'use client';
import type { CSSProperties, FormEvent, ReactNode } from 'react';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  urls, FOTO_TIPOS, FOTO_MAX,
  buildNotifs, contarNoLeidas, notifTiempo, NOTIF_STYLE, type NotifInput, type NotifGroup,
  buildCalMes, buildPickerMes, calMesLabel, calDiaLabel, fmtFechaCorta, hoyISO, CAL_TONE, CAL_DIAS, VACUNA_KINDS, KIND_ICON,
  ratingLabel, reviewTiempo, reintPasos, pasoWhen, REINT_TONE, buildPetHistory,
  HEALTH_Q, SANITARIO_Q, armarDeclaracion, motivoFotoInvalida, rutaFoto,
  type CalCell, type VaccineKind, type Review,
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
type Screen = 'inicio' | 'carnet' | 'servicios' | 'reintegros' | 'beneficios' | 'foros' | 'negocio' | 'perfil' | 'notif' | 'prestar' | 'mismascotas';

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
export type ProviderVM = { id: string; name: string; category: string; zone: string; address: string; phone: string; instagram: string | null; website: string | null; about: string; rating: number; reviews: number; price: number; priceUnit: string; photoUrl: string; km: number; verificado: boolean; badge?: string };
/** La ficha del beneficio necesita todo lo que la tabla ya guardaba y no se usaba:
 *  descripción, zona, días, horario y vigencia. */
export type BenefitVM = {
  id: string; name: string; category: string; discount: string; icon: 'cross' | 'store' | 'tag' | 'droplet';
  description: string; zone: string; days: string[]; hours: string; validUntil: string | null; planRequirement: string;
};
/** El negocio propio del socio: puede estar pendiente de validación o rechazado, así que no sale del listado de prestadores verificados. */
export type MiNegocio = { id: string; name: string; category: string; zone: string; phone: string | null; about: string; status: string; rating: number; reviews: number; price: number | null; priceUnit: string | null; instagram: string | null; website: string | null };
export type ForumAnswer = { id: string; author: string; when: string; text: string; likes: number; best: boolean; propia: boolean };
export type ForumPost = { id: string; cat: string; trend: boolean; author: string; meta: string; title: string; body: string; replies: number; likes: number; answers: ForumAnswer[]; propia: boolean };
/** Lo que likeó el socio, para pintar el corazón y no contar dos veces. */
export type MisLikes = { posts: string[]; answers: string[] };

/** Los planes del club, para el cambio de membresía. */
export type PlanVM = { id: string; name: string; price: number; tagline: string };

/** Datos del socio logueado, resueltos en el Server Component (app/page.tsx). */
/** La cuenta donde el club le transfiere los reintegros. Se pide en el alta y el
 *  formulario de reintegro la prefija, así no se retipea en cada solicitud. */
export type ProfileBanco = { holder: string | null; cuit: string | null; cbu: string | null; alias: string | null };

/** `planPrice` es la cuota que el socio aceptó al firmar (plan + add-ons), no el
 *  precio de lista del plan: con la cobertura odontológica paga $12.000 más. */
export type Profile = { id: string; firstName: string; fullName: string; memberNo: number; planName: string; planPrice: number; addonOdonto: boolean; email: string; phone: string | null; address: string | null; city: string | null; province: string | null; dni: string | null; banco: ProfileBanco; tarjeta: string | null };

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
          {/* El saludo y el nombre quedaban pegados (0 px entre las dos líneas). */}
          <div style={{ fontSize: 13, color: 'rgb(162,157,186)', marginBottom: 3 }}>Hola de nuevo</div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 23, lineHeight: 1.15 }}>{profile.firstName}</div>
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
          <button onClick={() => go('beneficios')} style={{ textAlign: 'left', borderRadius: 12, padding: 14, color: '#fff', cursor: 'pointer', border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 120, background: 'linear-gradient(rgba(33,30,51,0) 30%, rgba(33,30,51,0.75) 100%), url(/img/home-beneficios.webp) center/cover', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Beneficios</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>Descuentos exclusivos</div>
          </button>
        </div>
        <div className="wa-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={() => go('servicios')} style={{ textAlign: 'left', borderRadius: 12, padding: 14, color: '#fff', cursor: 'pointer', border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 120, background: 'linear-gradient(rgba(33,30,51,0) 30%, rgba(33,30,51,0.75) 100%), url(/img/home-servicios.webp) center top/cover', position: 'relative', overflow: 'hidden' }}>
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
/** Posición del pin en el mapa. El mapa es decorativo (no es geografía real: eso
 *  es Google Maps, Fase 4), así que la posición se deriva del id del prestador
 *  para que sea estable entre renders en vez de saltar en cada filtrado. */
function pinPos(id: string): { left: string; top: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return { left: `${18 + (h % 64)}%`, top: `${24 + (Math.floor(h / 64) % 48)}%` };
}
const heartPath = <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1a5.5 5.5 0 0 0-7.8 7.7l1.1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />;
const globePath = <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></>;
const igPath = <><rect x="2" y="2" width="20" height="20" rx="5.5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="#5D5491" stroke="none" /></>;
const pinDropPath = <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>;
const phonePath = <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2z" />;

/* ── Pantalla: detalle del prestador ───────────────────────────── */
/** Portada, identidad, tarifas, contacto y reseñas, con la barra fija de abajo.
 *  Antes tocar un prestador solo desplegaba un acordeón dentro de la lista. */
function PrestadorDetalle({ p, guardado, onGuardar, onVolver, reviews, profile }: { p: ProviderVM; guardado: boolean; onGuardar: () => void; onVolver: () => void; reviews: Review[]; profile: Profile }) {
  const router = useRouter();
  const wa = 'https://wa.me/' + (p.phone ?? '').replace(/\D/g, '');
  const propia = reviews.find((r) => r.propia);
  const [abierta, setAbierta] = useState(false);
  const [estrellas, setEstrellas] = useState(propia?.rating ?? 5);
  const [texto, setTexto] = useState(propia?.text ?? '');
  const [busy, setBusy] = useState(false);

  const guardarReseña = async () => {
    setBusy(true);
    // Una por socio y prestador: si ya opinó, se actualiza la suya.
    await supabase.from('provider_reviews').upsert({
      provider_id: p.id, member_id: profile.id, rating: estrellas,
      text: texto.trim(), author_name: profile.firstName,
    }, { onConflict: 'provider_id,member_id' });
    setAbierta(false);
    router.refresh();
    setBusy(false);
  };
  const borrarReseña = async () => {
    setBusy(true);
    await supabase.from('provider_reviews').delete().eq('provider_id', p.id).eq('member_id', profile.id);
    setAbierta(false);
    router.refresh();
    setBusy(false);
  };
  const estrellasFila = (n: number, onPick?: (v: number) => void) => (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} onClick={onPick ? () => onPick(i) : undefined} style={{ cursor: onPick ? 'pointer' : 'default', lineHeight: 1 }}>
          <svg width={onPick ? 22 : 13} height={onPick ? 22 : 13} viewBox="0 0 24 24" fill={i <= n ? '#f5b301' : 'rgb(230,227,240)'} style={{ display: 'block' }}><path d="M12 3.4 14.6 9l6 .5-4.6 4 1.4 5.9L12 18l-5.4 3.2 1.4-5.9-4.6-4 6-.5z" /></svg>
        </span>
      ))}
    </span>
  );
  const dato = (icono: ReactNode, texto: string, ultimo = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: ultimo ? 'none' : '1px solid rgb(238,236,245)' }}>
      <span style={{ color: '#5D5491', flex: 'none' }}>{ic(icono, false, 19)}</span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{texto}</span>
    </div>
  );
  const contacto = [
    p.website ? { i: globePath, t: p.website } : null,
    p.instagram ? { i: igPath, t: p.instagram } : null,
    p.address ? { i: pinDropPath, t: p.address } : null,
    p.phone ? { i: phonePath, t: p.phone } : null,
  ].filter(Boolean) as { i: ReactNode; t: string }[];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Portada */}
      <div style={{ position: 'relative', height: 132, background: `linear-gradient(135deg, #5D5491, #463f70), url(${p.photoUrl}) center/cover`, backgroundBlendMode: 'darken', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.4))' }} />
        <div style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,251,98,0.25), transparent 70%)' }} />
        <button onClick={onVolver} aria-label="Volver a Servicios" style={{ position: 'absolute', top: 14, left: 16, width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>←</button>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Avatar + identidad */}
        {/* El avatar monta sobre la portada, pero no tanto: con -38 el nombre
            arrancaba justo en el filo de la foto y se leía pegado. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: -26, marginBottom: 14, position: 'relative', zIndex: 3 }}>
          <div style={{ width: 84, height: 84, borderRadius: 24, background: `url(${p.photoUrl}) center/cover, rgb(240,237,249)`, flex: 'none', border: '4px solid #fff', boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }} />
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>{p.name}</span>
              {p.verificado && (
                <span title="Verificado por Kumo" style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgb(93,84,145)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E1FB62" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                </span>
              )}
            </div>
            <div style={{ color: 'rgb(135,129,160)', fontSize: 13.5 }}>{p.category} · {p.zone}</div>
          </div>
        </div>

        {/* Chips de estado. El sello sale del estado real, no está fijo. */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
          {p.verificado && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgb(238,247,214)', color: 'rgb(95,125,16)', fontWeight: 700, fontSize: 11.5, padding: '5px 11px', borderRadius: 100 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5f7d10" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{shieldPath}</svg>Verificado por Kumo
            </span>
          )}
          <span style={{ background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 11.5, padding: '5px 11px', borderRadius: 100 }}>{p.km} km de tu casa</span>
        </div>

        {p.about && <p style={{ fontSize: 14, color: 'rgb(91,86,112)', lineHeight: 1.6, margin: '0 0 18px' }}>{p.about}</p>}

        {/* Servicios y tarifas. La base guarda un precio por prestador, no una
            lista, así que se muestra el que hay en vez de inventar tarifas. */}
        {p.price > 0 && (
          <>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Servicios y tarifas</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 13, padding: '12px 14px', marginBottom: 18 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{p.category}</span>
              <span style={{ fontSize: 14, color: 'rgb(93,84,145)', fontWeight: 700 }}>${p.price.toLocaleString('es-AR')}{p.priceUnit}</span>
            </div>
          </>
        )}

        {contacto.length > 0 && (
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '6px 16px', marginBottom: 18 }}>
            {contacto.map((c, i) => dato(c.i, c.t, i === contacto.length - 1))}
          </div>
        )}

        {/* Reseñas reales: el promedio y el conteo del prestador los recalcula un
            trigger sobre esta misma tabla, así que siempre coinciden. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Reseñas de socios</div>
          {ratingLabel(p.rating, p.reviews) && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'rgb(91,86,112)' }}>
              {star}<strong style={{ color: 'rgb(33,30,51)' }}>{ratingLabel(p.rating, p.reviews)}</strong> · {p.reviews}
            </div>
          )}
        </div>

        {reviews.length === 0 && !abierta && (
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 16, fontSize: 13.5, color: 'rgb(135,129,160)', lineHeight: 1.5, marginBottom: 12 }}>
            Todavía no tiene reseñas. Si lo contrataste, dejá la primera.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ background: r.propia ? 'rgb(240,237,249)' : 'rgb(247,246,250)', border: `1px solid ${r.propia ? 'rgb(224,220,236)' : 'rgb(238,236,245)'}`, borderRadius: 16, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(135,129,160)' }}>{ic(person, false, 16)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.propia ? 'Tu reseña' : r.author}</div>
                  <div style={{ fontSize: 11, color: 'rgb(162,157,186)' }}>{reviewTiempo(r.createdAt)}</div>
                </div>
                {estrellasFila(r.rating)}
              </div>
              {r.text && <div style={{ fontSize: 13, color: 'rgb(91,86,112)', lineHeight: 1.5 }}>{r.text}</div>}
            </div>
          ))}
        </div>

        {abierta ? (
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 14, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{propia ? 'Editar tu reseña' : `¿Cómo te fue con ${p.name}?`}</div>
            <div style={{ marginBottom: 10 }}>{estrellasFila(estrellas, setEstrellas)}</div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Contá tu experiencia (opcional)" style={{ ...sheetInput, resize: 'none', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={guardarReseña} disabled={busy} style={{ ...sheetBtn(true), flex: '1 1 140px', fontSize: 14, padding: 12, opacity: busy ? 0.6 : 1 }}>{busy ? 'Guardando…' : 'Publicar'}</button>
              <button onClick={() => setAbierta(false)} style={{ ...sheetBtn(false), flex: '0 0 auto', fontSize: 14, padding: '12px 16px' }}>Cancelar</button>
              {propia && <button onClick={borrarReseña} disabled={busy} style={{ flex: '0 0 auto', background: 'rgb(251,232,239)', color: 'rgb(193,77,122)', border: 'none', fontWeight: 700, fontSize: 14, padding: '12px 16px', borderRadius: 14, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Borrar</button>}
            </div>
          </div>
        ) : (
          <button onClick={() => { setEstrellas(propia?.rating ?? 5); setTexto(propia?.text ?? ''); setAbierta(true); }} style={{ ...sheetBtn(false), width: '100%', fontSize: 14 }}>
            {propia ? 'Editar tu reseña' : 'Dejar una reseña'}
          </button>
        )}
      </div>

      {/* Barra fija de contacto */}
      <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid rgb(238,236,245)', padding: '14px 20px', display: 'flex', gap: 10, marginTop: 20 }}>
        <a href={wa} target="_blank" rel="noopener" style={{ flex: 1, background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', boxShadow: '0 8px 18px rgba(93,84,145,0.25)' }}>
          {ic(chat, false, 17)}Contactar
        </a>
        <button onClick={onGuardar} aria-label={guardado ? 'Quitar de guardados' : 'Guardar prestador'} style={{ width: 52, background: guardado ? 'rgb(251,232,239)' : 'rgb(225,251,98)', border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={guardado ? '#c14d7a' : 'none'} stroke="#211E33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{heartPath}</svg>
        </button>
      </div>
    </div>
  );
}
const star = <svg width="12" height="12" viewBox="0 0 24 24" fill="#f5b301" style={{ display: 'inline', verticalAlign: -1 }}><path d="M12 3.4 14.6 9l6 .5-4.6 4 1.4 5.9L12 18l-5.4 3.2 1.4-5.9-4.6-4 6-.5z" /></svg>;

function Servicios({ go, providers, initialGuardados, profile, reviews }: { go: (s: Screen) => void; providers: ProviderVM[]; initialGuardados: string[]; profile: Profile; reviews: Record<string, Review[]> }) {
  const memberId = profile.id;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [radio, setRadio] = useState(5);
  const [selId, setSelId] = useState<string | null>(null);
  const [guardados, setGuardados] = useState<string[]>(initialGuardados);
  const ql = q.trim().toLowerCase();

  // Optimista: el corazón responde al toque y la base se actualiza atrás. Si
  // falla, se vuelve atrás para no mentirle al socio.
  const toggleGuardado = async (id: string) => {
    const estaba = guardados.includes(id);
    setGuardados((g) => (estaba ? g.filter((x) => x !== id) : [...g, id]));
    const { error } = estaba
      ? await supabase.from('provider_favorites').delete().eq('member_id', memberId).eq('provider_id', id)
      : await supabase.from('provider_favorites').insert({ member_id: memberId, provider_id: id });
    if (error) setGuardados((g) => (estaba ? [...g, id] : g.filter((x) => x !== id)));
  };

  const sel = providers.find((p) => p.id === selId);
  if (sel) {
    return <PrestadorDetalle p={sel} guardado={guardados.includes(sel.id)} onGuardar={() => toggleGuardado(sel.id)} onVolver={() => setSelId(null)} reviews={reviews[sel.id] ?? []} profile={profile} />;
  }
  const guardadosList = providers.filter((p) => guardados.includes(p.id));
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
        <button onClick={() => go('prestar')} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 7, background: 'rgb(225,251,98)', border: 'none', borderRadius: 13, padding: '10px 14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,251,98,0.4)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          <span style={{ color: 'rgb(33,30,51)', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>Prestar servicio</span>
        </button>
      </div>

      {/* Buscador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgb(247,246,250)', border: '1.5px solid rgb(238,236,245)', borderRadius: 14, padding: '11px 14px', marginBottom: 14 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8781a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paseador, guardería, zona…" style={{ flex: '1 1 0%', border: 'none', outline: 'none', background: 'none', fontSize: 14, fontFamily: '"DM Sans"', color: 'rgb(33,30,51)' }} />
        {q && <button onClick={() => setQ('')} aria-label="Limpiar búsqueda" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(162,157,186)', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>}
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
        {/* Un pin por prestador de la lista filtrada, y se toca para abrir su ficha.
            Antes eran los tres primeros y no hacían nada. */}
        {list.map((p, i) => {
          const pin = catPin(p.category);
          const pos = pinPos(p.id);
          return (
            <button key={p.id} onClick={() => setSelId(p.id)} title={p.name} style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -100%)', zIndex: 2, background: 'none', border: 'none', padding: 0, cursor: 'pointer', animation: 'kpin 0.6s cubic-bezier(0.2,0.8,0.3,1.5) both', animationDelay: `${i * 0.09}s` } as CSSProperties}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 10, padding: '3px 8px', borderRadius: 100, whiteSpace: 'nowrap', boxShadow: '0 3px 8px rgba(0,0,0,0.2)', marginBottom: 3 }}>{p.name}</div>
                <div style={{ width: 30, height: 30, borderRadius: '50% 50% 50% 2px', background: 'rgb(93,84,145)', transform: 'rotate(45deg)', boxShadow: '0 3px 8px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgb(225,251,98)' }}>
                  <span style={{ transform: 'rotate(-45deg)', display: 'flex' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={pin.filled ? '#E1FB62' : 'none'} stroke={pin.filled ? 'none' : '#E1FB62'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{pin.inner}</svg>
                  </span>
                </div>
              </div>
            </button>
          );
        })}
        <div style={{ position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%, -50%)', zIndex: 3 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgb(42,120,214)', border: '3px solid #fff', boxShadow: '0 0 0 6px rgba(42,120,214,0.18)' }} />
        </div>
      </div>

      {/* Guardados */}
      {guardadosList.length > 0 && (
        <div style={{ background: 'rgb(251,232,239)', border: '1px solid rgb(246,213,226)', borderRadius: 18, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#c14d7a" stroke="#c14d7a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{heartPath}</svg>
            <span style={{ fontWeight: 800, fontSize: 14, fontFamily: '"Baloo 2"' }}>Guardados</span>
            <span style={{ background: '#fff', color: 'rgb(193,77,122)', fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 100 }}>{guardadosList.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {guardadosList.map((p) => (
              <button key={p.id} onClick={() => setSelId(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fff', border: 'none', borderRadius: 13, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: '"DM Sans"' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `url(${p.photoUrl}) center/cover, rgb(240,237,249)`, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{p.category} · {p.zone}</div>
                </div>
                <span style={{ color: 'rgb(199,194,218)', fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: 'rgb(135,129,160)' }}><strong style={{ color: 'rgb(33,30,51)' }}>{list.length}</strong> prestadores en {radio} km</span>
        <span style={{ fontSize: 12, color: 'rgb(162,157,186)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a29dba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10M11 12h10M11 19h10M4 5h.01M4 12h.01M4 19h.01" /></svg>Más cercano
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map((p) => (
          <button key={p.id} className="wa-card" onClick={() => setSelId(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 18, padding: 14, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: '"DM Sans"' }}>
            <div style={{ width: 50, height: 50, borderRadius: 15, background: `url(${p.photoUrl}) center/cover, rgb(226,245,234)`, flex: '0 0 auto' }} />
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                {p.badge && <span style={{ background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5 }}>{p.badge}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{p.category} · {p.zone} · <span style={{ color: 'rgb(93,84,145)', fontWeight: 600 }}>{p.km} km</span></div>
              {/* Sin reseñas no se muestra estrella: un "★ 0 (0)" se lee como mala calificación. */}
              <div style={{ fontSize: 12, color: 'rgb(91,86,112)', marginTop: 3 }}>
                {ratingLabel(p.rating, p.reviews) ? <>{star} {ratingLabel(p.rating, p.reviews)} ({p.reviews}) · </> : <span style={{ color: 'rgb(162,157,186)' }}>Sin reseñas · </span>}
                <span style={{ color: 'rgb(93,84,145)', fontWeight: 700 }}>${p.price.toLocaleString('es-AR')}{p.priceUnit}</span>
              </div>
            </div>
            <span style={{ color: 'rgb(199,194,218)', fontSize: 18 }}>›</span>
          </button>
        ))}
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'rgb(162,157,186)', fontSize: 14, lineHeight: 1.5 }}>
            Sin resultados en {radio} km.<br />Ampliá el radio o cambiá de servicio.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Pantalla: Prestar servicio ────────────────────────────────── */
/** "Sumate como prestador", igual que el prototipo. Antes el botón de Servicios
 *  llevaba a "Mi negocio" y el alta era cuatro inputs sueltos dentro de una
 *  tarjeta. Acá el rubro se elige de una grilla con íconos y se puede subir la
 *  foto de portada, que es la que se ve en el listado y en la ficha. */
const RUBRO_ICONS: Record<string, ReactNode> = {
  Paseador: paw,
  Guardería: house,
  Adiestrador: <><path d="M22 9 12 5 2 9l10 4 10-4z" /><path d="M6 11v5c0 1.3 2.7 3 6 3s6-1.7 6-3v-5" /></>,
  'Baño y estética': <path d="M12 3s6 5.7 6 10a6 6 0 0 1-12 0c0-4.3 6-10 6-10z" />,
  Cuidador: person,
};

function Prestar({ go, profile, negocio }: { go: (s: Screen) => void; profile: Profile; negocio: MiNegocio | null }) {
  const router = useRouter();
  const [rubro, setRubro] = useState<string>(RUBROS[0]!);
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState('');
  const [tel, setTel] = useState(profile.phone ?? '');
  const [about, setAbout] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  // Si ya tiene un negocio, no hay alta que hacer: se lo manda a verlo.
  if (negocio && !enviado) {
    return (
      <div style={{ padding: '8px 20px 24px' }}>
        <button onClick={() => go('servicios')} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '6px 0', marginBottom: 6 }}>← Servicios</button>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 2 }}>Ya tenés un negocio</div>
        <p style={{ color: 'rgb(135,129,160)', fontSize: 14, margin: '0 0 18px' }}>Diste de alta &quot;{negocio.name}&quot;. Podés ver su estado y sus datos desde Mi negocio.</p>
        <button onClick={() => go('negocio')} style={{ width: '100%', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 14, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Ir a Mi negocio</button>
      </div>
    );
  }

  const elegirFoto = (f?: File) => {
    if (!f) return;
    if (!FOTO_TIPOS.includes(f.type as (typeof FOTO_TIPOS)[number])) { setError(`Ese formato no lo podemos usar (${f.type || 'desconocido'}). Probá con JPG, PNG o WEBP.`); return; }
    if (f.size > FOTO_MAX) { setError(`La foto pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es 5 MB.`); return; }
    setError('');
    setFoto(f);
    setFotoPreview(URL.createObjectURL(f));
  };

  const enviar = async () => {
    if (!nombre.trim()) { setError('Poné el nombre o la marca de tu servicio.'); return; }
    if (!zona.trim()) { setError('Poné la zona donde trabajás.'); return; }
    setBusy(true); setError('');

    let photoUrl: string | null = null;
    if (foto) {
      const ext = foto.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${profile.id}/negocio-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('pet-photos').upload(path, foto, { contentType: foto.type });
      if (upErr) { setError('No pudimos subir la portada. Probá de nuevo o mandá la solicitud sin foto.'); setBusy(false); return; }
      photoUrl = supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl;
    }

    const { error: insErr } = await supabase.from('providers').insert({
      owner_id: profile.id, name: nombre.trim(), category: rubro, zone: zona.trim(),
      phone: tel.trim() || null, about: about.trim(), photo_url: photoUrl, status: 'pendiente',
    });
    if (insErr) { setError('No pudimos enviar la solicitud. Probá de nuevo.'); setBusy(false); return; }
    setBusy(false);
    setEnviado(true);
    router.refresh();
  };

  if (enviado) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgb(225,251,98)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
        </div>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>Solicitud enviada</div>
        <p style={{ color: 'rgb(91,86,112)', fontSize: 14, lineHeight: 1.55, margin: '0 auto 24px', maxWidth: 420 }}>El club va a <strong>validar los datos de tu negocio</strong> antes de publicarlo. Podés seguir el estado desde <strong>Mi negocio</strong>.</p>
        <button onClick={() => go('negocio')} style={{ width: '100%', maxWidth: 420, background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 14, cursor: 'pointer', marginBottom: 10, fontFamily: '"DM Sans"' }}>Ir a Mi negocio</button>
        <button onClick={() => go('servicios')} style={{ width: '100%', maxWidth: 420, background: 'none', color: 'rgb(135,129,160)', border: 'none', fontWeight: 600, fontSize: 14, padding: 10, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Volver a Servicios</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <button onClick={() => go('servicios')} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '6px 0', marginBottom: 6 }}>← Servicios</button>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 2 }}>Sumate como prestador</div>
      <p style={{ color: 'rgb(135,129,160)', fontSize: 14, margin: '0 0 18px' }}>Elegí tu rubro y contanos sobre tu servicio. El club valida los datos antes de publicarlo.</p>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'rgb(91,86,112)', marginBottom: 8 }}>¿Qué servicio ofrecés?</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {RUBROS.map((r) => {
          const activo = rubro === r;
          return (
            <button key={r} onClick={() => setRubro(r)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 14px', borderRadius: 13, cursor: 'pointer', fontFamily: '"DM Sans"', textAlign: 'left', border: `1.5px solid ${activo ? 'rgb(93,84,145)' : 'rgb(230,227,240)'}`, background: activo ? 'rgb(240,237,249)' : '#fff' }}>
              <span style={{ color: '#5D5491', display: 'flex' }}>{ic(RUBRO_ICONS[r] ?? paw, r === 'Paseador', 19)}</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{r}</span>
            </button>
          );
        })}
      </div>

      <label style={sheetLabel} htmlFor="pr-nombre">Nombre o empresa</label>
      <input id="pr-nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); setError(''); }} placeholder="Ej: Paseos Palermo / Lucas M." style={{ ...sheetInput, marginBottom: 12 }} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={sheetLabel} htmlFor="pr-zona">Zona</label>
          <input id="pr-zona" value={zona} onChange={(e) => { setZona(e.target.value); setError(''); }} placeholder="Palermo, CABA" style={sheetInput} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={sheetLabel} htmlFor="pr-tel">WhatsApp</label>
          <input id="pr-tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+54 11 ..." style={sheetInput} />
        </div>
      </div>

      <label style={sheetLabel} htmlFor="pr-about">Contanos sobre tu servicio</label>
      <textarea id="pr-about" value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="Experiencia, disponibilidad, precios de referencia…" style={{ ...sheetInput, marginBottom: 16, resize: 'none' }} />

      <label style={sheetLabel}>Foto de portada</label>
      <label style={{ position: 'relative', display: 'flex', width: '100%', height: 140, border: '2px dashed rgb(230,227,240)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: fotoPreview ? `url(${fotoPreview}) center/cover` : 'rgb(250,250,249)', cursor: 'pointer', overflow: 'hidden', marginBottom: 18 }}>
        <input type="file" accept={FOTO_TIPOS.join(',')} onChange={(e) => elegirFoto(e.target.files?.[0])} style={{ display: 'none' }} />
        {!fotoPreview && (
          <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center', color: 'rgb(162,157,186)' }}>{ic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>, false, 22)}</div>
            <div style={{ fontSize: 12, color: 'rgb(135,129,160)' }}>Subir portada</div>
          </div>
        )}
      </label>

      {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <button onClick={enviar} disabled={busy} style={{ width: '100%', background: 'rgb(93,84,145)', color: '#fff', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: 14, border: 'none', borderRadius: 14, boxShadow: '0 8px 20px rgba(93,84,145,0.28)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
    </div>
  );
}

/* ── Pantalla: Reintegros ──────────────────────────────────────── */
export type ReintStatus = 'Acreditado' | 'Aprobado' | 'En revisión' | 'Rechazado';
/** El detalle del reintegro necesita bastante más que la tarjeta del historial:
 *  el seguimiento, el comprobante y los datos de acreditación. */
export type Reint = {
  id: string; place: string; concept: string; detail: string; fecha: string;
  spent: number; refund: number; refundPct: number;
  status: ReintStatus; statusRaw: string; requestedOn: string;
  pet: string; receiptNo: string | null; receiptPath: string | null;
  bank: { holder: string | null; dni: string | null; cuit: string | null; name: string | null; cbu: string | null; alias: string | null };
};
const m$ = (n: number) => '$' + n.toLocaleString('es-AR');

const reintTone = (raw: string) => REINT_TONE[raw] ?? REINT_TONE.en_revision!;
const upIcon = <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><line x1="12" y1="5" x2="12" y2="16" /></>;
const infoIcon = <><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12" y2="8" /></>;
const NOTA_REINT = 'Los reintegros se acreditan en tu CVU/CBU en hasta 30 días hábiles. Podés pedir 1 reintegro de consultas cada 2 meses.';

/* ── Detalle de un reintegro ───────────────────────────────────── */
/** Montos, seguimiento, comprobante y datos de acreditación. Antes el historial
 *  no se podía abrir: la tarjeta era el final del camino. */
function ReintegroDetalle({ r, planName, onVolver }: { r: Reint; planName: string; onVolver: () => void }) {
  const [verBusy, setVerBusy] = useState(false);
  const tone = reintTone(r.statusRaw);
  const pasos = reintPasos(r.statusRaw, r.fecha);

  /** El bucket es privado: se pide una URL firmada corta y se abre. */
  const verComprobante = async () => {
    if (!r.receiptPath) return;
    setVerBusy(true);
    const { data } = await supabase.storage.from('receipts').createSignedUrl(r.receiptPath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
    setVerBusy(false);
  };

  const meta: { k: string; v: string }[] = [
    { k: 'Mascota', v: r.pet },
    { k: 'Concepto', v: r.concept },
    ...(r.bank.holder ? [{ k: 'Titular', v: r.bank.holder }] : []),
    ...(r.bank.dni ? [{ k: 'DNI', v: r.bank.dni }] : []),
    ...(r.bank.cuit ? [{ k: 'CUIT / CUIL', v: r.bank.cuit }] : []),
    ...(r.bank.name ? [{ k: 'Banco', v: r.bank.name }] : []),
    ...(r.bank.cbu ? [{ k: 'CBU / CVU destino', v: r.bank.cbu }] : []),
    ...(r.bank.alias ? [{ k: 'Alias', v: r.bank.alias }] : []),
  ];

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <button onClick={onVolver} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '6px 0', marginBottom: 6 }}>← Reintegros</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 21, lineHeight: 1.15 }}>{r.place}</div>
          <div style={{ fontSize: 13, color: 'rgb(162,157,186)', marginTop: 2 }}>{r.concept} · {r.fecha}</div>
        </div>
        <span style={{ background: tone.bg, color: tone.fg, fontWeight: 700, fontSize: 11, padding: '5px 11px', borderRadius: 100, whiteSpace: 'nowrap', marginTop: 2 }}>{r.status}</span>
      </div>

      {/* Montos */}
      <div style={{ background: 'rgb(93,84,145)', borderRadius: 18, padding: '18px 20px', color: '#fff', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
          <div>
            <div style={{ color: 'rgb(201,195,227)', fontSize: 12 }}>{r.statusRaw === 'acreditado' ? 'Reintegro acreditado' : r.statusRaw === 'rechazado' ? 'Reintegro solicitado' : 'Reintegro estimado'}</div>
            <div style={{ fontSize: 11, color: 'rgb(167,159,206)' }}>{r.refundPct}% del gasto · plan {planName}</div>
          </div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 30, color: 'rgb(225,251,98)' }}>{m$(r.refund)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: 'rgb(201,195,227)' }}>Total gastado</span><span style={{ fontWeight: 600 }}>{m$(r.spent)}</span>
        </div>
      </div>

      {/* Seguimiento */}
      <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Seguimiento</div>
        {pasos.map((p, i) => (
          <div key={p.label} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.done ? 'rgb(93,84,145)' : 'rgb(224,220,236)' }}>
                {p.done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>}
              </div>
              {i < pasos.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, background: pasos[i + 1]!.done ? 'rgb(93,84,145)' : 'rgb(224,220,236)' }} />}
            </div>
            <div style={{ paddingBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: p.done ? 'rgb(33,30,51)' : 'rgb(162,157,186)' }}>{p.label}</div>
              <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{pasoWhen(p)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Comprobante */}
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Comprobante</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ width: 48, height: 60, borderRadius: 8, background: 'repeating-linear-gradient(135deg, #ece9f5, #ece9f5 6px, #e2ddf0 6px, #e2ddf0 12px)', border: '1px solid rgb(222,217,236)', flex: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 5 }}>
          <span style={{ fontSize: 8, color: 'rgb(135,129,160)', fontFamily: 'ui-monospace, monospace' }}>{(r.receiptPath?.split('.').pop() ?? 'DOC').toUpperCase().slice(0, 4)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.receiptNo ? `Factura ${r.receiptNo}` : 'Comprobante cargado'}</div>
          <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>Ticket fiscal · {m$(r.spent)}</div>
        </div>
        {r.receiptPath
          ? <button onClick={verComprobante} disabled={verBusy} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: '"DM Sans"' }}>{verBusy ? 'Abriendo…' : 'Ver'}</button>
          : <span style={{ color: 'rgb(162,157,186)', fontSize: 12.5 }}>Sin archivo</span>}
      </div>

      {/* Datos */}
      <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '6px 16px', marginBottom: 16 }}>
        {meta.map((m, i) => (
          <div key={m.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: i === meta.length - 1 ? 'none' : '1px solid rgb(238,236,245)', fontSize: 13.5 }}>
            <span style={{ color: 'rgb(135,129,160)' }}>{m.k}</span><span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{m.v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgb(240,237,249)', borderRadius: 14, padding: '13px 15px' }}>
        <span style={{ color: '#5D5491', flex: 'none', marginTop: 1 }}>{ic(infoIcon, false, 18)}</span>
        <span style={{ fontSize: 12.5, color: 'rgb(91,86,112)', lineHeight: 1.5 }}>{NOTA_REINT}</span>
      </div>
    </div>
  );
}

/* ── Pantalla: Reintegros ──────────────────────────────────────── */
function Reintegros({ initialReintegros, planName, memberId, pets, banco }: { initialReintegros: Reint[]; planName: string; memberId: string; pets: Pet[]; banco: ProfileBanco }) {
  const router = useRouter();
  const items = initialReintegros;
  const [selId, setSelId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [place, setPlace] = useState('');
  const [detail, setDetail] = useState('');
  const [spent, setSpent] = useState('');
  const [petId, setPetId] = useState(pets[0]?.id ?? '');
  // Prefijados con la cuenta del perfil, que se pide en el alta: antes había que
  // retipear titular, CUIT y CBU en cada solicitud.
  const [titular, setTitular] = useState(banco.holder ?? '');
  const [cuit, setCuit] = useState(banco.cuit ?? '');
  const [cbu, setCbu] = useState(banco.cbu ?? banco.alias ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = items.filter((i) => i.status === 'Acreditado').reduce((a, i) => a + i.refund, 0);

  const sel = items.find((i) => i.id === selId);
  if (sel) return <ReintegroDetalle r={sel} planName={planName} onVolver={() => setSelId(null)} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Cargá la factura: sin comprobante el club no puede validar el gasto.'); return; }
    if (!titular.trim() || !cbu.trim()) { setError('Completá el titular y el CBU/CVU o alias: son los datos con los que se acredita.'); return; }
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
      member_id: memberId, pet_id: petId || null, plan_name: planName,
      provider_name: place || 'Comprobante', concept: detail || 'Comprobante',
      amount: s, refund: Math.round(s * 0.5), refund_pct: 50, status: 'en_revision', receipt_path: path,
      bank_holder: titular.trim() || null, bank_cuit: cuit.trim() || null,
      // El alias y el CBU van al mismo campo: el socio pone uno de los dos.
      ...(/^\d{22}$/.test(cbu.replace(/\D/g, '')) ? { bank_cbu: cbu.trim() } : { bank_alias: cbu.trim() }),
    });

    // Si el socio no tenía cuenta en el perfil (se dio de alta antes de que se
    // pidiera), queda guardada para la próxima solicitud y para que el admin la
    // vea en la ficha sin abrir el reintegro.
    if (!insErr && !banco.cbu && !banco.alias) {
      await supabase.from('profiles').update({
        bank_holder: titular.trim() || null,
        bank_cuit: cuit.trim() || null,
        ...(/^\d{22}$/.test(cbu.replace(/\D/g, '')) ? { bank_cbu: cbu.replace(/\D/g, '') } : { bank_alias: cbu.trim() }),
      }).eq('id', memberId);
    }
    if (insErr) {
      // Si falla la solicitud, no dejamos el archivo huérfano en el bucket.
      await supabase.storage.from('receipts').remove([path]);
      setError('No pudimos registrar la solicitud. Probá de nuevo.');
      setBusy(false);
      return;
    }

    setPlace(''); setDetail(''); setSpent(''); setTitular(''); setCuit(''); setCbu(''); setFile(null);
    setOpen(false); setEnviado(true);
    router.refresh();
    setBusy(false);
  };

  const grupo = (t: string) => <div style={{ fontSize: 12, fontWeight: 700, color: 'rgb(135,129,160)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>{t}</div>;

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 16 }}>Reintegros</div>

      <div style={{ background: 'rgb(93,84,145)', borderRadius: 20, padding: 20, marginBottom: 18, textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: 13, color: 'rgb(201,195,227)', marginBottom: 4 }}>Reintegrado este año</div>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 34, color: 'rgb(225,251,98)', lineHeight: 1.1 }}>{m$(total)}</div>
        <div style={{ fontSize: 12, color: 'rgb(201,195,227)' }}>plan {planName}</div>
      </div>

      {!open && !enviado && (
        <button onClick={() => setOpen(true)} style={{ width: '100%', background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 14, cursor: 'pointer', marginBottom: 20 }}>+ Subir factura</button>
      )}

      {enviado && (
        <div style={{ background: 'rgb(238,247,214)', border: '1.5px solid rgb(211,232,154)', borderRadius: 18, padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgb(225,251,98)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'rgb(63,84,16)' }}>Solicitud enviada</div>
            <div style={{ fontSize: 13, color: 'rgb(95,125,16)' }}>La revisamos y acreditamos en tu CBU/CVU en hasta 30 días hábiles.</div>
          </div>
          <button onClick={() => setEnviado(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(95,125,16)', fontSize: 18, lineHeight: 1, padding: 0 }}>✕</button>
        </div>
      )}

      {open && (
        <form onSubmit={submit} style={{ background: 'rgb(247,246,250)', border: '1.5px solid rgb(230,227,240)', borderRadius: 18, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Solicitar reintegro</div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(162,157,186)', fontSize: 20, lineHeight: 1, padding: 0 }}>✕</button>
          </div>

          {grupo('Comprobante')}
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px dashed rgb(201,195,227)', borderRadius: 14, padding: 22, background: '#fff', cursor: 'pointer', marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5D5491' }}>{ic(upIcon, false, 22)}</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{file ? file.name : 'Cargá la factura'}</div>
              <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>Foto o PDF del ticket fiscal</div>
            </div>
            <input type="file" accept="image/*,.pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); }} style={{ display: 'none' }} />
          </label>

          {/* Estos tres no están en el prototipo, pero sin ellos el club no sabe
              de qué gasto se trata ni cuánto reintegrar. */}
          {grupo('Datos del gasto')}
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Veterinaria o comercio" style={{ ...sheetInput, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Concepto (ej: Consulta)" style={{ ...sheetInput, flex: '1 1 150px', width: 'auto' }} />
            <input value={spent} onChange={(e) => setSpent(e.target.value)} type="number" inputMode="numeric" placeholder="Monto gastado" style={{ ...sheetInput, flex: '1 1 120px', width: 'auto' }} />
          </div>
          {pets.length > 1 && (
            <select value={petId} onChange={(e) => setPetId(e.target.value)} style={{ ...sheetInput, marginBottom: 16 }}>
              {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {grupo('Datos para la acreditación')}
          <label style={sheetLabel} htmlFor="re-tit">Titular / Alias</label>
          <input id="re-tit" value={titular} onChange={(e) => { setTitular(e.target.value); setError(''); }} placeholder="Nombre del titular de la cuenta" style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel} htmlFor="re-cuit">CUIT / CUIL</label>
          <input id="re-cuit" value={cuit} onChange={(e) => setCuit(e.target.value)} inputMode="numeric" placeholder="20-12345678-9" style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel} htmlFor="re-cbu">CBU / CVU o alias</label>
          <input id="re-cbu" value={cbu} onChange={(e) => { setCbu(e.target.value); setError(''); }} placeholder="0000003100010000000001 o mi.alias.mp" style={{ ...sheetInput, marginBottom: 16 }} />

          {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ width: '100%', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: '"DM Sans"' }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
        </form>
      )}

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Historial</div>
      {items.length === 0 ? (
        <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 18, padding: 26, textAlign: 'center' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgb(240,237,249)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5D5491' }}>{ic(wallet, false, 22)}</div>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>Todavía no pediste ningún reintegro</div>
          <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)', marginTop: 4, lineHeight: 1.45 }}>Subí la factura de una consulta, vacuna o estudio y te devolvemos la parte que cubre tu plan.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it) => {
            const tone = reintTone(it.statusRaw);
            return (
              <button key={it.id} className="wa-card" onClick={() => setSelId(it.id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 14, cursor: 'pointer', fontFamily: '"DM Sans"' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{it.place}</div>
                    <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{it.concept} · {it.fecha}</div>
                  </div>
                  <span style={{ background: tone.bg, color: tone.fg, fontWeight: 600, fontSize: 11, padding: '4px 9px', borderRadius: 100, whiteSpace: 'nowrap' }}>{it.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: 'rgb(135,129,160)' }}>Gastado {m$(it.spent)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, color: 'rgb(93,84,145)' }}>Reintegro {m$(it.refund)}</span>
                    <span style={{ color: 'rgb(199,194,218)', fontSize: 16 }}>›</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Pantalla: Beneficios ──────────────────────────────────────── */
const crossIcon = <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>;
const storeIcon = <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>;
const tagIcon = <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.2" /></>;
const dropletIcon = <path d="M12 3s6 5.7 6 10a6 6 0 0 1-12 0c0-4.3 6-10 6-10z" />;
const benefitIcons: Record<BenefitVM['icon'], ReactNode> = { cross: crossIcon, store: storeIcon, tag: tagIcon, droplet: dropletIcon };

/** Los mismos que el prototipo y que guarda la base: una letra por día, con X
 *  para miércoles. Comparar contra "Lun/Mar/Mié" no encendía ningún chip. */
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const relojIcon = <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>;
const calIcon = <><rect x="3" y="5" width="18" height="16" rx="2.5" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>;

/* ── Ficha del beneficio ───────────────────────────────────────── */
/** La hoja del prototipo. Antes las filas tenían `cursor:pointer` y no abrían
 *  nada, y los datos que la tabla ya guardaba (días, horario, vigencia) no se
 *  mostraban en ningún lado. */
function BeneficioFicha({ b, onClose, onCarnet }: { b: BenefitVM; onClose: () => void; onCarnet: () => void }) {
  const activos = new Set(b.days);
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#5D5491' }}>{ic(benefitIcons[b.icon], false, 22)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18 }}>{b.name}</div>
          <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)' }}>{b.category}</div>
        </div>
        <button onClick={onClose} aria-label="Cerrar" style={{ background: 'rgb(240,237,249)', border: 'none', width: 32, height: 32, borderRadius: 10, cursor: 'pointer', color: '#5D5491', fontSize: 15, flex: 'none' }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: 'rgb(247,246,250)', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'rgb(135,129,160)', marginBottom: 4 }}>Descuento</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#5D5491' }}>{b.discount}</div>
        </div>
        <div style={{ flex: 1, background: 'rgb(247,246,250)', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'rgb(135,129,160)', marginBottom: 4 }}>Plan mínimo</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 3 }}>{b.planRequirement}</div>
        </div>
      </div>

      {b.zone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgb(247,246,250)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <span style={{ color: '#5D5491', flex: 'none' }}>{ic(pinDropPath, false, 18)}</span>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgb(74,69,96)' }}>{b.zone}</div>
        </div>
      )}

      {(b.days.length > 0 || b.hours || b.validUntil) && (
        <div style={{ background: 'rgb(247,246,250)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
          {b.days.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'rgb(135,129,160)', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>Días con descuento</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {DIAS_SEMANA.map((d) => {
                  const on = activos.has(d);
                  return <span key={d} style={{ width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none', background: on ? 'rgb(93,84,145)' : 'rgb(238,236,245)', color: on ? '#fff' : 'rgb(194,188,214)' }}>{d}</span>;
                })}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {b.hours && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ color: 'rgb(135,129,160)', flex: 'none' }}>{ic(relojIcon, false, 15)}</span>
                <span style={{ fontSize: 13, color: 'rgb(74,69,96)', fontWeight: 600 }}>{b.hours}</span>
              </div>
            )}
            {b.validUntil && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ color: 'rgb(135,129,160)', flex: 'none' }}>{ic(calIcon, false, 15)}</span>
                <span style={{ fontSize: 13, color: 'rgb(74,69,96)', fontWeight: 600 }}>Hasta {fmtFechaCorta(b.validUntil)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ background: 'rgb(247,246,250)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'rgb(135,129,160)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>¿Cómo usar?</div>
        <div style={{ fontWeight: 500, fontSize: 13.5, lineHeight: 1.6, color: 'rgb(74,69,96)' }}>
          {b.description || `Presentá tu carnet digital en ${b.name} para acceder al descuento. Si no tenés el carnet a mano, podés mostrar esta pantalla.`}
        </div>
      </div>

      <button onClick={onCarnet} style={{ ...sheetBtn(true), width: '100%' }}>Mostrar carnet →</button>
    </Sheet>
  );
}

function Beneficios({ benefits, go }: { benefits: BenefitVM[]; go: (s: Screen) => void }) {
  const [q, setQ] = useState('');
  const [buscado, setBuscado] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const ql = buscado.trim().toLowerCase();
  const list = benefits.filter((b) => !ql || `${b.name} ${b.category} ${b.zone}`.toLowerCase().includes(ql));
  const sel = benefits.find((b) => b.id === selId);
  const buscar = () => setBuscado(q);
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
        {/* Un pin por beneficio de la lista, tocable y con la pulsación del
            prototipo. Antes eran cinco pines fijos que no representaban nada. */}
        {list.map((b, i) => {
          const pos = pinPos(b.id);
          return (
            <button key={b.id} onClick={() => setSelId(b.id)} title={`${b.name} · ${b.discount}`} style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -100%)', zIndex: 2, background: 'none', border: 'none', padding: 0, cursor: 'pointer', animation: 'kpin 0.6s cubic-bezier(0.2,0.8,0.3,1.5) both', animationDelay: `${i * 0.08}s` } as CSSProperties}>
              <div style={{ width: 30, height: 30, borderRadius: '50% 50% 50% 2px', background: 'rgb(93,84,145)', transform: 'rotate(45deg)', boxShadow: '0 3px 8px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgb(225,251,98)', animation: 'kpulse 2.4s ease-in-out infinite', animationDelay: `${i * 0.08}s` } as CSSProperties}>
                <span style={{ transform: 'rotate(-45deg)', color: 'rgb(225,251,98)', fontWeight: 800, fontSize: 13 }}>%</span>
              </div>
            </button>
          );
        })}
        {/* El punto azul aparece recién cuando el socio buscó, como en el prototipo. */}
        {buscado && (
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 3 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgb(42,120,214)', border: '3px solid #fff', boxShadow: '0 0 0 6px rgba(42,120,214,0.2)' }} />
          </div>
        )}
      </div>

      {/* Buscar dirección */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: '1 1 0%', display: 'flex', alignItems: 'center', gap: 9, background: 'rgb(247,246,250)', border: '1.5px solid rgb(238,236,245)', borderRadius: 14, padding: '11px 14px' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8781a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></svg>
          {/* No hay geolocalización: los beneficios no tienen coordenadas (solo
              zona), así que se busca por zona, nombre o rubro. */}
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }} placeholder="Buscá por zona, local o rubro" style={{ flex: '1 1 0%', border: 'none', outline: 'none', background: 'none', fontSize: 14, fontFamily: '"DM Sans"', color: 'rgb(33,30,51)' }} />
          {buscado && <button onClick={() => { setQ(''); setBuscado(''); }} aria-label="Limpiar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(162,157,186)', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>}
        </div>
        <button onClick={buscar} style={{ flex: '0 0 auto', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, padding: '0 22px', borderRadius: 14, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Buscar</button>
      </div>

      {buscado && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Beneficios en «{buscado}»</div>}

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
          <button key={b.id} className="wa-card" onClick={() => setSelId(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '12px 14px', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: '"DM Sans"' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', border: '1px solid rgb(238,236,245)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', color: '#5D5491' }}>
              {ic(benefitIcons[b.icon], false, 21)}
            </div>
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'rgb(33,30,51)' }}>{b.name}</div>
              <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{b.category}{b.zone ? ` · ${b.zone}` : ''}</div>
            </div>
            <span style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontWeight: 700, fontSize: 14, padding: '6px 12px', borderRadius: 9, flex: '0 0 auto' }}>{b.discount}</span>
          </button>
        ))}
        {list.length === 0 && (
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 18, padding: 26, textAlign: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgb(240,237,249)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5D5491' }}>{ic(tagIcon, false, 22)}</div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{buscado ? `Sin beneficios para «${buscado}»` : 'Todavía no hay beneficios activos'}</div>
            <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)', marginTop: 4, lineHeight: 1.45 }}>{buscado ? 'Probá con otra zona o rubro.' : 'El club los va cargando a medida que suma comercios a la red.'}</div>
          </div>
        )}
      </div>

      {sel && <BeneficioFicha b={sel} onClose={() => setSelId(null)} onCarnet={() => { setSelId(null); go('carnet'); }} />}
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
  // Faltaba: el chip "Alimentación" existía en los filtros pero se caía al tono
  // de Salud, así que un post de esa categoría se veía con el color equivocado.
  Alimentación: { iconBg: 'rgb(95,125,16)', icon: storeIcon, tagBg: 'rgb(238,247,214)', tagFg: 'rgb(95,125,16)' },
};
const foroChips = ['Todos', 'Paseadores', 'Salud', 'Guarderías', 'Adiestramiento', 'Alimentación', 'Cruzas', 'Razas'];

const sendIcon = <><line x1="12" y1="19" x2="12" y2="5" /><path d="M5 12l7-7 7 7" /></>;
const fotoIcon = <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>;

/* ── Hilo del foro ─────────────────────────────────────────────── */
/** El hilo del prototipo: post original, me gusta, respuestas y la caja para
 *  responder. Antes el hilo era un acordeón de solo lectura dentro de la tarjeta:
 *  no se podía responder ni dar me gusta de verdad. */
function Hilo({ p, profile, misLikes, onVolver }: { p: ForumPost; profile: Profile; misLikes: MisLikes; onVolver: () => void }) {
  const router = useRouter();
  const cfg = catCfg[p.cat] ?? catCfg.Salud!;
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [likes, setLikes] = useState({ post: misLikes.posts.includes(p.id), answers: new Set(misLikes.answers) });

  /** Optimista: el corazón responde al toque y la base va atrás. */
  const togglePostLike = async () => {
    const estaba = likes.post;
    setLikes((s) => ({ ...s, post: !estaba }));
    const { error } = estaba
      ? await supabase.from('post_likes').delete().eq('member_id', profile.id).eq('post_id', p.id)
      : await supabase.from('post_likes').insert({ member_id: profile.id, post_id: p.id });
    if (error) setLikes((s) => ({ ...s, post: estaba }));
    else router.refresh();
  };
  const toggleAnswerLike = async (id: string) => {
    const estaba = likes.answers.has(id);
    setLikes((s) => { const n = new Set(s.answers); estaba ? n.delete(id) : n.add(id); return { ...s, answers: n }; });
    const { error } = estaba
      ? await supabase.from('answer_likes').delete().eq('member_id', profile.id).eq('answer_id', id)
      : await supabase.from('answer_likes').insert({ member_id: profile.id, answer_id: id });
    if (error) setLikes((s) => { const n = new Set(s.answers); estaba ? n.add(id) : n.delete(id); return { ...s, answers: n }; });
    else router.refresh();
  };

  const responder = async (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setBusy(true);
    // El contador `replies` lo actualiza el trigger, no se toca desde acá.
    await supabase.from('community_answers').insert({
      post_id: p.id, author_id: profile.id, author_name: profile.firstName, text: texto.trim(),
    });
    setTexto('');
    router.refresh();
    setBusy(false);
  };

  /** Borra una respuesta propia. El contador `replies` lo baja el trigger. */
  const borrarRespuesta = async (id: string) => {
    if (!confirm('¿Borrar tu respuesta? No se puede deshacer.')) return;
    setBusy(true);
    const { error } = await supabase.from('community_answers').delete().eq('id', id);
    if (error) alert('No pudimos borrar la respuesta. Probá de nuevo.');
    else router.refresh();
    setBusy(false);
  };

  /**
   * Borra la publicación propia. Se avisa cuántas respuestas se lleva: la clave
   * ajena de `community_answers` es ON DELETE CASCADE, así que arrastra también
   * lo que escribieron otros socios. Borrar el trabajo de otra persona sin
   * decirlo sería peor que no poder borrar.
   */
  const borrarPost = async () => {
    const conRespuestas = p.answers.length > 0
      ? ` Se van a borrar también las ${p.answers.length} respuesta${p.answers.length === 1 ? '' : 's'} que escribieron otros.`
      : '';
    if (!confirm(`¿Borrar tu publicación?${conRespuestas} No se puede deshacer.`)) return;
    setBusy(true);
    const { error } = await supabase.from('community_posts').delete().eq('id', p.id);
    if (error) { alert('No pudimos borrar la publicación. Probá de nuevo.'); setBusy(false); return; }
    onVolver();
    router.refresh();
  };

  const likesPost = p.likes + (likes.post && !misLikes.posts.includes(p.id) ? 1 : 0) - (!likes.post && misLikes.posts.includes(p.id) ? 1 : 0);

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '6px 0' }}>← Comunidad</button>
        {p.propia && (
          <button onClick={borrarPost} disabled={busy} style={{ background: 'none', border: 'none', color: 'rgb(176,72,63)', fontWeight: 600, fontSize: 13, cursor: busy ? 'default' : 'pointer', padding: '6px 0' }}>
            Borrar publicación
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: cfg.tagBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: cfg.tagFg }}>{ic(person, false, 19)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{p.author}</div>
          <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{p.meta}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.tagFg, background: cfg.tagBg, padding: '3px 9px', borderRadius: 6 }}>{p.cat}</span>
      </div>

      <h1 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, lineHeight: 1.2, margin: '0 0 10px' }}>{p.title}</h1>
      <p style={{ fontSize: 14, color: 'rgb(74,69,96)', lineHeight: 1.6, margin: '0 0 14px' }}>{p.body}</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <button onClick={togglePostLike} style={{ display: 'flex', alignItems: 'center', gap: 7, background: likes.post ? 'rgb(251,232,239)' : 'rgb(240,237,249)', border: 'none', color: likes.post ? 'rgb(192,72,99)' : 'rgb(93,84,145)', fontWeight: 600, fontSize: 13, padding: '9px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: '"DM Sans"' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={likes.post ? '#c04863' : '#5D5491'}>{heartFill}</svg>
          Me gusta · {likesPost}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.answers.length} {p.answers.length === 1 ? 'respuesta' : 'respuestas'}</div>
        <div style={{ flex: 1, height: 1, background: 'rgb(238,236,245)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {p.answers.map((a) => {
          const yo = likes.answers.has(a.id);
          const n = a.likes + (yo && !misLikes.answers.includes(a.id) ? 1 : 0) - (!yo && misLikes.answers.includes(a.id) ? 1 : 0);
          return (
            <div key={a.id} style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgb(236,233,245)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#5D5491', flex: 'none' }}>{a.author.slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, borderTopLeftRadius: 4, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{a.propia ? 'Vos' : a.author}</span>
                    {a.best && <span style={{ fontSize: 10, fontWeight: 700, color: 'rgb(47,143,91)', background: 'rgb(226,245,234)', padding: '2px 7px', borderRadius: 6 }}>★ Mejor respuesta</span>}
                    <span style={{ fontSize: 11, color: 'rgb(162,157,186)', marginLeft: 'auto' }}>{a.when}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'rgb(74,69,96)', lineHeight: 1.55 }}>{a.text}</div>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 6, paddingLeft: 4 }}>
                  <button onClick={() => toggleAnswerLike(a.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: yo ? 'rgb(192,72,99)' : 'rgb(135,129,160)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: '"DM Sans"' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={yo ? '#c04863' : 'none'} stroke={yo ? '#c04863' : '#8781a0'} strokeWidth="2">{heartFill}</svg>{n}
                  </button>
                  {a.propia && (
                    <button onClick={() => borrarRespuesta(a.id)} style={{ fontSize: 12, color: 'rgb(135,129,160)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: '"DM Sans"' }}>
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {p.answers.length === 0 && (
          <div style={{ fontSize: 13.5, color: 'rgb(135,129,160)', lineHeight: 1.5 }}>Todavía no hay respuestas. Sé la primera persona en responder.</div>
        )}
      </div>

      <form onSubmit={responder} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 18, background: '#fff', border: '1.5px solid rgb(230,227,240)', borderRadius: 100, padding: '5px 5px 5px 16px' }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí una respuesta…" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'none', color: 'rgb(33,30,51)', fontFamily: '"DM Sans"' }} />
        <button type="submit" disabled={busy || !texto.trim()} aria-label="Enviar respuesta" style={{ width: 38, height: 38, borderRadius: '50%', background: texto.trim() ? 'rgb(93,84,145)' : 'rgb(199,193,222)', border: 'none', cursor: texto.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#fff' }}>
          {ic(sendIcon, false, 18)}
        </button>
      </form>
    </div>
  );
}

/* ── Nueva publicación ─────────────────────────────────────────── */
/** La pantalla del prototipo: categoría en chips, título, cuerpo, foto opcional
 *  y el estado "¡Publicado!". Antes era un formulario de dos inputs metido arriba
 *  del listado, y la categoría salía del filtro activo. */
function Componer({ profile, onVolver }: { profile: Profile; onVolver: () => void }) {
  const router = useRouter();
  const cats = foroChips.filter((c) => c !== 'Todos');
  const [cat, setCat] = useState(cats[0]!);
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  // La zona del post es la localidad, no la calle: antes prefijaba el domicilio
  // completo porque era la única columna que había.
  const [zona, setZona] = useState(profile.city ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  const publicar = async () => {
    if (!titulo.trim()) { setError('Ponele un título a tu publicación.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('community_posts').insert({
      author_id: profile.id, author_name: profile.firstName, category: cat,
      title: titulo.trim(), body: cuerpo.trim() || titulo.trim(), zone: zona.trim() || null,
    });
    if (e) { setError('No pudimos publicar. Probá de nuevo.'); setBusy(false); return; }
    setBusy(false);
    setListo(true);
    router.refresh();
  };

  if (listo) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgb(225,251,98)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>¡Publicado!</div>
        <p style={{ color: 'rgb(91,86,112)', fontSize: 14, lineHeight: 1.55, margin: '0 auto 24px', maxWidth: 420 }}>Tu publicación ya está en la comunidad. Te avisamos cuando alguien responda.</p>
        <button onClick={onVolver} style={{ ...sheetBtn(true), width: '100%', maxWidth: 420 }}>Volver a la comunidad</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <button onClick={onVolver} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '6px 0', marginBottom: 6 }}>← Comunidad</button>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 2 }}>Nueva publicación</div>
      <p style={{ color: 'rgb(135,129,160)', fontSize: 14, margin: '0 0 18px' }}>Compartí tu experiencia o hacé una pregunta a la comunidad.</p>

      <label style={sheetLabel}>Categoría</label>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} style={{ border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 100, whiteSpace: 'nowrap', background: cat === c ? 'rgb(93,84,145)' : 'rgb(240,237,249)', color: cat === c ? '#fff' : 'rgb(93,84,145)' }}>{c}</button>
        ))}
      </div>

      <label style={sheetLabel} htmlFor="fo-tit">Título</label>
      <input id="fo-tit" value={titulo} onChange={(e) => { setTitulo(e.target.value); setError(''); }} placeholder="Ej: ¿Alguien probó a Lucas de Paseos Palermo?" style={{ ...sheetInput, marginBottom: 12 }} />

      <label style={sheetLabel} htmlFor="fo-body">Contanos más</label>
      <textarea id="fo-body" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={5} placeholder="Escribí tu consulta o experiencia…" style={{ ...sheetInput, resize: 'none', marginBottom: 12 }} />

      <label style={sheetLabel} htmlFor="fo-zona">Zona <span style={{ fontWeight: 400, color: 'rgb(162,157,186)' }}>· opcional</span></label>
      <input id="fo-zona" value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Palermo, CABA" style={{ ...sheetInput, marginBottom: 18 }} />

      {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <button onClick={publicar} disabled={busy} style={{ ...sheetBtn(true), width: '100%', boxShadow: '0 8px 20px rgba(93,84,145,0.28)', opacity: busy ? 0.6 : 1 }}>{busy ? 'Publicando…' : 'Publicar'}</button>
    </div>
  );
}

/* ── Pantalla: Foros / Comunidad ───────────────────────────────── */
function Foros({ initialPosts, profile, misLikes }: { initialPosts: ForumPost[]; profile: Profile; misLikes: MisLikes }) {
  const posts = initialPosts;
  const [vista, setVista] = useState<'lista' | 'componer'>('lista');
  const [hiloId, setHiloId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todos');
  const [zona, setZona] = useState('Todas');

  // Las zonas salen de lo que publicaron los socios, no de una lista fija.
  const zonas = ['Todas', ...Array.from(new Set(posts.map((p) => p.meta.split(' · ')[0]!).filter((z) => z && z !== 'General')))];

  const ql = q.trim().toLowerCase();
  const list = posts.filter((p) => {
    if (cat !== 'Todos' && p.cat !== cat) return false;
    if (zona !== 'Todas' && !p.meta.startsWith(zona)) return false;
    if (ql && !`${p.title} ${p.body} ${p.author}`.toLowerCase().includes(ql)) return false;
    return true;
  });

  const hilo = posts.find((p) => p.id === hiloId);
  if (hilo) return <Hilo p={hilo} profile={profile} misLikes={misLikes} onVolver={() => setHiloId(null)} />;
  if (vista === 'componer') return <Componer profile={profile} onVolver={() => setVista('lista')} />;

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22 }}>Comunidad</div>
        <button onClick={() => setVista('componer')} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, padding: '8px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: '"DM Sans"' }}>+ Publicar</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1.5px solid rgb(230,227,240)', borderRadius: 14, padding: '11px 14px', marginBottom: 12 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a29dba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la comunidad…" style={{ flex: '1 1 0%', border: 'none', outline: 'none', background: 'none', fontSize: 14, fontFamily: '"DM Sans"', color: 'rgb(33,30,51)' }} />
        {q && <button onClick={() => setQ('')} aria-label="Limpiar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(162,157,186)', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>}
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 8 }}>
        {foroChips.map((c) => {
          const active = cat === c;
          return <button key={c} onClick={() => setCat(c)} style={{ border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 100, whiteSpace: 'nowrap', background: active ? 'rgb(93,84,145)' : 'rgb(240,237,249)', color: active ? '#fff' : 'rgb(93,84,145)' }}>{c}</button>;
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '4px 0 14px' }}>
        <span style={{ fontSize: 12.5, color: 'rgb(162,157,186)' }}>{list.length} {list.length === 1 ? 'publicación' : 'publicaciones'}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 100, padding: '7px 12px', cursor: 'pointer', flex: 'none' }}>
          <span style={{ color: '#5D5491', display: 'flex', flex: 'none' }}>{ic(pinDropPath, false, 14)}</span>
          <select value={zona} onChange={(e) => setZona(e.target.value)} style={{ border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: '#5D5491', fontFamily: '"DM Sans"', outline: 'none', cursor: 'pointer' }}>
            {zonas.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <div style={{ background: 'rgb(247,246,250)', border: '1px dashed rgb(222,216,240)', borderRadius: 18, padding: '30px 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 16, marginBottom: 5 }}>{posts.length === 0 ? 'La comunidad está arrancando' : 'Sin resultados'}</div>
          <div style={{ fontSize: 13.5, color: 'rgb(135,129,160)', lineHeight: 1.5 }}>{posts.length === 0 ? 'Todavía no hay publicaciones. Hacé la primera pregunta.' : 'Probá con otra búsqueda, categoría o zona.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((p) => {
            const cfg = catCfg[p.cat] ?? catCfg.Salud!;
            const relleno = p.cat === 'Paseadores' || p.cat === 'Cruzas';
            return (
              <button key={p.id} className="wa-card" onClick={() => setHiloId(p.id)} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', background: '#fff', border: '1px solid rgb(240,238,247)', borderRadius: 20, padding: 16, cursor: 'pointer', boxShadow: '0 6px 20px rgba(93,84,145,0.07)', width: '100%', textAlign: 'left', fontFamily: '"DM Sans"' }}>
                <div style={{ width: 52, height: 52, borderRadius: 15, background: cfg.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill={relleno ? '#fff' : 'none'} stroke={relleno ? 'none' : '#fff'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{cfg.icon}</svg>
                </div>
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.tagFg, background: cfg.tagBg, padding: '3px 10px', borderRadius: 100 }}>{p.cat}</span>
                    {p.trend && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.03em', whiteSpace: 'nowrap', color: 'rgb(33,30,51)', background: 'rgb(225,251,98)', padding: '3px 9px', borderRadius: 100 }}>EN TENDENCIA</span>}
                    <span style={{ fontSize: 11.5, color: 'rgb(162,157,186)' }}>{p.author} · {p.meta}</span>
                  </div>
                  <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: 'rgb(33,30,51)', marginBottom: 5 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: 'rgb(135,129,160)', lineHeight: 1.5, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as CSSProperties}>{p.body}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 12, padding: '6px 12px', borderRadius: 100 }}>
                      {ic(chat, false, 14)}{p.replies}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgb(251,233,238)', color: 'rgb(192,72,99)', fontWeight: 700, fontSize: 12, padding: '6px 12px', borderRadius: 100 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#c04863">{heartFill}</svg>{p.likes}
                    </span>
                    <span style={{ marginLeft: 'auto', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 12.5 }}>Ver hilo ›</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Pantalla: Mi negocio ──────────────────────────────────────── */
const RUBROS = ['Paseador', 'Guardería', 'Adiestrador', 'Baño y estética', 'Cuidador'];

function Negocio({ go, negocio, profile, misReviews }: { go: (s: Screen) => void; negocio: MiNegocio | null; profile: Profile; misReviews: Review[] }) {
  const router = useRouter();
  const [showAlta, setShowAlta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rubro, setRubro] = useState(RUBROS[0]!);
  const [zona, setZona] = useState('');
  const [tel, setTel] = useState(profile.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [bajaOpen, setBajaOpen] = useState(false);
  // Datos editables del negocio publicado.
  const [ed, setEd] = useState({
    name: negocio?.name ?? '', category: negocio?.category ?? RUBROS[0]!, zone: negocio?.zone ?? '',
    phone: negocio?.phone ?? '', about: negocio?.about ?? '',
    price: negocio?.price ? String(negocio.price) : '', priceUnit: negocio?.priceUnit ?? '',
    instagram: negocio?.instagram ?? '', website: negocio?.website ?? '',
  });

  const guardarEdicion = async () => {
    if (!negocio) return;
    if (!ed.name.trim() || !ed.zone.trim()) { setError('El nombre y la zona no pueden quedar vacíos.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('providers').update({
      name: ed.name.trim(), category: ed.category, zone: ed.zone.trim(),
      phone: ed.phone.trim() || null, about: ed.about.trim(),
      price: Number(ed.price.replace(/\D/g, '')) || null, price_unit: ed.priceUnit.trim() || null,
      instagram: ed.instagram.trim() || null, website: ed.website.trim() || null,
    }).eq('id', negocio.id);
    if (e) { setError('No pudimos guardar los cambios. Probá de nuevo.'); setBusy(false); return; }
    setEditOpen(false);
    router.refresh();
    setBusy(false);
  };

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

          {/* Reseñas que le dejaron a su negocio. Son las mismas que ve un socio
              en la ficha del prestador, leídas de `provider_reviews`. */}
          <div style={{ fontWeight: 700, fontSize: 15, margin: '18px 0 10px' }}>Reseñas de clientes</div>
          {misReviews.length === 0 ? (
            <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 18, fontSize: 13.5, color: 'rgb(135,129,160)', lineHeight: 1.5, marginBottom: 14 }}>Todavía no te dejaron reseñas. Cuando un socio te contrate y opine, aparecen acá.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {misReviews.map((r) => (
                <div key={r.id} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.author}</span>
                    <span style={{ fontSize: 12, color: '#f5b301' }}>{'★'.repeat(r.rating)}</span>
                    <span style={{ fontSize: 11, color: 'rgb(162,157,186)', marginLeft: 'auto' }}>{reviewTiempo(r.createdAt)}</span>
                  </div>
                  {r.text && <div style={{ fontSize: 13, color: 'rgb(91,86,112)', lineHeight: 1.5 }}>{r.text}</div>}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => setEditOpen(true)} style={{ ...sheetBtn(true), width: '100%', fontSize: 14 }}>Editar datos</button>
            <button onClick={() => go('servicios')} style={{ ...sheetBtn(false), width: '100%', fontSize: 14 }}>Ver perfil público</button>
            <button onClick={() => setBajaOpen(true)} style={{ background: 'none', color: 'rgb(176,72,63)', border: 'none', fontWeight: 600, fontSize: 13, padding: 6, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Dar de baja mi negocio</button>
          </div>
        </div>
      )}

      {/* Editar datos del negocio publicado */}
      {editOpen && negocio && (
        <Sheet onClose={() => setEditOpen(false)}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 16 }}>Editar datos</div>
          <label style={sheetLabel}>Nombre del negocio</label>
          <input value={ed.name} onChange={(e) => { setEd({ ...ed, name: e.target.value }); setError(''); }} style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel}>Rubro</label>
          <select value={ed.category} onChange={(e) => setEd({ ...ed, category: e.target.value })} style={{ ...sheetInput, marginBottom: 12 }}>
            {RUBROS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <label style={sheetLabel}>Descripción</label>
          <textarea value={ed.about} onChange={(e) => setEd({ ...ed, about: e.target.value })} rows={3} placeholder="Qué ofrecés, experiencia, disponibilidad…" style={{ ...sheetInput, resize: 'none', marginBottom: 12 }} />
          <label style={sheetLabel}>Zona de cobertura</label>
          <input value={ed.zone} onChange={(e) => { setEd({ ...ed, zone: e.target.value }); setError(''); }} style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel}>Tarifa</label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={ed.price} onChange={(e) => setEd({ ...ed, price: e.target.value })} inputMode="numeric" placeholder="4500" style={{ ...sheetInput, flex: '1 1 110px', width: 'auto' }} />
            <input value={ed.priceUnit} onChange={(e) => setEd({ ...ed, priceUnit: e.target.value })} placeholder="/paseo" style={{ ...sheetInput, flex: '1 1 110px', width: 'auto' }} />
          </div>
          <label style={sheetLabel}>WhatsApp</label>
          <input value={ed.phone} onChange={(e) => setEd({ ...ed, phone: e.target.value })} placeholder="+54 11 ..." style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel}>Instagram</label>
          <input value={ed.instagram} onChange={(e) => setEd({ ...ed, instagram: e.target.value })} placeholder="@tunegocio" style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel}>Sitio web</label>
          <input value={ed.website} onChange={(e) => setEd({ ...ed, website: e.target.value })} placeholder="tunegocio.com.ar" style={{ ...sheetInput, marginBottom: 16 }} />
          {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600, marginBottom: 12 }}>{error}</div>}
          <button onClick={guardarEdicion} disabled={busy} style={{ ...sheetBtn(true), width: '100%', marginBottom: 8, opacity: busy ? 0.6 : 1 }}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
          <button onClick={() => setEditOpen(false)} style={{ ...sheetBtn(false), width: '100%' }}>Cancelar</button>
        </Sheet>
      )}

      {/* Baja del negocio. Antes borraba de una, sin preguntar. */}
      {bajaOpen && (
        <Sheet onClose={() => setBajaOpen(false)}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>¿Dar de baja tu negocio?</div>
          <p style={{ fontSize: 13.5, color: 'rgb(91,86,112)', lineHeight: 1.55, margin: '0 0 18px' }}>Deja de aparecer en Servicios y se borran sus reseñas y los guardados que tenga. No se puede deshacer: para volver hay que dar de alta de nuevo.</p>
          <button onClick={darDeBaja} disabled={busy} style={{ width: '100%', background: 'rgb(251,232,239)', color: 'rgb(176,72,63)', border: 'none', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 14, cursor: 'pointer', marginBottom: 8, fontFamily: '"DM Sans"', opacity: busy ? 0.6 : 1 }}>{busy ? 'Dando de baja…' : 'Sí, dar de baja'}</button>
          <button onClick={() => setBajaOpen(false)} style={{ ...sheetBtn(true), width: '100%' }}>Cancelar</button>
        </Sheet>
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
const cardIcon = <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>;

/* ── Pantalla: Mi perfil ───────────────────────────────────────── */
/** Datos del socio, mascotas, membresía y baja. Lo que antes era decorativo acá:
 *  "Guardar cambios" de los datos personales no guardaba nada, la tarjeta era un
 *  '4287' fijo en el código, el historial de pagos eran cuatro filas inventadas y
 *  "Cambiar" plan te sacaba a la landing. */
function Perfil({ go, profile, pets, reintegradoTotal, planes, negocio }: { go: (s: Screen) => void; profile: Profile; pets: Pet[]; reintegradoTotal: number; planes: PlanVM[]; negocio: MiNegocio | null }) {
  const router = useRouter();
  const [showAddPet, setShowAddPet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({ nombre: profile.fullName, dni: profile.dni ?? '', dom: profile.address ?? '', localidad: profile.city ?? '', provincia: profile.province ?? '', tel: profile.phone ?? '', email: profile.email });
  const [planOpen, setPlanOpen] = useState(false);
  const [planSel, setPlanSel] = useState(profile.planName);
  const [bajaOpen, setBajaOpen] = useState(false);
  const [bajaHecha, setBajaHecha] = useState(false);

  /** Ahora sí guarda. El nombre también: antes no se podía editar desde ningún lado. */
  const guardarDatos = async () => {
    if (!datos.nombre.trim()) { setError('El nombre no puede quedar vacío.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('profiles').update({
      full_name: datos.nombre.trim(), dni: datos.dni.trim() || null,
      address: datos.dom.trim() || null,
      city: datos.localidad.trim() || null,
      province: datos.provincia.trim() || null,
      phone: datos.tel.trim() || null, email: datos.email.trim(),
    }).eq('id', profile.id);
    if (e) { setError('No pudimos guardar los cambios. Probá de nuevo.'); setBusy(false); return; }
    setEditando(false);
    router.refresh();
    setBusy(false);
  };

  /** El cambio de plan es real: mueve `profiles.plan_id`. */
  const confirmarPlan = async () => {
    const p = planes.find((x) => x.name === planSel);
    if (!p || p.name === profile.planName) { setPlanOpen(false); return; }
    setBusy(true);
    await supabase.from('profiles').update({ plan_id: p.id }).eq('id', profile.id);
    setPlanOpen(false);
    router.refresh();
    setBusy(false);
  };

  const confirmarBaja = async () => {
    setBusy(true);
    await supabase.from('profiles').update({ status: 'baja' }).eq('id', profile.id);
    setBajaHecha(true);
    router.refresh();
    setBusy(false);
  };

  const row = (icono: ReactNode, title: string, sub: string, action: ReactNode, onClick?: () => void) => (
    <button onClick={onClick} className="wa-card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, padding: '13px 15px', cursor: onClick ? 'pointer' : 'default', width: '100%', fontFamily: '"DM Sans"' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#5D5491' }}>{icono}</div>
      <div style={{ flex: '1 1 0%', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{sub}</div>
      </div>
      {action}
    </button>
  );
  const chevron = <span style={{ color: 'rgb(199,194,218)', fontSize: 18 }}>›</span>;
  const accion = (t: string) => <span style={{ color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 12 }}>{t}</span>;
  const dato = (k: string, v: string, ultimo = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: ultimo ? 'none' : '1px solid rgb(238,236,245)', fontSize: 13.5 }}>
      <span style={{ color: 'rgb(135,129,160)' }}>{k}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{v || '—'}</span>
    </div>
  );
  const inputEdit = { ...sheetInput, padding: '10px 12px', fontSize: 13.5, marginBottom: 8 };

  const negocioHint = !negocio ? 'Ofrecé tu servicio en Kumo'
    : negocio.status === 'verificado' ? `${negocio.name} · publicado`
    : negocio.status === 'rechazado' ? `${negocio.name} · no aprobado`
    : `${negocio.name} · en revisión`;

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, rgb(93,84,145), rgb(70,63,112))', borderRadius: 22, padding: 22, color: '#fff', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', flex: 'none', border: '2px solid rgba(255,255,255,0.25)', background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, color: '#5D5491' }}>{profile.firstName.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 21 }}>{profile.fullName}</div>
          <div style={{ color: 'rgb(201,195,227)', fontSize: 12.5 }}>Socio #{profile.memberNo} · Plan {profile.planName}</div>
        </div>
        <button onClick={() => setEditando((s) => !s)} style={{ background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, padding: '8px 14px', borderRadius: 100, cursor: 'pointer', flex: 'none', fontFamily: '"DM Sans"' }}>{editando ? 'Cancelar' : 'Editar'}</button>
      </div>

      {/* Mis mascotas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => go('mismascotas')} style={{ background: 'none', border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: 0, fontFamily: '\"DM Sans\"' }}>Mis mascotas ›</button>
        <button onClick={() => setShowAddPet(true)} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: '"DM Sans"' }}>+ Agregar</button>
      </div>
      {showAddPet && <AgregarMascotaSheet ownerId={profile.id} onClose={() => setShowAddPet(false)} onListo={() => { setShowAddPet(false); router.refresh(); }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {pets.map((p) => (
          <button key={p.id} onClick={() => go('mismascotas')} className="wa-card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '10px 14px', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: '"DM Sans"' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `url(${p.photo}) center/cover, rgb(240,237,249)`, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{p.breed}</div>
            </div>
            <span style={{ color: 'rgb(93,84,145)', fontSize: 12, fontWeight: 600 }}>Ver carnet ›</span>
          </button>
        ))}
        {pets.length === 0 && (
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 20, textAlign: 'center', fontSize: 13.5, color: 'rgb(135,129,160)' }}>Todavía no cargaste mascotas. Agregá a tu peludo para tener su carnet.</div>
        )}
      </div>

      {/* Mi cuenta */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Mi cuenta</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {row(ic(storeIcon, false, 19), 'Mi negocio', negocioHint, chevron, () => go('negocio'))}
        {row(ic(wallet, false, 19), 'Mis reintegros', `${m$(reintegradoTotal)} reintegrados este año`, chevron, () => go('reintegros'))}
        {row(ic(tagIcon, false, 19), 'Membresía', `Plan ${profile.planName}${profile.addonOdonto ? ' + odontológica' : ''} · ${m$(profile.planPrice)}/mes`, accion('Cambiar'), () => { setPlanSel(profile.planName); setPlanOpen(true); })}
        {/* El medio de pago sale del alta. Antes decía "Visa ····4287", un número
            fijo escrito en el código; después "Todavía no configurado", porque no
            se guardaba nada. El cobro sigue sin conectarse: esto identifica con
            qué se va a cobrar, no que ya se esté cobrando. */}
        {row(ic(cardIcon, false, 19), 'Medio de pago',
          profile.tarjeta ?? (profile.banco.cbu ? `Débito de CBU ····${profile.banco.cbu.slice(-4)}` : 'Todavía no configurado'),
          <span style={{ color: 'rgb(162,157,186)', fontSize: 12 }}>{profile.tarjeta || profile.banco.cbu ? 'Sin cobro activo' : 'Pendiente'}</span>)}
        {/* Dónde cobra los reintegros: es plata que le entra, así que verlo acá
            evita que descubra un CBU mal cargado cuando ya esperaba el dinero. */}
        {row(ic(wallet, false, 19), 'Cuenta para reintegros',
          profile.banco.cbu ? `${profile.banco.holder ?? 'A tu nombre'} · ····${profile.banco.cbu.slice(-4)}` : profile.banco.alias ? `Alias ${profile.banco.alias}` : 'Se pide al cargar el primer reintegro',
          <span style={{ color: 'rgb(162,157,186)', fontSize: 12 }}>{profile.banco.cbu || profile.banco.alias ? 'Cargada' : 'Pendiente'}</span>)}
      </div>

      {/* Datos personales */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Datos personales</div>
      <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '6px 16px', marginBottom: 20 }}>
        {editando ? (
          <div style={{ padding: '12px 0' }}>
            <label style={sheetLabel} htmlFor="pf-nom">Apellido y nombre</label>
            <input id="pf-nom" value={datos.nombre} onChange={(e) => { setDatos((d) => ({ ...d, nombre: e.target.value })); setError(''); }} style={inputEdit} />
            <label style={sheetLabel} htmlFor="pf-dni">DNI</label>
            <input id="pf-dni" value={datos.dni} onChange={(e) => setDatos((d) => ({ ...d, dni: e.target.value }))} style={inputEdit} />
            <label style={sheetLabel} htmlFor="pf-dom">Domicilio</label>
            <input id="pf-dom" value={datos.dom} onChange={(e) => setDatos((d) => ({ ...d, dom: e.target.value }))} placeholder="Calle y número" style={inputEdit} />
            <label style={sheetLabel} htmlFor="pf-loc">Localidad</label>
            <input id="pf-loc" value={datos.localidad} onChange={(e) => setDatos((d) => ({ ...d, localidad: e.target.value }))} style={inputEdit} />
            <label style={sheetLabel} htmlFor="pf-prov">Provincia</label>
            <input id="pf-prov" value={datos.provincia} onChange={(e) => setDatos((d) => ({ ...d, provincia: e.target.value }))} style={inputEdit} />
            <label style={sheetLabel} htmlFor="pf-tel">Teléfono</label>
            <input id="pf-tel" value={datos.tel} onChange={(e) => setDatos((d) => ({ ...d, tel: e.target.value }))} style={inputEdit} />
            <label style={sheetLabel} htmlFor="pf-mail">Email</label>
            <input id="pf-mail" value={datos.email} onChange={(e) => setDatos((d) => ({ ...d, email: e.target.value }))} style={inputEdit} />
            {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600, marginBottom: 8 }}>{error}</div>}
            <button onClick={guardarDatos} disabled={busy} style={{ ...sheetBtn(true), width: '100%', fontSize: 14, padding: 12, opacity: busy ? 0.6 : 1 }}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        ) : (
          <>
            {dato('DNI', profile.dni ?? '')}
            {dato('Domicilio', profile.address ?? '')}
            {dato('Localidad', profile.city ?? '')}
            {dato('Provincia', profile.province ?? '')}
            {dato('Teléfono', profile.phone ?? '')}
            {dato('Email', profile.email, true)}
          </>
        )}
      </div>

      {/* Historial de pagos. Antes eran cuatro cuotas inventadas, todas "Pagado". */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Historial de pagos</div>
        <span style={{ fontSize: 12, color: 'rgb(135,129,160)' }}>Plan {profile.planName}</span>
      </div>
      <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 20, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 13.5, color: 'rgb(135,129,160)', lineHeight: 1.5 }}>Todavía no hay pagos registrados. El cobro de la cuota no está conectado: cuando se integre la pasarela vas a ver acá cada cuota con su comprobante.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href="https://wa.me/5491125168802" target="_blank" rel="noopener" style={{ textAlign: 'center', background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 14, textDecoration: 'none' }}>Ayuda por WhatsApp</a>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = LANDING; }} style={{ background: 'none', color: 'rgb(135,129,160)', border: 'none', fontWeight: 600, fontSize: 13, padding: 10, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Cerrar sesión</button>
        <button onClick={() => { setBajaHecha(false); setBajaOpen(true); }} style={{ background: 'none', color: 'rgb(176,72,63)', border: 'none', fontWeight: 600, fontSize: 13, padding: 2, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Darme de baja</button>
      </div>

      {/* Cambiar plan */}
      {planOpen && (
        <Sheet onClose={() => setPlanOpen(false)}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 2 }}>Cambiar plan</div>
          <div style={{ fontSize: 13, color: 'rgb(135,129,160)', marginBottom: 16 }}>Elegí tu nueva membresía. El cambio queda registrado y se factura cuando el cobro esté conectado.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {planes.map((p) => {
              const sel = planSel === p.name;
              const actual = profile.planName === p.name;
              return (
                <button key={p.id} onClick={() => setPlanSel(p.name)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: sel ? 'rgb(240,237,249)' : '#fff', border: `1.5px solid ${sel ? 'rgb(93,84,145)' : 'rgb(230,227,240)'}`, borderRadius: 14, padding: 14, cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: '"DM Sans"' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? 'rgb(93,84,145)' : 'rgb(210,205,228)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    {sel && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgb(93,84,145)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                      {actual && <span style={{ fontSize: 10, fontWeight: 700, color: 'rgb(93,84,145)', background: 'rgb(240,237,249)', padding: '2px 7px', borderRadius: 100 }}>Tu plan</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgb(135,129,160)' }}>{p.tagline}</div>
                  </div>
                  <div style={{ textAlign: 'right', flex: 'none' }}>
                    <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 17 }}>{m$(p.price)}</div>
                    <div style={{ fontSize: 11, color: 'rgb(162,157,186)' }}>/mes</div>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={confirmarPlan} disabled={busy} style={{ ...sheetBtn(true), width: '100%', marginBottom: 8, opacity: busy ? 0.6 : 1 }}>{planSel === profile.planName ? 'Ya es tu plan' : `Cambiar a ${planSel}`}</button>
          <button onClick={() => setPlanOpen(false)} style={{ ...sheetBtn(false), width: '100%' }}>Cancelar</button>
        </Sheet>
      )}

      {/* Darme de baja */}
      {bajaOpen && (
        <Sheet onClose={() => setBajaOpen(false)}>
          {bajaHecha ? (
            <>
              <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Listo, tu baja fue registrada</div>
              <p style={{ fontSize: 13.5, color: 'rgb(91,86,112)', lineHeight: 1.55, margin: '0 0 18px' }}>Tu cuenta queda como dada de baja. Los reintegros en curso se siguen procesando. Si querés volver, escribinos por WhatsApp.</p>
              <button onClick={() => setBajaOpen(false)} style={{ ...sheetBtn(true), width: '100%' }}>Entendido</button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>¿Seguro que querés darte de baja?</div>
              <p style={{ fontSize: 13.5, color: 'rgb(91,86,112)', lineHeight: 1.55, margin: '0 0 18px' }}>Perdés el acceso a los beneficios, los reintegros y el carnet digital de {pets.length === 1 ? 'tu mascota' : 'tus mascotas'}. Los reintegros ya pedidos se siguen procesando.</p>
              <button onClick={confirmarBaja} disabled={busy} style={{ width: '100%', background: 'rgb(251,232,239)', color: 'rgb(176,72,63)', border: 'none', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 14, cursor: 'pointer', marginBottom: 8, fontFamily: '"DM Sans"', opacity: busy ? 0.6 : 1 }}>{busy ? 'Registrando…' : 'Confirmar baja'}</button>
              <button onClick={() => setBajaOpen(false)} style={{ ...sheetBtn(true), width: '100%' }}>Seguir siendo socio</button>
            </>
          )}
        </Sheet>
      )}
    </div>
  );
}

/* ── Pantalla: Mis mascotas ────────────────────────────────────── */
/** Listado y ficha de cada mascota, con su historial. En la webapp esta pantalla
 *  no existía: las mascotas solo se veían como filas en Mi perfil. */
const PET_EVENT_ICON = { vacuna: shieldPath, estudio: plusCircle, reintegro: wallet } as const;
const PET_EVENT_TONE = {
  vacuna: { bg: 'rgb(238,247,214)', fg: 'rgb(95,125,16)' },
  estudio: { bg: 'rgb(240,237,249)', fg: 'rgb(93,84,145)' },
  reintegro: { bg: 'rgb(226,245,234)', fg: 'rgb(47,143,91)' },
} as const;

function MisMascotas({ go, ownerId, pets, reintegros, setPetIdx }: { go: (s: Screen) => void; ownerId: string; pets: Pet[]; reintegros: Reint[]; setPetIdx: (i: number) => void }) {
  const router = useRouter();
  const [selId, setSelId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  /**
   * Borra una mascota. Avisa qué se lleva: `vaccinations.pet_id` es ON DELETE
   * CASCADE, así que se va el carnet entero. Los reintegros y la declaración
   * jurada son ON DELETE SET NULL y quedan — son plata y un registro firmado,
   * no pueden desaparecer porque alguien borre la mascota.
   */
  const borrarMascota = async (p: Pet) => {
    const n = p.vaccines.length;
    const conVacunas = n > 0 ? ` Se borra también su carnet, con ${n} vacuna${n === 1 ? '' : 's'} cargada${n === 1 ? '' : 's'}.` : '';
    if (!confirm(`¿Borrar a ${p.name}?${conVacunas} Los reintegros que pediste quedan. No se puede deshacer.`)) return;
    setBorrando(true);
    const { error, data } = await supabase.from('pets').delete().eq('id', p.id).select('id');
    if (error || !data?.length) { alert('No pudimos borrar la mascota. Probá de nuevo.'); setBorrando(false); return; }
    setSelId(null);
    setPetIdx(0);
    router.refresh();
    setBorrando(false);
  };

  const sel = pets.find((p) => p.id === selId);
  const idx = pets.findIndex((p) => p.id === selId);

  if (sel) {
    const historial = buildPetHistory({
      vaccines: sel.vaccines.map((v) => ({ id: v.id, name: v.name, kind: v.kind, status: v.status, appliedOn: v.appliedOn, dueOn: v.dueOn })),
      reintegros: reintegros.filter((r) => r.pet === sel.name).map((r) => ({ id: r.id, providerName: r.place, concept: r.concept, refund: r.refund, status: r.statusRaw, date: r.requestedOn })),
    });
    return (
      <div style={{ padding: '8px 20px 24px' }}>
        <button onClick={() => setSelId(null)} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '6px 0', marginBottom: 8 }}>← Mis mascotas</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: `url(${sel.photo}) center/cover, rgb(240,237,249)`, flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 21 }}>{sel.name}</div>
            <div style={{ fontSize: 13, color: 'rgb(135,129,160)' }}>{sel.breed}</div>
            <div style={{ fontSize: 12, color: 'rgb(162,157,186)', marginTop: 2 }}>Chip {sel.microchip} · Castrado: {sel.castrado}</div>
          </div>
        </div>

        <button onClick={() => { if (idx >= 0) setPetIdx(idx); go('carnet'); }} style={{ ...sheetBtn(true), width: '100%', marginBottom: 10 }}>Ver carnet digital</button>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setEditId(sel.id)} style={{ ...sheetBtn(false), flex: 1 }}>Editar datos</button>
          <button onClick={() => borrarMascota(sel)} disabled={borrando} style={{ ...sheetBtn(false), flex: 1, color: 'rgb(176,72,63)', borderColor: 'rgb(232,203,199)', cursor: borrando ? 'default' : 'pointer' }}>
            {borrando ? 'Borrando…' : 'Borrar mascota'}
          </button>
        </div>

        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Historial</div>
        {historial.length === 0 ? (
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 18, padding: 26, textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>Todavía sin movimientos</div>
            <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)', marginTop: 4, lineHeight: 1.45 }}>Cuando cargues vacunas o pidas un reintegro de {sel.name} van a aparecer acá.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {historial.map((e) => {
              const tone = PET_EVENT_TONE[e.kind];
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '12px 14px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: tone.fg }}>{ic(PET_EVENT_ICON[e.kind], false, 19)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: tone.fg, background: tone.bg, padding: '2px 7px', borderRadius: 100 }}>{e.tag}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{e.sub}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgb(162,157,186)', flex: 'none' }}>{fmtFechaCorta(e.date)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* La hoja también acá: "Editar datos" se toca desde la ficha, y este
            return sale antes que el de la lista. Estaba solo abajo, así que el
            botón seteaba el id y no aparecía nada. */}
        {editId && <AgregarMascotaSheet ownerId={ownerId} petId={editId} onClose={() => setEditId(null)} onListo={() => { setEditId(null); router.refresh(); }} />}
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22 }}>Mis mascotas</div>
        <button onClick={() => setShowAdd(true)} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, padding: '8px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: '"DM Sans"' }}>+ Agregar mascota</button>
      </div>

      {showAdd && <AgregarMascotaSheet ownerId={ownerId} onClose={() => setShowAdd(false)} onListo={() => { setShowAdd(false); router.refresh(); }} />}

      {pets.length === 0 ? (
        <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 20, padding: 30, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: 'rgb(240,237,249)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#5D5491" style={{ display: 'block' }}>{paw}</svg>
          </div>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 17 }}>Todavía no cargaste mascotas</div>
          <div style={{ fontSize: 13, color: 'rgb(91,86,112)', marginTop: 5 }}>Agregá a tu peludo para tener su carnet digital y pedir reintegros.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pets.map((p) => {
            const proxima = p.vaccines.find((v) => v.mark && v.dueOn);
            return (
              <button key={p.id} className="wa-card" onClick={() => setSelId(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 13, background: '#fff', border: '1px solid rgb(240,238,247)', borderRadius: 18, padding: 14, cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: '"DM Sans"', boxShadow: '0 4px 12px rgba(93,84,145,0.06)' }}>
                <div style={{ width: 54, height: 54, borderRadius: 16, background: `url(${p.photo}) center/cover, rgb(240,237,249)`, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: 'rgb(162,157,186)' }}>{p.breed}</div>
                  {proxima && <div style={{ fontSize: 11.5, color: 'rgb(95,125,16)', fontWeight: 600, marginTop: 3 }}>Próxima: {proxima.name} · {fmtFechaCorta(proxima.dueOn!)}</div>}
                </div>
                <span style={{ color: 'rgb(199,194,218)', fontSize: 18 }}>›</span>
              </button>
            );
          })}
        </div>
      )}
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
/**
 * Alta de una mascota, con su declaración jurada.
 *
 * Antes eran dos formularios sueltos —uno en Mi perfil y otro en Mis mascotas—
 * que insertaban en `pets` con nombre y raza. Las preguntas de salud son POR
 * MASCOTA, así que ese camino dejaba sumar una mascota enferma después del alta
 * sin declarar nada. Ahora hay uno solo y va por la función `agregar_mascota`,
 * que crea las dos filas en la misma transacción; el socio ya no puede insertar
 * en `pets` directamente, así que la pantalla no es la única defensa.
 */
function AgregarMascotaSheet({ ownerId, petId, onClose, onListo }: { ownerId: string; petId?: string | null; onClose: () => void; onListo: () => void }) {
  const editando = !!petId;
  const [cargando, setCargando] = useState(editando);
  const [name, setName] = useState('');
  const [tipo, setTipo] = useState('perro');
  const [breed, setBreed] = useState('');
  const [sexo, setSexo] = useState('macho');
  const [castrado, setCastrado] = useState(false);
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [chip, setChip] = useState('');
  const [vet, setVet] = useState('');
  const [health, setHealth] = useState<Record<number, string>>({});
  const [sanit, setSanit] = useState<Record<number, string>>({});
  const [firma, setFirma] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);

  /** Misma subida que el carnet, con las reglas y la ruta de `@kumo/shared`. */
  const elegirFoto = async (f?: File) => {
    if (!f) return;
    const invalida = motivoFotoInvalida(f.type, f.size);
    if (invalida) { setError(invalida); return; }
    setFotoBusy(true); setError('');
    const path = rutaFoto(ownerId, f.name.split('.').pop() ?? 'jpg', 'mascota-');
    const { error: subida } = await supabase.storage.from('pet-photos').upload(path, f, { contentType: f.type });
    if (subida) { setError('No pudimos subir la foto. Probá de nuevo.'); setFotoBusy(false); return; }
    setFotoUrl(supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl);
    setFotoBusy(false);
  };

  /**
   * Editando se prefijan los valores CRUDOS de la base y no los de la tarjeta:
   * ahí `breed` viene armado ("Mestizo · 3 años · 18 kg") y `microchip` dice
   * "Sin chip" cuando está vacío. Guardar eso los convertiría en datos reales.
   */
  useEffect(() => {
    if (!petId) return;
    let vigente = true;
    (async () => {
      const { data } = await supabase
        .from('pets')
        .select('name, type, breed, sex, neutered, age_years, weight_kg, microchip, vet_name, photo_url')
        .eq('id', petId)
        .single();
      if (!vigente || !data) { setCargando(false); return; }
      setName(data.name ?? '');
      setTipo(data.type ?? 'perro');
      setBreed(data.breed ?? '');
      setSexo(data.sex ?? 'macho');
      setCastrado(!!data.neutered);
      setEdad(data.age_years != null ? String(data.age_years) : '');
      setPeso(data.weight_kg != null ? String(data.weight_kg) : '');
      setChip(data.microchip ?? '');
      setVet(data.vet_name ?? '');
      if (data.photo_url?.startsWith('http')) setFotoUrl(data.photo_url);
      setCargando(false);
    })();
    return () => { vigente = false; };
  }, [petId]);

  const declaracion = armarDeclaracion({ health, sanit, firma });
  const puedeGuardar = name.trim().length > 0 && (editando || declaracion !== null) && !busy && !cargando;

  const num = (s: string) => {
    const m = /(\d+([.,]\d+)?)/.exec(s);
    return m?.[1] ? Number(m[1].replace(',', '.')) : null;
  };

  const guardar = async () => {
    setBusy(true); setError('');

    // Editando: un UPDATE común y no la función. La declaración no se vuelve a
    // pedir —ya está firmada— y por eso tampoco se puede tocar desde acá.
    if (editando) {
      const { error: e, data } = await supabase.from('pets').update({
        name: name.trim(), type: tipo, breed: breed.trim() || null, sex: sexo, neutered: castrado,
        age_years: num(edad), weight_kg: num(peso), microchip: chip.trim() || null, vet_name: vet.trim() || null,
        ...(fotoUrl ? { photo_url: fotoUrl } : {}),
      }).eq('id', petId).select('id');
      if (e || !data?.length) { setError('No pudimos guardar los cambios. Probá de nuevo.'); setBusy(false); return; }
      onListo();
      return;
    }

    if (!declaracion) { setError('Completá y firmá la declaración jurada de la mascota.'); return; }
    const { error: e } = await supabase.rpc('agregar_mascota', {
      p_name: name, p_type: tipo, p_breed: breed, p_sex: sexo, p_neutered: castrado,
      p_age_years: num(edad), p_weight_kg: num(peso), p_microchip: chip, p_vet_name: vet,
      p_photo_url: fotoUrl,
      p_version: declaracion.version, p_answers: declaracion.answers,
      p_sanitary: declaracion.sanitary, p_signature: declaracion.signature,
    });
    if (e) { setError('No pudimos agregar la mascota. Probá de nuevo.'); setBusy(false); return; }
    onListo();
  };

  const pregunta = (texto: string, valor: string | undefined, set: (v: string) => void) => (
    <div key={texto} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid rgb(238,236,245)' }}>
      <span style={{ fontSize: 13, lineHeight: 1.45, flex: 1 }}>{texto}</span>
      <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
        <button onClick={() => set('Sí')} style={{ ...segBtn(valor === 'Sí'), padding: '7px 13px', fontSize: 12.5 }}>Sí</button>
        <button onClick={() => set('No')} style={{ ...segBtn(valor === 'No'), padding: '7px 13px', fontSize: 12.5 }}>No</button>
      </div>
    </div>
  );

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{editando ? 'Editar mascota' : 'Agregar una mascota'}</div>
      <div style={{ fontSize: 13, color: 'rgb(135,129,160)', marginBottom: 18 }}>
        {editando
          ? 'Cambiá lo que necesites. La declaración jurada que firmaste al sumarla no se toca.'
          : 'Como en el alta, necesitamos su declaración de salud: es por mascota, no por socio.'}
      </div>

      <label style={sheetLabel}>Foto</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, flex: 'none', background: fotoUrl ? `url(${fotoUrl}) center/cover` : 'rgb(240,237,249)' }} />
        <label style={{ ...sheetBtn(false), cursor: fotoBusy ? 'default' : 'pointer', fontSize: 13.5, padding: '10px 14px' }}>
          {fotoBusy ? 'Subiendo…' : fotoUrl ? 'Cambiar' : 'Elegir una foto'}
          <input type="file" accept={FOTO_TIPOS.join(',')} onChange={(e) => elegirFoto(e.target.files?.[0])} style={{ display: 'none' }} />
        </label>
      </div>
      <label style={sheetLabel} htmlFor="am-name">Nombre</label>
      <input id="am-name" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="Ej: Kira" style={{ ...sheetInput, marginBottom: 16 }} />

      <label style={sheetLabel}>Especie</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['perro', 'Perro'], ['gato', 'Gato'], ['otro', 'Otro']].map(([v, l]) => (
          <button key={v} onClick={() => setTipo(v!)} style={segBtn(tipo === v)}>{l}</button>
        ))}
      </div>

      <label style={sheetLabel} htmlFor="am-breed">Raza</label>
      <input id="am-breed" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Opcional" style={{ ...sheetInput, marginBottom: 16 }} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={sheetLabel} htmlFor="am-edad">Edad</label>
          <input id="am-edad" value={edad} onChange={(e) => setEdad(e.target.value)} placeholder="años" style={sheetInput} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={sheetLabel} htmlFor="am-peso">Peso</label>
          <input id="am-peso" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="kg" style={sheetInput} />
        </div>
      </div>

      <label style={sheetLabel}>Sexo</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['macho', 'Macho'], ['hembra', 'Hembra']].map(([v, l]) => (
          <button key={v} onClick={() => setSexo(v!)} style={segBtn(sexo === v)}>{l}</button>
        ))}
      </div>

      <label style={sheetLabel}>¿Está castrada?</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button onClick={() => setCastrado(true)} style={segBtn(castrado)}>Sí</button>
        <button onClick={() => setCastrado(false)} style={segBtn(!castrado)}>No</button>
      </div>

      <label style={sheetLabel} htmlFor="am-chip">Microchip</label>
      <input id="am-chip" value={chip} onChange={(e) => setChip(e.target.value)} placeholder="Opcional" style={{ ...sheetInput, marginBottom: 16 }} />

      <label style={sheetLabel} htmlFor="am-vet">Veterinaria de cabecera</label>
      <input id="am-vet" value={vet} onChange={(e) => setVet(e.target.value)} placeholder="Opcional" style={{ ...sheetInput, marginBottom: 20 }} />

      {/* La declaración solo al agregar: la de una mascota que ya está se firmó
          una vez y no se reescribe (por eso la tabla no tiene update). */}
      {!editando && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Declaración jurada de salud</div>
          <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)', marginBottom: 8 }}>Contestá las {HEALTH_Q.length} preguntas. Declarar una condición no te deja afuera del club: define qué cubre el plan.</div>
          {HEALTH_Q.map((q, i) => pregunta(q, health[i], (v) => { setHealth({ ...health, [i]: v }); setError(''); }))}

          <div style={{ fontWeight: 700, fontSize: 15, margin: '18px 0 8px' }}>Plan sanitario</div>
          {SANITARIO_Q.map((q, i) => pregunta(q, sanit[i], (v) => { setSanit({ ...sanit, [i]: v }); setError(''); }))}

          <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)', margin: '18px 0 8px' }}>Escribí tu nombre completo tal cual figura en tu DNI. Equivale a tu firma según la Ley 25.506.</div>
          <input id="am-firma" value={firma} onChange={(e) => { setFirma(e.target.value); setError(''); }} placeholder="Tu nombre y apellido" style={{ ...sheetInput, textAlign: 'center', fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 17, marginBottom: 16 }} />
        </>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600, marginBottom: 10 }}>{error}</div>}
      <button onClick={guardar} disabled={!puedeGuardar} style={{ ...sheetBtn(true), width: '100%', opacity: puedeGuardar ? 1 : 0.5, cursor: puedeGuardar ? 'pointer' : 'default' }}>
        {cargando ? 'Cargando…' : busy ? 'Guardando…' : editando ? 'Guardar cambios' : 'Firmar y agregar'}
      </button>
    </Sheet>
  );
}

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

export default function AppClient({ profile, pets, reintegros, contacts, providers, benefits, posts, negocio, notifInput, guardados, reviews, misLikes, planes }: { profile: Profile; pets: Pet[]; reintegros: Reint[]; contacts: EmergencyContact[]; providers: ProviderVM[]; benefits: BenefitVM[]; posts: ForumPost[]; negocio: MiNegocio | null; notifInput: NotifInput; guardados: string[]; reviews: Record<string, Review[]>; misLikes: MisLikes; planes: PlanVM[] }) {
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
        <span style={{ fontSize: 13.5, color: 'rgb(91,86,112)', fontWeight: 600, marginLeft: 'auto' }}>{screen === 'notif' ? 'Notificaciones' : screen === 'prestar' ? 'Prestar servicio' : screen === 'mismascotas' ? 'Mis mascotas' : current?.label}</span>
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
          {screen === 'servicios' && <Servicios go={go} providers={providers} initialGuardados={guardados} profile={profile} reviews={reviews} />}
          {screen === 'prestar' && <Prestar go={go} profile={profile} negocio={negocio} />}
          {screen === 'reintegros' && <Reintegros initialReintegros={reintegros} planName={profile.planName} memberId={profile.id} pets={pets} banco={profile.banco} />}
          {screen === 'beneficios' && <Beneficios benefits={benefits} go={go} />}
          {screen === 'foros' && <Foros initialPosts={posts} profile={profile} misLikes={misLikes} />}
          {screen === 'negocio' && <Negocio go={go} negocio={negocio} profile={profile} misReviews={negocio ? (reviews[negocio.id] ?? []) : []} />}
          {screen === 'mismascotas' && <MisMascotas go={go} ownerId={profile.id} pets={pets} reintegros={reintegros} setPetIdx={setPetIdx} />}
          {screen === 'perfil' && <Perfil go={go} profile={profile} pets={pets} reintegradoTotal={reintegradoTotal} planes={planes} negocio={negocio} />}
          {screen === 'notif' && <Notificaciones go={go} groups={notifGroups} visto={visto} marcarLeidas={marcarLeidas} />}
        </div>
      </div>
    </div>
  );
}
