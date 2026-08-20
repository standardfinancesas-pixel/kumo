import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, chequeosClave } from '@kumo/shared';
import { Texto as Text, BRAND, INK, MUTED } from './Texto';

/**
 * Los controles de formulario de la app.
 *
 * En React Native no existen `<select>` ni `<input type="checkbox">`, así que los
 * que la web da por sentados hay que construirlos. Están acá y no dentro de las
 * pantallas porque el alta son 5 pasos y ~35 campos: escribirlos inline es cómo
 * `App.tsx` llegó a 2800 líneas.
 */

const bordeNormal = colors.violet[200];
const bordeError = colors.danger.fg;

/** El estilo de todos los inputs. Estaba repetido a mano una docena de veces. */
export const estiloInput = {
  borderWidth: 1.5, borderColor: bordeNormal, borderRadius: 12, paddingHorizontal: 14,
  paddingVertical: 12, fontSize: 15, color: INK, backgroundColor: '#fff',
  fontFamily: 'DMSans_500Medium',
} as const;

/**
 * Un campo con etiqueta.
 *
 * `mal` pinta el borde en rojo, como hace la web cuando el DNI o el teléfono no
 * validan: un formulario de nueve campos que solo bloquea el botón, sin decir cuál
 * está mal, es una trampa.
 */
export function Campo({
  label, valor, onCambio, mal = false, ayuda, ...resto
}: { label: string; valor: string; onCambio: (v: string) => void; mal?: boolean; ayuda?: string } & Omit<TextInputProps, 'value' | 'onChangeText' | 'style'>) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>{label.toUpperCase()}</Text>
      <TextInput
        value={valor}
        onChangeText={onCambio}
        placeholderTextColor={colors.violet[400]}
        style={[estiloInput, mal ? { borderColor: bordeError } : null]}
        {...resto}
      />
      {ayuda ? <Text style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>{ayuda}</Text> : null}
    </View>
  );
}

/** Grupo de opciones tipo pastilla: el equivalente del `Segmented` de la web.
 *  Es el control más usado del alta (especie, sexo, castrado, y 11 veces Sí/No). */
export function Segmentado({ opciones, valor, onCambio }: { opciones: readonly string[]; valor: string; onCambio: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {opciones.map((o) => {
        const on = valor === o;
        return (
          <TouchableOpacity
            key={o}
            onPress={() => onCambio(o)}
            style={{ flex: 1, borderWidth: 1.5, borderColor: on ? BRAND : bordeNormal, backgroundColor: on ? BRAND : '#fff', borderRadius: 11, paddingVertical: 11, alignItems: 'center' }}
          >
            <Text style={{ fontWeight: '600', fontSize: 13.5, color: on ? '#fff' : MUTED }}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** La tilde. No existe en React Native, así que es un cuadrado que se dibuja. */
export function Tilde({ marcado, onCambio, children }: { marcado: boolean; onCambio: (v: boolean) => void; children: ReactNode }) {
  return (
    <TouchableOpacity
      onPress={() => onCambio(!marcado)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: marcado ? BRAND : bordeNormal, backgroundColor: marcado ? BRAND : '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {marcado ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Text style={{ fontSize: 13, color: '#5b5670', lineHeight: 19 }}>{children}</Text> : children}</View>
    </TouchableOpacity>
  );
}

/** El punto de una lista de opciones única, como el `Radio` de la web. */
export function Punto({ on }: { on: boolean }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? BRAND : bordeNormal, alignItems: 'center', justifyContent: 'center' }}>
      {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND }} /> : null}
    </View>
  );
}

/**
 * El reemplazo del `<select>`: un botón que muestra lo elegido y abre una hoja con
 * la lista. Lo usa la provincia, que son 24 opciones — demasiadas para pastillas.
 */
export function Selector({
  label, valor, opciones, placeholder, onCambio,
}: { label: string; valor: string; opciones: readonly string[]; placeholder: string; onCambio: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>{label.toUpperCase()}</Text>
      <TouchableOpacity
        onPress={() => setAbierto(true)}
        style={{ ...estiloInput, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 }}
      >
        <Text style={{ fontSize: 15, color: valor ? INK : colors.violet[400] }}>{valor || placeholder}</Text>
        <Text style={{ fontSize: 12, color: MUTED }}>▾</Text>
      </TouchableOpacity>

      {/*
        * Va con `Modal` y no con una capa absoluta: la hoja tiene que dibujarse
        * encima de TODO, y una capa absoluta queda atrapada dentro del scroll del
        * formulario (el primer intento aparecía mil píxeles más abajo, fuera de la
        * pantalla). `Modal` es parte de React Native, así que no suma nada nativo.
        *
        * El fondo que cierra al tocarlo es HERMANO de la hoja, no su padre: si el
        * contenido va adentro de un Pressable, ese Pressable se queda con el gesto y
        * la lista no scrollea. Es el mismo detalle que ya costó un bug en las hojas
        * de la app.
        */}
      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => setAbierto(false)} style={{ flex: 1, backgroundColor: 'rgba(33,30,51,0.45)' }} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' }}>
            <View style={{ width: 40, height: 4, borderRadius: 100, backgroundColor: '#e0dcec', alignSelf: 'center', marginTop: 12 }} />
            <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 18, color: INK, textAlign: 'center', marginTop: 10, marginBottom: 6 }}>{label}</Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 26 }} keyboardShouldPersistTaps="handled">
              {opciones.map((o) => (
                <TouchableOpacity
                  key={o}
                  onPress={() => { onCambio(o); setAbierto(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.violet[50] }}
                >
                  <Text style={{ fontSize: 15, color: INK }}>{o}</Text>
                  {valor === o ? <Text style={{ color: BRAND, fontWeight: '800' }}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Un campo de contraseña con el ojito y, si se está eligiendo una, los requisitos
 * tildándose mientras se escribe.
 *
 * El ojito importa más en el teléfono que en la web: escribir una clave a ciegas en
 * un teclado táctil es la causa número uno de "mi contraseña no funciona" cuando en
 * realidad se tipeó mal. Y los requisitos van a la vista desde el principio, no como
 * error después de tocar el botón, que obliga a adivinar qué falta.
 *
 * `requisitos` se apaga en el login: ahí no se elige una clave, se escribe la que ya
 * se tiene, y mostrarle "al menos 8 caracteres" a un socio que se registró con la
 * regla vieja (6) lo haría dudar de su propia cuenta.
 */
export function CampoClave({
  label = 'Contraseña', valor, onCambio, mal = false, requisitos = true, placeholder = '••••••••', ...resto
}: {
  label?: string; valor: string; onCambio: (v: string) => void; mal?: boolean; requisitos?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'style' | 'secureTextEntry'>) {
  const [ver, setVer] = useState(false);
  const checks = chequeosClave(valor);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6 }}>{label.toUpperCase()}</Text>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          value={valor}
          onChangeText={onCambio}
          secureTextEntry={!ver}
          placeholder={placeholder}
          placeholderTextColor={colors.violet[400]}
          style={[estiloInput, { paddingRight: 48 }, mal ? { borderColor: bordeError } : null]}
          {...resto}
        />
        <TouchableOpacity
          onPress={() => setVer((x) => !x)}
          accessibilityLabel={ver ? 'Ocultar la contraseña' : 'Ver la contraseña'}
          accessibilityRole="button"
          hitSlop={10}
          style={{ position: 'absolute', right: 10, padding: 6 }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
            <Circle cx={12} cy={12} r={3.2} />
            {ver ? <Path d="M4 20L20 4" /> : null}
          </Svg>
        </TouchableOpacity>
      </View>
      {requisitos ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
          {checks.map((c) => (
            <View key={c.texto} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={c.ok ? colors.success.fg : MUTED} strokeWidth={c.ok ? 3 : 2} strokeLinecap="round" strokeLinejoin="round">
                {c.ok ? <Path d="M4 12l5 5L20 6" /> : <Circle cx={12} cy={12} r={8} />}
              </Svg>
              <Text style={{ fontSize: 12.5, color: c.ok ? colors.success.fg : MUTED }}>{c.texto}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
