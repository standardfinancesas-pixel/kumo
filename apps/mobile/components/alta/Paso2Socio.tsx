import { View } from 'react-native';
import { PROVINCIAS, formatDni, formatTel, formatFecha, validarSocio, avisoFnac, hoyISO, type SocioAlta } from '@kumo/shared';
import { Texto as Text, INK, MUTED } from '../ui/Texto';
import { Campo, CampoClave, Selector } from '../ui/Controles';
import { CampoDomicilio, CampoZona } from '../ui/CampoDomicilio';

/**
 * Paso 2 · Los datos del socio.
 *
 * Las validaciones y los formateadores vienen de `@kumo/shared`: son exactamente
 * los mismos que usa el alta de la web, así que un DNI que una superficie acepta
 * la otra también.
 *
 * Con Google el mail viene de la sesión y no se puede editar, y no hay contraseña
 * que elegir: esa cuenta se identifica con Google, no con una clave nuestra.
 */
export default function Paso2Socio({
  socio, onCambio, conGoogle,
}: { socio: SocioAlta; onCambio: (s: SocioAlta) => void; conGoogle: boolean }) {
  // Campo por campo, para marcar en rojo el que falla en vez de solo bloquear el
  // botón: un formulario de nueve campos que no dice cuál está mal es una trampa.
  const v = validarSocio(socio, conGoogle);
  const set = (parte: Partial<SocioAlta>) => onCambio({ ...socio, ...parte });

  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>Tus datos</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>
        {conGoogle ? 'Entraste con Google, así que solo faltan estos datos.' : 'Con esto armamos tu carnet de socio.'}
      </Text>

      <Campo
        label="Nombre y apellido" valor={socio.nombre} onCambio={(t) => set({ nombre: t })}
        mal={socio.nombre.length > 0 && !v.nombre} placeholder="Como figura en tu DNI" autoCapitalize="words"
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Campo
            label="DNI" valor={socio.dni} onCambio={(t) => set({ dni: formatDni(t) })}
            mal={socio.dni.length > 0 && !v.dni} placeholder="00.000.000" keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            label="Fecha de nac." valor={socio.fnac} onCambio={(t) => set({ fnac: formatFecha(t) })}
            ayuda={avisoFnac(socio.fnac, hoyISO()) ?? undefined}
            mal={socio.fnac.length > 0 && !v.fnac} placeholder="dd/mm/aaaa" keyboardType="numeric"
          />
        </View>
      </View>

      {/*
        * La provincia y la localidad van ARRIBA del domicilio, y no es orden estético:
        * son las pistas con las que se busca la calle. "9 de julio 250" en Buenos Aires
        * devuelve Bahía Blanca y Coronel Dorrego y Tandil ni aparece; con la localidad
        * puesta contesta una sola dirección y es la correcta. Con los campos abajo,
        * cuando alguien escribía su calle los dos estaban vacíos.
        */}
      <Selector
        label="Provincia" valor={socio.provincia} opciones={PROVINCIAS}
        placeholder="Elegí una provincia" onCambio={(p) => set({ provincia: p })}
      />
      <CampoZona
        label="Localidad" valor={socio.localidad}
        provincia={socio.provincia || undefined}
        onCambio={(t) => set({ localidad: t })}
        // Elegir la localidad completa también la provincia: "Tandil" es de Buenos
        // Aires y no hace falta que nadie lo aclare.
        onElegir={(z) => set({ localidad: z.localidad, provincia: z.provincia })}
        placeholder="Ej. Palermo"
      />
      {/* Elegir de la lista llena domicilio, localidad y provincia de una vez y ya
          normalizados (ver CampoDomicilio). Escribir a mano sigue valiendo: el
          callejero oficial no tiene countries ni direcciones rurales. */}
      <CampoDomicilio
        valor={socio.domicilio}
        provincia={socio.provincia || undefined}
        localidad={socio.localidad || undefined}
        onCambio={(t) => set({ domicilio: t })}
        onElegir={(l) => set({ domicilio: l.domicilio, localidad: l.localidad, provincia: l.provincia })}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Campo
            label="Teléfono" valor={socio.tel} onCambio={(t) => set({ tel: formatTel(t) })}
            mal={socio.tel.length > 0 && !v.tel} placeholder="11 5555 2024" keyboardType="phone-pad"
          />
        </View>
      </View>

      <Campo
        label="Email" valor={socio.email} onCambio={(t) => set({ email: t })}
        mal={socio.email.length > 0 && !v.email} placeholder="vos@email.com"
        keyboardType="email-address" autoCapitalize="none" editable={!conGoogle}
        ayuda={conGoogle ? 'Es el mail de tu cuenta de Google.' : undefined}
      />

      {conGoogle ? null : (
        <CampoClave
          valor={socio.password} onCambio={(t) => set({ password: t })}
          mal={socio.password.length > 0 && !v.password} autoComplete="new-password"
        />
      )}
    </View>
  );
}
