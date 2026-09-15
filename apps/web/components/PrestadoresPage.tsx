'use client';
import type { CSSProperties, ReactNode } from 'react';

import { useState } from 'react';
import { EMPRESA, FOTO_TIPOS, RUBROS, partirZona, type ProviderCategory } from '@kumo/shared';
import { CampoDomicilio, CampoZona } from '@/components/CampoDomicilio';
import { prepararFoto } from '@/lib/foto';

/*
 * Landing de PRESTADORES — se abre desde "Quiero ofrecer servicios →" de la landing
 * principal. Reproduce la página del prototipo (badge "Prestadores", hero morado,
 * stats, beneficios, 3 pasos, planes Básico/Pro y CTA) + el modal "Sumate como
 * prestador" (alta de rubro + cuenta). Presentado como página web completa.
 */

const BRAND = '#5D5491';
const LIME = '#E1FB62';
const INK = '#211E33';

const baloo = (size: number, color = INK): CSSProperties => ({ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: size, color, margin: 0, letterSpacing: '-0.01em' });
const label: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#5b5670', marginBottom: 6 };
const input: CSSProperties = { width: '100%', padding: '13px 14px', border: '1.5px solid #e6e3f0', borderRadius: 12, fontSize: 15, background: '#fff', color: INK, outline: 'none', fontFamily: '"DM Sans"', boxSizing: 'border-box' };

const S = ({ d, size = 22, color = BRAND }: { d: ReactNode; size?: number; color?: string }) => (
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
  cruz: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  tienda: <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>,
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
/**
 * El ícono de cada rubro. La LISTA sale de `@kumo/shared`, no de acá.
 *
 * Esta pantalla tenía la suya escrita a mano, con seis rubros y "Otro" en
 * singular, y eso rompía dos cosas: Veterinaria no se podía elegir desde la
 * landing —existía en el tipo y en el alta de adentro de la app— y el que
 * elegía "Otro" quedaba con una categoría que no es ninguna de las siete, así
 * que el filtro de Servicios, que compara el texto exacto, no lo mostraba nunca.
 * Es el mismo error que ya se había arreglado juntando las listas de la webapp y
 * la app: ver el comentario de RUBROS en types.ts.
 */
const ICONO_RUBRO: Record<ProviderCategory, keyof typeof IC> = {
  Paseador: 'paw', Guardería: 'house', Adiestrador: 'idcard', 'Baño y estética': 'droplet',
  Cuidador: 'person', Veterinaria: 'cruz', Otros: 'tienda',
};

/** La ayuda gris debajo de un campo: por qué conviene llenarlo, en una línea. */
const ayuda: CSSProperties = { fontSize: 12, color: '#8781a0', margin: '6px 0 14px', lineHeight: 1.45 };
const opcional = <span style={{ fontWeight: 500, color: '#a29dba' }}>(opcional)</span>;
const subirIcono = <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>;

/**
 * "Sumate como prestador".
 *
 * Hasta el 15/09/2026 esto era una maqueta: los campos no estaban conectados a
 * nada y el botón sólo mostraba "¡Solicitud enviada! Te contactamos en 48 hs".
 * Quien lo completaba quedaba esperando una respuesta que nadie iba a mandar,
 * porque el club nunca se enteraba. Se descubrió porque alguien preguntó por qué
 * no aparecía.
 *
 * Ahora la solicitud se guarda de verdad: entra como ficha `pendiente` y el club
 * la ve en el panel, igual que las que se cargan desde adentro de la app.
 *
 * Y pide LO MISMO que el alta de adentro (`Prestar`, en la webapp del socio):
 * dirección, Instagram, sitio, tarifa, logo y portada. El que entra por acá no
 * tiene cuenta para volver después a completar la ficha, así que lo que no se
 * pregunte hoy no se pregunta nunca: sale publicado sin foto, sin precio y sin
 * pin en el mapa. La dirección es la que lo ubica en el mapa, y por eso el campo
 * explica para qué es en vez de pedirla a secas.
 *
 * Se fueron el mail y la contraseña. Prometían "crear tu cuenta de prestador", y
 * crear cuentas desde un formulario público es otra cosa —verificación, mails
 * repetidos, el alta de socio entera— que no hace falta para lo que el texto
 * promete: que el club se ponga en contacto. El canal es el WhatsApp, que es el
 * que el club usa en todo el producto, y por eso ahora es obligatorio.
 */
function RegModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rubro, setRubro] = useState<string>(RUBROS[0]!);
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState('');
  /** Opcional, y es lo único que pone el pin en el mapa: ver el aviso debajo del
   *  campo y `consultasDeComercio` en lib/geocodificar. */
  const [direccion, setDireccion] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [sitio, setSitio] = useState('');
  const [precio, setPrecio] = useState('');
  const [unidad, setUnidad] = useState('');
  const [about, setAbout] = useState('');
  /* Las dos imágenes del negocio, con los mismos nombres y las mismas formas que
     adentro de la app: el logo cuadrado porque va a ser el avatar, la portada
     ancha porque es la banda de arriba de la ficha. */
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [portada, setPortada] = useState<File | null>(null);
  const [portadaPreview, setPortadaPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  /** Valida y previsualiza. `prepararFoto` achica la foto acá, en el navegador:
   *  una sacada con el teléfono pesa varios MB y si no se achica el envío muere
   *  en el último paso, con el formulario entero ya completo. */
  const elegirImagen = (cual: 'logo' | 'portada') => async (elegida?: File) => {
    if (!elegida) return;
    const listo = await prepararFoto(elegida);
    if ('error' in listo) { setError(listo.error); return; }
    setError('');
    if (cual === 'logo') { setLogo(listo.file); setLogoPreview(URL.createObjectURL(listo.file)); }
    else { setPortada(listo.file); setPortadaPreview(URL.createObjectURL(listo.file)); }
  };

  const enviar = async () => {
    setBusy(true);
    setError('');
    try {
      /* FormData y no JSON porque van las dos imágenes. Los campos vacíos viajan
         igual y el servidor los guarda como null. */
      const datos = new FormData();
      Object.entries({ rubro, nombre, zona, direccion, whatsapp, instagram, sitio, precio, unidad, about })
        .forEach(([k, v]) => datos.append(k, v));
      if (logo) datos.append('logo', logo);
      if (portada) datos.append('portada', portada);

      const res = await fetch('/api/prestadores/solicitud', { method: 'POST', body: datos });
      const respuesta = await res.json();
      /* El cartel de éxito se muestra SÓLO si el servidor confirmó. Que esa
         pantalla apareciera sin haber guardado nada era el bug. */
      if (!res.ok) { setError(respuesta.error ?? 'No pudimos enviar tu solicitud.'); setBusy(false); return; }
      setSent(true);
    } catch {
      setError('No pudimos enviar tu solicitud. Revisá la conexión.');
    }
    setBusy(false);
  };

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(33,30,51,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 24, padding: 30, margin: 'auto', boxShadow: '0 30px 70px rgba(33,30,51,0.4)', position: 'relative', animation: 'kpop 0.18s ease-out' }}>
        <button onClick={onClose} aria-label="Cerrar" style={{ position: 'absolute', top: 18, right: 18, width: 34, height: 34, border: 'none', background: '#f0edf9', borderRadius: 10, cursor: 'pointer', color: BRAND, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#eef7d6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}><S d={<path d="M4 12l5 5L20 6" />} size={30} color="#6f9a1f" /></div>
            <h2 style={baloo(24)}>¡Solicitud enviada!</h2>
            {/* Sin plazo. "48 hs" era una promesa que nadie del club se había
                comprometido a cumplir, y encima sobre solicitudes que no
                llegaban. */}
            <p style={{ color: '#5b5670', fontSize: 15, lineHeight: 1.55, margin: '10px auto 22px', maxWidth: 360 }}>El club revisa tus datos y te escribe por WhatsApp para activar tu perfil de prestador.</p>
            <button onClick={onClose} style={{ background: BRAND, color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: '13px 26px', borderRadius: 13, cursor: 'pointer' }}>Volver</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              {/* La K de la marca, igual que en el modal de ingreso: acá había la
                  misma gotita dibujada a mano, que no es el logo de nada. */}
              <div style={{ width: 32, height: 32, borderRadius: 10, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, lineHeight: 1, color: LIME }}>K</span></div>
              <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, color: BRAND }}>Kumo</span>
            </div>
            <h2 style={{ ...baloo(24), margin: '6px 0 4px' }}>Sumate como prestador</h2>
            <p style={{ color: '#8781a0', fontSize: 14, margin: '0 0 20px' }}>Elegí tu rubro y contanos sobre tu servicio. El club valida los datos antes de publicarlo.</p>

            <label style={label}>¿Qué servicio ofrecés?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {RUBROS.map((r) => {
                const on = rubro === r;
                return (
                  <button key={r} type="button" onClick={() => setRubro(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 13, border: '1.5px solid ' + (on ? BRAND : '#e6e3f0'), background: on ? '#faf9fd' : '#fff', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, color: INK, textAlign: 'left' }}>
                    <S d={IC[ICONO_RUBRO[r]]} size={19} /> {r}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: 14 }}><label style={label}>Nombre o empresa</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Paseos Palermo / Lucas M." style={input} /></div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={label}>Zona</label>
                {/* De la lista y no a mano: el filtro por zona de Servicios compara
                    texto, así que "Palermo" y "Palermo, CABA" eran dos zonas
                    distintas y el socio veía media lista. */}
                <CampoZona valor={zona} onCambio={setZona} onElegir={(z) => setZona(z.zona)} placeholder="Palermo, CABA" style={input} />
              </div>
              {/* El WhatsApp pasa a ser obligatorio: es el único modo que tiene el
                  club de contestar, porque acá no se pide mail. */}
              <div style={{ flex: '1 1 160px' }}><label style={label}>WhatsApp</label><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+54 11 ..." style={input} /></div>
            </div>

            <label style={label}>Dirección {opcional}</label>
            <CampoDomicilio valor={direccion} {...partirZona(zona)} onCambio={setDireccion} onElegir={(l) => setDireccion(l.domicilio)} placeholder="Av. Santa Fe 3200" style={input} />
            <p style={ayuda}>Si atendés en un local, ponela: es lo que te ubica en el mapa de los socios. Si trabajás a domicilio, dejala vacía y te encuentran por zona.</p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}><label style={label}>Instagram {opcional}</label><input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@tunegocio" style={input} /></div>
              <div style={{ flex: '1 1 160px' }}><label style={label}>Sitio web {opcional}</label><input value={sitio} onChange={(e) => setSitio(e.target.value)} placeholder="tunegocio.com.ar" style={input} /></div>
            </div>

            <label style={label}>Tarifa {opcional}</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="numeric" placeholder="4500" style={{ ...input, flex: '1 1 110px', width: 'auto' }} />
              <input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="/paseo" style={{ ...input, flex: '1 1 110px', width: 'auto' }} />
            </div>
            <p style={ayuda}>Si no la ponés, tu ficha no muestra precio (mejor eso que mostrar &quot;$0&quot;).</p>

            <div style={{ marginBottom: 18 }}><label style={label}>Contanos sobre tu servicio</label><textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Experiencia, disponibilidad, precios de referencia…" style={{ ...input, minHeight: 92, resize: 'vertical' }} /></div>

            {/* Las cajas tienen la forma del lugar donde se va a ver cada imagen —el
                logo chico y cuadrado, la portada ancha—, así nadie sube un logo
                apaisado. */}
            <label style={label}>Logo de la marca {opcional}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <label style={{ display: 'flex', width: 92, height: 92, flex: 'none', border: '2px dashed #e6e3f0', borderRadius: 16, alignItems: 'center', justifyContent: 'center', background: logoPreview ? `url(${logoPreview}) center/cover` : '#fafaf9', cursor: 'pointer', overflow: 'hidden' }}>
                <input type="file" accept={FOTO_TIPOS.join(',')} onChange={(e) => elegirImagen('logo')(e.target.files?.[0])} style={{ display: 'none' }} />
                {!logoPreview && <S d={subirIcono} size={20} color="#a29dba" />}
              </label>
              <div style={{ fontSize: 12, color: '#8781a0', lineHeight: 1.45 }}>Cuadrado. Es el redondel de tu ficha y el cuadradito del listado de Servicios. Si no lo subís, se usa la portada.</div>
            </div>

            <label style={label}>Foto de portada {opcional}</label>
            <label style={{ display: 'flex', width: '100%', height: 140, border: '2px dashed #e6e3f0', borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: portadaPreview ? `url(${portadaPreview}) center/cover` : '#fafaf9', cursor: 'pointer', overflow: 'hidden', boxSizing: 'border-box' }}>
              <input type="file" accept={FOTO_TIPOS.join(',')} onChange={(e) => elegirImagen('portada')(e.target.files?.[0])} style={{ display: 'none' }} />
              {!portadaPreview && (
                <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><S d={subirIcono} size={22} color="#a29dba" /></div>
                  <div style={{ fontSize: 12, color: '#8781a0' }}>Subir portada</div>
                </div>
              )}
            </label>
            <p style={ayuda}>La banda de arriba de tu ficha.</p>

            {error && <div style={{ background: '#fbe8ef', color: '#c14d7a', fontSize: 13.5, borderRadius: 12, padding: '11px 13px', marginBottom: 14 }}>{error}</div>}

            <button onClick={enviar} disabled={busy} style={{ width: '100%', background: busy ? '#c7c1de' : BRAND, color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: 15, borderRadius: 14, boxShadow: '0 8px 20px rgba(93,84,145,0.28)', cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
            <p style={{ color: '#8781a0', fontSize: 12.5, lineHeight: 1.5, margin: '12px 0 0', textAlign: 'center' }}>No hace falta crear una cuenta: el club te escribe por WhatsApp.</p>
          </>
        )}
      </div>
    </div>
  );
}

export function PrestadoresPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [reg, setReg] = useState(false);
  if (!open) return null;
  const limeBtn: CSSProperties = { background: LIME, color: INK, border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 16, padding: '15px 28px', borderRadius: 14, cursor: 'pointer', display: 'inline-block' };
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
          <span style={{ fontSize: 12.5, color: '#a29dba', maxWidth: 560, textAlign: 'right' }}>
            {EMPRESA.legal} <span style={{ whiteSpace: 'nowrap' }}>{EMPRESA.cuit}.</span>
          </span>
        </div>
      </div>

      <RegModal open={reg} onClose={() => setReg(false)} />
    </div>
  );
}
