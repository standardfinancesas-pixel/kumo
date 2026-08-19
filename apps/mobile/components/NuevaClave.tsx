import { useState } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { colors } from '@kumo/shared';
import { supabase } from '../lib/supabase';
import { Texto as Text, BRAND, INK, MUTED } from './ui/Texto';
import { Campo } from './ui/Controles';

/**
 * Elegir la contraseña nueva, dentro de la app.
 *
 * Se llega acá por el link del mail: la sesión ya quedó puesta en `lib/deepLink`,
 * así que esta pantalla solo cambia la clave. Al terminar, la persona queda adentro
 * de la app — que es el punto de hacerlo acá y no en el navegador.
 *
 * `motivoSinSesion` es para el caso más probable de todos: el link venció o ya se
 * usó. Ahí no se puede cambiar nada y hay que pedir uno nuevo, así que conviene
 * decirlo claro en vez de mostrar un formulario que va a fallar.
 */
export default function NuevaClave({
  motivoSinSesion, onPedirOtro, onListo,
}: { motivoSinSesion?: string | null; onPedirOtro: () => void; onListo: () => void }) {
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cortaOk = clave.length >= 6;
  const coinciden = clave.length > 0 && clave === repetida;

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const { error: e } = await supabase.auth.updateUser({ password: clave });
    if (e) {
      setError(/session|jwt|expired/i.test(e.message)
        ? 'El link ya no sirve. Pedí uno nuevo y probá otra vez.'
        : 'No pudimos cambiar la contraseña. Probá de nuevo.');
      setGuardando(false);
      return;
    }
    onListo();
  };

  if (motivoSinSesion) {
    return (
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 24, color: INK, marginBottom: 10 }}>Este link ya no sirve</Text>
        <Text style={{ fontSize: 14.5, color: MUTED, lineHeight: 21 }}>{motivoSinSesion}</Text>
        <TouchableOpacity onPress={onPedirOtro} style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 26 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Pedir un link nuevo</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 24, color: INK, marginBottom: 6 }}>Elegí tu contraseña nueva</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 22, lineHeight: 20 }}>
        Con esta contraseña vas a entrar de ahora en más, en la app y en la web.
      </Text>

      <Campo
        label="Contraseña nueva" valor={clave} onCambio={setClave} placeholder="Mínimo 6 caracteres"
        secureTextEntry mal={clave.length > 0 && !cortaOk}
      />
      <Campo
        label="Repetila" valor={repetida} onCambio={setRepetida} placeholder="Otra vez, para no equivocarte"
        secureTextEntry mal={repetida.length > 0 && !coinciden}
        ayuda={repetida.length > 0 && !coinciden ? 'Las dos contraseñas tienen que ser iguales.' : undefined}
      />

      {error ? <Text style={{ fontSize: 13, color: colors.danger.fg, fontWeight: '600', marginTop: 4 }}>{error}</Text> : null}

      <TouchableOpacity
        onPress={guardar}
        disabled={!cortaOk || !coinciden || guardando}
        style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 14, opacity: !cortaOk || !coinciden || guardando ? 0.5 : 1 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{guardando ? 'Guardando…' : 'Guardar y entrar'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
