import { TextInput, TouchableOpacity, View } from 'react-native';
import { HEALTH_Q, SANITARIO_Q, colors, declaracionDeMascotaOk, type MascotaBorrador } from '@kumo/shared';
import { Texto as Text, BRAND, INK, MUTED } from '../ui/Texto';
import { Segmentado, Tilde, estiloInput } from '../ui/Controles';

/**
 * Paso 4 · La declaración jurada, una por mascota.
 *
 * Las preguntas se repiten por mascota porque la declaración es de cada animal, no
 * del socio: son 7 de salud y 4 sanitarias sobre *ese* animal, y se guarda una fila
 * por mascota. Van en acordeón para que cinco mascotas no sean una pantalla de 55
 * preguntas abiertas.
 *
 * La firma va UNA sola vez al final y cubre a todas: es un solo acto legal con N
 * anexos, que es exactamente lo que es.
 *
 * Las preguntas salen de `@kumo/shared` y NO se mandan al servidor: viaja solo el
 * Sí/No de cada una, por posición, y el servidor arma el par pregunta/respuesta con
 * su propia lista. Es lo que impide que quede guardado un "No" contra una pregunta
 * distinta de la que la persona contestó.
 *
 * Ojo si se copia de "agregar mascota" (`App.tsx`): ahí se llama a `armarDeclaracion`
 * en el cliente porque va a una función de la base. Acá no: el endpoint del alta
 * espera las respuestas crudas y las arma él.
 */

function DeclaracionDeMascota({
  m, abierta, onAbrir, onCambio,
}: {
  m: MascotaBorrador;
  abierta: boolean;
  onAbrir: () => void;
  onCambio: (parte: Partial<Pick<MascotaBorrador, 'salud' | 'sanit'>>) => void;
}) {
  const completa = declaracionDeMascotaOk(m);
  const faltan = HEALTH_Q.length + SANITARIO_Q.length - Object.keys(m.salud).length - Object.keys(m.sanit).length;

  return (
    <View style={{ borderWidth: 1, borderColor: colors.violet[200], backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
      <TouchableOpacity
        onPress={onAbrir}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: abierta ? '#faf9fd' : '#fff', paddingHorizontal: 16, paddingVertical: 14 }}
      >
        <Text style={{ fontWeight: '700', fontSize: 15, color: INK, flex: 1 }}>{m.datos.nombre.trim() || 'Tu mascota'}</Text>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: completa ? colors.success.fg : MUTED }}>
          {completa ? '✓ completa' : faltan > 0 ? `faltan ${faltan}` : 'incompleta'}
        </Text>
      </TouchableOpacity>

      {abierta ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          {HEALTH_Q.map((q, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 13.5, color: INK, marginBottom: 7, lineHeight: 19 }}>{q}</Text>
              <Segmentado opciones={['Sí', 'No']} valor={m.salud[i] ?? ''} onCambio={(v) => onCambio({ salud: { ...m.salud, [i]: v } })} />
            </View>
          ))}
          <Text style={{ fontWeight: '700', fontSize: 14.5, color: INK, marginTop: 6, marginBottom: 12 }}>Plan sanitario</Text>
          {SANITARIO_Q.map((q, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 13.5, color: INK, marginBottom: 7 }}>{q}</Text>
              <Segmentado opciones={['Sí', 'No']} valor={m.sanit[i] ?? ''} onCambio={(v) => onCambio({ sanit: { ...m.sanit, [i]: v } })} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function Paso4Declaracion({
  mascotas, firma, acepta, abierta, onAbrir, onCambioMascota, onFirma, onAcepta,
}: {
  mascotas: MascotaBorrador[];
  firma: string;
  acepta: boolean;
  abierta: string | null;
  onAbrir: (uid: string | null) => void;
  onCambioMascota: (uid: string, parte: Partial<Pick<MascotaBorrador, 'salud' | 'sanit'>>) => void;
  onFirma: (v: string) => void;
  onAcepta: (v: boolean) => void;
}) {
  const firmada = firma.trim().length > 2;
  const hoy = new Date();
  const fechaHoy = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
  const varias = mascotas.length > 1;

  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>Declaración jurada</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18, lineHeight: 20 }}>
        {varias
          ? 'Contanos cómo está la salud de cada una. Con esta info definimos qué reintegros aplican desde el día uno.'
          : `Contanos cómo está la salud de ${mascotas[0]?.datos.nombre.trim() || 'tu mascota'}. Con esta info definimos qué reintegros aplican desde el día uno.`}
      </Text>

      {mascotas.map((m) => (
        <DeclaracionDeMascota
          key={m.uid}
          m={m}
          abierta={(abierta ?? mascotas[0]?.uid) === m.uid}
          onAbrir={() => onAbrir(abierta === m.uid ? null : m.uid)}
          onCambio={(parte) => onCambioMascota(m.uid, parte)}
        />
      ))}

      <Text style={{ fontWeight: '700', fontSize: 15, color: INK, marginTop: 14, marginBottom: 6 }}>Firma digital</Text>
      <Text style={{ fontSize: 12.5, color: MUTED, marginBottom: 10, lineHeight: 18 }}>
        Escribí tu nombre completo tal cual figura en tu DNI. Equivale a tu firma según la Ley 25.506{varias ? ', y cubre a todas tus mascotas' : ''}.
      </Text>
      <TextInput
        value={firma}
        onChangeText={onFirma}
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
        <Tilde marcado={acepta} onCambio={onAcepta}>
          {`Declaro bajo juramento que la información ${varias ? 'de todas mis mascotas ' : ''}es verdadera y completa, y me comprometo a mantener el plan sanitario al día y a notificar cualquier diagnóstico relevante dentro de los 30 días.`}
        </Tilde>
      </View>
      <Text style={{ fontSize: 11.5, color: MUTED, marginTop: 10, lineHeight: 17 }}>
        Firmado por <Text style={{ fontWeight: '700', color: BRAND }}>{firma.trim() || '—'}</Text>. Queda guardado con la fecha y no se puede modificar después.
      </Text>
    </View>
  );
}
