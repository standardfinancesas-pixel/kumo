import { useState } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
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
 * Sin fotos de ejemplo: un carnet con la mascota de otra persona es peor que uno sin
 * foto. Si no la tiene a mano, la carga después desde el carnet.
 */

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
  };

  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>Tu mascota</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>Contanos sobre quién vas a cuidar.</Text>

      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 8 }}>FOTO</Text>
      <TouchableOpacity
        onPress={buscarFoto}
        style={{ width: 84, height: 84, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: foto ? BRAND : colors.violet[200], alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#faf9fd' }}
      >
        {foto ? (
          <Image source={{ uri: foto.uri }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ fontSize: 11, color: MUTED, textAlign: 'center' }}>Subí{'\n'}una foto</Text>
        )}
      </TouchableOpacity>
      <Text style={{ fontSize: 12, color: MUTED, marginTop: 8, marginBottom: 16 }}>
        {foto ? 'Vas a usar esta foto.' : 'Si no tenés una a mano, la podés cargar después desde el carnet.'}
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
