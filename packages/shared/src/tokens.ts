/**
 * Kumo · Design Tokens
 * Extraídos del prototipo original (reference/kumo-prototype.html).
 * Fuente de verdad de la identidad visual. Consumidos por Tailwind
 * (web) y por el theme de la app móvil (Expo).
 */

export const colors = {
  // Marca
  brand: {
    /** Púrpura principal Kumo */
    primary: '#5D5491',
    primaryDark: '#4A4560',
    primaryDeep: '#211E33',
    /** Verde lima del isotipo */
    lime: '#E1FB62',
  },
  // Púrpuras / neutros violáceos (superficies y bordes)
  violet: {
    50: '#F7F6FA',
    100: '#F0EDF9',
    150: '#EEECF5',
    200: '#E6E3F0',
    300: '#C9C3E3',
    400: '#A29DBA',
    500: '#8781A0',
    600: '#5B5670',
    700: '#4A4560',
  },
  // Estados
  success: { fg: '#2F8F5B', bg: '#E2F5EA' },
  danger: { fg: '#B0483F', bg: '#FBEEED' },
  warning: { fg: '#B8860B', bg: '#FBF3E2' },
  info: { fg: '#3B6FB0', bg: '#E6F0FB' },
  // Base
  /** Fondo de la app. Es el #F7F6FA del sistema de diseño (V1 2026): antes
   *  estaba en #FAF9F5, un crema más cálido que no era el gris violáceo del kit. */
  background: '#F7F6FA',
  surface: '#FFFFFF',
  text: '#211E33',
  textMuted: '#5B5670',
} as const;

export const fonts = {
  /** Títulos y marca */
  heading: "'Baloo 2', system-ui, sans-serif",
  /** Cuerpo de texto */
  body: "'DM Sans', system-ui, sans-serif",
} as const;

export const radii = {
  sm: '8px',
  md: '11px',
  lg: '16px',
  xl: '24px',
  pill: '100px',
} as const;

export const shadows = {
  sm: '0 1px 4px rgba(33,30,51,0.08)',
  md: '0 4px 16px rgba(33,30,51,0.10)',
  lg: '0 12px 40px rgba(33,30,51,0.14)',
} as const;

/** Objeto plano de colores para el theme de Tailwind (tailwind.config). */
export const tailwindColors = {
  brand: colors.brand.primary,
  'brand-dark': colors.brand.primaryDark,
  'brand-deep': colors.brand.primaryDeep,
  lime: colors.brand.lime,
  violet: colors.violet,
  success: colors.success.fg,
  danger: colors.danger.fg,
  warning: colors.warning.fg,
  bg: colors.background,
  surface: colors.surface,
  ink: colors.text,
  'ink-muted': colors.textMuted,
};
