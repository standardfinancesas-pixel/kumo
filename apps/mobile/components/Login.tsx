import { useState } from 'react';
import { ScrollView, TextInput, TouchableOpacity, View, Image, type ImageSourcePropType, Platform } from 'react-native';
import { colors } from '@kumo/shared';
import { supabase } from '../lib/supabase';
import { Texto as Text, FH, FREG, BRAND, LIME, INK, MUTED } from './ui/Texto';
import BotonGoogle from './BotonGoogle';
import { CampoClave } from './ui/Controles';

const HERO: ImageSourcePropType = require('../assets/happy-dog.webp');

/**
 * La pantalla de entrada de la app.
 *
 * Hasta acá solo sabía ingresar, y a quien no era socio le decía que el alta se
 * hacía en la web: había que salir de la app, abrir el navegador y volver. Ahora
 * las tres puertas están acá — mail y contraseña, Google, o darse de alta.
 */
export default function Login({ onAlta, onRecuperar }: { onAlta: () => void; onRecuperar: () => void }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!email.trim() || !pass) { setErr('Completá tu email y contraseña.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    // Nombra las dos causas posibles a propósito: quien se asoció con Google no
    // tiene contraseña, y Supabase devuelve el mismo error que con una equivocada.
    if (error) setErr('No pudimos ingresar. Revisá el mail y la contraseña, o entrá con Google si te asociaste así.');
    setBusy(false);
  };

  const input = {
    borderWidth: 1.5, borderColor: colors.violet[200], borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 15, color: INK, backgroundColor: '#fff', fontFamily: FREG,
  } as const;

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginBottom: 26 }}>
        <Image source={HERO} style={{ width: 92, height: 92, borderRadius: 26, marginBottom: 16 }} />
        {/* Sin fontWeight: el peso ya está en el nombre de la familia
            (Baloo2_800ExtraBold). Pedirle además un peso que no existe como
            archivo hace que Android no encuentre la variante y caiga en la
            tipografía del sistema — por eso este "Kumo" no se veía como el del
            splash. */}
        <Text style={{ fontFamily: FH, fontSize: 32, color: BRAND }}>Kumo</Text>
        <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>El club de tu mascota</Text>
      </View>

      <Text style={{ fontFamily: FH, fontSize: 22, color: INK, marginBottom: 4 }}>Ingresá a tu cuenta</Text>
      <Text style={{ fontSize: 13.5, color: MUTED, marginBottom: 20 }}>El mismo mail y contraseña que en la web.</Text>

      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 7 }}>EMAIL</Text>
      <TextInput
        value={email} onChangeText={setEmail} placeholder="vos@email.com" placeholderTextColor={colors.violet[400]}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={[input, { marginBottom: 14 }]}
      />
      {/* Sin requisitos: acá no se elige una clave, se escribe la que ya se tiene, y
          mostrarle "al menos 8 caracteres" a un socio que se registró con la regla
          vieja lo haría dudar de su propia cuenta. El ojito sí, que en un teclado
          táctil es lo que evita la mitad de los "mi contraseña no funciona". */}
      <CampoClave
        label="Contraseña" valor={pass} onCambio={setPass}
        requisitos={false} autoComplete="current-password"
      />

      <TouchableOpacity onPress={onRecuperar} style={{ alignSelf: 'flex-end', paddingVertical: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: BRAND }}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>

      {err ? <Text style={{ color: colors.danger.fg, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{err}</Text> : null}

      <TouchableOpacity
        onPress={submit} disabled={busy}
        style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12, opacity: busy ? 0.6 : 1 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{busy ? 'Ingresando…' : 'Ingresar'}</Text>
      </TouchableOpacity>

      {/* Google NO se ofrece en iOS, y no es una falta de cariño por Apple: su
          regla 4.8 dice que una app con login de terceros TIENE que ofrecer
          también "Sign in with Apple", y no lo tenemos (todavía). Sin login de
          terceros, la regla no aplica: en iOS se entra con mail y contraseña, y
          Google sigue en Android y en la web. El día que se agregue Sign in with
          Apple, este Platform.OS se saca y vuelven los dos. */}
      {Platform.OS !== 'ios' && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.violet[100] }} />
            <Text style={{ fontSize: 12.5, color: MUTED }}>o</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.violet[100] }} />
          </View>

          <BotonGoogle onError={setErr} />
        </>
      )}

      <View style={{ backgroundColor: colors.violet[50], borderWidth: 1, borderColor: colors.violet[200], borderRadius: 14, padding: 16, marginTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: INK }}>+</Text>
          </View>
          <Text style={{ fontWeight: '700', fontSize: 14, color: INK }}>¿Todavía no sos socio?</Text>
        </View>
        {/* Que el botón de Google también sirve para asociarse no se ve: está arriba,
            debajo de "Ingresar". Sin decirlo, quien quiere entrar con Google y todavía
            no es socio no sabe que ese es su camino. */}
        <Text style={{ fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: 12 }}>
          Sumá a tu mascota al club desde acá: son cinco pasos y te queda el carnet digital listo.
          También podés empezar con Google, con el botón de arriba.
        </Text>
        <TouchableOpacity
          onPress={onAlta}
          style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: BRAND, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
        >
          <Text style={{ color: BRAND, fontWeight: '700', fontSize: 15 }}>Crear mi cuenta</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
