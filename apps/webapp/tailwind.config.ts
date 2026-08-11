import type { Config } from 'tailwindcss';
import { tailwindColors, radii } from '@kumo/shared/tokens';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: tailwindColors,
      borderRadius: { pill: radii.pill },
      fontFamily: {
        heading: ['Baloo 2', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
