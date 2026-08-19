import { createElement } from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { colors } from '@kumo/shared';
import { resolverFuente } from '../../lib/tipografia';

/**
 * El texto de la app, en un solo lugar.
 *
 * Todo texto pasa por acá porque el grosor hay que resolverlo a mano: en Android,
 * pedirle un `fontWeight` a una fuente propia hace que en algunos teléfonos se
 * caiga a la del sistema (ver `lib/tipografia`). Es un bug que no se reproduce en
 * el equipo de quien lo escribe, así que la única defensa es que no haya forma de
 * escribir texto sin pasar por este componente.
 *
 * Estaba duplicado en `App.tsx` y en `Login.tsx`, con el mismo comentario copiado.
 * Con las pantallas del alta iban a ser tres copias, que es donde una se
 * desincroniza y nadie se entera.
 */

/** Títulos y números grandes. */
export const FH = 'Baloo2_800ExtraBold';
/** Cuerpo. */
export const FREG = 'DMSans_500Medium';

export const BRAND = colors.brand.primary;
export const LIME = colors.brand.lime;
export const INK = colors.text;
export const MUTED = colors.textMuted;

export const Texto = (props: TextProps) =>
  createElement(RNText, { ...props, style: resolverFuente([{ fontFamily: FREG, color: colors.text }, props.style]) });
