import { View } from 'react-native';
import { HEALTH_Q, SANITARIO_Q, colors, type DeclaracionAlta } from '@kumo/shared';
import { Texto as Text, BRAND, INK, MUTED } from '../ui/Texto';
import { Segmentado, Tilde, estiloInput } from '../ui/Controles';
import { TextInput } from 'react-native';

/**
 * Paso 4 · La declaración jurada de salud.
 *
 * Las preguntas salen de `@kumo/shared` y NO se mandan al servidor: viaja solo el
 * Sí/No de cada una, por posición, y el servidor arma el par pregunta/respuesta con
 * su propia lista. Es lo que impide que quede guardado un "No" contra una pregunta
 * distinta de la que la persona contestó — y es un registro legal, así que importa.
 *
 * Ojo si se copia de "agregar mascota" (`App.tsx`): ahí se llama a
 * `armarDeclaracion` en el cliente porque va a una función de la base. Acá no: el
 * endpoint del alta espera las respuestas crudas y las arma él.
 */
export default function Paso4Declaracion({
  declaracion, onCambio, nombreMascota,
}: { declaracion: DeclaracionAlta; onCambio: (d: DeclaracionAlta) => void; nombreMascota: string }) {
  const firmada = declaracion.firma.trim().length > 2;
  const hoy = new Date();
  const fechaHoy = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;

  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>Declaración jurada</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>
        Contanos cómo está la salud de {nombreMascota || 'tu mascota'}. Con esta info definimos qué reintegros aplican desde el día uno.
      </Text>

      {HEALTH_Q.map((q, i) => (
        <View key={i} style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13.5, color: INK, marginBottom: 7, lineHeight: 19 }}>{q}</Text>
          <Segmentado
            opciones={['Sí', 'No']}
            valor={declaracion.health[i] ?? ''}
            onCambio={(v) => onCambio({ ...declaracion, health: { ...declaracion.health, [i]: v } })}
          />
        </View>
      ))}

      <Text style={{ fontWeight: '700', fontSize: 15, color: INK, marginTop: 8, marginBottom: 12 }}>Plan sanitario</Text>
      {SANITARIO_Q.map((q, i) => (
        <View key={i} style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13.5, color: INK, marginBottom: 7 }}>{q}</Text>
          <Segmentado
            opciones={['Sí', 'No']}
            valor={declaracion.sanit[i] ?? ''}
            onCambio={(v) => onCambio({ ...declaracion, sanit: { ...declaracion.sanit, [i]: v } })}
          />
        </View>
      ))}

      <Text style={{ fontWeight: '700', fontSize: 15, color: INK, marginTop: 8, marginBottom: 6 }}>Firma digital</Text>
      <Text style={{ fontSize: 12.5, color: MUTED, marginBottom: 10, lineHeight: 18 }}>
        Escribí tu nombre completo tal cual figura en tu DNI. Equivale a tu firma según la Ley 25.506.
      </Text>
      <TextInput
        value={declaracion.firma}
        onChangeText={(t) => onCambio({ ...declaracion, firma: t })}
        placeholder="Tu nombre y apellido"
        placeholderTextColor={colors.violet[400]}
        autoCapitalize="words"
        style={[estiloInput, { fontFamily: 'Baloo2_700Bold', fontSize: 18, textAlign: 'center' }]}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: MUTED }}>Fecha: {fechaHoy}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: firmada ? colors.success.fg : MUTED }}>
          {firmada ? '✓ Firma registrada' : 'Pendiente de firma'}
        </Text>
      </View>

      <View style={{ backgroundColor: '#f7f6fa', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.violet[50] }}>
        <Tilde marcado={declaracion.acepta} onCambio={(v) => onCambio({ ...declaracion, acepta: v })}>
          Declaro bajo juramento que la información es verdadera y completa, y me comprometo a mantener el plan sanitario al día y a notificar cualquier diagnóstico relevante dentro de los 30 días.
        </Tilde>
      </View>
      <Text style={{ fontSize: 11.5, color: MUTED, marginTop: 10, lineHeight: 17 }}>
        Firmado por <Text style={{ fontWeight: '700', color: BRAND }}>{declaracion.firma.trim() || '—'}</Text>. Queda guardado con la fecha y no se puede modificar después.
      </Text>
    </View>
  );
}
