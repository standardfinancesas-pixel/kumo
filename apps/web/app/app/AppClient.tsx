'use client';
import type { CSSProperties, FormEvent, ReactNode } from 'react';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  urls, FOTO_TIPOS, PROVINCIAS, RUBROS, partirZona, avisoZonaLejos,
  buildNotifs, contarNoLeidas, notifTiempo, NOTIF_STYLE, type NotifInput, type NotifGroup, type Notif,
  ODONTO_PRECIO, buildCalMes, buildPickerMes, calMesLabel, calDiaLabel, fmtFechaCorta, hoyISO, CAL_TONE, CAL_DIAS, VACUNA_KINDS, KIND_ICON,
  PAGO_ESTADO, PAGO_MEDIO, type EstadoPago, type MedioPago,
  ratingLabel, urlSitio, urlInstagram, urlTel, urlMapaWeb, precioTexto, reviewTiempo, reintPasos, pasoWhen, REINT_TONE, buildPetHistory,
  HEALTH_Q, SANITARIO_Q, armarDeclaracion, rutaFoto, MOTIVOS_REPORTE,
  type CalCell, type VaccineKind, type Review,
  FEATURES_PAGAS, tieneFeaturesPagas, estadoCuota, copyCuota, ESPERA_PAGO, INVITACION_PLAN, BANNER_PLAN,
  FORO_CATEGORIAS, FORO_CATEGORIA_DEFECTO, FORO_FILTROS,
  destinoDeTransferencia, destinoParaMostrar, motivoDatosBancariosIncompletos, parchePerfilBancario, hayDatosBancarios, pareceCbu, cbuValido, distanciaKm,
  type FeaturePaga,
  filaDeVacuna, parcheDeVacuna, formDeVacuna, type FormVacuna,
} from '@kumo/shared';
import { supabase } from '@/lib/supabase-browser';
import { prepararFoto } from '@/lib/foto';
import { confirmarPago } from '@/lib/confirmarPago';
import { MapaPrestadores } from '@/components/MapaPrestadores';
import { CampoDomicilio, CampoZona } from '@/components/CampoDomicilio';

/*
 * Webapp del socio — vista "App compu" del prototipo (reference/kumo-prototype.html).
 * Shell con sidebar + navegación entre pantallas. Reproducción 1:1, dinámica.
 * Pantallas listas: Inicio, Carnet. El resto se va completando.
 */

/** Landing: login, planes y destino al cerrar sesión. */
const LANDING = urls.landing;

/** WhatsApp del club. Pendiente: sacarlo de `club_settings`, que es donde el panel
 *  lo edita — hoy también está escrito a mano en la pantalla de ayuda. */
const WHATSAPP = '5491125168802';

/**
 * Le pide al servidor que mande un mail: la API key de Resend no puede llegar al
 * navegador, así que la escritura la sigue haciendo Supabase desde acá y el aviso
 * pasa por `/api/avisos`.
 *
 * No hace fallar nada: cuando se llama, lo que el socio pidió ya está hecho. Un
 * mail que no sale no es motivo para mostrarle un error sobre algo que sí
 * funcionó, así que se dispara sin esperarlo (`void`) y se traga la excepción.
 */
async function avisar(tipo: string, id?: string) {
  try {
    await fetch('/api/avisos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id }),
    });
  } catch {
    /* sin conexión: el socio no tiene por qué enterarse por esto */
  }
}

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

const NAV_TODO: { key: Screen; label: string; icon: ReactNode }[] = [
  { key: 'inicio', label: 'Inicio', icon: ic(house) },
  { key: 'carnet', label: 'Carnet', icon: ic(plusCircle) },
  { key: 'servicios', label: 'Servicios', icon: ic(paw, true) },
  { key: 'reintegros', label: 'Reintegros', icon: ic(wallet) },
  { key: 'beneficios', label: 'Beneficios', icon: ic(idCard) },
  { key: 'foros', label: 'Foros', icon: ic(chat) },
  { key: 'negocio', label: 'Mi negocio', icon: ic(house) },
  { key: 'perfil', label: 'Mi perfil', icon: ic(person) },
];

/**
 * El menú del socio gratuito no tiene Reintegros ni Beneficios.
 *
 * No es un candado: la sección no está. Un candado invita a golpearlo y además
 * obliga a mantener una pantalla que no se puede usar; esto es lo que decidió el
 * club. Lo que se paga está en `FEATURES_PAGAS` de `@kumo/shared`, así que la app
 * del celular filtra su barra contra la misma lista.
 */
const navDe = (pago: boolean) =>
  pago ? NAV_TODO : NAV_TODO.filter((n) => !FEATURES_PAGAS.includes(n.key as FeaturePaga));

/* ── Datos (mock del prototipo) ────────────────────────────────── */
/** `appliedOn`/`dueOn` van crudas además de formateadas en `sub`: el calendario las necesita para ubicar el día. */
export type Vac = { id: string; name: string; kind: VaccineKind; sub: string; status: string; tone: 'green' | 'lime' | 'amber'; appliedOn: string | null; dueOn: string | null; reminder?: string; mark?: boolean };
/** El sello del carnet: lo decide `selloCarnet` de shared, no la pantalla. */
export type SelloVM = { texto: string; tono: 'ok' | 'neutro' | 'alerta' };
/** `plan`, `odonto` y `sello` son datos del SOCIO, no de la mascota: el carnet los
 *  muestra porque es la credencial de la membresía. Llegan ya resueltos desde el
 *  servidor —antes `odonto` y el sello estaban escritos fijos en la pantalla—. */
export type Pet = { id: string; name: string; plan: string; socio: string; photo: string; breed: string; microchip: string; castrado: string; odonto: string; sello: SelloVM; vaccines: Vac[] };
export type EmergencyContact = { id: string; name: string; phone: string; type: string; address: string; hours: string };
/** `lat`/`lng` viajan además de `km`: la distancia sirve para ordenar la lista, pero
 *  para dibujar el pin en el mapa hace falta la coordenada. Pueden ser null — un
 *  prestador cargado a mano por el club puede no tenerlas — y ahí no se dibuja. */
/** `km` es null cuando el prestador no tiene coordenadas: a qué distancia está no
 *  se sabe, y por eso no se muestra ni se usa para filtrar (pero el prestador
 *  aparece igual en la lista). `kmDesde` es el texto de desde dónde se mide —"de tu
 *  casa", "de tu zona", "del centro"—, que lo decide el servidor según cuánto pudo
 *  resolver del domicilio del socio. */
export type ProviderVM = { id: string; name: string; category: string; zone: string; address: string; phone: string; instagram: string | null; website: string | null; about: string; rating: number; reviews: number; price: number; priceUnit: string; photoUrl: string | null; logoUrl: string | null; km: number | null; kmDesde: string; lat: number | null; lng: number | null; verificado: boolean; badge?: string };
/** La ficha del beneficio necesita todo lo que la tabla ya guardaba y no se usaba:
 *  descripción, zona, días, horario y vigencia. */
export type BenefitVM = {
  id: string; name: string; category: string; discount: string; icon: 'cross' | 'store' | 'tag' | 'droplet';
  description: string; zone: string; days: string[]; hours: string; validUntil: string | null; planRequirement: string;
  /** La dirección del comercio y a qué distancia le queda al socio. `km` es null
   *  cuando el club no cargó dirección: ahí no se muestra distancia, igual que con
   *  los prestadores. */
  address: string | null; km: number | null; kmDesde: string;
  /** Para el pin en el mapa. Null cuando no hay dirección cargada. */
  lat: number | null; lng: number | null;
};
/**
 * Una cuota cobrada, como la ve el socio.
 *
 * `cubreHasta` es el dato que convierte la lista en algo útil: no alcanza con "pagué
 * $18.000 el 19 de agosto", lo que importa es hasta cuándo llegó ese pago. Y el plan
 * queda congelado en la fila porque el precio cambia y un pago tiene que poder
 * explicarse solo dentro de dos años.
 */
export type PagoVM = {
  id: string; fecha: string; monto: number; plan: string | null;
  estado: EstadoPago; medio: MedioPago; cubreHasta: string | null; detalle: string | null;
};
/** El negocio propio del socio: puede estar pendiente de validación o rechazado, así que no sale del listado de prestadores verificados. */
export type MiNegocio = { id: string; name: string; category: string; zone: string; /** La dirección del local, si atiende en uno: es lo que lo pone en el mapa. */ address: string | null; phone: string | null; about: string; status: string; rating: number; reviews: number; price: number | null; priceUnit: string | null; instagram: string | null; website: string | null; /** La portada de su ficha. Null = todavia no subio ninguna, y no se le inventa una. */ photoUrl: string | null; /** El logo cuadrado. Null = no subio, se usa la portada. */ logoUrl: string | null };
export type ForumAnswer = { id: string; author: string; when: string; text: string; likes: number; best: boolean; propia: boolean };
export type ForumPost = { id: string; cat: string; trend: boolean; author: string; meta: string; title: string; body: string; photo: string | null; replies: number; likes: number; answers: ForumAnswer[]; propia: boolean };
/** Lo que likeó el socio, para pintar el corazón y no contar dos veces. */
export type MisLikes = { posts: string[]; answers: string[] };

/** Los planes del club, para el cambio de membresía. */
export type PlanVM = { id: string; name: string; price: number; tagline: string };

/** Datos del socio logueado, resueltos en el Server Component (app/page.tsx). */
/** La cuenta donde el club le transfiere los reintegros. Se pide en el alta y el
 *  formulario de reintegro la prefija, así no se retipea en cada solicitud. */
export type ProfileBanco = { holder: string | null; holderDni: string | null; cuit: string | null; banco: string | null; cbu: string | null; alias: string | null };

/** `planPrice` es la cuota que el socio aceptó al firmar (plan + add-ons), no el
 *  precio de lista del plan: con la cobertura odontológica paga $12.000 más. */
export type Profile = { id: string; firstName: string; fullName: string; memberNo: number | null; planName: string; planPrice: number; addonOdonto: boolean; email: string; phone: string | null; address: string | null; city: string | null; province: string | null; dni: string | null; banco: ProfileBanco; tarjeta: string | null };

/** El estado de la cuota, calculado en el servidor (`paid_until` contra hoy). */
export type CuotaVM = { debePagar: boolean; hasta: string | null; monto: number; planName: string; odonto: boolean; enCurso: boolean; suscripcion: 'pending' | 'authorized' | 'paused' | 'cancelled' | null };

/* ── La hoja del plan ──────────────────────────────────────────── */
/**
 * Elegir un plan y activar el débito. Antes era un muro; ahora es una hoja.
 *
 * El cambio no es de estilo: entrar a Kumo es gratis y lo que se paga son los
 * reintegros y los beneficios, así que dejar de mostrar la app a quien no pagó
 * pasó a ser mentira sobre lo que ofrece el club. Se conservan las tripas —el
 * selector de plan, el add-on, el pago y la espera del aviso de Mercado Pago—,
 * y se va la jaula: tiene cerrar, no bloquea el scroll de atrás y ya no ofrece
 * cerrar sesión (esa salida existía porque la persona estaba encerrada).
 *
 * Lo que se manda al servidor es el NOMBRE del plan y el sí/no del add-on. El
 * precio lo pone el servidor: si el monto saliera de acá, cualquiera se
 * suscribiría por $1. Y el acceso lo da el aviso de Mercado Pago, nunca esta
 * pantalla ni la URL de vuelta.
 */
function HojaPlan({ cuota, nombre, planes, onClose, irABeneficios }: { cuota: CuotaVM; nombre: string; planes: PlanVM[]; onClose: () => void; irABeneficios: () => void }) {
  const router = useRouter();
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState('');
  /** El aviso de "tu cuota cambió": no es un error ni una espera, es que ya está hecho. */
  const [actualizado, setActualizado] = useState('');
  const [volviendoDeMP, setVolviendoDeMP] = useState(false);
  const [intentos, setIntentos] = useState(0);
  /*
   * El plan arranca en el que el socio ya tenía, si tenía alguno.
   *
   * Ojo con el socio gratuito: su `planName` llega como '—', y preseleccionarlo
   * hacía que el botón mandara `{plan:'—'}` y el servidor respondiera "ese plan no
   * existe". Con el alta vieja no pasaba nunca porque el plan era obligatorio; con
   * el alta gratuita es el caso normal.
   */
  const conPlanPrevio = cuota.planName && cuota.planName !== '—';
  const [planSel, setPlanSel] = useState(conPlanPrevio ? cuota.planName : '');
  const [odonto, setOdonto] = useState(cuota.odonto);
  const elegido = planes.find((p) => p.name === planSel);
  const total = (elegido?.price ?? 0) + (odonto ? ODONTO_PRECIO : 0);

  /*
   * Vuelta de Mercado Pago. Nada de esto da acceso —son parámetros de una URL, los
   * puede tipear cualquiera—: lo único que hacen es poner la pantalla a esperar el
   * aviso de MP, que es quien acredita de verdad.
   *
   * Se reconocen dos vueltas distintas: `pago` lo pone nuestro `back_urls` del pago
   * único, y `preapproval_id` lo pone MERCADO PAGO al volver de la suscripción.
   */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('pago');
    if (p === 'ok' || p === 'pendiente' || q.has('preapproval_id')) setVolviendoDeMP(true);
    if (p === 'error') setError('El pago no se pudo hacer. Probá de nuevo o con otra tarjeta.');
  }, []);

  const estado = estadoCuota({
    hasta: cuota.hasta,
    debePagar: cuota.debePagar,
    suscripcion: cuota.suscripcion,
    pagoPendiente: cuota.enCurso,
    volviendoDeMP,
  });
  const copy = copyCuota(estado, nombre, cuota.hasta);
  /*
   * "Activando" se trata como esperar, no como elegir: el socio ya compró un plan y
   * está entrando el primer cobro. Sin esto la hoja le mostraba otra vez la lista de
   * planes con el título "tu plan quedó activo" arriba — le ofrecía comprar lo que
   * acababa de comprar.
   */
  const activando = estado === 'activando';
  const esperando = estado === 'confirmando' || activando;

  /*
   * Cada pasada le PREGUNTA a Mercado Pago cómo salió el cobro, en vez de esperar
   * que avise. Cuatro decisiones que NO son opcionales:
   *
   * · La primera pasada va sin demora. Medido el 19/08 con una suscripción real: MP
   *   debitó 18 segundos después de autorizar y su aviso llegó 1:41 más tarde, así
   *   que cuando el socio vuelve el cobro ya existe y preguntando se resuelve en el
   *   acto. Sondear la base sola no servía: no cambia hasta que llega el aviso.
   * · La ventana sigue siendo de 3 minutos (`ESPERA_PAGO`), para el que autorizó y
   *   volvió antes de que MP debitara. Eran 30 segundos y no alcanzaban: el socio
   *   pagaba bien y leía "está tardando", que es lo que empuja a pagar dos veces.
   * · Escalonado: los primeros 30 segundos cada 3, después cada 6. Pareja a 3
   *   segundos son 60 recargas, y `/app` hace una docena de consultas en cada una.
   * · Hay límite. La primera versión recargaba sin fin y dejaba al socio en una
   *   pantalla que no se podía ni leer.
   *
   * A diferencia del muro, esperar no bloquea nada: el socio ya está adentro.
   */
  /*
   * Cada pasada le PREGUNTA a Mercado Pago en vez de esperar que avise.
   *
   * La primera va sin demora, y ahí se resuelve el caso normal: medido contra la
   * cuenta real, MP debita 18 segundos después de autorizar, así que cuando el socio
   * vuelve el cobro ya existe — lo que tardaba 2 minutos era el aviso, no la plata.
   * Sondear la base sola no alcanzaba: la base no cambia hasta que llega el aviso.
   *
   * Las pasadas siguientes cubren al que autorizó y volvió antes de que MP debitara.
   * Sigue escalonado y con límite (`ESPERA_PAGO`), y sigue sin bloquear nada: el socio
   * ya está adentro.
   */
  useEffect(() => {
    if (!esperando || intentos >= ESPERA_PAGO.limite) return;
    const espera = intentos === 0
      ? 0
      : intentos < ESPERA_PAGO.rapidos ? ESPERA_PAGO.msRapido : ESPERA_PAGO.msLento;
    let vivo = true;
    const t = setTimeout(async () => {
      await confirmarPago();
      if (!vivo) return;
      setIntentos((n) => n + 1);
      router.refresh();
    }, espera);
    return () => { vivo = false; clearTimeout(t); };
  }, [esperando, intentos, router]);

  const pagar = async () => {
    if (!planSel) { setError('Elegí un plan para activar tu cuota.'); return; }
    setYendo(true); setError('');
    try {
      const res = await fetch('/api/pagos/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planSel, odonto }),
      });
      const data = await res.json();
      /*
       * Cambió de plan teniendo el débito ya autorizado: el servidor le cambió el
       * monto en Mercado Pago y no hay nada que ir a autorizar. Se lo dice acá mismo,
       * porque un botón de pagar que no lleva a ninguna parte y no explica nada se lee
       * como que no funcionó.
       */
      if (data.actualizada) {
        setActualizado(`Listo: tu cuota pasa a $${Number(data.monto).toLocaleString('es-AR')} por mes y se debita desde el próximo cobro. Nada que autorizar de nuevo.`);
        setYendo(false);
        router.refresh();
        return;
      }
      if (!res.ok || !data.initPoint) { setError(data.error ?? 'No pudimos abrir el pago.'); setYendo(false); return; }
      window.location.href = data.initPoint;
    } catch {
      setError('No pudimos abrir el pago. Revisá la conexión.');
      setYendo(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-titulo"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(33,30,51,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 22, maxWidth: 440, width: '100%', padding: '24px 26px 22px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, color: 'rgb(93,84,145)' }}>Kumo</div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a29dba', fontSize: 22, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <h2 id="plan-titulo" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, color: 'rgb(33,30,51)', margin: '0 0 8px' }}>{copy.titulo}</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgb(91,86,112)', margin: '0 0 18px' }}>{copy.cuerpo}</p>

        {estado === 'listo' ? (
          <button onClick={irABeneficios} style={{ width: '100%', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15.5, padding: '15px 20px', borderRadius: 14, cursor: 'pointer' }}>
            {copy.cta} →
          </button>
        ) : esperando ? (
          <>
            {activando ? (
              /* Sin spinner: la suscripción ya quedó activa y el cobro es un trámite
                 nuestro con Mercado Pago. Un spinner acá dice "no te vayas". */
              <button onClick={onClose} style={{ width: '100%', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15.5, padding: '15px 20px', borderRadius: 14, cursor: 'pointer' }}>
                {copy.cta} →
              </button>
            ) : intentos < ESPERA_PAGO.limite ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgb(240,237,249)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, color: 'rgb(93,84,145)', fontWeight: 600 }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgb(93,84,145)', borderTopColor: 'transparent', animation: 'kspin 0.9s linear infinite', flex: '0 0 auto' }} />
                Esperando la confirmación…
              </div>
            ) : (
              <>
                {/* Se agotó la espera. Lo importante del texto: que NO pague de
                    nuevo. Un socio que ve una pantalla trabada después de pagar
                    vuelve a pagar, y ahí el problema pasa a ser plata. */}
                <div style={{ background: 'rgb(251,243,226)', color: 'rgb(146,105,10)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}>
                  Está tardando más de lo normal. Si ya autorizaste el pago, se activa solo cuando Mercado Pago nos confirme: <strong>no hace falta pagar de nuevo</strong>.
                </div>
                <button onClick={() => setIntentos(0)} style={{ width: '100%', background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 14.5, padding: '13px 18px', borderRadius: 13, cursor: 'pointer' }}>
                  {copy.cta}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a29dba', letterSpacing: '0.04em', marginBottom: 8 }}>ELEGÍ TU PLAN</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {planes.map((p) => {
                const sel = p.name === planSel;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlanSel(p.name)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left', background: sel ? 'rgb(240,237,249)' : '#fff', border: `1.5px solid ${sel ? 'rgb(93,84,145)' : 'rgb(230,227,240)'}`, borderRadius: 13, padding: '11px 14px', cursor: 'pointer', fontFamily: '"DM Sans"' }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 16, color: 'rgb(33,30,51)' }}>{p.name}</span>
                      <span style={{ display: 'block', fontSize: 12, color: '#8781a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.tagline}</span>
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 14.5, color: sel ? 'rgb(93,84,145)' : '#5b5670', flex: '0 0 auto' }}>${p.price.toLocaleString('es-AR')}</span>
                  </button>
                );
              })}
            </div>

            {/* La cobertura odontológica: es un add-on con precio propio, así que se
                suma acá y el total se recalcula a la vista. */}
            <button
              onClick={() => setOdonto((v) => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left', background: odonto ? 'rgb(240,237,249)' : '#fff', border: `1.5px solid ${odonto ? 'rgb(93,84,145)' : 'rgb(230,227,240)'}`, borderRadius: 13, padding: '11px 14px', cursor: 'pointer', fontFamily: '"DM Sans"', marginBottom: 12 }}
            >
              <span>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'rgb(33,30,51)' }}>Cobertura odontológica</span>
                <span style={{ display: 'block', fontSize: 12, color: '#8781a0' }}>Limpieza y extracciones · +${ODONTO_PRECIO.toLocaleString('es-AR')}</span>
              </span>
              <span style={{ width: 42, height: 25, borderRadius: 100, background: odonto ? 'rgb(93,84,145)' : '#d5d0e3', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: odonto ? 'flex-end' : 'flex-start', padding: 3 }}>
                <span style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff', display: 'block' }} />
              </span>
            </button>

            {planSel ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgb(238,236,245)', paddingTop: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#5b5670' }}>Tu cuota por mes</span>
                <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, color: 'rgb(33,30,51)' }}>${total.toLocaleString('es-AR')}</span>
              </div>
            ) : null}
            {error && <div style={{ background: 'rgb(253,242,242)', color: 'rgb(176,58,58)', border: '1px solid rgb(245,214,214)', borderRadius: 12, padding: '11px 13px', fontSize: 13.5, marginBottom: 14 }}>{error}</div>}
            {actualizado && <div style={{ background: 'rgb(240,247,241)', color: 'rgb(47,143,91)', border: '1px solid rgb(214,235,220)', borderRadius: 12, padding: '11px 13px', fontSize: 13.5, lineHeight: 1.45, marginBottom: 14 }}>{actualizado}</div>}
            <button
              onClick={pagar}
              disabled={yendo || !planSel}
              style={{ width: '100%', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15.5, padding: '15px 20px', borderRadius: 14, cursor: yendo || !planSel ? 'default' : 'pointer', opacity: yendo || !planSel ? 0.5 : 1, marginBottom: 10 }}
            >
              {yendo ? 'Abriendo Mercado Pago…' : planSel ? `${copy.cta} →` : 'Elegí un plan'}
            </button>
            <p style={{ fontSize: 12, color: '#a29dba', textAlign: 'center', margin: '0 0 14px', lineHeight: 1.5 }}>
              Autorizás el débito en el sitio de Mercado Pago: los datos de tu tarjeta no pasan por Kumo. Podés darlo de baja cuando quieras desde Mi perfil.
            </p>
          </>
        )}

        <div style={{ borderTop: '1px solid rgb(238,236,245)', paddingTop: 14 }}>
          <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5, fontWeight: 600, color: 'rgb(93,84,145)' }}>¿Alguna duda? Escribinos</a>
        </div>
      </div>
    </div>
  );
}

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
/**
 * El sello del carnet.
 *
 * Decía ACTIVO siempre, escrito a mano en las dos pantallas que lo muestran. Con el
 * alta gratuita eso pasó de un detalle a una afirmación falsa en el documento que el
 * socio le muestra al veterinario.
 */
function SelloCarnet({ sello }: { sello: SelloVM }) {
  const tonos = {
    ok: { background: 'rgb(225,251,98)', color: 'rgb(33,30,51)' },
    neutro: { background: 'rgba(255,255,255,0.18)', color: '#fff' },
    alerta: { background: 'rgb(251,232,239)', color: 'rgb(193,77,122)' },
  } as const;
  return <span style={{ ...tonos[sello.tono], fontWeight: 700, fontSize: 10, padding: '4px 9px', borderRadius: 100, whiteSpace: 'nowrap' }}>{sello.texto}</span>;
}

/**
 * El banner de Inicio que cuenta qué suma un plan.
 *
 * Solo lo ve el socio que no está pagando, y no bloquea nada: es la explicación que
 * antes no existía en ninguna parte de la app. La tarjeta de Beneficios invita, pero
 * no dice QUÉ se gana, y esperar que la persona salga a la web pública a averiguarlo
 * es perderla.
 *
 * El precio sale de los planes que el club tiene cargados —no escrito acá— porque un
 * número a mano en un banner es el que queda viejo cuando suben la cuota.
 */
function BannerPlan({ desde, onPlan }: { desde: number; onPlan: () => void }) {
  return (
    <div style={{ background: 'rgb(93,84,145)', borderRadius: 18, padding: '18px 20px', marginBottom: 22, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -40, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 18, lineHeight: 1.2, marginBottom: 10, maxWidth: 420 }}>{BANNER_PLAN.titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {BANNER_PLAN.puntos.map((p) => (
            <div key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, lineHeight: 1.4, color: 'rgba(255,255,255,0.92)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(225,251,98)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto', marginTop: 2 }}><path d="M4 12l5 5L20 6" /></svg>
              {p}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onPlan} style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 14.5, padding: '12px 20px', borderRadius: 12, cursor: 'pointer' }}>
            {BANNER_PLAN.cta} →
          </button>
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>Desde ${desde.toLocaleString('es-AR')}/mes. {BANNER_PLAN.pie}</span>
        </div>
      </div>
    </div>
  );
}

function PetChips({ idx, setIdx, pets }: { idx: number; setIdx: (i: number) => void; pets: Pet[] }) {
  /* Con una sola mascota el selector no selecciona nada: es una tab siempre
     encendida que ocupa lugar y sugiere que hay algo más para elegir. Aparece
     recién cuando hay de verdad entre qué elegir. */
  if (pets.length <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      {pets.map((p, i) => (
        <button key={p.name} onClick={() => setIdx(i)} style={{ fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 13, padding: '9px 18px', borderRadius: 100, border: 'none', cursor: 'pointer', background: i === idx ? 'rgb(225,251,98)' : 'rgb(240,237,249)', color: i === idx ? 'rgb(33,30,51)' : 'rgb(135,129,160)' }}>{p.name}</button>
      ))}
    </div>
  );
}

/* ── Pantalla: Inicio ──────────────────────────────────────────── */
function Inicio({ go, petIdx, setPetIdx, pets, profile, noLeidas, pago, desdePlan, onPlan }: { go: (s: Screen) => void; petIdx: number; setPetIdx: (i: number) => void; pets: Pet[]; profile: Profile; noLeidas: number; pago: boolean; desdePlan: number; onPlan: () => void }) {
  const [promoIdx, setPromoIdx] = useState(0);
  const [fotoInicio, setFotoInicio] = useState<string | null>(null);
  const pet = pets[petIdx] ?? pets[0];
  const promo = promos[promoIdx] ?? promos[0]!;
  useEffect(() => {
    const t = setInterval(() => setPromoIdx((i) => (i + 1) % promos.length), 4000);
    return () => clearInterval(t);
  }, []);

  // El atajo al reintegro solo existe si puede pedirlo: un botón que lleva a una
  // pantalla que no está es peor que no tener el botón.
  const quick: { label: string; icon: ReactNode; to: Screen }[] = [
    { label: 'Carnet', icon: ic(idCard, false, 22), to: 'carnet' },
    { label: 'Foros', icon: ic(chat, false, 22), to: 'foros' },
    ...(pago ? [{ label: 'Reintegro', icon: ic(wallet, false, 22), to: 'reintegros' as Screen }] : []),
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
          {noLeidas > 0 && (
            <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 100, background: 'rgb(225,251,98)', border: '2px solid rgb(240,237,249)', color: 'rgb(33,30,51)', fontSize: 10.5, fontWeight: 800, lineHeight: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'content-box' }}>
              {noLeidas > 9 ? '9+' : noLeidas}
            </span>
          )}
        </button>
      </div>

      <PetChips idx={petIdx} setIdx={setPetIdx} pets={pets} />

      {pet ? (
        <div style={{ background: 'linear-gradient(135deg, rgb(93,84,145), rgb(70,63,112))', borderRadius: 24, padding: 20, marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', animation: 'kshine 4.5s ease-in-out infinite', pointerEvents: 'none', zIndex: 2 }} />
          <div style={{ position: 'absolute', right: -14, top: -14, opacity: 0.1 }}>
            <svg width="104" height="104" viewBox="0 0 24 24" fill="#fff" style={{ display: 'block' }}>{paw}</svg>
          </div>
          {/* Misma foto que el carnet: es la misma mascota y no hay motivo para que
              se vea distinta según la pantalla. El sello va sobre el borde de abajo. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
            <div style={{ position: 'relative', width: 96, height: 96, flex: '0 0 auto' }}>
              <button
                type="button"
                onClick={() => setFotoInicio(pet.photo)}
                aria-label={`Ver la foto de ${pet.name} en grande`}
                title="Ver la foto en grande"
                style={{ width: 96, height: 96, borderRadius: '50%', border: '3px solid rgb(225,251,98)', padding: 0, background: `url(${pet.photo}) center/cover, rgb(230,227,240)`, cursor: 'zoom-in', display: 'block' }}
              />
              <div style={{ position: 'absolute', bottom: -9, left: '50%', transform: 'translateX(-50%)' }}>
                <SelloCarnet sello={pet.sello} />
              </div>
            </div>
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <div style={{ color: '#fff', fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 24 }}>{pet.name}</div>
              <div style={{ color: 'rgb(201,195,227)', fontSize: 12.5 }}>{pet.plan} · Socio {pet.socio}</div>
            </div>
          </div>
          {fotoInicio && <FotoGrande src={fotoInicio} alt={`Foto de ${pet.name}`} onCerrar={() => setFotoInicio(null)} />}
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

      {/* Qué suma un plan. Solo para el que no está pagando: al que paga, ofrecerle lo
          que ya tiene lo único que le enseña es a ignorar los banners. */}
      {!pago && desdePlan > 0 ? <BannerPlan desde={desdePlan} onPlan={onPlan} /> : null}

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
          {/* La tarjeta no se pierde para el socio gratuito: cambia de destino y de
              texto. Que se vea lindo lo que todavía no tiene es exactamente su
              trabajo — es el lugar donde se descubre que hay algo más. */}
          <button onClick={pago ? () => go('beneficios') : onPlan} style={{ textAlign: 'left', borderRadius: 12, padding: 14, color: '#fff', cursor: 'pointer', border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 120, background: 'linear-gradient(rgba(33,30,51,0) 30%, rgba(33,30,51,0.75) 100%), url(/img/home-beneficios.webp) center/cover', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{pago ? 'Beneficios' : INVITACION_PLAN.titulo}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>{pago ? 'Descuentos exclusivos' : INVITACION_PLAN.bajada}</div>
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
  const [fotoCarnet, setFotoCarnet] = useState<string | null>(null);
  const allVacs = pet?.vaccines ?? [];
  /** La fila que se está corrigiendo, si hay alguna. */
  const [editando, setEditando] = useState<Vac | null>(null);

  /** Cambiar la foto de la mascota. Antes no se podía desde ninguna pantalla:
   *  si en el alta salía mal, había que tocar la base a mano. */
  const cambiarFoto = async (elegida?: File) => {
    if (!elegida || !pet) return;
    const listo = await prepararFoto(elegida);
    if ('error' in listo) { setFotoError(listo.error); return; }
    const f = listo.file;
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
  /* Alta y corrección pasan por la misma función, y la traducción del formulario a
     la fila vive en @kumo/shared: es la misma en las dos superficies. */
  const guardarVac = async (v: FormVacuna) => {
    if (!pet) return;
    setBusy(true);
    if (editando) await supabase.from('vaccinations').update(parcheDeVacuna(v)).eq('id', editando.id);
    else await supabase.from('vaccinations').insert({ pet_id: pet.id, ...filaDeVacuna(v) });
    setShowAdd(false);
    setEditando(null);
    router.refresh();
    setBusy(false);
  };
  const borrarVac = async (v: Vac) => {
    if (!confirm(`¿Borrar ${v.name} del carnet? Se saca también del calendario. No se puede deshacer.`)) return;
    setBusy(true);
    await supabase.from('vaccinations').delete().eq('id', v.id);
    setEditando(null);
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

  /** Borrar un contacto, que no se podia: un telefono mal cargado quedaba para
   *  siempre, y en una urgencia eso es peor que no tener ninguno. */
  const borrarContacto = async (c: EmergencyContact) => {
    if (!confirm(`Borrar ${c.name} de tus contactos de emergencia?`)) return;
    setBusy(true);
    const { error } = await supabase.from('emergency_contacts').delete().eq('id', c.id);
    if (error) alert('No pudimos borrarlo. Proba de nuevo.');
    else router.refresh();
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

  /* El calendario ocupa la pantalla entera y se sale con "← Volver": se devuelve
     EN LUGAR del carnet, no encima. */
  if (showCal) return <CalendarioPagina vacs={allVacs} onVolver={() => setShowCal(false)} />;

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 16 }}>Carnet digital</div>
      <PetChips idx={petIdx} setIdx={setPetIdx} pets={pets} />

      {/* Card mascota */}
      <div style={{ background: 'linear-gradient(135deg, rgb(93,84,145), rgb(70,63,112))', borderRadius: 24, padding: 22, marginBottom: 18, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', animation: 'kshine 4.5s ease-in-out infinite', pointerEvents: 'none', zIndex: 2 }} />
        <div style={{ position: 'absolute', right: -14, top: -14, opacity: 0.1 }}><svg width="104" height="104" viewBox="0 0 24 24" fill="#fff" style={{ display: 'block' }}>{paw}</svg></div>
        {/* En el carnet la foto manda: es lo que hace que la credencial sea de
            ALGUIEN y no una ficha de datos. Redonda, grande, con el aro lima y el
            sello apoyado sobre el borde de abajo, como un sello estampado.

            Tocarla la abre en grande. Antes tocarla abría el selector de archivos
            para CAMBIARLA, que es lo contrario de lo que espera cualquiera que ve
            una foto: cambiarla pasa a la chapita de la esquina, que es una acción
            deliberada y no lo primero que pasa si le errás al toque. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, position: 'relative' }}>
          <div style={{ position: 'relative', width: 96, height: 96, flex: '0 0 auto' }}>
            <button
              type="button"
              onClick={() => setFotoCarnet(pet.photo)}
              aria-label={`Ver la foto de ${pet.name} en grande`}
              title="Ver la foto en grande"
              style={{ width: 96, height: 96, borderRadius: '50%', border: '3px solid rgb(225,251,98)', padding: 0, background: `url(${pet.photo}) center/cover, rgb(230,227,240)`, cursor: 'zoom-in', display: 'block' }}
            />
            <label title="Cambiar la foto" style={{ position: 'absolute', right: -2, top: -2, width: 32, height: 32, borderRadius: '50%', background: 'rgb(33,30,51)', border: '2px solid rgb(93,84,145)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: fotoBusy ? 'default' : 'pointer' }}>
              {fotoBusy
                ? <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fff' }}>···</span>
                : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              <input type="file" accept={FOTO_TIPOS.join(',')} disabled={fotoBusy} style={{ display: 'none' }} onChange={(e) => cambiarFoto(e.target.files?.[0])} />
            </label>
            <div style={{ position: 'absolute', bottom: -9, left: '50%', transform: 'translateX(-50%)' }}>
              <SelloCarnet sello={pet.sello} />
            </div>
          </div>
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 700, fontSize: 26 }}>{pet.name}</div>
            <div style={{ color: 'rgb(201,195,227)', fontSize: 12.5 }}>{pet.breed}</div>
            {fotoError && <div style={{ color: 'rgb(225,251,98)', fontSize: 11.5, fontWeight: 600, marginTop: 4, maxWidth: 220, lineHeight: 1.35 }}>{fotoError}</div>}
            {/* Credencial con foto lateral: los datos van al lado de la foto y no
                debajo. En cajitas horizontales el valor entraba partido —"982 000"
                arriba y "4287" abajo— y "Odontológico" no entraba entero. En filas,
                cada dato tiene todo el ancho y se lee de un renglón. */}
            <div style={{ marginTop: 9 }}>
              {[['Microchip', pet.microchip], ['Castrado', pet.castrado], ['Odontológico', pet.odonto]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.13)' }}>
                  <span style={{ fontSize: 11.5, color: 'rgb(201,195,227)' }}>{k}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {fotoCarnet && <FotoGrande src={fotoCarnet} alt={`Foto de ${pet.name}`} onCerrar={() => setFotoCarnet(null)} />}
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
            /* Tocar la fila la abre para corregirla. Antes, una vacuna cargada con
               el nombre mal o la fecha equivocada se quedaba así para siempre: no
               había forma de editarla ni de borrarla desde ningún lado. */
            <div
              key={v.id}
              role="button"
              tabIndex={0}
              aria-label={`Editar ${v.name}`}
              onClick={() => setEditando(v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditando(v); } }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: tone.card, border: tone.border, borderRadius: 14, padding: '13px 14px', cursor: 'pointer' }}
            >
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
                  /* El clic no puede subir a la fila: si no, marcar aplicada abre
                     además la hoja de edición encima. */
                  <button disabled={busy} onClick={(e) => { e.stopPropagation(); markApplied(v.id); }} style={{ background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' }}>Marcar aplicada</button>
                )}
              </div>
              {/* La flecha, para que se vea que la fila se puede tocar. */}
              <span style={{ color: 'rgb(176,168,214)', fontSize: 18, lineHeight: 1 }}>›</span>
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
      {(showAdd || editando) && (
        <CarnetSheet
          petName={pet.name}
          vac={editando}
          onClose={() => { setShowAdd(false); setEditando(null); }}
          onSave={guardarVac}
          onBorrar={editando ? () => borrarVac(editando) : undefined}
        />
      )}

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
              <button onClick={() => borrarContacto(c)} disabled={busy} style={{ background: 'none', border: 'none', color: 'rgb(135,129,160)', fontSize: 12, cursor: busy ? 'default' : 'pointer', padding: 0, alignSelf: 'flex-start', fontFamily: '"DM Sans"' }}>
                Borrar
              </button>
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
/* `catPin` (el icono por rubro del mapa dibujado) se fue con ese mapa: en el de
   OpenStreetMap el pin es la inicial del prestador, que se lee mejor a 30 px. */
const heartPath = <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1a5.5 5.5 0 0 0-7.8 7.7l1.1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />;
const globePath = <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></>;
const igPath = <><rect x="2" y="2" width="20" height="20" rx="5.5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="#5D5491" stroke="none" /></>;
const pinDropPath = <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>;
const phonePath = <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2z" />;

/**
 * El cuadro de la foto de un prestador, en la ficha y en las listas.
 *
 * Cuando no hay foto NO se pone una de archivo. Antes el que no subía nada salía
 * con `default-pet.webp`: su ficha mostraba un perro ajeno como si fuera su local,
 * y desde adentro parecía que Kumo le había guardado una foto que él nunca eligió.
 * En su lugar va el ícono de su rubro sobre violeta, que se lee por lo que es:
 * todavía no subió foto.
 */
function FotoPrestador({ p, lado, radio, extra }: { p: ProviderVM; lado: number; radio: number; extra?: CSSProperties }) {
  const caja: CSSProperties = { width: lado, height: lado, borderRadius: radio, flex: 'none', ...extra };
  /* El logo primero: es la imagen pensada para un cuadrado. La portada es el
     respaldo —un recorte del medio, que es mejor que nada— y el icono del rubro es
     el ultimo, para el que no subio ninguna. */
  const cuadrada = p.logoUrl ?? p.photoUrl;
  if (cuadrada) return <div style={{ ...caja, background: `url(${cuadrada}) center/cover, rgb(240,237,249)` }} />;
  return (
    <div style={{ ...caja, background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(93,84,145)' }}>
      {ic(RUBRO_ICONS[p.category] ?? paw, p.category === 'Paseador', Math.round(lado * 0.46))}
    </div>
  );
}

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
  /*
   * Cada dato de contacto es una acción, no un cartel.
   *
   * Eran cuatro filas de texto plano: se veían como información y no se podía hacer
   * nada con ellas —ni tocar el teléfono para llamar, ni abrir el Instagram—. Los
   * links los arma `@kumo/shared/prestadores`, porque el trabajo está en que la
   * gente escribe estos datos como quiere: el sitio sin "https://", el Instagram con
   * arroba o con la URL entera.
   *
   * Si un dato no se puede convertir en link, la fila queda como texto: mejor eso que
   * un link roto.
   */
  const dato = (icono: ReactNode, texto: string, ultimo = false, href?: string | null) => {
    const estilo: CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
      borderBottom: ultimo ? 'none' : '1px solid rgb(238,236,245)',
      textDecoration: 'none', color: 'inherit',
    };
    const adentro = (
      <>
        <span style={{ color: '#5D5491', flex: 'none' }}>{ic(icono, false, 19)}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: href ? 'rgb(93,84,145)' : 'inherit' }}>{texto}</span>
      </>
    );
    if (!href) return <div key={texto} style={estilo}>{adentro}</div>;
    // `tel:` no abre pestaña: la abriría en blanco y el teléfono nunca vuelve.
    const nueva = !href.startsWith('tel:');
    return (
      <a key={texto} href={href} target={nueva ? '_blank' : undefined} rel={nueva ? 'noopener noreferrer' : undefined} style={estilo}>
        {adentro}
      </a>
    );
  };
  const contacto = [
    p.website ? { i: globePath, t: p.website, href: urlSitio(p.website) } : null,
    p.instagram ? { i: igPath, t: p.instagram, href: urlInstagram(p.instagram) } : null,
    // El mapa se abre en las coordenadas del pin cuando las hay, así el socio cae
    // exactamente donde lo vio, y si no en la dirección escrita.
    p.address ? { i: pinDropPath, t: p.address, href: urlMapaWeb({ lat: p.lat, lng: p.lng, direccion: p.address, zona: p.zone }) } : null,
    p.phone ? { i: phonePath, t: p.phone, href: urlTel(p.phone) } : null,
  ].filter(Boolean) as { i: ReactNode; t: string; href: string | null }[];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Portada */}
      {/* Sin foto la portada es el violeta con el ícono del rubro de marca de agua:
          el degradé solo ya se veía como un error de carga. */}
      <div style={{ position: 'relative', height: 132, background: p.photoUrl ? `linear-gradient(135deg, #5D5491, #463f70), url(${p.photoUrl}) center/cover` : 'linear-gradient(135deg, #5D5491, #463f70)', backgroundBlendMode: 'darken', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
        {!p.photoUrl && (
          <div style={{ position: 'absolute', right: 14, bottom: -18, color: '#fff', opacity: 0.16, display: 'flex' }}>
            {ic(RUBRO_ICONS[p.category] ?? paw, p.category === 'Paseador', 108)}
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.4))' }} />
        <div style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,251,98,0.25), transparent 70%)' }} />
        <button onClick={onVolver} aria-label="Volver a Servicios" style={{ position: 'absolute', top: 14, left: 16, width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>←</button>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Avatar + identidad */}
        {/* El avatar monta sobre la portada, pero no tanto: con -38 el nombre
            arrancaba justo en el filo de la foto y se leía pegado. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: -26, marginBottom: 14, position: 'relative', zIndex: 3 }}>
          <FotoPrestador p={p} lado={84} radio={24} extra={{ border: '4px solid #fff', boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }} />
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
          {p.km != null && <span style={{ background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 11.5, padding: '5px 11px', borderRadius: 100 }}>{p.km} km {p.kmDesde}</span>}
        </div>

        {p.about && <p style={{ fontSize: 14, color: 'rgb(91,86,112)', lineHeight: 1.6, margin: '0 0 18px' }}>{p.about}</p>}

        {/* Servicios y tarifas. La base guarda un precio por prestador, no una
            lista, así que se muestra el que hay en vez de inventar tarifas. */}
        {p.price > 0 && (
          <>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Servicios y tarifas</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 13, padding: '12px 14px', marginBottom: 18 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{p.category}</span>
              <span style={{ fontSize: 14, color: 'rgb(93,84,145)', fontWeight: 700 }}>{precioTexto(p.price, p.priceUnit)}</span>
            </div>
          </>
        )}

        {contacto.length > 0 && (
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: '6px 16px', marginBottom: 18 }}>
            {contacto.map((c, i) => dato(c.i, c.t, i === contacto.length - 1, c.href))}
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

function Servicios({ go, providers, initialGuardados, profile, reviews, centro }: { go: (s: Screen) => void; providers: ProviderVM[]; initialGuardados: string[]; profile: Profile; reviews: Record<string, Review[]>; centro: { lat: number; lng: number; etiqueta: string | null } }) {
  const memberId = profile.id;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [radio, setRadio] = useState(5);
  /* Dónde se está buscando. Arranca en el domicilio y se mueve al arrastrar el
     mapa: la lista sigue a lo que se está mirando. */
  const [centroBusqueda, setCentroBusqueda] = useState(centro);
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
  /*
   * La distancia se mide desde donde se está MIRANDO, no desde el domicilio.
   *
   * `p.km` viene calculado en la carga y siempre mide desde la casa del socio: deja
   * de ser cierto en cuanto el mapa se arrastra. Mientras el mapa no se movió se usa
   * ese valor —es el mismo número y evita recalcular—, y en cuanto se mueve se
   * recalcula contra el centro nuevo.
   */
  const enCasa = centroBusqueda.lat === centro.lat && centroBusqueda.lng === centro.lng;
  const kmDe = (p: ProviderVM) =>
    p.lat == null || p.lng == null ? p.km
      : enCasa ? p.km : Math.round(distanciaKm(centroBusqueda, { lat: p.lat, lng: p.lng }) * 10) / 10;

  const list = providers.filter((p) => {
    // Se descarta al que SABEMOS que está lejos. El que no tiene coordenadas no
    // entra ni sale del radio: no se puede afirmar ninguna de las dos cosas, así que
    // se muestra sin distancia en vez de esconderlo.
    const km = kmDe(p);
    if (km != null && km > radio) return false;
    if (cat && p.category !== cat) return false;
    if (ql && !(`${p.name} ${p.category} ${p.zone}`.toLowerCase().includes(ql))) return false;
    return true;
  });
  /** El prestador con distancia conocida más cercano, para el mensaje de vacío. */
  const conDistancia = providers.map(kmDe).filter((k): k is number => k != null);
  const masCerca = conDistancia.length ? Math.min(...conDistancia) : null;
  const pct = ((radio - 1) / 24) * 100;

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
        <input type="range" min={1} max={25} step={1} value={radio} onChange={(e) => setRadio(Number(e.target.value))} style={{ width: '100%', display: 'block', appearance: 'none', height: 6, borderRadius: 100, outline: 'none', cursor: 'pointer', touchAction: 'none', background: `linear-gradient(to right, rgb(93,84,145) 0%, rgb(93,84,145) ${pct}%, rgb(238,236,245) ${pct}%, rgb(238,236,245) 100%)` } as CSSProperties} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
          <span style={{ fontSize: 11, color: 'rgb(162,157,186)' }}>1 km</span>
          <span style={{ fontSize: 11, color: 'rgb(162,157,186)' }}>25 km</span>
        </div>
      </div>

      {/*
        * El mapa, con geografía de verdad (Leaflet + OpenStreetMap).
        *
        * Antes era un dibujo: calles inventadas y los pines ubicados con un hash del
        * id del prestador, "estable entre renders" pero sin relación con dónde queda
        * cada uno. Se veía lindo y no servía para lo único que un mapa tiene que
        * contestar: si esto me queda cerca.
        *
        * Se muestran solo los prestadores de la lista filtrada que tienen
        * coordenadas: uno sin lat/lng no se puede dibujar, y ponerlo en el centro
        * sería inventar de nuevo.
        */}
      <MapaPrestadores
        pins={list.filter((x) => x.lat != null && x.lng != null).map((x) => ({ id: x.id, nombre: x.name, categoria: x.category, lat: x.lat as number, lng: x.lng as number }))}
        centro={centro}
        radioKm={radio}
        onPin={(id) => setSelId(id)}
        onCentro={(c) => setCentroBusqueda({ ...centro, ...c })}
        style={{ marginBottom: 14 }}
      />

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
                <FotoPrestador p={p} lado={38} radio={11} />
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
            <FotoPrestador p={p} lado={50} radio={15} />
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                {p.badge && <span style={{ background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5 }}>{p.badge}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{p.category} · {p.zone}{p.km != null && <> · <span style={{ color: 'rgb(93,84,145)', fontWeight: 600 }}>{p.km} km</span></>}</div>
              {/* Sin reseñas no se muestra estrella: un "★ 0 (0)" se lee como mala calificación. */}
              <div style={{ fontSize: 12, color: 'rgb(91,86,112)', marginTop: 3 }}>
                {ratingLabel(p.rating, p.reviews) ? <>{star} {ratingLabel(p.rating, p.reviews)} ({p.reviews}){precioTexto(p.price, p.priceUnit) ? ' · ' : ''}</> : <span style={{ color: 'rgb(162,157,186)' }}>Sin reseñas{precioTexto(p.price, p.priceUnit) ? ' · ' : ''}</span>}
                {/* Sin tarifa cargada no se muestra nada: "$0" se lee como que trabaja
                    gratis, y el que se acaba de dar de alta todavía no la puso. */}
                {precioTexto(p.price, p.priceUnit) && <span style={{ color: 'rgb(93,84,145)', fontWeight: 700 }}>{precioTexto(p.price, p.priceUnit)}</span>}
              </div>
            </div>
            <span style={{ color: 'rgb(199,194,218)', fontSize: 18 }}>›</span>
          </button>
        ))}
        {/* El vacío dice a qué distancia está el más cercano.
            Ahora que las distancias se miden desde la casa del socio, "ampliá el
            radio" es un consejo inútil para alguien de Tandil: el radio llega hasta
            25 km y el prestador más cercano está a 350. Que lo diga el número. */}
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'rgb(162,157,186)', fontSize: 14, lineHeight: 1.5 }}>
            Sin resultados en {radio} km.
            {masCerca != null && masCerca > radio
              ? <><br />El más cercano está a {masCerca} km {providers[0]?.kmDesde ?? ''}.</>
              : <><br />Ampliá el radio o cambiá de servicio.</>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * El historial de cuotas.
 *
 * Existía en la base desde el principio —la política de RLS dice "el socio ve su
 * historial de cuotas"— y no había ninguna pantalla que lo mostrara. Es la respuesta a
 * dos preguntas que hoy solo podía contestar el club por WhatsApp: "¿me cobraron?" y
 * "¿hasta cuándo tengo la cuota?".
 *
 * Los rechazos se muestran igual que los cobros. Cuando a alguien le rebota el débito
 * esa fila es la explicación de por qué se le cortó el acceso: esconderla lo dejaría
 * buscando el motivo en el aire.
 */
function HojaPagos({ pagos, onClose }: { pagos: PagoVM[]; onClose: () => void }) {
  const tono = (t: 'ok' | 'neutro' | 'alerta') => t === 'ok'
    ? { bg: 'rgb(226,245,234)', fg: 'rgb(47,143,91)' }
    : t === 'alerta'
      ? { bg: 'rgb(251,232,239)', fg: 'rgb(193,77,122)' }
      : { bg: 'rgb(240,237,249)', fg: 'rgb(93,84,145)' };
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Mis pagos</div>
      <p style={{ fontSize: 13, color: 'rgb(135,129,160)', margin: '0 0 16px' }}>Las cuotas de los últimos meses y hasta cuándo llegó cada una.</p>
      {pagos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 10px', color: 'rgb(162,157,186)', fontSize: 14, lineHeight: 1.5 }}>
          Todavía no hay cuotas cobradas.<br />Cuando pagues la primera, aparece acá.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pagos.map((p) => {
            const est = PAGO_ESTADO[p.estado];
            const c = tono(est.tono);
            return (
              <div key={p.id} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{m$(p.monto)}</span>
                  <span style={{ background: c.bg, color: c.fg, fontWeight: 700, fontSize: 11, padding: '3px 9px', borderRadius: 100 }}>{est.texto}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)' }}>
                  {p.fecha} · {PAGO_MEDIO[p.medio]}{p.plan ? ` · Plan ${p.plan}` : ''}
                </div>
                {/* Solo los pagos acreditados llevan la cuota a algún lado: en uno
                    rechazado, mostrar "cubre hasta" sería prometer un mes que no entró. */}
                {p.cubreHasta && p.estado === 'aprobado' && (
                  <div style={{ fontSize: 12.5, color: 'rgb(93,84,145)', fontWeight: 600, marginTop: 3 }}>Cuota paga hasta el {p.cubreHasta}</div>
                )}
                {p.detalle && <div style={{ fontSize: 12, color: 'rgb(162,157,186)', marginTop: 3 }}>{p.detalle}</div>}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
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
  // Los dos que el tipo ya contemplaba y ninguna pantalla ofrecía.
  Veterinaria: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  Otros: <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>,
};

/* Ya no frena si el socio tiene uno: puede tener varios —un servicio y un
   comercio—, y el alta se cerraba con "Ya tenés un negocio". */
function Prestar({ go, profile }: { go: (s: Screen) => void; profile: Profile }) {
  const router = useRouter();
  const [rubro, setRubro] = useState<string>(RUBROS[0]!);
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState('');
  /** La dirección es opcional y es lo único que lo pone en el mapa: ver el aviso
   *  debajo del campo y  en lib/geocodificar. */
  const [direccion, setDireccion] = useState('');
  /* Instagram, sitio y tarifa: opcionales, pero se piden ACÁ y no solo al editar.
     Antes solo existían en "Editar datos" del negocio ya publicado, así que la ficha
     de todo prestador nuevo salía con dos filas y sin precio, y el club no tenía
     manera de mostrarlo bien hasta que el prestador volviera a entrar. */
  const [instagram, setInstagram] = useState('');
  const [sitio, setSitio] = useState('');
  const [precio, setPrecio] = useState('');
  const [unidad, setUnidad] = useState('');
  const [tel, setTel] = useState(profile.phone ?? '');
  const [about, setAbout] = useState('');
  /* Las dos imágenes del negocio, como en el prototipo: el logo es cuadrado y va de
     avatar, la portada es la banda de arriba de la ficha. Antes había una sola y
     hacía los dos trabajos, con lo que el logo salía estirado o la foto del local
     salía recortada por el medio. Las dos son opcionales. */
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [portada, setPortada] = useState<File | null>(null);
  const [portadaPreview, setPortadaPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  // Si ya tiene un negocio, no hay alta que hacer: se lo manda a verlo.

  /** Valida y previsualiza. Una sola función para las dos: mismos formatos, mismo
   *  máximo, y así no se separan por descuido. */
  const elegirImagen = (cual: 'logo' | 'portada') => async (elegida?: File) => {
    if (!elegida) return;
    const listo = await prepararFoto(elegida);
    if ('error' in listo) { setError(listo.error); return; }
    const f = listo.file;
    setError('');
    if (cual === 'logo') { setLogo(f); setLogoPreview(URL.createObjectURL(f)); }
    else { setPortada(f); setPortadaPreview(URL.createObjectURL(f)); }
  };

  /** Sube una al bucket del socio y devuelve su URL. `null` si falló. */
  const subir = async (f: File, prefijo: string): Promise<string | null> => {
    const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg';
    // Carpeta por socio: la RLS del bucket exige que la primera carpeta sea su id.
    const path = `${profile.id}/${prefijo}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('pet-photos').upload(path, f, { contentType: f.type });
    if (upErr) return null;
    return supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl;
  };

  const enviar = async () => {
    if (!nombre.trim()) { setError('Poné el nombre o la marca de tu servicio.'); return; }
    if (!zona.trim()) { setError('Poné la zona donde trabajás.'); return; }
    setBusy(true); setError('');

    let photoUrl: string | null = null;
    let logoUrl: string | null = null;
    if (portada) {
      photoUrl = await subir(portada, 'negocio');
      if (!photoUrl) { setError('No pudimos subir la portada. Probá de nuevo o mandá la solicitud sin ella.'); setBusy(false); return; }
    }
    if (logo) {
      logoUrl = await subir(logo, 'negocio-logo');
      if (!logoUrl) { setError('No pudimos subir el logo. Probá de nuevo o mandá la solicitud sin él.'); setBusy(false); return; }
    }

    const { data: alta, error: insErr } = await supabase.from('providers').insert({
      owner_id: profile.id, name: nombre.trim(), category: rubro, zone: zona.trim(),
      address: direccion.trim() || null,
      instagram: instagram.trim() || null, website: sitio.trim() || null,
      price: Number(precio.replace(/\D/g, '')) || null, price_unit: unidad.trim() || null,
      phone: tel.trim() || null, about: about.trim(), photo_url: photoUrl, logo_url: logoUrl, status: 'pendiente',
    }).select('id').single();
    if (insErr) { setError('No pudimos enviar la solicitud. Probá de nuevo.'); setBusy(false); return; }
    // El pin en el mapa: se resuelve en el servidor y no se espera. Si no sale, el
    // negocio queda igual en la lista, sin distancia.
    if (alta?.id && direccion.trim()) void fetch('/api/prestadores/ubicacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: alta.id }) });
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
          {/* Elegirla de la lista importa además del tipeo: el filtro por zona compara
              texto, así que "Palermo" y "Palermo, CABA" eran dos zonas distintas. */}
          <CampoZona id="pr-zona" valor={zona} onCambio={(t) => { setZona(t); setError(''); }} onElegir={(z) => { setZona(z.zona); setError(''); }} placeholder="Palermo, CABA" style={sheetInput} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={sheetLabel} htmlFor="pr-tel">WhatsApp</label>
          <input id="pr-tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+54 11 ..." style={sheetInput} />
        </div>
      </div>

      <label style={sheetLabel} htmlFor="pr-dir">Dirección <span style={{ fontWeight: 500, color: 'rgb(162,157,186)' }}>(opcional)</span></label>
      <CampoDomicilio id="pr-dir" valor={direccion} {...partirZona(zona)} onCambio={setDireccion} onElegir={(l) => setDireccion(l.domicilio)} placeholder="Av. Santa Fe 3200" style={sheetInput} />
      <p style={{ fontSize: 12, color: 'rgb(135,129,160)', margin: '6px 0 12px', lineHeight: 1.45 }}>Si atendés en un local, ponela: es lo que te ubica en el mapa de los socios. Si trabajás a domicilio, dejala vacía y te encuentran por zona.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={sheetLabel} htmlFor="pr-ig">Instagram <span style={{ fontWeight: 500, color: 'rgb(162,157,186)' }}>(opcional)</span></label>
          <input id="pr-ig" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@tunegocio" style={sheetInput} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={sheetLabel} htmlFor="pr-sitio">Sitio web <span style={{ fontWeight: 500, color: 'rgb(162,157,186)' }}>(opcional)</span></label>
          <input id="pr-sitio" value={sitio} onChange={(e) => setSitio(e.target.value)} placeholder="tunegocio.com.ar" style={sheetInput} />
        </div>
      </div>

      <label style={sheetLabel} htmlFor="pr-precio">Tarifa <span style={{ fontWeight: 500, color: 'rgb(162,157,186)' }}>(opcional)</span></label>
      <div style={{ display: 'flex', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <input id="pr-precio" value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="numeric" placeholder="4500" style={{ ...sheetInput, flex: '1 1 110px', width: 'auto' }} />
        <input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="/paseo" style={{ ...sheetInput, flex: '1 1 110px', width: 'auto' }} />
      </div>
      <p style={{ fontSize: 12, color: 'rgb(135,129,160)', margin: '0 0 12px', lineHeight: 1.45 }}>Si no la ponés, tu ficha no muestra precio (mejor eso que mostrar "$0"). Podés cargarla después.</p>

      <label style={sheetLabel} htmlFor="pr-about">Contanos sobre tu servicio</label>
      <textarea id="pr-about" value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="Experiencia, disponibilidad, precios de referencia…" style={{ ...sheetInput, marginBottom: 16, resize: 'none' }} />

      {/* "Foto de tu negocio" y no "portada": es UNA sola imagen y hace los dos
          trabajos —la portada de la ficha y el cuadradito del listado—, y llamarla
          distinto acá y en "Editar datos" hacía que el prestador buscara un campo de
          portada que no existe. */}
      {/* Las dos imágenes, con los nombres del prototipo. El logo va chico y cuadrado
          porque es lo que va a ser (el avatar), y la portada ancha: la caja tiene la
          forma del lugar donde se va a ver, así nadie sube un logo apaisado. */}
      <label style={sheetLabel}>Logo de la marca <span style={{ fontWeight: 500, color: 'rgb(162,157,186)' }}>(opcional)</span></label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <label style={{ position: 'relative', display: 'flex', width: 92, height: 92, flex: 'none', border: '2px dashed rgb(230,227,240)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', background: logoPreview ? `url(${logoPreview}) center/cover` : 'rgb(250,250,249)', cursor: 'pointer', overflow: 'hidden' }}>
          <input type="file" accept={FOTO_TIPOS.join(',')} onChange={(e) => elegirImagen('logo')(e.target.files?.[0])} style={{ display: 'none' }} />
          {!logoPreview && <div style={{ color: 'rgb(162,157,186)', display: 'flex' }}>{ic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>, false, 20)}</div>}
        </label>
        <div style={{ fontSize: 12, color: 'rgb(135,129,160)', lineHeight: 1.45 }}>Cuadrado. Es el redondel de tu ficha y el cuadradito del listado de Servicios. Si no lo subís, se usa la portada.</div>
      </div>

      <label style={sheetLabel}>Foto de portada <span style={{ fontWeight: 500, color: 'rgb(162,157,186)' }}>(opcional)</span></label>
      <label style={{ position: 'relative', display: 'flex', width: '100%', height: 140, border: '2px dashed rgb(230,227,240)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: portadaPreview ? `url(${portadaPreview}) center/cover` : 'rgb(250,250,249)', cursor: 'pointer', overflow: 'hidden' }}>
        <input type="file" accept={FOTO_TIPOS.join(',')} onChange={(e) => elegirImagen('portada')(e.target.files?.[0])} style={{ display: 'none' }} />
        {!portadaPreview && (
          <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center', color: 'rgb(162,157,186)' }}>{ic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>, false, 22)}</div>
            <div style={{ fontSize: 12, color: 'rgb(135,129,160)' }}>Subir portada</div>
          </div>
        )}
      </label>
      <p style={{ fontSize: 12, color: 'rgb(135,129,160)', margin: '6px 0 18px', lineHeight: 1.45 }}>La banda de arriba de tu ficha. Las dos las podés cargar después desde Mi negocio.</p>

      {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <button onClick={enviar} disabled={busy} style={{ width: '100%', background: 'rgb(93,84,145)', color: '#fff', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15, padding: 14, border: 'none', borderRadius: 14, boxShadow: '0 8px 20px rgba(93,84,145,0.28)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
    </div>
  );
}

/* ── Pantalla: Reintegros ──────────────────────────────────────── */
export type ReintStatus = 'Aprobado' | 'En revisión' | 'Rechazado';
/** El detalle del reintegro necesita bastante más que la tarjeta del historial:
 *  el seguimiento, el comprobante y los datos de acreditación. */
export type Reint = {
  id: string; place: string; concept: string; detail: string; fecha: string;
  spent: number; refund: number; refundPct: number;
  status: ReintStatus; statusRaw: string; requestedOn: string; resueltoEl: string;
  pet: string; receiptNo: string | null; receiptPath: string | null;
  bank: { holder: string | null; dni: string | null; cuit: string | null; name: string | null; cbu: string | null; alias: string | null };
};
const m$ = (n: number) => '$' + n.toLocaleString('es-AR');

const reintTone = (raw: string) => REINT_TONE[raw] ?? REINT_TONE.en_revision!;
const upIcon = <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><line x1="12" y1="5" x2="12" y2="16" /></>;
const infoIcon = <><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12" y2="8" /></>;
const NOTA_REINT = 'Los reintegros se acreditan en tu CVU/CBU dentro de los 30 días corridos. Podés pedir 1 reintegro de consultas cada 2 meses.';

/* ── Detalle de un reintegro ───────────────────────────────────── */
/** Montos, seguimiento, comprobante y datos de acreditación. Antes el historial
 *  no se podía abrir: la tarjeta era el final del camino. */
function ReintegroDetalle({ r, planName, onVolver }: { r: Reint; planName: string; onVolver: () => void }) {
  const [verBusy, setVerBusy] = useState(false);
  const tone = reintTone(r.statusRaw);
  const pasos = reintPasos(r.statusRaw, r.fecha, r.resueltoEl);

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
  // Prefijados con la cuenta del perfil: el alta ya no pide datos bancarios, así
  // que la primera solicitud es donde se cargan y de ahí quedan guardados. Antes
  // había que retipear todo en cada pedido.
  const [titular, setTitular] = useState(banco.holder ?? '');
  const [titularDni, setTitularDni] = useState(banco.holderDni ?? '');
  const [cuit, setCuit] = useState(banco.cuit ?? '');
  const [nombreBanco, setNombreBanco] = useState(banco.banco ?? '');
  const [cbu, setCbu] = useState(destinoParaMostrar(banco.cbu, banco.alias));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = items.filter((i) => i.status === 'Aprobado').reduce((a, i) => a + i.refund, 0);

  const sel = items.find((i) => i.id === selId);
  if (sel) return <ReintegroDetalle r={sel} planName={planName} onVolver={() => setSelId(null)} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Cargá la factura: sin comprobante el club no puede validar el gasto.'); return; }
    const falta = motivoDatosBancariosIncompletos({ titular, titularDni, banco: nombreBanco, destino: cbu });
    if (falta) { setError(falta); return; }
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

    const { data: nuevo, error: insErr } = await supabase.from('reimbursements').insert({
      member_id: memberId, pet_id: petId || null, plan_name: planName,
      provider_name: place || 'Comprobante', concept: detail || 'Comprobante',
      amount: s, refund: Math.round(s * 0.5), refund_pct: 50, status: 'en_revision', receipt_path: path,
      bank_holder: titular.trim() || null, bank_holder_dni: titularDni.replace(/\D/g, '') || null,
      bank_cuit: cuit.trim() || null, bank_name: nombreBanco.trim() || null,
      // El alias y el CBU van al mismo campo: el socio pone uno de los dos.
      ...destinoDeTransferencia(cbu),
    }).select('id').single();

    // La cuenta queda en el perfil para la próxima solicitud y para que el admin
    // la vea en la ficha sin abrir el reintegro. Completa huecos, no pisa: ver
    // `parchePerfilBancario`.
    const parche = parchePerfilBancario(banco, { titular, titularDni, cuit, banco: nombreBanco, destino: cbu });
    if (!insErr && parche) await supabase.from('profiles').update(parche).eq('id', memberId);
    if (insErr) {
      // Si falla la solicitud, no dejamos el archivo huérfano en el bucket.
      await supabase.storage.from('receipts').remove([path]);
      setError('No pudimos registrar la solicitud. Probá de nuevo.');
      setBusy(false);
      return;
    }

    // Acuse del pedido: el socio se entera de que llegó sin tener que preguntar.
    if (nuevo?.id) void avisar('reintegro-recibido', nuevo.id);

    setPlace(''); setDetail(''); setSpent(''); setPetId(pets[0]?.id ?? ''); setTitular(''); setTitularDni(''); setCuit(''); setNombreBanco(''); setCbu(''); setFile(null);
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
            <div style={{ fontSize: 13, color: 'rgb(95,125,16)' }}>La revisamos y acreditamos en tu CBU/CVU dentro de los 30 días corridos.</div>
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
          {/* Con una sola mascota no hay nada que elegir y el reintegro va a la
              única que tiene. Con más de una hay que preguntarlo: el club reparte
              los reintegros por mascota, así que atribuirlo mal desordena el
              historial de las dos. Antes el desplegable no tenía etiqueta y se
              veía como un nombre suelto, sin decir qué se estaba eligiendo. */}
          {pets.length > 1 && (
            <>
              <label style={sheetLabel} htmlFor="re-pet">¿Para cuál de tus mascotas?</label>
              <select id="re-pet" value={petId} onChange={(e) => setPetId(e.target.value)} style={{ ...sheetInput, marginBottom: 16 }}>
                {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </>
          )}

          {grupo('Datos para la acreditación')}
          <label style={sheetLabel} htmlFor="re-tit">Titular de la cuenta</label>
          <input id="re-tit" value={titular} onChange={(e) => { setTitular(e.target.value); setError(''); }} placeholder="Nombre y apellido" style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel} htmlFor="re-tit-dni">DNI del titular</label>
          <input id="re-tit-dni" value={titularDni} onChange={(e) => { setTitularDni(e.target.value); setError(''); }} inputMode="numeric" placeholder="12345678" style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel} htmlFor="re-cuit">CUIT / CUIL <span style={{ fontWeight: 500, opacity: 0.6 }}>(opcional)</span></label>
          <input id="re-cuit" value={cuit} onChange={(e) => setCuit(e.target.value)} inputMode="numeric" placeholder="20-12345678-9" style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel} htmlFor="re-banco">Banco</label>
          <input id="re-banco" value={nombreBanco} onChange={(e) => setNombreBanco(e.target.value)} placeholder="Galicia, Mercado Pago, Ualá…" style={{ ...sheetInput, marginBottom: 12 }} />
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

{/* El lugar: la zona, la dirección si el club la cargó, y a cuánto le queda al
          socio. La distancia sale del domicilio del socio, igual que en Servicios. */}
      {(b.zone || b.address) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgb(247,246,250)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <span style={{ color: '#5D5491', flex: 'none' }}>{ic(pinDropPath, false, 18)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* La dirección del comercio abre el mapa, igual que en la ficha del
                prestador: es el dato que se mira justo antes de ir. */}
            {urlMapaWeb({ lat: b.lat, lng: b.lng, direccion: b.address, zona: b.zone })
              ? <a href={urlMapaWeb({ lat: b.lat, lng: b.lng, direccion: b.address, zona: b.zone })!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5, fontWeight: 600, color: 'rgb(93,84,145)', textDecoration: 'none' }}>{b.address || b.zone}</a>
              : <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgb(74,69,96)' }}>{b.address || b.zone}</div>}
            {b.address && b.zone && <div style={{ fontSize: 12, color: 'rgb(135,129,160)', marginTop: 2 }}>{b.zone}</div>}
          </div>
          {b.km != null && <span style={{ background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 11.5, padding: '5px 11px', borderRadius: 100, flex: 'none' }}>{b.km} km {b.kmDesde}</span>}
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

function Beneficios({ benefits, go, centro, profile }: { benefits: BenefitVM[]; go: (s: Screen) => void; centro: { lat: number; lng: number; etiqueta: string | null }; profile: Profile }) {
  const [q, setQ] = useState('');
  const [buscado, setBuscado] = useState('');
  const [zona, setZona] = useState('Todas');
  const [selId, setSelId] = useState<string | null>(null);
  const ql = buscado.trim().toLowerCase();
  /*
   * Los chips de zona salen de las zonas que el club REALMENTE cargó, no de una lista
   * escrita a mano: así no hay nada que quede viejo cuando suman un barrio, y el socio
   * ve de una qué zonas cubre la red.
   */
  const zonas = [...new Set(benefits.map((b) => b.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const list = benefits.filter((b) => (zona === 'Todas' || b.zone === zona)
    && (!ql || `${b.name} ${b.category} ${b.zone}`.toLowerCase().includes(ql)));
  /*
   * El aviso de que el catálogo no es de su zona.
   *
   * Se calcula sobre TODOS los beneficios y no sobre la lista filtrada: la pregunta es
   * "¿la red llega hasta donde vivo?", no "¿lo que estoy mirando queda cerca?".
   */
  const conKm = benefits.map((b) => b.km).filter((k): k is number => k != null);
  const aviso = avisoZonaLejos({
    localidad: profile.city,
    provincia: profile.province,
    zonas: benefits.map((b) => b.zone).filter(Boolean),
    masCercaKm: conKm.length ? Math.min(...conKm) : null,
  });
  const sel = benefits.find((b) => b.id === selId);
  const buscar = () => setBuscado(q);
  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Beneficios</div>
      <div style={{ color: 'rgb(135,129,160)', fontSize: 14, marginBottom: 14 }}>Descuentos en la red de veterinarias y pet shops</div>

      {/* El catálogo se lista completo a propósito —un descuento en CABA le sirve al de
          Tandil si viaja— pero sin decir nada le ofrecíamos seis comercios a 300 km
          como si fueran para él. */}
      {aviso && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgb(255,248,230)', border: '1px solid rgb(245,231,196)', borderRadius: 14, padding: '11px 13px', marginBottom: 14 }}>
          <span style={{ color: 'rgb(184,134,11)', flex: 'none', marginTop: 1 }}>{ic(pinDropPath, false, 17)}</span>
          <span style={{ fontSize: 12.5, color: 'rgb(122,94,20)', lineHeight: 1.5 }}>{aviso}</span>
        </div>
      )}

      {/*
        * El mapa de los beneficios, con geografía de verdad.
        *
        * Era el último dibujo que quedaba: calles inventadas y un pin por beneficio
        * ubicado con un hash del id, "estable entre renders" pero sin relación con
        * dónde queda el comercio. El punto azul del centro tampoco era el socio:
        * aparecía al buscar y estaba siempre en el medio.
        *
        * Ahora los beneficios pueden tener dirección (la carga el club en el panel) y
        * el mapa muestra los de la lista filtrada que la tengan, con el descuento
        * adentro del pin —que es el dato por el que uno mira este mapa— y la casa del
        * socio en el centro. Los de zona entera ("Todo CABA") no tienen dirección
        * posible y por eso no tienen pin: siguen en la lista, con su zona.
        *
        * Sin radio: acá no hay slider de distancia, porque un descuento sirve igual
        * aunque quede lejos. El encuadre lo dan la casa y los pines.
        */}
      <MapaPrestadores
        pins={list.filter((b) => b.km != null).map((b) => ({ id: b.id, nombre: b.name, categoria: b.category, lat: b.lat as number, lng: b.lng as number, etiqueta: b.discount }))}
        centro={centro}
        onPin={(id) => setSelId(id)}
        style={{ height: 200, marginBottom: 14 }}
      />

      {/* Chips de zona: solo si hay más de una, porque con una sola no hay nada que
          filtrar y el chip "Todas" al lado del único barrio no aporta. */}
      {zonas.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 6 }}>
          {['Todas', ...zonas].map((z) => (
            <button key={z} onClick={() => setZona(z)} style={{ border: 'none', cursor: 'pointer', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 100, whiteSpace: 'nowrap', background: zona === z ? 'rgb(93,84,145)' : 'rgb(240,237,249)', color: zona === z ? '#fff' : 'rgb(93,84,145)' }}>{z}</button>
          ))}
        </div>
      )}

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
              <div style={{ fontSize: 12, color: 'rgb(162,157,186)' }}>{b.category}{b.zone ? ` · ${b.zone}` : ''}{b.km != null && <> · <span style={{ color: 'rgb(93,84,145)', fontWeight: 600 }}>{b.km} km</span></>}</div>
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
const heartFill = <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />;
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
/* La lista vive en `@kumo/shared`: estaba escrita acá y otra vez en la app, y la
   categoría es texto libre en la base — dos listas que se separan no dan un error,
   dan publicaciones que no se encuentran desde la otra superficie. */
const foroChips = FORO_FILTROS;

const sendIcon = <><line x1="12" y1="19" x2="12" y2="5" /><path d="M5 12l7-7 7 7" /></>;

/**
 * La foto de una publicación, en grande.
 *
 * En el hilo la foto va recortada a 320 px de alto (`object-fit: cover`) para que
 * un post no se coma la pantalla, pero eso esconde parte de la imagen: si alguien
 * sube la radiografía de su perro o la etiqueta de un alimento, lo que importa
 * puede estar justo en lo recortado. Tocarla la abre entera, sin recortar.
 */
function FotoGrande({ src, alt = 'Foto', onCerrar }: { src: string; alt?: string; onCerrar: () => void }) {
  /* Escape para cerrar y el scroll del fondo trabado mientras está abierta: sin
     esto, scrollear sobre la foto movía el hilo de atrás. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = overflow; };
  }, [onCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,17,36,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}
    >
      {/* `contain` y no `cover`: acá el punto es justamente verla entera. */}
      <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 10, display: 'block' }} />
      <button
        onClick={onCerrar}
        aria-label="Cerrar"
        style={{ position: 'absolute', top: 14, right: 16, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer', fontFamily: '"DM Sans"' }}
      >
        ✕
      </button>
    </div>
  );
}

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
  const [reportando, setReportando] = useState(false);
  const [reportado, setReportado] = useState(false);
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);

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
    setLikes((s) => { const n = new Set(s.answers); if (estaba) n.delete(id); else n.add(id); return { ...s, answers: n }; });
    const { error } = estaba
      ? await supabase.from('answer_likes').delete().eq('member_id', profile.id).eq('answer_id', id)
      : await supabase.from('answer_likes').insert({ member_id: profile.id, answer_id: id });
    if (error) setLikes((s) => { const n = new Set(s.answers); if (estaba) n.add(id); else n.delete(id); return { ...s, answers: n }; });
    else router.refresh();
  };

  const responder = async (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setBusy(true);
    // El contador `replies` lo actualiza el trigger, no se toca desde acá.
    const { data: resp } = await supabase.from('community_answers').insert({
      post_id: p.id, author_id: profile.id, author_name: profile.firstName, text: texto.trim(),
    }).select('id').single();
    /* Le suena el teléfono a quien preguntó, y en el momento: una respuesta que
       llega al día siguiente ya no sirve para una conversación. Sin esperar: si
       el aviso falla, la respuesta ya quedó publicada igual. */
    if (resp?.id) void avisar('foro-respuesta', resp.id);
    setTexto('');
    router.refresh();
    setBusy(false);
  };

  /**
   * Marca (o desmarca) la mejor respuesta. Solo puede quien preguntó: la política
   * de `community_answers` lo habilita por fila y el trigger impide que el autor
   * de la respuesta se la marque a sí mismo.
   *
   * Se desmarcan las otras primero: "la mejor" es una sola, y la base no tiene
   * cómo saberlo —es una regla del producto, no una restricción de la tabla—.
   */
  const marcarMejor = async (a: ForumAnswer) => {
    setBusy(true);
    if (!a.best) {
      const otras = p.answers.filter((x) => x.best && x.id !== a.id).map((x) => x.id);
      if (otras.length) await supabase.from('community_answers').update({ best: false }).in('id', otras);
    }
    const { error } = await supabase.from('community_answers').update({ best: !a.best }).eq('id', a.id);
    if (error) alert('No pudimos marcar la respuesta. Probá de nuevo.');
    else router.refresh();
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

  /**
   * Reportar pasa por la función `reportar_post` de la base y no por un update:
   * un socio no puede tocar la publicación de otro (la RLS es por fila, así que
   * habilitarlo sería habilitarle también reescribir el texto ajeno).
   */
  const reportar = async (motivo: string) => {
    setBusy(true);
    const { error } = await supabase.rpc('reportar_post', { p_post_id: p.id, p_motivo: motivo });
    setBusy(false);
    if (error) { alert('No pudimos reportarla. Probá de nuevo.'); return; }
    /* Le avisa al club por mail. Sin esperar: el reporte ya quedó guardado, y
       que el mail falle no es motivo para decirle al socio que no se reportó. */
    void avisar('post-reportado', p.id);
    setReportando(false);
    setReportado(true);
  };

  const likesPost = p.likes + (likes.post && !misLikes.posts.includes(p.id) ? 1 : 0) - (!likes.post && misLikes.posts.includes(p.id) ? 1 : 0);

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '6px 0' }}>← Comunidad</button>
        {p.propia
          ? (
            <button onClick={borrarPost} disabled={busy} style={{ background: 'none', border: 'none', color: 'rgb(176,72,63)', fontWeight: 600, fontSize: 13, cursor: busy ? 'default' : 'pointer', padding: '6px 0' }}>
              Borrar publicación
            </button>
          )
          : (
            /* Reportar. La pantalla de Moderación del panel existía desde el
               arranque y nunca podía recibir nada, porque no había de dónde: esto
               es lo que la llena. Pide el motivo, que es lo que necesita quien
               modera para decidir. */
            <button onClick={() => setReportando((s) => !s)} disabled={reportado} style={{ background: 'none', border: 'none', color: reportado ? 'rgb(47,143,91)' : 'rgb(135,129,160)', fontWeight: 600, fontSize: 13, cursor: reportado ? 'default' : 'pointer', padding: '6px 0', fontFamily: '"DM Sans"' }}>
              {reportado ? '✓ Reportado' : '⚑ Reportar'}
            </button>
          )}
      </div>

      {reportando && !reportado && (
        <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>¿Qué pasa con esta publicación?</div>
          <p style={{ fontSize: 12.5, color: 'rgb(135,129,160)', margin: '0 0 10px', lineHeight: 1.5 }}>
            La revisa una persona del club. No se avisa a quien la escribió.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MOTIVOS_REPORTE.map((m) => (
              <button key={m} onClick={() => reportar(m)} disabled={busy} style={{ background: '#fff', border: '1px solid rgb(230,227,240)', color: 'rgb(74,69,96)', fontWeight: 600, fontSize: 12.5, padding: '8px 12px', borderRadius: 100, cursor: busy ? 'default' : 'pointer', fontFamily: '"DM Sans"' }}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

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
      {/* `<img>` y no `next/image`: la URL sale del bucket y el dominio no está
          en la whitelist de next.config, igual que el comprobante en el panel. */}
      {p.photo && (
        /* Botón y no `<img onClick>`: así se llega con el teclado y el lector de
           pantalla lo anuncia como algo que se puede activar. */
        <button
          type="button"
          onClick={() => setFotoAbierta(p.photo)}
          aria-label="Ver la foto completa"
          style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', marginBottom: 14 }}
        >
          <img src={p.photo} alt="Foto de la publicación" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 14, display: 'block', background: 'rgb(240,237,249)' }} />
        </button>
      )}
      {fotoAbierta && <FotoGrande src={fotoAbierta} alt="Foto de la publicación" onCerrar={() => setFotoAbierta(null)} />}

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
                  {/* Marcar la mejor respuesta la puede solo quien preguntó: la
                      política de la base lo permite y el trigger impide que lo
                      haga el autor de la respuesta. Faltaba el control. */}
                  {p.propia && !a.propia && (
                    <button onClick={() => marcarMejor(a)} disabled={busy} style={{ fontSize: 12, fontWeight: a.best ? 700 : 400, color: a.best ? 'rgb(47,143,91)' : 'rgb(135,129,160)', background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer', padding: 0, fontFamily: '"DM Sans"' }}>
                      {a.best ? '★ Es la mejor' : 'Marcar como mejor'}
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
  const cats = FORO_CATEGORIAS;
  const [cat, setCat] = useState<string>(FORO_CATEGORIA_DEFECTO);
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  // La zona del post es la localidad, no la calle: antes prefijaba el domicilio
  // completo porque era la única columna que había.
  const [zona, setZona] = useState(profile.city ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);

  /** El prototipo mostraba la foto elegida y la perdía al publicar (era un
   *  data-URL en memoria): acá se sube al bucket y queda la URL pública, que es
   *  lo que guarda `community_posts.photo_url`. */
  const elegirFoto = async (elegida?: File) => {
    if (!elegida) return;
    const listo = await prepararFoto(elegida);
    if ('error' in listo) { setError(listo.error); return; }
    const f = listo.file;
    setFotoBusy(true); setError('');
    const path = rutaFoto(profile.id, f.name.split('.').pop() ?? 'jpg', 'foro-');
    const { error: subida } = await supabase.storage.from('pet-photos').upload(path, f, { contentType: f.type });
    if (subida) { setError('No pudimos subir la foto. Probá de nuevo.'); setFotoBusy(false); return; }
    setFotoUrl(supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl);
    setFotoBusy(false);
  };

  const publicar = async () => {
    if (!titulo.trim()) { setError('Ponele un título a tu publicación.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('community_posts').insert({
      author_id: profile.id, author_name: profile.firstName, category: cat,
      title: titulo.trim(), body: cuerpo.trim() || titulo.trim(), zone: zona.trim() || null,
      photo_url: fotoUrl,
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
      {/* La zona del posteo alimenta el filtro de la lista, que compara texto: sin
          elegirla de una lista, cada persona escribía su barrio distinto y el filtro
          se llenaba de zonas de una sola publicación. */}
      <CampoZona id="fo-zona" valor={zona} onCambio={setZona} onElegir={(z) => setZona(z.zona)} placeholder="Palermo, CABA" style={{ ...sheetInput, marginBottom: 16 }} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, padding: '11px 14px', marginBottom: 18, cursor: fotoBusy ? 'default' : 'pointer' }}>
        <input type="file" accept={FOTO_TIPOS.join(',')} disabled={fotoBusy} onChange={(e) => elegirFoto(e.target.files?.[0])} style={{ display: 'none' }} />
        <div style={{ width: 32, height: 32, borderRadius: 9, background: fotoUrl ? `url(${fotoUrl}) center/cover` : 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' }}>
          {!fotoUrl && (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5D5491" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{fotoBusy ? 'Subiendo…' : fotoUrl ? 'Foto agregada' : 'Agregá una foto'}</div>
          <div style={{ fontSize: 11, color: 'rgb(162,157,186)' }}>Opcional</div>
        </div>
        <span style={{ color: 'rgb(93,84,145)', fontSize: 20, fontWeight: 700 }}>{fotoUrl ? '✓' : '+'}</span>
      </label>

      {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <button onClick={publicar} disabled={busy} style={{ ...sheetBtn(true), width: '100%', boxShadow: '0 8px 20px rgba(93,84,145,0.28)', opacity: busy ? 0.6 : 1 }}>{busy ? 'Publicando…' : 'Publicar'}</button>
    </div>
  );
}

/* ── Pantalla: Foros / Comunidad ───────────────────────────────── */
function Foros({ initialPosts, profile, misLikes, abrirHilo, onHiloAbierto }: { initialPosts: ForumPost[]; profile: Profile; misLikes: MisLikes; abrirHilo?: string | null; onHiloAbierto?: () => void }) {
  const posts = initialPosts;
  const [vista, setVista] = useState<'lista' | 'componer'>('lista');
  const [hiloId, setHiloId] = useState<string | null>(null);
  /* Llegó desde una notificación: se abre esa publicación y no la lista. Se
     avisa que ya se consumió para que volver al foro por el menú no vuelva a
     meterte en el mismo hilo. */
  useEffect(() => {
    if (!abrirHilo) return;
    setHiloId(abrirHilo);
    setVista('lista');
    onHiloAbierto?.();
  }, [abrirHilo, onHiloAbierto]);
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


/**
 * Mis negocios. Son VARIOS a proposito: un socio puede tener un servicio y un
 * comercio, y hasta ahora el alta se frenaba con "Ya tenes un negocio".
 *
 * Con uno solo la pantalla se ve igual que antes —no hay lista de un elemento—; la
 * lista aparece recien con el segundo.
 */
/** El estado del negocio como lo lee su dueño, con el tono del panel. */
function textoEstadoNegocio(status: string): string {
  return status === 'verificado' ? 'Publicado' : status === 'rechazado' ? 'Rechazado' : 'En revisión';
}
function estadoNegocio(status: string): CSSProperties {
  const tono = status === 'verificado' ? { background: 'rgb(226,245,234)', color: 'rgb(47,143,91)' }
    : status === 'rechazado' ? { background: 'rgb(251,232,239)', color: 'rgb(193,77,122)' }
    : { background: 'rgb(251,243,226)', color: 'rgb(146,105,10)' };
  return { ...tono, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 100, whiteSpace: 'nowrap', flex: 'none' };
}
function Negocio({ go, negocios, profile, misReviews }: { go: (s: Screen) => void; negocios: MiNegocio[]; profile: Profile; misReviews: Review[] }) {
  const router = useRouter();
  const [selId, setSelId] = useState<string | null>(null);
  const [showAlta, setShowAlta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rubro, setRubro] = useState<string>(RUBROS[0]!);
  const [zona, setZona] = useState('');
  /** La dirección es opcional y es lo único que lo pone en el mapa: ver el aviso
   *  debajo del campo y  en lib/geocodificar. */
  const [direccion, setDireccion] = useState('');
  /* Instagram, sitio y tarifa: opcionales, pero se piden ACÁ y no solo al editar.
     Antes solo existían en "Editar datos" del negocio ya publicado, así que la ficha
     de todo prestador nuevo salía con dos filas y sin precio, y el club no tenía
     manera de mostrarlo bien hasta que el prestador volviera a entrar. */
  const [instagram, setInstagram] = useState('');
  const [sitio, setSitio] = useState('');
  const [precio, setPrecio] = useState('');
  const [unidad, setUnidad] = useState('');
  const [tel, setTel] = useState(profile.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [bajaOpen, setBajaOpen] = useState(false);
  /** Cuál se está subiendo, para poner el cartel encima de ESA caja y no de las dos. */
  const [fotoBusy, setFotoBusy] = useState<'logo' | 'portada' | null>(null);
  const [fotoError, setFotoError] = useState('');
  /* Las imágenes del alta. Van aparte de las del negocio ya publicado: acá todavía no
     existe la fila donde guardarlas, así que se eligen, se previsualizan y se suben
     al enviar la solicitud. */
  const [altaLogo, setAltaLogo] = useState<File | null>(null);
  const [altaLogoPreview, setAltaLogoPreview] = useState<string | null>(null);
  const [altaPortada, setAltaPortada] = useState<File | null>(null);
  const [altaPortadaPreview, setAltaPortadaPreview] = useState<string | null>(null);

  /** Valida y previsualiza una de las dos imágenes del alta. */
  const elegirAlta = (cual: 'logo' | 'portada') => async (elegida?: File) => {
    if (!elegida) return;
    const listo = await prepararFoto(elegida);
    if ('error' in listo) { setError(listo.error); return; }
    const f = listo.file;
    setError('');
    if (cual === 'logo') { setAltaLogo(f); setAltaLogoPreview(URL.createObjectURL(f)); }
    else { setAltaPortada(f); setAltaPortadaPreview(URL.createObjectURL(f)); }
  };

  /** Sube al bucket del socio y devuelve la URL, o null si falló. */
  const subirImagen = async (f: File, prefijo: string): Promise<string | null> => {
    const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg';
    // Carpeta por socio: la RLS del bucket exige que la primera carpeta sea su id.
    const path = `${profile.id}/${prefijo}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('pet-photos').upload(path, f, { contentType: f.type });
    if (upErr) return null;
    return supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl;
  };
  /**
   * El negocio abierto. Con uno solo es ese; con varios, el que se toca en la lista.
   *
   * Se busca por id contra la lista fresca y no se guarda el objeto: así después de
   * subir una foto o guardar cambios, lo que se ve es lo que quedó en la base.
   */
  const negocio = negocios.find((n) => n.id === selId) ?? (negocios.length === 1 ? negocios[0]! : null);

  // Datos editables del negocio publicado. Arrancan vacíos y los carga `abrirEdicion`
  // con los del negocio que se está editando: un `useState` con valores iniciales se
  // queda con los del primer render, que con varios negocios es el equivocado.
  const [ed, setEd] = useState({
    name: '', category: RUBROS[0]! as string, zone: '', address: '',
    phone: '', about: '', price: '', priceUnit: '', instagram: '', website: '',
  });
  const abrirEdicion = (n: MiNegocio) => {
    setEd({
      name: n.name, category: n.category, zone: n.zone, address: n.address ?? '',
      phone: n.phone ?? '', about: n.about,
      price: n.price ? String(n.price) : '', priceUnit: n.priceUnit ?? '',
      instagram: n.instagram ?? '', website: n.website ?? '',
    });
    setError('');
    setEditOpen(true);
  };

  /** El logo o la portada del negocio: se suben y se guardan en el acto, igual que
   *  la foto de la mascota. Antes la portada solo se podía elegir en el alta larga y
   *  nunca más, y el logo no existía. */
  const cambiarImagen = async (cual: 'logo' | 'portada', elegida?: File) => {
    if (!elegida || !negocio) return;
    const listo = await prepararFoto(elegida);
    if ('error' in listo) { setFotoError(listo.error); return; }
    const f = listo.file;
    setFotoBusy(cual); setFotoError('');
    const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg';
    // Carpeta por socio: la RLS del bucket exige que la primera carpeta sea su id.
    const path = `${profile.id}/negocio${cual === 'logo' ? '-logo' : ''}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('pet-photos').upload(path, f, { contentType: f.type });
    if (upErr) { setFotoError('No pudimos subir la imagen. Probá de nuevo.'); setFotoBusy(null); return; }
    const url = supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl;
    const { error: e } = await supabase.from('providers').update(cual === 'logo' ? { logo_url: url } : { photo_url: url }).eq('id', negocio.id);
    if (e) { setFotoError('Subimos la imagen pero no pudimos guardarla. Probá de nuevo.'); setFotoBusy(null); return; }
    router.refresh();
    setFotoBusy(null);
  };

  const guardarEdicion = async () => {
    if (!negocio) return;
    if (!ed.name.trim() || !ed.zone.trim()) { setError('El nombre y la zona no pueden quedar vacíos.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('providers').update({
      name: ed.name.trim(), category: ed.category, zone: ed.zone.trim(),
      address: ed.address.trim() || null,
      phone: ed.phone.trim() || null, about: ed.about.trim(),
      price: Number(ed.price.replace(/\D/g, '')) || null, price_unit: ed.priceUnit.trim() || null,
      instagram: ed.instagram.trim() || null, website: ed.website.trim() || null,
    }).eq('id', negocio.id);
    if (e) { setError('No pudimos guardar los cambios. Probá de nuevo.'); setBusy(false); return; }
    /* Si se mudó el local, el pin se muda con él. También cuando la dirección se
       borra: ahí la ruta guarda coordenadas nulas y el negocio sale del mapa, que es
       lo correcto — no puede quedar un pin de un local que ya no está. */
    if (ed.address.trim() !== (negocio.address ?? '')) {
      void fetch('/api/prestadores/ubicacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: negocio.id }) });
    }
    setEditOpen(false);
    router.refresh();
    setBusy(false);
  };

  // El estado sale del negocio real, no de un switch: sin negocio, esperando la
  // validación del club, publicado, o rechazado.
  const state: 'sin' | 'lista' | 'revision' | 'activo' | 'rechazado' =
    negocios.length === 0 ? 'sin'
      : !negocio ? 'lista'
      : negocio.status === 'verificado' ? 'activo'
      : negocio.status === 'rechazado' ? 'rechazado'
      : 'revision';

  const enviarAlta = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Poné el nombre de tu negocio.'); return; }
    if (!zona.trim()) { setError('Poné la zona donde trabajás.'); return; }
    setBusy(true); setError('');

    /* Las dos imágenes se suben ANTES del insert y con las URLs ya resueltas: si el
       insert saliera primero, un fallo al subir dejaría el negocio creado sin foto y
       sin manera de saber que faltó. */
    let photoUrl: string | null = null;
    let logoUrl: string | null = null;
    if (altaPortada) {
      photoUrl = await subirImagen(altaPortada, 'negocio');
      if (!photoUrl) { setError('No pudimos subir la portada. Probá de nuevo o mandá la solicitud sin ella.'); setBusy(false); return; }
    }
    if (altaLogo) {
      logoUrl = await subirImagen(altaLogo, 'negocio-logo');
      if (!logoUrl) { setError('No pudimos subir el logo. Probá de nuevo o mandá la solicitud sin él.'); setBusy(false); return; }
    }

    const { data: alta, error: e2 } = await supabase.from('providers').insert({
      owner_id: profile.id, name: nombre.trim(), category: rubro, zone: zona.trim(),
      address: direccion.trim() || null,
      instagram: instagram.trim() || null, website: sitio.trim() || null,
      price: Number(precio.replace(/\D/g, '')) || null, price_unit: unidad.trim() || null,
      phone: tel.trim() || null, photo_url: photoUrl, logo_url: logoUrl, status: 'pendiente',
    }).select('id').single();
    if (e2) { setError('No pudimos enviar la solicitud. Probá de nuevo.'); setBusy(false); return; }
    if (alta?.id) void avisar('negocio-recibido', alta.id);
    if (alta?.id && direccion.trim()) void fetch('/api/prestadores/ubicacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: alta.id }) });
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

  /* El formulario del alta, en una constante: se usa en dos lugares —la tarjeta de
     "todavia no tenes ninguno" y el boton "dar de alta otro" de la lista— y
     duplicar veinte inputs es garantia de que se separen. */
  const formAlta = showAlta ? (
  <form onSubmit={enviarAlta} style={{ marginTop: 18, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, animation: 'kpop 0.2s ease' }}>
    <input value={nombre} onChange={(e) => { setNombre(e.target.value); setError(''); }} placeholder="Nombre de tu negocio" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
    <select value={rubro} onChange={(e) => setRubro(e.target.value)} style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }}>
      {RUBROS.map((r) => <option key={r}>{r}</option>)}
    </select>
    <CampoZona valor={zona} onCambio={(t) => { setZona(t); setError(''); }} onElegir={(z) => { setZona(z.zona); setError(''); }} placeholder="Zona (ej: Palermo, CABA)" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"', width: '100%', boxSizing: 'border-box' }} />
    <CampoDomicilio valor={direccion} {...partirZona(zona)} onCambio={setDireccion} onElegir={(l) => setDireccion(l.domicilio)} placeholder="Dirección del local (opcional)" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"', width: '100%', boxSizing: 'border-box' }} />
    <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="WhatsApp de contacto" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
    {/* La dirección es lo único que lo pone en el mapa; sin ella el
        negocio aparece en la lista pero sin distancia ni pin. */}
    <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram (opcional)" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
    <input value={sitio} onChange={(e) => setSitio(e.target.value)} placeholder="Sitio web (opcional)" style={{ padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
    <div style={{ display: 'flex', gap: 8 }}>
      <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="numeric" placeholder="Tarifa (opcional)" style={{ flex: 1, minWidth: 0, padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
      <input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="/paseo" style={{ flex: 1, minWidth: 0, padding: '11px 14px', border: '1.5px solid rgb(230,227,240)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none', fontFamily: '"DM Sans"' }} />
    </div>
    {/* El logo y la portada, también acá: estaban solo en el alta larga ("Sumate como
        prestador"), así que quien daba de alta desde Mi negocio —que es el camino más
        corto— no tenía dónde subirlas y su ficha nacía con el ícono del rubro. */}
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
      <label style={{ position: 'relative', display: 'flex', width: 84, height: 84, flex: 'none', border: '2px dashed rgb(230,227,240)', borderRadius: 14, alignItems: 'center', justifyContent: 'center', background: altaLogoPreview ? `url(${altaLogoPreview}) center/cover` : '#fff', cursor: 'pointer', overflow: 'hidden' }}>
        <input type="file" accept={FOTO_TIPOS.join(',')} onChange={(e) => elegirAlta('logo')(e.target.files?.[0])} style={{ display: 'none' }} />
        {!altaLogoPreview && <div style={{ textAlign: 'center', color: 'rgb(135,129,160)', fontSize: 11, pointerEvents: 'none' }}>Logo<br />(opcional)</div>}
      </label>
      <label style={{ position: 'relative', display: 'flex', flex: 1, minWidth: 0, height: 84, border: '2px dashed rgb(230,227,240)', borderRadius: 14, alignItems: 'center', justifyContent: 'center', background: altaPortadaPreview ? `url(${altaPortadaPreview}) center/cover` : '#fff', cursor: 'pointer', overflow: 'hidden' }}>
        <input type="file" accept={FOTO_TIPOS.join(',')} onChange={(e) => elegirAlta('portada')(e.target.files?.[0])} style={{ display: 'none' }} />
        {!altaPortadaPreview && <div style={{ textAlign: 'center', color: 'rgb(135,129,160)', fontSize: 11.5, pointerEvents: 'none' }}>Foto de portada (opcional)</div>}
      </label>
    </div>
    <p style={{ fontSize: 11.5, color: 'rgb(135,129,160)', margin: 0, lineHeight: 1.45 }}>Si atendés en un local, la dirección te ubica en el mapa de los socios. Si trabajás a domicilio, dejala vacía. Todo esto se puede completar después.</p>
    {error && <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600 }}>{error}</div>}
    <button type="submit" disabled={busy} style={{ background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', border: 'none', fontWeight: 700, fontSize: 14, padding: 12, borderRadius: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
  </form>
  ) : null;

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      {/* Volver a la lista solo tiene sentido si hay una lista: con un negocio la
          pantalla es la de siempre. */}
      {negocio && negocios.length > 1 && (
        <button onClick={() => setSelId(null)} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '0 0 6px' }}>← Mis negocios</button>
      )}
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{negocios.length > 1 && !negocio ? 'Mis negocios' : 'Mi negocio'}</div>
      <div style={{ color: 'rgb(135,129,160)', fontSize: 14, marginBottom: 18 }}>Ofrecé tus servicios a la comunidad de Kumo.</div>

      {/* La lista. Aparece con el segundo negocio: con uno la pantalla va directo a
          su ficha, que es lo que había antes. */}
      {state === 'lista' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {negocios.map((n) => (
              <button key={n.id} className="wa-card" onClick={() => setSelId(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 16, padding: 14, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: '"DM Sans"' }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(93,84,145)', background: (n.logoUrl ?? n.photoUrl) ? `url(${n.logoUrl ?? n.photoUrl}) center/cover` : 'rgb(240,237,249)' }}>
                  {!(n.logoUrl ?? n.photoUrl) && ic(RUBRO_ICONS[n.category] ?? paw, n.category === 'Paseador', 22)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{n.name}</div>
                  <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)' }}>{n.category} · {n.zone}</div>
                </div>
                <span style={estadoNegocio(n.status)}>{textoEstadoNegocio(n.status)}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowAlta((s) => !s)} style={{ ...sheetBtn(false), width: '100%' }}>+ Dar de alta otro negocio</button>
          {formAlta}
        </div>
      )}

      {state === 'sin' && (
        <div>
          <div style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 20, padding: 28, textAlign: 'center', marginBottom: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgb(225,251,98)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#211E33" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{storeIcon}</svg>
            </div>
            <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, lineHeight: 1.15 }}>¿Ofrecés un servicio para mascotas?</div>
            <p style={{ color: 'rgb(122,117,146)', fontSize: 14, lineHeight: 1.55, margin: '10px auto 20px', maxWidth: 460 }}>Dá de alta tu negocio como paseador, guardería, adiestrador, baño o cuidador. El club valida tus datos y quedás visible para miles de socios.</p>
            <button onClick={() => setShowAlta((s) => !s)} style={{ display: 'inline-block', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, padding: '14px 26px', borderRadius: 14, cursor: 'pointer' }}>Dar de alta mi negocio →</button>
            {formAlta}
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
            <button onClick={() => negocio && abrirEdicion(negocio)} style={{ ...sheetBtn(true), width: '100%', fontSize: 14 }}>Editar datos</button>
            <button onClick={() => go('servicios')} style={{ ...sheetBtn(false), width: '100%', fontSize: 14 }}>Ver perfil público</button>
            <button onClick={() => setBajaOpen(true)} style={{ background: 'none', color: 'rgb(176,72,63)', border: 'none', fontWeight: 600, fontSize: 13, padding: 6, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Dar de baja mi negocio</button>
          </div>
        </div>
      )}

      {/* Editar datos del negocio publicado */}
      {editOpen && negocio && (
        <Sheet onClose={() => setEditOpen(false)}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 16 }}>Editar datos</div>

          {/* Las dos imágenes de la ficha. Hasta ahora ninguna se podía cambiar acá:
              la portada solo se elegía en el alta larga y el logo no existía. Se
              guardan solas al elegirlas: son archivos, no campos de texto, y esperar
              el "Guardar cambios" para subirlos deja al socio sin saber si entró. */}
          <label style={sheetLabel}>Logo de la marca</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <label title="Cambiar el logo" style={{ width: 74, height: 74, borderRadius: 16, flex: 'none', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: fotoBusy ? 'default' : 'pointer', background: negocio.logoUrl ? `url(${negocio.logoUrl}) center/cover` : 'rgb(240,237,249)', color: 'rgb(93,84,145)' }}>
              {!negocio.logoUrl && ic(RUBRO_ICONS[negocio.category] ?? paw, negocio.category === 'Paseador', 30)}
              {fotoBusy === 'logo' && <span style={{ position: 'absolute', inset: 0, background: 'rgba(33,30,51,0.55)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Subiendo…</span>}
              <input type="file" accept={FOTO_TIPOS.join(',')} disabled={!!fotoBusy} style={{ display: 'none' }} onChange={(e) => cambiarImagen('logo', e.target.files?.[0])} />
            </label>
            <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)', lineHeight: 1.45 }}>
              {negocio.logoUrl ? 'Tocá el logo para cambiarlo.' : 'Todavía no subiste logo: mientras tanto se usa la portada, y si tampoco hay, el ícono de tu rubro.'} Cuadrado. Es el redondel de tu ficha y el cuadradito del listado.
            </div>
          </div>

          <label style={sheetLabel}>Foto de portada</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <label title="Cambiar la portada" style={{ width: 116, height: 74, borderRadius: 12, flex: 'none', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: fotoBusy ? 'default' : 'pointer', background: negocio.photoUrl ? `url(${negocio.photoUrl}) center/cover` : 'linear-gradient(135deg, #5D5491, #463f70)', color: '#fff' }}>
              {!negocio.photoUrl && ic(RUBRO_ICONS[negocio.category] ?? paw, negocio.category === 'Paseador', 26)}
              {fotoBusy === 'portada' && <span style={{ position: 'absolute', inset: 0, background: 'rgba(33,30,51,0.55)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Subiendo…</span>}
              <input type="file" accept={FOTO_TIPOS.join(',')} disabled={!!fotoBusy} style={{ display: 'none' }} onChange={(e) => cambiarImagen('portada', e.target.files?.[0])} />
            </label>
            <div style={{ fontSize: 12.5, color: 'rgb(135,129,160)', lineHeight: 1.45 }}>
              {negocio.photoUrl ? 'Tocá la portada para cambiarla.' : 'Todavía no subiste portada.'} Es la banda de arriba de tu ficha. JPG, PNG o WEBP; la achicamos sola al subirla.
              {fotoError && <div style={{ color: 'rgb(176,72,63)', fontWeight: 600, marginTop: 4 }}>{fotoError}</div>}
            </div>
          </div>

          <label style={sheetLabel}>Nombre del negocio</label>
          <input value={ed.name} onChange={(e) => { setEd({ ...ed, name: e.target.value }); setError(''); }} style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel}>Rubro</label>
          <select value={ed.category} onChange={(e) => setEd({ ...ed, category: e.target.value })} style={{ ...sheetInput, marginBottom: 12 }}>
            {RUBROS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <label style={sheetLabel}>Descripción</label>
          <textarea value={ed.about} onChange={(e) => setEd({ ...ed, about: e.target.value })} rows={3} placeholder="Qué ofrecés, experiencia, disponibilidad…" style={{ ...sheetInput, resize: 'none', marginBottom: 12 }} />
          <label style={sheetLabel}>Zona de cobertura</label>
          <CampoZona valor={ed.zone} onCambio={(t) => { setEd({ ...ed, zone: t }); setError(''); }} onElegir={(z) => { setEd({ ...ed, zone: z.zona }); setError(''); }} placeholder="Palermo, CABA" style={{ ...sheetInput, marginBottom: 12 }} />
          <label style={sheetLabel}>Dirección <span style={{ fontWeight: 500, color: 'rgb(162,157,186)' }}>(opcional)</span></label>
          <CampoDomicilio valor={ed.address} {...partirZona(ed.zone)} onCambio={(t) => setEd({ ...ed, address: t })} onElegir={(l) => setEd({ ...ed, address: l.domicilio })} placeholder="Av. Santa Fe 3200" style={sheetInput} />
          <p style={{ fontSize: 12, color: 'rgb(135,129,160)', margin: '6px 0 12px', lineHeight: 1.45 }}>Es lo que te ubica en el mapa de los socios. Vacía, te encuentran por zona.</p>
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

      {/* Con un solo negocio no hay lista donde poner este botón, así que va acá:
          sin esto, el que ya tiene uno no tendría por dónde dar de alta el segundo. */}
      {negocio && (
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setShowAlta((s) => !s)} style={{ ...sheetBtn(false), width: '100%' }}>+ Dar de alta otro negocio</button>
          {formAlta}
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
function Perfil({ go, profile, pets, reintegradoTotal, negocios, cuota, pago, pagos, onPlan }: { go: (s: Screen) => void; profile: Profile; pets: Pet[]; reintegradoTotal: number; negocios: MiNegocio[]; cuota: CuotaVM; pago: boolean; pagos: PagoVM[]; onPlan: () => void }) {
  const router = useRouter();
  const [showAddPet, setShowAddPet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({ nombre: profile.fullName, dni: profile.dni ?? '', dom: profile.address ?? '', localidad: profile.city ?? '', provincia: profile.province ?? '', tel: profile.phone ?? '', email: profile.email,
    bancoTitular: profile.banco.holder ?? '', bancoTitularDni: profile.banco.holderDni ?? '', bancoCuit: profile.banco.cuit ?? '',
    bancoNombre: profile.banco.banco ?? '', bancoCbu: destinoParaMostrar(profile.banco.cbu, profile.banco.alias) });
  const [bajaOpen, setBajaOpen] = useState(false);
  const [bajaHecha, setBajaHecha] = useState(false);
  const [pagosOpen, setPagosOpen] = useState(false);
  const [bajaError, setBajaError] = useState('');
  const [borrarOpen, setBorrarOpen] = useState(false);
  const [palabra, setPalabra] = useState('');
  const [borrarError, setBorrarError] = useState('');
  const [cuentas, setCuentas] = useState<{ mascotas: number; reintegros: number; pagos: number; publicaciones: number; negocios: number } | null>(null);

  /** Ahora sí guarda. El nombre también: antes no se podía editar desde ningún lado. */
  const guardarDatos = async () => {
    if (!datos.nombre.trim()) { setError('El nombre no puede quedar vacío.'); return; }
    /* La cuenta es opcional, pero a medias no sirve: ver `hayDatosBancarios`. */
    const banco = { titular: datos.bancoTitular, titularDni: datos.bancoTitularDni, cuit: datos.bancoCuit, banco: datos.bancoNombre, destino: datos.bancoCbu };
    if (hayDatosBancarios(banco)) {
      const falta = motivoDatosBancariosIncompletos(banco);
      if (falta) { setError(falta); return; }
    }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('profiles').update({
      full_name: datos.nombre.trim(), dni: datos.dni.trim() || null,
      address: datos.dom.trim() || null,
      city: datos.localidad.trim() || null,
      province: datos.provincia.trim() || null,
      phone: datos.tel.trim() || null, email: datos.email.trim(),
      /* Acá SÍ se pisa lo que había, al revés que el parche de la solicitud: esto
         es el socio cambiando su cuenta a propósito. Sin esta sección, desde la
         web no había ninguna forma de cambiarla —Mi perfil solo la mostraba y la
         solicitud no pisa la que ya está—: quedaba clavada para siempre. */
      bank_holder: datos.bancoTitular.trim() || null,
      bank_holder_dni: datos.bancoTitularDni.replace(/\D/g, '') || null,
      bank_cuit: datos.bancoCuit.trim() || null,
      bank_name: datos.bancoNombre.trim() || null,
      ...destinoDeTransferencia(datos.bancoCbu),
    }).eq('id', profile.id);
    if (e) { setError('No pudimos guardar los cambios. Probá de nuevo.'); setBusy(false); return; }
    /* Si se mudó, el mapa tiene que mudarse con él: sin esto las coordenadas quedan
       en la dirección anterior y la pantalla le muestra prestadores cerca de donde
       ya no vive. Se pide solo cuando el domicilio cambió, y no se espera la
       respuesta: es el centro de un mapa, no parte de guardar los datos. */
    if (datos.dom.trim() !== (profile.address ?? '') || datos.localidad.trim() !== (profile.city ?? '') || datos.provincia.trim() !== (profile.province ?? '')) {
      void fetch('/api/perfil/ubicacion', { method: 'POST' });
    }
    setEditando(false);
    router.refresh();
    setBusy(false);
  };


  const confirmarBaja = async () => {
    setBusy(true); setBajaError('');
    /*
     * El débito se corta PRIMERO, y si no se puede no se da de baja nada.
     *
     * Antes esto solo escribía `status: 'baja'` y mandaba el mail. El mail dice
     * "No te vamos a cobrar más" —es su frase central— y Mercado Pago seguía
     * debitando todos los meses: el socio perdía el acceso, tenía por escrito que
     * no le cobraban, y le cobraban. Sin ningún error, así que nadie se enteraba
     * hasta el resumen de la tarjeta o el contracargo.
     *
     * El orden importa igual que en el borrado: marcar primero y fallar después
     * deja al socio sin club Y pagando, que es peor que no haber hecho nada.
     *
     * El 409 no es un error acá: es "no tenés suscripción", que es lo normal en
     * el socio gratuito y en el que paga por transferencia. Ese sigue de largo.
     */
    const res = await fetch('/api/suscripcion/baja', { method: 'POST' });
    if (!res.ok && res.status !== 409) {
      const d = await res.json().catch(() => ({}));
      setBajaError(d.error ?? 'No pudimos cortar tu débito automático, así que no dimos de baja la membresía: si la diéramos, te seguirían cobrando. Probá de nuevo en un rato.');
      setBusy(false);
      return;
    }
    await supabase.from('profiles').update({ status: 'baja' }).eq('id', profile.id);
    // El comprobante de la baja: que no se cobra más y, si está dentro de los 10
    // días de la Ley 24.240, que se devuelve la cuota.
    void avisar('baja');
    setBajaHecha(true);
    router.refresh();
    setBusy(false);
  };

  /**
   * Eliminar la cuenta. NO es lo mismo que darse de baja, y por eso el diálogo
   * insiste con la diferencia: la baja deja al socio en el sistema y se revierte
   * escribiéndole al club; esto borra los datos y no tiene vuelta.
   *
   * Existe porque Google Play lo exige para publicar (una app que deja crear
   * cuenta tiene que dejar borrarla desde adentro), pero el derecho de supresión
   * de la Ley 25.326 ya lo pedía y hasta ahora había que pedirlo por mail.
   *
   * Los números se piden al abrir y no antes: son cinco consultas que no tienen
   * sentido para quien nunca va a tocar este botón.
   */
  const abrirBorrar = async () => {
    setPalabra(''); setBorrarError(''); setCuentas(null); setBorrarOpen(true);
    const [m, r, pg, pub, neg] = await Promise.all([
      supabase.from('pets').select('id', { count: 'exact', head: true }).eq('owner_id', profile.id),
      supabase.from('reimbursements').select('id', { count: 'exact', head: true }).eq('member_id', profile.id),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('member_id', profile.id),
      supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('author_id', profile.id),
      supabase.from('providers').select('id', { count: 'exact', head: true }).eq('owner_id', profile.id),
    ]);
    setCuentas({ mascotas: m.count ?? 0, reintegros: r.count ?? 0, pagos: pg.count ?? 0, publicaciones: pub.count ?? 0, negocios: neg.count ?? 0 });
  };

  const confirmarBorrado = async () => {
    setBusy(true); setBorrarError('');
    try {
      const res = await fetch('/api/socios/borrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) { setBorrarError(data.error ?? 'No pudimos borrar tu cuenta.'); setBusy(false); return; }
      /* La cuenta ya no existe. Quedarse con la sesión abierta deja la pantalla
         mostrando los datos de alguien que se acaba de borrar, y cualquier cosa
         que toque falla por RLS. Se cierra y sale a la portada. */
      await supabase.auth.signOut();
      window.location.href = LANDING;
    } catch {
      setBorrarError('No pudimos borrar tu cuenta. Revisá la conexión.');
      setBusy(false);
    }
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

  /* Con varios la fila no puede nombrarlos a todos: dice cuántos y cuántos están
     publicados, que es lo que se quiere saber de un vistazo. */
  const uno = negocios.length === 1 ? negocios[0]! : null;
  const negocioHint = negocios.length === 0 ? 'Ofrecé tu servicio en Kumo'
    : uno ? `${uno.name} · ${textoEstadoNegocio(uno.status).toLowerCase()}`
    : `${negocios.length} negocios · ${negocios.filter((n) => n.status === 'verificado').length} publicados`;

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, rgb(93,84,145), rgb(70,63,112))', borderRadius: 22, padding: 22, color: '#fff', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', flex: 'none', border: '2px solid rgba(255,255,255,0.25)', background: 'rgb(240,237,249)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, color: '#5D5491' }}>{profile.firstName.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 21 }}>{profile.fullName}</div>
          {/* Sin número no se escribe "Socio #": una cuenta que no es de socio
              (el admin, mañana un prestador) no tiene número y no es socio. */}
          <div style={{ color: 'rgb(201,195,227)', fontSize: 12.5 }}>
            {profile.memberNo ? `Socio #${profile.memberNo} · ` : ''}Plan {profile.planName}
          </div>
        </div>
        <button onClick={() => setEditando((s) => !s)} style={{ background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, padding: '8px 14px', borderRadius: 100, cursor: 'pointer', flex: 'none', fontFamily: '"DM Sans"' }}>{editando ? 'Cancelar' : 'Editar'}</button>
      </div>

      {/* Mis mascotas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => go('mismascotas')} style={{ background: 'none', border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: 0, fontFamily: '"DM Sans"' }}>Mis mascotas ›</button>
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
        {/* El historial de cuotas. Va para todos, incluido el gratuito: si alguna vez
            pagó, tiene derecho a ver qué le cobraron. La bajada dice lo último que pasó
            de verdad, que es lo que uno viene a mirar. */}
        {row(ic(cardIcon, false, 19), 'Mis pagos',
          pagos.length === 0 ? 'Todavía no hay cuotas cobradas' : `Último: ${m$(pagos[0]!.monto)} · ${pagos[0]!.fecha}`,
          chevron, () => setPagosOpen(true))}
        {/* Los reintegros son del socio con la cuota paga: sin eso la fila promete
            una pantalla que no existe. */}
        {pago ? row(ic(wallet, false, 19), 'Mis reintegros', `${m$(reintegradoTotal)} reintegrados este año`, chevron, () => go('reintegros')) : null}
        {/* La membresía. Para el gratuito no dice "Plan —": dice qué tiene, y el
            camino para cambiarlo es la misma hoja que cobra — nunca una escritura
            de plan desde el navegador, que movía el plan sin recalcular la cuota. */}
        {pago
          ? row(ic(tagIcon, false, 19), 'Membresía', `Plan ${profile.planName}${profile.addonOdonto ? ' + odontológica' : ''} · ${m$(profile.planPrice)}/mes`, accion('Cambiar'), onPlan)
          : row(ic(tagIcon, false, 19), 'Membresía', 'Plan gratuito · carnet, foros y prestadores', accion('Ver planes'), onPlan)}
        {/* El único upsell del perfil. Dos serían insistencia. */}
        {pago ? null : row(ic(idCard, false, 19), INVITACION_PLAN.titulo, INVITACION_PLAN.bajada, accion('Activar'), onPlan)}
        {/* La cuota: el débito automático de Mercado Pago. La baja tiene que estar
            acá y ser un botón, no un mail al club: con débito automático, cortar
            tiene que ser tan fácil como suscribirse. Se corta el débito futuro y no
            el mes ya pagado — sigue entrando hasta que se le vence. */}
        {row(ic(cardIcon, false, 19), 'Cuota mensual',
          cuota.suscripcion === 'authorized'
            ? `Débito automático activo · ${m$(cuota.monto)}/mes${cuota.hasta ? ` · paga hasta el ${fmtFechaCorta(cuota.hasta)}` : ''}`
            : cuota.hasta && !cuota.debePagar
              ? `Paga hasta el ${fmtFechaCorta(cuota.hasta)} · sin débito automático`
              : cuota.hasta
                ? `Se te venció el ${fmtFechaCorta(cuota.hasta)}`
                : 'Estás en el plan gratuito',
          cuota.suscripcion === 'authorized'
            ? <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!window.confirm('¿Dar de baja el débito automático? No se te va a cobrar más. Podés seguir usando el club hasta que se te venza el mes que ya pagaste.')) return;
                  const res = await fetch('/api/suscripcion/baja', { method: 'POST' });
                  const data = await res.json();
                  window.alert(res.ok
                    ? `Listo, no te vamos a cobrar más.${data.hasta ? ` Podés usar el club hasta el ${fmtFechaCorta(data.hasta)}.` : ''}`
                    : (data.error ?? 'No pudimos dar de baja el débito.'));
                  router.refresh();
                }}
                style={{ background: 'none', border: 'none', color: 'rgb(176,58,58)', fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
              >
                Dar de baja
              </button>
            /* Sin débito no dice "Pendiente": al que nunca eligió plan no le falta
               hacer nada, y esa palabra suena a deuda. Es el mismo criterio que la
               fila de abajo ya usa con "Todavía no hace falta". Va una acción. */
            : cuota.debePagar
              ? accion(cuota.hasta ? 'Reactivar' : 'Elegir plan')
              : <span style={{ color: 'rgb(162,157,186)', fontSize: 12 }}>—</span>,
          cuota.debePagar ? onPlan : undefined)}
        {/* Dónde cobra los reintegros: es plata que le entra, así que verlo acá
            evita que descubra un CBU mal cargado cuando ya esperaba el dinero.
            Sin cargar NO dice "Pendiente": no le falta hacer nada, y esa palabra
            suena a deuda. La cuenta se pide cuando pide el primer reintegro, que
            es cuando la persona está esperando plata y la completa sin quejarse. */}
        {/* La cuenta bancaria solo tiene sentido si puede pedir reintegros: para el
            socio gratuito es ruido sobre algo que no puede hacer. */}
        {pago ? row(ic(wallet, false, 19), 'Cuenta para reintegros',
          profile.banco.cbu ? `${profile.banco.holder ?? 'A tu nombre'} · ····${profile.banco.cbu.slice(-4)}` : profile.banco.alias ? `Alias ${profile.banco.alias}` : 'Te la pedimos cuando cargues tu primer reintegro',
          <span style={{ color: 'rgb(162,157,186)', fontSize: 12 }}>{profile.banco.cbu || profile.banco.alias ? 'Cargada' : 'Todavía no hace falta'}</span>) : null}
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
            {/* Mismo orden que el alta: la provincia y la localidad son las pistas con
                las que se busca la calle, así que van antes. */}
            <label style={sheetLabel} htmlFor="pf-prov">Provincia</label>
            {/* Selector y no texto libre: era la única pantalla donde se podía escribir
                cualquier cosa como provincia, y con eso deshacer lo que el alta había
                resuelto bien. */}
            <select id="pf-prov" value={datos.provincia} onChange={(e) => setDatos((d) => ({ ...d, provincia: e.target.value }))} style={inputEdit}>
              <option value="">Elegí una provincia</option>
              {PROVINCIAS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <label style={sheetLabel} htmlFor="pf-loc">Localidad</label>
            <div style={{ marginBottom: 8 }}>
              <CampoZona
                id="pf-loc"
                valor={datos.localidad}
                provincia={datos.provincia || undefined}
                onCambio={(t) => setDatos((d) => ({ ...d, localidad: t }))}
                onElegir={(z) => setDatos((d) => ({ ...d, localidad: z.localidad, provincia: z.provincia }))}
                placeholder="Ej. Palermo"
                style={{ ...inputEdit, marginBottom: 0 }}
              />
            </div>
            <label style={sheetLabel} htmlFor="pf-dom">Domicilio</label>
            <div style={{ marginBottom: 10 }}>
              <CampoDomicilio
                id="pf-dom"
                valor={datos.dom}
                provincia={datos.provincia || undefined}
                localidad={datos.localidad || undefined}
                onCambio={(t) => setDatos((d) => ({ ...d, dom: t }))}
                onElegir={(l) => setDatos((d) => ({ ...d, dom: l.domicilio, localidad: l.localidad, provincia: l.provincia }))}
                placeholder="Calle y número"
                style={{ ...inputEdit, marginBottom: 0 }}
              />
            </div>
            <label style={sheetLabel} htmlFor="pf-tel">Teléfono</label>
            <input id="pf-tel" value={datos.tel} onChange={(e) => setDatos((d) => ({ ...d, tel: e.target.value }))} style={inputEdit} />
            <label style={sheetLabel} htmlFor="pf-mail">Email</label>
            <input id="pf-mail" value={datos.email} onChange={(e) => setDatos((d) => ({ ...d, email: e.target.value }))} style={inputEdit} />

            {/* Solo para quien puede pedir reintegros: al socio gratuito la cuenta
                le pide datos sensibles para algo que no puede usar. Mismo criterio
                que la fila de arriba y que Mi perfil de la app. */}
            {pago && (
              <>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 14, marginBottom: 2 }}>Dónde cobrás tus reintegros</div>
                <div style={{ fontSize: 12.5, color: 'rgb(130,124,160)', marginBottom: 10, lineHeight: 1.45 }}>El club transfiere a esta cuenta. Si la completás acá, no te la volvemos a pedir en cada solicitud.</div>
                <label style={sheetLabel} htmlFor="pf-btit">Titular de la cuenta</label>
                <input id="pf-btit" value={datos.bancoTitular} onChange={(e) => { setDatos((d) => ({ ...d, bancoTitular: e.target.value })); setError(''); }} placeholder="Nombre y apellido" style={inputEdit} />
                <label style={sheetLabel} htmlFor="pf-bdni">DNI del titular</label>
                <input id="pf-bdni" value={datos.bancoTitularDni} onChange={(e) => { setDatos((d) => ({ ...d, bancoTitularDni: e.target.value })); setError(''); }} inputMode="numeric" placeholder="12345678" style={inputEdit} />
                <label style={sheetLabel} htmlFor="pf-bcuit">CUIT / CUIL <span style={{ fontWeight: 500, opacity: 0.6 }}>(opcional)</span></label>
                <input id="pf-bcuit" value={datos.bancoCuit} onChange={(e) => setDatos((d) => ({ ...d, bancoCuit: e.target.value }))} inputMode="numeric" placeholder="20-12345678-9" style={inputEdit} />
                <label style={sheetLabel} htmlFor="pf-bbanco">Banco</label>
                <input id="pf-bbanco" value={datos.bancoNombre} onChange={(e) => { setDatos((d) => ({ ...d, bancoNombre: e.target.value })); setError(''); }} placeholder="Galicia, Mercado Pago, Ualá…" style={inputEdit} />
                <label style={sheetLabel} htmlFor="pf-bcbu">CBU / CVU o alias</label>
                <input id="pf-bcbu" value={datos.bancoCbu} onChange={(e) => { setDatos((d) => ({ ...d, bancoCbu: e.target.value })); setError(''); }} placeholder="0000003100010000000001 o mi.alias.mp" style={inputEdit} />
                {datos.bancoCbu.trim() !== '' && pareceCbu(datos.bancoCbu) && !cbuValido(datos.bancoCbu) && (
                  <div style={{ fontSize: 12.5, color: 'rgb(176,72,63)', fontWeight: 600, marginBottom: 8 }}>El CBU/CVU tiene 22 dígitos y pusiste {datos.bancoCbu.replace(/\D/g, '').length}.</div>
                )}
              </>
            )}
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

      {/* Acá había un bloque "Historial de pagos" que decía "todavía no hay pagos"
          SIEMPRE: no leía `pagos` ni tenía condición. Venía de cuando mostraba
          cuatro cuotas inventadas; se las sacaron y quedó el cartel de vacío fijo.
          Le mentía a cualquiera que hubiera pagado —el primer socio tenía su cuota
          de $44.000 acreditada y la pantalla decía que no había ninguna—.

          No se reconecta porque sería duplicar: la fila "Mis pagos" de arriba ya
          muestra el último cobro y abre el historial completo. Es lo mismo que hace
          la app, que nunca tuvo este bloque. */}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Va ARRIBA de las acciones y no al final: cambiar de plan es algo que el
            socio quiere hacer, y estaba debajo de "Darme de baja" y "Eliminar mi
            cuenta" — o sea, después de lo destructivo, que siempre va último.

            Acá vivía una lista de planes que escribía profiles.plan_id desde el
            navegador: movía el plan sin recalcular la cuota, sin tocar la
            suscripción de Mercado Pago y sin cobrar la diferencia, así que
            cualquiera pasaba de AMIGO a VIP y se quedaba con los topes del plan
            caro. Se sacó, y volvió como enlace —no como lista— a la MISMA hoja que
            cobra (HojaPlan → /api/pagos/crear), que recalcula el monto en el
            servidor y cancela la suscripción vieja si cambió. */}
        <button onClick={onPlan} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 14, padding: '13px 15px', cursor: 'pointer', fontFamily: '"DM Sans"' }}>
          <span>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: 'rgb(33,30,51)' }}>Cambiar de plan</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'rgb(135,129,160)' }}>Ahora estás en {profile.planName}</span>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'rgb(93,84,145)', flex: 'none' }}>Ver planes</span>
        </button>
        <a href="https://wa.me/5491125168802" target="_blank" rel="noopener" style={{ textAlign: 'center', background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 14, textDecoration: 'none' }}>Ayuda por WhatsApp</a>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = LANDING; }} style={{ background: 'none', color: 'rgb(135,129,160)', border: 'none', fontWeight: 600, fontSize: 13, padding: 10, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Cerrar sesión</button>
        <button onClick={() => { setBajaHecha(false); setBajaError(''); setBajaOpen(true); }} style={{ background: 'none', color: 'rgb(176,72,63)', border: 'none', fontWeight: 600, fontSize: 13, padding: 2, cursor: 'pointer', fontFamily: '"DM Sans"' }}>Darme de baja</button>
        {/* Va ÚLTIMO y más apagado que "Darme de baja", a propósito: son dos cosas
            que se piden con las mismas palabras y la de arriba es la que casi
            siempre se quiere. El que llega hasta acá es porque busca borrar. */}
        <button onClick={abrirBorrar} style={{ background: 'none', color: 'rgb(150,60,52)', border: 'none', fontWeight: 600, fontSize: 12.5, padding: 2, cursor: 'pointer', fontFamily: '"DM Sans"', textDecoration: 'underline' }}>Eliminar mi cuenta</button>
      </div>

      {pagosOpen && <HojaPagos pagos={pagos} onClose={() => setPagosOpen(false)} />}

      {borrarOpen && (
        <Sheet onClose={() => setBorrarOpen(false)}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>¿Eliminar tu cuenta?</div>
          {/* Lo primero que se lee es la diferencia con la baja, porque es el error
              que hay que evitar: el que quería pausar el cobro no tiene que
              enterarse acá de que perdió el carnet de sus mascotas. */}
          <p style={{ fontSize: 13.5, color: 'rgb(91,86,112)', lineHeight: 1.55, margin: '0 0 12px' }}>
            Esto <strong>borra tus datos para siempre</strong> y no se puede deshacer. Si lo que querés es dejar de pagar y guardar tu historial, usá <strong>Darme de baja</strong>: eso sí se puede revertir.
          </p>
          <div style={{ background: 'rgb(251,232,239)', border: '1px solid rgb(245,214,227)', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgb(150,60,52)', marginBottom: 6 }}>Se borra todo esto:</div>
            {cuentas ? (
              <div style={{ fontSize: 13, color: 'rgb(120,60,60)', lineHeight: 1.7 }}>
                {[['mascota', 'mascotas', cuentas.mascotas], ['reintegro', 'reintegros', cuentas.reintegros], ['pago', 'pagos', cuentas.pagos], ['publicación', 'publicaciones', cuentas.publicaciones], ['negocio', 'negocios', cuentas.negocios]]
                  .filter(([, , n]) => (n as number) > 0)
                  .map(([sing, plu, n]) => <div key={plu as string}>· {n as number} {(n as number) === 1 ? sing as string : plu as string}</div>)}
                <div>· Tu perfil y tu acceso al club</div>
              </div>
            ) : <div style={{ fontSize: 13, color: 'rgb(120,60,60)' }}>Contando…</div>}
          </div>
          {cuota.suscripcion === 'authorized' && (
            <p style={{ fontSize: 13, color: 'rgb(91,86,112)', lineHeight: 1.5, margin: '0 0 14px' }}>Tu débito automático se cancela en el mismo paso, así que no se te va a cobrar más.</p>
          )}
          {/* Escribir la palabra y no un botón "¿seguro?": es la única acción del
              socio sin vuelta atrás, y un click de más no puede alcanzar. */}
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgb(91,86,112)', marginBottom: 6 }}>Escribí BORRAR para confirmar</label>
          <input
            value={palabra}
            onChange={(e) => setPalabra(e.target.value)}
            placeholder="BORRAR"
            autoCapitalize="characters"
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgb(230,227,240)', borderRadius: 12, padding: '11px 13px', fontSize: 14, fontFamily: '"DM Sans"', marginBottom: 12 }}
          />
          {borrarError && <p style={{ fontSize: 13, color: 'rgb(176,58,58)', margin: '0 0 12px', lineHeight: 1.5 }}>{borrarError}</p>}
          <button
            onClick={confirmarBorrado}
            disabled={palabra.trim().toUpperCase() !== 'BORRAR' || busy}
            style={{ width: '100%', background: 'rgb(176,58,58)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 14, cursor: 'pointer', marginBottom: 8, fontFamily: '"DM Sans"', opacity: palabra.trim().toUpperCase() !== 'BORRAR' || busy ? 0.45 : 1 }}
          >
            {busy ? 'Borrando…' : 'Eliminar mi cuenta para siempre'}
          </button>
          <button onClick={() => setBorrarOpen(false)} style={{ ...sheetBtn(true), width: '100%' }}>Cancelar</button>
        </Sheet>
      )}

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
              <p style={{ fontSize: 13.5, color: 'rgb(91,86,112)', lineHeight: 1.55, margin: '0 0 12px' }}>Perdés el acceso a los beneficios, los reintegros y el carnet digital de {pets.length === 1 ? 'tu mascota' : 'tus mascotas'}. Los reintegros ya pedidos se siguen procesando.</p>
              {/* Se dice acá y no solo en el mail: es la duda que tiene todo el que
                  cancela algo que se debita solo. */}
              {cuota.suscripcion === 'authorized' && <p style={{ fontSize: 13.5, color: 'rgb(91,86,112)', lineHeight: 1.55, margin: '0 0 12px' }}>Tu débito automático se cancela ahora: no se te cobra más. Tus datos y tu historial quedan guardados.</p>}
              {bajaError && <p style={{ fontSize: 13, color: 'rgb(176,58,58)', lineHeight: 1.5, margin: '0 0 12px' }}>{bajaError}</p>}
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
/**
 * El diálogo de la webapp: los 8 "sheets" de estas pantallas pasan por acá.
 *
 * Aparece CENTRADO, como cualquier modal. Venía del prototipo como hoja inferior
 * —subía desde abajo, pegada al borde, con la barrita de arrastrar— porque el
 * prototipo estaba dibujado como app de teléfono. En la webapp, que se usa en una
 * pantalla grande, esa hoja aparecía lejísimos del lugar donde la persona acababa de
 * hacer clic, y la barrita prometía un gesto de arrastre que en el navegador no
 * existe. La app del celular sí mantiene sus hojas abajo, que ahí es lo correcto.
 *
 * `overscrollBehavior: contain` y `touchAction: pan-y` se quedan: sin eso, al llegar
 * al final del contenido el gesto pasa a la página de atrás y el diálogo parece
 * trabarse (pasa igual centrado, en una notebook con trackpad).
 */
function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(33,30,51,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'kfade 0.2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', background: '#fff', borderRadius: 24, padding: '24px 22px 22px', boxShadow: '0 24px 60px rgba(33,30,51,0.3)', animation: 'kpop 0.18s ease-out' }}>
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

/* ── Pantalla: Calendario de salud ─────────────────────────────── */
/**
 * El calendario ocupa la pantalla entera, no una hoja.
 *
 * Antes se abría como panel encima del carnet, con el carnet asomando detrás y
 * un botón "Cerrar" al final — o sea que para salir había que scrollear hasta
 * abajo. Es la vista más densa: doce meses navegables, la grilla y la leyenda.
 *
 * El detalle de un día SÍ sigue siendo una hoja: son dos o tres líneas.
 */
function CalendarioPagina({ vacs, onVolver }: { vacs: Vac[]; onVolver: () => void }) {
  const hoy = new Date();
  const [mes, setMes] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
  const [dia, setDia] = useState<CalCell | null>(null);
  const cells = buildCalMes(vacs, mes.y, mes.m);
  const mover = (delta: number) => setMes(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <button onClick={onVolver} style={{ background: 'none', border: 'none', color: 'rgb(93,84,145)', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '6px 0', marginBottom: 6, fontFamily: '"DM Sans"' }}>← Volver</button>
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 2 }}>Calendario de salud</div>
      <div style={{ fontSize: 13, color: 'rgb(135,129,160)', marginBottom: 18 }}>Vacunas, estudios y antiparasitarios: cuándo se aplicaron y cuándo toca el próximo.</div>

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

      {dia && (
        <Sheet onClose={() => setDia(null)}>
          {/* "Carnet" y no "Vacunas": el día puede tener un estudio o un
              antiparasitario, y el ícono ahora sale del tipo en lugar de ser el
              escudo de vacuna para todo. */}
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Carnet del {calDiaLabel(dia.iso!)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dia.vaxes.map((v, i) => {
              const tipo = (VACUNA_KINDS as string[]).includes(v.kind) ? (v.kind as VaccineKind) : 'Vacuna';
              const forma = KIND_ICON[tipo];
              const inner = forma === 'shield' ? shieldPath : forma === 'pill' ? pillPath : plusCircle;
              return (
                <div key={v.name + i} style={{ background: 'rgb(247,246,250)', border: '1px solid rgb(238,236,245)', borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgb(93,84,145)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#fff' }}>{ic(inner, false, 20)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: 'rgb(135,129,160)', marginTop: 2 }}>{tipo} · {v.estado}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => setDia(null)} style={{ ...sheetBtn(false), width: '100%', marginTop: 20 }}>Cerrar</button>
        </Sheet>
      )}
    </div>
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
  const elegirFoto = async (elegida?: File) => {
    if (!elegida) return;
    const listo = await prepararFoto(elegida);
    if ('error' in listo) { setError(listo.error); return; }
    const f = listo.file;
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

/**
 * La hoja del carnet: sirve para cargar y para corregir.
 *
 * Es la misma hoja a propósito. Un formulario aparte para editar es un formulario
 * que se olvida de un campo cuando el otro cambia; y para el socio, corregir es la
 * misma tarea que cargar, con los datos ya puestos.
 */
function CarnetSheet({ petName, vac, onClose, onSave, onBorrar }: {
  petName: string;
  /** La fila que se está corrigiendo. Sin esto, es un alta. */
  vac?: Vac | null;
  onClose: () => void;
  onSave: (v: FormVacuna) => Promise<void>;
  onBorrar?: () => void;
}) {
  const hoy = new Date();
  const inicial = vac ? formDeVacuna(vac) : null;
  const [kind, setKind] = useState<VaccineKind>(inicial?.kind ?? 'Vacuna');
  const [name, setName] = useState(inicial?.name ?? '');
  const [aplicada, setAplicada] = useState(inicial ? inicial.aplicada : true);
  const [fecha, setFecha] = useState<string | null>(inicial?.fecha ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /* El calendario abre en el mes de la fecha cargada, no en el actual: si estás
     corrigiendo algo de marzo, empezar en septiembre son seis clics al pedo. */
  const mesInicial = inicial?.fecha ? new Date(`${inicial.fecha}T12:00:00`) : hoy;
  const [pMes, setPMes] = useState({ y: mesInicial.getFullYear(), m: mesInicial.getMonth() });
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
      <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{vac ? 'Editar' : 'Agregar al carnet'}</div>
      <div style={{ fontSize: 13, color: 'rgb(135,129,160)', marginBottom: 18 }}>
        {vac ? `Corregí lo que haga falta del historial de ${petName}.` : `Sumá una vacuna, estudio o antiparasitario al historial de ${petName}.`}
      </div>

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

      {/* Borrar va abajo de todo y apagado, igual que en Mi perfil: es la salida
          para lo que se cargó por error, no una opción al lado de guardar. */}
      {onBorrar ? (
        <button
          type="button"
          onClick={onBorrar}
          disabled={busy}
          style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: 'rgb(150,60,52)', fontWeight: 600, fontSize: 13, textDecoration: 'underline', cursor: busy ? 'default' : 'pointer' }}
        >
          Borrar del carnet
        </button>
      ) : null}
    </Sheet>
  );
}

/* ── Pantalla: Notificaciones ──────────────────────────────────── */
const NOTIF_IC = { bell: bellPath, wallet, shield: shieldPath, chat, heart: heartPath } as const;
/** Cada notificación lleva a la pantalla donde el socio puede hacer algo con ella. */
const NOTIF_DESTINO: Record<Notif['to'], Screen> = { carnet: 'carnet', reintegros: 'reintegros', minegocio: 'negocio', foros: 'foros', perfil: 'perfil' };

function Notificaciones({ go, groups, visto, marcarLeidas, onAbrirHilo }: { go: (s: Screen) => void; groups: NotifGroup[]; visto: string | null; marcarLeidas: () => void; onAbrirHilo: (id: string | null) => void }) {
  /*
   * Abrir la campanita YA las marca leídas: es lo que espera cualquiera, y hasta
   * ahora había que tocar además un botón "Marcar leídas" —o sea que el contador
   * quedaba encendido después de haber leído todo—.
   *
   * El resaltado de "sin leer" se congela al abrir (`vistoAlAbrir`) y no sigue al
   * valor guardado. Si usara el valor vivo, marcarlas apagaría el resaltado en el
   * mismo instante y la persona perdería de vista cuáles eran las nuevas
   * justamente mientras las está mirando. Así: el contador se apaga, y las nuevas
   * se siguen distinguiendo hasta que salga de la pantalla.
   */
  const [vistoAlAbrir] = useState(visto);
  /* Por referencia y con dependencias vacías a propósito: `marcarLeidas` se
     recrea en cada render, así que como dependencia del efecto se dispararía en
     bucle —marca, cambia el estado, vuelve a renderizar, vuelve a marcar—. */
  const marcar = useRef(marcarLeidas);
  marcar.current = marcarLeidas;
  useEffect(() => { marcar.current(); }, []);
  const vistoMs = vistoAlAbrir ? new Date(vistoAlAbrir).getTime() : 0;
  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22 }}>Notificaciones</div>
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
                <button key={n.id} onClick={() => { onAbrirHilo(n.targetId ?? null); go(NOTIF_DESTINO[n.to]); }} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderRadius: 16, padding: '13px 14px', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: '"DM Sans"', background: unread ? '#faf9fd' : '#fff', border: unread ? '1px solid #e6e1f2' : '1px solid #eeecf5' }}>
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

      {/* Acá iba un switch de "Push y recordatorios" heredado del prototipo. Estaba
          pintado prendido y no controlaba nada, y se sacó en vez de hacerlo andar:
          en el navegador el push es otro mecanismo (Web Push, con service worker y
          VAPID) y no comparte NADA con el de la app, que va por Expo/FCM con un
          token del aparato. Sostener los dos para que uno funcione a medias no se
          justifica — y a medias de verdad, porque Safari en iPhone no entrega web
          push salvo que el socio agregue el sitio a la pantalla de inicio.
          El push vive en la app, y ahí el switch sí es un control real. */}
    </div>
  );
}

/* ── Shell ─────────────────────────────────────────────────────── */
/** Última vez que el socio miró las notificaciones. No hay tabla: alcanza con el navegador. */
const VISTO_KEY = 'kumo:notif-visto';

export default function AppClient({ profile, pets, reintegros, contacts, providers, benefits, posts, negocios, notifInput, guardados, reviews, misLikes, planes, cuota, pagos, centro }: { profile: Profile; pets: Pet[]; reintegros: Reint[]; contacts: EmergencyContact[]; providers: ProviderVM[]; benefits: BenefitVM[]; posts: ForumPost[]; negocios: MiNegocio[]; notifInput: NotifInput; guardados: string[]; reviews: Record<string, Review[]>; misLikes: MisLikes; planes: PlanVM[]; cuota: CuotaVM; pagos: PagoVM[]; /** El centro del mapa: el domicilio del socio, o el centro de CABA si no se pudo resolver (y ahi `etiqueta` es null, porque no es la casa de nadie). */ centro: { lat: number; lng: number; etiqueta: string | null } }) {
  const [screen, setScreen] = useState<Screen>('inicio');
  const [petIdx, setPetIdx] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  /** La hoja para elegir plan y pagar. Antes era un muro que tapaba todo; ahora se
   *  abre a pedido, porque el socio ya está adentro del club. */
  const [planAbierto, setPlanAbierto] = useState(false);
  const go = (s: Screen) => { setScreen(s); setNavOpen(false); };
  const reintegradoTotal = reintegros.filter((r) => r.status === 'Aprobado').reduce((a, r) => a + r.refund, 0);

  /** ¿Tiene la cuota paga? Es la misma verdad que mira la RLS en la base. */
  const pago = tieneFeaturesPagas(cuota.debePagar);
  /** El plan más barato que el club tiene cargado, para el "desde" del banner. En 0
   *  si no hay planes: ahí el banner no se muestra en vez de decir "desde $0". */
  const desdePlan = planes.length ? Math.min(...planes.map((p) => p.price)) : 0;
  /* Ya compró un plan y está entrando el cobro: ofrecerle uno sería venderle lo que
     acaba de pagar. Se le esconde el banner hasta que se acredite. */
  const acreditandose = cuota.suscripcion === 'authorized' && !cuota.hasta;
  const NAV = navDe(pago);
  /*
   * La pantalla se DERIVA, no se corrige con un efecto.
   *
   * Si a alguien se le vence la cuota estando en Beneficios, `screen` sobrevive al
   * refresco del servidor y la lista le vuelve vacía por RLS: leería "todavía no hay
   * beneficios activos, el club los va cargando", o sea una mentira sobre el club. Un
   * `useEffect` que redirija pinta ese frame igual antes de corregirlo.
   */
  const pantalla: Screen = !pago && FEATURES_PAGAS.includes(screen as FeaturePaga) ? 'inicio' : screen;
  const current = NAV.find((n) => n.key === pantalla);

  /* Qué publicación del foro abrir al llegar desde una notificación. Vive en el
     shell y no en Foros porque lo decide la campanita, que es otra pantalla. */
  const [hiloDesdeAviso, setHiloDesdeAviso] = useState<string | null>(null);

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
      {/* La hoja del plan, a pedido. Ya no tapa nada: entrar es gratis, y lo que se
          paga son los reintegros y los beneficios. Se abre desde Inicio, Mi perfil y
          la tarjeta de beneficios. */}
      {planAbierto && <HojaPlan cuota={cuota} nombre={profile.firstName} planes={planes} onClose={() => setPlanAbierto(false)} irABeneficios={() => { setPlanAbierto(false); go('beneficios'); }} />}
      {/* Barra superior (solo abajo de 1024px) */}
      <div className="wa-topbar">
        <button onClick={() => setNavOpen(true)} aria-label="Abrir menú" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'rgb(93,84,145)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" style={{ display: 'block' }}><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
        </button>
        <span style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 21, color: 'rgb(93,84,145)' }}>Kumo</span>
        <span style={{ fontSize: 13.5, color: 'rgb(91,86,112)', fontWeight: 600, marginLeft: 'auto' }}>{pantalla === 'notif' ? 'Notificaciones' : pantalla === 'prestar' ? 'Prestar servicio' : pantalla === 'mismascotas' ? 'Mis mascotas' : current?.label}</span>
      </div>
      {navOpen && <button className="wa-scrim" aria-label="Cerrar menú" onClick={() => setNavOpen(false)} />}
      <div className={navOpen ? 'wa-side wa-side-open' : 'wa-side'} style={{ width: 220, flex: '0 0 auto', borderRight: '1px solid rgb(238,236,245)', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => go('inicio')} style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, color: 'rgb(93,84,145)', padding: '4px 14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>Kumo</button>
        {NAV.map((n) => {
          const active = pantalla === n.key;
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
          {pantalla === 'inicio' && <Inicio go={go} petIdx={petIdx} setPetIdx={setPetIdx} pets={pets} profile={profile} noLeidas={noLeidas} pago={pago} desdePlan={acreditandose ? 0 : desdePlan} onPlan={() => setPlanAbierto(true)} />}
          {pantalla === 'carnet' && <Carnet petIdx={petIdx} setPetIdx={setPetIdx} pets={pets} profile={profile} contacts={contacts} />}
          {pantalla === 'servicios' && <Servicios go={go} providers={providers} initialGuardados={guardados} profile={profile} reviews={reviews} centro={centro} />}
          {pantalla === 'prestar' && <Prestar go={go} profile={profile} />}
          {pantalla === 'reintegros' && pago && <Reintegros initialReintegros={reintegros} planName={profile.planName} memberId={profile.id} pets={pets} banco={profile.banco} />}
          {pantalla === 'beneficios' && pago && <Beneficios benefits={benefits} go={go} centro={centro} profile={profile} />}
          {pantalla === 'foros' && <Foros initialPosts={posts} profile={profile} misLikes={misLikes} abrirHilo={hiloDesdeAviso} onHiloAbierto={() => setHiloDesdeAviso(null)} />}
          {pantalla === 'negocio' && <Negocio go={go} negocios={negocios} profile={profile} misReviews={negocios.flatMap((n) => reviews[n.id] ?? [])} />}
          {pantalla === 'mismascotas' && <MisMascotas go={go} ownerId={profile.id} pets={pets} reintegros={reintegros} setPetIdx={setPetIdx} />}
          {pantalla === 'perfil' && <Perfil go={go} profile={profile} pets={pets} reintegradoTotal={reintegradoTotal} negocios={negocios} cuota={cuota} pago={pago} pagos={pagos} onPlan={() => setPlanAbierto(true)} />}
          {pantalla === 'notif' && <Notificaciones go={go} groups={notifGroups} visto={visto} marcarLeidas={marcarLeidas} onAbrirHilo={setHiloDesdeAviso} />}
        </div>
      </div>
    </div>
  );
}
