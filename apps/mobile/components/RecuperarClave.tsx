import { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { colors } from '@kumo/shared';
import { pedirLinkDeClave } from '../lib/api';
import { Texto as Text, BRAND, INK, MUTED } from './ui/Texto';
import { Campo } from './ui/Controles';

/**
 * Pedir el mail con el link para elegir una contraseña nueva.
 *
 * El texto dice "si esa dirección tiene una cuenta" a propósito, y la respuesta es
 * la misma exista o no: si dijera "ese mail no está registrado", cualquiera podría
 * averiguar quién es socio del club probando direcciones.
 */
export default function RecuperarClave({ onVolver }: { onVolver: () => void }) {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const pedir = async () => {
    setEnviando(true);
    await pedirLinkDeClave(email.trim().toLowerCase());
    setEnviando(false);
    setEnviado(true);
  };

  if (enviado) {
    return (
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 24, color: INK, marginBottom: 10 }}>Mirá tu casilla</Text>
        <Text style={{ fontSize: 14.5, color: MUTED, lineHeight: 21 }}>
          Si <Text style={{ fontWeight: '700', color: INK }}>{email.trim()}</Text> tiene una cuenta en Kumo, te llega un mail con un link para
          elegir una contraseña nueva. El link abre esta misma app, vence en una hora y sirve una sola vez.
        </Text>
        <Text style={{ fontSize: 13, color: MUTED, lineHeight: 20, marginTop: 14 }}>
          Si no te llega, revisá el correo no deseado. Y si te asociaste con Google, no tenés contraseña: entrá con el botón de Google.
        </Text>
        <TouchableOpacity onPress={onVolver} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 26 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Volver a ingresar</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
      <TouchableOpacity onPress={onVolver} style={{ marginBottom: 18 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND }}>← Volver</Text>
      </TouchableOpacity>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 24, color: INK, marginBottom: 6 }}>¿Olvidaste tu contraseña?</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 22, lineHeight: 20 }}>
        Poné tu mail y te mandamos un link para elegir una nueva.
      </Text>

      <Campo
        label="Email" valor={email} onCambio={setEmail} placeholder="vos@email.com"
        keyboardType="email-address" autoCapitalize="none" autoComplete="email"
      />

      <TouchableOpacity
        onPress={pedir}
        disabled={!emailOk || enviando}
        style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12, opacity: !emailOk || enviando ? 0.5 : 1 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{enviando ? 'Enviando…' : 'Enviarme el link'}</Text>
      </TouchableOpacity>
      <View style={{ height: 1, backgroundColor: colors.violet[50], marginTop: 24 }} />
    </ScrollView>
  );
}
