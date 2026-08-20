'use client';
import type { CSSProperties, ReactNode } from 'react';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  data, FOTO_TIPOS, FOTO_MAX, HEALTH_Q, SANITARIO_Q, ODONTO_PRECIO, cuotaMensual,
  PROVINCIAS, formatDni, formatTel, formatFecha, validarSocio, pasoOk, payloadAlta,
  borradorVacio, conIdentidad, conArranque, mascotaVacia, pasosDelAlta, esGratis, planElegido, declaracionDeMascotaOk,
  MAX_MASCOTAS_ALTA, PLAN_GRATUITO, type BorradorAlta, type MascotaBorrador,
} from '@kumo/shared';
import { supabase } from '@/lib/supabase-browser';
import { CampoClave } from '@/components/CampoClave';

/*
 * Alta de socio — el formulario, presentado como WEB y no dentro de un marco de
 * teléfono. Lo abren "Empezar / Unirme al club / Elegir plan".
 *
 * Los pasos son 4 o 5 según lo que elija: mascotas · datos · plan · declaración, y
 * el del pago solo existe si eligió un plan. Entrar a Kumo es gratis, así que
 * obligar a pasar por una pantalla de pago sería mentirle sobre lo que ofrece el
 * club.
 *
 * Las reglas ("este paso está completo", cómo se arma el pedido) viven en
 * `@kumo/shared/alta`: este formulario y el de la app del celular comparten las
 * mismas, así que un arreglo entra en los dos o en ninguno.
 */

const money = (n: number) => '$' + n.toLocaleString('es-AR');
const todayShort = () => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };

const input: CSSProperties = { width: '100%', padding: '13px 14px', border: '1.5px solid #e6e3f0', borderRadius: 12, fontSize: 15, background: '#fff', color: '#211E33', outline: 'none', fontFamily: '"DM Sans"', boxSizing: 'border-box' };
const label: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#5b5670', marginBottom: 6 };
const field = (l: ReactNode, node: ReactNode) => (<div style={{ marginBottom: 14 }}><label style={label}>{l}</label>{node}</div>);
const Radio = ({ on }: { on: boolean }) => (
  <span style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid ' + (on ? '#5D5491' : '#e6e3f0'), flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {on && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#5D5491' }} />}
  </span>
);

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <button key={o} type="button" onClick={() => onChange(o)} style={{ flex: 1, padding: '11px 8px', border: '1.5px solid ' + (on ? '#5D5491' : '#e6e3f0'), background: on ? '#5D5491' : '#fff', color: on ? '#fff' : '#5b5670', borderRadius: 11, fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: '0.15s' }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Los datos de UNA mascota, dentro de la lista del paso 1.
 *
 * Es un componente aparte porque ahora se repite: con "agregar otra mascota" el
 * paso 1 pasó de un formulario a una lista, y el formulario de cada fila es el
 * mismo.
 */
function FilaMascota({
  m, indice, total, foto, onCambio, onFoto, onQuitar,
}: {
  m: MascotaBorrador;
  indice: number;
  total: number;
  foto: File | undefined;
  onCambio: (datos: MascotaBorrador['datos']) => void;
  onFoto: (f: File | undefined, error: string) => void;
  onQuitar: () => void;
}) {
  const [error, setError] = useState('');
  const d = m.datos;
  const set = (parte: Partial<MascotaBorrador['datos']>) => onCambio({ ...d, ...parte });

  /** Se valida acá y no solo en el servidor: si el tipo no entra, antes el alta
   *  respondía "listo" y la foto se perdía sin que nadie se enterara. */
  const elegirFoto = (f?: File) => {
    if (!f) return;
    if (!FOTO_TIPOS.includes(f.type as (typeof FOTO_TIPOS)[number])) {
      setError(`Ese formato no lo podemos usar (${f.type || 'desconocido'}). Probá con JPG, PNG o WEBP. Si es una foto de iPhone, mandala desde "Fotos" y se convierte sola.`);
      return;
    }
    if (f.size > FOTO_MAX) {
      setError(`La foto pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es 5 MB. Probá con una más chica.`);
      return;
    }
    setError('');
    onFoto(f, '');
  };

  return (
    <div style={{ border: '1px solid #e6e3f0', background: '#fff', borderRadius: 18, padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 16, color: '#5D5491' }}>
          {d.nombre.trim() || `Mascota ${indice + 1}`}
        </span>
        {/* Quitar solo aparece con más de una: no se puede dar de alta sin ninguna. */}
        {total > 1 && (
          <button type="button" onClick={onQuitar} style={{ background: 'none', border: 'none', color: '#8781a0', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}>
            Quitar
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label}>Foto</label>
        {/* Solo la foto propia. Antes había tres de ejemplo para que el carnet no
            quedara vacío, pero un carnet con la mascota de otro es peor que uno sin
            foto: la foto es lo que hace que el carnet sea de alguien. */}
        <label style={{ width: 84, height: 84, borderRadius: 16, border: foto ? '2.5px solid #5D5491' : '1.5px dashed #c9c3e3', background: '#faf9fd', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
          {foto
            ? <img src={URL.createObjectURL(foto)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8781a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="15" rx="2.5" /><circle cx="12" cy="12" r="3.2" /><path d="M8 5l1.5-2h5L16 5" /></svg><span style={{ fontSize: 10.5, color: '#8781a0', marginTop: 6 }}>Subí una foto</span></>}
          <input type="file" accept={FOTO_TIPOS.join(',')} style={{ display: 'none' }} onChange={(e) => elegirFoto(e.target.files?.[0])} />
        </label>
        {error
          ? <p style={{ fontSize: 12.5, color: '#b0483f', fontWeight: 600, margin: '8px 0 0' }}>{error}</p>
          : <p style={{ fontSize: 12.5, color: '#8781a0', margin: '8px 0 0' }}>{foto ? `Vas a usar: ${foto.name}` : 'Si no tenés una a mano, la podés cargar después desde el carnet.'}</p>}
      </div>

      {field('Nombre', <input value={d.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Ej. Manchas" style={input} />)}
      {field('Especie', <Segmented options={['Perro', 'Gato', 'Otro']} value={d.especie} onChange={(v) => set({ especie: v })} />)}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>{field('Sexo', <Segmented options={['Macho', 'Hembra']} value={d.sexo} onChange={(v) => set({ sexo: v })} />)}</div>
        <div style={{ flex: 1 }}>{field('Castrado/a', <Segmented options={['Sí', 'No']} value={d.castrado} onChange={(v) => set({ castrado: v })} />)}</div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 2 }}>{field('Raza', <input value={d.raza} onChange={(e) => set({ raza: e.target.value })} placeholder="Ej. Mestizo" style={input} />)}</div>
        <div style={{ flex: 1 }}>{field('Edad aprox.', <input value={d.edad} onChange={(e) => set({ edad: e.target.value })} placeholder="4 años" style={input} />)}</div>
        <div style={{ flex: 1 }}>{field('Peso', <input value={d.peso} onChange={(e) => set({ peso: e.target.value })} placeholder="12 kg" style={input} />)}</div>
      </div>
      {field(<>N° de microchip <span style={{ color: '#a29dba', fontWeight: 500 }}>(si tiene)</span></>, <input value={d.microchip} onChange={(e) => set({ microchip: e.target.value })} placeholder="982 000 000 000" style={input} />)}
      {field('Veterinario habitual / Clínica', <input value={d.vet} onChange={(e) => set({ vet: e.target.value })} placeholder="Ej. Veterinaria Norte" style={input} />)}
    </div>
  );
}

/**
 * La declaración jurada de UNA mascota, dentro del acordeón del paso 4.
 *
 * Las preguntas se repiten por mascota porque la declaración es de cada animal, no
 * del socio. La firma NO está acá: va una sola vez al final, y cubre a todas — es
 * un solo acto legal con N anexos.
 */
function DeclaracionDeMascota({
  m, abierta, onAbrir, onCambio,
}: {
  m: MascotaBorrador;
  abierta: boolean;
  onAbrir: () => void;
  onCambio: (parte: Partial<Pick<MascotaBorrador, 'salud' | 'sanit'>>) => void;
}) {
  const completa = declaracionDeMascotaOk(m);
  const faltan = HEALTH_Q.length + SANITARIO_Q.length - Object.keys(m.salud).length - Object.keys(m.sanit).length;

  return (
    <div style={{ border: '1px solid #e6e3f0', background: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onAbrir}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: abierta ? '#faf9fd' : '#fff', border: 'none', padding: '15px 18px', cursor: 'pointer', fontFamily: '"DM Sans"', textAlign: 'left' }}
      >
        <span style={{ fontWeight: 700, fontSize: 15, color: '#211E33' }}>{m.datos.nombre.trim() || 'Tu mascota'}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: completa ? '#2f8f5b' : '#8781a0' }}>
          {completa ? '✓ completa' : faltan > 0 ? `faltan ${faltan}` : 'incompleta'}
        </span>
      </button>
      {abierta && (
        <div style={{ padding: '4px 18px 18px' }}>
          {HEALTH_Q.map((q, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, color: '#211E33', marginBottom: 7 }}>{q}</div>
              <Segmented options={['Sí', 'No']} value={m.salud[i] ?? ''} onChange={(v) => onCambio({ salud: { ...m.salud, [i]: v } })} />
            </div>
          ))}
          <div style={{ fontWeight: 700, fontSize: 14.5, margin: '20px 0 12px' }}>Plan sanitario</div>
          {SANITARIO_Q.map((q, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, color: '#211E33', marginBottom: 7 }}>{q}</div>
              <Segmented options={['Sí', 'No']} value={m.sanit[i] ?? ''} onChange={(v) => onCambio({ sanit: { ...m.sanit, [i]: v } })} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** `arranque` es lo que la persona ya eligió en la web pública (el nombre y la especie
 *  del hero, o el plan de las tarjetas). Ver `conArranque` en shared. */
export function Onboarding({ open, onClose, arranque, plans = data.plans, identidad }: { open: boolean; onClose: () => void; arranque?: { mascota?: string; especie?: string; plan?: string } | null; plans?: typeof data.plans; identidad?: { nombre: string; email: string } | null }) {
  const router = useRouter();
  const conGoogle = !!identidad;
  const [step, setStep] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [b, setB] = useState<BorradorAlta>(() => borradorVacio({ nombre: identidad?.nombre, email: identidad?.email, mascota: arranque?.mascota, especie: arranque?.especie }));
  /** Las fotos por mascota. Van por `uid` y no por posición: al quitar una del medio,
   *  un índice dejaría la foto pegada a otra mascota. */
  const [fotos, setFotos] = useState<Record<string, File>>({});
  const [abierta, setAbierta] = useState<string | null>(null);

  /*
   * La identidad de Google puede llegar DESPUÉS de que este formulario se montó, y
   * de hecho es lo que pasa siempre: vive permanentemente en el árbol de la landing
   * (se muestra u oculta con `open`), así que su estado inicial se armó cuando la
   * identidad todavía era null y el inicializador de `useState` no vuelve a correr.
   * Sin esto, quien entra con Google llega al paso 2 con el nombre y el mail vacíos.
   */
  useEffect(() => { setB((prev) => conIdentidad(prev, identidad)); }, [identidad]);
  /* Lo mismo con lo que eligió en la web pública: el nombre de la mascota y el plan
     llegan DESPUÉS del montaje, porque el formulario vive siempre en el árbol de la
     landing. Sin esto, la persona tipeaba el nombre de su perro en el hero, tocaba
     Continuar y el paso 1 aparecía vacío. */
  useEffect(() => { setB((prev) => conArranque(prev, arranque)); }, [arranque]);

  if (!open) return null;

  const { socio, mascotas } = b;
  // Campo por campo, para el borde rojo del que falla.
  const v = validarSocio(socio, conGoogle);
  const total = pasosDelAlta(b);
  const canNext = pasoOk(step, b, conGoogle);
  const gratis = esGratis(b.eleccion);
  const plan = planElegido(b.eleccion);
  const selectedPlan = plans.find((p) => p.name === plan);
  const planPrice = cuotaMensual(selectedPlan?.basePrice ?? 0, b.odonto);

  /*
   * El botón del último paso.
   *
   * En el camino PAGO no hay sheet de confirmación en el medio: el socio ya está
   * mirando el plan, la cuota y las condiciones, así que el botón crea el alta y lo
   * lleva a Mercado Pago. Una pantalla que repite lo que se está viendo para preguntar
   * "¿seguro?" no protege de nada y es el paso donde más gente se cae.
   *
   * En el camino GRATUITO el sheet queda: ahí no hay pago que revisar después, y es la
   * única vuelta atrás antes de crear la cuenta y firmar la declaración.
   */
  const next = () => {
    if (step < total) { setStep(step + 1); return; }
    if (!canNext) return;
    if (gratis) { setConfirmOpen(true); return; }
    confirmAlta();
  };
  const back = () => { if (step > 1) setStep(step - 1); else onClose(); };

  const setMascota = (uid: string, parte: Partial<MascotaBorrador>) =>
    setB((x) => ({ ...x, mascotas: x.mascotas.map((m) => (m.uid === uid ? { ...m, ...parte } : m)) }));

  const agregarMascota = () => {
    const nueva = mascotaVacia();
    setB((x) => ({ ...x, mascotas: [...x.mascotas, nueva] }));
    setAbierta(nueva.uid);
  };

  const quitarMascota = (uid: string) => {
    setB((x) => ({ ...x, mascotas: x.mascotas.filter((m) => m.uid !== uid) }));
    setFotos((f) => { const { [uid]: _fuera, ...resto } = f; return resto; });
  };

  const confirmAlta = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const form = new FormData();
      form.set('payload', JSON.stringify(payloadAlta(b)));
      // Una parte por mascota, en el mismo orden que el payload: repetir la clave
      // `photo` sería ambiguo cuando solo la segunda tiene foto.
      mascotas.forEach((m, i) => { const f = fotos[m.uid]; if (f) form.set(`photo_${i}`, f); });

      const res = await fetch('/api/onboarding', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo completar el alta.');

      // Con Google la sesión ya está abierta desde /auth/callback; loguear con
      // contraseña acá fallaría, porque esa cuenta no tiene ninguna.
      if (!conGoogle) {
        await supabase.auth.signInWithPassword({ email: socio.email, password: socio.password });
      }

      const avisoFoto = json.photoError ? `?foto=${encodeURIComponent(json.photoError)}` : '';

      /*
       * Con plan, se va a pagar. Si el cobro falla NO se pierde el alta: el socio ya
       * existe, así que va a la pantalla final con un aviso y la opción de activar la
       * cuota después. Que falle el pago nunca puede parecer un alta fallida.
       */
      if (plan) {
        const pago = await fetch('/api/pagos/crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, odonto: b.odonto, desde: 'alta' }),
        });
        const datos = await pago.json();
        if (pago.ok && datos.initPoint) { window.location.href = datos.initPoint; return; }
        console.error('[alta] no se pudo abrir el pago', datos);
        window.location.href = `/alta/listo${avisoFoto || '?'}${avisoFoto ? '&' : ''}pago=error`;
        return;
      }

      router.push(`/alta/listo${avisoFoto}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'No se pudo completar el alta.');
      setSubmitting(false);
    }
  };

  const tituloCTA = step === 4 && !gratis ? 'Firmar y continuar'
    : step === total ? (gratis ? 'Confirmar y unirme' : submitting ? 'Creando tu cuenta…' : 'Ir a Mercado Pago')
    : 'Continuar';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: '#f5f4f8', overflowY: 'auto' }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'rgba(245,244,248,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #e6e3f0' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* "Volver" y no "Volver a la landing": landing es una palabra nuestra, no
              del socio, que lo único que ve es el sitio de Kumo. */}
          <button onClick={back} style={{ background: '#fff', border: '1px solid #e6e3f0', color: '#5D5491', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, padding: '9px 14px', borderRadius: 11, cursor: 'pointer', boxShadow: '0 4px 14px rgba(93,84,145,0.1)', whiteSpace: 'nowrap' }}>← {step === 1 ? 'Volver' : 'Atrás'}</button>
          <div style={{ flex: 1 }}>
            {/* Los pasos son 4 o 5: el del pago no existe si eligió gratis. */}
            <div style={{ fontSize: 12, color: '#8781a0', fontWeight: 600, marginBottom: 6 }}>{`Paso ${step} de ${total}`}</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                <div key={n} style={{ flex: 1, height: 5, borderRadius: 100, background: n <= step ? '#5D5491' : '#e6e3f0', transition: '0.3s' }} />
              ))}
            </div>
          </div>
          <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, color: '#5D5491' }}>Kumo</span>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 120px' }}>
        {/* PASO 1 · Las mascotas */}
        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>
              {mascotas.length > 1 ? 'Tus mascotas' : 'Tu mascota'}
            </h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 22px' }}>Contanos sobre quién vas a cuidar. Podés sumar más de una.</p>
            {mascotas.map((m, i) => (
              <FilaMascota
                key={m.uid}
                m={m}
                indice={i}
                total={mascotas.length}
                foto={fotos[m.uid]}
                onCambio={(datos) => setMascota(m.uid, { datos })}
                onFoto={(f) => setFotos((x) => (f ? { ...x, [m.uid]: f } : x))}
                onQuitar={() => quitarMascota(m.uid)}
              />
            ))}
            {mascotas.length < MAX_MASCOTAS_ALTA ? (
              <button
                type="button"
                onClick={agregarMascota}
                style={{ width: '100%', border: '1.5px dashed #c9c3e3', background: '#fff', color: '#5D5491', borderRadius: 14, padding: '14px 16px', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
              >
                ＋ Agregar otra mascota
              </button>
            ) : (
              <p style={{ fontSize: 12.5, color: '#8781a0', textAlign: 'center', margin: 0 }}>
                Podés cargar hasta {MAX_MASCOTAS_ALTA} en el alta. Las demás se agregan después desde tu cuenta.
              </p>
            )}
          </div>
        )}

        {/* PASO 2 · El socio */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>Tus datos</h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 22px' }}>Datos del socio titular.</p>
            {field('Apellido y nombre', <input autoComplete="name" value={socio.nombre} onChange={(e) => setB({ ...b, socio: { ...socio, nombre: e.target.value } })} placeholder="Ej. Valentina Ruiz" style={input} />)}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>{field('DNI', <input autoComplete="off" value={socio.dni} onChange={(e) => setB({ ...b, socio: { ...socio, dni: formatDni(e.target.value) } })} placeholder="00.000.000" style={{ ...input, borderColor: socio.dni && !v.dni ? '#c14d7a' : '#e6e3f0' }} />)}</div>
              <div style={{ flex: 1 }}>{field('Fecha de nac.', <input autoComplete="bday" value={socio.fnac} onChange={(e) => setB({ ...b, socio: { ...socio, fnac: formatFecha(e.target.value) } })} placeholder="dd/mm/aaaa" style={{ ...input, borderColor: socio.fnac && !v.fnac ? '#c14d7a' : '#e6e3f0' }} />)}</div>
            </div>
            {field('Domicilio', <input autoComplete="street-address" value={socio.domicilio} onChange={(e) => setB({ ...b, socio: { ...socio, domicilio: e.target.value } })} placeholder="Calle y número" style={input} />)}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>{field('Localidad', <input autoComplete="address-level2" value={socio.localidad} onChange={(e) => setB({ ...b, socio: { ...socio, localidad: e.target.value } })} placeholder="Ej. Palermo" style={input} />)}</div>
              <div style={{ flex: 1 }}>{field('Provincia', <select value={socio.provincia} onChange={(e) => setB({ ...b, socio: { ...socio, provincia: e.target.value } })} style={input}><option value="">Elegí una provincia</option>{PROVINCIAS.map((p) => <option key={p}>{p}</option>)}</select>)}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>{field('Teléfono', <input autoComplete="tel" value={socio.tel} onChange={(e) => setB({ ...b, socio: { ...socio, tel: formatTel(e.target.value) } })} placeholder="11 5555 2024" style={{ ...input, borderColor: socio.tel && !v.tel ? '#c14d7a' : '#e6e3f0' }} />)}</div>
              <div style={{ flex: 1 }}>{field('Email', <input type="email" autoComplete="email" value={socio.email} onChange={(e) => setB({ ...b, socio: { ...socio, email: e.target.value } })} readOnly={conGoogle} placeholder="tu@email.com" style={{ ...input, borderColor: socio.email && !v.email ? '#c14d7a' : '#e6e3f0', background: conGoogle ? '#faf9fd' : '#fff', color: conGoogle ? '#5b5670' : undefined }} />)}</div>
            </div>
            {/* Con Google no se pide contraseña: la persona ya está identificada
                y de ahí en adelante entra con el botón. Pedirle una sería
                inventarle una credencial que no va a usar nunca. */}
            {conGoogle ? (
              <p style={{ fontSize: 12.5, color: '#5b5670', background: '#faf9fd', border: '1px solid #eeecf5', borderRadius: 10, padding: '10px 12px', margin: 0, lineHeight: 1.5 }}>
                Tu cuenta va a quedar asociada a <strong>{socio.email}</strong> de Google, así que no necesitás contraseña: entrás siempre con el botón de Google.
              </p>
            ) : (
              <>
                {field('Contraseña', (
                  <CampoClave
                    value={socio.password}
                    onChange={(clave) => setB({ ...b, socio: { ...socio, password: clave } })}
                    mal={!!socio.password && !v.password}
                    style={input}
                  />
                ))}
                <p style={{ fontSize: 12.5, color: '#a29dba', margin: '-8px 0 0' }}>La vas a usar para entrar a la app cuando quieras.</p>
              </>
            )}
          </div>
        )}

        {/* PASO 3 · El plan, o entrar gratis */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>Elegí tu plan</h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 22px' }}>Podés cambiarlo o cancelarlo cuando quieras.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/*
                * El gratuito va PRIMERO y con el mismo diseño que los planes.
                *
                * Estaba abajo y con menos jerarquía para que el formulario no pareciera
                * vender cuatro planes. Flor decidió lo contrario, y tiene sentido: entrar
                * gratis ES la propuesta de Kumo, no la letra chica. Esconderlo hace que la
                * persona crea que hay que pagar para probar.
                *
                * No sale de `plans` porque no es un plan: no tiene fila en la tabla ni
                * precio, y `plan_id` queda en null. El contenido está en `PLAN_GRATUITO`.
                */}
              <div
                onClick={() => setB({ ...b, eleccion: { modo: 'gratis' }, odonto: false })}
                style={{ position: 'relative', border: '2px solid ' + (gratis ? '#5D5491' : '#e6e3f0'), background: gratis ? '#faf9fd' : '#fff', borderRadius: 18, padding: 20, cursor: 'pointer', transition: '0.15s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18, color: '#5D5491' }}>{PLAN_GRATUITO.nombre}</span>
                  <Radio on={gratis} />
                </div>
                <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginTop: 6 }}>{money(PLAN_GRATUITO.precio)}<span style={{ fontSize: 13, color: '#8781a0', fontWeight: 500 }}>/mes</span></div>
                <div style={{ fontSize: 13.5, color: '#5b5670', margin: '4px 0 12px' }}>{PLAN_GRATUITO.tagline}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 4 }}>
                  {PLAN_GRATUITO.incluye.map((item) => (
                    <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: '#4a4560' }}>
                      <span style={{ color: '#5D5491', fontWeight: 700, flex: '0 0 auto' }}>✓</span><span>{item}</span>
                    </div>
                  ))}
                  {/* Lo que NO incluye, dicho acá: enterarse al ir a pedir un reintegro es
                      peor que leerlo ahora. */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: '#8781a0' }}>
                    <span style={{ flex: '0 0 auto' }}>—</span><span>{PLAN_GRATUITO.falta}</span>
                  </div>
                </div>
              </div>
              {plans.map((p) => {
                const on = plan === p.name;
                return (
                  <div key={p.id} onClick={() => setB({ ...b, eleccion: { modo: 'pago', plan: p.name, aceptaCuota: true } })} style={{ position: 'relative', border: '2px solid ' + (on ? '#5D5491' : '#e6e3f0'), background: on ? '#faf9fd' : '#fff', borderRadius: 18, padding: 20, cursor: 'pointer', transition: '0.15s' }}>
                    {p.featured && <span style={{ position: 'absolute', top: -11, left: 20, background: '#E1FB62', color: '#211E33', fontWeight: 700, fontSize: 11, padding: '4px 12px', borderRadius: 100 }}>MÁS ELEGIDO</span>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18, color: '#5D5491' }}>{p.name}</span>
                      <Radio on={on} />
                    </div>
                    <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginTop: 6 }}>{money(p.basePrice)}<span style={{ fontSize: 13, color: '#8781a0', fontWeight: 500 }}>/mes</span></div>
                    {/* La bajada y los beneficios salen de la BASE, que es lo que el club
                        edita en el panel. Antes había un texto congelado acá que le pasaba
                        por encima a lo que el club escribía. */}
                    <div style={{ fontSize: 13.5, color: '#5b5670', margin: '4px 0 12px' }}>{p.tagline}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 4 }}>
                      {(p.perks ?? []).map((perk) => (
                        <div key={perk} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: '#4a4560' }}>
                          <span style={{ color: '#5D5491', fontWeight: 700, flex: '0 0 auto' }}>✓</span><span>{perk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Una sola vez, y fuera de las tarjetas: la cobertura odontológica es
                una columna del socio (`profiles.addon_odonto`), no del plan. Y solo
                con un plan elegido: sin cuota no hay dónde cobrarla. */}
            {plan ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#5b5670', cursor: 'pointer', background: '#f7f6fa', border: '1px solid #eeecf5', borderRadius: 12, padding: '14px 16px', marginTop: 16 }}>
                <input type="checkbox" checked={b.odonto} onChange={(e) => setB({ ...b, odonto: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#5D5491', flex: '0 0 auto' }} />
                <span>¿Sumar cobertura odontológica? <strong>+{money(ODONTO_PRECIO)}/mes</strong></span>
              </label>
            ) : null}


          </div>
        )}

        {/* PASO 4 · La declaración jurada, una por mascota */}
        {step === 4 && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>Declaración jurada</h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 14px' }}>
              {mascotas.length > 1
                ? 'Contanos cómo está la salud de cada una. Con esta info definimos qué reintegros aplican desde el día uno.'
                : `Contanos cómo está la salud de ${mascotas[0]?.datos.nombre.trim() || 'tu mascota'}. Con esta info definimos qué reintegros aplican desde el día uno.`}
            </p>
            <div style={{ background: '#f0edf9', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#5b5670', marginBottom: 18 }}>Tus respuestas son confidenciales y solo se usan para validar reintegros. Declarar con honestidad protege tu membresía.</div>

            {mascotas.map((m) => (
              <DeclaracionDeMascota
                key={m.uid}
                m={m}
                abierta={(abierta ?? mascotas[0]?.uid) === m.uid}
                onAbrir={() => setAbierta(abierta === m.uid ? null : m.uid)}
                onCambio={(parte) => setMascota(m.uid, parte)}
              />
            ))}

            <div style={{ fontWeight: 700, fontSize: 15, margin: '22px 0 8px' }}>Firma digital</div>
            {/* Una firma para todas: es un solo acto legal con N anexos, y cada
                declaración se guarda con su mascota y esta misma firma. */}
            <p style={{ fontSize: 13, color: '#8781a0', margin: '0 0 8px' }}>Escribí tu nombre completo tal cual figura en tu DNI. Equivale a tu firma según la Ley 25.506.</p>
            <input value={b.firma} onChange={(e) => setB({ ...b, firma: e.target.value })} placeholder="Tu nombre y apellido" style={{ ...input, fontFamily: '"Baloo 2"', fontSize: 18, textAlign: 'center', fontWeight: 700 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#8781a0' }}>Fecha: {todayShort()}</span>
              <span style={{ fontSize: 12, color: b.firma.trim().length > 2 ? '#2f8f5b' : '#8781a0', fontWeight: 600 }}>{b.firma.trim().length > 2 ? '✓ Firma registrada' : 'Pendiente de firma'}</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, fontSize: 13, color: '#5b5670', cursor: 'pointer' }}>
              <input type="checkbox" checked={b.acepta} onChange={(e) => setB({ ...b, acepta: e.target.checked })} style={{ width: 17, height: 17, accentColor: '#5D5491', flex: '0 0 auto', marginTop: 2 }} />
              Declaro bajo juramento que la información {mascotas.length > 1 ? 'de todas mis mascotas ' : ''}es verdadera y completa, y me comprometo a mantener el plan sanitario al día y a notificar cualquier diagnóstico relevante dentro de los 30 días.
            </label>
          </div>
        )}

        {/* PASO 5 · La cuota (solo con plan) */}
        {step === 5 && b.eleccion?.modo === 'pago' && (
          <div>
            <h2 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 28, margin: '0 0 4px' }}>Tu cuota</h2>
            <p style={{ color: '#8781a0', fontSize: 15, margin: '0 0 22px' }}>Incluye IVA. Sin permanencia.</p>
            <div style={{ background: '#5D5491', borderRadius: 16, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ color: '#c9c3e3', fontSize: 13 }}>Plan {plan}{b.odonto ? ' + odontológica' : ''}</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Cuota mensual</div>
              </div>
              <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, color: '#E1FB62' }}>{money(planPrice)}</div>
            </div>

            {/*
              * Ya no se piden ni la tarjeta ni el CBU.
              *
              * La tarjeta se tipea en el sitio de Mercado Pago —así no pasa por Kumo y
              * no hay nada que podamos filtrar—, y el CBU era para los REINTEGROS: se
              * pide al cargar el primero, que es cuando recién hace falta.
              */}
            <div style={{ background: '#f7f6fa', border: '1px solid #eeecf5', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: '#211E33', marginBottom: 6 }}>Vas a pagar con Mercado Pago</div>
              <p style={{ fontSize: 13, color: '#5b5670', lineHeight: 1.55, margin: 0 }}>
                Al confirmar te llevamos a Mercado Pago para autorizar el débito automático. Los datos de tu
                tarjeta no pasan por Kumo, y podés darlo de baja cuando quieras desde Mi perfil.
              </p>
            </div>

            {/* Las condiciones van a la vista, arriba del botón, en vez de detrás de un
                tilde: el gesto de aceptar es tocar "Ir a Mercado Pago". El texto tiene
                que quedar SIEMPRE —es lo que hace que la aceptación valga— pero el
                tilde era un toque más entre el socio y el pago. */}
            <p style={{ fontSize: 12.5, color: '#8781a0', lineHeight: 1.55, margin: '4px 0 0' }}>
              Al continuar aceptás el contrato de membresía: la cuota se actualiza cada 3 meses según IPC y los plazos de carencia son de 60, 90 y 180 días. Tenés 10 días de arrepentimiento (Ley 24.240).
            </p>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, #f5f4f8 60%, transparent)', padding: '18px 20px 24px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <button onClick={next} disabled={!canNext} style={{ width: '100%', background: canNext ? '#5D5491' : '#c9c3e3', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: 16, borderRadius: 14, boxShadow: canNext ? '0 8px 20px rgba(93,84,145,0.28)' : 'none', cursor: canNext ? 'pointer' : 'not-allowed', transition: '0.15s' }}>
            {tituloCTA}
          </button>
          {!canNext && <div style={{ textAlign: 'center', fontSize: 12.5, color: '#8781a0', marginTop: 8 }}>Completá los datos para continuar.</div>}
          {/* El error del alta ahora puede pasar sin sheet abierto: sin esto, el socio
              tocaba el botón y no pasaba nada visible. */}
          {submitError && !confirmOpen && <div style={{ background: '#fbe8ef', color: '#c14d7a', fontSize: 13, lineHeight: 1.45, borderRadius: 10, padding: '10px 12px', marginTop: 10 }}>{submitError}</div>}
        </div>
      </div>

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
              <p style={{ color: '#8781a0', fontSize: 14, lineHeight: 1.5, margin: '0 auto 20px', maxWidth: 420 }}>
                {gratis
                  ? 'Revisá los datos antes de confirmar. Podés sumarte a un plan cuando quieras.'
                  : 'Revisá los datos antes de confirmar. Después te llevamos a Mercado Pago para autorizar el débito.'}
              </p>
            </div>
            <div style={{ border: '1px solid #eeecf5', borderRadius: 14, padding: '4px 16px', marginBottom: 18 }}>
              {[
                ['Socio', socio.nombre || '—'],
                [mascotas.length > 1 ? 'Mascotas' : 'Mascota', mascotas.map((m) => m.datos.nombre.trim() || '—').join(', ')],
                ['Plan', gratis ? 'Gratuito' : (plan ?? '—')],
                ...(gratis ? [] : [['Cuota mensual', money(planPrice)] as [string, string]]),
                ['Firma digital', b.firma || '—'],
              ].map(([k, val]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #f0eef7', fontSize: 14 }}>
                  <span style={{ color: '#8781a0' }}>{k}</span><span style={{ fontWeight: 700, color: '#211E33', textAlign: 'right' }}>{val}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: '#a29dba', lineHeight: 1.5, margin: '0 0 18px' }}>Al confirmar aceptás el contrato de membresía y la declaración jurada firmada en el paso anterior. Tenés 10 días de arrepentimiento (Ley 24.240).</p>
            {submitError && <div style={{ background: '#fbe8ef', color: '#c14d7a', fontSize: 13, borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>{submitError}</div>}
            <button onClick={confirmAlta} disabled={submitting} style={{ width: '100%', background: '#5D5491', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: 15, borderRadius: 14, boxShadow: '0 8px 20px rgba(93,84,145,0.28)', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, marginBottom: 10 }}>
              {submitting ? 'Creando tu cuenta…' : gratis ? 'Confirmar y unirme' : 'Confirmar e ir a pagar'}
            </button>
            <button onClick={() => setConfirmOpen(false)} disabled={submitting} style={{ width: '100%', background: 'none', border: 'none', color: '#8781a0', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, padding: 8, cursor: 'pointer' }}>Revisar mis datos</button>
          </div>
        </div>
      )}
    </div>
  );
}
