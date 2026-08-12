import { useState, useEffect, createElement, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text as RNText, View, TouchableOpacity, TextInput, Pressable, Image, ImageBackground, ImageSourcePropType, Platform, TextProps, Linking, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  colors,
  buildNotifs, contarNoLeidas, notifTiempo, NOTIF_STYLE, type NotifGroup,
  buildCalMes, buildPickerMes, calMesLabel, calDiaLabel, fmtFechaCorta, hoyISO, CAL_TONE, CAL_DIAS, VACUNA_KINDS, KIND_ICON,
  ratingLabel, reviewTiempo, reintPasos, pasoWhen, REINT_TONE, buildPetHistory, type PetEvento,
  type CalCell, type VaccineKind, type Review,
} from '@kumo/shared';
import { supabase } from './lib/supabase';
import { useKumoData, type Pet, type Vac, type Profile, type ProviderVM, type BenefitVM, type ReintVM, type ForumPost, type MiNegocio } from './lib/useKumoData';
import Login from './components/Login';

/* Familias (Baloo 2 títulos, DM Sans cuerpo) — igual que la web. */
const FH = 'Baloo2_800ExtraBold';   // títulos
const FREG = 'DMSans_500Medium';    // cuerpo

/* Text base: DM Sans en toda la app; los estilos propios (incl. fontFamily de títulos) pisan el default. */
const Text = (props: TextProps) => createElement(RNText, { ...props, style: [{ fontFamily: FREG, color: colors.text }, props.style] });

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
/** Del ícono genérico que devuelve `KIND_ICON` al nombre que entiende `Ic`. */
const VAC_IC = { shield: 'shield', pill: 'pill', plus: 'hospital' } as const;

/* ── Iconos (react-native-svg) ─────────────────────────────────── */
type IconName = 'paw' | 'house' | 'idcard' | 'chat' | 'wallet' | 'tag' | 'menu' | 'bell' | 'shield' | 'search' | 'calendar' | 'store' | 'person' | 'heart' | 'hospital' | 'pill' | 'droplet' | 'pin' | 'globe' | 'instagram' | 'phone';
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
      {d === 'heart' && <Path d="M12 20s-7-4.3-9.2-8.6C1.3 8.3 2.6 5 6 5c2 0 3.3 1.2 4 2.3C10.7 6.2 12 5 14 5c3.4 0 4.7 3.3 3.2 6.4C19 15.7 12 20 12 20z" fill={fill ? color : 'none'} stroke={fill ? 'none' : color} strokeWidth={1.9} strokeLinejoin="round" />}
      {d === 'hospital' && <><Rect x="4" y="4" width="16" height="16" rx="3" {...common} /><Line x1="12" y1="8" x2="12" y2="16" {...common} /><Line x1="8" y1="12" x2="16" y2="12" {...common} /></>}
      {d === 'pill' && <><Rect x="3" y="8" width="18" height="8" rx="4" {...common} /><Line x1="12" y1="8" x2="12" y2="16" {...common} /></>}
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

/* La foto puede venir del bundle (seed) o de Storage (subida por el socio). */
const petImg = (photo: string): ImageSourcePropType =>
  IMG[photo] ?? (photo.startsWith('http') ? { uri: photo } : IMG['happy-dog.webp']!);

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
          <Text style={{ color: colors.violet[300], fontSize: 12 }}>{detailed ? pet.breed : `Plan ${pet.plan} · Socio ${pet.socio}`}</Text>
        </View>
        <View style={{ backgroundColor: LIME, borderRadius: 100, paddingVertical: 4, paddingHorizontal: 9 }}>
          <Text style={{ color: INK, fontWeight: '800', fontFamily: FH, fontSize: 10 }}>ACTIVO</Text>
        </View>
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
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
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
function Inicio({ profile, pets, petIdx, setPetIdx, go }: { profile: Profile | null; pets: Pet[]; petIdx: number; setPetIdx: (i: number) => void; go: (t: Screen) => void }) {
  const pet = pets[petIdx];
  const [promoIdx, setPromoIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPromoIdx((i) => (i + 1) % PROMOS.length), 4000);
    return () => clearInterval(t);
  }, []);
  const promo = PROMOS[promoIdx] ?? PROMOS[0]!;
  const quick: { label: string; icon: IconName; fill?: boolean; to: Screen }[] = [
    { label: 'Carnet', icon: 'idcard', to: 'carnet' }, { label: 'Foros', icon: 'chat', to: 'foros' },
    { label: 'Reintegro', icon: 'wallet', to: 'reintegros' }, { label: 'Servicios', icon: 'paw', fill: true, to: 'servicios' },
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
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}><Ic d="calendar" size={17} color={INK} /></View>
          <View><Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>Próximas vacunas</Text><Text style={{ fontSize: 11, color: BRAND, fontWeight: '600', marginTop: 4 }}>Ver más →</Text></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => go('beneficios')} style={{ width: '47%', flexGrow: 1, height: 130, borderRadius: 14, overflow: 'hidden' }}>
          <ImageBackground source={IMG['benef.webp']} resizeMode="cover" style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }} imageStyle={{ borderRadius: 14 }}>
            <View style={{ backgroundColor: 'rgba(33,30,51,0.55)', padding: 14 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: '#fff' }}>Beneficios</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>Descuentos exclusivos</Text>
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
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}><Ic d="store" size={17} color={INK} /></View>
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
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'rgba(33,30,51,0.45)', justifyContent: 'flex-end' }}>
      <Pressable onPress={() => {}} style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 26 }}>
          <View style={{ width: 40, height: 4, borderRadius: 100, backgroundColor: '#e0dcec', alignSelf: 'center', marginBottom: 16 }} />
          {children}
        </ScrollView>
      </Pressable>
    </Pressable>
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
      <Text style={{ fontSize: 13, color: '#8781a0', marginBottom: 18 }}>Cuándo aplicaste cada vacuna y cuándo toca la próxima.</Text>

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
          <Text style={{ fontWeight: '700', fontSize: 18, color: INK, marginBottom: 20 }}>Vacunas del {calDiaLabel(dia.iso!)}</Text>
          <View style={{ gap: 12 }}>
            {dia.vaxes.map((v, i) => (
              <View key={v.name + i} style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}><Ic d="shield" size={20} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: INK }}>{v.name}</Text>
                  <Text style={{ fontSize: 12, color: '#8781a0', marginTop: 2 }}>{v.estado}</Text>
                </View>
              </View>
            ))}
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

function Carnet({ pets, petIdx, setPetIdx, reload, go }: { pets: Pet[]; petIdx: number; setPetIdx: (i: number) => void; reload: () => void; go: (t: Screen) => void }) {
  const pet = pets[petIdx];
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showCal, setShowCal] = useState(false);

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
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}><Ic d={VAC_IC[KIND_ICON[v.kind]]} size={18} color={tone.fg} /></View>
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

    </ScrollView>
    {showCal && <CalendarioSheet vacs={pet.vaccines} onClose={() => setShowCal(false)} />}
    {adding && <AgregarSheet petName={pet.name} onClose={() => setAdding(false)} onSave={addVac} />}
    </View>
  );
}

/* ── Mapa estilizado (bloques + calles), como en el prototipo ── */
function MapBlocks({ children }: { children?: ReactNode }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 250" preserveAspectRatio="xMidYMid slice">
      <Rect width="320" height="250" fill="#e9ebf1" />
      <Rect x="26" y="24" width="80" height="58" rx="4" fill="#dfe2ea" />
      <Rect x="128" y="18" width="70" height="66" rx="4" fill="#dfe2ea" />
      <Rect x="220" y="30" width="74" height="52" rx="4" fill="#dfe2ea" />
      <Rect x="20" y="138" width="86" height="72" rx="4" fill="#dfe2ea" />
      <Rect x="128" y="132" width="66" height="84" rx="4" fill="#dfe2ea" />
      <Rect x="214" y="138" width="86" height="78" rx="4" fill="#dfe2ea" />
      <Path d="M0 112 H320 M0 120 H320" stroke="#cfd3de" strokeWidth={8} />
      <Path d="M112 0 V250 M206 0 V250" stroke="#cfd3de" strokeWidth={8} />
      {children}
    </Svg>
  );
}
/* Pin tipo "gota" con etiqueta arriba */
function Pin({ x, y, label, icon }: { x: number; y: number; label?: string; icon: IconName }) {
  return (
    <View style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: [{ translateX: -20 }, { translateY: -44 }], alignItems: 'center' }}>
      {label ? <View style={{ backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 3 }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{label}</Text></View> : null}
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: LIME, borderWidth: 3, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
        <Ic d={icon} size={20} color={BRAND} fill={icon === 'paw'} />
      </View>
    </View>
  );
}

/* ── Pantalla: Servicios ───────────────────────────────────────── */
const CHIPS = [
  { label: 'Todos', cat: null as string | null }, { label: 'Paseos', cat: 'Paseador' }, { label: 'Guardería', cat: 'Guardería' },
  { label: 'Baño', cat: 'Baño y estética' }, { label: 'Adiestrador', cat: 'Adiestrador' }, { label: 'Cuidador', cat: 'Cuidador' },
];
const PIN_ICON: Record<string, IconName> = {
  'Paseador': 'paw', 'Guardería': 'house', 'Baño y estética': 'pin', 'Adiestrador': 'person', 'Cuidador': 'heart',
};
/** Posición del pin. El mapa es decorativo (Google Maps real es Fase 4), así que
 *  sale del id para que sea estable entre renders y no salte al filtrar. */
function pinPos(id: string): { x: number; y: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return { x: 18 + (h % 64), y: 24 + (Math.floor(h / 64) % 48) };
}

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

  const dato = (icono: IconName, texto: string, ultimo = false) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: '#eeecf5' }}>
      <Ic d={icono} size={19} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: INK, flex: 1 }}>{texto}</Text>
    </View>
  );
  const contacto = [
    p.website ? { i: 'globe' as IconName, t: p.website } : null,
    p.instagram ? { i: 'instagram' as IconName, t: p.instagram } : null,
    p.address ? { i: 'pin' as IconName, t: p.address } : null,
    p.phone ? { i: 'phone' as IconName, t: p.phone } : null,
  ].filter(Boolean) as { i: IconName; t: string }[];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Portada. Va con las esquinas de arriba redondeadas y separada, como en
            el prototipo: pegada al header se leía como parte de él. */}
        <View style={{ height: 132, marginTop: 6, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: BRAND, overflow: 'hidden' }}>
          <Image source={petImg(p.photo)} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.55 }} resizeMode="cover" />
          <TouchableOpacity onPress={onVolver} style={{ position: 'absolute', top: 14, left: 16, width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* Avatar + identidad */}
          {/* El avatar monta sobre la portada, pero no tanto: con -38 el nombre
              arrancaba justo en el filo de la foto y se leía pegado. */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: -26, marginBottom: 14 }}>
            <Image source={petImg(p.photo)} style={{ width: 84, height: 84, borderRadius: 24, borderWidth: 4, borderColor: '#fff', backgroundColor: colors.violet[100] }} />
            <View style={{ flex: 1, paddingBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK }}>{p.name}</Text>
                {p.verificado && (
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
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
              <Text style={{ color: BRAND, fontWeight: '700', fontSize: 11.5 }}>{p.km} km de tu casa</Text>
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
              {contacto.map((c, i) => dato(c.i, c.t, i === contacto.length - 1))}
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
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
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

function Servicios({ providers, guardados, onGuardar, onPrestar, reviews, userId, firstName, reload }: { providers: ProviderVM[]; guardados: string[]; onGuardar: (id: string) => void; onPrestar: () => void; reviews: Record<string, Review[]>; userId: string; firstName: string; reload: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [radius, setRadius] = useState(5);
  const [selId, setSelId] = useState<string | null>(null);
  const ql = q.trim().toLowerCase();
  const list = providers.filter((p) => (!cat || p.category === cat) && (!ql || `${p.name} ${p.category} ${p.zone}`.toLowerCase().includes(ql)) && p.km <= radius);

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
      <View style={{ marginBottom: 6 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.violet[100], justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: BRAND, width: `${((radius - 1) / 24) * 100}%` }} />
          <View style={{ position: 'absolute', left: `${((radius - 1) / 24) * 100}%`, width: 18, height: 18, borderRadius: 9, backgroundColor: BRAND, marginLeft: -9, borderWidth: 3, borderColor: '#fff' }} />
        </View>
        {/* pasos táctiles simples */}
        <View style={{ flexDirection: 'row', position: 'absolute', width: '100%', height: 20 }}>
          {[1, 5, 10, 15, 20, 25].map((r) => (
            <TouchableOpacity key={r} onPress={() => setRadius(r)} style={{ flex: 1, height: 20 }} />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: '#a29dba' }}>1 km</Text><Text style={{ fontSize: 11, color: '#a29dba' }}>25 km</Text>
      </View>
      {/* Mapa con radio + pins */}
      <View style={{ height: 230, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e6e3f0', marginBottom: 14 }}>
        <MapBlocks />
        <View style={{ position: 'absolute', left: '50%', top: '52%', width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: 'rgba(93,84,145,0.4)', backgroundColor: 'rgba(93,84,145,0.08)', marginLeft: -75, marginTop: -75 }} />
        {/* Un pin por prestador de la lista, y se toca para abrir su ficha. Antes
            eran los tres primeros y no hacían nada. */}
        {list.map((p) => {
          const pos = pinPos(p.id);
          return (
            <TouchableOpacity key={p.id} onPress={() => setSelId(p.id)} style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%` }}>
              <Pin x={0} y={0} label={p.name} icon={PIN_ICON[p.category] ?? 'pin'} />
            </TouchableOpacity>
          );
        })}
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
                <Image source={petImg(p.photo)} style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors.violet[100] }} />
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
          <Text style={{ fontSize: 13.5, color: MUTED, textAlign: 'center' }}>Sin resultados en {radius} km. Ampliá el radio o cambiá de servicio.</Text>
        </View>
      )}
      <View style={{ gap: 12 }}>
        {list.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => setSelId(p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 12 }}>
            <Image source={petImg(p.photo)} style={{ width: 54, height: 54, borderRadius: 15, backgroundColor: colors.violet[100] }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>{p.name}</Text>
                {p.badge ? <View style={{ backgroundColor: colors.violet[100], borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: BRAND }}>{p.badge}</Text></View> : null}
              </View>
              <Text style={{ fontSize: 12, color: colors.violet[400] }}>{p.category} · {p.zone} · {p.km} km</Text>
              {/* Sin reseñas no se muestra estrella: un "★ 0 (0)" se lee como mala calificación. */}
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                {ratingLabel(p.rating, p.reviews) ? `★ ${ratingLabel(p.rating, p.reviews)} (${p.reviews}) · ` : <Text style={{ color: '#a29dba' }}>Sin reseñas · </Text>}
                <Text style={{ color: BRAND, fontWeight: '700' }}>{money(p.price)}{p.priceUnit}</Text>
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
        <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d={b.icon} size={22} /></View>
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

      {b.zone ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f7f6fa', borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <Ic d="pin" size={18} />
          <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#4a4560', flex: 1 }}>{b.zone}</Text>
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

function Beneficios({ benefits, go }: { benefits: BenefitVM[]; go: (t: Screen) => void }) {
  const [q, setQ] = useState('');
  const [buscado, setBuscado] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const ql = buscado.trim().toLowerCase();
  const list = benefits.filter((b) => !ql || `${b.name} ${b.cat} ${b.zone}`.toLowerCase().includes(ql));
  const sel = benefits.find((b) => b.id === selId);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.screen}>
      <H1>Beneficios</H1>
      <Sub>Descuentos en la red de veterinarias y pet shops</Sub>
      {/* Mapa: un pin por beneficio de la lista, tocable. Antes eran seis pines
          fijos que no representaban ninguno en particular. */}
      <View style={{ height: 175, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#e6e3f0', marginBottom: 16 }}>
        <MapBlocks />
        {list.map((b) => {
          const pos = pinPos(b.id);
          return (
            <TouchableOpacity key={b.id} onPress={() => setSelId(b.id)} style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: [{ translateX: -15 }, { translateY: -30 }] }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: LIME }}>
                <Text style={{ color: LIME, fontWeight: '800', fontSize: 13 }}>%</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {buscado ? (
          <View style={{ position: 'absolute', left: '50%', top: '50%', transform: [{ translateX: -9 }, { translateY: -9 }] }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#2a78d6', borderWidth: 3, borderColor: '#fff' }} />
          </View>
        ) : null}
      </View>
      {/* No hay geolocalización: los beneficios no tienen coordenadas (solo zona),
          así que se busca por zona, nombre o rubro. */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, paddingHorizontal: 14 }}>
          <Ic d="pin" size={17} color={colors.violet[400]} />
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => setBuscado(q)} placeholder="Buscá por zona, local o rubro" placeholderTextColor={colors.violet[400]} style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: INK }} />
          {buscado ? <TouchableOpacity onPress={() => { setQ(''); setBuscado(''); }}><Text style={{ color: '#a29dba', fontSize: 18 }}>×</Text></TouchableOpacity> : null}
        </View>
        <TouchableOpacity onPress={() => setBuscado(q)} style={{ backgroundColor: BRAND, borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Buscar</Text></TouchableOpacity>
      </View>
      {buscado ? <Text style={{ fontWeight: '700', fontSize: 15, color: INK, marginBottom: 10 }}>Beneficios en «{buscado}»</Text> : null}
      {/* Banner "mostrá tu carnet" */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: BRAND, borderRadius: 18, padding: 16, marginBottom: 18 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}><Ic d="tag" size={22} color={INK} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontFamily: FH, fontSize: 15, color: '#fff' }}>Mostrá tu carnet y ahorrá</Text>
          <Text style={{ fontSize: 12, color: colors.violet[300] }}>Presentá el carnet digital en cada local</Text>
        </View>
      </View>
      {list.length === 0 ? (
        <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 26, alignItems: 'center' }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ic d="tag" size={22} />
          </View>
          <Text style={{ fontWeight: '600', fontSize: 14.5, color: INK }}>{buscado ? `Sin beneficios para «${buscado}»` : 'Todavía no hay beneficios activos'}</Text>
          <Text style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 4, lineHeight: 19 }}>{buscado ? 'Probá con otra zona o rubro.' : 'El club los va cargando a medida que suma comercios a la red.'}</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {list.map((b) => (
            <TouchableOpacity key={b.id} onPress={() => setSelId(b.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.violet[200], alignItems: 'center', justifyContent: 'center' }}><Ic d={b.icon} size={20} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>{b.name}</Text>
                <Text style={{ fontSize: 12, color: colors.violet[400] }}>{b.cat}{b.zone ? ` · ${b.zone}` : ''}</Text>
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
function MasSheet({ onClose, onGo }: { onClose: () => void; onGo: (t: Screen) => void }) {
  const rows: { t: string; s: string; icon: IconName; fill?: boolean; to: Screen }[] = [
    { t: 'Mi perfil', s: 'Datos, plan y facturación', icon: 'person', to: 'perfil' },
    { t: 'Mis mascotas', s: 'Datos y carnet de tus peludos', icon: 'paw', fill: true, to: 'mismascotas' },
    { t: 'Mis guardados', s: 'Prestadores que guardaste', icon: 'heart', fill: true, to: 'guardados' },
    { t: 'Mi negocio', s: 'Publicá y gestioná tus servicios', icon: 'house', to: 'minegocio' },
    { t: 'Mis reintegros', s: 'Pedidos y estado de cada uno', icon: 'wallet', to: 'reintegros' },
  ];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(33,30,51,0.5)' }} />
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.violet[200], alignSelf: 'center', marginBottom: 14 }} />
        <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK, marginBottom: 14 }}>Más</Text>
        <View style={{ gap: 12 }}>
          {rows.map((r) => (
            <TouchableOpacity key={r.t} onPress={() => onGo(r.to)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
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
function Perfil({ profile, go }: { profile: Profile | null; go: (t: Screen) => void }) {
  const dato = (k: string, v: string) => (
    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.violet[200] }}>
      <Text style={{ fontSize: 13, color: MUTED }}>{k}</Text><Text style={{ fontSize: 13, fontWeight: '600' }}>{v}</Text>
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
          <Text style={{ fontSize: 13, color: MUTED }}>Socio {profile.memberNo} · Plan {profile.planName}</Text>
        </View>
      </View>
      <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8 }}>Membresía</Text>
      <View style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 14, padding: 15, marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', fontSize: 14 }}>Plan {profile.planName} · {money(profile.planPrice)}/mes</Text>
        <Text style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>Cuota mensual al día</Text>
      </View>
      <TouchableOpacity onPress={() => go('reintegros')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, padding: 15, marginBottom: 18 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d="wallet" size={20} /></View>
        <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 14 }}>Reintegros</Text><Text style={{ fontSize: 12.5, color: MUTED }}>Seguí tus pedidos</Text></View>
        <Text style={{ color: colors.violet[300], fontSize: 18 }}>›</Text>
      </TouchableOpacity>
      <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 4 }}>Datos personales</Text>
      <View style={{ marginBottom: 20 }}>
        {dato('DNI', profile.dni)}{dato('Domicilio', profile.address)}{dato('Teléfono', profile.phone)}{dato('Email', profile.email)}
      </View>
      <TouchableOpacity onPress={() => supabase.auth.signOut()} style={{ backgroundColor: colors.violet[100], borderRadius: 12, padding: 14, alignItems: 'center' }}><Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>Cerrar sesión</Text></TouchableOpacity>
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
  const [busy, setBusy] = useState(false);

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
          <Image source={petImg(sel.photo)} style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: colors.violet[100] }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 21, color: INK }}>{sel.name}</Text>
            <Text style={{ fontSize: 13, color: '#8781a0' }}>{sel.breed}</Text>
            <Text style={{ fontSize: 12, color: '#a29dba', marginTop: 2 }}>Chip {sel.microchip} · Castrado: {sel.castrado}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => { if (idx >= 0) setPetIdx(idx); go('carnet'); }} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ver carnet digital</Text>
        </TouchableOpacity>

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
                  <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
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

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await supabase.from('pets').insert({ owner_id: userId, name: name.trim(), type: tipo, breed: breed.trim() || null });
    setName(''); setBreed(''); setTipo('perro'); setAdding(false);
    await reload();
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <H1>Mis mascotas</H1>
        <TouchableOpacity onPress={() => setAdding((v) => !v)} style={{ backgroundColor: BRAND, borderRadius: 100, paddingVertical: 9, paddingHorizontal: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{adding ? 'Cancelar' : '+ Agregar mascota'}</Text>
        </TouchableOpacity>
      </View>
      {adding && (
        <View style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 18, padding: 16, marginBottom: 16, gap: 10 }}>
          <TextInput value={name} onChangeText={setName} placeholder="Nombre" placeholderTextColor={colors.violet[400]}
            style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
          <TextInput value={breed} onChangeText={setBreed} placeholder="Raza (opcional)" placeholderTextColor={colors.violet[400]}
            style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['perro', 'gato'] as const).map((t) => (
              <TouchableOpacity key={t} onPress={() => setTipo(t)} style={{ flex: 1, backgroundColor: tipo === t ? BRAND : '#fff', borderWidth: 1.5, borderColor: tipo === t ? BRAND : colors.violet[200], borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', fontSize: 13.5, color: tipo === t ? '#fff' : MUTED }}>{t === 'perro' ? 'Perro' : 'Gato'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity disabled={busy} onPress={add} style={{ backgroundColor: LIME, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: INK, fontWeight: '700', fontSize: 14.5 }}>Guardar mascota</Text>
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
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ic d="heart" size={32} color={colors.violet[400]} />
          </View>
          <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', paddingHorizontal: 30 }}>Todavía no guardaste prestadores. Tocá el corazón en Servicios para tenerlos a mano.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {list.map((p) => (
            <TouchableOpacity key={p.id} onPress={onAbrir} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 12 }}>
              <Image source={petImg(p.photo)} style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: colors.violet[100] }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>{p.name}</Text>
                <Text style={{ fontSize: 12, color: colors.violet[400] }}>{p.category} · {p.zone} · {p.km} km</Text>
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
};

function Prestar({ userId, phone, negocio, onVolver, onNegocio, reload }: { userId: string; phone: string; negocio: MiNegocio | null; onVolver: () => void; onNegocio: () => void; reload: () => void }) {
  const [rubro, setRubro] = useState(RUBROS[0]!);
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState('');
  const [tel, setTel] = useState(phone === '—' ? '' : phone);
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  if (negocio && !enviado) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <TouchableOpacity onPress={onVolver} style={{ paddingVertical: 6, marginBottom: 6 }}><Text style={{ color: BRAND, fontWeight: '600', fontSize: 14 }}>← Servicios</Text></TouchableOpacity>
        <H1>Ya tenés un negocio</H1>
        <Sub>Diste de alta &quot;{negocio.name}&quot;. Podés ver su estado desde Mi negocio.</Sub>
        <TouchableOpacity onPress={onNegocio} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ir a Mi negocio</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (enviado) {
    return (
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
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

  const enviar = async () => {
    if (!nombre.trim()) { setError('Poné el nombre o la marca de tu servicio.'); return; }
    if (!zona.trim()) { setError('Poné la zona donde trabajás.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('providers').insert({
      owner_id: userId, name: nombre.trim(), category: rubro, zone: zona.trim(),
      phone: tel.trim() || null, about: about.trim(), status: 'pendiente',
    });
    if (e) { setError('No pudimos enviar la solicitud. Probá de nuevo.'); setBusy(false); return; }
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

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <SheetLabel>Zona</SheetLabel>
          <TextInput value={zona} onChangeText={(v) => { setZona(v); setError(''); }} placeholder="Palermo, CABA" placeholderTextColor={colors.violet[400]} style={input} />
        </View>
        <View style={{ flex: 1 }}>
          <SheetLabel>WhatsApp</SheetLabel>
          <TextInput value={tel} onChangeText={setTel} placeholder="+54 11 ..." placeholderTextColor={colors.violet[400]} style={input} />
        </View>
      </View>

      <SheetLabel>Contanos sobre tu servicio</SheetLabel>
      <TextInput value={about} onChangeText={setAbout} multiline numberOfLines={3} placeholder="Experiencia, disponibilidad, precios de referencia…" placeholderTextColor={colors.violet[400]} style={{ ...input, height: 90, textAlignVertical: 'top', marginBottom: 16 }} />

      {error ? <Text style={{ fontSize: 12.5, color: '#b0483f', fontWeight: '600', marginBottom: 12 }}>{error}</Text> : null}
      <TouchableOpacity disabled={busy} onPress={enviar} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{busy ? 'Enviando…' : 'Enviar solicitud'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ── Sub-pantalla: Notificaciones ──────────────────────────────── */
/** Cada notificación lleva a la pantalla donde el socio puede hacer algo con ella. */
const NOTIF_DESTINO: Record<'carnet' | 'reintegros' | 'minegocio', Screen> = { carnet: 'carnet', reintegros: 'reintegros', minegocio: 'minegocio' };

function Notificaciones({ groups, visto, marcarLeidas, go }: { groups: NotifGroup[]; visto: string | null; marcarLeidas: () => void; go: (t: Screen) => void }) {
  const vistoMs = visto ? new Date(visto).getTime() : 0;
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
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
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
                  <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: st.chip }}>
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

      {/* Del prototipo. El push todavía no está implementado, así que el switch
          es decorativo: no hay nada que apagar. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4 }}>
        <View>
          <Text style={{ fontWeight: '600', fontSize: 14, color: INK }}>Push y recordatorios</Text>
          <Text style={{ fontSize: 12, color: '#a29dba' }}>Vacunas, reintegros y beneficios</Text>
        </View>
        <View style={{ width: 44, height: 26, borderRadius: 100, backgroundColor: BRAND, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
        </View>
      </View>
    </ScrollView>
  );
}

/* ── Sub-pantalla: Mi negocio ──────────────────────────────────── */
const RUBROS = ['Paseador', 'Guardería', 'Adiestrador', 'Baño y estética', 'Cuidador'];

function Negocio({ negocio, userId, phone, reload }: { negocio: MiNegocio | null; userId: string; phone: string; reload: () => void }) {
  const [showAlta, setShowAlta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rubro, setRubro] = useState(RUBROS[0]!);
  const [zona, setZona] = useState('');
  const [tel, setTel] = useState(phone === '—' ? '' : phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // El estado sale del negocio real, no de un selector de demo.
  const state: 'sin' | 'revision' | 'activo' | 'rechazado' =
    !negocio ? 'sin' : negocio.status === 'verificado' ? 'activo' : negocio.status === 'rechazado' ? 'rechazado' : 'revision';

  const enviarAlta = async () => {
    if (!nombre.trim()) { setError('Poné el nombre de tu negocio.'); return; }
    if (!zona.trim()) { setError('Poné la zona donde trabajás.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('providers').insert({
      owner_id: userId, name: nombre.trim(), category: rubro, zone: zona.trim(),
      phone: tel.trim() || null, status: 'pendiente',
    });
    if (e) { setError('No pudimos enviar la solicitud. Probá de nuevo.'); setBusy(false); return; }
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

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <H1>Mi negocio</H1>
      <Sub>Ofrecé tus servicios a la comunidad de Kumo.</Sub>
      {state === 'sin' && (
        <View style={{ backgroundColor: BRAND, borderRadius: 20, padding: 22, marginBottom: 18, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -20, top: -20, opacity: 0.15 }}><Ic d="store" size={120} color="#fff" /></View>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Ic d="store" size={26} color="#fff" /></View>
          <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: '#fff', lineHeight: 27 }}>¿Ofrecés un servicio para mascotas?</Text>
          <Text style={{ color: colors.violet[300], fontSize: 13.5, lineHeight: 20, marginTop: 10, marginBottom: 18 }}>Dá de alta tu negocio como paseador, guardería, adiestrador, baño o cuidador. El club valida tus datos y quedás visible para miles de socios.</Text>
          {showAlta ? (
            <View style={{ gap: 10 }}>
              <TextInput value={nombre} onChangeText={(t) => { setNombre(t); setError(''); }} placeholder="Nombre de tu negocio" placeholderTextColor={colors.violet[400]} style={field} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {RUBROS.map((r) => (
                  <TouchableOpacity key={r} onPress={() => setRubro(r)} style={{ backgroundColor: rubro === r ? LIME : 'rgba(255,255,255,0.15)', borderRadius: 100, paddingVertical: 8, paddingHorizontal: 13 }}>
                    <Text style={{ color: rubro === r ? INK : '#fff', fontWeight: '700', fontSize: 12.5 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput value={zona} onChangeText={(t) => { setZona(t); setError(''); }} placeholder="Zona (ej: Palermo, CABA)" placeholderTextColor={colors.violet[400]} style={field} />
              <TextInput value={tel} onChangeText={setTel} placeholder="WhatsApp de contacto" placeholderTextColor={colors.violet[400]} keyboardType="phone-pad" style={field} />
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
          ) : (
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
          <TouchableOpacity disabled={busy} onPress={darDeBaja} style={{ marginTop: 14 }}>
            <Text style={{ color: '#b0483f', fontWeight: '600', fontSize: 13 }}>{busy ? 'Dando de baja…' : 'Dar de baja mi negocio'}</Text>
          </TouchableOpacity>
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
      {([['person', 'Miles de socios buscando tu servicio'], ['shield', 'Sello "Verificado por Kumo"'], ['chat', 'Reseñas y contactos en un solo lugar']] as [IconName, string][]).map(([icon, t]) => (
        <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d={icon} size={18} color={BRAND} /></View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: INK, flex: 1 }}>{t}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/* ── Sub-pantalla: Reintegros ──────────────────────────────────── */
const REFUND_PCT: Record<string, number> = { AMIGO: 30, FAMILIA: 50, VIP: 70 };
const NOTA_REINT = 'Los reintegros se acreditan en tu CVU/CBU en hasta 30 días hábiles. Podés pedir 1 reintegro de consultas cada 2 meses.';
const reintTone = (raw: string) => REINT_TONE[raw] ?? REINT_TONE.en_revision!;

/* ── Sub-pantalla: detalle de un reintegro ─────────────────────── */
/** Montos, seguimiento, comprobante y datos de acreditación. Antes el historial
 *  no se podía abrir: la tarjeta era el final del camino. */
function ReintegroDetalle({ r, planName, onVolver }: { r: ReintVM; planName: string; onVolver: () => void }) {
  const [verBusy, setVerBusy] = useState(false);
  const tone = reintTone(r.estadoRaw);
  const pasos = reintPasos(r.estadoRaw, r.fecha);

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
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: p.done ? BRAND : '#e0dcec' }}>
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
  const [titular, setTitular] = useState('');
  const [cuit, setCuit] = useState('');
  const [cbu, setCbu] = useState('');
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

    const { error: insErr } = await supabase.from('reimbursements').insert({
      member_id: userId, pet_id: pets[0]?.id ?? null, plan_name: profile.planName,
      provider_name: place.trim(), concept: concept.trim(), amount: n,
      refund: Math.round((n * pct) / 100), refund_pct: pct, status: 'en_revision', receipt_path: path,
      bank_holder: titular.trim() || null, bank_cuit: cuit.trim() || null,
      // El alias y el CBU van al mismo campo: el socio pone uno de los dos.
      ...(/^\d{22}$/.test(cbu.replace(/\D/g, '')) ? { bank_cbu: cbu.trim() } : { bank_alias: cbu.trim() }),
    });
    if (insErr) {
      // No dejamos el archivo huérfano si falla la solicitud.
      await supabase.storage.from('receipts').remove([path]);
      setError('No pudimos registrar la solicitud. Probá de nuevo.');
      setBusy(false);
      return;
    }

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
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M20 6L9 17l-5-5" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: '#3f5410' }}>Solicitud enviada</Text>
            <Text style={{ fontSize: 13, color: '#5f7d10' }}>La revisamos y acreditamos en tu CBU/CVU en hasta 30 días hábiles.</Text>
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
              : <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d="wallet" size={22} /></View>}
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
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
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
const FORO_CATS = ['Paseadores', 'Salud', 'Guarderías', 'Adiestramiento', 'Alimentación', 'Cruzas', 'Razas'];
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

  const nPost = p.likes + (likePost && !misLikes.posts.includes(p.id) ? 1 : 0) - (!likePost && misLikes.posts.includes(p.id) ? 1 : 0);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <BackLink label="Comunidad" onPress={onVolver} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
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
                <TouchableOpacity onPress={() => toggleAns(a.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingLeft: 4 }}>
                  <Ic d="heart" size={13} color={yo ? '#c04863' : '#8781a0'} fill={yo} />
                  <Text style={{ fontSize: 12, color: yo ? '#c04863' : '#8781a0' }}>{n}</Text>
                </TouchableOpacity>
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
        <TouchableOpacity disabled={busy || !texto.trim()} onPress={responder} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: texto.trim() ? BRAND : '#c7c1de', alignItems: 'center', justifyContent: 'center' }}>
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
  const [cat, setCat] = useState(FORO_CATS[0]!);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [zona, setZona] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  const ql = q.trim().toLowerCase();
  const list = posts.filter((p) => (filtro === 'Todos' || p.cat === filtro) && (!ql || `${p.title} ${p.body} ${p.author}`.toLowerCase().includes(ql)));

  const hilo = posts.find((p) => p.id === hiloId);
  if (hilo) return <Hilo p={hilo} userId={userId} firstName={firstName} misLikes={misLikes} reload={reload} onVolver={() => setHiloId(null)} />;

  const field = { borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' } as const;

  const publicar = async () => {
    if (!title.trim()) { setError('Ponele un título a tu publicación.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('community_posts').insert({
      author_id: userId, author_name: firstName, category: cat,
      title: title.trim(), body: body.trim() || title.trim(), zone: zona.trim() || null,
    });
    if (e) { setError('No pudimos publicar. Probá de nuevo.'); setBusy(false); return; }
    setTitle(''); setBody(''); setZona('');
    setBusy(false); setListo(true);
    await reload();
  };

  if (vista === 'componer') {
    if (listo) {
      return (
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
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

        <SheetLabel>Zona · opcional</SheetLabel>
        <TextInput value={zona} onChangeText={setZona} placeholder="Palermo, CABA" placeholderTextColor={colors.violet[400]} style={{ ...field, marginBottom: 18 }} />

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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.violet[100], borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 }}><Ic d="chat" size={14} color={BRAND} /><Text style={{ fontSize: 12, fontWeight: '700', color: BRAND }}>{p.replies}</Text></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fbe9ee', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 }}><Ic d="heart" size={14} color="#c04863" fill /><Text style={{ fontSize: 12, fontWeight: '700', color: '#c04863' }}>{p.likes}</Text></View>
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
const TABS: { k: Tab; label: string; icon: IconName }[] = [
  { k: 'inicio', label: 'Inicio', icon: 'house' },
  { k: 'carnet', label: 'Carnet', icon: 'idcard' },
  { k: 'servicios', label: 'Servicios', icon: 'paw' },
  { k: 'beneficios', label: 'Beneficios', icon: 'tag' },
  { k: 'foros', label: 'Foros', icon: 'chat' },
];

/** Última vez que el socio miró las notificaciones. No hace falta tabla: alcanza con el dispositivo. */
const VISTO_KEY = 'kumo:notif-visto';

export default function App() {
  const [screen, setScreen] = useState<Screen>('inicio');
  const [petIdx, setPetIdx] = useState(0);
  const [masOpen, setMasOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [visto, setVisto] = useState<string | null>(null);
  /** null = todavía no se tocó nada, vale lo que trajo la base. */
  const [optimistaGuardados, setOptimistaGuardados] = useState<string[] | null>(null);
  const [fontsLoaded] = useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  const { data, loading, reload } = useKumoData(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: s }) => { setUserId(s.session?.user.id ?? null); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      setScreen('inicio'); setPetIdx(0); setMasOpen(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { AsyncStorage.getItem(VISTO_KEY).then(setVisto); }, []);

  if (!fontsLoaded || !authReady) return <View style={{ flex: 1, backgroundColor: '#fff' }} />;

  const go = (t: Screen) => { setMasOpen(false); setScreen(t); };
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
        <View style={styles.statusbar}>
          <Text style={styles.statusTime}>9:41</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill={INK}><Path d="M12 5C7.5 5 3.7 6.8 1.5 9.6L12 21 22.5 9.6C20.3 6.8 16.5 5 12 5z" /></Svg>
            <Svg width={24} height={12} viewBox="0 0 27 12"><Rect x="1" y="1" width="22" height="10" rx="3" fill="none" stroke={INK} strokeWidth={1.4} /><Rect x="3" y="3" width="16" height="6" rx="1.5" fill={INK} /><Rect x="24" y="4" width="2.4" height="4" rx="1" fill={INK} /></Svg>
          </View>
        </View>
        {!userId ? (
          <Login />
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
            <TouchableOpacity onPress={() => go('notif')} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: screen === 'notif' ? BRAND : colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
              <Ic d="bell" size={21} color={screen === 'notif' ? '#fff' : BRAND} />
              {noLeidas > 0 && screen !== 'notif' && <View style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: LIME, borderWidth: 2, borderColor: colors.violet[100] }} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMasOpen(true)} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: masOpen ? BRAND : colors.violet[100], alignItems: 'center', justifyContent: 'center' }}>
              <Ic d="menu" size={22} color={masOpen ? '#fff' : BRAND} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          {screen === 'inicio' && <Inicio profile={data.profile} pets={pets} petIdx={safeIdx} setPetIdx={setPetIdx} go={go} />}
          {screen === 'carnet' && <Carnet pets={pets} petIdx={safeIdx} setPetIdx={setPetIdx} reload={reload} go={go} />}
          {screen === 'servicios' && <Servicios providers={data.providers} guardados={guardados} onGuardar={toggleGuardado} onPrestar={() => go('prestar')} reviews={data.reviews} userId={userId} firstName={data.profile?.firstName ?? 'Socio'} reload={reload} />}
          {screen === 'prestar' && <Prestar userId={userId} phone={data.profile?.phone ?? ''} negocio={data.negocio} onVolver={() => go('servicios')} onNegocio={() => go('minegocio')} reload={reload} />}
          {screen === 'beneficios' && <Beneficios benefits={data.benefits} go={go} />}
          {screen === 'reintegros' && <Reintegros profile={data.profile} pets={pets} reintegros={data.reintegros} reintTotal={data.reintTotal} userId={userId} reload={reload} go={go} />}
          {screen === 'foros' && <Foros posts={data.posts} userId={userId} firstName={data.profile?.firstName ?? 'Socio'} misLikes={data.misLikes} reload={reload} />}
          {screen === 'perfil' && <Perfil profile={data.profile} go={go} />}
          {screen === 'mismascotas' && <MisMascotas pets={pets} reintegros={data.reintegros} userId={userId} reload={reload} go={go} setPetIdx={setPetIdx} />}
          {screen === 'guardados' && <Guardados providers={data.providers} guardados={guardados} onAbrir={() => go('servicios')} />}
          {screen === 'minegocio' && <Negocio negocio={data.negocio} userId={userId} phone={data.profile?.phone ?? ''} reload={reload} />}
          {screen === 'notif' && <Notificaciones groups={notifGroups} visto={visto} marcarLeidas={marcarLeidas} go={go} />}
        </View>
        <View style={styles.tabbar}>
          {TABS.map((t) => {
            const active = screen === t.k && !masOpen;
            return (
              <Pressable key={t.k} onPress={() => go(t.k as Screen)} style={styles.tabitem}>
                <View style={{ backgroundColor: active ? LIME : 'transparent', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4 }}>
                  <Ic d={t.icon} size={22} color={active ? BRAND : colors.violet[400]} fill={t.icon === 'paw' && active} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: active ? '700' : '500', color: active ? BRAND : colors.violet[400], marginTop: 3 }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {masOpen && <MasSheet onClose={() => setMasOpen(false)} onGo={go} />}
          </>
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
    : { flex: 1, width: '100%', backgroundColor: '#fff' },
  statusbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 4 },
  statusTime: { fontSize: 13, fontWeight: '700', color: INK },
  screen: { padding: 20, paddingBottom: 40 },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.violet[200], backgroundColor: '#fff', paddingTop: 8, paddingBottom: 10 },
  tabitem: { flex: 1, alignItems: 'center' },
});

