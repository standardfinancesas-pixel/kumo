import { useState, useEffect, useRef, createElement, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, AppState, PanResponder, ScrollView, StyleSheet, Text as RNText, View, TouchableOpacity, TextInput, Pressable, Image, ImageBackground, ImageSourcePropType, Platform, TextProps, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  colors, PROVINCIAS, RUBROS, type ProviderCategory, partirZona, avisoZonaLejos, PAGO_ESTADO, PAGO_MEDIO,
  buildNotifs, contarNoLeidas, notifTiempo, NOTIF_STYLE, type NotifGroup,
  buildCalMes, buildPickerMes, calMesLabel, calDiaLabel, fmtFechaCorta, hoyISO, CAL_TONE, CAL_DIAS, VACUNA_KINDS, KIND_ICON,
  ratingLabel, urlSitio, urlInstagram, urlTel, consultaMapa, precioTexto, reviewTiempo, reintPasos, pasoWhen, REINT_TONE, buildPetHistory, type PetEvento,
  HEALTH_Q, SANITARIO_Q, armarDeclaracion, cbuValido, MOTIVOS_REPORTE, SITIO, ODONTO_PRECIO,
  type CalCell, type VaccineKind, type Review,
  FEATURES_PAGAS, tieneFeaturesPagas, estadoCuota, copyCuota, INVITACION_PLAN, BANNER_PLAN, etiquetaPlan,
  FORO_CATEGORIAS, FORO_CATEGORIA_DEFECTO,
  type FeaturePaga,
} from '@kumo/shared';
import { supabase } from './lib/supabase';
import { useEsperarPago } from './lib/esperarPago';
import { resolverFuente } from './lib/tipografia';
import { elegirYSubirFoto } from './lib/subirFoto';
import { avisar } from './lib/avisos';
import { confirmarSuscripcion, recalcularUbicacion, ubicarNegocio } from './lib/api';
import { CampoDomicilio, CampoZona } from './components/ui/CampoDomicilio';
import { SelloCarnet } from './components/ui/SelloCarnet';
import { MapaLugares } from './components/MapaLugares';
import { Selector } from './components/ui/Controles';
import * as Notifications from 'expo-notifications';
import { registrarDispositivo, olvidarDispositivo, pushActivo, guardarPushActivo, alTocarNotificacion } from './lib/push';
import { useKumoData, type Pet, type Vac, type Profile, type PlanVM, type EmergencyContact, type ForumAnswer, type ProviderVM, type BenefitVM, type ReintVM, type ForumPost, type MiNegocio, type PagoVM } from './lib/useKumoData';
import Entrada from './components/Entrada';
import Alta from './components/alta/Alta';
import AltaListo from './components/alta/AltaListo';
import NuevaClave from './components/NuevaClave';
import { resolverURL } from './lib/deepLink';

/* Familias (Baloo 2 títulos, DM Sans cuerpo) — igual que la web. */
const FH = 'Baloo2_800ExtraBold';   // títulos
const FREG = 'DMSans_500Medium';    // cuerpo

/* Text base: DM Sans en toda la app; los estilos propios (incl. fontFamily de títulos) pisan el default. */
/** Todo el texto de la app pasa por acá, y por eso el grosor se resuelve acá: ver
 *  `resolverFuente` en lib/tipografia — en Android, pedir un grosor de una fuente
 *  propia hace que se caiga a la del sistema en algunos teléfonos. */
const Text = (props: TextProps) => createElement(RNText, { ...props, style: resolverFuente([{ fontFamily: FREG, color: colors.text }, props.style]) });

/*
 * App del socio Kumo — Expo / React Native.
 * Reproduce 1:1 la vista "App" (teléfono) del prototipo: navegación inferior
 * (Inicio · Carnet · Servicios · Beneficios · Más) + sus pantallas y sub-pantallas.
 * Comparte tokens con la web vía @kumo/shared y lee datos reales de Supabase
 * (lib/useKumoData). Íconos con react-native-svg, fotos bundleadas.
 */

const money = (n: number | null | undefined) => '$' + Number(n ?? 0).toLocaleString('es-AR');
const BRAND = colors.brand.primary;      // #5D5491
const LIME = colors.brand.lime;          // #E1FB62
const INK = colors.text;                 // #211E33
const MUTED = colors.textMuted;          // #5B5670

/* ── Mapa de imágenes bundleadas (require necesita literales estáticos) ── */
const IMG: Record<string, ImageSourcePropType> = {
  'happy-dog.webp': require('./assets/happy-dog.webp'),
  'plan-cat.webp': require('./assets/plan-cat.webp'),
  'benef.webp': require('./assets/benef.webp'),
  'serv.webp': require('./assets/serv.webp'),
  'dog-walk.webp': require('./assets/dog-walk.webp'),
  'dog-bath-happy.webp': require('./assets/dog-bath-happy.webp'),
  'cat-guarderia.webp': require('./assets/cat-guarderia.webp'),
  'plan-dalmata-cut.webp': require('./assets/plan-dalmata-cut.webp'),
  'woman-cat.webp': require('./assets/woman-cat.webp'),
  'prestador-walker.webp': require('./assets/prestador-walker.webp'),
  'guarderia-refugio.webp': require('./assets/guarderia-refugio.webp'),
  'prestador-bath.webp': require('./assets/prestador-bath.webp'),
  'prestador-trainer.webp': require('./assets/prestador-trainer.webp'),
  'prestador-caregiver.webp': require('./assets/prestador-caregiver.webp'),
};

/* ── Promos rotativas del home (5 variantes, igual al prototipo) ── */
const PROMOS = [
  { title: 'Buscá tu paseador', sub: 'Cerca tuyo, verificados', bg: '#5D5491', fg: '#fff', subFg: '#d8d3ec', photo: 'dog-walk.webp' },
  { title: 'Baño y peluquería', sub: 'A domicilio, con descuento', bg: '#E1FB62', fg: '#211E33', subFg: '#3d3a52', photo: 'dog-bath-happy.webp' },
  { title: 'Guardería para el finde', sub: 'Lugares de confianza', bg: '#ECE7F7', fg: '#211E33', subFg: '#6b6485', photo: 'cat-guarderia.webp' },
  { title: 'Adiestrá con expertos', sub: 'Clases y resultados', bg: '#E1FB62', fg: '#211E33', subFg: '#3d3a52', photo: 'plan-dalmata-cut.webp' },
  { title: 'Encontrá un cuidador', sub: 'Alguien de confianza', bg: '#5D5491', fg: '#fff', subFg: '#d8d3ec', photo: 'woman-cat.webp' },
];

type Screen = 'inicio' | 'carnet' | 'servicios' | 'beneficios' | 'reintegros' | 'foros' | 'perfil' | 'mismascotas' | 'guardados' | 'minegocio' | 'notif' | 'prestar';
type Tab = 'inicio' | 'carnet' | 'servicios' | 'beneficios' | 'foros';
const openWa = (phone: string) => Linking.openURL('https://wa.me/' + (phone || '').replace(/\D/g, ''));

/**
 * Abrir un lugar en la aplicación de mapas del teléfono.
 *
 * Se usa el esquema del sistema y no un link a Google Maps: así se abre la app que la
 * persona ya usa —Google Maps, Apple Maps, Organic Maps, la que sea— en vez de
 * imponerle una. iOS y Android tienen esquemas distintos y ninguno acepta el del otro.
 */
const abrirMapa = (consulta: string) => {
  const q = encodeURIComponent(consulta);
  Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${q}` : `geo:0,0?q=${q}`);
};
/** Del ícono genérico que devuelve `KIND_ICON` al nombre que entiende `Ic`. */
const VAC_IC = { shield: 'shield', pill: 'pill', plus: 'hospital' } as const;
/** WhatsApp del club, para el muro de la cuota. Pendiente: sacarlo de
 *  `club_settings`, que es donde el panel lo edita — igual que en la webapp. */
const WA_CLUB = '5491125168802';

/* ── Iconos (react-native-svg) ─────────────────────────────────── */
type IconName = 'paw' | 'house' | 'idcard' | 'chat' | 'wallet' | 'tag' | 'menu' | 'bell' | 'shield' | 'search' | 'calendar' | 'store' | 'person' | 'heart' | 'hospital' | 'pill' | 'droplet' | 'pin' | 'globe' | 'instagram' | 'phone' | 'image';
function Ic({ d, size = 22, color = BRAND, fill = false }: { d: IconName; size?: number; color?: string; fill?: boolean }) {
  const stroke = fill ? 'none' : color;
  const fillC = fill ? color : 'none';
  const common = { stroke, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fillC}>
      {d === 'paw' && <>
        <Circle cx="5.5" cy="10" r="1.7" fill={color} />
        <Circle cx="9.7" cy="6.4" r="1.8" fill={color} />
        <Circle cx="14.3" cy="6.4" r="1.8" fill={color} />
        <Circle cx="18.5" cy="10" r="1.7" fill={color} />
        <Path d="M8 14.2c-1.3 1-1.9 2.4-1.5 3.8.3 1.3 1.5 2 2.9 1.7 1-.2 1.6-.6 2.6-.6s1.6.4 2.6.6c1.4.3 2.6-.4 2.9-1.7.4-1.4-.2-2.8-1.5-3.8-1.1-.9-2.1-1.5-4-1.5s-2.9.6-4 1.5z" fill={color} />
      </>}
      {d === 'house' && <><Path d="M3 10.5 12 3l9 7.5" {...common} /><Path d="M5 9.5V20h14V9.5" {...common} /></>}
      {d === 'idcard' && <><Rect x="3" y="4" width="18" height="16" rx="2" {...common} /><Circle cx="9" cy="10" r="2.1" {...common} /><Path d="M6.2 16c.5-1.5 1.9-2.4 3.3-2.4s2.8.9 3.3 2.4" {...common} /><Line x1="14" y1="9" x2="17.5" y2="9" {...common} /><Line x1="14" y1="13" x2="16.5" y2="13" {...common} /></>}
      {d === 'chat' && <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...common} />}
      {d === 'wallet' && <><Path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2" {...common} /><Rect x="2" y="7" width="20" height="12" rx="2" {...common} /><Path d="M22 11h-4a2 2 0 0 0 0 4h4" {...common} /></>}
      {d === 'tag' && <><Path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" {...common} /><Circle cx="7.5" cy="7.5" r="1.2" {...common} /></>}
      {d === 'menu' && <><Line x1="4" y1="7" x2="20" y2="7" {...common} /><Line x1="4" y1="12" x2="20" y2="12" {...common} /><Line x1="4" y1="17" x2="20" y2="17" {...common} /></>}
      {d === 'bell' && <><Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" {...common} /><Path d="M13.7 21a2 2 0 0 1-3.4 0" {...common} /></>}
      {d === 'shield' && <Path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" {...common} />}
      {d === 'search' && <><Circle cx="11" cy="11" r="7" {...common} /><Line x1="21" y1="21" x2="16.5" y2="16.5" {...common} /></>}
      {d === 'calendar' && <><Rect x="3" y="4" width="18" height="18" rx="2" {...common} /><Line x1="16" y1="2" x2="16" y2="6" {...common} /><Line x1="8" y1="2" x2="8" y2="6" {...common} /><Line x1="3" y1="10" x2="21" y2="10" {...common} /></>}
      {d === 'store' && <><Path d="M3 9l1-5h16l1 5" {...common} /><Path d="M4 9v11h16V9" {...common} /><Path d="M9 20v-6h6v6" {...common} /></>}
      {d === 'person' && <><Circle cx="12" cy="8" r="3.4" {...common} /><Path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" {...common} /></>}
      {d === 'heart' && <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill={fill ? color : 'none'} stroke={fill ? 'none' : color} strokeWidth={1.9} strokeLinejoin="round" />}
      {d === 'hospital' && <><Rect x="4" y="4" width="16" height="16" rx="3" {...common} /><Line x1="12" y1="8" x2="12" y2="16" {...common} /><Line x1="8" y1="12" x2="16" y2="12" {...common} /></>}
      {d === 'pill' && <><Rect x="3" y="8" width="18" height="8" rx="4" {...common} /><Line x1="12" y1="8" x2="12" y2="16" {...common} /></>}
      {d === 'image' && <><Rect x="3" y="3" width="18" height="18" rx="2" {...common} /><Circle cx="8.5" cy="8.5" r="1.5" {...common} /><Path d="M21 15l-5-5L5 21" {...common} /></>}
      {d === 'droplet' && <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" {...common} />}
      {d === 'pin' && <><Path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z" {...common} /><Circle cx="12" cy="10" r="2.5" {...common} /></>}
      {d === 'globe' && <><Circle cx="12" cy="12" r="10" {...common} /><Path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" {...common} /></>}
      {d === 'instagram' && <><Rect x="2" y="2" width="20" height="20" rx="5.5" {...common} /><Circle cx="12" cy="12" r="4" {...common} /><Circle cx="17.5" cy="6.5" r="1.2" fill={color} /></>}
      {d === 'phone' && <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2z" {...common} />}
    </Svg>
  );
}

const TONE: Record<'green' | 'lime' | 'amber', { bg: string; fg: string }> = {
  green: { bg: colors.success.bg, fg: colors.success.fg },
  lime: { bg: '#dff0a8', fg: '#6f9a1f' },
  amber: { bg: '#fbf3e2', fg: '#b8860b' },
};

/** "3 años" o "18,5 kg" → número, para los campos que la base guarda numéricos. */
const numero = (s: string): number | null => {
  const m = /(\d+([.,]\d+)?)/.exec(s ?? '');
  return m?.[1] ? Number(m[1].replace(',', '.')) : null;
};

/* La foto puede venir del bundle (seed) o de Storage (subida por el socio). */
const petImg = (photo: string): ImageSourcePropType =>
  IMG[photo] ?? (photo.startsWith('http') ? { uri: photo } : IMG['happy-dog.webp']!);

/**
 * El cuadro de la foto de un prestador, gemelo del de la web.
 *
 * Cuando no hay foto NO se pone una de archivo. Antes el que no subía nada salía
 * con `prestador-walker.webp`: su ficha mostraba el local de otro como si fuera el
 * suyo, y desde adentro parecía que Kumo le había guardado una foto que él nunca
 * eligió. En su lugar va el ícono de su rubro sobre violeta, que se lee por lo que
 * es: todavía no subió foto.
 */
function FotoPrestador({ p, lado, radio, extra }: { p: ProviderVM; lado: number; radio: number; extra?: object }) {
  const caja = { width: lado, height: lado, borderRadius: radio, backgroundColor: colors.violet[100], ...extra };
  /* El logo primero: es la imagen pensada para un cuadrado. La portada es el
     respaldo —un recorte del medio, que es mejor que nada— y el ícono del rubro es el
     último, para el que no subió ninguna. */
  const cuadrada = p.logo ?? p.photo;
  if (cuadrada) return <Image source={petImg(cuadrada)} style={caja} />;
  return (
    <View style={{ ...caja, alignItems: 'center', justifyContent: 'center' }}>
      <Ic d={RUBRO_IC[p.category] ?? 'paw'} size={Math.round(lado * 0.46)} fill={p.category === 'Paseador'} />
    </View>
  );
}

/* ── Componentes chicos ────────────────────────────────────────── */
function PetChips({ pets, idx, setIdx }: { pets: Pet[]; idx: number; setIdx: (i: number) => void }) {
  if (pets.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
      {pets.map((p, i) => (
        <TouchableOpacity key={p.id} onPress={() => setIdx(i)} style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 100, backgroundColor: i === idx ? LIME : colors.violet[100] }}>
          <Text style={{ fontWeight: '700', fontSize: 13, color: i === idx ? INK : MUTED }}>{p.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function PetCard({ pet, detailed }: { pet: Pet; detailed?: boolean }) {
  return (
    <View style={{ backgroundColor: BRAND, borderRadius: 24, padding: 20, marginBottom: 18, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: -14, top: -14, opacity: 0.12 }}>
        <Ic d="paw" size={104} color="#fff" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Image source={petImg(pet.photo)} style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontFamily: FH, fontSize: 19 }}>{pet.name}</Text>
          <Text style={{ color: colors.violet[300], fontSize: 12 }}>{detailed ? pet.breed : `${pet.plan} · Socio ${pet.socio}`}</Text>
        </View>
        {/* El sello sale de la cuota (`selloCarnet`), no está escrito acá: decía
            ACTIVO fijo, así que un socio gratuito veía ACTIVO en la app y GRATUITO
            en la webapp. */}
        <SelloCarnet sello={pet.sello} />
      </View>
      {detailed && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {[['Microchip', pet.microchip], ['Castrado', pet.castrado], ['Odontológico', pet.odonto]].map(([k, v]) => (
            <View key={k} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 9 }}>
              <Text style={{ fontSize: 10, color: colors.violet[300] }}>{k}</Text>
              <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>{v}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
function EmptyPets({ go }: { go: (t: Screen) => void }) {
  return (
    <TouchableOpacity onPress={() => go('mismascotas')} style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 20, padding: 22, marginBottom: 18, alignItems: 'center' }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Ic d="paw" size={26} color={BRAND} fill />
      </View>
      <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 17, color: INK }}>Todavía no cargaste mascotas</Text>
      <Text style={{ fontSize: 13, color: MUTED, textAlign: 'center', marginTop: 6 }}>Agregá a tu peludo para tener su carnet digital siempre a mano.</Text>
    </TouchableOpacity>
  );
}
const H1 = ({ children }: { children: ReactNode }) => <Text style={{ fontSize: 26, fontWeight: '800', fontFamily: FH, color: INK, marginBottom: 4 }}>{children}</Text>;
const Sub = ({ children }: { children: ReactNode }) => <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>{children}</Text>;
const BackLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} style={{ marginBottom: 6 }}><Text style={{ color: BRAND, fontSize: 13, fontWeight: '600' }}>← {label}</Text></TouchableOpacity>
);

/* ── Pantalla: Inicio ──────────────────────────────────────────── */
/**
 * El banner de Inicio que cuenta qué suma un plan. Mismo texto que la web
 * (`BANNER_PLAN` de shared): es una oferta, y una oferta que cambia de una pantalla a
 * la otra hace dudar del precio.
 *
 * Solo lo ve quien no está pagando, y no bloquea nada.
 */
function BannerPlan({ desde, onPlan }: { desde: number; onPlan: () => void }) {
  return (
    <View style={{ backgroundColor: BRAND, borderRadius: 18, padding: 18, marginBottom: 22 }}>
      <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 18, color: '#fff', marginBottom: 10, lineHeight: 23 }}>{BANNER_PLAN.titulo}</Text>
      <View style={{ gap: 7, marginBottom: 14 }}>
        {BANNER_PLAN.puntos.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={LIME} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2 }}>
              <Path d="M4 12l5 5L20 6" />
            </Svg>
            <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.92)' }}>{p}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        onPress={onPlan}
        activeOpacity={0.85}
        style={{ backgroundColor: LIME, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
      >
        <Text style={{ color: INK, fontWeight: '700', fontSize: 15 }}>{BANNER_PLAN.cta} →</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 10, textAlign: 'center' }}>
        Desde ${desde.toLocaleString('es-AR')}/mes. {BANNER_PLAN.pie}
      </Text>
    </View>
  );
}

function Inicio({ pets, petIdx, setPetIdx, go, pago, desdePlan, onPlan }: { pets: Pet[]; petIdx: number; setPetIdx: (i: number) => void; go: (t: Screen) => void; pago: boolean; desdePlan: number; onPlan: () => void }) {
  const pet = pets[petIdx];
  const [promoIdx, setPromoIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPromoIdx((i) => (i + 1) % PROMOS.length), 4000);
    return () => clearInterval(t);
  }, []);
  const promo = PROMOS[promoIdx] ?? PROMOS[0]!;
  // El atajo al reintegro solo existe si puede pedirlo: un botón que lleva a una
  // pantalla que no está es peor que no tener el botón.
  const quick: { label: string; icon: IconName; fill?: boolean; to: Screen }[] = [
    { label: 'Carnet', icon: 'idcard', to: 'carnet' }, { label: 'Foros', icon: 'chat', to: 'foros' },
    ...(pago ? [{ label: 'Reintegro', icon: 'wallet' as IconName, to: 'reintegros' as Screen }] : []),
    { label: 'Servicios', icon: 'paw', fill: true, to: 'servicios' },
  ];
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {/* El saludo y las notificaciones ahora viven en el header fijo del shell. */}
      <PetChips pets={pets} idx={petIdx} setIdx={setPetIdx} />
      {pet ? <PetCard pet={pet} /> : <EmptyPets go={go} />}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {quick.map((q) => (
          <TouchableOpacity key={q.label} onPress={() => go(q.to)} style={{ flex: 1, backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 6 }}>
            <Ic d={q.icon} size={22} fill={q.fill} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: MUTED }}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Qué suma un plan. Solo para el que no paga: al que ya paga, ofrecerle lo que
          tiene solo le enseña a ignorar los banners. */}
      {!pago && desdePlan > 0 ? <BannerPlan desde={desdePlan} onPlan={onPlan} /> : null}

      {/* Banner de promo rotativo (color + foto según variante) */}
      <TouchableOpacity onPress={() => go('servicios')} style={{ backgroundColor: promo.bg, borderRadius: 18, marginBottom: 22, overflow: 'hidden', minHeight: 78, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingVertical: 16, paddingLeft: 18, paddingRight: 8 }}>
          <Text style={{ fontWeight: '800', fontFamily: FH, fontSize: 17, color: promo.fg }}>{promo.title}</Text>
          <Text style={{ fontSize: 12.5, color: promo.subFg, marginTop: 2 }}>{promo.sub}</Text>
        </View>
        {/* 82x82 con "contain" y apoyada abajo a la derecha, igual que el
            prototipo: con "cover" la foto salía recortada y desproporcionada. */}
        <Image source={IMG[promo.photo]} style={{ width: 82, height: 82, marginRight: 8, alignSelf: 'flex-end' }} resizeMode="contain" />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <TouchableOpacity onPress={() => go('carnet')} style={{ width: '47%', flexGrow: 1, height: 130, borderRadius: 14, padding: 14, justifyContent: 'space-between', backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200] }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}><Ic d="calendar" size={17} color={INK} /></View>
          <View><Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>Próximas vacunas</Text><Text style={{ fontSize: 11, color: BRAND, fontWeight: '600', marginTop: 4 }}>Ver más →</Text></View>
        </TouchableOpacity>
        {/* La tarjeta no se pierde para el socio gratuito: cambia de destino y de
            texto. Que se vea lindo lo que todavía no tiene es su trabajo. */}
        <TouchableOpacity onPress={pago ? () => go('beneficios') : onPlan} style={{ width: '47%', flexGrow: 1, height: 130, borderRadius: 14, overflow: 'hidden' }}>
          <ImageBackground source={IMG['benef.webp']} resizeMode="cover" style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }} imageStyle={{ borderRadius: 14 }}>
            <View style={{ backgroundColor: 'rgba(33,30,51,0.55)', padding: 14 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: '#fff' }}>{pago ? 'Beneficios' : INVITACION_PLAN.titulo}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>{pago ? 'Descuentos exclusivos' : INVITACION_PLAN.bajada}</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => go('servicios')} style={{ width: '47%', flexGrow: 1, height: 130, borderRadius: 14, overflow: 'hidden' }}>
          <ImageBackground source={IMG['serv.webp']} resizeMode="cover" style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }} imageStyle={{ borderRadius: 14 }}>
            <View style={{ backgroundColor: 'rgba(33,30,51,0.55)', padding: 14 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: '#fff' }}>Servicios</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>Encontrá prestadores cerca tuyo</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => go('minegocio')} style={{ width: '47%', flexGrow: 1, height: 130, borderRadius: 14, padding: 14, justifyContent: 'space-between', backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200] }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}><Ic d="store" size={17} color={INK} /></View>
          <View><Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>Mi negocio</Text><Text style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Publicá y gestioná tu servicio</Text></View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ── Pantalla: Carnet ──────────────────────────────────────────── */
/* ── Hoja inferior (los sheets del prototipo) ──────────────────── */
function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    /* OJO con la estructura: el fondo que cierra al tocarlo es un HERMANO de la
       hoja, no su padre. Antes el ScrollView estaba adentro de un Pressable y ese
       Pressable se quedaba con el gesto: el contenido se trababa a mitad de
       arrastre (se veía en el calendario, que es la hoja más alta). */
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, justifyContent: 'flex-end' }}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(33,30,51,0.45)' }} />
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 26 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ width: 40, height: 4, borderRadius: 100, backgroundColor: '#e0dcec', alignSelf: 'center', marginBottom: 16 }} />
          {children}
        </ScrollView>
      </View>
    </View>
  );
}
/**
 * Un slider que se arrastra de verdad.
 *
 * El radio de búsqueda no se podía mover: eran seis zonas invisibles que se
 * tocaban (1, 5, 10, 15, 20, 25 km), así que arrastrar no hacía nada y los valores
 * del medio no existían. Va con `PanResponder` y no con
 * `@react-native-community/slider` a propósito: ese es un módulo nativo y nos
 * obligaría a un build nuevo, mientras esto sale por OTA.
 *
 * Dos detalles que lo hacen funcionar adentro de un ScrollView:
 *   · `onMoveShouldSetPanResponderCapture` agarra el gesto ANTES que el scroll
 *     vertical, que si no se lo lleva al primer píxel de movimiento.
 *   · `onPanResponderTerminationRequest: () => false` evita que el scroll se lo
 *     robe a mitad de arrastre.
 *
 * El ancho se mide con `onLayout` porque hay que traducir píxeles a valores, y en
 * React Native no hay forma de saberlo antes de que se dibuje.
 */
function Slider({ valor, min, max, onCambio }: { valor: number; min: number; max: number; onCambio: (v: number) => void }) {
  const [ancho, setAncho] = useState(0);
  const anchoRef = useRef(0);
  const ALTO_TOQUE = 34;

  const valorDesdeX = (x: number) => {
    const w = anchoRef.current;
    if (w <= 0) return valor;
    const t = Math.max(0, Math.min(1, x / w));
    return Math.round(min + t * (max - min));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => onCambio(valorDesdeX(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => onCambio(valorDesdeX(e.nativeEvent.locationX)),
    }),
  ).current;

  const pct = ((valor - min) / (max - min)) * 100;
  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => { const w = e.nativeEvent.layout.width; anchoRef.current = w; setAncho(w); }}
      // La zona de toque es más alta que la barra: 6px de alto no se pueden agarrar
      // con un dedo.
      style={{ height: ALTO_TOQUE, justifyContent: 'center', marginBottom: 6 }}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.violet[100] }}>
        <View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: BRAND, width: `${pct}%` }} />
        {ancho > 0 && (
          <View style={{ position: 'absolute', left: (pct / 100) * ancho - 11, top: -8, width: 22, height: 22, borderRadius: 11, backgroundColor: BRAND, borderWidth: 3, borderColor: '#fff' }} />
        )}
      </View>
    </View>
  );
}

/** Botón de un grupo de opciones tipo pastilla (Tipo, Estado). */
function SegBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1, borderWidth: 1.5, borderColor: active ? BRAND : colors.violet[200], backgroundColor: active ? BRAND : '#fff', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
      <Text style={{ fontWeight: '600', fontSize: 13, color: active ? '#fff' : MUTED }}>{label}</Text>
    </TouchableOpacity>
  );
}
const SheetLabel = ({ children }: { children: ReactNode }) => <Text style={{ fontWeight: '700', fontSize: 13, marginBottom: 8, color: INK }}>{children}</Text>;
/** Título de grupo del formulario, como en el prototipo. */
const Grupo = ({ children }: { children: ReactNode }) => <Text style={{ fontSize: 12, fontWeight: '700', color: '#8781a0', letterSpacing: 0.5, marginBottom: 8 }}>{String(children).toUpperCase()}</Text>;

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
      <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 20, color: INK, marginBottom: 2 }}>Calendario de salud</Text>
      <Text style={{ fontSize: 13, color: '#8781a0', marginBottom: 18 }}>Vacunas, estudios y antiparasitarios: cuándo se aplicaron y cuándo toca el próximo.</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity onPress={() => mover(-1)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: BRAND, fontSize: 20 }}>‹</Text></TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 14, color: INK }}>{calMesLabel(mes.y, mes.m)}</Text>
        <TouchableOpacity onPress={() => mover(1)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: BRAND, fontSize: 20 }}>›</Text></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        {CAL_DIAS.map((d) => <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#a29dba', paddingVertical: 6 }}>{d}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
        {cells.map((c, i) => {
          const tone = c.mark ? CAL_TONE[c.mark] : null;
          const marcado = c.vaxes.length > 0;
          if (c.num === null) return <View key={`h${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          return (
            <View key={c.iso} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              <TouchableOpacity disabled={!marcado} onPress={() => setDia(c)} style={{ flex: 1, borderRadius: 8, backgroundColor: tone?.bg ?? '#fff', borderWidth: 1, borderColor: tone?.border ?? '#eeecf5', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, color: INK }}>{c.num}</Text>
                {marcado && <View style={{ position: 'absolute', bottom: 2, right: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: tone!.dot }} />}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: '#eeecf5', paddingTop: 16 }}>
        <Text style={{ fontWeight: '700', fontSize: 13, color: INK, marginBottom: 10 }}>Leyenda</Text>
        <View style={{ gap: 8 }}>
          {([['aplicada', 'Vacuna aplicada'], ['pronto', 'Próxima en 3 días'], ['pendiente', 'Próxima pendiente']] as const).map(([k, txt]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: CAL_TONE[k].bg, borderWidth: 1.5, borderColor: CAL_TONE[k].border }} />
              <Text style={{ fontSize: 12, color: INK }}>{txt}</Text>
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity onPress={onClose} style={{ backgroundColor: colors.violet[100], borderRadius: 14, padding: 13, alignItems: 'center', marginTop: 12 }}>
        <Text style={{ color: BRAND, fontWeight: '700', fontSize: 15 }}>Cerrar</Text>
      </TouchableOpacity>

      {dia && (
        <Sheet onClose={() => setDia(null)}>
          {/* "Carnet" y no "Vacunas": el día puede tener un estudio o un
              antiparasitario, y el ícono sale del tipo en lugar de ser el escudo
              de vacuna para todo. */}
          <Text style={{ fontWeight: '700', fontSize: 18, color: INK, marginBottom: 20 }}>Carnet del {calDiaLabel(dia.iso!)}</Text>
          <View style={{ gap: 12 }}>
            {dia.vaxes.map((v, i) => {
              const tipo = (VACUNA_KINDS as string[]).includes(v.kind) ? (v.kind as VaccineKind) : 'Vacuna';
              return (
                <View key={v.name + i} style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
                    <Ic d={VAC_IC[KIND_ICON[tipo]]} size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: INK }}>{v.name}</Text>
                    <Text style={{ fontSize: 12, color: '#8781a0', marginTop: 2 }}>{tipo} · {v.estado}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <TouchableOpacity onPress={() => setDia(null)} style={{ backgroundColor: colors.violet[100], borderRadius: 14, padding: 13, alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: BRAND, fontWeight: '700', fontSize: 15 }}>Cerrar</Text>
          </TouchableOpacity>
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
      <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 20, color: INK, marginBottom: 4 }}>Agregar al carnet</Text>
      <Text style={{ fontSize: 13, color: '#8781a0', marginBottom: 18 }}>Sumá una vacuna, estudio o antiparasitario al historial de {petName}.</Text>

      <SheetLabel>Tipo</SheetLabel>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
        {VACUNA_KINDS.map((k) => <SegBtn key={k} label={k} active={kind === k} onPress={() => setKind(k)} />)}
      </View>

      <SheetLabel>Nombre</SheetLabel>
      <TextInput value={name} onChangeText={setName} placeholder="Ej: Quíntuple, Análisis de sangre…" placeholderTextColor={colors.violet[400]}
        style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff', marginBottom: 16 }} />

      <SheetLabel>Estado</SheetLabel>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
        <SegBtn label="Sí, ya aplicada" active={aplicada} onPress={() => setAplicada(true)} />
        <SegBtn label="No, es próxima" active={!aplicada} onPress={() => setAplicada(false)} />
      </View>

      <SheetLabel>{aplicada ? 'Fecha de aplicación' : 'Próxima fecha'}</SheetLabel>
      <TouchableOpacity onPress={() => setPickerOpen((o) => !o)} style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 14, color: fecha ? INK : colors.violet[400] }}>{fecha ? fmtFechaCorta(fecha) : 'Seleccionar fecha'}</Text>
      </TouchableOpacity>
      {pickerOpen && (
        <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <TouchableOpacity onPress={() => moverP(-1)} style={{ paddingHorizontal: 6, paddingVertical: 4 }}><Text style={{ fontSize: 16, color: INK }}>←</Text></TouchableOpacity>
            <Text style={{ fontWeight: '600', fontSize: 13, color: INK }}>{calMesLabel(pMes.y, pMes.m)}</Text>
            <TouchableOpacity onPress={() => moverP(1)} style={{ paddingHorizontal: 6, paddingVertical: 4 }}><Text style={{ fontSize: 16, color: INK }}>→</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {buildPickerMes(pMes.y, pMes.m).map((d, i) => d.num === null
              ? <View key={`h${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />
              : (
                <View key={d.iso} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 1.5 }}>
                  <TouchableOpacity onPress={() => { setFecha(d.iso); setPickerOpen(false); }} style={{ flex: 1, borderRadius: 6, borderWidth: 1, backgroundColor: fecha === d.iso ? BRAND : '#fff', borderColor: fecha === d.iso ? BRAND : '#eeecf5', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 11, color: fecha === d.iso ? '#fff' : INK, fontWeight: fecha === d.iso ? '600' : '400' }}>{d.num}</Text>
                  </TouchableOpacity>
                </View>
              ))}
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <TouchableOpacity onPress={onClose} style={{ backgroundColor: colors.violet[100], borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' }}>
          <Text style={{ color: BRAND, fontWeight: '700', fontSize: 15 }}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!puedeGuardar} onPress={guardar} style={{ flex: 1, backgroundColor: puedeGuardar ? BRAND : '#c7c1de', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{busy ? 'Guardando…' : 'Guardar'}</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

function Carnet({ pets, petIdx, setPetIdx, contacts, userId, reload, go }: { pets: Pet[]; petIdx: number; setPetIdx: (i: number) => void; contacts: EmergencyContact[]; userId: string; reload: () => void; go: (t: Screen) => void }) {
  const pet = pets[petIdx];
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [addCon, setAddCon] = useState(false);
  const [cn, setCn] = useState('');
  const [cp, setCp] = useState('');

  const addContacto = async () => {
    if (!cn.trim()) return;
    setBusy('contacto');
    const { error } = await supabase.from('emergency_contacts').insert({
      owner_id: userId, name: cn.trim(), type: 'Veterinaria', phone: cp.trim() || null,
    });
    if (!error) { setCn(''); setCp(''); setAddCon(false); await reload(); }
    setBusy(null);
  };

  /** Borrar, que no se podía en ninguna de las dos superficies: un teléfono mal
   *  cargado quedaba para siempre, y en una urgencia eso es peor que nada. */
  const borrarContacto = (c: EmergencyContact) => {
    Alert.alert(`Borrar ${c.name}`, 'Lo saco de tus contactos de emergencia.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          setBusy(c.id);
          const { error } = await supabase.from('emergency_contacts').delete().eq('id', c.id);
          if (error) Alert.alert('No pudimos borrarlo', 'Probá de nuevo.');
          else await reload();
          setBusy(null);
        },
      },
    ]);
  };

  const markApplied = async (vacId: string) => {
    setBusy(vacId);
    // Igual que la webapp: `due_on` se conserva. Antes acá se borraba, así que
    // la misma acción dejaba la fila distinta según desde dónde la hicieras.
    await supabase.from('vaccinations').update({ status: 'aplicada', applied_on: hoyISO() }).eq('id', vacId);
    await reload();
    setBusy(null);
  };
  const addVac = async ({ kind, name, aplicada, fecha }: { kind: VaccineKind; name: string; aplicada: boolean; fecha: string | null }) => {
    if (!pet) return;
    await supabase.from('vaccinations').insert({
      pet_id: pet.id, name, kind,
      status: aplicada ? 'aplicada' : 'pendiente',
      applied_on: aplicada ? fecha : null,
      due_on: aplicada ? null : fecha,
    });
    setAdding(false);
    await reload();
  };

  if (!pet) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <H1>Carnet digital</H1>
        <View style={{ height: 14 }} />
        <EmptyPets go={go} />
      </ScrollView>
    );
  }
  return (
    // Las hojas van fuera del ScrollView: adentro, `position:absolute` se
    // posiciona contra el contenido y no contra la pantalla.
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.screen}>
      <H1>Carnet digital</H1>
      <View style={{ height: 10 }} />
      <PetChips pets={pets} idx={petIdx} setIdx={setPetIdx} />
      <PetCard pet={pet} detailed />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: INK }}>Salud y vacunas</Text>
        <TouchableOpacity onPress={() => setShowCal(true)}>
          <Text style={{ fontSize: 13, color: BRAND, fontWeight: '600', textDecorationLine: 'underline' }}>Ver calendario</Text>
        </TouchableOpacity>
      </View>
      <View style={{ gap: 10 }}>
        {pet.vaccines.map((v) => {
          const tone = TONE[v.tone];
          const hi = v.tone === 'lime';
          return (
            <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: hi ? '#eef7d6' : '#f7f6fa', borderWidth: hi ? 1.5 : 1, borderColor: hi ? LIME : '#eeecf5', borderRadius: 14, padding: 13 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}><Ic d={VAC_IC[KIND_ICON[v.kind]]} size={18} color={tone.fg} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>{v.name}</Text>
                <Text style={{ fontSize: 12, color: colors.violet[400] }}>{v.sub}</Text>
                {v.remind && <Text style={{ fontSize: 11, color: '#c0392b', fontWeight: '600', marginTop: 3 }}>⏰ Recordatorio: aplicala pronto</Text>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={{ color: tone.fg, fontWeight: '700', fontSize: 12 }}>{v.status}</Text>
                {v.mark && (
                  <TouchableOpacity disabled={busy === v.id} onPress={() => markApplied(v.id)} style={{ backgroundColor: BRAND, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, opacity: busy === v.id ? 0.6 : 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 11 }}>Marcar aplicada</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        {pet.vaccines.length === 0 && (
          <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13.5, color: MUTED, textAlign: 'center' }}>Todavía no hay vacunas cargadas para {pet.name}.</Text>
          </View>
        )}
      </View>
      {/* Los dos botones del prototipo: el calendario a la izquierda y el alta al
          lado. En 375px los dos textos completos no entran en una fila (el del
          alta quedaba con 3px de aire), así que el de agregar va abajo, entero. */}
      <View style={{ gap: 10, marginTop: 16 }}>
        <TouchableOpacity onPress={() => setAdding(true)} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Agregar estudio o vacuna</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowCal(true)} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.violet[100], borderRadius: 14, paddingVertical: 14 }}>
          <Ic d="calendar" size={18} />
          <Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>Calendario</Text>
        </TouchableOpacity>
      </View>

      {/* Contactos de emergencia. La webapp los tenía en el carnet y en mobile no
          existían — que es justo donde más se necesitan: el carnet es lo que
          abrís en la veterinaria a las 3 de la mañana. */}
      <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.violet[200] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>Contactos de emergencia</Text>
          <TouchableOpacity onPress={() => setAddCon((v) => !v)}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: BRAND }}>{addCon ? 'Cancelar' : '+ Agregar'}</Text>
          </TouchableOpacity>
        </View>

        {addCon && (
          <View style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 14, padding: 14, marginBottom: 12, gap: 8 }}>
            <TextInput value={cn} onChangeText={setCn} placeholder="Nombre (ej: Veterinaria Norte)" placeholderTextColor={colors.violet[400]}
              style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
            <TextInput value={cp} onChangeText={setCp} placeholder="Teléfono" placeholderTextColor={colors.violet[400]} keyboardType="phone-pad"
              style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
            <TouchableOpacity disabled={busy === 'contacto'} onPress={addContacto} style={{ backgroundColor: LIME, borderRadius: 12, paddingVertical: 13, alignItems: 'center', opacity: busy === 'contacto' ? 0.6 : 1 }}>
              <Text style={{ color: INK, fontWeight: '700', fontSize: 14 }}>{busy === 'contacto' ? 'Guardando…' : 'Guardar contacto'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {contacts.length === 0 && !addCon ? (
          <Text style={{ fontSize: 13, color: MUTED, lineHeight: 19 }}>
            Cargá la veterinaria de tu mascota y el número que llamarías en una urgencia, para tenerlos acá cuando haga falta.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {contacts.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', gap: 12, backgroundColor: '#fbe8ef', borderWidth: 1, borderColor: '#f5d6e3', borderRadius: 14, padding: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Ic d="hospital" size={19} color="#c14d7a" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>{c.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.violet[400], marginBottom: 3 }}>{c.type}</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                    <Text style={{ color: '#c14d7a', fontWeight: '700', fontSize: 12.5 }}>{c.phone}</Text>
                  </TouchableOpacity>
                  {c.address || c.hours ? <Text style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{[c.address, c.hours].filter(Boolean).join(' · ')}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => borrarContacto(c)} disabled={busy === c.id}>
                  <Text style={{ fontSize: 12, color: MUTED }}>{busy === c.id ? '…' : 'Borrar'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

    </ScrollView>
    {showCal && <CalendarioSheet vacs={pet.vaccines} onClose={() => setShowCal(false)} />}
    {adding && <AgregarSheet petName={pet.name} onClose={() => setAdding(false)} onSave={addVac} />}
    </View>
  );
}

/* ── Pantalla: Servicios ───────────────────────────────────────── */
const CHIPS = [
  { label: 'Todos', cat: null as string | null }, { label: 'Paseos', cat: 'Paseador' }, { label: 'Guardería', cat: 'Guardería' },
  { label: 'Baño', cat: 'Baño y estética' }, { label: 'Adiestrador', cat: 'Adiestrador' }, { label: 'Cuidador', cat: 'Cuidador' },
];
/* ── Sub-pantalla: ficha del prestador ─────────────────────────── */
/** Portada, identidad, tarifa, contacto y reseñas, con la barra fija de abajo.
 *  Antes tocar un prestador abría WhatsApp directo, sin poder ver nada. */
/** Cinco estrellas; si viene `onPick` son tocables (para calificar). */
function Estrellas({ n, onPick }: { n: number; onPick?: (v: number) => void }) {
  const size = onPick ? 26 : 13;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} disabled={!onPick} onPress={() => onPick?.(i)}>
          <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path d="M12 3.4 14.6 9l6 .5-4.6 4 1.4 5.9L12 18l-5.4 3.2 1.4-5.9-4.6-4 6-.5z" fill={i <= n ? '#f5b301' : '#e6e3f0'} />
          </Svg>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PrestadorDetalle({ p, guardado, onGuardar, onVolver, reviews, userId, firstName, reload }: { p: ProviderVM; guardado: boolean; onGuardar: () => void; onVolver: () => void; reviews: Review[]; userId: string; firstName: string; reload: () => void }) {
  const propia = reviews.find((r) => r.propia);
  const [abierta, setAbierta] = useState(false);
  const [estrellas, setEstrellas] = useState(propia?.rating ?? 5);
  const [texto, setTexto] = useState(propia?.text ?? '');
  const [busy, setBusy] = useState(false);

  const guardarReseña = async () => {
    setBusy(true);
    // Una por socio y prestador: si ya opinó, se actualiza la suya.
    await supabase.from('provider_reviews').upsert({
      provider_id: p.id, member_id: userId, rating: estrellas, text: texto.trim(), author_name: firstName,
    }, { onConflict: 'provider_id,member_id' });
    setAbierta(false);
    await reload();
    setBusy(false);
  };
  const borrarReseña = async () => {
    setBusy(true);
    await supabase.from('provider_reviews').delete().eq('provider_id', p.id).eq('member_id', userId);
    setAbierta(false);
    await reload();
    setBusy(false);
  };

  /*
   * Cada dato de contacto es una acción, no un cartel.
   *
   * Eran cuatro filas de texto plano: no se podía ni tocar el teléfono para llamar ni
   * abrir el Instagram. Los links los arma `@kumo/shared/prestadores`, porque el
   * trabajo está en que la gente escribe estos datos como quiere (el sitio sin
   * "https://", el Instagram con arroba o con la URL entera). Si un dato no se puede
   * convertir en acción, la fila queda como texto.
   */
  const dato = (icono: IconName, texto: string, ultimo = false, abrir?: (() => void) | null) => {
    const adentro = (
      <>
        <Ic d={icono} size={19} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: abrir ? BRAND : INK, flex: 1 }}>{texto}</Text>
      </>
    );
    const estilo = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 12, borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: '#eeecf5' };
    return abrir
      ? <TouchableOpacity key={texto} onPress={abrir} style={estilo}>{adentro}</TouchableOpacity>
      : <View key={texto} style={estilo}>{adentro}</View>;
  };
  const abrirSi = (url: string | null) => (url ? () => { void Linking.openURL(url); } : null);
  const mapa = consultaMapa({ lat: p.lat, lng: p.lng, direccion: p.address, zona: p.zone });
  const contacto = [
    p.website ? { i: 'globe' as IconName, t: p.website, abrir: abrirSi(urlSitio(p.website)) } : null,
    p.instagram ? { i: 'instagram' as IconName, t: p.instagram, abrir: abrirSi(urlInstagram(p.instagram)) } : null,
    p.address ? { i: 'pin' as IconName, t: p.address, abrir: mapa ? () => abrirMapa(mapa) : null } : null,
    p.phone ? { i: 'phone' as IconName, t: p.phone, abrir: abrirSi(urlTel(p.phone)) } : null,
  ].filter(Boolean) as { i: IconName; t: string; abrir: (() => void) | null }[];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Portada. Va con las esquinas de arriba redondeadas y separada, como en
            el prototipo: pegada al header se leía como parte de él. */}
        <View style={{ height: 132, marginTop: 6, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: BRAND, overflow: 'hidden' }}>
          {/* Sin foto la portada es el violeta con el ícono del rubro de marca de
              agua: el violeta pelado se leía como un error de carga. */}
          {p.photo ? (
            <Image source={petImg(p.photo)} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.55 }} resizeMode="cover" />
          ) : (
            <View style={{ position: 'absolute', right: 10, bottom: -22, opacity: 0.16 }}>
              <Ic d={RUBRO_IC[p.category] ?? 'paw'} size={112} color="#fff" fill={p.category === 'Paseador'} />
            </View>
          )}
          <TouchableOpacity onPress={onVolver} style={{ position: 'absolute', top: 14, left: 16, width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* Avatar + identidad */}
          {/* El avatar monta sobre la portada, pero no tanto: con -38 el nombre
              arrancaba justo en el filo de la foto y se leía pegado. */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: -26, marginBottom: 14 }}>
            <FotoPrestador p={p} lado={84} radio={24} extra={{ borderWidth: 4, borderColor: '#fff' }} />
            <View style={{ flex: 1, paddingBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK }}>{p.name}</Text>
                {p.verificado && (
                  <View style={{ width: 20, height: 20, borderRadius: 10, overflow: 'hidden', backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={12} height={12} viewBox="0 0 24 24"><Path d="M4 12l5 5L20 6" fill="none" stroke={LIME} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                  </View>
                )}
              </View>
              <Text style={{ color: '#8781a0', fontSize: 13.5 }}>{p.category} · {p.zone}</Text>
            </View>
          </View>

          {/* Chips. El sello sale del estado real, no está fijo. */}
          <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
            {p.verificado && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#eef7d6', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 100 }}>
                <Ic d="shield" size={12} color="#5f7d10" />
                <Text style={{ color: '#5f7d10', fontWeight: '700', fontSize: 11.5 }}>Verificado por Kumo</Text>
              </View>
            )}
            <View style={{ backgroundColor: colors.violet[100], paddingHorizontal: 11, paddingVertical: 5, borderRadius: 100 }}>
              {p.km != null && <Text style={{ color: BRAND, fontWeight: '700', fontSize: 11.5 }}>{p.km} km {p.kmDesde}</Text>}
            </View>
          </View>

          {p.about ? <Text style={{ fontSize: 14, color: MUTED, lineHeight: 22, marginBottom: 18 }}>{p.about}</Text> : null}

          {/* La base guarda un precio por prestador, no una lista de tarifas. */}
          {p.price > 0 && (
            <>
              <Text style={{ fontWeight: '700', fontSize: 15, color: INK, marginBottom: 10 }}>Servicios y tarifas</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: INK }}>{p.category}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND }}>{money(p.price)}{p.priceUnit}</Text>
              </View>
            </>
          )}

          {contacto.length > 0 && (
            <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 16, marginBottom: 18 }}>
              {contacto.map((c, i) => dato(c.i, c.t, i === contacto.length - 1, c.abrir))}
            </View>
          )}

          {/* Reseñas reales: el promedio y el conteo los recalcula un trigger
              sobre esta misma tabla, así que siempre coinciden. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>Reseñas de socios</Text>
            {ratingLabel(p.rating, p.reviews) ? <Text style={{ fontSize: 13, color: MUTED }}>★ <Text style={{ fontWeight: '700', color: INK }}>{ratingLabel(p.rating, p.reviews)}</Text> · {p.reviews}</Text> : null}
          </View>

          {reviews.length === 0 && !abierta && (
            <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 13.5, color: '#8781a0', lineHeight: 20 }}>Todavía no tiene reseñas. Si lo contrataste, dejá la primera.</Text>
            </View>
          )}

          <View style={{ gap: 12, marginBottom: 12 }}>
            {reviews.map((r) => (
              <View key={r.id} style={{ backgroundColor: r.propia ? colors.violet[100] : '#f7f6fa', borderWidth: 1, borderColor: r.propia ? '#e0dcec' : '#eeecf5', borderRadius: 16, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    <Ic d="person" size={16} color="#8781a0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 13, color: INK }}>{r.propia ? 'Tu reseña' : r.author}</Text>
                    <Text style={{ fontSize: 11, color: '#a29dba' }}>{reviewTiempo(r.createdAt)}</Text>
                  </View>
                  <Estrellas n={r.rating} />
                </View>
                {r.text ? <Text style={{ fontSize: 13, color: MUTED, lineHeight: 20 }}>{r.text}</Text> : null}
              </View>
            ))}
          </View>

          {abierta ? (
            <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 14, marginBottom: 8 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: INK, marginBottom: 10 }}>{propia ? 'Editar tu reseña' : `¿Cómo te fue con ${p.name}?`}</Text>
              <View style={{ marginBottom: 10 }}><Estrellas n={estrellas} onPick={setEstrellas} /></View>
              <TextInput value={texto} onChangeText={setTexto} multiline placeholder="Contá tu experiencia (opcional)" placeholderTextColor={colors.violet[400]}
                style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff', height: 84, textAlignVertical: 'top', marginBottom: 10 }} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity disabled={busy} onPress={guardarReseña} style={{ flex: 1, backgroundColor: BRAND, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{busy ? 'Guardando…' : 'Publicar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAbierta(false)} style={{ backgroundColor: colors.violet[100], borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}>
                  <Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                </TouchableOpacity>
                {propia ? (
                  <TouchableOpacity disabled={busy} onPress={borrarReseña} style={{ backgroundColor: '#fbe8ef', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#c14d7a', fontWeight: '700', fontSize: 14 }}>Borrar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setEstrellas(propia?.rating ?? 5); setTexto(propia?.text ?? ''); setAbierta(true); }} style={{ backgroundColor: colors.violet[100], borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>{propia ? 'Editar tu reseña' : 'Dejar una reseña'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Barra fija */}
      <View style={{ flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eeecf5', paddingHorizontal: 20, paddingVertical: 14 }}>
        <TouchableOpacity onPress={() => openWa(p.phone)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14 }}>
          <Ic d="chat" size={17} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Contactar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onGuardar} style={{ width: 52, backgroundColor: guardado ? '#fbe8ef' : LIME, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Ic d="heart" size={20} color={guardado ? '#c14d7a' : INK} fill={guardado} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** El centro de los mapas: el domicilio del socio (ver useKumoData). */
type Centro = { lat: number; lng: number; etiqueta: string | null };

function Servicios({ providers, guardados, onGuardar, onPrestar, reviews, userId, firstName, reload, centro }: { providers: ProviderVM[]; guardados: string[]; onGuardar: (id: string) => void; onPrestar: () => void; reviews: Record<string, Review[]>; userId: string; firstName: string; reload: () => void; centro: Centro }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [radius, setRadius] = useState(5);
  const [selId, setSelId] = useState<string | null>(null);
  const ql = q.trim().toLowerCase();
  // El radio descarta al que SABEMOS que está lejos; el que no tiene coordenadas no
  // entra ni sale del radio, así que se muestra sin distancia en vez de esconderlo.
  const list = providers.filter((p) => (!cat || p.category === cat) && (!ql || `${p.name} ${p.category} ${p.zone}`.toLowerCase().includes(ql)) && (p.km == null || p.km <= radius));
  /** El prestador con distancia conocida más cercano, para el mensaje de vacío. */
  const masCerca = providers.reduce<number | null>((min, p) => (p.km != null && (min == null || p.km < min) ? p.km : min), null);

  const sel = providers.find((p) => p.id === selId);
  if (sel) {
    return <PrestadorDetalle p={sel} guardado={guardados.includes(sel.id)} onGuardar={() => onGuardar(sel.id)} onVolver={() => setSelId(null)} reviews={reviews[sel.id] ?? []} userId={userId} firstName={firstName} reload={reload} />;
  }
  const guardadosList = providers.filter((p) => guardados.includes(p.id));

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <H1>Servicios</H1>
        <TouchableOpacity onPress={onPrestar} style={{ backgroundColor: LIME, borderRadius: 100, paddingVertical: 9, paddingHorizontal: 14, marginTop: 4 }}><Text style={{ color: INK, fontWeight: '700', fontSize: 12.5 }}>+ Prestar servicio</Text></TouchableOpacity>
      </View>
      <Sub>Contratá prestadores verificados u ofrecé el tuyo</Sub>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, paddingHorizontal: 14, marginBottom: 14 }}>
        <Ic d="search" size={18} color={colors.violet[400]} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar paseador, guardería, zona…" placeholderTextColor={colors.violet[400]} style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: INK }} />
        {q ? <TouchableOpacity onPress={() => setQ('')}><Text style={{ color: '#a29dba', fontSize: 18 }}>×</Text></TouchableOpacity> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
        {CHIPS.map((c) => {
          const active = cat === c.cat;
          return (
            <TouchableOpacity key={c.label} onPress={() => setCat(c.cat)} style={{ paddingVertical: 8, paddingHorizontal: 15, borderRadius: 100, backgroundColor: active ? BRAND : colors.violet[100] }}>
              <Text style={{ fontWeight: '600', fontSize: 13, color: active ? '#fff' : BRAND }}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* Radio de búsqueda */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, color: MUTED, fontWeight: '600' }}>Radio de búsqueda</Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: BRAND }}>{radius} km</Text>
      </View>
      <Slider valor={radius} min={1} max={25} onCambio={setRadius} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: '#a29dba' }}>1 km</Text><Text style={{ fontSize: 11, color: '#a29dba' }}>25 km</Text>
      </View>
      {/*
        * El mapa, con geografía de verdad (ver components/MapaLugares).
        *
        * Era un dibujo: manzanas grises y los pines ubicados con un hash del id,
        * "estables entre renders" pero sin relación con dónde queda cada prestador. Se
        * muestran los de la lista filtrada que tengan coordenadas: uno sin lat/lng no
        * se puede dibujar, y ponerlo en el centro sería inventar de nuevo.
        */}
      <View style={{ marginBottom: 14 }}>
        <MapaLugares
          pins={list.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.id, nombre: p.name, lat: p.lat as number, lng: p.lng as number }))}
          centro={centro}
          radioKm={radius}
          onPin={(id) => setSelId(id)}
        />
      </View>

      {/* Guardados */}
      {guardadosList.length > 0 && (
        <View style={{ backgroundColor: '#fbe8ef', borderWidth: 1, borderColor: '#f6d5e2', borderRadius: 18, padding: 14, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Ic d="heart" size={16} color="#c14d7a" fill />
            <Text style={{ fontWeight: '800', fontSize: 14, color: INK, fontFamily: FH }}>Guardados</Text>
            <View style={{ backgroundColor: '#fff', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: '#c14d7a', fontWeight: '700', fontSize: 11 }}>{guardadosList.length}</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {guardadosList.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => setSelId(p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10 }}>
                <FotoPrestador p={p} lado={38} radio={11} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>{p.name}</Text>
                  <Text style={{ fontSize: 12, color: '#a29dba' }}>{p.category} · {p.zone}</Text>
                </View>
                <Text style={{ color: colors.violet[300], fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 13, color: INK }}><Text style={{ fontWeight: '700' }}>{list.length} prestadores</Text> en {radius} km</Text>
        <Text style={{ fontSize: 12.5, color: MUTED }}>≡ Más cercano</Text>
      </View>
      {list.length === 0 && (
        <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 22, alignItems: 'center' }}>
          {/* Ahora que las distancias salen del domicilio del socio, "ampliá el radio"
              es un consejo inútil para alguien de Tandil: el radio llega a 25 km y el
              prestador más cercano está a 350. Que lo diga el número. */}
          <Text style={{ fontSize: 13.5, color: MUTED, textAlign: 'center' }}>
            Sin resultados en {radius} km.{' '}
            {masCerca != null && masCerca > radius
              ? `El más cercano está a ${masCerca} km ${providers[0]?.kmDesde ?? ''}.`
              : 'Ampliá el radio o cambiá de servicio.'}
          </Text>
        </View>
      )}
      <View style={{ gap: 12 }}>
        {list.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => setSelId(p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 12 }}>
            <FotoPrestador p={p} lado={54} radio={15} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>{p.name}</Text>
                {p.badge ? <View style={{ backgroundColor: colors.violet[100], borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: BRAND }}>{p.badge}</Text></View> : null}
              </View>
              <Text style={{ fontSize: 12, color: colors.violet[400] }}>{p.category} · {p.zone}{p.km != null ? ` · ${p.km} km` : ''}</Text>
              {/* Sin reseñas no se muestra estrella: un "★ 0 (0)" se lee como mala calificación. */}
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                {ratingLabel(p.rating, p.reviews) ? `★ ${ratingLabel(p.rating, p.reviews)} (${p.reviews}) · ` : <Text style={{ color: '#a29dba' }}>Sin reseñas · </Text>}
                {/* Sin tarifa cargada no se muestra nada: "$0" se lee como que trabaja
                    gratis, y el que se acaba de dar de alta todavía no la puso. */}
                {precioTexto(p.price, p.priceUnit) ? <Text style={{ color: BRAND, fontWeight: '700' }}>{precioTexto(p.price, p.priceUnit)}</Text> : null}
              </Text>
            </View>
            <Text style={{ color: colors.violet[300], fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

/* ── Pantalla: Beneficios ──────────────────────────────────────── */
/** Los mismos que el prototipo y que guarda la base: una letra por día, con X
 *  para miércoles. Comparar contra "Lun/Mar/Mié" no encendía ningún chip. */
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/* ── Ficha del beneficio ───────────────────────────────────────── */
/** La hoja del prototipo. Antes las filas no abrían nada y los datos que la
 *  tabla ya guardaba (días, horario, vigencia) no se veían en ningún lado. */
function BeneficioFicha({ b, onClose, onCarnet }: { b: BenefitVM; onClose: () => void; onCarnet: () => void }) {
  const activos = new Set(b.days);
  return (
    <Sheet onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <View style={{ width: 46, height: 46, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d={b.icon} size={22} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 18, color: INK }}>{b.name}</Text>
          <Text style={{ fontSize: 12.5, color: '#8781a0' }}>{b.cat}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: BRAND, fontSize: 15 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: '#f7f6fa', borderRadius: 14, padding: 14 }}>
          <Text style={{ fontSize: 11, color: '#8781a0', marginBottom: 4 }}>Descuento</Text>
          <Text style={{ fontWeight: '800', fontSize: 20, color: BRAND }}>{b.disc}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#f7f6fa', borderRadius: 14, padding: 14 }}>
          <Text style={{ fontSize: 11, color: '#8781a0', marginBottom: 4 }}>Plan mínimo</Text>
          <Text style={{ fontWeight: '700', fontSize: 14, color: INK, marginTop: 3 }}>{b.planRequirement}</Text>
        </View>
      </View>

      {/* El lugar: la dirección si el club la cargó, la zona si no, y a cuánto le
          queda al socio. */}
      {b.zone || b.address ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f7f6fa', borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <Ic d="pin" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#4a4560' }}>{b.address || b.zone}</Text>
            {b.address && b.zone ? <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{b.zone}</Text> : null}
          </View>
          {b.km != null ? <Text style={{ color: BRAND, fontWeight: '700', fontSize: 11.5 }}>{b.km} km {b.kmDesde}</Text> : null}
        </View>
      ) : null}

      {(b.days.length > 0 || b.hours || b.validUntil) && (
        <View style={{ backgroundColor: '#f7f6fa', borderRadius: 14, padding: 16, marginBottom: 12 }}>
          {b.days.length > 0 && (
            <>
              <Text style={{ fontSize: 11, color: '#8781a0', marginBottom: 10, fontWeight: '700', letterSpacing: 0.4 }}>DÍAS CON DESCUENTO</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {DIAS_SEMANA.map((d) => {
                  const on = activos.has(d);
                  return (
                    <View key={d} style={{ width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? BRAND : '#eeecf5' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: on ? '#fff' : '#c2bcd6' }}>{d}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap' }}>
            {b.hours ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Ic d="calendar" size={15} color="#8781a0" />
                <Text style={{ fontSize: 13, color: '#4a4560', fontWeight: '600' }}>{b.hours}</Text>
              </View>
            ) : null}
            {b.validUntil ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Ic d="calendar" size={15} color="#8781a0" />
                <Text style={{ fontSize: 13, color: '#4a4560', fontWeight: '600' }}>Hasta {fmtFechaCorta(b.validUntil)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      <View style={{ backgroundColor: '#f7f6fa', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 11, color: '#8781a0', marginBottom: 6, fontWeight: '700', letterSpacing: 0.4 }}>¿CÓMO USAR?</Text>
        <Text style={{ fontSize: 13.5, lineHeight: 21, color: '#4a4560' }}>
          {b.description || `Presentá tu carnet digital en ${b.name} para acceder al descuento. Si no tenés el carnet a mano, podés mostrar esta pantalla.`}
        </Text>
      </View>

      <TouchableOpacity onPress={onCarnet} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Mostrar carnet →</Text>
      </TouchableOpacity>
    </Sheet>
  );
}

function Beneficios({ benefits, go, centro, profile }: { benefits: BenefitVM[]; go: (t: Screen) => void; centro: Centro; profile: Profile | null }) {
  const [q, setQ] = useState('');
  const [buscado, setBuscado] = useState('');
  const [zona, setZona] = useState('Todas');
  const [selId, setSelId] = useState<string | null>(null);
  const ql = buscado.trim().toLowerCase();
  /* Los chips de zona salen de las zonas que el club REALMENTE cargó: así no hay una
     lista escrita a mano que quede vieja, y el socio ve qué zonas cubre la red. */
  const zonas = [...new Set(benefits.map((b) => b.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const list = benefits.filter((b) => (zona === 'Todas' || b.zone === zona)
    && (!ql || `${b.name} ${b.cat} ${b.zone}`.toLowerCase().includes(ql)));
  /* El aviso se calcula sobre TODOS los beneficios y no sobre la lista filtrada: la
     pregunta es "¿la red llega hasta donde vivo?", no "¿esto que miro queda cerca?". */
  const conKm = benefits.map((b) => b.km).filter((k): k is number => k != null);
  const aviso = avisoZonaLejos({
    localidad: profile?.city === '—' ? null : profile?.city,
    provincia: profile?.province === '—' ? null : profile?.province,
    zonas: benefits.map((b) => b.zone).filter(Boolean),
    masCercaKm: conKm.length ? Math.min(...conKm) : null,
  });
  const sel = benefits.find((b) => b.id === selId);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.screen}>
      <H1>Beneficios</H1>
      <Sub>Descuentos en la red de veterinarias y pet shops</Sub>
      {/*
        * El mapa de los beneficios, con geografía de verdad.
        *
        * Era el último dibujo que quedaba en la app: pines por hash del id y un punto
        * azul en el centro que aparecía al buscar, haciéndose pasar por la ubicación
        * del socio. Ahora el pin lleva el descuento adentro —que es el dato por el que
        * uno mira este mapa— y la casa del socio va en el centro. Los beneficios de
        * zona entera ("Todo CABA") no tienen dirección posible, así que no tienen pin:
        * siguen en la lista, con su zona.
        *
        * Sin radio: un descuento sirve igual aunque quede lejos.
        */}
      <View style={{ marginBottom: 16 }}>
        <MapaLugares
          pins={list.filter((b) => b.lat != null && b.lng != null).map((b) => ({ id: b.id, nombre: b.name, lat: b.lat as number, lng: b.lng as number, etiqueta: b.disc }))}
          centro={centro}
          onPin={(id) => setSelId(id)}
          alto={175}
        />
      </View>
      {/* Se busca por texto y no por cercanía a propósito: a un beneficio se llega por
          el comercio o el rubro, y la distancia ya está en cada tarjeta. */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, paddingHorizontal: 14 }}>
          <Ic d="pin" size={17} color={colors.violet[400]} />
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => setBuscado(q)} placeholder="Buscá por zona, local o rubro" placeholderTextColor={colors.violet[400]} style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: INK }} />
          {buscado ? <TouchableOpacity onPress={() => { setQ(''); setBuscado(''); }}><Text style={{ color: '#a29dba', fontSize: 18 }}>×</Text></TouchableOpacity> : null}
        </View>
        <TouchableOpacity onPress={() => setBuscado(q)} style={{ backgroundColor: BRAND, borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Buscar</Text></TouchableOpacity>
      </View>
      {/* Chips de zona: solo con más de una, porque con una sola no hay nada que
          filtrar. */}
      {zonas.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {['Todas', ...zonas].map((z) => (
            <TouchableOpacity key={z} onPress={() => setZona(z)} style={{ paddingVertical: 8, paddingHorizontal: 15, borderRadius: 100, backgroundColor: zona === z ? BRAND : colors.violet[100] }}>
              <Text style={{ fontWeight: '600', fontSize: 13, color: zona === z ? '#fff' : BRAND }}>{z}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      {/* El catálogo se lista completo a propósito —un descuento en CABA le sirve al de
          Tandil si viaja— pero sin decir nada le ofrecíamos seis comercios a 300 km
          como si fueran para él. */}
      {aviso ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#fff8e6', borderWidth: 1, borderColor: '#f5e7c4', borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <Ic d="pin" size={17} color="#b8860b" />
          <Text style={{ flex: 1, fontSize: 12.5, color: '#7a5e14', lineHeight: 18 }}>{aviso}</Text>
        </View>
      ) : null}
      {buscado ? <Text style={{ fontWeight: '700', fontSize: 15, color: INK, marginBottom: 10 }}>Beneficios en «{buscado}»</Text> : null}
      {/* Banner "mostrá tu carnet" */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: BRAND, borderRadius: 18, padding: 16, marginBottom: 18 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, overflow: 'hidden', backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}><Ic d="tag" size={22} color={INK} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontFamily: FH, fontSize: 15, color: '#fff' }}>Mostrá tu carnet y ahorrá</Text>
          <Text style={{ fontSize: 12, color: colors.violet[300] }}>Presentá el carnet digital en cada local</Text>
        </View>
      </View>
      {list.length === 0 ? (
        <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 26, alignItems: 'center' }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ic d="tag" size={22} />
          </View>
          <Text style={{ fontWeight: '600', fontSize: 14.5, color: INK }}>{buscado ? `Sin beneficios para «${buscado}»` : 'Todavía no hay beneficios activos'}</Text>
          <Text style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 4, lineHeight: 19 }}>{buscado ? 'Probá con otra zona o rubro.' : 'El club los va cargando a medida que suma comercios a la red.'}</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {list.map((b) => (
            <TouchableOpacity key={b.id} onPress={() => setSelId(b.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.violet[200], alignItems: 'center', justifyContent: 'center' }}><Ic d={b.icon} size={20} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>{b.name}</Text>
                <Text style={{ fontSize: 12, color: colors.violet[400] }}>{b.cat}{b.zone ? ` · ${b.zone}` : ''}{b.km != null ? ` · ${b.km} km` : ''}</Text>
              </View>
              <View style={{ backgroundColor: LIME, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 12 }}><Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>{b.disc}</Text></View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
    {sel && <BeneficioFicha b={sel} onClose={() => setSelId(null)} onCarnet={() => { setSelId(null); go('carnet'); }} />}
    </View>
  );
}

/* ── Hoja "Más" ────────────────────────────────────────────────── */
function MasSheet({ onClose, onGo, pago, onPlan }: { onClose: () => void; onGo: (t: Screen) => void; pago: boolean; onPlan: () => void }) {
  const rows: { t: string; s: string; icon: IconName; fill?: boolean; to?: Screen; accion?: () => void }[] = [
    { t: 'Mi perfil', s: 'Datos, plan y facturación', icon: 'person', to: 'perfil' },
    { t: 'Mis mascotas', s: 'Datos y carnet de tus peludos', icon: 'paw', fill: true, to: 'mismascotas' },
    { t: 'Mis guardados', s: 'Prestadores que guardaste', icon: 'heart', fill: true, to: 'guardados' },
    { t: 'Mi negocio', s: 'Publicá y gestioná tus servicios', icon: 'house', to: 'minegocio' },
    // Los reintegros son del que paga. Para el gratuito, en su lugar va la
    // invitación: es un menú al que se entra a propósito, no una pestaña que
    // insiste sola.
    ...(pago
      ? [{ t: 'Mis reintegros', s: 'Pedidos y estado de cada uno', icon: 'wallet' as IconName, to: 'reintegros' as Screen }]
      : [{ t: 'Sumate a un plan', s: INVITACION_PLAN.bajada, icon: 'tag' as IconName, accion: onPlan }]),
  ];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(33,30,51,0.5)' }} />
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.violet[200], alignSelf: 'center', marginBottom: 14 }} />
        <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK, marginBottom: 14 }}>Más</Text>
        <View style={{ gap: 12 }}>
          {rows.map((r) => (
            <TouchableOpacity key={r.t} onPress={r.accion ?? (() => r.to && onGo(r.to))} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
                <Ic d={r.icon} size={20} color={BRAND} fill={r.fill} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>{r.t}</Text>
                <Text style={{ fontSize: 12.5, color: MUTED }}>{r.s}</Text>
              </View>
              <Text style={{ color: colors.violet[300], fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ── Sub-pantalla: Mi perfil ───────────────────────────────────── */
/**
 * Mi perfil.
 *
 * Era solo lectura: mostraba los datos y dejaba cerrar sesión, nada más. La
 * webapp ya permitía editar los datos, guardar la cuenta donde se cobran los
 * reintegros, cambiar de plan y darse de baja, así que en mobile esas cuatro
 * cosas simplemente no existían. No era que "decía guardado y no guardaba":
 * faltaban.
 */
function Perfil({ profile, pagos, go, reload, pago, onPlan }: { profile: Profile | null; pagos: PagoVM[]; go: (t: Screen) => void; reload: () => void; pago: boolean; onPlan: () => void }) {
  const [editando, setEditando] = useState(false);
  const [pagosOpen, setPagosOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState({
    nombre: '', dni: '', dom: '', localidad: '', provincia: '', tel: '',
    bancoTitular: '', bancoCuit: '', bancoCbu: '',
  });

  /** Se carga al abrir la edición y no en el render: los "—" del display no son
   *  datos, y guardarlos los convertiría en el valor real. */
  const abrirEdicion = () => {
    if (!profile) return;
    const real = (v: string) => (v === '—' ? '' : v);
    setDatos({
      nombre: profile.fullName, dni: real(profile.dni), dom: real(profile.address),
      localidad: real(profile.city), provincia: real(profile.province), tel: real(profile.phone),
      bancoTitular: profile.banco.holder ?? '', bancoCuit: profile.banco.cuit ?? '', bancoCbu: profile.banco.cbu ?? '',
    });
    setError('');
    setEditando(true);
  };

  const guardar = async () => {
    if (!profile) return;
    if (!datos.nombre.trim()) { setError('El nombre no puede quedar vacío.'); return; }
    setBusy(true); setError('');
    const { error: e, data } = await supabase.from('profiles').update({
      full_name: datos.nombre.trim(),
      dni: datos.dni.trim() || null,
      address: datos.dom.trim() || null,
      city: datos.localidad.trim() || null,
      province: datos.provincia.trim() || null,
      phone: datos.tel.trim() || null,
      bank_holder: datos.bancoTitular.trim() || null,
      bank_cuit: datos.bancoCuit.trim() || null,
      bank_cbu: datos.bancoCbu.replace(/\D/g, '') || null,
    }).eq('id', profile.id).select('id');
    if (e || !data?.length) { setError('No pudimos guardar los cambios. Probá de nuevo.'); setBusy(false); return; }
    /* Si se mudó, el mapa se muda con él: sin esto las coordenadas quedan en la
       dirección anterior y la pantalla le muestra prestadores cerca de donde ya no
       vive. Solo cuando el domicilio cambió, y sin esperar la respuesta. */
    if (datos.dom.trim() !== (profile.address === '—' ? '' : profile.address)
      || datos.localidad.trim() !== (profile.city === '—' ? '' : profile.city)
      || datos.provincia.trim() !== (profile.province === '—' ? '' : profile.province)) {
      void recalcularUbicacion();
    }
    setEditando(false);
    await reload();
    setBusy(false);
  };


  const darseDeBaja = () => {
    if (!profile) return;
    Alert.alert('Darte de baja', 'Perdés el acceso a los descuentos y a los reintegros. Si tenías débito automático se cancela ahora, así que no se te cobra más. Tus datos y tu historial quedan guardados.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Darme de baja',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          /*
           * El débito se corta PRIMERO, y si no se puede no se da de baja nada.
           *
           * Antes esto solo escribía `status: 'baja'` y mandaba el mail — que dice
           * "No te vamos a cobrar más"— mientras Mercado Pago seguía debitando
           * todos los meses, sin ningún error a la vista. Marcar primero y fallar
           * después deja al socio sin club Y pagando, que es peor que no hacer
           * nada. El 409 no es un error: es "no tenés suscripción", lo normal en
           * el socio gratuito y en el que paga por transferencia.
           */
          const { data: ses } = await supabase.auth.getSession();
          const token = ses.session?.access_token;
          if (!token) { Alert.alert('Se cerró tu sesión', 'Volvé a entrar y probá de nuevo.'); setBusy(false); return; }
          const resBaja = await fetch(`${SITIO}/api/suscripcion/baja`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          if (!resBaja.ok && resBaja.status !== 409) {
            const d = await resBaja.json().catch(() => ({}));
            Alert.alert('No pudimos darte de baja', d.error ?? 'No pudimos cortar tu débito, así que no dimos de baja la membresía: si la diéramos, te seguirían cobrando. Probá de nuevo en un rato.');
            setBusy(false);
            return;
          }
          const { error: e } = await supabase.from('profiles').update({ status: 'baja' }).eq('id', profile.id);
          if (e) { Alert.alert('No pudimos darte de baja', 'Escribinos por WhatsApp y lo resolvemos.'); setBusy(false); return; }
          // El mail va ANTES de cerrar la sesión: el aviso viaja con el token, y
          // después del signOut ya no hay con qué autenticarlo.
          await avisar('baja');
          await olvidarDispositivo();
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  /**
   * Eliminar la cuenta. NO es darse de baja, y la confirmación insiste con eso:
   * la baja deja los datos y se revierte escribiéndole al club; esto los borra.
   *
   * Existe porque Google Play lo exige para publicar (una app que deja crear
   * cuenta tiene que dejar borrarla desde adentro), y el derecho de supresión de
   * la Ley 25.326 ya lo pedía.
   *
   * Van DOS confirmaciones y no un campo para escribir "BORRAR" como en la web:
   * `Alert.prompt` existe solo en iOS, y una hoja con TextInput adentro de este
   * ScrollView se posiciona contra el contenido que scrollea, no contra la
   * pantalla. Dos pasos con textos distintos es el patrón nativo para esto.
   */
  const eliminarCuenta = () => {
    if (!profile) return;
    Alert.alert(
      'Eliminar tu cuenta',
      'Se borran para siempre tus mascotas con sus vacunas y fotos, tus reintegros, tus publicaciones y tu negocio.\n\nSi lo que querés es dejar de pagar y conservar tu historial, usá "Darme de baja del club": eso sí se puede revertir.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', style: 'destructive', onPress: confirmarEliminacion },
      ],
    );
  };

  const confirmarEliminacion = () => {
    Alert.alert(
      'No hay vuelta atrás',
      'Tu cuenta y todo su contenido se borran ahora. Si tenías débito automático, se cancela en el mismo paso.',
      [
        { text: 'No, volver', style: 'cancel' },
        { text: 'Sí, eliminar para siempre', style: 'destructive', onPress: borrarCuenta },
      ],
    );
  };

  const borrarCuenta = async () => {
    if (!profile) return;
    setBusy(true);
    const { data: ses } = await supabase.auth.getSession();
    const token = ses.session?.access_token;
    if (!token) { Alert.alert('Se cerró tu sesión', 'Volvé a entrar y probá de nuevo.'); setBusy(false); return; }
    try {
      const res = await fetch(`${SITIO}/api/socios/borrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberId: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        // El error se muestra tal cual viene: el del débito que no se pudo
        // cancelar explica por qué NO se borró nada, y resumirlo lo perdería.
        Alert.alert('No pudimos borrar tu cuenta', data.error ?? 'Probá de nuevo en un rato.');
        setBusy(false);
        return;
      }
      /* No hace falta olvidarDispositivo(): `push_tokens.member_id` cascadea al
         borrar el perfil, así que el token ya no existe. Llamarlo acá sería pedir
         un DELETE de una fila que no está, con una sesión que está por morir. */
      await supabase.auth.signOut();
    } catch {
      Alert.alert('No pudimos borrar tu cuenta', 'Revisá la conexión y probá de nuevo.');
      setBusy(false);
    }
  };

  const dato = (k: string, v: string) => (
    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.violet[200] }}>
      <Text style={{ fontSize: 13, color: MUTED }}>{k}</Text><Text style={{ fontSize: 13, fontWeight: '600' }}>{v}</Text>
    </View>
  );
  const campo = (label: string, valor: string, set: (v: string) => void, extra: object = {}) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 12, color: MUTED, marginBottom: 5 }}>{label}</Text>
      <TextInput value={valor} onChangeText={(t) => { set(t); setError(''); }} placeholderTextColor={colors.violet[400]}
        style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: INK, backgroundColor: '#fff' }}
        {...extra} />
    </View>
  );
  if (!profile) return <ScrollView contentContainerStyle={styles.screen}><H1>Mi perfil</H1></ScrollView>;
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <H1>Mi perfil</H1>
      <View style={{ height: 12 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: FH, fontWeight: '800', fontSize: 24 }}>{profile.firstName.charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 20, color: INK }}>{profile.fullName}</Text>
          {/* `memberNo` ya viene con el "#" o con un guion si la cuenta no es de
              socio, así que no se prefija "Socio" sobre un guion. */}
          <Text style={{ fontSize: 13, color: MUTED }}>
            {profile.memberNo === '—' ? '' : `Socio ${profile.memberNo} · `}{etiquetaPlan(profile.planName, profile.debePagar)}
          </Text>
        </View>
      </View>
      <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8 }}>Membresía</Text>
      {/* Ojo con la segunda línea: decía "Cuota mensual al día" escrito a mano, sin
          mirar ningún dato. Era falso para el socio gratuito y para el que tiene la
          cuota vencida — con el muro puesto no se notaba, y sin muro queda una
          mentira en pantalla. Ahora sale de `debePagar`. */}
      {pago ? (
        <View style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 14, padding: 15, marginBottom: 12 }}>
          <Text style={{ fontWeight: '700', fontSize: 14 }}>Plan {profile.planName}{profile.addonOdonto ? ' + odontológica' : ''} · {money(profile.planPrice)}/mes</Text>
          <Text style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>Cuota al día{profile.cuotaHasta ? ` hasta el ${fmtFechaCorta(profile.cuotaHasta)}` : ''}</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onPlan}
          style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 14, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 14 }}>Plan gratuito</Text>
            <Text style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{INVITACION_PLAN.titulo}: {INVITACION_PLAN.bajada.toLowerCase()}</Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: BRAND }}>Ver planes</Text>
        </TouchableOpacity>
      )}
      {/*
        * El historial de cuotas.
        *
        * Va para todos, incluido el gratuito: si alguna vez pagó, tiene derecho a ver
        * qué le cobraron. La lista se abre en el lugar en vez de en una pantalla nueva,
        * como "Editar datos": son pocas filas y no vale un viaje de navegación.
        *
        * Los rechazos se muestran igual que los cobros: cuando a alguien le rebota el
        * débito, esa fila es la explicación de por qué se le cortó el acceso.
        */}
      <TouchableOpacity onPress={() => setPagosOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, padding: 15, marginBottom: pagosOpen ? 10 : 18 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d="wallet" size={20} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 14 }}>Mis pagos</Text>
          <Text style={{ fontSize: 12.5, color: MUTED }}>
            {pagos.length === 0 ? 'Todavía no hay cuotas cobradas' : `Último: ${money(pagos[0]!.monto)} · ${pagos[0]!.fecha}`}
          </Text>
        </View>
        <Text style={{ color: colors.violet[300], fontSize: 18 }}>{pagosOpen ? '⌃' : '›'}</Text>
      </TouchableOpacity>
      {pagosOpen ? (
        <View style={{ marginBottom: 18, gap: 8 }}>
          {pagos.length === 0 ? (
            <Text style={{ fontSize: 13, color: MUTED, lineHeight: 19 }}>Cuando pagues la primera cuota, aparece acá con la fecha y hasta cuándo llega.</Text>
          ) : pagos.map((p) => {
            const est = PAGO_ESTADO[p.estado];
            const tono = est.tono === 'ok'
              ? { bg: '#e2f5ea', fg: '#2f8f5b' }
              : est.tono === 'alerta' ? { bg: '#fbe8ef', fg: '#c14d7a' } : { bg: colors.violet[100], fg: BRAND };
            return (
              <View key={p.id} style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, padding: 13 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, flex: 1, color: INK }}>{money(p.monto)}</Text>
                  <View style={{ backgroundColor: tono.bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 }}>
                    <Text style={{ color: tono.fg, fontWeight: '700', fontSize: 11 }}>{est.texto}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12.5, color: MUTED }}>{p.fecha} · {PAGO_MEDIO[p.medio]}{p.plan ? ` · Plan ${p.plan}` : ''}</Text>
                {/* Solo los acreditados llevan la cuota a algún lado: en uno rechazado,
                    "cubre hasta" prometería un mes que no entró. */}
                {p.cubreHasta && p.estado === 'aprobado' ? (
                  <Text style={{ fontSize: 12.5, color: BRAND, fontWeight: '600', marginTop: 2 }}>Cuota paga hasta el {p.cubreHasta}</Text>
                ) : null}
                {p.detalle ? <Text style={{ fontSize: 12, color: colors.violet[400], marginTop: 2 }}>{p.detalle}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {/* Los reintegros son del que paga: sin eso la fila promete una pantalla que
          no existe. */}
      {pago ? (
        <TouchableOpacity onPress={() => go('reintegros')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, padding: 15, marginBottom: 18 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d="wallet" size={20} /></View>
          <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 14 }}>Reintegros</Text><Text style={{ fontSize: 12.5, color: MUTED }}>Seguí tus pedidos</Text></View>
          <Text style={{ color: colors.violet[300], fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      ) : <View style={{ height: 6 }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontWeight: '700', fontSize: 15 }}>Datos personales</Text>
        <TouchableOpacity onPress={() => (editando ? setEditando(false) : abrirEdicion())}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: BRAND }}>{editando ? 'Cancelar' : 'Editar'}</Text>
        </TouchableOpacity>
      </View>

      {editando ? (
        <View style={{ marginBottom: 20 }}>
          {campo('Apellido y nombre', datos.nombre, (v) => setDatos({ ...datos, nombre: v }))}
          {campo('DNI', datos.dni, (v) => setDatos({ ...datos, dni: v }), { keyboardType: 'numeric' })}
          {/* El mismo campo del alta. Importa acá porque este formulario es el que
              puede DESHACER lo que el alta resolvió bien: alguien escribía "bs as" y
              el mapa se perdía. */}
          {/* Mismo orden que el alta: la provincia y la localidad son las pistas con
              las que se busca la calle, así que van antes. El selector reemplaza al
              texto libre, que era con lo que se podía deshacer lo que el alta resolvió. */}
          <Selector
            label="Provincia" valor={datos.provincia} opciones={PROVINCIAS}
            placeholder="Elegí una provincia" onCambio={(v) => setDatos({ ...datos, provincia: v })}
          />
          <CampoZona
            label="Localidad" valor={datos.localidad}
            provincia={datos.provincia || undefined}
            onCambio={(v) => { setDatos({ ...datos, localidad: v }); setError(''); }}
            onElegir={(z) => setDatos({ ...datos, localidad: z.localidad, provincia: z.provincia })}
            placeholder="Ej. Palermo"
          />
          <CampoDomicilio
            valor={datos.dom}
            provincia={datos.provincia || undefined}
            localidad={datos.localidad || undefined}
            onCambio={(v) => { setDatos({ ...datos, dom: v }); setError(''); }}
            onElegir={(l) => setDatos({ ...datos, dom: l.domicilio, localidad: l.localidad, provincia: l.provincia })}
          />
          {campo('Teléfono', datos.tel, (v) => setDatos({ ...datos, tel: v }), { keyboardType: 'phone-pad' })}

          {/* La cuenta donde el club te transfiere los reintegros. Va acá y no en
              cada solicitud: antes se pedía una y otra vez en cada pedido. */}
          <Text style={{ fontWeight: '700', fontSize: 14, marginTop: 10, marginBottom: 2 }}>Dónde cobrás tus reintegros</Text>
          <Text style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 17 }}>El club transfiere a esta cuenta. Si la completás acá, no te la volvemos a pedir en cada solicitud.</Text>
          {campo('Titular de la cuenta', datos.bancoTitular, (v) => setDatos({ ...datos, bancoTitular: v }))}
          {campo('CUIT / CUIL', datos.bancoCuit, (v) => setDatos({ ...datos, bancoCuit: v }), { keyboardType: 'numeric' })}
          {campo('CBU o CVU', datos.bancoCbu, (v) => setDatos({ ...datos, bancoCbu: v }), { keyboardType: 'numeric' })}
          {datos.bancoCbu.replace(/\D/g, '').length > 0 && !cbuValido(datos.bancoCbu) ? (
            <Text style={{ fontSize: 12.5, color: '#b0483f', fontWeight: '700', marginBottom: 8 }}>
              El CBU/CVU tiene 22 dígitos y pusiste {datos.bancoCbu.replace(/\D/g, '').length}.
            </Text>
          ) : null}

          {error ? <Text style={{ fontSize: 12.5, color: '#b0483f', fontWeight: '700', marginBottom: 8 }}>{error}</Text> : null}
          <TouchableOpacity disabled={busy} onPress={guardar} style={{ backgroundColor: LIME, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: INK, fontWeight: '700', fontSize: 14.5 }}>{busy ? 'Guardando…' : 'Guardar cambios'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ marginBottom: 20 }}>
          {dato('DNI', profile.dni)}{dato('Domicilio', profile.address)}{dato('Localidad', profile.city)}{dato('Provincia', profile.province)}{dato('Teléfono', profile.phone)}{dato('Email', profile.email)}
          {/* "Sin cargar" sonaba a que le faltaba hacer algo. No le falta: la
              cuenta se pide cuando carga el primer reintegro. */}
          {dato('Cuenta para reintegros', profile.banco.cbu ? `${profile.banco.holder ?? 'A tu nombre'} · ····${profile.banco.cbu.slice(-4)}` : profile.banco.alias ? `Alias ${profile.banco.alias}` : 'Te la pedimos cuando cargues tu primer reintegro')}
          {dato('Medio de pago', profile.tarjeta ?? 'Sin configurar')}
        </View>
      )}

      {/*
        * La cuota y la baja del débito automático.
        *
        * Estaba solo en la webapp: el muro de la app cobraba pero no había dónde
        * cortar, y encima su propio texto dice que se puede dar de baja cuando
        * quiera. Con débito automático la baja tiene que ser tan fácil como el
        * alta y estar donde el socio se suscribió, no en un mail al club.
        *
        * Se corta el cobro futuro, no el mes ya pagado: sigue entrando hasta que
        * se le vence. Cobrarle un mes y sacárselo el mismo día sería quedarse con
        * la plata.
        */}
      <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8 }}>Tu cuota</Text>
      <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 }}>
        <Text style={{ fontSize: 13.5, color: INK, fontWeight: '600' }}>
          {profile.suscripcion === 'authorized'
            ? `Débito automático activo · ${money(profile.planPrice)}/mes`
            : profile.cuotaHasta && !profile.debePagar
              ? `Paga hasta el ${fmtFechaCorta(profile.cuotaHasta)} · sin débito automático`
              : profile.cuotaHasta
                ? `Se te venció el ${fmtFechaCorta(profile.cuotaHasta)}`
                : 'Estás en el plan gratuito'}
        </Text>
        {profile.suscripcion === 'authorized' && (
          <TouchableOpacity
            onPress={() => Alert.alert(
              '¿Dar de baja el débito?',
              'No se te va a cobrar más. Podés seguir usando el club hasta que se te venza el mes que ya pagaste.',
              [
                { text: 'No, dejalo', style: 'cancel' },
                {
                  text: 'Dar de baja',
                  style: 'destructive',
                  onPress: async () => {
                    const { data: ses } = await supabase.auth.getSession();
                    const token = ses.session?.access_token;
                    if (!token) { Alert.alert('Se cerró tu sesión', 'Volvé a entrar y probá de nuevo.'); return; }
                    const res = await fetch(`${SITIO}/api/suscripcion/baja`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                    const data = await res.json();
                    Alert.alert(
                      res.ok ? 'Listo' : 'No pudimos darlo de baja',
                      res.ok
                        ? `No te vamos a cobrar más.${data.hasta ? ` Podés usar el club hasta el ${fmtFechaCorta(data.hasta)}.` : ''}`
                        : (data.error ?? 'Probá de nuevo o escribinos por WhatsApp.'),
                    );
                    reload();
                  },
                },
              ],
            )}
            style={{ marginTop: 10 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#b03a3a' }}>Dar de baja el débito</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Un enlace, no la lista de planes.
          Antes cada plan era un botón que escribía `profiles.plan_id` derecho
          desde el celular: movía el plan sin recalcular la cuota ni cobrar la
          diferencia, así que se pasaba de AMIGO a VIP gratis. La webapp ya lo
          había sacado; mobile se quedó con la versión vieja.
          Tampoco vuelve como lista abriendo la hoja: la hoja arranca con el plan
          ACTUAL seleccionado, así que tocar "VIP" y ver seleccionado "AMIGO"
          promete algo que no cumple. Un enlace no promete nada y lleva al mismo
          lugar, que es el único que sabe cobrar. */}
      <TouchableOpacity onPress={onPlan} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>Cambiar de plan</Text>
          <Text style={{ fontSize: 12.5, color: MUTED }}>Ahora estás en {profile.planName}</Text>
        </View>
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: BRAND }}>Ver planes</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => supabase.auth.signOut()} style={{ backgroundColor: colors.violet[100], borderRadius: 12, padding: 14, alignItems: 'center' }}><Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>Cerrar sesión</Text></TouchableOpacity>
      <TouchableOpacity disabled={busy} onPress={darseDeBaja} style={{ paddingVertical: 16, alignItems: 'center' }}>
        <Text style={{ color: '#b0483f', fontWeight: '700', fontSize: 13.5 }}>Darme de baja del club</Text>
      </TouchableOpacity>
      {/* Último y más apagado que la baja, a propósito: son dos cosas que se
          piden con las mismas palabras y la de arriba es la que casi siempre se
          quiere. El que llega hasta acá es porque busca borrar. */}
      <TouchableOpacity disabled={busy} onPress={eliminarCuenta} style={{ paddingBottom: 20, alignItems: 'center' }}>
        <Text style={{ color: '#963c34', fontWeight: '600', fontSize: 12.5, textDecorationLine: 'underline' }}>Eliminar mi cuenta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ── Sub-pantalla: Mis mascotas ────────────────────────────────── */
const PET_EVENT_IC: Record<PetEvento['kind'], IconName> = { vacuna: 'shield', estudio: 'hospital', reintegro: 'wallet' };
const PET_EVENT_TONE: Record<PetEvento['kind'], { bg: string; fg: string }> = {
  vacuna: { bg: '#eef7d6', fg: '#5f7d10' },
  estudio: { bg: colors.violet[100], fg: BRAND },
  reintegro: { bg: '#e2f5ea', fg: '#2f8f5b' },
};

function MisMascotas({ pets, reintegros, userId, reload, go, setPetIdx }: { pets: Pet[]; reintegros: ReintVM[]; userId: string; reload: () => void; go: (t: Screen) => void; setPetIdx: (i: number) => void }) {
  const [selId, setSelId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [tipo, setTipo] = useState<'perro' | 'gato'>('perro');
  // Los mismos datos que pide el alta. Faltaban: se cargaba una mascota nueva con
  // nombre y raza nada más, y su carnet quedaba a medias respecto de la primera.
  const [sexo, setSexo] = useState<'macho' | 'hembra'>('macho');
  const [castrado, setCastrado] = useState(false);
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [chip, setChip] = useState('');
  const [vet, setVet] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);
  /** Id de la mascota que se está editando: reusa el mismo formulario. */
  const [editId, setEditId] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  /**
   * Al editar se prefijan los valores CRUDOS de la base y no los de la tarjeta:
   * ahí `breed` viene armado ("Mestizo · 3 años · 18 kg") y `microchip` dice
   * "Sin chip" cuando está vacío. Guardar eso los convertiría en datos reales.
   */
  useEffect(() => {
    if (!editId) return;
    let vigente = true;
    (async () => {
      const { data } = await supabase
        .from('pets')
        .select('name, type, breed, sex, neutered, age_years, weight_kg, microchip, vet_name, photo_url')
        .eq('id', editId)
        .single();
      if (!vigente || !data) return;
      setName(data.name ?? '');
      setTipo(data.type === 'gato' ? 'gato' : 'perro');
      setBreed(data.breed ?? '');
      setSexo(data.sex === 'hembra' ? 'hembra' : 'macho');
      setCastrado(!!data.neutered);
      setEdad(data.age_years != null ? String(data.age_years) : '');
      setPeso(data.weight_kg != null ? String(data.weight_kg) : '');
      setChip(data.microchip ?? '');
      setVet(data.vet_name ?? '');
      setFotoUrl(data.photo_url?.startsWith('http') ? data.photo_url : null);
      setSelId(null);
      setAdding(true);
    })();
    return () => { vigente = false; };
  }, [editId]);

  /**
   * Borra una mascota. Avisa qué se lleva: `vaccinations.pet_id` es ON DELETE
   * CASCADE, así que se va el carnet entero. Los reintegros y la declaración
   * jurada son ON DELETE SET NULL y quedan: son plata y un registro firmado.
   */
  const borrarMascota = (p: Pet) => {
    const n = p.vaccines.length;
    Alert.alert(
      `Borrar a ${p.name}`,
      `${n > 0 ? `Se borra también su carnet, con ${n} vacuna${n === 1 ? '' : 's'}. ` : ''}Los reintegros que pediste quedan. No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            setBorrando(true);
            const { error, data } = await supabase.from('pets').delete().eq('id', p.id).select('id');
            if (error || !data?.length) { Alert.alert('No pudimos borrar la mascota', 'Probá de nuevo.'); setBorrando(false); return; }
            setSelId(null);
            setPetIdx(0);
            await reload();
            setBorrando(false);
          },
        },
      ]
    );
  };
  const [busy, setBusy] = useState(false);
  // Declaración jurada de la mascota nueva: las preguntas son por mascota.
  const [health, setHealth] = useState<Record<number, string>>({});
  const [sanit, setSanit] = useState<Record<number, string>>({});
  const [firma, setFirma] = useState('');
  const [addError, setAddError] = useState('');

  const sel = pets.find((p) => p.id === selId);
  if (sel) {
    const idx = pets.findIndex((p) => p.id === selId);
    const historial = buildPetHistory({
      vaccines: sel.vaccines.map((v) => ({ id: v.id, name: v.name, kind: v.kind, status: v.status, appliedOn: v.appliedOn, dueOn: v.dueOn })),
      reintegros: reintegros.filter((r) => r.pet === sel.name).map((r) => ({ id: r.id, providerName: r.place, concept: r.concept, refund: r.refund, status: r.estadoRaw, date: r.fecha })),
    });
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <BackLink label="Mis mascotas" onPress={() => setSelId(null)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          {/* Tocar la foto la cambia. Antes no había forma de cambiarla en mobile:
              la que quedaba del alta era la única para siempre. */}
          <TouchableOpacity
            disabled={fotoBusy}
            onPress={async () => {
              setFotoBusy(true); setAddError('');
              const r = await elegirYSubirFoto(userId, 'mascota-');
              if ('url' in r) {
                const { error } = await supabase.from('pets').update({ photo_url: r.url }).eq('id', sel.id);
                if (error) setAddError('Subimos la foto pero no pudimos guardarla. Probá de nuevo.');
                else await reload();
              } else if ('error' in r) setAddError(r.error);
              setFotoBusy(false);
            }}
          >
            <Image source={petImg(sel.photo)} style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: colors.violet[100], opacity: fotoBusy ? 0.5 : 1 }} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 21, color: INK }}>{sel.name}</Text>
            <Text style={{ fontSize: 13, color: '#8781a0' }}>{sel.breed}</Text>
            <Text style={{ fontSize: 12, color: '#a29dba', marginTop: 2 }}>Chip {sel.microchip} · Castrado: {sel.castrado}</Text>
            <Text style={{ fontSize: 11.5, color: BRAND, fontWeight: '700', marginTop: 4 }}>{fotoBusy ? 'Subiendo la foto…' : 'Tocá la foto para cambiarla'}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => { if (idx >= 0) setPetIdx(idx); go('carnet'); }} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ver carnet digital</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          <TouchableOpacity onPress={() => setEditId(sel.id)} style={{ flex: 1, borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff' }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: BRAND }}>Editar datos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => borrarMascota(sel)} disabled={borrando} style={{ flex: 1, borderWidth: 1.5, borderColor: '#e8cbc7', borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff', opacity: borrando ? 0.6 : 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: '#b0483f' }}>{borrando ? 'Borrando…' : 'Borrar'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontWeight: '700', fontSize: 15, color: INK, marginBottom: 10 }}>Historial</Text>
        {historial.length === 0 ? (
          <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 26, alignItems: 'center' }}>
            <Text style={{ fontWeight: '600', fontSize: 14.5, color: INK }}>Todavía sin movimientos</Text>
            <Text style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 4, lineHeight: 19 }}>Cuando cargues vacunas o pidas un reintegro de {sel.name} van a aparecer acá.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {historial.map((e) => {
              const tone = PET_EVENT_TONE[e.kind];
              return (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 11, overflow: 'hidden', backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ic d={PET_EVENT_IC[e.kind]} size={19} color={tone.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>{e.title}</Text>
                      <View style={{ backgroundColor: tone.bg, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tone.fg }}>{e.tag}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#a29dba' }}>{e.sub}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#a29dba' }}>{fmtFechaCorta(e.date)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  }

  /**
   * Las preguntas de salud son POR MASCOTA, así que agregar una sin declararla
   * dejaba sumar una mascota enferma después del alta. Va por la función
   * `agregar_mascota`, que crea la mascota y su declaración en la misma
   * transacción: el socio ya no puede insertar en `pets` directamente.
   */
  const limpiarForm = () => {
    setName(''); setBreed(''); setTipo('perro'); setSexo('macho'); setCastrado(false);
    setEdad(''); setPeso(''); setChip(''); setVet(''); setFotoUrl(null);
    setHealth({}); setSanit({}); setFirma(''); setAdding(false); setEditId(null);
  };

  const add = async () => {
    if (!name.trim()) { setAddError('Ponele un nombre a la mascota.'); return; }

    // Editando no se vuelve a pedir la declaración: ya está firmada y no se
    // reescribe (la tabla no tiene política de update, a propósito).
    if (editId) {
      setBusy(true); setAddError('');
      const { error, data } = await supabase.from('pets').update({
        name: name.trim(), type: tipo, breed: breed.trim() || null, sex: sexo, neutered: castrado,
        age_years: numero(edad), weight_kg: numero(peso), microchip: chip.trim() || null, vet_name: vet.trim() || null,
        ...(fotoUrl ? { photo_url: fotoUrl } : {}),
      }).eq('id', editId).select('id');
      if (error || !data?.length) { setAddError('No pudimos guardar los cambios. Probá de nuevo.'); setBusy(false); return; }
      limpiarForm();
      await reload();
      setBusy(false);
      return;
    }

    const declaracion = armarDeclaracion({ health, sanit, firma });
    if (!declaracion) { setAddError('Completá y firmá la declaración jurada de salud.'); return; }
    setBusy(true); setAddError('');
    const { error } = await supabase.rpc('agregar_mascota', {
      p_name: name, p_type: tipo, p_breed: breed, p_sex: sexo, p_neutered: castrado,
      p_age_years: numero(edad), p_weight_kg: numero(peso), p_microchip: chip, p_vet_name: vet, p_photo_url: fotoUrl,
      p_version: declaracion.version, p_answers: declaracion.answers,
      p_sanitary: declaracion.sanitary, p_signature: declaracion.signature,
    });
    if (error) { setAddError('No pudimos agregar la mascota. Probá de nuevo.'); setBusy(false); return; }
    limpiarForm();
    await reload();
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <H1>Mis mascotas</H1>
        <TouchableOpacity onPress={() => (adding ? limpiarForm() : setAdding(true))} style={{ backgroundColor: BRAND, borderRadius: 100, paddingVertical: 9, paddingHorizontal: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{adding ? 'Cancelar' : '+ Agregar mascota'}</Text>
        </TouchableOpacity>
      </View>
      {adding && (
        <View style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 18, padding: 16, marginBottom: 16, gap: 10 }}>
          {/* La foto, que en mobile no se podía cargar de ninguna manera. */}
          <TouchableOpacity
            disabled={fotoBusy}
            onPress={async () => {
              setFotoBusy(true); setAddError('');
              const r = await elegirYSubirFoto(userId, 'mascota-');
              if ('url' in r) setFotoUrl(r.url);
              else if ('error' in r) setAddError(r.error);
              setFotoBusy(false);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            {fotoUrl
              ? <Image source={{ uri: fotoUrl }} style={{ width: 64, height: 64, borderRadius: 16 }} />
              : (
                <View style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
                  <Ic d="paw" size={26} color={BRAND} fill />
                </View>
              )}
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: BRAND }}>
              {fotoBusy ? 'Subiendo…' : fotoUrl ? 'Cambiar la foto' : 'Agregar una foto'}
            </Text>
          </TouchableOpacity>
          <TextInput value={name} onChangeText={setName} placeholder="Nombre" placeholderTextColor={colors.violet[400]}
            style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
          <TextInput value={breed} onChangeText={setBreed} placeholder="Raza (opcional)" placeholderTextColor={colors.violet[400]}
            style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={edad} onChangeText={setEdad} placeholder="Edad (años)" placeholderTextColor={colors.violet[400]} keyboardType="numeric"
              style={{ flex: 1, borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
            <TextInput value={peso} onChangeText={setPeso} placeholder="Peso (kg)" placeholderTextColor={colors.violet[400]} keyboardType="numeric"
              style={{ flex: 1, borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
          </View>
          <TextInput value={chip} onChangeText={setChip} placeholder="Microchip (opcional)" placeholderTextColor={colors.violet[400]}
            style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
          <TextInput value={vet} onChangeText={setVet} placeholder="Veterinaria de cabecera (opcional)" placeholderTextColor={colors.violet[400]}
            style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
          <Text style={{ fontSize: 12, color: MUTED }}>Especie</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['perro', 'gato'] as const).map((t) => (
              <TouchableOpacity key={t} onPress={() => setTipo(t)} style={{ flex: 1, backgroundColor: tipo === t ? BRAND : '#fff', borderWidth: 1.5, borderColor: tipo === t ? BRAND : colors.violet[200], borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', fontSize: 13.5, color: tipo === t ? '#fff' : MUTED }}>{t === 'perro' ? 'Perro' : 'Gato'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: MUTED }}>Sexo</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([['macho', 'Macho'], ['hembra', 'Hembra']] as const).map(([v, l]) => (
              <TouchableOpacity key={v} onPress={() => setSexo(v)} style={{ flex: 1, backgroundColor: sexo === v ? BRAND : '#fff', borderWidth: 1.5, borderColor: sexo === v ? BRAND : colors.violet[200], borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', fontSize: 13.5, color: sexo === v ? '#fff' : MUTED }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: MUTED }}>¿Está castrada?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([[true, 'Sí'], [false, 'No']] as const).map(([v, l]) => (
              <TouchableOpacity key={l} onPress={() => setCastrado(v)} style={{ flex: 1, backgroundColor: castrado === v ? BRAND : '#fff', borderWidth: 1.5, borderColor: castrado === v ? BRAND : colors.violet[200], borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', fontSize: 13.5, color: castrado === v ? '#fff' : MUTED }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {editId ? null : (<><Text style={{ fontWeight: '700', fontSize: 14.5, color: INK, marginTop: 6 }}>Declaración jurada de salud</Text>
          <Text style={{ fontSize: 12, color: MUTED, lineHeight: 17 }}>
            Contestá las {HEALTH_Q.length} preguntas. Declarar una condición no te deja afuera del club: define qué cubre el plan.
          </Text>
          {HEALTH_Q.map((q, i) => (
            <View key={q} style={{ borderBottomWidth: 1, borderBottomColor: colors.violet[200], paddingBottom: 9 }}>
              <Text style={{ fontSize: 12.5, color: INK, lineHeight: 18, marginBottom: 7 }}>{q}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['Sí', 'No'] as const).map((r) => (
                  <TouchableOpacity key={r} onPress={() => { setHealth({ ...health, [i]: r }); setAddError(''); }}
                    style={{ flex: 1, backgroundColor: health[i] === r ? BRAND : '#fff', borderWidth: 1.5, borderColor: health[i] === r ? BRAND : colors.violet[200], borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ fontWeight: '700', fontSize: 12.5, color: health[i] === r ? '#fff' : MUTED }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <Text style={{ fontWeight: '700', fontSize: 14.5, color: INK, marginTop: 6 }}>Plan sanitario</Text>
          {SANITARIO_Q.map((q, i) => (
            <View key={q} style={{ borderBottomWidth: 1, borderBottomColor: colors.violet[200], paddingBottom: 9 }}>
              <Text style={{ fontSize: 12.5, color: INK, lineHeight: 18, marginBottom: 7 }}>{q}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['Sí', 'No'] as const).map((r) => (
                  <TouchableOpacity key={r} onPress={() => { setSanit({ ...sanit, [i]: r }); setAddError(''); }}
                    style={{ flex: 1, backgroundColor: sanit[i] === r ? BRAND : '#fff', borderWidth: 1.5, borderColor: sanit[i] === r ? BRAND : colors.violet[200], borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ fontWeight: '700', fontSize: 12.5, color: sanit[i] === r ? '#fff' : MUTED }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <Text style={{ fontSize: 12, color: MUTED, lineHeight: 17, marginTop: 6 }}>
            Escribí tu nombre completo tal cual figura en tu DNI. Equivale a tu firma según la Ley 25.506.
          </Text>
          <TextInput value={firma} onChangeText={(t) => { setFirma(t); setAddError(''); }} placeholder="Tu nombre y apellido" placeholderTextColor={colors.violet[400]}
            style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: 'Baloo2_700Bold', textAlign: 'center', color: INK, backgroundColor: '#fff' }} />

          </>)}
          {addError ? <Text style={{ fontSize: 12.5, color: '#b0483f', fontWeight: '700' }}>{addError}</Text> : null}
          <TouchableOpacity disabled={busy} onPress={add} style={{ backgroundColor: LIME, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: INK, fontWeight: '700', fontSize: 14.5 }}>{busy ? 'Guardando…' : editId ? 'Guardar cambios' : 'Firmar y agregar'}</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ gap: 12 }}>
        {pets.map((p) => {
          const alDia = p.next === 'Todo al día';
          return (
            <TouchableOpacity key={p.id} onPress={() => setSelId(p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 14 }}>
              <Image source={petImg(p.photo)} style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.violet[100] }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontFamily: FH, fontSize: 17, color: INK }}>{p.name}</Text>
                <Text style={{ fontSize: 12.5, color: MUTED, marginBottom: 6 }}>{p.age}</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {alDia
                    ? <View style={{ backgroundColor: colors.success.bg, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.success.fg }}>Carnet al día ✓</Text></View>
                    : <View style={{ backgroundColor: '#fbf3e2', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 10.5, fontWeight: '700', color: '#b8860b' }}>{p.next}</Text></View>}
                </View>
              </View>
              <Text style={{ color: colors.violet[300], fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          );
        })}
        {pets.length === 0 && !adding && (
          <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 13.5, color: MUTED, textAlign: 'center' }}>Todavía no cargaste ninguna mascota. Tocá "+ Agregar mascota" para empezar.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/* ── Sub-pantalla: Mis guardados (estado vacío) ────────────────── */
function Guardados({ providers, guardados, onAbrir }: { providers: ProviderVM[]; guardados: string[]; onAbrir: () => void }) {
  const list = providers.filter((p) => guardados.includes(p.id));
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <H1>Mis guardados</H1>
      <Sub>Los prestadores que marcaste con el corazón.</Sub>
      {list.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ic d="heart" size={32} color={colors.violet[400]} />
          </View>
          <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', paddingHorizontal: 30 }}>Todavía no guardaste prestadores. Tocá el corazón en Servicios para tenerlos a mano.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {list.map((p) => (
            <TouchableOpacity key={p.id} onPress={onAbrir} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 12 }}>
              <FotoPrestador p={p} lado={50} radio={15} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>{p.name}</Text>
                <Text style={{ fontSize: 12, color: colors.violet[400] }}>{p.category} · {p.zone}{p.km != null ? ` · ${p.km} km` : ''}</Text>
                <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{ratingLabel(p.rating, p.reviews) ? `★ ${ratingLabel(p.rating, p.reviews)} (${p.reviews})` : 'Sin reseñas'}</Text>
              </View>
              <Text style={{ color: colors.violet[300], fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/* ── Sub-pantalla: Prestar servicio ────────────────────────────── */
/** "Sumate como prestador", igual que el prototipo: el rubro se elige de una
 *  grilla con íconos. Antes el botón de Servicios no hacía nada. */
const RUBRO_IC: Record<string, IconName> = {
  Paseador: 'paw', Guardería: 'house', Adiestrador: 'idcard', 'Baño y estética': 'droplet', Cuidador: 'person',
  // Los dos que el tipo ya contemplaba y ninguna pantalla ofrecía.
  Veterinaria: 'hospital', Otros: 'store',
};

/* Ya no frena si el socio tiene uno: puede tener varios —un servicio y un comercio—,
   y el alta se cerraba con "Ya tenés un negocio". */
function Prestar({ userId, phone, onVolver, onNegocio, reload }: { userId: string; phone: string; onVolver: () => void; onNegocio: () => void; reload: () => void }) {
  const [rubro, setRubro] = useState<ProviderCategory>(RUBROS[0]!);
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState('');
  /** La dirección es opcional y es lo único que pone el negocio en el mapa. */
  const [direccion, setDireccion] = useState('');
  /* Instagram, sitio y tarifa: opcionales, pero se piden ACÁ y no solo al editar.
     Antes solo existían en "Editar datos" del negocio ya publicado, así que la ficha
     de todo prestador nuevo salía con dos filas y sin precio. */
  const [instagram, setInstagram] = useState('');
  const [sitio, setSitio] = useState('');
  const [precio, setPrecio] = useState('');
  const [unidad, setUnidad] = useState('');
  const [tel, setTel] = useState(phone === '—' ? '' : phone);
  const [about, setAbout] = useState('');
  /* Las dos imágenes: la webapp las pedía en su alta larga y la app no pedía
     ninguna, así que todo negocio dado de alta desde el teléfono nacía sin nada. Se
     suben al elegirlas y queda la URL; el insert las guarda con el resto. */
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [fotoBusy, setFotoBusy] = useState<'logo' | 'portada' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Svg width={34} height={34} viewBox="0 0 24 24"><Path d="M4 12l5 5L20 6" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </View>
        <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK, marginBottom: 8 }}>Solicitud enviada</Text>
        <Text style={{ color: MUTED, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 }}>El club va a validar los datos de tu negocio antes de publicarlo. Podés seguir el estado desde Mi negocio.</Text>
        <TouchableOpacity onPress={onNegocio} style={{ alignSelf: 'stretch', backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ir a Mi negocio</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onVolver} style={{ paddingVertical: 10 }}><Text style={{ color: '#8781a0', fontWeight: '600', fontSize: 14 }}>Volver a Servicios</Text></TouchableOpacity>
      </ScrollView>
    );
  }

  /** Elegir y subir una de las dos. Una sola función: se validan y se guardan igual,
   *  lo que cambia es dónde se ven. */
  const elegirImagen = async (cual: 'logo' | 'portada') => {
    setFotoBusy(cual); setError('');
    const r = await elegirYSubirFoto(userId, cual === 'logo' ? 'negocio-logo-' : 'negocio-');
    if ('url' in r) (cual === 'logo' ? setLogoUrl : setFotoUrl)(r.url);
    else if ('error' in r) setError(r.error);
    setFotoBusy(null);
  };

  const enviar = async () => {
    if (!nombre.trim()) { setError('Poné el nombre o la marca de tu servicio.'); return; }
    if (!zona.trim()) { setError('Poné la zona donde trabajás.'); return; }
    setBusy(true); setError('');
    const { data: alta, error: e } = await supabase.from('providers').insert({
      owner_id: userId, name: nombre.trim(), category: rubro, zone: zona.trim(),
      address: direccion.trim() || null,
      instagram: instagram.trim() || null, website: sitio.trim() || null,
      price: Number(precio.replace(/\D/g, '')) || null, price_unit: unidad.trim() || null,
      phone: tel.trim() || null, about: about.trim(), photo_url: fotoUrl, logo_url: logoUrl, status: 'pendiente',
    }).select('id').single();
    if (e) { setError('No pudimos enviar la solicitud. Probá de nuevo.'); setBusy(false); return; }
    if (alta?.id) void avisar('negocio-recibido', alta.id);
    // El pin en el mapa: lo resuelve el servidor y no se espera.
    if (alta?.id && direccion.trim()) void ubicarNegocio(alta.id);
    setBusy(false);
    setEnviado(true);
    await reload();
  };

  const input = { borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <TouchableOpacity onPress={onVolver} style={{ paddingVertical: 6, marginBottom: 6 }}><Text style={{ color: BRAND, fontWeight: '600', fontSize: 14 }}>← Servicios</Text></TouchableOpacity>
      <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK, marginBottom: 2 }}>Sumate como prestador</Text>
      <Text style={{ color: '#8781a0', fontSize: 14, marginBottom: 18 }}>Elegí tu rubro y contanos sobre tu servicio. El club valida los datos antes de publicarlo.</Text>

      <SheetLabel>¿Qué servicio ofrecés?</SheetLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 }}>
        {RUBROS.map((r) => {
          const activo = rubro === r;
          return (
            <View key={r} style={{ width: '50%', padding: 4 }}>
              <TouchableOpacity onPress={() => setRubro(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 13, borderWidth: 1.5, borderColor: activo ? BRAND : colors.violet[200], backgroundColor: activo ? colors.violet[100] : '#fff' }}>
                <Ic d={RUBRO_IC[r] ?? 'paw'} size={19} fill={r === 'Paseador'} />
                <Text style={{ fontWeight: '600', fontSize: 13.5, color: INK, flex: 1 }}>{r}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <SheetLabel>Nombre o empresa</SheetLabel>
      <TextInput value={nombre} onChangeText={(v) => { setNombre(v); setError(''); }} placeholder="Ej: Paseos Palermo / Lucas M." placeholderTextColor={colors.violet[400]} style={{ ...input, marginBottom: 12 }} />

      {/* La zona sale de la lista de localidades y barrios: el filtro de prestadores
          compara texto, así que "Palermo" y "Palermo, CABA" eran dos zonas distintas. */}
      <CampoZona valor={zona} onCambio={(v) => { setZona(v); setError(''); }} onElegir={(z) => { setZona(z.zona); setError(''); }} />
      <View style={{ marginBottom: 12 }}>
        <SheetLabel>WhatsApp</SheetLabel>
        <TextInput value={tel} onChangeText={setTel} placeholder="+54 11 ..." placeholderTextColor={colors.violet[400]} style={input} />
      </View>

      <CampoDomicilio
        label="Dirección (opcional)" valor={direccion} {...partirZona(zona)}
        onCambio={setDireccion} onElegir={(l) => setDireccion(l.domicilio)}
        ayuda="Si atendés en un local, ponela: es lo que te ubica en el mapa de los socios. Si trabajás a domicilio, dejala vacía y te encuentran por zona."
      />

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <SheetLabel>Instagram · opcional</SheetLabel>
          <TextInput value={instagram} onChangeText={setInstagram} placeholder="@tunegocio" placeholderTextColor={colors.violet[400]} autoCapitalize="none" style={input} />
        </View>
        <View style={{ flex: 1 }}>
          <SheetLabel>Sitio · opcional</SheetLabel>
          <TextInput value={sitio} onChangeText={setSitio} placeholder="tunegocio.com.ar" placeholderTextColor={colors.violet[400]} autoCapitalize="none" style={input} />
        </View>
      </View>

      <SheetLabel>Tarifa · opcional</SheetLabel>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextInput value={precio} onChangeText={setPrecio} keyboardType="numeric" placeholder="4500" placeholderTextColor={colors.violet[400]} style={{ ...input, flex: 1 }} />
        <TextInput value={unidad} onChangeText={setUnidad} placeholder="/paseo" placeholderTextColor={colors.violet[400]} style={{ ...input, flex: 1 }} />
      </View>
      <Text style={{ fontSize: 12, color: MUTED, marginTop: 6, marginBottom: 12, lineHeight: 17 }}>Si no la ponés, tu ficha no muestra precio (mejor eso que mostrar "$0"). Podés cargarla después.</Text>

      <SheetLabel>Contanos sobre tu servicio</SheetLabel>
      <TextInput value={about} onChangeText={setAbout} multiline numberOfLines={3} placeholder="Experiencia, disponibilidad, precios de referencia…" placeholderTextColor={colors.violet[400]} style={{ ...input, height: 90, textAlignVertical: 'top', marginBottom: 16 }} />

      {/* La foto de portada, igual que en la webapp. Se sube al elegirla —así el
          socio ve que entró— y recién el insert la guarda: si abandona el alta,
          quedó un archivo suelto en el bucket y ningún negocio a medio crear. */}
      {/* Las dos imágenes, con los nombres del prototipo. Cada caja tiene la forma de
          donde se va a ver: el logo cuadrado, la portada apaisada. */}
      <SheetLabel>Logo de la marca · opcional</SheetLabel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <TouchableOpacity
          disabled={!!fotoBusy}
          onPress={() => elegirImagen('logo')}
          style={{ width: 92, height: 92, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.violet[200], backgroundColor: '#fafaf9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Ic d="image" size={20} color={colors.violet[400]} />
          )}
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 12, color: MUTED, lineHeight: 17 }}>
          {fotoBusy === 'logo' ? 'Subiendo…' : 'Cuadrado. Es el redondel de tu ficha y el cuadradito del listado. Si no lo subís, se usa la portada.'}
        </Text>
      </View>

      <SheetLabel>Foto de portada · opcional</SheetLabel>
      <TouchableOpacity
        disabled={!!fotoBusy}
        onPress={() => elegirImagen('portada')}
        style={{ height: 140, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.violet[200], backgroundColor: '#fafaf9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        {fotoUrl ? (
          <Image source={{ uri: fotoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Ic d="image" size={22} color={colors.violet[400]} />
            <Text style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{fotoBusy === 'portada' ? 'Subiendo…' : 'Subir portada'}</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={{ fontSize: 12, color: MUTED, marginTop: 6, marginBottom: 18, lineHeight: 17 }}>La banda de arriba de tu ficha. Las dos las podés cargar después desde Mi negocio.</Text>

      {error ? <Text style={{ fontSize: 12.5, color: '#b0483f', fontWeight: '600', marginBottom: 12 }}>{error}</Text> : null}
      <TouchableOpacity disabled={busy} onPress={enviar} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ── La hoja del plan ──────────────────────────────────────────── */
/**
 * Elegir un plan y activar el débito. Antes era un muro; ahora es una hoja.
 *
 * El cambio no es de estilo: entrar a Kumo es gratis y lo que se paga son los
 * reintegros y los beneficios, así que dejar de mostrar la app a quien no pagó
 * pasó a ser mentira sobre lo que ofrece el club. Se conservan las tripas —el
 * selector de plan, el add-on y el cobro con su reintento de token—, y se va la
 * jaula: se puede cerrar, no tapa la navegación, y ya no ofrece cerrar sesión
 * (esa salida existía porque la persona estaba encerrada).
 *
 * Los textos salen de `copyCuota` de `@kumo/shared`, los mismos que la webapp: un
 * socio que lee una cosa en el navegador y otra en el celular no piensa "qué
 * raro", piensa que el club no sabe lo que cobra.
 */
function HojaPlan({ profile, planes, recargar, onClose, irABeneficios }: { profile: Profile; planes: PlanVM[]; recargar: () => void; onClose: () => void; irABeneficios: () => void }) {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState('');
  /** El aviso de "tu cuota cambió": no es un error ni una espera, ya está hecho. */
  const [actualizado, setActualizado] = useState('');
  /** Se prende al volver del navegador: recién ahí tiene sentido esperar el aviso. */
  const [volviendoDeMP, setVolviendoDeMP] = useState(false);
  /*
   * El plan arranca en el que ya tenía, si tenía alguno. Ojo con el gratuito: su
   * `planName` llega '—', y preseleccionarlo hacía que el servidor contestara "ese
   * plan no existe". Con el alta vieja no pasaba porque el plan era obligatorio.
   */
  const conPlanPrevio = profile.planName && profile.planName !== '—';
  const [planSel, setPlanSel] = useState(conPlanPrevio ? profile.planName : '');
  const [odonto, setOdonto] = useState(profile.addonOdonto);
  const elegido = planes.find((p) => p.name === planSel);
  const total = (elegido?.basePrice ?? 0) + (odonto ? ODONTO_PRECIO : 0);

  const estado = estadoCuota({
    hasta: profile.cuotaHasta,
    debePagar: profile.debePagar,
    suscripcion: profile.suscripcion,
    volviendoDeMP,
  });
  const copy = copyCuota(estado, profile.firstName, profile.cuotaHasta ? fmtFechaCorta(profile.cuotaHasta) : null);
  /*
   * "Activando" se trata como esperar, no como elegir: el socio ya compró un plan y
   * está entrando el primer cobro. Sin esto la hoja le mostraba otra vez la lista de
   * planes con el título "tu plan quedó activo" arriba — le ofrecía comprar lo que
   * acababa de comprar.
   */
  const activando = estado === 'activando';
  const esperando = estado === 'confirmando' || activando;
  /* Mientras espera, le pregunta a Mercado Pago en vez de esperar su aviso: ver
     `lib/esperarPago.ts`. Antes la hoja solo se refrescaba si el socio tocaba el
     botón, así que el que volvía y esperaba quieto no veía nada cambiar. */
  const { seAgoto } = useEsperarPago(esperando, recargar);

  const suscribirme = async () => {
    if (!planSel) { setError('Elegí un plan para activar tu cuota.'); return; }
    setYendo(true); setError('');
    try {
      /*
       * El token de la sesión: la app no tiene cookies, así que la ruta lo recibe
       * en el header y lo valida contra Supabase (ver lib/quien-pide.ts).
       *
       * Se reintenta UNA vez renovando el token. Pasó de verdad: con la app un
       * rato en segundo plano el token guardado ya había vencido, el servidor
       * contestaba "Sin sesión" y el socio quedaba sin poder pagar sin entender
       * por qué. La causa de fondo está arreglada en `lib/supabase.ts`, pero acá
       * igual conviene el reintento: es la pantalla donde no se puede fallar.
       */
      const pedir = async (token: string) => {
        const res = await fetch(`${SITIO}/api/pagos/crear`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planSel, odonto }),
        });
        return { res, data: await res.json() };
      };

      const { data: ses } = await supabase.auth.getSession();
      let token = ses.session?.access_token;
      if (!token) { setError('Se cerró tu sesión. Volvé a entrar y probá de nuevo.'); setYendo(false); return; }

      let { res, data } = await pedir(token);
      if (res.status === 401) {
        const { data: nueva } = await supabase.auth.refreshSession();
        token = nueva.session?.access_token;
        if (!token) {
          setError('Se cerró tu sesión. Volvé a entrar y probá de nuevo.');
          setYendo(false);
          return;
        }
        ({ res, data } = await pedir(token));
      }

      /* Cambió de plan con el débito ya autorizado: el servidor le cambió el monto en
         Mercado Pago, así que no hay nada que ir a autorizar. Se lo dice acá, porque un
         botón que no lleva a ninguna parte y no explica nada se lee como que falló. */
      if (data.actualizada) {
        setActualizado(`Listo: tu cuota pasa a $${Number(data.monto ?? 0).toLocaleString('es-AR')} por mes y se debita desde el próximo cobro. Nada que autorizar de nuevo.`);
        setYendo(false);
        recargar();
        return;
      }
      if (data.yaAutorizada) { setVolviendoDeMP(true); setYendo(false); recargar(); return; }
      if (!res.ok || !data.initPoint) { setError(data.error ?? 'No pudimos abrir la suscripción.'); setYendo(false); return; }
      // Al volver del navegador la app recarga sola (AppState), y con esto la hoja
      // ya está en modo espera cuando el socio vuelve.
      setVolviendoDeMP(true);
      await Linking.openURL(data.initPoint);
    } catch {
      setError('No pudimos abrir la suscripción. Revisá la conexión.');
    }
    setYendo(false);
  };

  return (
    <Sheet onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 20, color: BRAND }}>Kumo</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Text style={{ fontSize: 22, color: '#a29dba' }}>×</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK, marginBottom: 8 }}>{copy.titulo}</Text>
      <Text style={{ fontSize: 14, color: '#5b5670', lineHeight: 20, marginBottom: 16 }}>{copy.cuerpo}</Text>

      {/* Cambió de plan y ya estaba autorizado: el cambio ya está hecho. */}
      {actualizado ? (
        <View style={{ backgroundColor: '#f0f7f1', borderRadius: 13, padding: 13, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, color: '#2f8f5b', lineHeight: 19 }}>{actualizado}</Text>
        </View>
      ) : null}
      {estado === 'listo' ? (
        <TouchableOpacity onPress={irABeneficios} activeOpacity={0.85} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{copy.cta} →</Text>
        </TouchableOpacity>
      ) : activando ? (
        /* Sin spinner ni "volver a chequear": el plan ya quedó activo y el cobro es un
           trámite nuestro con Mercado Pago. */
        <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{copy.cta} →</Text>
        </TouchableOpacity>
      ) : esperando ? (
        <>
          {/* Se agotó la espera. Lo importante del texto: que NO pague de nuevo. Un
              socio que ve una pantalla trabada después de pagar vuelve a pagar, y ahí
              el problema pasa a ser plata. */}
          {seAgoto ? (
            <View style={{ backgroundColor: '#fbf3e2', borderRadius: 13, padding: 13, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: '#92690a', lineHeight: 19 }}>
                Está tardando más de lo normal. Si ya autorizaste el pago, se activa solo en cuanto Mercado Pago lo cobre: no hace falta pagar de nuevo.
              </Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={() => recargar()} activeOpacity={0.85} style={{ backgroundColor: '#f0edf9', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: BRAND, fontWeight: '700', fontSize: 15 }}>{copy.cta}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#a29dba', letterSpacing: 0.5, marginBottom: 8 }}>ELEGÍ TU PLAN</Text>
          <View style={{ gap: 8, marginBottom: 12 }}>
            {planes.map((p) => {
              const sel = p.name === planSel;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setPlanSel(p.name)}
                  activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: sel ? BRAND : '#e6e3f0', backgroundColor: sel ? '#f0edf9' : '#fff', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 }}
                >
                  <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 16, color: INK }}>{p.name}</Text>
                  <Text style={{ fontWeight: '700', fontSize: 14.5, color: sel ? BRAND : '#5b5670' }}>${p.basePrice.toLocaleString('es-AR')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* La cobertura odontológica es un add-on con precio propio: se suma
              acá y el total se recalcula a la vista. */}
          <TouchableOpacity
            onPress={() => setOdonto((v) => !v)}
            activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: odonto ? BRAND : '#e6e3f0', backgroundColor: odonto ? '#f0edf9' : '#fff', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12 }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>Cobertura odontológica</Text>
              <Text style={{ fontSize: 12, color: '#8781a0' }}>Limpieza y extracciones · +${ODONTO_PRECIO.toLocaleString('es-AR')}</Text>
            </View>
            <View style={{ width: 42, height: 25, borderRadius: 100, backgroundColor: odonto ? BRAND : '#d5d0e3', justifyContent: 'center', alignItems: odonto ? 'flex-end' : 'flex-start', paddingHorizontal: 3 }}>
              <View style={{ width: 19, height: 19, borderRadius: 10, backgroundColor: '#fff' }} />
            </View>
          </TouchableOpacity>

          {planSel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#eeecf5', paddingTop: 12, marginBottom: 14 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#5b5670' }}>Tu cuota por mes</Text>
              <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK }}>${total.toLocaleString('es-AR')}</Text>
            </View>
          ) : null}

          {!!error && (
            <View style={{ backgroundColor: '#fdf2f2', borderWidth: 1, borderColor: '#f5d6d6', borderRadius: 12, padding: 11, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: '#b03a3a' }}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={suscribirme}
            disabled={yendo || !planSel}
            activeOpacity={0.85}
            style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center', opacity: yendo || !planSel ? 0.5 : 1, marginBottom: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              {yendo ? 'Abriendo Mercado Pago…' : planSel ? copy.cta : 'Elegí un plan'}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 11.5, color: '#a29dba', textAlign: 'center', lineHeight: 16, marginBottom: 14 }}>
            Autorizás el débito en el sitio de Mercado Pago: los datos de tu tarjeta no pasan por Kumo. Podés darlo de baja cuando quieras.
          </Text>
        </>
      )}

      <View style={{ borderTopWidth: 1, borderTopColor: '#eeecf5', paddingTop: 12 }}>
        <TouchableOpacity onPress={() => openWa(WA_CLUB)}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: BRAND }}>¿Alguna duda? Escribinos</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

/* ── Sub-pantalla: Notificaciones ──────────────────────────────── */
/** Cada notificación lleva a la pantalla donde el socio puede hacer algo con ella. */
const NOTIF_DESTINO: Record<'carnet' | 'reintegros' | 'minegocio', Screen> = { carnet: 'carnet', reintegros: 'reintegros', minegocio: 'minegocio' };

function Notificaciones({ groups, visto, marcarLeidas, go, userId }: { groups: NotifGroup[]; visto: string | null; marcarLeidas: () => void; go: (t: Screen) => void; userId: string | null }) {
  const vistoMs = visto ? new Date(visto).getTime() : 0;

  /*
   * El switch de push, que era de adorno: estaba pintado prendido y no había
   * nada atrás.
   *
   * Prenderlo registra el token del aparato; apagarlo lo borra. Lo que corta el
   * envío es la fila que no está: el club le manda a los tokens que tiene, así
   * que sin token no le llega nada, sin necesidad de que cada envío pregunte por
   * una preferencia.
   */
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [tocando, setTocando] = useState(false);
  useEffect(() => { pushActivo().then(setPushOn); }, []);

  const alternar = async () => {
    if (pushOn === null || tocando || !userId) return;
    setTocando(true);
    if (pushOn) {
      await olvidarDispositivo();
      await guardarPushActivo(false);
      setPushOn(false);
    } else {
      const r = await registrarDispositivo(userId);
      if (r.ok) {
        await guardarPushActivo(true);
        setPushOn(true);
      } else {
        // El permiso del sistema no se puede volver a pedir desde acá una vez
        // negado: hay que mandarlo a los ajustes del teléfono, y decírselo.
        Alert.alert(
          'No pudimos activarlos',
          /permiso/i.test(r.motivo)
            ? 'Kumo tiene las notificaciones bloqueadas en este teléfono. Habilitalas en los ajustes del sistema y volvé a probar.'
            : 'Este teléfono no puede recibir notificaciones por ahora.',
        );
      }
    }
    setTocando(false);
  };
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK }}>Notificaciones</Text>
        {groups.length > 0 && (
          <TouchableOpacity onPress={marcarLeidas}>
            <Text style={{ color: BRAND, fontWeight: '600', fontSize: 13 }}>Marcar leídas</Text>
          </TouchableOpacity>
        )}
      </View>

      {groups.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 50 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ic d="bell" size={30} color={colors.violet[400]} />
          </View>
          <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 }}>Todavía no tenés notificaciones. Acá te avisamos cuando venza una vacuna, cuando se resuelva un reintegro o cuando aprobemos tu negocio.</Text>
        </View>
      ) : groups.map((g) => (
        <View key={g.label} style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#a29dba', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>{g.label}</Text>
          <View style={{ gap: 10 }}>
            {g.items.map((n) => {
              const st = NOTIF_STYLE[n.kind];
              const unread = new Date(n.date).getTime() > vistoMs;
              return (
                <TouchableOpacity key={n.id} onPress={() => go(NOTIF_DESTINO[n.to])} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: 16, padding: 13, borderWidth: 1, backgroundColor: unread ? '#faf9fd' : '#fff', borderColor: unread ? '#e6e1f2' : '#eeecf5' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: st.chip }}>
                    <Ic d={st.ic} size={20} color={st.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: '600', fontSize: 14, color: INK, marginBottom: 2 }}>{n.title}</Text>
                    <Text style={{ fontSize: 12.5, color: '#8781a0', lineHeight: 18 }}>{n.body}</Text>
                    <Text style={{ fontSize: 11, color: '#bdb8cf', marginTop: 5 }}>{n.timeLabel ?? notifTiempo(n.date)}</Text>
                  </View>
                  {unread && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: BRAND, marginTop: 5 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={alternar}
        disabled={pushOn === null || tocando}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4, opacity: tocando ? 0.6 : 1 }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>Push y recordatorios</Text>
          <Text style={{ fontSize: 12, color: '#a29dba' }}>
            {pushOn === false ? 'Apagados en este teléfono' : 'Vacunas, reintegros y beneficios'}
          </Text>
        </View>
        <View style={{ width: 44, height: 26, borderRadius: 100, backgroundColor: pushOn === false ? '#d5d0e3' : BRAND, justifyContent: 'center', alignItems: pushOn === false ? 'flex-start' : 'flex-end', paddingHorizontal: 3 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ── Sub-pantalla: Mi negocio ──────────────────────────────────── */

/**
 * Mis negocios. Son VARIOS a propósito: un socio puede tener un servicio y un
 * comercio, y hasta ahora el alta se frenaba con "Ya tenés un negocio".
 *
 * Con uno solo la pantalla se ve igual que antes —no hay lista de un elemento—; la
 * lista aparece recién con el segundo.
 */
function Negocio({ negocios, userId, phone, reload }: { negocios: MiNegocio[]; userId: string; phone: string; reload: () => void }) {
  const [selId, setSelId] = useState<string | null>(null);
  const [showAlta, setShowAlta] = useState(false);
  /** Cuál se está subiendo, para poner el cartel en ESA caja y no en las dos. */
  const [fotoBusy, setFotoBusy] = useState<'logo' | 'portada' | null>(null);
  /* Las imágenes del alta. Van aparte de las del negocio publicado: acá todavía no
     existe la fila donde guardarlas, así que se suben al elegirlas y el insert guarda
     las URLs. */
  const [altaLogo, setAltaLogo] = useState<string | null>(null);
  const [altaPortada, setAltaPortada] = useState<string | null>(null);
  const [altaBusy, setAltaBusy] = useState<'logo' | 'portada' | null>(null);
  const [nombre, setNombre] = useState('');
  const [rubro, setRubro] = useState<ProviderCategory>(RUBROS[0]!);
  const [zona, setZona] = useState('');
  /** La dirección es opcional y es lo único que pone el negocio en el mapa. */
  const [direccion, setDireccion] = useState('');
  /* Instagram, sitio y tarifa: opcionales, pero se piden ACÁ y no solo al editar.
     Antes solo existían en "Editar datos" del negocio ya publicado, así que la ficha
     de todo prestador nuevo salía con dos filas y sin precio. */
  const [instagram, setInstagram] = useState('');
  const [sitio, setSitio] = useState('');
  const [precio, setPrecio] = useState('');
  const [unidad, setUnidad] = useState('');
  const [tel, setTel] = useState(phone === '—' ? '' : phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /**
   * Editar el negocio publicado. En mobile no existía: había alta y baja, nada
   * más, así que un prestador no podía corregir ni el teléfono. Y son campos que
   * el socio ve en su ficha pública, así que un dato viejo lo paga en llamadas
   * que no entran.
   *
   * `status` no se toca a propósito: lo decide el club, y hay un trigger en la
   * base que lo impide igual.
   */
  const [editOpen, setEditOpen] = useState(false);
  const [ed, setEd] = useState<{ name: string; category: ProviderCategory; zone: string; address: string; phone: string; about: string; price: string; priceUnit: string; instagram: string; website: string }>({ name: '', category: RUBROS[0]!, zone: '', address: '', phone: '', about: '', price: '', priceUnit: '', instagram: '', website: '' });

  const abrirEdicion = async (negocio: MiNegocio) => {
    setError('');
    // Los valores crudos de la base: la tarjeta no trae `about` ni las tarifas.
    const { data } = await supabase
      .from('providers')
      .select('name, category, zone, address, phone, about, price, price_unit, instagram, website')
      .eq('id', negocio.id)
      .single();
    setEd({
      name: data?.name ?? negocio.name,
      category: data?.category ?? negocio.category,
      zone: data?.zone ?? negocio.zone,
      address: data?.address ?? negocio.address ?? '',
      phone: data?.phone ?? '',
      about: data?.about ?? '',
      price: data?.price != null ? String(data.price) : '',
      priceUnit: data?.price_unit ?? '',
      instagram: data?.instagram ?? '',
      website: data?.website ?? '',
    });
    setEditOpen(true);
  };

  /** La foto de la ficha del negocio: se sube y se guarda en el acto, con el mismo
   *  ayudante que la de la mascota. */
  const cambiarImagen = async (cual: 'logo' | 'portada') => {
    if (!negocio) return;
    setFotoBusy(cual); setError('');
    const r = await elegirYSubirFoto(userId, cual === 'logo' ? 'negocio-logo-' : 'negocio-');
    if ('url' in r) {
      const { error: e } = await supabase.from('providers').update(cual === 'logo' ? { logo_url: r.url } : { photo_url: r.url }).eq('id', negocio.id);
      if (e) setError('Subimos la imagen pero no pudimos guardarla. Probá de nuevo.');
      else await reload();
    } else if ('error' in r) setError(r.error);
    setFotoBusy(null);
  };

  const guardarEdicion = async () => {
    if (!negocio) return;
    if (!ed.name.trim() || !ed.zone.trim()) { setError('El nombre y la zona no pueden quedar vacíos.'); return; }
    setBusy(true); setError('');
    const { error: e, data } = await supabase.from('providers').update({
      name: ed.name.trim(), category: ed.category, zone: ed.zone.trim(),
      address: ed.address.trim() || null,
      phone: ed.phone.trim() || null, about: ed.about.trim(),
      price: Number(ed.price.replace(/\D/g, '')) || null, price_unit: ed.priceUnit.trim() || null,
      instagram: ed.instagram.trim() || null, website: ed.website.trim() || null,
    }).eq('id', negocio.id).select('id');
    if (e || !data?.length) { setError('No pudimos guardar los cambios. Probá de nuevo.'); setBusy(false); return; }
    /* Si se mudó el local, el pin se muda con él. También cuando la dirección se
       borra: ahí quedan coordenadas nulas y el negocio sale del mapa, que es lo
       correcto — no puede quedar un pin de un local que ya no está. */
    if (ed.address.trim() !== (negocio.address ?? '')) void ubicarNegocio(negocio.id);
    setEditOpen(false);
    await reload();
    setBusy(false);
  };

  // El estado sale del negocio real, no de un selector de demo.
  /* El negocio abierto: con uno solo es ese, con varios el que se toca en la lista.
     Se busca por id contra la lista fresca y no se guarda el objeto, así después de
     guardar cambios se ve lo que quedó en la base. */
  const negocio = negocios.find((n) => n.id === selId) ?? (negocios.length === 1 ? negocios[0]! : null);
  const state: 'sin' | 'lista' | 'revision' | 'activo' | 'rechazado' =
    negocios.length === 0 ? 'sin'
      : !negocio ? 'lista'
      : negocio.status === 'verificado' ? 'activo'
      : negocio.status === 'rechazado' ? 'rechazado'
      : 'revision';

  /** Elegir y subir una de las dos imágenes del alta. */
  const elegirAlta = async (cual: 'logo' | 'portada') => {
    setAltaBusy(cual); setError('');
    const r = await elegirYSubirFoto(userId, cual === 'logo' ? 'negocio-logo-' : 'negocio-');
    if ('url' in r) (cual === 'logo' ? setAltaLogo : setAltaPortada)(r.url);
    else if ('error' in r) setError(r.error);
    setAltaBusy(null);
  };

  const enviarAlta = async () => {
    if (!nombre.trim()) { setError('Poné el nombre de tu negocio.'); return; }
    if (!zona.trim()) { setError('Poné la zona donde trabajás.'); return; }
    setBusy(true); setError('');
    const { data: alta, error: e } = await supabase.from('providers').insert({
      owner_id: userId, name: nombre.trim(), category: rubro, zone: zona.trim(),
      address: direccion.trim() || null,
      instagram: instagram.trim() || null, website: sitio.trim() || null,
      price: Number(precio.replace(/\D/g, '')) || null, price_unit: unidad.trim() || null,
      phone: tel.trim() || null, photo_url: altaPortada, logo_url: altaLogo, status: 'pendiente',
    }).select('id').single();
    if (e) { setError('No pudimos enviar la solicitud. Probá de nuevo.'); setBusy(false); return; }
    if (alta?.id && direccion.trim()) void ubicarNegocio(alta.id);
    setShowAlta(false);
    await reload();
    setBusy(false);
  };

  const darDeBaja = async () => {
    if (!negocio) return;
    setBusy(true);
    await supabase.from('providers').delete().eq('id', negocio.id);
    await reload();
    setBusy(false);
  };

  const field = { borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' } as const;

  /* El formulario del alta, en una constante: se usa en la tarjeta de "todavía no
     tenés ninguno" y en el botón "dar de alta otro" de la lista. */
  const formAlta = (
  <View style={{ gap: 10 }}>
    <TextInput value={nombre} onChangeText={(t) => { setNombre(t); setError(''); }} placeholder="Nombre de tu negocio" placeholderTextColor={colors.violet[400]} style={field} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {RUBROS.map((r) => (
        <TouchableOpacity key={r} onPress={() => setRubro(r)} style={{ backgroundColor: rubro === r ? LIME : 'rgba(255,255,255,0.15)', borderRadius: 100, paddingVertical: 8, paddingHorizontal: 13 }}>
          <Text style={{ color: rubro === r ? INK : '#fff', fontWeight: '700', fontSize: 12.5 }}>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
    {/* `tono="oscuro"`: este formulario vive dentro de la tarjeta violeta y
        los rótulos por defecto son grises: sobre el violeta no se leen. */}
    <CampoZona tono="oscuro" label="Zona" valor={zona} onCambio={(t) => { setZona(t); setError(''); }} onElegir={(z) => { setZona(z.zona); setError(''); }} placeholder="Ej: Palermo, CABA" />
    <CampoDomicilio tono="oscuro" label="Dirección (opcional)" valor={direccion} {...partirZona(zona)} onCambio={setDireccion} onElegir={(l) => setDireccion(l.domicilio)} />
    <TextInput value={tel} onChangeText={setTel} placeholder="WhatsApp de contacto" placeholderTextColor={colors.violet[400]} keyboardType="phone-pad" style={field} />
    {/* La dirección es lo único que lo pone en el mapa; sin ella el negocio
        aparece en la lista pero sin distancia ni pin. */}
    <TextInput value={instagram} onChangeText={setInstagram} placeholder="Instagram (opcional)" placeholderTextColor={colors.violet[400]} autoCapitalize="none" style={field} />
    <TextInput value={sitio} onChangeText={setSitio} placeholder="Sitio web (opcional)" placeholderTextColor={colors.violet[400]} autoCapitalize="none" style={field} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TextInput value={precio} onChangeText={setPrecio} keyboardType="numeric" placeholder="Tarifa (opcional)" placeholderTextColor={colors.violet[400]} style={{ ...field, flex: 1 }} />
      <TextInput value={unidad} onChangeText={setUnidad} placeholder="/paseo" placeholderTextColor={colors.violet[400]} style={{ ...field, flex: 1 }} />
    </View>
    {/* El logo y la portada, también acá: estaban solo en el alta larga ("Sumate como
        prestador"), así que quien daba de alta desde Mi negocio —que es el camino más
        corto— no tenía dónde subirlas y su ficha nacía con el ícono del rubro. */}
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <TouchableOpacity
        disabled={!!altaBusy}
        onPress={() => elegirAlta('logo')}
        style={{ width: 84, height: 84, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.violet[200], backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        {altaLogo ? <Image source={{ uri: altaLogo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <Text style={{ fontSize: 11, color: MUTED, textAlign: 'center' }}>{altaBusy === 'logo' ? 'Subiendo…' : 'Logo\n(opcional)'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        disabled={!!altaBusy}
        onPress={() => elegirAlta('portada')}
        style={{ flex: 1, height: 84, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.violet[200], backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        {altaPortada ? <Image source={{ uri: altaPortada }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <Text style={{ fontSize: 11.5, color: MUTED, textAlign: 'center' }}>{altaBusy === 'portada' ? 'Subiendo…' : 'Foto de portada (opcional)'}</Text>}
      </TouchableOpacity>
    </View>
    <Text style={{ fontSize: 11.5, color: colors.violet[200], lineHeight: 17 }}>Si atendés en un local, la dirección te ubica en el mapa de los socios. Si trabajás a domicilio, dejala vacía. Todo esto se puede completar después.</Text>
    {!!error && <Text style={{ color: LIME, fontSize: 12.5, fontWeight: '600' }}>{error}</Text>}
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <TouchableOpacity onPress={() => setShowAlta(false)} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={busy} onPress={enviarAlta} style={{ flex: 1, backgroundColor: LIME, borderRadius: 12, paddingVertical: 13, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
        <Text style={{ color: INK, fontWeight: '700', fontSize: 14 }}>{busy ? 'Enviando…' : 'Enviar'}</Text>
      </TouchableOpacity>
    </View>
  </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {/* Volver a la lista solo tiene sentido si hay una lista. */}
      {negocio && negocios.length > 1 && (
        <TouchableOpacity onPress={() => setSelId(null)} style={{ paddingVertical: 6 }}>
          <Text style={{ color: BRAND, fontWeight: '600', fontSize: 14 }}>← Mis negocios</Text>
        </TouchableOpacity>
      )}
      <H1>{negocios.length > 1 && !negocio ? 'Mis negocios' : 'Mi negocio'}</H1>
      <Sub>Ofrecé tus servicios a la comunidad de Kumo.</Sub>

      {/* La lista. Aparece con el segundo negocio: con uno la pantalla va directo a
          su ficha, que es lo que había antes. */}
      {state === 'lista' && (
        <View style={{ gap: 10, marginBottom: 18 }}>
          {negocios.map((n) => (
            <TouchableOpacity key={n.id} onPress={() => setSelId(n.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 14 }}>
              {(n.logo ?? n.photo) ? (
                <Image source={{ uri: (n.logo ?? n.photo)! }} style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.violet[100] }} />
              ) : (
                <View style={{ width: 46, height: 46, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
                  <Ic d={RUBRO_IC[n.category] ?? 'paw'} size={22} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>{n.name}</Text>
                <Text style={{ fontSize: 12.5, color: MUTED }}>{n.category} · {n.zone}</Text>
              </View>
              <View style={{ backgroundColor: n.status === 'verificado' ? colors.success.bg : n.status === 'rechazado' ? '#fbe8ef' : '#fbf3e2', borderRadius: 100, paddingHorizontal: 9, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: n.status === 'verificado' ? colors.success.fg : n.status === 'rechazado' ? '#c14d7a' : '#92690a' }}>
                  {n.status === 'verificado' ? 'Publicado' : n.status === 'rechazado' ? 'Rechazado' : 'En revisión'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {showAlta ? formAlta : (
            <TouchableOpacity onPress={() => setShowAlta(true)} style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>+ Dar de alta otro negocio</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {state === 'sin' && (
        <View style={{ backgroundColor: BRAND, borderRadius: 20, padding: 22, marginBottom: 18, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.15 }}><Ic d="store" size={120} color="#fff" /></View>
          <View style={{ width: 52, height: 52, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Ic d="store" size={26} color="#fff" /></View>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: '#fff', lineHeight: 27 }}>¿Ofrecés un servicio para mascotas?</Text>
          <Text style={{ color: colors.violet[300], fontSize: 13.5, lineHeight: 20, marginTop: 10, marginBottom: 18 }}>Dá de alta tu negocio como paseador, guardería, adiestrador, baño o cuidador. El club valida tus datos y quedás visible para miles de socios.</Text>
          {showAlta ? formAlta : (
            <TouchableOpacity onPress={() => setShowAlta(true)} style={{ backgroundColor: LIME, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: INK, fontWeight: '700', fontSize: 15 }}>Dar de alta mi negocio →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {state === 'revision' && (
        <View style={{ backgroundColor: '#fbf3e2', borderWidth: 1, borderColor: '#f0d98a', borderRadius: 20, padding: 22, marginBottom: 18 }}>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 18, color: '#b8860b' }}>Tu alta está en revisión</Text>
          <Text style={{ color: MUTED, fontSize: 13.5, lineHeight: 20, marginTop: 8 }}>Nuestro equipo está validando tus datos. Te avisamos cuando tu negocio quede activo.</Text>
          <Text style={{ color: INK, fontWeight: '700', fontSize: 15, marginTop: 14 }}>{negocio?.name}</Text>
          <Text style={{ color: MUTED, fontSize: 13 }}>{negocio?.category} · {negocio?.zone}</Text>
          <TouchableOpacity disabled={busy} onPress={darDeBaja} style={{ marginTop: 14 }}>
            <Text style={{ color: '#b0483f', fontWeight: '600', fontSize: 13 }}>{busy ? 'Borrando…' : 'Borrar la solicitud'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {state === 'activo' && (
        <View style={{ backgroundColor: colors.success.bg, borderWidth: 1, borderColor: '#a8dcc0', borderRadius: 20, padding: 22, marginBottom: 18 }}>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 18, color: colors.success.fg }}>Tu negocio está activo ✓</Text>
          <Text style={{ color: MUTED, fontSize: 13.5, lineHeight: 20, marginTop: 8 }}>Ya sos visible para los socios en Servicios.</Text>
          <Text style={{ color: INK, fontWeight: '700', fontSize: 16, marginTop: 14 }}>{negocio?.name}</Text>
          <Text style={{ color: MUTED, fontSize: 13 }}>{negocio?.category} · {negocio?.zone}</Text>
          <Text style={{ color: MUTED, fontSize: 13, marginTop: 8 }}>
            {negocio && negocio.reviews > 0 ? `★ ${negocio.rating.toFixed(1)} · ${negocio.reviews} reseñas` : 'Todavía sin reseñas'}
          </Text>
          <TouchableOpacity onPress={() => negocio && abrirEdicion(negocio)} style={{ marginTop: 16, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.success.fg, borderRadius: 13, paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.success.fg, fontWeight: '700', fontSize: 14 }}>Editar datos</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={darDeBaja} style={{ marginTop: 14 }}>
            <Text style={{ color: '#b0483f', fontWeight: '600', fontSize: 13 }}>{busy ? 'Dando de baja…' : 'Dar de baja mi negocio'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Editar el negocio publicado. Los mismos campos que la webapp: hasta
          ahora en mobile no se podía tocar nada después del alta. */}
      {editOpen && (
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.violet[200], borderRadius: 20, padding: 18, marginBottom: 18, gap: 10 }}>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 18, color: INK }}>Editar datos</Text>

          {/* Las dos imágenes de la ficha. En mobile no había forma de poner ninguna:
              ni en el alta ni después, así que el negocio quedaba para siempre sin
              las suyas. Se guardan al elegirlas, como la de la mascota. */}
          <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED }}>LOGO DE LA MARCA</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity disabled={!!fotoBusy} onPress={() => cambiarImagen('logo')} style={{ opacity: fotoBusy === 'logo' ? 0.5 : 1 }}>
              {negocio?.logo ? (
                <Image source={{ uri: negocio.logo }} style={{ width: 74, height: 74, borderRadius: 16, backgroundColor: colors.violet[100] }} />
              ) : (
                <View style={{ width: 74, height: 74, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
                  <Ic d={RUBRO_IC[negocio?.category ?? ''] ?? 'paw'} size={30} />
                </View>
              )}
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 12.5, color: MUTED, lineHeight: 18 }}>
              {fotoBusy === 'logo' ? 'Subiendo…' : negocio?.logo ? 'Tocá el logo para cambiarlo. Es el redondel de tu ficha y el cuadradito del listado.' : 'Todavía no subiste logo: mientras tanto se usa la portada, y si tampoco hay, el ícono de tu rubro.'}
            </Text>
          </View>

          <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED }}>FOTO DE PORTADA</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity disabled={!!fotoBusy} onPress={() => cambiarImagen('portada')} style={{ opacity: fotoBusy === 'portada' ? 0.5 : 1 }}>
              {negocio?.photo ? (
                <Image source={{ uri: negocio.photo }} style={{ width: 116, height: 74, borderRadius: 12, backgroundColor: colors.violet[100] }} />
              ) : (
                <View style={{ width: 116, height: 74, borderRadius: 12, overflow: 'hidden', backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
                  <Ic d={RUBRO_IC[negocio?.category ?? ''] ?? 'paw'} size={26} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 12.5, color: MUTED, lineHeight: 18 }}>
              {fotoBusy === 'portada' ? 'Subiendo…' : negocio?.photo ? 'Tocá la portada para cambiarla. Es la banda de arriba de tu ficha.' : 'Todavía no subiste portada. Es la banda de arriba de tu ficha.'}
            </Text>
          </View>

          <CampoZona label="Zona" valor={ed.zone} onCambio={(v) => { setEd({ ...ed, zone: v }); setError(''); }} onElegir={(z) => { setEd({ ...ed, zone: z.zona }); setError(''); }} />
          <CampoDomicilio label="Dirección (opcional)" valor={ed.address} {...partirZona(ed.zone)} onCambio={(v) => setEd({ ...ed, address: v })} onElegir={(l) => setEd({ ...ed, address: l.domicilio })} ayuda="Es lo que te ubica en el mapa de los socios. Vacía, te encuentran por zona." />
          {[
            ['Nombre del negocio', ed.name, (v: string) => setEd({ ...ed, name: v }), {}],
            ['Teléfono', ed.phone, (v: string) => setEd({ ...ed, phone: v }), { keyboardType: 'phone-pad' as const }],
            ['Instagram', ed.instagram, (v: string) => setEd({ ...ed, instagram: v }), { autoCapitalize: 'none' as const }],
            ['Sitio web', ed.website, (v: string) => setEd({ ...ed, website: v }), { autoCapitalize: 'none' as const }],
            ['Precio (solo números)', ed.price, (v: string) => setEd({ ...ed, price: v }), { keyboardType: 'numeric' as const }],
            ['Unidad (ej: /paseo, /noche)', ed.priceUnit, (v: string) => setEd({ ...ed, priceUnit: v }), {}],
          ].map(([label, valor, set, extra]) => (
            <View key={label as string}>
              <Text style={{ fontSize: 12, color: MUTED, marginBottom: 5 }}>{label as string}</Text>
              <TextInput value={valor as string} onChangeText={(t) => { (set as (v: string) => void)(t); setError(''); }}
                placeholderTextColor={colors.violet[400]}
                style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: INK, backgroundColor: '#fff' }}
                {...(extra as object)} />
            </View>
          ))}
          <Text style={{ fontSize: 12, color: MUTED, marginBottom: 5 }}>Rubro</Text>
          <View style={{ gap: 6 }}>
            {RUBROS.map((r) => (
              <TouchableOpacity key={r} onPress={() => setEd({ ...ed, category: r })}
                style={{ borderWidth: 1.5, borderColor: ed.category === r ? BRAND : colors.violet[200], backgroundColor: ed.category === r ? colors.violet[100] : '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }}>
                <Text style={{ fontSize: 13.5, fontWeight: ed.category === r ? '700' : '500', color: ed.category === r ? BRAND : MUTED }}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: MUTED, marginBottom: 5, marginTop: 4 }}>Sobre tu servicio</Text>
          <TextInput value={ed.about} onChangeText={(t) => { setEd({ ...ed, about: t }); setError(''); }} multiline
            style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: INK, backgroundColor: '#fff', minHeight: 90, textAlignVertical: 'top' }} />
          {error ? <Text style={{ fontSize: 12.5, color: '#b0483f', fontWeight: '700' }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setEditOpen(false)} style={{ flex: 1, borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 13, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: MUTED }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={guardarEdicion} style={{ flex: 1, backgroundColor: LIME, borderRadius: 13, paddingVertical: 13, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>{busy ? 'Guardando…' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {state === 'rechazado' && (
        <View style={{ backgroundColor: '#fbe8ef', borderWidth: 1, borderColor: '#f0c8d7', borderRadius: 20, padding: 22, marginBottom: 18 }}>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 18, color: '#b0483f' }}>No pudimos aprobar tu negocio</Text>
          <Text style={{ color: MUTED, fontSize: 13.5, lineHeight: 20, marginTop: 8 }}>Escribinos y lo revisamos con vos. Podés borrar la solicitud y volver a empezar cuando quieras.</Text>
          <TouchableOpacity disabled={busy} onPress={darDeBaja} style={{ marginTop: 14 }}>
            <Text style={{ color: '#b0483f', fontWeight: '600', fontSize: 13 }}>{busy ? 'Borrando…' : 'Borrar la solicitud'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Con un solo negocio no hay lista donde poner este botón, así que va acá:
          sin esto, el que ya tiene uno no tendría por dónde dar de alta el segundo. */}
      {negocio && (
        <View style={{ marginBottom: 18 }}>
          {showAlta ? formAlta : (
            <TouchableOpacity onPress={() => setShowAlta(true)} style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>+ Dar de alta otro negocio</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {([['person', 'Miles de socios buscando tu servicio'], ['shield', 'Sello "Verificado por Kumo"'], ['chat', 'Reseñas y contactos en un solo lugar']] as [IconName, string][]).map(([icon, t]) => (
        <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d={icon} size={18} color={BRAND} /></View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: INK, flex: 1 }}>{t}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/* ── Sub-pantalla: Reintegros ──────────────────────────────────── */
const REFUND_PCT: Record<string, number> = { AMIGO: 30, FAMILIA: 50, VIP: 70 };
const NOTA_REINT = 'Los reintegros se acreditan en tu CVU/CBU dentro de los 30 días corridos. Podés pedir 1 reintegro de consultas cada 2 meses.';
const reintTone = (raw: string) => REINT_TONE[raw] ?? REINT_TONE.en_revision!;

/* ── Sub-pantalla: detalle de un reintegro ─────────────────────── */
/** Montos, seguimiento, comprobante y datos de acreditación. Antes el historial
 *  no se podía abrir: la tarjeta era el final del camino. */
function ReintegroDetalle({ r, planName, onVolver }: { r: ReintVM; planName: string; onVolver: () => void }) {
  const [verBusy, setVerBusy] = useState(false);
  const tone = reintTone(r.estadoRaw);
  const pasos = reintPasos(r.estadoRaw, r.fecha, r.resueltoEl);

  /** El bucket es privado: se pide una URL firmada corta y se abre. */
  const verComprobante = async () => {
    if (!r.receiptPath) return;
    setVerBusy(true);
    const { data } = await supabase.storage.from('receipts').createSignedUrl(r.receiptPath, 300);
    if (data?.signedUrl) Linking.openURL(data.signedUrl);
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
    <ScrollView contentContainerStyle={styles.screen}>
      <BackLink label="Reintegros" onPress={onVolver} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 21, color: INK }}>{r.place}</Text>
          <Text style={{ fontSize: 13, color: '#a29dba', marginTop: 2 }}>{r.concept} · {r.fecha}</Text>
        </View>
        <View style={{ backgroundColor: tone.bg, borderRadius: 100, paddingHorizontal: 11, paddingVertical: 5, marginTop: 2 }}>
          <Text style={{ color: tone.fg, fontWeight: '700', fontSize: 11 }}>{r.estado}</Text>
        </View>
      </View>

      {/* Montos */}
      <View style={{ backgroundColor: BRAND, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 18, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.14)' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.violet[300], fontSize: 12 }}>{r.estadoRaw === 'acreditado' ? 'Reintegro acreditado' : r.estadoRaw === 'rechazado' ? 'Reintegro solicitado' : 'Reintegro estimado'}</Text>
            <Text style={{ fontSize: 11, color: '#a79fce' }}>{r.refundPct}% del gasto · plan {planName}</Text>
          </View>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 30, color: LIME }}>{money(r.refund)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.violet[300], fontSize: 13 }}>Total gastado</Text>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{money(r.spent)}</Text>
        </View>
      </View>

      {/* Seguimiento */}
      <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 16 }}>
        <Text style={{ fontWeight: '700', fontSize: 14, color: INK, marginBottom: 14 }}>Seguimiento</Text>
        {pasos.map((p, i) => (
          <View key={p.label} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: p.done ? BRAND : '#e0dcec' }}>
                {p.done ? <Svg width={11} height={11} viewBox="0 0 24 24"><Path d="M4 12l5 5L20 6" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /></Svg> : null}
              </View>
              {i < pasos.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: pasos[i + 1]!.done ? BRAND : '#e0dcec' }} /> : null}
            </View>
            <View style={{ paddingBottom: 16, flex: 1 }}>
              <Text style={{ fontWeight: '600', fontSize: 13.5, color: p.done ? INK : '#a29dba' }}>{p.label}</Text>
              <Text style={{ fontSize: 12, color: '#a29dba' }}>{pasoWhen(p)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Comprobante */}
      <Text style={{ fontWeight: '700', fontSize: 14, color: INK, marginBottom: 10 }}>Comprobante</Text>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}>
        <View style={{ width: 48, height: 60, borderRadius: 8, backgroundColor: '#ece9f5', borderWidth: 1, borderColor: '#ded9ec', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5 }}>
          <Text style={{ fontSize: 8, color: '#8781a0' }}>{(r.receiptPath?.split('.').pop() ?? 'DOC').toUpperCase().slice(0, 4)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', fontSize: 13.5, color: INK }}>{r.receiptNo ? `Factura ${r.receiptNo}` : 'Comprobante cargado'}</Text>
          <Text style={{ fontSize: 12, color: '#a29dba' }}>Ticket fiscal · {money(r.spent)}</Text>
        </View>
        {r.receiptPath ? (
          <TouchableOpacity disabled={verBusy} onPress={verComprobante}>
            <Text style={{ color: BRAND, fontWeight: '600', fontSize: 13 }}>{verBusy ? 'Abriendo…' : 'Ver'}</Text>
          </TouchableOpacity>
        ) : <Text style={{ color: '#a29dba', fontSize: 12.5 }}>Sin archivo</Text>}
      </View>

      {/* Datos */}
      <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 16, marginBottom: 16 }}>
        {meta.map((m, i) => (
          <View key={m.k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: i === meta.length - 1 ? 0 : 1, borderBottomColor: '#eeecf5' }}>
            <Text style={{ color: '#8781a0', fontSize: 13.5 }}>{m.k}</Text>
            <Text style={{ fontWeight: '600', fontSize: 13.5, color: INK, flex: 1, textAlign: 'right' }}>{m.v}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.violet[100], borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13 }}>
        <Ic d="bell" size={18} />
        <Text style={{ fontSize: 12.5, color: MUTED, lineHeight: 19, flex: 1 }}>{NOTA_REINT}</Text>
      </View>
    </ScrollView>
  );
}

function Reintegros({ profile, pets, reintegros, reintTotal, userId, reload, go }: { profile: Profile | null; pets: Pet[]; reintegros: ReintVM[]; reintTotal: number; userId: string; reload: () => void; go: (t: Screen) => void }) {
  const [selId, setSelId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [place, setPlace] = useState('');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  // Prefijados con la cuenta del perfil, que se pide en el alta: antes había que
  // retipear titular, CUIT y CBU en cada solicitud. Igual que en la webapp.
  const [titular, setTitular] = useState(profile?.banco.holder ?? '');
  const [cuit, setCuit] = useState(profile?.banco.cuit ?? '');
  const [cbu, setCbu] = useState(profile?.banco.cbu ?? profile?.banco.alias ?? '');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pct = REFUND_PCT[profile?.planName ?? ''] ?? 30;
  const sel = reintegros.find((r) => r.id === selId);
  if (sel) return <ReintegroDetalle r={sel} planName={profile?.planName ?? '—'} onVolver={() => setSelId(null)} />;

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Necesitamos permiso para acceder a tus fotos.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    setPhoto(res.assets[0]);
    setError('');
  };

  const submit = async () => {
    const n = Number(amount.replace(/\D/g, ''));
    if (!place.trim() || !concept.trim() || !n || !profile) { setError('Completá el comercio, el concepto y el monto.'); return; }
    if (!photo) { setError('Cargá la factura: sin comprobante el club no puede validar el gasto.'); return; }
    if (!titular.trim() || !cbu.trim()) { setError('Completá el titular y el CBU/CVU o alias: son los datos con los que se acredita.'); return; }
    setBusy(true);
    setError('');

    // El bucket 'receipts' es privado: la RLS exige que la primera carpeta del
    // path sea el id del socio.
    const ext = photo.uri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const bytes = await fetch(photo.uri).then((r) => r.arrayBuffer());
    const { error: upErr } = await supabase.storage.from('receipts').upload(path, bytes, { contentType: photo.mimeType ?? 'image/jpeg' });
    if (upErr) {
      setError('No pudimos subir la factura. Probá de nuevo.');
      setBusy(false);
      return;
    }

    const { data: nuevo, error: insErr } = await supabase.from('reimbursements').insert({
      member_id: userId, pet_id: pets[0]?.id ?? null, plan_name: profile.planName,
      provider_name: place.trim(), concept: concept.trim(), amount: n,
      refund: Math.round((n * pct) / 100), refund_pct: pct, status: 'en_revision', receipt_path: path,
      bank_holder: titular.trim() || null, bank_cuit: cuit.trim() || null,
      // El alias y el CBU van al mismo campo: el socio pone uno de los dos.
      ...(/^\d{22}$/.test(cbu.replace(/\D/g, '')) ? { bank_cbu: cbu.trim() } : { bank_alias: cbu.trim() }),
    }).select('id').single();
    if (insErr) {
      // No dejamos el archivo huérfano si falla la solicitud.
      await supabase.storage.from('receipts').remove([path]);
      setError('No pudimos registrar la solicitud. Probá de nuevo.');
      setBusy(false);
      return;
    }

    // Acuse del pedido: el socio se entera de que llegó sin tener que preguntar.
    if (nuevo?.id) void avisar('reintegro-recibido', nuevo.id);

    setPlace(''); setConcept(''); setAmount(''); setTitular(''); setCuit(''); setCbu(''); setPhoto(null);
    setOpen(false); setEnviado(true);
    await reload();
    setBusy(false);
  };
  const field = { borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' } as const;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <BackLink label="Perfil" onPress={() => go('perfil')} />
      <H1>Reintegros</H1>
      <View style={{ height: 14 }} />
      <View style={{ backgroundColor: BRAND, borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 14 }}>
        <Text style={{ fontSize: 13, color: colors.violet[300] }}>Reintegrado este año</Text>
        <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 36, color: LIME, marginVertical: 2 }}>{money(reintTotal)}</Text>
        <Text style={{ fontSize: 12, color: colors.violet[300] }}>plan {profile?.planName ?? '—'} · reintegro {pct}%</Text>
      </View>
      {enviado && (
        <View style={{ backgroundColor: '#eef7d6', borderWidth: 1.5, borderColor: '#d3e89a', borderRadius: 18, padding: 18, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M20 6L9 17l-5-5" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: '#3f5410' }}>Solicitud enviada</Text>
            <Text style={{ fontSize: 13, color: '#5f7d10' }}>La revisamos y acreditamos en tu CBU/CVU dentro de los 30 días corridos.</Text>
          </View>
          <TouchableOpacity onPress={() => setEnviado(false)}><Text style={{ color: '#5f7d10', fontSize: 18 }}>✕</Text></TouchableOpacity>
        </View>
      )}

      {open ? (
        <View style={{ backgroundColor: colors.violet[50], borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 18, padding: 18, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: INK }}>Solicitar reintegro</Text>
            <TouchableOpacity onPress={() => setOpen(false)}><Text style={{ color: '#a29dba', fontSize: 20 }}>✕</Text></TouchableOpacity>
          </View>

          <Grupo>Comprobante</Grupo>
          <TouchableOpacity onPress={pickPhoto} style={{ borderWidth: 1.5, borderColor: colors.violet[300], borderStyle: 'dashed', borderRadius: 14, padding: 22, backgroundColor: '#fff', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {photo
              ? <Image source={{ uri: photo.uri }} style={{ width: 44, height: 44, borderRadius: 12 }} />
              : <View style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d="wallet" size={22} /></View>}
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>{photo ? 'Factura adjunta · tocá para cambiar' : 'Cargá la factura'}</Text>
              <Text style={{ fontSize: 12, color: '#a29dba' }}>Foto del ticket fiscal</Text>
            </View>
          </TouchableOpacity>

          {/* Estos tres no están en el prototipo, pero sin ellos el club no sabe
              de qué gasto se trata ni cuánto reintegrar. */}
          <Grupo>Datos del gasto</Grupo>
          <TextInput value={place} onChangeText={(v) => { setPlace(v); setError(''); }} placeholder="Veterinaria o comercio" placeholderTextColor={colors.violet[400]} style={{ ...field, marginBottom: 10 }} />
          <TextInput value={concept} onChangeText={(v) => { setConcept(v); setError(''); }} placeholder="Concepto (consulta, vacuna…)" placeholderTextColor={colors.violet[400]} style={{ ...field, marginBottom: 10 }} />
          <TextInput value={amount} onChangeText={(v) => { setAmount(v); setError(''); }} placeholder="Monto gastado" placeholderTextColor={colors.violet[400]} keyboardType="numeric" style={{ ...field, marginBottom: 8 }} />
          <Text style={{ fontSize: 12.5, color: MUTED, marginBottom: 16 }}>Te correspondería {money(Math.round((Number(amount.replace(/\D/g, '')) * pct) / 100))} de reintegro.</Text>

          <Grupo>Datos para la acreditación</Grupo>
          <TextInput value={titular} onChangeText={(v) => { setTitular(v); setError(''); }} placeholder="Nombre del titular de la cuenta" placeholderTextColor={colors.violet[400]} style={{ ...field, marginBottom: 10 }} />
          <TextInput value={cuit} onChangeText={setCuit} placeholder="CUIT / CUIL · 20-12345678-9" placeholderTextColor={colors.violet[400]} keyboardType="numeric" style={{ ...field, marginBottom: 10 }} />
          <TextInput value={cbu} onChangeText={(v) => { setCbu(v); setError(''); }} placeholder="CBU / CVU o alias" placeholderTextColor={colors.violet[400]} style={{ ...field, marginBottom: 16 }} />

          {!!error && <Text style={{ fontSize: 12.5, color: '#b0483f', fontWeight: '600', marginBottom: 12 }}>{error}</Text>}
          <TouchableOpacity disabled={busy} onPress={submit} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</Text>
          </TouchableOpacity>
        </View>
      ) : !enviado ? (
        <TouchableOpacity onPress={() => setOpen(true)} style={{ backgroundColor: LIME, borderRadius: 14, padding: 15, alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ color: INK, fontWeight: '700', fontSize: 15 }}>+ Subir factura</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Historial</Text>
      {reintegros.length === 0 ? (
        <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 26, alignItems: 'center' }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ic d="wallet" size={22} />
          </View>
          <Text style={{ fontWeight: '600', fontSize: 14.5, color: INK }}>Todavía no pediste ningún reintegro</Text>
          <Text style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 4, lineHeight: 19 }}>Subí la factura de una consulta, vacuna o estudio y te devolvemos la parte que cubre tu plan.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {reintegros.map((h) => {
            const tone = reintTone(h.estadoRaw);
            return (
              <TouchableOpacity key={h.id} onPress={() => setSelId(h.id)} style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>{h.place}</Text>
                    <Text style={{ fontSize: 12, color: '#a29dba' }}>{h.concept} · {h.fecha}</Text>
                  </View>
                  <View style={{ backgroundColor: tone.bg, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: tone.fg }}>{h.estado}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#8781a0' }}>Gastado {money(h.spent)}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: BRAND }}>Reintegro {money(h.refund)} <Text style={{ color: colors.violet[300], fontSize: 16 }}>›</Text></Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/* ── Sub-pantalla: Foros ───────────────────────────────────────── */
/** Las mismas categorías que la webapp: antes mobile tenía cuatro y la web ocho,
 *  así que un post publicado en una podía quedar sin chip en la otra. */
/* Ver `FORO_CATEGORIAS` en @kumo/shared: la lista es una sola para las dos
   superficies, porque el chip filtra por igualdad exacta. */
const FORO_CATS = FORO_CATEGORIAS;
const CAT_TONE: Record<string, { bg: string; fg: string }> = {
  Paseadores: { bg: colors.success.bg, fg: colors.success.fg },
  Salud: { bg: colors.violet[100], fg: BRAND },
  Guarderías: { bg: '#fbf3e2', fg: '#b8860b' },
  Adiestramiento: { bg: '#e6f0fb', fg: '#2a78d6' },
  Alimentación: { bg: '#eef7d6', fg: '#5f7d10' },
  Cruzas: { bg: '#fbe8ef', fg: '#c14d7a' },
  Razas: { bg: '#e0f4f4', fg: '#177878' },
};

/* ── Hilo del foro ─────────────────────────────────────────────── */
/** El hilo del prototipo: post original, me gusta, respuestas y la caja para
 *  responder. Antes la tarjeta no se podía tocar: no había hilo ni respuestas. */
function Hilo({ p, userId, firstName, misLikes, reload, onVolver }: { p: ForumPost; userId: string; firstName: string; misLikes: { posts: string[]; answers: string[] }; reload: () => void; onVolver: () => void }) {
  const tone = CAT_TONE[p.cat] ?? { bg: colors.violet[100], fg: BRAND };
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [likePost, setLikePost] = useState(misLikes.posts.includes(p.id));
  const [likeAns, setLikeAns] = useState<string[]>(misLikes.answers);
  const [reportado, setReportado] = useState(false);

  /** Optimista: el corazón responde al toque y la base va atrás. */
  const togglePost = async () => {
    const estaba = likePost;
    setLikePost(!estaba);
    const { error } = estaba
      ? await supabase.from('post_likes').delete().eq('member_id', userId).eq('post_id', p.id)
      : await supabase.from('post_likes').insert({ member_id: userId, post_id: p.id });
    if (error) setLikePost(estaba); else await reload();
  };
  const toggleAns = async (id: string) => {
    const estaba = likeAns.includes(id);
    setLikeAns(estaba ? likeAns.filter((x) => x !== id) : [...likeAns, id]);
    const { error } = estaba
      ? await supabase.from('answer_likes').delete().eq('member_id', userId).eq('answer_id', id)
      : await supabase.from('answer_likes').insert({ member_id: userId, answer_id: id });
    if (error) setLikeAns(misLikes.answers); else await reload();
  };

  const responder = async () => {
    if (!texto.trim()) return;
    setBusy(true);
    // El contador `replies` lo actualiza el trigger, no se toca desde acá.
    await supabase.from('community_answers').insert({ post_id: p.id, author_id: userId, author_name: firstName, text: texto.trim() });
    setTexto('');
    await reload();
    setBusy(false);
  };

  /**
   * Marca (o desmarca) la mejor respuesta. Solo puede quien preguntó: la política
   * lo habilita por fila y el trigger impide que el autor de la respuesta se la
   * marque a sí mismo. Se desmarcan las otras primero porque "la mejor" es una
   * sola, y eso es una regla del producto, no de la tabla.
   */
  const marcarMejor = async (a: ForumAnswer) => {
    setBusy(true);
    if (!a.best) {
      const otras = p.answers.filter((x) => x.best && x.id !== a.id).map((x) => x.id);
      if (otras.length) await supabase.from('community_answers').update({ best: false }).in('id', otras);
    }
    const { error } = await supabase.from('community_answers').update({ best: !a.best }).eq('id', a.id);
    if (error) Alert.alert('No pudimos marcar la respuesta', 'Probá de nuevo.');
    else await reload();
    setBusy(false);
  };

  /** Borra una respuesta propia. El contador `replies` lo baja el trigger. */
  const borrarRespuesta = (id: string) => {
    Alert.alert('Borrar tu respuesta', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const { error } = await supabase.from('community_answers').delete().eq('id', id);
          if (error) Alert.alert('No pudimos borrar la respuesta', 'Probá de nuevo.');
          else await reload();
          setBusy(false);
        },
      },
    ]);
  };

  /**
   * Borra la publicación propia. Se avisa cuántas respuestas se lleva: la clave
   * ajena de `community_answers` es ON DELETE CASCADE, así que arrastra también
   * lo que escribieron otros socios.
   */
  const borrarPost = () => {
    const n = p.answers.length;
    Alert.alert(
      'Borrar tu publicación',
      n > 0 ? `Se van a borrar también las ${n} respuesta${n === 1 ? '' : 's'} que escribieron otros. No se puede deshacer.` : 'No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.from('community_posts').delete().eq('id', p.id);
            if (error) { Alert.alert('No pudimos borrar la publicación', 'Probá de nuevo.'); setBusy(false); return; }
            onVolver();
            await reload();
          },
        },
      ]
    );
  };

  /**
   * Reportar una publicación ajena.
   *
   * Pasa por la función `reportar_post` de la base: un socio no puede editar el
   * post de otro, y la RLS es por fila, así que habilitarlo para marcar
   * `reported` lo habilitaría también a reescribir el texto ajeno.
   *
   * Los motivos van en un Alert y no en chips como en la web porque en el
   * celular un menú nativo es más rápido que cuatro botones apretados.
   */
  const reportar = () => {
    Alert.alert(
      '¿Qué pasa con esta publicación?',
      'La revisa una persona del club. No se avisa a quien la escribió.',
      [
        ...MOTIVOS_REPORTE.map((motivo) => ({
          text: motivo,
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.rpc('reportar_post', { p_post_id: p.id, p_motivo: motivo });
            setBusy(false);
            if (error) { Alert.alert('No pudimos reportarla', 'Probá de nuevo.'); return; }
            setReportado(true);
          },
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]
    );
  };

  const nPost = p.likes + (likePost && !misLikes.posts.includes(p.id) ? 1 : 0) - (!likePost && misLikes.posts.includes(p.id) ? 1 : 0);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <BackLink label="Comunidad" onPress={onVolver} />
        {p.propia ? (
          <TouchableOpacity onPress={borrarPost} disabled={busy} style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#b0483f' }}>Borrar publicación</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={reportar} disabled={busy || reportado} style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: reportado ? '#2f8f5b' : MUTED }}>
              {reportado ? '✓ Reportado' : '⚑ Reportar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, overflow: 'hidden', backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ic d="person" size={19} color={tone.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>{p.author}</Text>
          <Text style={{ fontSize: 12, color: '#a29dba' }}>{p.meta}</Text>
        </View>
        <View style={{ backgroundColor: tone.bg, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: tone.fg }}>{p.cat}</Text>
        </View>
      </View>

      <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 20, lineHeight: 25, color: INK, marginBottom: 10 }}>{p.title}</Text>
      <Text style={{ fontSize: 14, color: '#4a4560', lineHeight: 22, marginBottom: 14 }}>{p.body}</Text>
      {p.photo ? <Image source={{ uri: p.photo }} style={{ width: '100%', height: 200, borderRadius: 14, marginBottom: 14, backgroundColor: colors.violet[100] }} resizeMode="cover" /> : null}

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        <TouchableOpacity onPress={togglePost} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: likePost ? '#fbe9ee' : colors.violet[100], borderRadius: 100, paddingHorizontal: 14, paddingVertical: 9 }}>
          <Ic d="heart" size={15} color={likePost ? '#c04863' : BRAND} fill />
          <Text style={{ color: likePost ? '#c04863' : BRAND, fontWeight: '600', fontSize: 13 }}>Me gusta · {nPost}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>{p.answers.length} {p.answers.length === 1 ? 'respuesta' : 'respuestas'}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: '#eeecf5' }} />
      </View>

      <View style={{ gap: 14 }}>
        {p.answers.map((a) => {
          const yo = likeAns.includes(a.id);
          const n = a.likes + (yo && !misLikes.answers.includes(a.id) ? 1 : 0) - (!yo && misLikes.answers.includes(a.id) ? 1 : 0);
          return (
            <View key={a.id} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#ece9f5', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: BRAND }}>{a.author.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <Text style={{ fontWeight: '700', fontSize: 13.5, color: INK }}>{a.propia ? 'Vos' : a.author}</Text>
                    {a.best ? (
                      <View style={{ backgroundColor: '#e2f5ea', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#2f8f5b' }}>★ Mejor respuesta</Text>
                      </View>
                    ) : null}
                    <Text style={{ fontSize: 11, color: '#a29dba', marginLeft: 'auto' }}>{a.when}</Text>
                  </View>
                  <Text style={{ fontSize: 13.5, color: '#4a4560', lineHeight: 21 }}>{a.text}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6, paddingLeft: 4 }}>
                  <TouchableOpacity onPress={() => toggleAns(a.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ic d="heart" size={13} color={yo ? '#c04863' : '#8781a0'} fill={yo} />
                    <Text style={{ fontSize: 12, color: yo ? '#c04863' : '#8781a0' }}>{n}</Text>
                  </TouchableOpacity>
                  {a.propia ? (
                    <TouchableOpacity onPress={() => borrarRespuesta(a.id)} disabled={busy}>
                      <Text style={{ fontSize: 12, color: MUTED }}>Borrar</Text>
                    </TouchableOpacity>
                  ) : null}
                  {/* La mejor respuesta la marca solo quien preguntó. */}
                  {p.propia && !a.propia ? (
                    <TouchableOpacity onPress={() => marcarMejor(a)} disabled={busy}>
                      <Text style={{ fontSize: 12, fontWeight: a.best ? '700' : '400', color: a.best ? '#2f8f5b' : MUTED }}>
                        {a.best ? '★ Es la mejor' : 'Marcar como mejor'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
        {p.answers.length === 0 ? (
          <Text style={{ fontSize: 13.5, color: MUTED, lineHeight: 20 }}>Todavía no hay respuestas. Sé la primera persona en responder.</Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 18, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 100, paddingLeft: 16, padding: 5 }}>
        <TextInput value={texto} onChangeText={setTexto} placeholder="Escribí una respuesta…" placeholderTextColor={colors.violet[400]} style={{ flex: 1, fontSize: 14, color: INK, paddingVertical: 6 }} />
        <TouchableOpacity disabled={busy || !texto.trim()} onPress={responder} style={{ width: 38, height: 38, borderRadius: 19, overflow: 'hidden', backgroundColor: texto.trim() ? BRAND : '#c7c1de', alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Line x1="12" y1="19" x2="12" y2="5" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            <Path d="M5 12l7-7 7 7" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ── Sub-pantalla: Foros ───────────────────────────────────────── */
function Foros({ posts, userId, firstName, misLikes, reload }: { posts: ForumPost[]; userId: string; firstName: string; misLikes: { posts: string[]; answers: string[] }; reload: () => void }) {
  const [vista, setVista] = useState<'lista' | 'componer'>('lista');
  const [hiloId, setHiloId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  // Compose
  const [cat, setCat] = useState<string>(FORO_CATEGORIA_DEFECTO);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [zona, setZona] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);

  const ql = q.trim().toLowerCase();
  const list = posts.filter((p) => (filtro === 'Todos' || p.cat === filtro) && (!ql || `${p.title} ${p.body} ${p.author}`.toLowerCase().includes(ql)));

  const hilo = posts.find((p) => p.id === hiloId);
  if (hilo) return <Hilo p={hilo} userId={userId} firstName={firstName} misLikes={misLikes} reload={reload} onVolver={() => setHiloId(null)} />;

  const field = { borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' } as const;

  /** Misma subida que la foto de mascota, con el prefijo del foro. */
  const elegirFoto = async () => {
    setFotoBusy(true); setError('');
    const r = await elegirYSubirFoto(userId, 'foro-');
    if ('url' in r) setFotoUrl(r.url);
    else if ('error' in r) setError(r.error);
    setFotoBusy(false);
  };

  const publicar = async () => {
    if (!title.trim()) { setError('Ponele un título a tu publicación.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('community_posts').insert({
      author_id: userId, author_name: firstName, category: cat,
      title: title.trim(), body: body.trim() || title.trim(), zone: zona.trim() || null,
      photo_url: fotoUrl,
    });
    if (e) { setError('No pudimos publicar. Probá de nuevo.'); setBusy(false); return; }
    setTitle(''); setBody(''); setZona(''); setFotoUrl(null);
    setBusy(false); setListo(true);
    await reload();
  };

  if (vista === 'componer') {
    if (listo) {
      return (
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Svg width={34} height={34} viewBox="0 0 24 24"><Path d="M20 6L9 17l-5-5" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </View>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK, marginBottom: 8 }}>¡Publicado!</Text>
          <Text style={{ color: MUTED, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 }}>Tu publicación ya está en la comunidad. Te avisamos cuando alguien responda.</Text>
          <TouchableOpacity onPress={() => { setListo(false); setVista('lista'); }} style={{ alignSelf: 'stretch', backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Volver a la comunidad</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <BackLink label="Comunidad" onPress={() => setVista('lista')} />
        <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK, marginBottom: 2 }}>Nueva publicación</Text>
        <Text style={{ color: '#8781a0', fontSize: 14, marginBottom: 18 }}>Compartí tu experiencia o hacé una pregunta a la comunidad.</Text>

        <SheetLabel>Categoría</SheetLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }} style={{ marginBottom: 16 }}>
          {FORO_CATS.map((c) => (
            <TouchableOpacity key={c} onPress={() => setCat(c)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 100, backgroundColor: cat === c ? BRAND : colors.violet[100] }}>
              <Text style={{ fontWeight: '600', fontSize: 13, color: cat === c ? '#fff' : BRAND }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <SheetLabel>Título</SheetLabel>
        <TextInput value={title} onChangeText={(v) => { setTitle(v); setError(''); }} placeholder="Ej: ¿Alguien probó a Lucas de Paseos Palermo?" placeholderTextColor={colors.violet[400]} style={{ ...field, marginBottom: 12 }} />

        <SheetLabel>Contanos más</SheetLabel>
        <TextInput value={body} onChangeText={setBody} multiline placeholder="Escribí tu consulta o experiencia…" placeholderTextColor={colors.violet[400]} style={{ ...field, height: 120, textAlignVertical: 'top', marginBottom: 12 }} />

      {/* La zona del posteo alimenta el filtro de la lista, que compara texto: sin
          elegirla de una lista, cada persona escribía su barrio distinto y el filtro
          se llenaba de zonas de una sola publicación. */}
      <CampoZona label="Zona · opcional" valor={zona} onCambio={setZona} onElegir={(z) => setZona(z.zona)} />

        {/* La fila de foto del prototipo: miniatura, texto y el "+". */}
        <TouchableOpacity disabled={fotoBusy} onPress={elegirFoto} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 18 }}>
          <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {fotoUrl
              ? <Image source={{ uri: fotoUrl }} style={{ width: '100%', height: '100%' }} />
              : <Ic d="image" size={17} color={BRAND} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600', fontSize: 13, color: INK }}>{fotoBusy ? 'Subiendo…' : fotoUrl ? 'Foto agregada' : 'Agregá una foto'}</Text>
            <Text style={{ fontSize: 11, color: '#a29dba' }}>Opcional</Text>
          </View>
          <Text style={{ color: BRAND, fontSize: 20, fontWeight: '700' }}>{fotoUrl ? '✓' : '+'}</Text>
        </TouchableOpacity>

        {!!error && <Text style={{ fontSize: 12.5, color: '#b0483f', fontWeight: '600', marginBottom: 12 }}>{error}</Text>}
        <TouchableOpacity disabled={busy} onPress={publicar} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{busy ? 'Publicando…' : 'Publicar'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <H1>Comunidad</H1>
        <TouchableOpacity onPress={() => setVista('componer')} style={{ backgroundColor: BRAND, borderRadius: 100, paddingVertical: 9, paddingHorizontal: 14, marginTop: 4 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>+ Publicar</Text>
        </TouchableOpacity>
      </View>
      <Sub>Preguntá, opiná y encontrá recomendaciones reales.</Sub>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 14, paddingHorizontal: 14, marginBottom: 12 }}>
        <Ic d="search" size={17} color="#a29dba" />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar en la comunidad…" placeholderTextColor={colors.violet[400]} style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: INK }} />
        {q ? <TouchableOpacity onPress={() => setQ('')}><Text style={{ color: '#a29dba', fontSize: 18 }}>×</Text></TouchableOpacity> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 10 }}>
        {['Todos', ...FORO_CATS].map((c) => (
          <TouchableOpacity key={c} onPress={() => setFiltro(c)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 100, backgroundColor: filtro === c ? BRAND : colors.violet[100] }}>
            <Text style={{ fontWeight: '600', fontSize: 13, color: filtro === c ? '#fff' : BRAND }}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={{ fontSize: 12.5, color: '#a29dba', marginBottom: 14 }}>{list.length} {list.length === 1 ? 'publicación' : 'publicaciones'}</Text>

      {list.length === 0 ? (
        <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#ded8f0', borderStyle: 'dashed', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 30, alignItems: 'center' }}>
          <Text style={{ fontFamily: FH, fontWeight: '700', fontSize: 16, color: INK, marginBottom: 5 }}>{posts.length === 0 ? 'La comunidad está arrancando' : 'Sin resultados'}</Text>
          <Text style={{ fontSize: 13.5, color: '#8781a0', textAlign: 'center', lineHeight: 20 }}>{posts.length === 0 ? 'Todavía no hay publicaciones. Hacé la primera pregunta.' : 'Probá con otra búsqueda o categoría.'}</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {list.map((p) => {
            const tone = CAT_TONE[p.cat] ?? { bg: colors.violet[100], fg: BRAND };
            return (
              <TouchableOpacity key={p.id} onPress={() => setHiloId(p.id)} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0eef7', borderRadius: 20, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: tone.bg, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ fontSize: 11, fontWeight: '700', color: tone.fg }}>{p.cat}</Text></View>
                  {p.trend ? <View style={{ backgroundColor: LIME, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ fontSize: 10, fontWeight: '800', color: INK }}>EN TENDENCIA</Text></View> : null}
                  <Text style={{ fontSize: 11.5, color: '#a29dba' }}>{p.author} · {p.meta}</Text>
                </View>
                <Text style={{ fontFamily: FH, fontWeight: '700', fontSize: 16, lineHeight: 20, color: INK, marginBottom: 5 }}>{p.title}</Text>
                <Text numberOfLines={2} style={{ fontSize: 13, color: '#8781a0', lineHeight: 19, marginBottom: 12 }}>{p.body}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.violet[100], borderRadius: 100, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6 }}><Ic d="chat" size={14} color={BRAND} /><Text style={{ fontSize: 12, fontWeight: '700', color: BRAND }}>{p.replies}</Text></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fbe9ee', borderRadius: 100, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6 }}><Ic d="heart" size={14} color="#c04863" fill /><Text style={{ fontSize: 12, fontWeight: '700', color: '#c04863' }}>{p.likes}</Text></View>
                  <Text style={{ marginLeft: 'auto', color: BRAND, fontWeight: '700', fontSize: 12.5 }}>Ver hilo ›</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/* ── Barra inferior + shell ────────────────────────────────────── */
const TABS_TODO: { k: Tab; label: string; icon: IconName }[] = [
  { k: 'inicio', label: 'Inicio', icon: 'house' },
  { k: 'carnet', label: 'Carnet', icon: 'idcard' },
  { k: 'servicios', label: 'Servicios', icon: 'paw' },
  { k: 'beneficios', label: 'Beneficios', icon: 'tag' },
  { k: 'foros', label: 'Foros', icon: 'chat' },
];

/**
 * La barra del socio gratuito no tiene Beneficios.
 *
 * Y no se reemplaza por una pestaña de "Pagá": una pestaña permanente que empuja a
 * pagar es acoso. La invitación vive en Inicio, en Mi perfil y en el menú "Más",
 * donde se entra a propósito. La barra usa `flex: 1` por ítem, así que con cuatro
 * se reacomoda sola.
 *
 * Se filtra contra `FEATURES_PAGAS` de `@kumo/shared`, la misma lista que usa la
 * webapp para su menú.
 */
const tabsDe = (pago: boolean) =>
  pago ? TABS_TODO : TABS_TODO.filter((t) => !FEATURES_PAGAS.includes(t.k as FeaturePaga));

/** Última vez que el socio miró las notificaciones. No hace falta tabla: alcanza con el dispositivo. */
const VISTO_KEY = 'kumo:notif-visto';

export default function App() {
  const [screen, setScreen] = useState<Screen>('inicio');
  const [petIdx, setPetIdx] = useState(0);
  const [masOpen, setMasOpen] = useState(false);
  /** La hoja para elegir plan y pagar. Antes era un muro que tapaba todo, tabbar
   *  incluida; ahora se abre a pedido, porque el socio ya está adentro del club. */
  const [planAbierto, setPlanAbierto] = useState(false);
  /**
   * El alta terminada, esperando que la persona toque "Entrar a la app".
   *
   * Vive acá y no dentro del alta porque abrir la sesión —que hace falta para
   * pagar— cambia el árbol y desmontaría el formulario con su pantalla final
   * adentro. Acá arriba, además, sobrevive el viaje al navegador de Mercado Pago.
   */
  const [altaListo, setAltaListo] = useState<{ memberNo: number; avisoFoto: string | null; pagar: { plan: string; odonto: boolean } | null } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  /**
   * Hay sesión, pero ¿hay socio?
   *
   * Con Google la sesión se abre ANTES de que exista el perfil, así que mirar solo
   * `userId` no alcanza: sin esto, quien entra con Google por primera vez cae en la
   * app del socio contra datos vacíos y lee "todavía no cargaste mascotas".
   * `null` = todavía no sabemos.
   */
  const [perfilExiste, setPerfilExiste] = useState<boolean | null>(null);
  /** Lo que Google sabe de la persona, para no volver a pedírselo en el alta. */
  const [identidad, setIdentidad] = useState<{ nombre: string; email: string }>({ nombre: '', email: '' });
  /** El link del mail para elegir una clave nueva. Se atiende ANTES del gate de
   *  sesión: al poner la sesión, `userId` pasa a tener valor y una pantalla que
   *  viva debajo del gate se desmontaría en el acto. */
  const [recuperando, setRecuperando] = useState(false);
  const [linkFallado, setLinkFallado] = useState<string | null>(null);
  const [visto, setVisto] = useState<string | null>(null);
  /** null = todavía no se tocó nada, vale lo que trajo la base. */
  const [optimistaGuardados, setOptimistaGuardados] = useState<string[] | null>(null);
  const [fontsLoaded] = useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  const { data, loading, error: errorDatos, reload } = useKumoData(userId);

  useEffect(() => {
    /** Google devuelve el nombre en los metadatos del usuario, con una clave u
     *  otra según el proveedor. Si no viene, el alta lo pide como siempre. */
    const identidadDe = (u: { email?: string | null; user_metadata?: Record<string, unknown> } | undefined) => ({
      nombre: String(u?.user_metadata?.full_name ?? u?.user_metadata?.name ?? ''),
      email: u?.email ?? '',
    });
    supabase.auth.getSession().then(({ data: s }) => {
      setUserId(s.session?.user.id ?? null);
      setIdentidad(identidadDe(s.session?.user));
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      setIdentidad(identidadDe(session?.user));
      setScreen('inicio'); setPetIdx(0); setMasOpen(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { AsyncStorage.getItem(VISTO_KEY).then(setVisto); }, []);

  /*
   * Los links que abren la app: la vuelta de Google y el mail de contraseña nueva.
   *
   * Hacen falta los dos caminos, no uno: `getInitialURL` cubre el arranque en frío
   * (la app estaba cerrada y el link la abrió) y el listener, cuando ya estaba
   * abierta en segundo plano. Con uno solo, la mitad de los casos no anda.
   */
  /** `reload` cambia por render y el efecto de los links corre una sola vez: la
   *  ref es lo que deja llamar a la versión viva sin re-suscribir el listener. */
  const refReload = useRef<(() => void) | null>(null);
  refReload.current = reload;

  useEffect(() => {
    let vivo = true;
    const atender = async (url: string | null) => {
      if (!url || !vivo) return;
      const r = await resolverURL(url);
      if (!r || !vivo) return;
      if (r.tipo === 'error') { setLinkFallado(r.motivo); setRecuperando(true); return; }
      if (r.tipo === 'recuperar') { setLinkFallado(null); setRecuperando(true); }
      /*
       * La vuelta del pago. El id viaja en el link porque con el cobro por plan
       * el perfil no conoce la suscripción hasta el webhook (~25 segundos): sin
       * esto, la app recargaba desde la base, la base no sabía nada todavía, y
       * el socio veía su plan inactivo hasta refrescar a mano. `confirmar` le
       * pregunta a Mercado Pago directo con este id, acredita en el momento
       * (verifica del lado del servidor que la suscripción sea de esta sesión)
       * y recién entonces se recarga — el orden importa: recargar primero es
       * volver a leer el estado viejo.
       */
      if (r.tipo === 'pago') {
        await confirmarSuscripcion(r.preapprovalId);
        refReload.current?.();
        return;
      }
      // Google no necesita nada más: la sesión ya quedó puesta y
      // `onAuthStateChange` se encarga del resto.
    };
    Linking.getInitialURL().then(atender);
    const sub = Linking.addEventListener('url', (e) => atender(e.url));
    return () => { vivo = false; sub.remove(); };
  }, []);

  /** Tocar un push abre la pantalla del aviso, no el inicio. Se filtra contra la
   *  lista de destinos posibles: el `data` de una notificación es texto que entra
   *  de afuera, y no queremos que decida a dónde navegar. */
  useEffect(() => alTocarNotificacion((pantalla) => {
    if (pantalla === 'carnet' || pantalla === 'reintegros' || pantalla === 'minegocio') setScreen(pantalla);
  }), []);

  /*
   * Al volver a la app, recargar.
   *
   * El caso que importa es el del muro: el socio se va al navegador a autorizar el
   * débito y vuelve. El acceso lo da el aviso de Mercado Pago a nuestro servidor y
   * puede tardar unos segundos, así que la app vuelve a preguntar en lugar de
   * mostrarle el muro sobre una cuota que ya está paga.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active' || !userId) return;
      /*
       * Confirmar ANTES de recargar, no solo recargar. El que vuelve del
       * navegador sin tocar el botón de /suscripcion/listo (cambió de app a
       * mano) no trae deep link, y recargar solo lee la base — que hasta que
       * llega el webhook no sabe del pago. `confirmar` sin id le pregunta a
       * Mercado Pago por la suscripción que el perfil ya tenga, acredita lo que
       * esté aprobado y de paso repone cualquier aviso que se haya perdido. Para
       * el socio sin suscripción es un pedido que vuelve enseguida vacío.
       */
      void confirmarSuscripcion().finally(() => reload());
    });
    return () => sub.remove();
  }, [userId, reload]);

  /*
   * Registro para push, cada vez que hay un socio adentro.
   *
   * Va acá y no en el login porque también corre cuando la app arranca con la
   * sesión ya guardada, que es el caso normal: el token de Expo puede cambiar
   * (reinstalación, restore del sistema) y hay que reponerlo sin pedirle nada al
   * socio. Si el aparato no puede recibir push —emulador, permiso denegado, falta
   * FCM— se sale en silencio: la app funciona igual y no hay nada que el socio
   * pueda hacer con ese error.
   */
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      // Si apagó el switch de Notificaciones, no se lo vuelve a registrar por la
      // espalda en el próximo arranque.
      if (!(await pushActivo())) return;
      const r = await registrarDispositivo(userId);
      if (vivo && !r.ok) console.warn('[push] sin registrar:', r.motivo);
    })();
    return () => { vivo = false; };
  }, [userId]);

  /*
   * El acceso también se corta en el celular.
   *
   * La webapp lo hace en el servidor, en `/app`; acá hay que preguntarlo, porque
   * la sesión vive en el teléfono y se abre sin pasar por ningún servidor nuestro.
   * Se chequea en cada arranque y en cada login: un socio suspendido tiene un token
   * perfectamente válido, lo que cambió es que el club le cortó el acceso.
   */
  useEffect(() => {
    if (!userId) { setPerfilExiste(null); return; }
    let vivo = true;
    (async () => {
      // `maybeSingle` y no `single`: con Google la sesión existe antes que el
      // perfil, y `single` trata esa fila ausente como un error, así que ni se
      // sabía que faltaba el alta ni corría el aviso de cuenta suspendida.
      const { data } = await supabase.from('profiles').select('status, role').eq('id', userId).maybeSingle();
      if (!vivo) return;
      setPerfilExiste(!!data);
      if (!data) return;
      // El admin no es socio: su estado no lo bloquea.
      // Solo 'activo' entra. La cuota vencida NO cierra la sesión: para eso está
      // el muro de la cuota, que le ofrece pagar en lugar de echarlo del club.
      if (data.role !== 'socio' || data.status === 'activo') return;
      Alert.alert(
        data.status === 'suspendido' ? 'Tu cuenta está suspendida' : 'Tu membresía está dada de baja',
        data.status === 'suspendido'
          ? 'No podés entrar por ahora. Escribinos por WhatsApp y lo resolvemos.'
          : 'Si querés volver al club, escribinos por WhatsApp.',
      );
      await olvidarDispositivo();
      await supabase.auth.signOut();
    })();
    return () => { vivo = false; };
  }, [userId]);

  /** Tocar la notificación abre la pantalla que corresponde, no el inicio. */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((ev) => {
      const pantalla = ev.notification.request.content.data?.pantalla;
      if (typeof pantalla === 'string') setScreen(pantalla as Screen);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded || !authReady) return <View style={{ flex: 1, backgroundColor: '#fff' }} />;

  const go = (t: Screen) => { setMasOpen(false); setScreen(t); };

  /** ¿Tiene la cuota paga? Es la misma verdad que mira la RLS en la base. */
  const pago = tieneFeaturesPagas(data?.profile?.debePagar ?? false);
  const TABS = tabsDe(pago);
  /** El plan más barato que el club tiene cargado, para el "desde" del banner. En 0
   *  si no hay planes: ahí el banner no aparece en vez de decir "desde $0". */
  const desdePlan = data?.planes?.length ? Math.min(...data.planes.map((x) => x.basePrice)) : 0;
  /* Ya compró un plan y está entrando el cobro: el banner que ofrece planes se
     esconde hasta que se acredite. */
  const acreditandose = data?.profile?.suscripcion === 'authorized' && !data?.profile?.cuotaHasta;
  /*
   * La pantalla se DERIVA, no se corrige con un efecto.
   *
   * Si a alguien se le vence la cuota estando en Beneficios, `screen` sobrevive al
   * recargar y la lista le vuelve vacía por RLS: leería "todavía no hay beneficios
   * activos", o sea una mentira sobre el club.
   *
   * Y de paso tapa un agujero que ya existía: hay dos listeners de push que navegan,
   * y uno de ellos hace `setScreen` con lo que venga en el aviso sin validar nada.
   */
  const pantalla: Screen = !pago && FEATURES_PAGAS.includes(screen as FeaturePaga) ? 'inicio' : screen;
  const pets = data?.pets ?? [];
  const safeIdx = Math.min(petIdx, Math.max(pets.length - 1, 0));

  // Las notificaciones salen de los mismos datos que la webapp, con la misma
  // función compartida: si acá se armaran aparte, las dos apps se separarían.
  const notifGroups = data ? buildNotifs(data.notifInput) : [];
  const noLeidas = contarNoLeidas(notifGroups, visto);
  const marcarLeidas = () => { const ahora = new Date().toISOString(); AsyncStorage.setItem(VISTO_KEY, ahora); setVisto(ahora); };

  // Optimista: el corazón responde al toque y la base va atrás; si falla, se
  // deshace para no mostrar un guardado que no existe.
  const guardados = optimistaGuardados ?? data?.guardados ?? [];
  const toggleGuardado = async (id: string) => {
    if (!userId) return;
    const estaba = guardados.includes(id);
    setOptimistaGuardados(estaba ? guardados.filter((x) => x !== id) : [...guardados, id]);
    const { error } = estaba
      ? await supabase.from('provider_favorites').delete().eq('member_id', userId).eq('provider_id', id)
      : await supabase.from('provider_favorites').insert({ member_id: userId, provider_id: id });
    if (error) setOptimistaGuardados(guardados);
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.phone}>
        {/* Status bar dibujada: hora, señal y batería. Va SOLO en web, donde la
            app se muestra dentro de un marco de teléfono y esto completa la
            simulación del prototipo. En el celular real el sistema ya pone la
            suya con la hora y la batería de verdad, así que dejarla acá mostraba
            dos, una arriba de la otra, y la falsa marcando 9:41 para siempre. */}
        {isWeb && (
          <View style={styles.statusbar}>
            <Text style={styles.statusTime}>9:41</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Svg width={17} height={17} viewBox="0 0 24 24" fill={INK}><Path d="M12 5C7.5 5 3.7 6.8 1.5 9.6L12 21 22.5 9.6C20.3 6.8 16.5 5 12 5z" /></Svg>
              <Svg width={24} height={12} viewBox="0 0 27 12"><Rect x="1" y="1" width="22" height="10" rx="3" fill="none" stroke={INK} strokeWidth={1.4} /><Rect x="3" y="3" width="16" height="6" rx="1.5" fill={INK} /><Rect x="24" y="4" width="2.4" height="4" rx="1" fill={INK} /></Svg>
            </View>
          </View>
        )}
        {/* Si una consulta falló, se dice. Antes el error se tragaba y la
            pantalla mostraba el estado vacío como si la cuenta no tuviera nada:
            un socio con mascota veía "todavía no cargaste mascotas". */}
        {/* Durante el alta no se muestra: quien está completándola no es socio
            todavía, así que ningún dato de socio le falta ni le sirve. Es la
            segunda mitad del mismo arreglo que el de useKumoData — ahí se dejó de
            REPORTAR el perfil ausente, acá se deja de MOSTRAR cualquier otro error
            de datos a alguien que está en medio del formulario y no puede hacer
            nada al respecto. */}
        {userId && errorDatos && perfilExiste !== false ? (
          <View style={{ backgroundColor: '#fbeceb', borderBottomWidth: 1, borderBottomColor: '#efd3cf', paddingHorizontal: 20, paddingVertical: 10 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#9c3b32', marginBottom: 2 }}>No pudimos traer todos tus datos</Text>
            <Text style={{ fontSize: 11.5, color: '#9c3b32', lineHeight: 16 }}>{errorDatos}</Text>
          </View>
        ) : null}
        {/* El orden importa. La clave nueva va PRIMERO porque al ponerse la sesión
            `userId` deja de estar vacío, y si esta pantalla viviera más abajo se
            desmontaría justo cuando la persona está por escribir la contraseña. */}
        {recuperando ? (
          <NuevaClave
            motivoSinSesion={linkFallado}
            onPedirOtro={() => { setRecuperando(false); setLinkFallado(null); }}
            onListo={() => { setRecuperando(false); setLinkFallado(null); }}
          />
        ) : !userId ? (
          <Entrada />
        ) : perfilExiste === false ? (
          /* Sesión sin socio: entró con Google y todavía no completó el alta. Va al
             mismo formulario, con la identidad resuelta y sin pedir contraseña.
             Salir cierra la sesión: si no, esta misma pantalla lo volvería a
             recibir en un bucle. */
          <Alta
            identidad={identidad}
            onSalir={() => { supabase.auth.signOut(); }}
            onListo={(r) => { setAltaListo(r); setPerfilExiste(null); }}
          />
        ) : loading || !data ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={BRAND} />
          </View>
        ) : (
          <>
        {/* Header fijo: las notificaciones y el menú viven acá y no dentro de
            Inicio para que sigan a mano desde cualquier pantalla. El saludo, en
            cambio, va solo en Inicio: en las otras no aporta y se apoyaba encima
            del contenido (se veía pegado en la ficha del prestador). */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 12 }}>
          {screen === 'inicio' ? (
            <View>
              <Text style={{ fontSize: 13, color: colors.violet[400], marginBottom: 4 }}>Hola de nuevo</Text>
              <Text style={{ fontSize: 23, fontWeight: '800', fontFamily: FH, color: INK }}>{data.profile?.firstName ?? 'Socio'}</Text>
            </View>
          ) : <View />}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => go('notif')} style={{ width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: screen === 'notif' ? BRAND : colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
              <Ic d="bell" size={21} color={screen === 'notif' ? '#fff' : BRAND} />
              {noLeidas > 0 && screen !== 'notif' && (
                <View style={{ position: 'absolute', top: 3, right: 3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: LIME, borderWidth: 2, borderColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: INK }}>{noLeidas > 9 ? '9+' : noLeidas}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMasOpen(true)} style={{ width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: masOpen ? BRAND : colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
              <Ic d="menu" size={22} color={masOpen ? '#fff' : BRAND} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          {pantalla === 'inicio' && <Inicio pets={pets} petIdx={safeIdx} setPetIdx={setPetIdx} go={go} pago={pago} desdePlan={acreditandose ? 0 : desdePlan} onPlan={() => setPlanAbierto(true)} />}
          {pantalla === 'carnet' && <Carnet pets={pets} petIdx={safeIdx} setPetIdx={setPetIdx} contacts={data.contacts} userId={userId} reload={reload} go={go} />}
          {pantalla === 'servicios' && <Servicios centro={data.centro} providers={data.providers} guardados={guardados} onGuardar={toggleGuardado} onPrestar={() => go('prestar')} reviews={data.reviews} userId={userId} firstName={data.profile?.firstName ?? 'Socio'} reload={reload} />}
          {pantalla === 'prestar' && <Prestar userId={userId} phone={data.profile?.phone ?? ''} onVolver={() => go('servicios')} onNegocio={() => go('minegocio')} reload={reload} />}
          {pantalla === 'beneficios' && pago && <Beneficios benefits={data.benefits} go={go} centro={data.centro} profile={data.profile} />}
          {pantalla === 'reintegros' && pago && <Reintegros profile={data.profile} pets={pets} reintegros={data.reintegros} reintTotal={data.reintTotal} userId={userId} reload={reload} go={go} />}
          {pantalla === 'foros' && <Foros posts={data.posts} userId={userId} firstName={data.profile?.firstName ?? 'Socio'} misLikes={data.misLikes} reload={reload} />}
          {pantalla === 'perfil' && <Perfil profile={data.profile} pagos={data.pagos} go={go} reload={reload} pago={pago} onPlan={() => setPlanAbierto(true)} />}
          {pantalla === 'mismascotas' && <MisMascotas pets={pets} reintegros={data.reintegros} userId={userId} reload={reload} go={go} setPetIdx={setPetIdx} />}
          {pantalla === 'guardados' && <Guardados providers={data.providers} guardados={guardados} onAbrir={() => go('servicios')} />}
          {pantalla === 'minegocio' && <Negocio negocios={data.negocios} userId={userId} phone={data.profile?.phone ?? ''} reload={reload} />}
          {pantalla === 'notif' && <Notificaciones groups={notifGroups} visto={visto} marcarLeidas={marcarLeidas} go={go} userId={userId} />}
        </View>
        <View style={styles.tabbar}>
          {TABS.map((t) => {
            const active = pantalla === t.k && !masOpen;
            return (
              <Pressable key={t.k} onPress={() => go(t.k as Screen)} style={styles.tabitem}>
                {/* overflow: 'hidden' no es decorativo. En Android el fondo redondeado
                    se dibujaba cuadrado desde que el SDK 57 prendió la New
                    Architecture: el hijo (el SVG del ícono) no respeta el radio del
                    contenedor y la doc de React Native manda justamente esto cuando
                    "the rounded border is not visible". En web y en iOS no pasaba,
                    así que solo se ve en el APK. */}
                <View style={{ backgroundColor: active ? LIME : 'transparent', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 4 }}>
                  <Ic d={t.icon} size={22} color={active ? BRAND : colors.violet[400]} fill={t.icon === 'paw' && active} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: active ? '700' : '500', color: active ? BRAND : colors.violet[400], marginTop: 3 }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {masOpen && <MasSheet onClose={() => setMasOpen(false)} onGo={go} pago={pago} onPlan={() => { setMasOpen(false); setPlanAbierto(true); }} />}
          </>
        )}
        {/* La pantalla final del alta, por encima de todo: es lo primero que ve quien
            acaba de darse de alta, y de acá sale el pago si eligió un plan. */}
        {altaListo && data?.profile ? (
          <AltaListo
            memberNo={altaListo.memberNo || Number(String(data.profile.memberNo).replace(/\D/g, "")) || 0}
            avisoFoto={altaListo.avisoFoto}
            pagar={altaListo.pagar}
            mascotas={pets.map((m) => ({ id: m.id, nombre: m.name, especie: m.species, raza: m.breed, edad: m.age }))}
            planName={data.profile.planName}
            debePagar={data.profile.debePagar}
            onEntrar={() => setAltaListo(null)}
            recargar={reload}
          />
        ) : null}
        {/* La hoja del plan, a pedido. Ya no tapa nada: entrar es gratis y lo que se
            paga son los reintegros y los beneficios. Se abre desde Inicio, el menú
            "Más" y Mi perfil. */}
        {planAbierto && data?.profile && (
          <HojaPlan
            profile={data.profile}
            planes={data.planes}
            recargar={reload}
            onClose={() => setPlanAbierto(false)}
            irABeneficios={() => { setPlanAbierto(false); go('beneficios'); }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const isWeb = Platform.OS === 'web';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: isWeb ? '#e7e4f0' : '#fff', alignItems: 'center' },
  phone: isWeb
    ? { flex: 1, width: '100%', maxWidth: 392, backgroundColor: '#fff', borderRadius: 40, overflow: 'hidden', marginVertical: 12 }
    // Acá había un paddingTop calculado a mano con StatusBar.currentHeight,
    // porque el SafeAreaView de react-native no reservaba nada en Android. Ese
    // SafeAreaView quedó deprecado en el SDK 57 y lo reemplazó el de
    // react-native-safe-area-context (ver index.tsx), que sí aplica el inset real
    // en las dos plataformas — y además el de abajo, que antes no reservábamos y
    // ahora importa: con edge-to-edge obligatorio, la barra de navegación de
    // Android se comía el borde del tabbar. Así que este padding vuelve a ser
    // solo aire, igual en Android y en iOS.
    : { flex: 1, width: '100%', backgroundColor: '#fff', paddingTop: 6 },
  statusbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 4 },
  statusTime: { fontSize: 13, fontWeight: '700', color: INK },
  screen: { padding: 20, paddingBottom: 40 },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.violet[200], backgroundColor: '#fff', paddingTop: 8, paddingBottom: 10 },
  tabitem: { flex: 1, alignItems: 'center' },
});

