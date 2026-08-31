import { redirect } from 'next/navigation';
import { urls, diaISO, hoyISO, diasHasta, providerBadge, tarjetaLabel, etiquetaPlan, etiquetaOdonto, selloCarnet, pagoEnHistorial, distanciaKm, origenDelSocio, textoDistancia, etiquetaCentro, type NotifInput, type VaccineKind, type Review, type Punto, type OrigenDistancia, type EstadoPago, type MedioPago } from '@kumo/shared';
import { createClient } from '@/lib/supabase-server';
import AppClient, { type PlanVM, type Profile, type Pet, type SelloVM, type Vac, type Reint, type EmergencyContact, type ProviderVM, type BenefitVM, type ForumPost, type MiNegocio, type CuotaVM, type PagoVM } from './AppClient';

/** Landing: ahí está el login si no hay sesión. */
const LANDING = urls.landing;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDate(iso: string | null): string {
  if (!iso) return 'a definir';
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
/** Ojo: esto corre en el servidor (Vercel, en UTC), así que el "hoy" tiene que
 *  venir del calendario argentino y no del reloj de la máquina. */
function daysUntil(iso: string | null): number | null {
  return iso ? diasHasta(iso) : null;
}

type VaccinationRow = { id: string; name: string; kind: VaccineKind; status: string; applied_on: string | null; due_on: string | null };
function mapVac(v: VaccinationRow): Vac {
  const base = { id: v.id, name: v.name, kind: v.kind ?? 'Vacuna', appliedOn: v.applied_on, dueOn: v.due_on };
  if (v.status === 'aplicada') {
    return { ...base, sub: `Aplicada ${fmtDate(v.applied_on)}`, status: 'Al día ✓', tone: 'green' };
  }
  const days = daysUntil(v.due_on);
  const near = days !== null && days <= 3;
  return {
    ...base,
    sub: `Próxima: ${fmtDate(v.due_on)}`,
    status: days === null ? 'Pendiente' : days < 0 ? 'Vencida' : `En ${days} día${days === 1 ? '' : 's'}`,
    tone: near ? 'lime' : 'amber',
    reminder: near ? '⏰ Recordatorio: aplicala pronto' : undefined,
    mark: true,
  };
}

/** En la base las fotos se guardan como nombre de archivo (seed) o URL de Storage. */
function imgSrc(photoUrl: string | null, fallback = 'default-pet.webp'): string {
  const v = photoUrl ?? fallback;
  return v.startsWith('http') ? v : `/img/${v}`;
}

type PetRow = { id: string; name: string; breed: string | null; age_years: number | null; weight_kg: number | null; microchip: string | null; neutered: boolean; photo_url: string | null; vaccinations: VaccinationRow[] };
/** `socio` viene armado y no como número: un perfil que no es de socio no tiene
 *  número, y "#null" en el carnet es peor que un guion. */
/** `plan`, `odonto` y `sello` llegan armados: son del SOCIO y los decide la cuota,
 *  no la mascota. `odonto` estaba escrito fijo en "No activo" para todos. */
function mapPet(row: PetRow, socio: string, plan: string, odonto: string, sello: SelloVM): Pet {
  return {
    id: row.id,
    name: row.name,
    plan,
    socio,
    photo: imgSrc(row.photo_url),
    breed: [row.breed ?? 'Mestizo', row.age_years != null ? `${row.age_years} años` : null, row.weight_kg != null ? `${row.weight_kg} kg` : null].filter(Boolean).join(' · '),
    microchip: row.microchip ?? 'Sin chip',
    castrado: row.neutered ? 'Sí' : 'No',
    odonto,
    sello,
    vaccines: (row.vaccinations ?? []).map(mapVac),
  };
}

function relTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hs = Math.round(mins / 60);
  if (hs < 24) return `hace ${hs}h`;
  const days = Math.round(hs / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

/* Las distancias ya no se miden desde el Obelisco: el origen es el domicilio del
   socio, geocodificado en el alta (`profiles.lat/lng`). La cuenta y el texto de
   "desde dónde" viven en `@kumo/shared` (cerca.ts), compartidos con la app. */

type ProviderRow = { id: string; name: string; category: string; zone: string; address: string | null; phone: string | null; instagram: string | null; website: string | null; about: string; rating: number; reviews: number; price: number | null; price_unit: string | null; photo_url: string | null; logo_url: string | null; lat: number | null; lng: number | null; status: string };
function mapProvider(row: ProviderRow, desde: Punto & { origen: OrigenDistancia }): ProviderVM {
  // Sin coordenadas no hay distancia. Antes se le ponía 5 km, que es la clase de
  // dato inventado que después se lee como cierto: quedaba en el radio de todos y
  // ordenado como si estuviera cerca. Null es "no sabemos", y la pantalla lo omite.
  const km = row.lat != null && row.lng != null ? distanciaKm(desde, { lat: row.lat, lng: row.lng }) : null;
  return {
    id: row.id, name: row.name, category: row.category, zone: row.zone, address: row.address ?? '', phone: row.phone ?? '',
    instagram: row.instagram, website: row.website, about: row.about, rating: row.rating, reviews: row.reviews,
    /* Sin foto queda en null y NO se le pone una de archivo: antes el prestador que
       no subía nada salía con `default-pet.webp`, así que su ficha mostraba un perro
       ajeno como si fuera su local. La pantalla dibuja el ícono del rubro. */
    price: row.price ?? 0, priceUnit: row.price_unit ?? '', photoUrl: row.photo_url ? imgSrc(row.photo_url) : null,
    /* El logo es cuadrado y la portada es una banda: el avatar y el cuadradito del
       listado usan el logo, y si no hay, caen en la portada. */
    logoUrl: row.logo_url ? imgSrc(row.logo_url) : null, km,
    // De dónde se está midiendo, para que el chip no diga "de tu casa" cuando el
    // origen es el centro de CABA porque no sabemos dónde vive.
    kmDesde: textoDistancia(desde.origen),
    lat: row.lat, lng: row.lng,
    // El sello sale del estado que puso el admin, no del rating.
    verificado: row.status === 'verificado',
    badge: providerBadge(row.status, row.rating, row.reviews),
  };
}

function benefitIcon(category: string): BenefitVM['icon'] {
  const c = category.toLowerCase();
  if (/baño|estétic/.test(c)) return 'droplet';
  if (/aliment|accesorio|juguete/.test(c)) return 'store';
  if (/consulta|cirug/.test(c)) return 'cross';
  return 'tag';
}
type BenefitRow = { id: string; name: string; category: string; discount: string; description: string; zone: string; address: string | null; lat: number | null; lng: number | null; days: string[]; hours: string; valid_until: string | null; plan_requirement: string };
function mapBenefit(row: BenefitRow, desde: Punto & { origen: OrigenDistancia }): BenefitVM {
  return {
    id: row.id, name: row.name, category: row.category, discount: row.discount, icon: benefitIcon(row.category),
    description: row.description ?? '', zone: row.zone ?? '', days: row.days ?? [], hours: row.hours ?? '',
    validUntil: row.valid_until, planRequirement: row.plan_requirement,
    address: row.address,
    // Sin dirección cargada no hay distancia: el comercio se muestra con su zona.
    km: row.lat != null && row.lng != null ? distanciaKm(desde, { lat: row.lat, lng: row.lng }) : null,
    kmDesde: textoDistancia(desde.origen),
    lat: row.lat, lng: row.lng,
  };
}

type AnswerRow = { id: string; text: string; likes: number; best: boolean; created_at: string; author_name: string; author_id: string | null };
type PostRow = { id: string; category: string; title: string; body: string; photo_url: string | null; zone: string | null; replies: number; likes: number; created_at: string; author_name: string; author_id: string | null; community_answers: AnswerRow[] };
/** El nombre viene en la fila: el join a `profiles` devolvía null por la RLS y
 *  todos los autores salían como "Socio". */
function authorName(nombre: string | null): string {
  return nombre?.trim().split(' ')[0] || 'Socio';
}
function mapPost(row: PostRow, userId: string): ForumPost {
  return {
    id: row.id,
    cat: row.category,
    trend: row.likes >= 20,
    author: authorName(row.author_name),
    meta: `${row.zone ?? 'General'} · ${relTime(row.created_at)}`,
    title: row.title,
    body: row.body,
    photo: row.photo_url,
    replies: row.replies,
    likes: row.likes,
    propia: row.author_id === userId,
    answers: (row.community_answers ?? [])
      .slice()
      .sort((a, b) => (b.best ? 1 : 0) - (a.best ? 1 : 0) || Date.parse(a.created_at) - Date.parse(b.created_at))
      .map((a) => ({ id: a.id, author: authorName(a.author_name), when: relTime(a.created_at), text: a.text, likes: a.likes, best: a.best, propia: a.author_id === userId })),
  };
}

const REINT_STATUS: Record<string, Reint['status']> = { en_revision: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado', acreditado: 'Acreditado' };
type ReintRow = {
  id: string; provider_name: string; concept: string; amount: number; refund: number; refund_pct: number;
  status: string; requested_on: string; resolved_at: string | null; created_at: string; receipt_no: string | null; receipt_path: string | null;
  bank_holder: string | null; bank_holder_dni: string | null; bank_cuit: string | null;
  bank_name: string | null; bank_cbu: string | null; bank_alias: string | null;
  pets: { name: string } | { name: string }[] | null;
};
function mapReint(row: ReintRow): Reint {
  const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
  return {
    id: row.id,
    place: row.provider_name,
    concept: row.concept,
    detail: `${row.concept} · ${fmtDate(row.requested_on)}`,
    fecha: fmtDate(row.requested_on),
    spent: row.amount,
    refund: row.refund,
    refundPct: row.refund_pct,
    status: REINT_STATUS[row.status] ?? 'En revisión',
    statusRaw: row.status,
    requestedOn: row.requested_on,
    resueltoEl: row.resolved_at ? fmtDate(diaISO(row.resolved_at)) : '',
    pet: pet?.name ?? '—',
    receiptNo: row.receipt_no,
    receiptPath: row.receipt_path,
    bank: {
      holder: row.bank_holder, dni: row.bank_holder_dni, cuit: row.bank_cuit,
      name: row.bank_name, cbu: row.bank_cbu, alias: row.bank_alias,
    },
  };
}

export default async function Page() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(LANDING);

  /*
   * Todo junto, no una atrás de la otra.
   *
   * Ninguna de estas consultas depende del RESULTADO de otra —solo los mapeos de
   * más abajo—, y hasta acá se hacían en fila: once viajes de ida y vuelta a
   * Supabase, que además está en otra región. Cada `router.refresh()` (o sea, cada
   * vez que el socio toca un botón que escribe algo) pagaba los once de nuevo, y
   * eso es lo que se sentía como "tarda un montón". En paralelo, la pantalla tarda
   * lo que la consulta más lenta.
   */
  const [
    { data: profileRow },
    { data: petsRows },
    { data: reintRows },
    { data: contactRows },
    { data: providerRows },
    { data: reviewRows },
    { data: negocioRows },
    { data: benefitRows },
    { data: postRows },
    { data: postLikeRows },
    { data: ansLikeRows },
    { data: favRows },
    { data: planRows },
    { data: pagoRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('member_no, full_name, email, phone, address, city, province, lat, lng, geo_origen, dni, status, paid_until, mp_subscription_status, addon_odonto, monthly_fee_agreed, bank_holder, bank_holder_dni, bank_cuit, bank_name, bank_cbu, bank_alias, card_brand, card_last4, plans(name, base_price)')
      .eq('id', auth.user.id)
      .single(),
    supabase
      .from('pets')
      .select('id, name, breed, age_years, weight_kg, microchip, neutered, photo_url, vaccinations(id, name, kind, status, applied_on, due_on)')
      .eq('owner_id', auth.user.id),
    supabase
      .from('reimbursements')
      .select('id, provider_name, concept, amount, refund, refund_pct, status, requested_on, resolved_at, created_at, receipt_no, receipt_path, bank_holder, bank_holder_dni, bank_cuit, bank_name, bank_cbu, bank_alias, pets(name)')
      .eq('member_id', auth.user.id)
      .order('requested_on', { ascending: false }),
    supabase
      .from('emergency_contacts')
      .select('id, name, phone, type, address, hours')
      .eq('owner_id', auth.user.id),
    supabase
      .from('providers')
      .select('id, name, category, zone, address, phone, instagram, website, about, rating, reviews, price, price_unit, photo_url, logo_url, lat, lng, status')
      .eq('status', 'verificado'),
    // Reseñas de los prestadores publicados, más nuevas primero.
    supabase
      .from('provider_reviews')
      .select('id, provider_id, member_id, rating, text, author_name, created_at')
      .order('created_at', { ascending: false }),
    /* Los negocios propios del socio. Van aparte de `providers` porque ese listado
       solo trae los verificados y acá interesan aunque estén pendientes o rechazados.

       Son VARIOS: un socio puede tener un servicio y un comercio. Antes esto era un
       `maybeSingle()`, que con dos filas del mismo dueño no devuelve una: devuelve
       error, así que la pantalla Mi negocio se rompía en vez de mostrar de menos. */
    supabase
      .from('providers')
      .select('id, name, category, zone, address, phone, about, status, rating, reviews, created_at, price, price_unit, instagram, website, photo_url, logo_url')
      .eq('owner_id', auth.user.id)
      .order('created_at', { ascending: true }),
    supabase.from('benefits').select('id, name, category, discount, description, zone, address, lat, lng, days, hours, valid_until, plan_requirement').eq('status', 'activo'),
    supabase
      .from('community_posts')
      .select('id, category, title, body, photo_url, zone, replies, likes, created_at, author_name, author_id, community_answers(id, text, likes, best, created_at, author_name, author_id)')
      .order('created_at', { ascending: false }),
    // Qué likeó el socio, para pintar el corazón lleno y no dejarlo likear dos veces.
    supabase.from('post_likes').select('post_id').eq('member_id', auth.user.id),
    supabase.from('answer_likes').select('answer_id').eq('member_id', auth.user.id),
    supabase.from('provider_favorites').select('provider_id').eq('member_id', auth.user.id),
    supabase.from('plans').select('id, name, base_price, tagline').order('base_price'),
    // Los últimos pagos del socio, para que el muro de la cuota sepa si hay uno
    // en curso en vez de tratarlo como si nunca hubiera intentado.
    /* Los cobros del socio. Se piden completos porque además de detectar el pago en
       curso son su historial de cuotas: la política de RLS ya decía "el socio ve su
       historial" y hasta ahora ninguna pantalla lo mostraba. Doce meses alcanzan para
       cualquier reclamo y no obligan a paginar. */
    supabase.from('payments')
      .select('id, amount, status, method, plan_name, covers_until, detail, created_at, paid_at')
      .eq('member_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(24),
  ]);
  if (!profileRow) redirect(LANDING);

  /*
   * El acceso se corta acá, en el servidor.
   *
   * Es el único punto por el que pasa toda la webapp del socio, así que no hay
   * pantalla que se pueda ver salteándolo. Un socio suspendido por el club o dado
   * de baja tiene sesión válida —el token sigue siendo suyo— pero no cuenta:
   * vuelve a la portada con el motivo.
   *
   * La base también lo corta, no solo la pantalla: las políticas de RLS pasan por
   * `tiene_acceso()`, así que el token de un suspendido tampoco puede leer sus
   * mascotas ni cargar un reintegro por la API (ver la migración
   * `20260814050000_acceso_en_rls.sql`).
   */
  if (profileRow.status === 'suspendido') redirect(`${LANDING}?cuenta=suspendida`);
  if (profileRow.status === 'baja') redirect(`${LANDING}?cuenta=baja`);

  /*
   * La cuota. Distinto del estado: acá el socio está bien con el club, lo que le
   * falta es pagar el mes.
   *
   * Es una fecha y no un "al día": un booleano hay que apagarlo con un cron todas
   * las noches y mientras no corre, miente. La fecha se compara con hoy.
   *
   * No es un `redirect`: el socio se queda en la app con el muro encima, porque
   * tiene que poder pagar desde acá. Lo que hay atrás no se ve.
   */
  const plan = Array.isArray(profileRow.plans) ? profileRow.plans[0] : profileRow.plans;
  /*
   * La fecha paga sigue siendo la única que decide, y NO la suscripción
   * autorizada: si un débito rebota, MP reintenta y la suscripción se queda en
   * `authorized` mientras lo hace. Dejar entrar por estar autorizado le daría
   * acceso indefinido a alguien que nunca pagó.
   */
  const cuota: CuotaVM = {
    debePagar: !profileRow.paid_until || profileRow.paid_until < hoyISO(),
    hasta: profileRow.paid_until ?? null,
    monto: profileRow.monthly_fee_agreed ?? plan?.base_price ?? 0,
    planName: plan?.name ?? '—',
    odonto: profileRow.addon_odonto === true,
    // Si dejó un pago abierto (una transferencia o un Rapipago tardan, o cerró el
    // checkout a mitad de camino), el muro lo cuenta en lugar de mostrarle un
    // botón que parece no haber hecho nada.
    suscripcion: (profileRow.mp_subscription_status ?? null) as CuotaVM['suscripcion'],
    /*
     * "Está en curso" incluye la suscripción ya autorizada, y esa parte importa:
     * autorizar el débito NO es que el mes ya esté acreditado. Medido el 19/08 con
     * una suscripción real: autorizó 13:16:34, MP debitó 13:16:52, y el aviso lo
     * acreditó 13:18:33 — dos minutos de punta a punta. Sin esto el socio volvía
     * del checkout y veía el muro igual que antes, como si no hubiera hecho nada
     * — y volvía a pagar.
     */
    enCurso: profileRow.mp_subscription_status === 'authorized'
      || (pagoRows ?? []).some((p) => p.status === 'pendiente' && p.method === 'mercadopago'),
  };

  const profile: Profile = {
    id: auth.user.id,
    firstName: profileRow.full_name.split(' ')[0] ?? profileRow.full_name,
    fullName: profileRow.full_name,
    memberNo: profileRow.member_no,
    planName: plan?.name ?? '—',
    // La cuota que aceptó al firmar, no el precio de lista: con la cobertura
    // odontológica paga $12.000 más y antes acá se mostraba de menos.
    planPrice: profileRow.monthly_fee_agreed ?? plan?.base_price ?? 0,
    addonOdonto: profileRow.addon_odonto ?? false,
    email: profileRow.email,
    phone: profileRow.phone,
    address: profileRow.address,
    city: profileRow.city,
    province: profileRow.province,
    dni: profileRow.dni,
    banco: {
      holder: profileRow.bank_holder,
      holderDni: profileRow.bank_holder_dni,
      cuit: profileRow.bank_cuit,
      banco: profileRow.bank_name,
      cbu: profileRow.bank_cbu,
      alias: profileRow.bank_alias,
    },
    tarjeta: tarjetaLabel(profileRow.card_brand, profileRow.card_last4),
  };

  /*
   * El carnet dice sólo lo que la cuota sostiene.
   *
   * La cobertura odontológica sigue la misma regla que los reintegros y los
   * beneficios: la habilita la cuota paga, no haberla contratado alguna vez. Y el
   * plan pasa por `etiquetaPlan` porque el gratuito tiene `planName` '—' y el carnet
   * mostraba "Plan —".
   */
  /** Recién se dio de alta y el primer cobro está en camino: ver `estadoCuota`. */
  const activando = cuota.suscripcion === 'authorized' && !cuota.hasta;
  const pets: Pet[] = (petsRows ?? []).map((r) => mapPet(
    r as PetRow,
    profile.memberNo ? `#${profile.memberNo}` : '—',
    etiquetaPlan(cuota.planName, cuota.debePagar, activando),
    etiquetaOdonto(cuota.odonto, cuota.debePagar),
    selloCarnet({ debePagar: cuota.debePagar, tienePlan: cuota.planName !== '—', cuotaHasta: cuota.hasta, suscripcion: cuota.suscripcion }),
  ));
  /*
   * El historial de cuotas.
   *
   * `paid_at` cuando existe y `created_at` si no: la fecha que le importa al socio es
   * la del cobro, no la del registro. Y los pendientes viejos se caen (ver
   * `pagoEnHistorial`): un checkout abandonado no es un pago, y listarlo parece deuda.
   */
  const pagos: PagoVM[] = (pagoRows ?? [])
    .filter((p) => pagoEnHistorial(p.status as EstadoPago, p.created_at))
    .map((p) => ({
      id: p.id,
      fecha: fmtDate(diaISO(p.paid_at ?? p.created_at)),
      monto: p.amount,
      plan: p.plan_name,
      estado: p.status as EstadoPago,
      medio: p.method as MedioPago,
      cubreHasta: p.covers_until ? fmtDate(p.covers_until) : null,
      /* El detalle solo cuando lo escribió una persona.
         El de Mercado Pago es texto de máquina y trae el id de la suscripción
         adentro ("débito automático de la suscripción e796bd03..."): no le explica
         nada al socio y le manda al navegador un identificador interno del cobro.
         El del club sí es para él ("efectivo en la veterinaria"). */
      detalle: p.method === 'manual' ? p.detail : null,
    }));

  const reintegros: Reint[] = (reintRows ?? []).map((r) => mapReint(r as ReintRow));
  const contacts: EmergencyContact[] = (contactRows ?? []).map((c) => ({ ...c, address: c.address ?? '', hours: c.hours ?? '' }));
  /*
   * Desde dónde ve el mundo este socio: su domicilio geocodificado en el alta. Si no
   * lo tenemos, el centro de CABA — y en ese caso la pantalla lo dice, en vez de
   * llamarle "tu casa" al Obelisco.
   */
  const desde = origenDelSocio({ lat: profileRow.lat, lng: profileRow.lng, geoOrigen: profileRow.geo_origen });
  const providers: ProviderVM[] = (providerRows ?? []).map((r) => mapProvider(r as ProviderRow, desde));

  const reviews: Record<string, Review[]> = {};
  for (const r of reviewRows ?? []) {
    (reviews[r.provider_id] ??= []).push({
      id: r.id, author: r.author_name, rating: r.rating, text: r.text,
      createdAt: r.created_at, propia: r.member_id === auth.user.id,
    });
  }

  const negocios: MiNegocio[] = (negocioRows ?? []).map((n) => ({
    id: n.id, name: n.name, category: n.category, zone: n.zone,
    address: n.address,
    phone: n.phone, about: n.about, status: n.status,
    rating: n.rating, reviews: n.reviews,
    price: n.price, priceUnit: n.price_unit, instagram: n.instagram, website: n.website,
    // Por `imgSrc` y no crudo: las fotos del seed se guardan como nombre de
    // archivo, y en un url() de CSS un nombre suelto no resuelve a nada.
    photoUrl: n.photo_url ? imgSrc(n.photo_url) : null,
    logoUrl: n.logo_url ? imgSrc(n.logo_url) : null,
  }));

  const benefits: BenefitVM[] = (benefitRows ?? []).map((r) => mapBenefit(r as BenefitRow, desde));
  const posts: ForumPost[] = (postRows ?? []).map((r) => mapPost(r as unknown as PostRow, auth.user.id));
  const misLikes = {
    posts: (postLikeRows ?? []).map((l) => l.post_id),
    answers: (ansLikeRows ?? []).map((l) => l.answer_id),
  };

  // Las notificaciones se derivan de estas mismas filas (no hay tabla propia).
  // Se manda la materia prima y no la lista armada: los textos de tiempo
  // ("Hace 2 h") se calculan en el cliente, donde se ven.
  const notifInput: NotifInput = {
    pets: (petsRows ?? []).map((p) => ({
      name: p.name,
      vaccines: ((p.vaccinations ?? []) as VaccinationRow[]).map((v) => ({ id: v.id, name: v.name, kind: v.kind, status: v.status, dueOn: v.due_on })),
    })),
    reintegros: ((reintRows ?? []) as ReintRow[]).map((r) => ({
      id: r.id, providerName: r.provider_name, refund: r.refund, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at,
    })),
    negocios: (negocioRows ?? []).map((n) => ({ id: n.id, name: n.name, status: n.status, createdAt: n.created_at })),
  };

  const guardados: string[] = (favRows ?? []).map((f) => f.provider_id);
  const planes: PlanVM[] = (planRows ?? []).map((p) => ({ id: p.id, name: p.name, price: p.base_price, tagline: p.tagline }));

  return <AppClient profile={profile} pets={pets} reintegros={reintegros} contacts={contacts} providers={providers} benefits={benefits} posts={posts} negocios={negocios} notifInput={notifInput} guardados={guardados} reviews={reviews} misLikes={misLikes} planes={planes} cuota={cuota} pagos={pagos} centro={{ lat: desde.lat, lng: desde.lng, etiqueta: etiquetaCentro(desde.origen) }} />;
}
