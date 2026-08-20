import { useEffect, useRef, useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '@kumo/shared';
import { Texto as Text, INK, MUTED } from './Texto';
import { apiKumo } from '../../lib/api';

/**
 * El campo de domicilio con las direcciones reales del callejero argentino.
 *
 * Es el gemelo del de la web (`apps/web/components/CampoDomicilio.tsx`): consulta la
 * misma ruta —`/api/lugares`, que es un pasamanos con caché a Georef, el
 * normalizador de direcciones del Estado— y al elegir de la lista llena el
 * domicilio, la localidad y la provincia de una vez, ya normalizados.
 *
 * **Sigue siendo texto libre.** El callejero no tiene todo (countries, barrios
 * nuevos, direcciones rurales) y nadie puede quedarse sin poder darse de alta porque
 * su casa no figure en una base. La lista sugiere; no obliga.
 *
 * La lista va en flujo y NO flotando encima del formulario: en el teléfono, un
 * desplegable absoluto queda debajo del teclado o tapa el campo siguiente, y acá el
 * paso del alta ya scrollea.
 */
export type LugarElegido = { domicilio: string; localidad: string; provincia: string };
type Sugerencia = LugarElegido & { id: string; etiqueta: string };

const ESPERA_MS = 350;
const MINIMO = 4;

const estiloInput = {
  borderWidth: 1.5,
  borderColor: colors.violet[200],
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  color: INK,
  backgroundColor: '#fff',
} as const;

export function CampoDomicilio({
  label = 'Domicilio', valor, provincia, onCambio, onElegir, placeholder = 'Calle y número',
}: {
  label?: string;
  valor: string;
  /** La provincia ya elegida, si hay: acota la búsqueda muchísimo. */
  provincia?: string;
  onCambio: (texto: string) => void;
  onElegir: (lugar: LugarElegido) => void;
  placeholder?: string;
}) {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  /* Lo último que se eligió: evita que al elegir se dispare una búsqueda nueva con
     ese mismo texto y la lista vuelva a aparecer sola. */
  const elegido = useRef<string | null>(null);

  useEffect(() => {
    const texto = valor.trim();
    if (texto === elegido.current) return;
    if (texto.length < MINIMO) { setSugerencias([]); return; }

    let vivo = true;
    const reloj = setTimeout(async () => {
      try {
        const url = `${apiKumo}/api/lugares?q=${encodeURIComponent(texto)}${provincia ? `&provincia=${encodeURIComponent(provincia)}` : ''}`;
        const r = await fetch(url);
        if (!r.ok || !vivo) return;
        const { sugerencias: lista } = (await r.json()) as { sugerencias: Sugerencia[] };
        if (vivo) setSugerencias(lista);
      } catch {
        // Sin red o sin servicio: el campo sigue siendo un input de texto.
      }
    }, ESPERA_MS);

    return () => { vivo = false; clearTimeout(reloj); };
  }, [valor, provincia]);

  const elegir = (s: Sugerencia) => {
    elegido.current = s.domicilio;
    setSugerencias([]);
    onElegir({ domicilio: s.domicilio, localidad: s.localidad, provincia: s.provincia });
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>{label.toUpperCase()}</Text>
      <TextInput
        value={valor}
        onChangeText={onCambio}
        placeholder={placeholder}
        placeholderTextColor={colors.violet[400]}
        autoCapitalize="words"
        style={estiloInput}
      />
      {sugerencias.length > 0 && (
        <View style={{ marginTop: 6, borderWidth: 1, borderColor: colors.violet[200], borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
          {sugerencias.map((s, i) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => elegir(s)}
              style={{
                paddingHorizontal: 13, paddingVertical: 11,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.violet[100],
              }}
            >
              <Text style={{ fontSize: 13.5, color: INK }}>{s.etiqueta}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
