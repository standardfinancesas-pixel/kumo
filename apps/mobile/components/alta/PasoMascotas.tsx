import { useState } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { colors, MAX_MASCOTAS_ALTA, type MascotaBorrador } from '@kumo/shared';
import { Texto as Text, BRAND, INK, MUTED } from '../ui/Texto';
import { Campo, Segmentado } from '../ui/Controles';
import { elegirFoto, type FotoElegida } from '../../lib/subirFoto';

/**
 * Paso 1 · Las mascotas.
 *
 * Es una lista y no un formulario: se puede sumar más de una en el alta. Lo único
 * obligatorio de cada una es el nombre — el resto se completa después desde el
 * carnet, y pedir todo acá haría abandonar el alta, que es la parte más alta del
 * embudo.
 *
 * Las 11 preguntas de salud NO están acá: van en el paso 4, para que "agregar otra
 * mascota" no se convierta en un compromiso de tres minutos.
 *
 * Sin fotos de ejemplo: un carnet con la mascota de otra persona es peor que uno sin
 * foto.
 */

function FilaMascota({
  m, indice, total, foto, onCambio, onFoto, onQuitar,
}: {
  m: MascotaBorrador;
  indice: number;
  total: number;
  foto: FotoElegida | undefined;
  onCambio: (datos: MascotaBorrador['datos']) => void;
  onFoto: (f: FotoElegida) => void;
  onQuitar: () => void;
}) {
  const [error, setError] = useState('');
  const d = m.datos;
  const set = (parte: Partial<MascotaBorrador['datos']>) => onCambio({ ...d, ...parte });

  const buscarFoto = async () => {
    setError('');
    const r = await elegirFoto();
    if ('cancelado' in r) return;
    if ('error' in r) { setError(r.error); return; }
    onFoto(r.foto);
  };

  return (
    <View style={{ borderWidth: 1, borderColor: colors.violet[200], backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 16, color: BRAND }}>
          {d.nombre.trim() || `Mascota ${indice + 1}`}
        </Text>
        {/* Quitar solo aparece con más de una: no se puede dar de alta sin ninguna. */}
        {total > 1 ? (
          <TouchableOpacity onPress={onQuitar} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: MUTED }}>Quitar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

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
      <Text style={{ fontSize: 12, color: MUTED, marginTop: 8, marginBottom: 14 }}>
        {foto ? 'Vas a usar esta foto.' : 'Si no tenés una a mano, la podés cargar después desde el carnet.'}
      </Text>
      {error ? <Text style={{ fontSize: 12.5, color: colors.danger.fg, fontWeight: '700', marginBottom: 12 }}>{error}</Text> : null}

      <Campo label="Nombre" valor={d.nombre} onCambio={(v) => set({ nombre: v })} placeholder="Ej. Manchas" />

      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>ESPECIE</Text>
      <View style={{ marginBottom: 12 }}>
        <Segmentado opciones={['Perro', 'Gato', 'Otro']} valor={d.especie} onCambio={(v) => set({ especie: v })} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>SEXO</Text>
          <Segmentado opciones={['Macho', 'Hembra']} valor={d.sexo} onCambio={(v) => set({ sexo: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>CASTRADO/A</Text>
          <Segmentado opciones={['Sí', 'No']} valor={d.castrado} onCambio={(v) => set({ castrado: v })} />
        </View>
      </View>

      <Campo label="Raza" valor={d.raza} onCambio={(v) => set({ raza: v })} placeholder="Ej. Mestizo" />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Campo label="Edad aprox." valor={d.edad} onCambio={(v) => set({ edad: v })} placeholder="4 años" />
        </View>
        <View style={{ flex: 1 }}>
          <Campo label="Peso" valor={d.peso} onCambio={(v) => set({ peso: v })} placeholder="12 kg" />
        </View>
      </View>
      <Campo label="N° de microchip (si tiene)" valor={d.microchip} onCambio={(v) => set({ microchip: v })} placeholder="982 000 000 000" keyboardType="numeric" />
      <Campo label="Veterinaria habitual" valor={d.vet} onCambio={(v) => set({ vet: v })} placeholder="Nombre de la clínica" />
    </View>
  );
}

export default function PasoMascotas({
  mascotas, fotos, onCambio, onFoto, onAgregar, onQuitar,
}: {
  mascotas: MascotaBorrador[];
  fotos: Record<string, FotoElegida>;
  onCambio: (uid: string, datos: MascotaBorrador['datos']) => void;
  onFoto: (uid: string, f: FotoElegida) => void;
  onAgregar: () => void;
  onQuitar: (uid: string) => void;
}) {
  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>
        {mascotas.length > 1 ? 'Tus mascotas' : 'Tu mascota'}
      </Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>Contanos sobre quién vas a cuidar. Podés sumar más de una.</Text>

      {mascotas.map((m, i) => (
        <FilaMascota
          key={m.uid}
          m={m}
          indice={i}
          total={mascotas.length}
          foto={fotos[m.uid]}
          onCambio={(datos) => onCambio(m.uid, datos)}
          onFoto={(f) => onFoto(m.uid, f)}
          onQuitar={() => onQuitar(m.uid)}
        />
      ))}

      {mascotas.length < MAX_MASCOTAS_ALTA ? (
        <TouchableOpacity
          onPress={onAgregar}
          style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.violet[200], backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ color: BRAND, fontWeight: '700', fontSize: 14.5 }}>＋ Agregar otra mascota</Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ fontSize: 12.5, color: MUTED, textAlign: 'center' }}>
          Podés cargar hasta {MAX_MASCOTAS_ALTA} en el alta. Las demás se agregan después desde tu cuenta.
        </Text>
      )}
    </View>
  );
}
