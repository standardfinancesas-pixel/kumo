import { useEffect, useRef, useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '@kumo/shared';
import { Texto as Text, INK, MUTED } from './Texto';
import { apiKumo } from '../../lib/api';

/**
 * Los campos de lugar de la app, gemelos de los de la web
 * (`apps/web/components/CampoDomicilio.tsx`).
 *
 * Consultan la misma ruta —`/api/lugares`, un pasamanos con caché a Georef, el
 * normalizador de direcciones del Estado— y son dos porque son dos preguntas:
 * `CampoDomicilio` busca calles con altura y llena domicilio, localidad y provincia;
 * `CampoZona` busca localidades y barrios, que es lo que va en un campo de zona.
 *
 * **Los dos siguen siendo texto libre**: el callejero no tiene countries, barrios
 * nuevos ni "Zona Sur GBA", y nadie puede quedarse sin darse de alta porque su casa
 * no figure en una base.
 *
 * La lista va EN FLUJO y no flotando encima del formulario: en el teléfono un
 * desplegable absoluto queda debajo del teclado o tapa el campo siguiente, y las
 * pantallas donde vive esto ya scrollean.
 */
export type LugarElegido = { domicilio: string; localidad: string; provincia: string };
export type ZonaElegida = { zona: string; localidad: string; provincia: string };
type Fila = { id: string; etiqueta: string };
/** La sugerencia de dirección trae el punto: hace falta para preguntar el barrio. */
type FilaDireccion = Fila & LugarElegido & { lat: number; lng: number };

const ESPERA_MS = 350;

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

/** La búsqueda con debounce. `elegido` evita que al elegir se dispare una búsqueda
 *  nueva con ese mismo texto y la lista vuelva a aparecer sola. */
function useSugerencias<T extends Fila>(valor: string, tipo: 'direccion' | 'localidad', provincia?: string) {
  const [sugerencias, setSugerencias] = useState<T[]>([]);
  const elegido = useRef<string | null>(null);
  const minimo = tipo === 'localidad' ? 3 : 4;

  useEffect(() => {
    const texto = valor.trim();
    if (texto === elegido.current) return;
    if (texto.length < minimo) { setSugerencias([]); return; }

    let vivo = true;
    const reloj = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: texto });
        if (tipo === 'localidad') params.set('tipo', 'localidad');
        if (provincia) params.set('provincia', provincia);
        const r = await fetch(`${apiKumo}/api/lugares?${params}`);
        if (!r.ok || !vivo) return;
        const { sugerencias: lista } = (await r.json()) as { sugerencias: T[] };
        if (vivo) setSugerencias(lista);
      } catch {
        // Sin red o sin servicio: el campo sigue siendo un input de texto.
      }
    }, ESPERA_MS);

    return () => { vivo = false; clearTimeout(reloj); };
  }, [valor, provincia, tipo, minimo]);

  const cerrar = (textoElegido: string) => {
    elegido.current = textoElegido;
    setSugerencias([]);
  };

  return { sugerencias, cerrar };
}

function CampoConLista<T extends Fila>({
  label, valor, onCambio, onElegir, sugerencias, placeholder, ayuda,
}: {
  label: string;
  valor: string;
  onCambio: (t: string) => void;
  onElegir: (fila: T) => void;
  sugerencias: T[];
  placeholder?: string;
  ayuda?: string;
}) {
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
      {ayuda ? <Text style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>{ayuda}</Text> : null}
      {sugerencias.length > 0 && (
        <View style={{ marginTop: 6, borderWidth: 1, borderColor: colors.violet[200], borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
          {sugerencias.map((s, i) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => onElegir(s)}
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

export function CampoDomicilio({
  label = 'Domicilio', valor, provincia, onCambio, onElegir, placeholder = 'Calle y número', ayuda,
}: {
  label?: string;
  valor: string;
  /** La provincia ya elegida, si hay: acota la búsqueda muchísimo. */
  provincia?: string;
  onCambio: (texto: string) => void;
  onElegir: (lugar: LugarElegido) => void;
  placeholder?: string;
  ayuda?: string;
}) {
  const { sugerencias, cerrar } = useSugerencias<FilaDireccion>(valor, 'direccion', provincia);
  return (
    <CampoConLista
      label={label}
      valor={valor}
      onCambio={onCambio}
      sugerencias={sugerencias}
      placeholder={placeholder}
      ayuda={ayuda}
      onElegir={(f) => {
        cerrar(f.domicilio);
        onElegir({ domicilio: f.domicilio, localidad: f.localidad, provincia: f.provincia });
        /* En CABA el callejero oficial devuelve la comuna, y nadie dice que vive en la
           Comuna 13: dice Belgrano. El barrio se pregunta aparte —una consulta, recién
           cuando ya eligió— y llega un instante después. El campo se llena primero con
           la comuna para no quedarse esperando a un servicio de terceros. */
        if (f.provincia === 'CABA') {
          fetch(`${apiKumo}/api/lugares/barrio?lat=${f.lat}&lng=${f.lng}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d: { barrio?: string } | null) => {
              if (d?.barrio) onElegir({ domicilio: f.domicilio, localidad: d.barrio, provincia: f.provincia });
            })
            .catch(() => {});
        }
      }}
    />
  );
}

export function CampoZona({
  label = 'Zona', valor, provincia, onCambio, onElegir, placeholder = 'Palermo, CABA', ayuda,
}: {
  label?: string;
  valor: string;
  provincia?: string;
  onCambio: (texto: string) => void;
  onElegir: (zona: ZonaElegida) => void;
  placeholder?: string;
  ayuda?: string;
}) {
  const { sugerencias, cerrar } = useSugerencias<Fila & ZonaElegida>(valor, 'localidad', provincia);
  return (
    <CampoConLista
      label={label}
      valor={valor}
      onCambio={onCambio}
      sugerencias={sugerencias}
      placeholder={placeholder}
      ayuda={ayuda}
      onElegir={(f) => {
        cerrar(f.zona);
        onElegir({ zona: f.zona, localidad: f.localidad, provincia: f.provincia });
      }}
    />
  );
}
