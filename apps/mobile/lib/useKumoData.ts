import { useCallback, useEffect, useState } from 'react';
import { diaISO, diasHasta, hoyISO, providerBadge, pagoEnHistorial, type EstadoPago, type MedioPago, distanciaKm, origenDelSocio, etiquetaCentro, textoDistancia, tarjetaLabel, etiquetaPlan, etiquetaOdonto, selloCarnet, type NotifInput, type VaccineKind, type Review, type EstadoSuscripcion } from '@kumo/shared';
import { supabase } from './supabase';

/* ── Formas que consumen las pantallas ─────────────────────────── */
/** `appliedOn`/`dueOn` van crudas además de formateadas en `sub`: el calendario las necesita para ubicar el día. */
export type Vac = { id: string; name: string; kind: VaccineKind; sub: string; status: string; tone: 'green' | 'lime' | 'amber'; appliedOn: string | null; dueOn: string | null; mark: boolean; remind: boolean };
export type Pet = {
  id: string; name: string; species: string; plan: string; socio: string; photo: string;
  breed: string; age: string; microchip: string; castrado: string; odonto: string; next: string; vaccines: Vac[];
  /** El sello del carnet, resuelto acá y no en la pantalla: ver `selloCarnet`. */
  sello: { texto: string; tono: 'ok' | 'neutro' | 'alerta' };
};
export type Profile = {
  id: string; firstName: string; fullName: string; memberNo: string; planName: string;
  // `planPrice` es la cuota que aceptó al firmar (plan + add-ons), no el precio
  // de lista: con la cobertura odontológica paga $12.000 más.
  planPrice: number; addonOdonto: boolean;
  email: string; phone: string; address: string; city: string; province: string; dni: string;
  /** La cuenta donde el club le transfiere los reintegros: se pide en el alta y
   *  el formulario de reintegro la prefija. */
  banco: { holder: string | null; cuit: string | null; cbu: string | null; alias: string | null };
  tarjeta: string | null;
  /**
   * La cuota. `debePagar` es una fecha comparada con hoy, no un "al día"
   * guardado: un booleano hay que apagarlo con un cron y mientras no corre miente.
   *
   * Si debe, la app le pone el muro encima. Es distinto de estar suspendido —ahí se
   * cierra la sesión—: acá el socio está bien con el club y lo que falta es pagar.
   */
  cuotaHasta: string | null;
  debePagar: boolean;
  /** El tipo cerrado y no : la hoja del plan decide qué mostrar según el
   *  estado, y con un string suelto un valor inesperado pasaba sin que nadie avise. */
  suscripcion: EstadoSuscripcion;
};
export type ProviderVM = {
  id: string; name: string; category: string; zone: string; badge?: string;
  /** Null = el prestador no tiene coordenadas cargadas: no se sabe a qué distancia
   *  está, así que no se muestra ni se filtra por radio (antes era 0 km, que lo
   *  ponía primero en la lista como si estuviera en la puerta). */
  km: number | null;
  /** "de tu casa" · "de tu zona" · "del centro", según cuánto se pudo resolver del
   *  domicilio del socio. */
  kmDesde: string;
  /** Para abrir el lugar en la app de mapas: se abre en el pin, no en el texto. */
  lat: number | null;
  lng: number | null;
  rating: number; reviews: number; price: number; priceUnit: string; phone: string;
  /** La portada: la banda de arriba de la ficha. */
  photo: string | null;
  /** El logo cuadrado: el avatar y el cuadradito del listado. Null = se usa la portada. */
  logo: string | null;
  // Los usa la ficha del prestador.
  about: string; address: string; instagram: string | null; website: string | null; verificado: boolean;
};
/** La ficha del beneficio usa todo lo que la tabla ya guardaba y no se mostraba:
 *  descripción, zona, días, horario y vigencia. */
export type BenefitVM = {
  id: string; name: string; cat: string; disc: string; icon: 'hospital' | 'store' | 'pill' | 'droplet';
  description: string; zone: string; days: string[]; hours: string; validUntil: string | null; planRequirement: string;
  /** La dirección del comercio y a qué distancia le queda al socio. `km` es null
   *  cuando el club no cargó dirección: ahí no se muestra distancia. */
  address: string | null; km: number | null; kmDesde: string;
  /** Para el pin del mapa. Null cuando no hay dirección cargada. */
  lat: number | null; lng: number | null;
};
/** El detalle necesita bastante más que la tarjeta del historial: el seguimiento,
 *  el comprobante y los datos de acreditación. */
export type ReintVM = {
  id: string; place: string; det: string; concept: string; fecha: string;
  spent: number; refund: number; refundPct: number; estado: string; estadoRaw: string;
  pet: string; receiptNo: string | null; receiptPath: string | null;
  /** Cuando el club lo resolvio, ya formateada. Vacia si sigue en revision o si
   *  se resolvio antes de que existiera la columna. */
  resueltoEl: string;
  bank: { holder: string | null; dni: string | null; cuit: string | null; name: string | null; cbu: string | null; alias: string | null };
};
export type ForumAnswer = { id: string; author: string; when: string; text: string; likes: number; best: boolean; propia: boolean };
/** El hilo necesita cuerpo, zona y respuestas: antes solo se leía título y contadores. */
export type ForumPost = {
  id: string; cat: string; author: string; meta: string; title: string; body: string;
  replies: number; likes: number; trend: boolean; answers: ForumAnswer[];
  /** Foto de la publicación, si el autor adjuntó una. */
  photo: string | null;
  /** Para mostrar el botón de borrar solo en lo propio. */
  propia: boolean;
};

export type KumoData = {
  profile: Profile | null;
  pets: Pet[];
  providers: ProviderVM[];
  benefits: BenefitVM[];
  reintegros: ReintVM[];
  reintTotal: number;
  posts: ForumPost[];
  planes: PlanVM[];
  /** El historial de cuotas. La RLS ya lo permitía y ninguna pantalla lo mostraba. */
  pagos: PagoVM[];
  /** El centro de los mapas: el domicilio del socio, o el de CABA si no se pudo
   *  resolver (y ahí `etiqueta` es null, porque el Obelisco no es la casa de nadie). */
  centro: { lat: number; lng: number; etiqueta: string | null };
  contacts: EmergencyContact[];
  /** Los negocios propios. Pueden estar pendientes o rechazados, así que no salen del listado de verificados. */
  negocios: MiNegocio[];
  /** Materia prima de las notificaciones: la lista la arma `buildNotifs` de @kumo/shared, igual que la webapp. */
  notifInput: NotifInput;
  /** Ids de los prestadores guardados (el corazón de la ficha y "Mis guardados"). */
  guardados: string[];
  /** Reseñas por prestador, más nuevas primero. */
  reviews: Record<string, Review[]>;
  /** Lo que likeó el socio, para pintar el corazón y no contar dos veces. */
  misLikes: { posts: string[]; answers: string[] };
};

/** Contactos de emergencia del carnet. La webapp ya los tenía; en mobile no
 *  existían. */
export type EmergencyContact = { id: string; name: string; phone: string; type: string; address: string; hours: string };

/** Los planes, para el cambio de plan de Mi perfil. */
export type PlanVM = { id: string; name: string; basePrice: number };

/**
 * Una cuota cobrada, como la ve el socio. Gemelo del `PagoVM` de la webapp.
 *
 * `cubreHasta` es lo que hace útil la lista: no alcanza con "pagué $18.000 el 19 de
 * agosto", lo que importa es hasta cuándo llegó ese pago.
 */
export type PagoVM = {
  id: string; fecha: string; monto: number; plan: string | null;
  estado: EstadoPago; medio: MedioPago; cubreHasta: string | null; detalle: string | null;
};
export type MiNegocio = { id: string; name: string; category: string; zone: string; /** La dirección del local, si atiende en uno: es lo que lo pone en el mapa. */ address: string | null; phone: string | null; status: string; rating: number; reviews: number; /** La portada de su ficha. Null = todavía no subió ninguna, y no se le inventa una. */ photo: string | null; /** El logo cuadrado. Null = no subió, se usa la portada. */ logo: string | null };

/* ── Helpers de formato ────────────────────────────────────────── */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const asDate = (iso: string) => new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = asDate(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtShort(iso: string | null): string {
  if (!iso) return '—';
  const d = asDate(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
}
const daysUntil = (iso: string | null): number | null => (iso ? diasHasta(iso) : null);
function relTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${Math.max(mins, 1)} min`;
  const hs = Math.round(mins / 60);
  if (hs < 24) return `hace ${hs}h`;
  const days = Math.round(hs / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

/* Las distancias se miden desde el domicilio del socio (`profiles.lat/lng`,
   geocodificado en el alta) y no desde un punto fijo en CABA. La cuenta y el texto
   de "desde dónde" están en `@kumo/shared` (cerca.ts), compartidos con la web. */

const PET_FALLBACK = ['happy-dog.webp', 'plan-cat.webp'];

function benefitIcon(category: string): BenefitVM['icon'] {
  const c = category.toLowerCase();
  if (c.includes('baño') || c.includes('estética')) return 'droplet';
  if (c.includes('medicamento') || c.includes('pipeta')) return 'pill';
  if (c.includes('aliment') || c.includes('accesorio') || c.includes('juguete')) return 'store';
  return 'hospital';
}

const ESTADO_REINT: Record<string, string> = {
  en_revision: 'En revisión', acreditado: 'Acreditado', rechazado: 'Rechazado', pendiente: 'Pendiente',
};

type VacRow = { id: string; name: string; kind: VaccineKind; applied_on: string | null; due_on: string | null; status: string };
function mapVac(v: VacRow): Vac {
  const d = daysUntil(v.due_on);
  const base = { id: v.id, name: v.name, kind: v.kind ?? 'Vacuna', appliedOn: v.applied_on, dueOn: v.due_on };
  if (v.status === 'aplicada' || v.due_on == null) {
    return { ...base, sub: `Aplicada ${fmtDate(v.applied_on)}`, status: 'Al día ✓', tone: 'green', mark: false, remind: false };
  }
  const label = d == null ? '—' : d < 0 ? 'Vencida' : d === 0 ? 'Hoy' : `En ${d} días`;
  const tone: Vac['tone'] = d != null && d <= 7 ? 'lime' : 'amber';
  return { ...base, sub: `Próxima: ${fmtDate(v.due_on)}`, status: label, tone, mark: true, remind: tone === 'lime' };
}

/* ── Hook ──────────────────────────────────────────────────────── */
/**
 * ¿El error es del token y no de la consulta?
 *
 * Supabase devuelve estos casos como un error común de la consulta, y sin
 * distinguirlos la app mostraba el mensaje crudo —"JWT issued at future", que le
 * pasó a Flor el 19/08— y se quedaba ahí. Un socio que ve eso no cierra sesión ni
 * borra los datos de la app: cierra la app y no vuelve.
 *
 * Se mira el texto porque no hay un código estable para esto. Es frágil, pero
 * falla del lado seguro: si no reconoce el mensaje, se comporta como antes.
 */
function esProblemaDeSesion(mensaje: string): boolean {
  return /jwt|token|expired|issued|session|not authenticated|invalid claim/i.test(mensaje);
}

export function useKumoData(userId: string | null) {
  const [data, setData] = useState<KumoData | null>(null);
  const [loading, setLoading] = useState(true);
  /** Mensaje de las consultas que fallaron, para que no quede en silencio. */
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (esReintento = false) => {
    if (!userId) { setData(null); setError(null); setLoading(false); return; }

    const [profileRes, petsRes, reintRes, provRes, benefRes, postsRes, negocioRes, favRes, revRes, plikeRes, alikeRes, planesRes, contactosRes, pagosRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, member_no, email, phone, address, city, province, lat, lng, geo_origen, dni, paid_until, mp_subscription_status, addon_odonto, monthly_fee_agreed, bank_holder, bank_cuit, bank_cbu, bank_alias, card_brand, card_last4, plans(name, base_price)').eq('id', userId).single(),
      supabase.from('pets').select('id, name, type, breed, age_years, weight_kg, microchip, neutered, photo_url, vaccinations(id, name, kind, status, applied_on, due_on)').eq('owner_id', userId),
      supabase.from('reimbursements').select('id, provider_name, concept, amount, refund, refund_pct, status, requested_on, resolved_at, created_at, receipt_no, receipt_path, bank_holder, bank_holder_dni, bank_cuit, bank_name, bank_cbu, bank_alias, pets(name)').eq('member_id', userId).order('requested_on', { ascending: false }),
      supabase.from('providers').select('id, name, category, zone, rating, reviews, price, price_unit, phone, photo_url, logo_url, lat, lng, about, address, instagram, website, status').eq('status', 'verificado'),
      supabase.from('benefits').select('id, name, category, discount, description, zone, address, lat, lng, days, hours, valid_until, plan_requirement').eq('status', 'activo'),
      supabase.from('community_posts').select('id, category, title, body, photo_url, zone, replies, likes, created_at, author_name, author_id, community_answers(id, text, likes, best, created_at, author_name, author_id)').order('created_at', { ascending: false }).limit(20),
      /* Son VARIOS: un socio puede tener un servicio y un comercio. Antes esto era
         un maybeSingle(), que con dos filas del mismo dueño no devuelve una:
         devuelve error, así que Mi negocio se rompía en vez de mostrar de menos. */
      supabase.from('providers').select('id, name, category, zone, address, phone, status, rating, reviews, created_at, photo_url, logo_url').eq('owner_id', userId).order('created_at', { ascending: true }),
      supabase.from('provider_favorites').select('provider_id').eq('member_id', userId),
      supabase.from('provider_reviews').select('id, provider_id, member_id, rating, text, author_name, created_at').order('created_at', { ascending: false }),
      supabase.from('post_likes').select('post_id').eq('member_id', userId),
      supabase.from('answer_likes').select('answer_id').eq('member_id', userId),
      supabase.from('plans').select('id, name, base_price'),
      supabase.from('emergency_contacts').select('id, name, phone, type, address, hours').eq('owner_id', userId),
      // El historial de cuotas: doce meses alcanzan para cualquier reclamo y no
      // obligan a paginar.
      supabase.from('payments')
        .select('id, amount, status, method, plan_name, covers_until, detail, created_at, paid_at')
        .eq('member_id', userId)
        .order('created_at', { ascending: false })
        .limit(24),
    ]);

    /**
     * Si una consulta falla, que se sepa.
     *
     * Supabase no lanza: devuelve `{ data: null, error }`. Con el `?? []` de más
     * abajo, un error de permisos o de una columna que no existe se veía igual
     * que "todavía no cargaste nada", y la pantalla mostraba el vacío como si
     * fuera la verdad. Eso hizo perder un buen rato averiguando por qué un socio
     * con mascota no la veía.
     */
    const fallas = (
      [
        ['perfil', profileRes], ['mascotas', petsRes], ['reintegros', reintRes],
        ['prestadores', provRes], ['beneficios', benefRes], ['foro', postsRes],
        ['mi negocio', negocioRes], ['guardados', favRes], ['reseñas', revRes],
        ['likes', plikeRes], ['likes de respuestas', alikeRes], ['planes', planesRes], ['contactos', contactosRes],
        ['pagos', pagosRes],
      ] as const
    )
      .filter(([, res]) => res.error)
      .map(([que, res]) => `${que}: ${res.error!.message}`);

    if (fallas.length) console.warn('[kumo] consultas con error →', fallas.join(' · '));

    /*
     * Si lo que falló es la sesión, la app se recupera sola.
     *
     * Primero renueva el token y reintenta UNA vez (el `esReintento` corta la
     * recursión: sin eso, un token que no se puede renovar dispara un bucle de
     * consultas). Si el reintento tampoco anda, cierra la sesión: el socio termina
     * en el login, que es una pantalla donde SE PUEDE hacer algo, en lugar de una
     * pantalla trabada con un mensaje que no significa nada para él.
     *
     * Antes esto no existía y el error crudo de la base se mostraba tal cual.
     */
    const problemaDeSesion = fallas.some((f) => esProblemaDeSesion(f));
    if (problemaDeSesion && !esReintento) {
      console.warn('[kumo] parece un problema de sesión: renuevo el token y reintento');
      const { data: nueva, error: errRefresh } = await supabase.auth.refreshSession();
      if (nueva.session && !errRefresh) {
        await load(true);
        return;
      }
      // No se pudo renovar: la sesión no sirve más. `onAuthStateChange` lleva al
      // login solo, así que no hace falta mostrar nada.
      console.warn('[kumo] no se pudo renovar la sesión, cierro sesión');
      await supabase.auth.signOut();
      return;
    }

    /*
     * Lo que se muestra NO es el mensaje de la base. "JWT issued at future" o
     * "column x does not exist" no le sirven a nadie que no esté programando; lo
     * técnico va al log, y en pantalla va qué no se pudo traer.
     */
    setError(fallas.length
      ? `No pudimos traer: ${fallas.map((f) => f.split(':')[0]).join(', ')}. Probá de nuevo en un rato.`
      : null);

    const p = profileRes.data;
    const plan = p ? (Array.isArray(p.plans) ? p.plans[0] : p.plans) : null;
    const planName = plan?.name ?? '—';
    const memberNo = p?.member_no ? `#${p.member_no}` : '—';
    // El carnet dice sólo lo que la cuota sostiene: la cobertura odontológica y el
    // sello salen de la cuota paga, igual que los reintegros y los beneficios.
    const debePagar = !p?.paid_until || p.paid_until < hoyISO();

    const profile: Profile | null = p ? {
      id: p.id, firstName: p.full_name.split(' ')[0] ?? p.full_name, fullName: p.full_name, memberNo,
      planName, planPrice: p.monthly_fee_agreed ?? plan?.base_price ?? 0,
      addonOdonto: p.addon_odonto ?? false, email: p.email, phone: p.phone ?? '—',
      address: p.address ?? '—', city: p.city ?? '—', province: p.province ?? '—', dni: p.dni ?? '—',
      banco: { holder: p.bank_holder, cuit: p.bank_cuit, cbu: p.bank_cbu, alias: p.bank_alias },
      tarjeta: tarjetaLabel(p.card_brand, p.card_last4),
      cuotaHasta: p.paid_until ?? null,
      debePagar: !p.paid_until || p.paid_until < hoyISO(),
      suscripcion: (p.mp_subscription_status ?? null) as EstadoSuscripcion,
    } : null;

    const pets: Pet[] = (petsRes.data ?? []).map((row, i) => {
      const vacs = (row.vaccinations ?? []).map(mapVac);
      const upcoming = (row.vaccinations ?? [])
        .filter((v: VacRow) => v.due_on && v.status !== 'aplicada')
        .sort((a: VacRow, b: VacRow) => (a.due_on! < b.due_on! ? -1 : 1))[0];
      const breedParts = [
        row.breed ?? 'Mestizo',
        row.age_years != null ? `${row.age_years} años` : null,
        row.weight_kg != null ? `${row.weight_kg} kg` : null,
      ].filter(Boolean);
      const species = row.type === 'gato' ? 'Gato' : 'Perro';
      return {
        id: row.id, name: row.name, species, plan: etiquetaPlan(planName, debePagar, p?.mp_subscription_status === 'authorized' && !p?.paid_until), socio: memberNo,
        photo: row.photo_url ?? PET_FALLBACK[i % PET_FALLBACK.length]!,
        breed: breedParts.join(' · '),
        age: row.age_years != null ? `${species} · ${row.age_years} años` : species,
        microchip: row.microchip ?? '—',
        castrado: row.neutered ? 'Sí' : 'No',
        // La cobertura la habilita la cuota paga, no haberla contratado: misma regla
        // que los reintegros y los beneficios. Estaba fija en "No activo" para todos.
        odonto: etiquetaOdonto(p?.addon_odonto === true, debePagar),
        sello: selloCarnet({ debePagar, tienePlan: !!plan?.name, cuotaHasta: p?.paid_until ?? null, suscripcion: (p?.mp_subscription_status ?? null) as EstadoSuscripcion }),
        next: upcoming ? `Próxima: ${fmtShort(upcoming.due_on)}` : 'Todo al día',
        vaccines: vacs,
      };
    });

    /* Desde dónde ve el mundo este socio: su domicilio, o el centro de CABA si no
       se pudo geocodificar —y en ese caso la pantalla lo dice. */
    const desde = origenDelSocio({ lat: p?.lat, lng: p?.lng, geoOrigen: p?.geo_origen });
    const kmDesde = textoDistancia(desde.origen);
    const providers: ProviderVM[] = (provRes.data ?? []).map((r) => ({
      id: r.id, name: r.name, category: r.category, zone: r.zone,
      km: r.lat != null && r.lng != null ? distanciaKm(desde, { lat: r.lat, lng: r.lng }) : null,
      kmDesde,
      lat: r.lat, lng: r.lng,
      // El sello sale del estado que puso el admin, con el mismo criterio que la webapp.
      badge: providerBadge(r.status, r.rating, r.reviews), verificado: r.status === 'verificado',
      rating: r.rating, reviews: r.reviews, price: r.price, priceUnit: r.price_unit,
      /* Sin foto queda en null y NO se le pone una de archivo: antes el prestador
         que no subía nada salía con la foto de un paseador cualquiera, o sea que su
         ficha mostraba un local ajeno. La pantalla dibuja el ícono del rubro. */
      phone: r.phone ?? '', photo: r.photo_url ?? null, logo: r.logo_url ?? null,
      about: r.about ?? '', address: r.address ?? '', instagram: r.instagram, website: r.website,
      // Los que no tienen coordenadas van al final: no se puede afirmar que estén
      // cerca, pero tampoco hay motivo para esconderlos.
    })).sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

    const benefits: BenefitVM[] = (benefRes.data ?? []).map((b) => ({
      id: b.id, name: b.name, cat: b.category, disc: b.discount, icon: benefitIcon(b.category),
      description: b.description ?? '', zone: b.zone ?? '', days: b.days ?? [], hours: b.hours ?? '',
      validUntil: b.valid_until, planRequirement: b.plan_requirement,
      address: b.address,
      km: b.lat != null && b.lng != null ? distanciaKm(desde, { lat: b.lat, lng: b.lng }) : null,
      kmDesde,
      // Para el pin del mapa de Beneficios.
      lat: b.lat, lng: b.lng,
    }));

    const reintegros: ReintVM[] = (reintRes.data ?? []).map((r) => {
      const pet = Array.isArray(r.pets) ? r.pets[0] : r.pets;
      return {
        id: r.id, place: r.provider_name, det: `${r.concept} · ${fmtDate(r.requested_on)}`,
        concept: r.concept, fecha: fmtDate(r.requested_on), resueltoEl: r.resolved_at ? fmtDate(diaISO(r.resolved_at)) : '',
        spent: r.amount, refund: r.refund, refundPct: r.refund_pct,
        estado: ESTADO_REINT[r.status] ?? r.status, estadoRaw: r.status,
        pet: pet?.name ?? '—', receiptNo: r.receipt_no, receiptPath: r.receipt_path,
        bank: {
          holder: r.bank_holder, dni: r.bank_holder_dni, cuit: r.bank_cuit,
          name: r.bank_name, cbu: r.bank_cbu, alias: r.bank_alias,
        },
      };
    });
    const reintTotal = (reintRes.data ?? []).filter((r) => r.status === 'acreditado').reduce((a, r) => a + r.refund, 0);

    // El nombre viene en la fila: el join a `profiles` devolvía null por la RLS y
    // todos los autores salían como "Socio".
    type AnsRow = { id: string; text: string; likes: number; best: boolean; created_at: string; author_name: string; author_id: string | null };
    const posts: ForumPost[] = (postsRes.data ?? []).map((row) => ({
      id: row.id, cat: row.category, title: row.title, body: row.body ?? '', photo: row.photo_url ?? null,
      author: row.author_name?.trim().split(' ')[0] || 'Socio',
      meta: `${row.zone || 'General'} · ${relTime(row.created_at)}`,
      replies: row.replies, likes: row.likes, trend: row.likes >= 20,
      propia: row.author_id === userId,
      answers: ((row.community_answers ?? []) as AnsRow[])
        .slice()
        .sort((a, b) => (b.best ? 1 : 0) - (a.best ? 1 : 0) || Date.parse(a.created_at) - Date.parse(b.created_at))
        .map((a) => ({
          id: a.id, author: a.author_name?.trim().split(' ')[0] || 'Socio', when: relTime(a.created_at),
          text: a.text, likes: a.likes, best: a.best, propia: a.author_id === userId,
        })),
    }));

    const negocios: MiNegocio[] = (negocioRes.data ?? []).map((n) => ({
      id: n.id, name: n.name, category: n.category, zone: n.zone, address: n.address, phone: n.phone,
      status: n.status, rating: n.rating, reviews: n.reviews, photo: n.photo_url, logo: n.logo_url,
    }));

    const notifInput: NotifInput = {
      pets: (petsRes.data ?? []).map((row) => ({
        name: row.name,
        vaccines: ((row.vaccinations ?? []) as VacRow[]).map((v) => ({ id: v.id, name: v.name, kind: v.kind, status: v.status, dueOn: v.due_on })),
      })),
      reintegros: (reintRes.data ?? []).map((r) => ({
        id: r.id, providerName: r.provider_name, refund: r.refund, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at,
      })),
      negocios: (negocioRes.data ?? []).map((n) => ({ id: n.id, name: n.name, status: n.status, createdAt: n.created_at })),
    };

    const guardados: string[] = (favRes.data ?? []).map((f) => f.provider_id);

    const reviews: Record<string, Review[]> = {};
    for (const r of revRes.data ?? []) {
      (reviews[r.provider_id] ??= []).push({
        id: r.id, author: r.author_name, rating: r.rating, text: r.text,
        createdAt: r.created_at, propia: r.member_id === userId,
      });
    }

    const misLikes = {
      posts: (plikeRes.data ?? []).map((l) => l.post_id),
      answers: (alikeRes.data ?? []).map((l) => l.answer_id),
    };

    const planes: PlanVM[] = (planesRes.data ?? [])
      .map((r) => ({ id: r.id, name: r.name, basePrice: r.base_price }))
      .sort((a, b) => a.basePrice - b.basePrice);

    const contacts: EmergencyContact[] = (contactosRes.data ?? []).map((c) => ({
      id: c.id, name: c.name, phone: c.phone ?? '—', type: c.type ?? 'Veterinaria',
      address: c.address ?? '', hours: c.hours ?? '',
    }));

    /*
     * El historial de cuotas.
     *
     * `paid_at` cuando existe y `created_at` si no: la fecha que le importa al socio es
     * la del cobro. Los pendientes viejos se caen (ver `pagoEnHistorial`): un checkout
     * abandonado no es un pago, y listarlo parece deuda.
     *
     * El detalle solo cuando lo escribió una persona: el de Mercado Pago es texto de
     * máquina y trae adentro el id de la suscripción.
     */
    const pagos: PagoVM[] = (pagosRes.data ?? [])
      .filter((p) => pagoEnHistorial(p.status as EstadoPago, p.created_at))
      .map((p) => ({
        id: p.id,
        fecha: fmtShort(diaISO(p.paid_at ?? p.created_at)),
        monto: p.amount,
        plan: p.plan_name,
        estado: p.status as EstadoPago,
        medio: p.method as MedioPago,
        cubreHasta: p.covers_until ? fmtShort(p.covers_until) : null,
        detalle: p.method === 'manual' ? p.detail : null,
      }));

    setData({ profile, pets, providers, benefits, reintegros, reintTotal, posts, planes, pagos, contacts, negocios, notifInput, guardados, reviews, misLikes, centro: { lat: desde.lat, lng: desde.lng, etiqueta: etiquetaCentro(desde.origen) } });
    setLoading(false);
  }, [userId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  /*
   * Lo que se expone NO acepta argumentos, a propósito: `onPress={reload}` en
   * React Native pasa el evento del toque como primer argumento, y con `load`
   * expuesto directo ese evento llegaba como `esReintento` y desactivaba la
   * recuperación de sesión. Un envoltorio sin parámetros lo hace imposible.
   */
  const reload = useCallback(() => load(), [load]);
  return { data, loading, error, reload };
}
