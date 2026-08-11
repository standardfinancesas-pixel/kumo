import { useState, createElement } from 'react';
import { ScrollView, Text as RNText, TextProps, TextInput, TouchableOpacity, View, Image, ImageSourcePropType } from 'react-native';
import { colors } from '@kumo/shared';
import { supabase } from '../lib/supabase';

const FH = 'Baloo2_800ExtraBold';
const FREG = 'DMSans_500Medium';
const Text = (props: TextProps) => createElement(RNText, { ...props, style: [{ fontFamily: FREG, color: colors.text }, props.style] });
const BRAND = colors.brand.primary;
const LIME = colors.brand.lime;
const INK = colors.text;
const MUTED = colors.textMuted;

const HERO: ImageSourcePropType = require('../assets/happy-dog.webp');

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!email.trim() || !pass) { setErr('Completá tu email y contraseña.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) setErr('No pudimos ingresar. Revisá tus datos.');
    setBusy(false);
  };

  const input = {
    borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 15, color: INK, backgroundColor: '#fff', fontFamily: FREG,
  } as const;

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 26 }}>
        <Image source={HERO} style={{ width: 92, height: 92, borderRadius: 26, marginBottom: 16 }} />
        <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 32, color: BRAND }}>Kumo</Text>
        <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>El club de tu mascota</Text>
      </View>

      <Text style={{ fontFamily: FH, fontWeight: '800', fontSize: 22, color: INK, marginBottom: 4 }}>Ingresá a tu cuenta</Text>
      <Text style={{ fontSize: 13.5, color: MUTED, marginBottom: 20 }}>Usá el mismo mail y contraseña que en la web.</Text>

      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 7 }}>EMAIL</Text>
      <TextInput
        value={email} onChangeText={setEmail} placeholder="vos@email.com" placeholderTextColor={colors.violet[400]}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={[input, { marginBottom: 14 }]}
      />
      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 7 }}>CONTRASEÑA</Text>
      <TextInput
        value={pass} onChangeText={setPass} placeholder="••••••••" placeholderTextColor={colors.violet[400]}
        secureTextEntry autoComplete="current-password" style={input}
      />

      {err ? <Text style={{ color: colors.danger.fg, fontSize: 13, marginTop: 12 }}>{err}</Text> : null}

      <TouchableOpacity
        onPress={submit} disabled={busy}
        style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 22, opacity: busy ? 0.6 : 1 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{busy ? 'Ingresando…' : 'Ingresar'}</Text>
      </TouchableOpacity>

      <View style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 14, padding: 16, marginTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: INK }}>+</Text>
          </View>
          <Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>¿Todavía no sos socio?</Text>
        </View>
        <Text style={{ fontSize: 13, color: MUTED, lineHeight: 19 }}>
          El alta se hace desde la web de Kumo. Una vez que tengas tu cuenta, ingresás acá con el mismo mail.
        </Text>
      </View>
    </ScrollView>
  );
}
