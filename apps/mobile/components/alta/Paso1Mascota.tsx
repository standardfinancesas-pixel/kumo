import { useState } from 'react';
import { Alert, Image, TouchableOpacity, View, type ImageSourcePropType } from 'react-native';
import { colors, type MascotaAlta } from '@kumo/shared';
import { Texto as Text, BRAND, INK, MUTED } from '../ui/Texto';
import { Campo, Segmentado } from '../ui/Controles';
import { elegirFoto, type FotoElegida } from '../../lib/subirFoto';

/**
 * Paso 1 · La mascota.
 *
 * Los campos son los mismos que el alta de la web y que el "agregar mascota" que ya
 * existe en la app. Lo único obligatorio es el nombre: el resto se puede completar
 * después desde el carnet, y pedir todo acá haría abandonar el alta.
 *
 * Las fotos de ejemplo están porque muchas altas se hacen sin una foto a mano, y un
 * carnet sin foto se ve roto. Son las mismas tres que la web.
 */

const EJEMPLOS: { clave: string; img: ImageSourcePropType }[] = [
  { clave: 'happy-dog.webp', img: require('../../assets/happy-dog.webp') },
  { clave: 'plan-cat.webp', img: require('../../assets/plan-cat.webp') },
  { clave: 'plan-dalmata-cut.webp', img: require('../../assets/plan-dalmata-cut.webp') },
];

export default function Paso1Mascota({
  pet, onCambio, foto, onFoto,
}: {
  pet: MascotaAlta;
  onCambio: (p: MascotaAlta) => void;
  foto: FotoElegida | null;
  onFoto: (f: FotoElegida | null) => void;
}) {
  const [error, setError] = useState('');

  const buscarFoto = async () => {
    setError('');
    const r = await elegirFoto();
    if ('cancelado' in r) return;
    if ('error' in r) { setError(r.error); return; }
    onFoto(r.foto);
    // Si venía una de ejemplo, la propia gana: no pueden convivir.
    onCambio({ ...pet, foto: '' });
  };

  const usarEjemplo = (clave: string) => {
    const aplicar = () => { onFoto(null); setError(''); onCambio({ ...pet, foto: clave }); };
    if (!foto) { aplicar(); return; }
    // En la web esto es un `confirm()`, que en React Native no existe.
    Alert.alert(
      'Cambiar la foto',
      'Si elegís una de ejemplo se descarta la que subiste.',
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Usar la de ejemplo', onPress: aplicar }],
    );
  };

  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>Tu mascota</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>Contanos sobre quién vas a cuidar.</Text>

      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 8 }}>FOTO</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
        <TouchableOpacity
          onPress={buscarFoto}
          style={{ width: 74, height: 74, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.violet[200], alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#fff' }}
        >
          {foto ? (
            <Image source={{ uri: foto.uri }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ fontSize: 11, color: MUTED, textAlign: 'center' }}>Subí{'\n'}una foto</Text>
          )}
        </TouchableOpacity>
        {EJEMPLOS.map((e) => {
          const on = !foto && pet.foto === e.clave;
          return (
            <TouchableOpacity
              key={e.clave}
              onPress={() => usarEjemplo(e.clave)}
              style={{ width: 74, height: 74, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: on ? BRAND : 'transparent' }}
            >
              <Image source={e.img} style={{ width: '100%', height: '100%' }} />
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
        Subí una foto de tu mascota, o elegí una de ejemplo por ahora.
      </Text>
      {error ? <Text style={{ fontSize: 12.5, color: colors.danger.fg, fontWeight: '700', marginBottom: 12 }}>{error}</Text> : null}

      <Campo label="Nombre" valor={pet.nombre} onCambio={(v) => onCambio({ ...pet, nombre: v })} placeholder="Ej. Manchas" />

      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>ESPECIE</Text>
      <View style={{ marginBottom: 12 }}>
        <Segmentado opciones={['Perro', 'Gato', 'Otro']} valor={pet.especie} onCambio={(v) => onCambio({ ...pet, especie: v })} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>SEXO</Text>
          <Segmentado opciones={['Macho', 'Hembra']} valor={pet.sexo} onCambio={(v) => onCambio({ ...pet, sexo: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>CASTRADO/A</Text>
          <Segmentado opciones={['Sí', 'No']} valor={pet.castrado} onCambio={(v) => onCambio({ ...pet, castrado: v })} />
        </View>
      </View>

      <Campo label="Raza" valor={pet.raza} onCambio={(v) => onCambio({ ...pet, raza: v })} placeholder="Ej. Mestizo" />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Campo label="Edad aprox." valor={pet.edad} onCambio={(v) => onCambio({ ...pet, edad: v })} placeholder="4 años" />
        </View>
        <View style={{ flex: 1 }}>
          <Campo label="Peso" valor={pet.peso} onCambio={(v) => onCambio({ ...pet, peso: v })} placeholder="12 kg" />
        </View>
      </View>
      <Campo label="N° de microchip (si tiene)" valor={pet.microchip} onCambio={(v) => onCambio({ ...pet, microchip: v })} placeholder="982 000 000 000" keyboardType="numeric" />
      <Campo label="Veterinaria habitual" valor={pet.vet} onCambio={(v) => onCambio({ ...pet, vet: v })} placeholder="Nombre de la clínica" />
    </View>
  );
}
