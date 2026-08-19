import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@kumo/shared';
import { entrarConGoogle } from '../lib/google';
import { Texto as Text, INK } from './ui/Texto';

/**
 * El botón de Google, para entrar y para registrarse.
 *
 * Sirve para las dos cosas sin distinguirlas: si la cuenta ya es socia, entra; si
 * no, la app la manda al alta con el nombre y el mail ya cargados. Preguntarle a la
 * persona "¿te registrás o ingresás?" sería pedirle que sepa algo que el sistema
 * puede averiguar solo.
 */
export default function BotonGoogle({ onError }: { onError: (m: string) => void }) {
  const [yendo, setYendo] = useState(false);

  const tocar = async () => {
    setYendo(true);
    const r = await entrarConGoogle();
    // Si salió bien, la app se va al navegador y vuelve por el deep link: no hay
    // nada que apagar acá, y dejar el botón en "Abriendo…" evita el doble toque.
    if ('error' in r) { onError(r.error); setYendo(false); }
  };

  return (
    <TouchableOpacity
      onPress={tocar}
      disabled={yendo}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: colors.violet[200], backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15, opacity: yendo ? 0.6 : 1 }}
    >
      <View style={{ width: 18, height: 18 }}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09z" />
          <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <Path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
          <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </Svg>
      </View>
      <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>{yendo ? 'Abriendo Google…' : 'Continuar con Google'}</Text>
    </TouchableOpacity>
  );
}
