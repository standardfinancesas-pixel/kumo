import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

/**
 * Resuelve el grosor a un archivo de fuente, en lugar de pedírselo a Android.
 *
 * El problema, visto en un teléfono ajeno: la misma pantalla mostraba "Kumo" en
 * Baloo y "Ingresá a tu cuenta" en la fuente del sistema, aunque las dos piden
 * Baloo. La diferencia era que la segunda además pedía `fontWeight: '800'`.
 *
 * En Android, cuando una fuente propia viene con `fontWeight`, React Native busca
 * una variante de esa familia con ese grosor; si no la encuentra, se cae a la
 * fuente del sistema. Y encontrarla o no depende de la versión de Android y del
 * fabricante: por eso el mismo build se veía bien en un teléfono y con las letras
 * cambiadas en otro. Es el peor tipo de bug — no se reproduce en el equipo de
 * quien lo escribió.
 *
 * La solución es la que recomienda Expo: no pedir grosores, pedir el archivo que
 * corresponde. Cada peso de Baloo 2 y de DM Sans es una fuente distinta y ya están
 * todas cargadas; acá se traduce el `fontWeight` al nombre de la que va, y se
 * quita el `fontWeight` para que Android no intente nada por su cuenta.
 *
 * Está centralizado a propósito: en la app hay 240 estilos que piden grosor, y
 * arreglarlos de a uno habría dejado la mitad sin arreglar y ninguna garantía para
 * el próximo que se escriba.
 */

/** Los pesos de Baloo 2 que están cargados. 800 cubre también 900. */
const BALOO: Record<string, string> = {
  '600': 'Baloo2_700Bold',
  '700': 'Baloo2_700Bold',
  '800': 'Baloo2_800ExtraBold',
  '900': 'Baloo2_800ExtraBold',
  bold: 'Baloo2_700Bold',
};

/** Los de DM Sans. 800 y 900 caen en Bold, que es el más grueso que cargamos. */
const DM_SANS: Record<string, string> = {
  '100': 'DMSans_400Regular',
  '200': 'DMSans_400Regular',
  '300': 'DMSans_400Regular',
  '400': 'DMSans_400Regular',
  normal: 'DMSans_400Regular',
  '500': 'DMSans_500Medium',
  '600': 'DMSans_600SemiBold',
  '700': 'DMSans_700Bold',
  '800': 'DMSans_700Bold',
  '900': 'DMSans_700Bold',
  bold: 'DMSans_700Bold',
};

export function resolverFuente(style: StyleProp<TextStyle>): TextStyle {
  const plano = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (plano.fontWeight == null) return plano;

  const familia = String(plano.fontFamily ?? '');
  const tabla = familia.startsWith('Baloo') ? BALOO : DM_SANS;
  const elegida = tabla[String(plano.fontWeight)];

  // Si el peso no está en la tabla se deja todo como estaba: es mejor que la
  // pantalla se vea un poco distinta que quedarse sin la fuente.
  if (!elegida) return plano;

  const { fontWeight: _descartado, ...resto } = plano;
  return { ...resto, fontFamily: elegida };
}
