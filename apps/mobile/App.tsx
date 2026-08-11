import { useState, useEffect, createElement, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text as RNText, View, TouchableOpacity, TextInput, Pressable, Image, ImageBackground, ImageSourcePropType, Platform, TextProps, Linking, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { colors } from '@kumo/shared';
import { supabase } from './lib/supabase';
import { useKumoData, type Pet, type Profile, type ProviderVM, type BenefitVM, type ReintVM, type ForumPost, type MiNegocio } from './lib/useKumoData';
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

type Screen = 'inicio' | 'carnet' | 'servicios' | 'beneficios' | 'reintegros' | 'foros' | 'perfil' | 'mismascotas' | 'guardados' | 'minegocio';
type Tab = 'inicio' | 'carnet' | 'servicios' | 'beneficios' | 'mas';
const openWa = (phone: string) => Linking.openURL('https://wa.me/' + (phone || '').replace(/\D/g, ''));

/* ── Iconos (react-native-svg) ─────────────────────────────────── */
type IconName = 'paw' | 'house' | 'idcard' | 'chat' | 'wallet' | 'tag' | 'menu' | 'bell' | 'shield' | 'search' | 'calendar' | 'store' | 'person' | 'heart' | 'hospital' | 'pill' | 'droplet' | 'pin';
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 13, color: colors.violet[400] }}>Hola de nuevo</Text>
          <Text style={{ fontSize: 23, fontWeight: '800', fontFamily: FH, color: INK }}>{profile?.firstName ?? 'Socio'}</Text>
        </View>
        <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Ic d="bell" size={21} /></TouchableOpacity>
      </View>
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
        <Image source={IMG[promo.photo]} style={{ width: 120, height: 78 }} resizeMode="cover" />
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
function Carnet({ pets, petIdx, setPetIdx, reload, go }: { pets: Pet[]; petIdx: number; setPetIdx: (i: number) => void; reload: () => void; go: (t: Screen) => void }) {
  const pet = pets[petIdx];
  const [busy, setBusy] = useState<string | null>(null);
  const [newVac, setNewVac] = useState('');
  const [adding, setAdding] = useState(false);

  const markApplied = async (vacId: string) => {
    setBusy(vacId);
    await supabase.from('vaccinations').update({ status: 'aplicada', applied_on: new Date().toISOString().slice(0, 10), due_on: null }).eq('id', vacId);
    await reload();
    setBusy(null);
  };
  const addVac = async () => {
    if (!newVac.trim() || !pet) return;
    setBusy('new');
    await supabase.from('vaccinations').insert({ pet_id: pet.id, name: newVac.trim(), status: 'pendiente' });
    setNewVac(''); setAdding(false);
    await reload();
    setBusy(null);
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
    <ScrollView contentContainerStyle={styles.screen}>
      <H1>Carnet digital</H1>
      <View style={{ height: 10 }} />
      <PetChips pets={pets} idx={petIdx} setIdx={setPetIdx} />
      <PetCard pet={pet} detailed />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: INK }}>Salud y vacunas</Text>
        <Text style={{ fontSize: 13, color: BRAND, fontWeight: '600', textDecorationLine: 'underline' }}>Ver calendario</Text>
      </View>
      <View style={{ gap: 10 }}>
        {pet.vaccines.map((v) => {
          const tone = TONE[v.tone];
          const hi = v.tone === 'lime';
          return (
            <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: hi ? '#eef7d6' : '#f7f6fa', borderWidth: hi ? 1.5 : 1, borderColor: hi ? LIME : '#eeecf5', borderRadius: 14, padding: 13 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}><Ic d="shield" size={18} color={tone.fg} /></View>
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
      {adding ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          <TextInput
            value={newVac} onChangeText={setNewVac} placeholder="Nombre de la vacuna o estudio" placeholderTextColor={colors.violet[400]}
            style={{ borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' }}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => { setAdding(false); setNewVac(''); }} style={{ flex: 1, backgroundColor: colors.violet[100], borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy === 'new'} onPress={addVac} style={{ flex: 1, backgroundColor: BRAND, borderRadius: 12, padding: 14, alignItems: 'center', opacity: busy === 'new' ? 0.6 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setAdding(true)} style={{ backgroundColor: BRAND, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 16 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Agregar estudio o vacuna</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
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
/* Posiciones fijas de los 3 pins del mapa (el mapa es decorativo, como en el prototipo). */
const PIN_POS = [{ x: 34, y: 40 }, { x: 70, y: 38 }, { x: 50, y: 54 }];
const PIN_ICON: Record<string, IconName> = {
  'Paseador': 'paw', 'Guardería': 'house', 'Baño y estética': 'pin', 'Adiestrador': 'person', 'Cuidador': 'heart',
};
function Servicios({ providers }: { providers: ProviderVM[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [radius, setRadius] = useState(5);
  const ql = q.trim().toLowerCase();
  const list = providers.filter((p) => (!cat || p.category === cat) && (!ql || `${p.name} ${p.category} ${p.zone}`.toLowerCase().includes(ql)) && p.km <= radius);
  const pins = list.slice(0, 3);
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <H1>Servicios</H1>
        <TouchableOpacity style={{ backgroundColor: LIME, borderRadius: 100, paddingVertical: 9, paddingHorizontal: 14, marginTop: 4 }}><Text style={{ color: INK, fontWeight: '700', fontSize: 12.5 }}>+ Prestar servicio</Text></TouchableOpacity>
      </View>
      <Sub>Contratá prestadores verificados u ofrecé el tuyo</Sub>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, paddingHorizontal: 14, marginBottom: 14 }}>
        <Ic d="search" size={18} color={colors.violet[400]} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar paseador, guardería, zona…" placeholderTextColor={colors.violet[400]} style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: INK }} />
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
        {pins.map((p, i) => (
          <Pin key={p.id} x={PIN_POS[i]!.x} y={PIN_POS[i]!.y} label={p.name} icon={PIN_ICON[p.category] ?? 'pin'} />
        ))}
      </View>
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
          <TouchableOpacity key={p.id} onPress={() => openWa(p.phone)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 12 }}>
            <Image source={petImg(p.photo)} style={{ width: 54, height: 54, borderRadius: 15, backgroundColor: colors.violet[100] }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>{p.name}</Text>
                {p.badge ? <View style={{ backgroundColor: colors.violet[100], borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: BRAND }}>{p.badge}</Text></View> : null}
              </View>
              <Text style={{ fontSize: 12, color: colors.violet[400] }}>{p.category} · {p.zone} · {p.km} km</Text>
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>★ {p.rating} ({p.reviews}) · <Text style={{ color: BRAND, fontWeight: '700' }}>{money(p.price)}{p.priceUnit}</Text></Text>
            </View>
            <Text style={{ color: colors.violet[300], fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

/* ── Pantalla: Beneficios ──────────────────────────────────────── */
function Beneficios({ benefits }: { benefits: BenefitVM[] }) {
  const [addr, setAddr] = useState('');
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <H1>Beneficios</H1>
      <Sub>Descuentos en la red de veterinarias y pet shops</Sub>
      {/* Mapa con pins de descuento */}
      <View style={{ height: 175, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#e6e3f0', marginBottom: 16 }}>
        <MapBlocks />
        {[{ x: 30, y: 34 }, { x: 55, y: 26 }, { x: 74, y: 40 }, { x: 24, y: 62 }, { x: 48, y: 66 }, { x: 70, y: 62 }].slice(0, benefits.length).map((p, i) => (
          <View key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: [{ translateX: -15 }, { translateY: -30 }] }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: LIME, fontWeight: '800', fontSize: 13 }}>%</Text>
            </View>
          </View>
        ))}
      </View>
      {/* Buscar por dirección */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 14, paddingHorizontal: 14 }}>
          <Ic d="pin" size={17} color={colors.violet[400]} />
          <TextInput value={addr} onChangeText={setAddr} placeholder="Ingresá tu dirección" placeholderTextColor={colors.violet[400]} style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: INK }} />
        </View>
        <TouchableOpacity style={{ backgroundColor: BRAND, borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Buscar</Text></TouchableOpacity>
      </View>
      {/* Banner "mostrá tu carnet" */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: BRAND, borderRadius: 18, padding: 16, marginBottom: 18 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}><Ic d="tag" size={22} color={INK} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontFamily: FH, fontSize: 15, color: '#fff' }}>Mostrá tu carnet y ahorrá</Text>
          <Text style={{ fontSize: 12, color: colors.violet[300] }}>Presentá el carnet digital en cada local</Text>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        {benefits.map((b) => (
          <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.violet[200], alignItems: 'center', justifyContent: 'center' }}><Ic d={b.icon} size={20} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>{b.name}</Text>
              <Text style={{ fontSize: 12.5, color: colors.violet[400] }}>{b.cat}</Text>
            </View>
            <View style={{ backgroundColor: LIME, borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12 }}><Text style={{ fontWeight: '800', fontFamily: FH, fontSize: 14, color: INK }}>{b.disc}</Text></View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ── Hoja "Más" ────────────────────────────────────────────────── */
function MasSheet({ onClose, onGo }: { onClose: () => void; onGo: (t: Screen) => void }) {
  const rows: { t: string; s: string; icon: IconName; fill?: boolean; to: Screen }[] = [
    { t: 'Mi perfil', s: 'Datos, plan y facturación', icon: 'person', to: 'perfil' },
    { t: 'Mis mascotas', s: 'Datos y carnet de tus peludos', icon: 'paw', fill: true, to: 'mismascotas' },
    { t: 'Mis guardados', s: 'Prestadores que guardaste', icon: 'heart', fill: true, to: 'guardados' },
    { t: 'Mi negocio', s: 'Publicá y gestioná tus servicios', icon: 'house', to: 'minegocio' },
    { t: 'Foros', s: 'Comunidad de dueños', icon: 'chat', to: 'foros' },
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
function MisMascotas({ pets, userId, reload, go, setPetIdx }: { pets: Pet[]; userId: string; reload: () => void; go: (t: Screen) => void; setPetIdx: (i: number) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [tipo, setTipo] = useState<'perro' | 'gato'>('perro');
  const [busy, setBusy] = useState(false);

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
        {pets.map((p, i) => {
          const alDia = p.next === 'Todo al día';
          return (
            <TouchableOpacity key={p.id} onPress={() => { setPetIdx(i); go('carnet'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 18, padding: 14 }}>
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
function Guardados() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <H1>Mis guardados</H1>
      <Sub>Los prestadores que marcaste con el corazón.</Sub>
      <View style={{ alignItems: 'center', paddingVertical: 60 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ic d="heart" size={32} color={colors.violet[400]} />
        </View>
        <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', paddingHorizontal: 30 }}>Todavía no guardaste prestadores. Tocá el corazón en Servicios para tenerlos a mano.</Text>
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
function Reintegros({ profile, pets, reintegros, reintTotal, userId, reload, go }: { profile: Profile | null; pets: Pet[]; reintegros: ReintVM[]; reintTotal: number; userId: string; reload: () => void; go: (t: Screen) => void }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pct = REFUND_PCT[profile?.planName ?? ''] ?? 30;

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
    if (!place.trim() || !concept.trim() || !n || !profile) return;
    if (!photo) { setError('Adjuntá la foto de la factura.'); return; }
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
    });
    if (insErr) {
      // No dejamos el archivo huérfano si falla la solicitud.
      await supabase.storage.from('receipts').remove([path]);
      setError('No pudimos registrar la solicitud. Probá de nuevo.');
      setBusy(false);
      return;
    }

    setPlace(''); setConcept(''); setAmount(''); setPhoto(null); setOpen(false);
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
      {open ? (
        <View style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 18, padding: 16, marginBottom: 18, gap: 10 }}>
          <TextInput value={place} onChangeText={setPlace} placeholder="Veterinaria o comercio" placeholderTextColor={colors.violet[400]} style={field} />
          <TextInput value={concept} onChangeText={setConcept} placeholder="Concepto (consulta, vacuna…)" placeholderTextColor={colors.violet[400]} style={field} />
          <TextInput value={amount} onChangeText={setAmount} placeholder="Monto gastado" placeholderTextColor={colors.violet[400]} keyboardType="numeric" style={field} />
          <Text style={{ fontSize: 12.5, color: MUTED }}>Te correspondería {money(Math.round((Number(amount.replace(/\D/g, '')) * pct) / 100))} de reintegro.</Text>
          <TouchableOpacity onPress={pickPhoto} style={{ borderWidth: 1.5, borderColor: colors.violet[300], borderStyle: 'dashed', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {photo
              ? <Image source={{ uri: photo.uri }} style={{ width: 34, height: 34, borderRadius: 7 }} />
              : <View style={{ width: 34, height: 34, borderRadius: 7, backgroundColor: colors.violet[100], alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16 }}>🧾</Text></View>}
            <Text style={{ fontSize: 13.5, color: photo ? INK : MUTED, fontWeight: photo ? '600' : '400', flex: 1 }}>
              {photo ? 'Factura adjunta · tocá para cambiar' : 'Foto de la factura (obligatoria)'}
            </Text>
          </TouchableOpacity>
          {!!error && <Text style={{ fontSize: 12.5, color: '#b0483f', fontWeight: '600' }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: colors.violet[100], borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={submit} style={{ flex: 1, backgroundColor: BRAND, borderRadius: 12, paddingVertical: 13, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setOpen(true)} style={{ backgroundColor: LIME, borderRadius: 14, padding: 15, alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ color: INK, fontWeight: '700', fontSize: 15 }}>+ Subir factura</Text>
        </TouchableOpacity>
      )}
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Historial</Text>
      <View style={{ gap: 12 }}>
        {reintegros.map((h) => (
          <View key={h.id} style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 14 }}>{h.place}</Text>
                <Text style={{ fontSize: 12, color: colors.violet[400] }}>{h.det}</Text>
              </View>
              <View style={{ backgroundColor: h.estado === 'Acreditado' ? colors.success.bg : h.estado === 'Rechazado' ? colors.danger.bg : '#fbf3e2', borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: h.estado === 'Acreditado' ? colors.success.fg : h.estado === 'Rechazado' ? colors.danger.fg : '#b8860b' }}>{h.estado}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <Text style={{ fontSize: 13, color: MUTED }}>Gastado {money(h.spent)}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: BRAND }}>Reintegro {money(h.refund)} ›</Text>
            </View>
          </View>
        ))}
        {reintegros.length === 0 && (
          <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 13.5, color: MUTED, textAlign: 'center' }}>Todavía no pediste ningún reintegro. Subí una factura para empezar.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/* ── Sub-pantalla: Foros ───────────────────────────────────────── */
const CAT_TONE: Record<string, { bg: string; fg: string }> = {
  'Paseadores': { bg: colors.success.bg, fg: colors.success.fg },
  'Salud': { bg: colors.violet[100], fg: BRAND },
  'Guarderías': { bg: '#fbf3e2', fg: '#b8860b' },
};
const FORO_CATS = ['Salud', 'Paseadores', 'Guarderías', 'General'];
function Foros({ posts, userId, reload }: { posts: ForumPost[]; userId: string; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(FORO_CATS[0]!);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    await supabase.from('community_posts').insert({ author_id: userId, category: cat, title: title.trim(), body: body.trim() });
    setTitle(''); setBody(''); setOpen(false);
    await reload();
    setBusy(false);
  };
  const field = { borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK, backgroundColor: '#fff' } as const;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <H1>Foros</H1>
        <TouchableOpacity onPress={() => setOpen((v) => !v)} style={{ backgroundColor: LIME, borderRadius: 100, paddingVertical: 9, paddingHorizontal: 14, marginTop: 4 }}>
          <Text style={{ color: INK, fontWeight: '700', fontSize: 12.5 }}>{open ? 'Cancelar' : '+ Publicar'}</Text>
        </TouchableOpacity>
      </View>
      <Sub>Preguntá, opiná y encontrá recomendaciones reales.</Sub>
      {open && (
        <View style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 18, padding: 16, marginBottom: 18, gap: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {FORO_CATS.map((c) => (
              <TouchableOpacity key={c} onPress={() => setCat(c)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 100, backgroundColor: cat === c ? BRAND : '#fff', borderWidth: 1, borderColor: cat === c ? BRAND : colors.violet[200] }}>
                <Text style={{ fontWeight: '600', fontSize: 12.5, color: cat === c ? '#fff' : MUTED }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput value={title} onChangeText={setTitle} placeholder="Título de tu consulta" placeholderTextColor={colors.violet[400]} style={field} />
          <TextInput value={body} onChangeText={setBody} placeholder="Contá un poco más…" placeholderTextColor={colors.violet[400]} multiline numberOfLines={3} style={[field, { minHeight: 76, textAlignVertical: 'top' }]} />
          <TouchableOpacity disabled={busy} onPress={publish} style={{ backgroundColor: BRAND, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14.5 }}>Publicar</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ gap: 12 }}>
        {posts.map((p) => {
          const tone = CAT_TONE[p.cat] ?? { bg: colors.violet[100], fg: BRAND };
          return (
            <View key={p.id} style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 15 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ backgroundColor: tone.bg, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ fontSize: 11, fontWeight: '700', color: tone.fg }}>{p.cat}</Text></View>
                <Text style={{ fontSize: 12, color: colors.violet[400] }}>{p.author}</Text>
              </View>
              <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 15, color: INK, marginBottom: 10 }}>{p.title}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.violet[100], borderRadius: 100, paddingHorizontal: 11, paddingVertical: 5 }}><Ic d="chat" size={13} color={BRAND} /><Text style={{ fontSize: 12.5, fontWeight: '600', color: BRAND }}>{p.replies}</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.danger.bg, borderRadius: 100, paddingHorizontal: 11, paddingVertical: 5 }}><Ic d="heart" size={13} color={colors.danger.fg} fill /><Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.danger.fg }}>{p.likes}</Text></View>
              </View>
            </View>
          );
        })}
        {posts.length === 0 && (
          <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: '#eeecf5', borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 13.5, color: MUTED, textAlign: 'center' }}>Todavía no hay publicaciones. Sé el primero en preguntar algo.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/* ── Barra inferior + shell ────────────────────────────────────── */
const TABS: { k: Tab; label: string; icon: IconName }[] = [
  { k: 'inicio', label: 'Inicio', icon: 'house' },
  { k: 'carnet', label: 'Carnet', icon: 'idcard' },
  { k: 'servicios', label: 'Servicios', icon: 'paw' },
  { k: 'beneficios', label: 'Beneficios', icon: 'tag' },
  { k: 'mas', label: 'Más', icon: 'menu' },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('inicio');
  const [petIdx, setPetIdx] = useState(0);
  const [masOpen, setMasOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
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

  if (!fontsLoaded || !authReady) return <View style={{ flex: 1, backgroundColor: '#fff' }} />;

  const go = (t: Screen) => { setMasOpen(false); setScreen(t); };
  const pets = data?.pets ?? [];
  const safeIdx = Math.min(petIdx, Math.max(pets.length - 1, 0));

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
        <View style={{ flex: 1 }}>
          {screen === 'inicio' && <Inicio profile={data.profile} pets={pets} petIdx={safeIdx} setPetIdx={setPetIdx} go={go} />}
          {screen === 'carnet' && <Carnet pets={pets} petIdx={safeIdx} setPetIdx={setPetIdx} reload={reload} go={go} />}
          {screen === 'servicios' && <Servicios providers={data.providers} />}
          {screen === 'beneficios' && <Beneficios benefits={data.benefits} />}
          {screen === 'reintegros' && <Reintegros profile={data.profile} pets={pets} reintegros={data.reintegros} reintTotal={data.reintTotal} userId={userId} reload={reload} go={go} />}
          {screen === 'foros' && <Foros posts={data.posts} userId={userId} reload={reload} />}
          {screen === 'perfil' && <Perfil profile={data.profile} go={go} />}
          {screen === 'mismascotas' && <MisMascotas pets={pets} userId={userId} reload={reload} go={go} setPetIdx={setPetIdx} />}
          {screen === 'guardados' && <Guardados />}
          {screen === 'minegocio' && <Negocio negocio={data.negocio} userId={userId} phone={data.profile?.phone ?? ''} reload={reload} />}
        </View>
        <View style={styles.tabbar}>
          {TABS.map((t) => {
            const active = t.k === 'mas' ? masOpen : screen === t.k && !masOpen;
            return (
              <Pressable key={t.k} onPress={() => (t.k === 'mas' ? setMasOpen(true) : go(t.k as Screen))} style={styles.tabitem}>
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

