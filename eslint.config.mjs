import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Un solo ESLint para todo el monorepo.
 *
 * Antes `pnpm lint` no corría: `packages/shared` llamaba a un `eslint` que no
 * estaba instalado, y `apps/web` usaba `next lint`, que además de estar deprecado
 * abre un asistente interactivo y se cuelga en cualquier corrida automática.
 *
 * La configuración es a propósito CHICA. Las reglas de tipos (`recommended-type-
 * checked`) obligan a un `tsc` por archivo y ya tenemos `pnpm typecheck` haciendo
 * eso mejor: acá interesa lo que el compilador no ve —variables sin usar, `case`
 * que se cae al siguiente, promesas sueltas en un `useEffect`— y nada de estilo,
 * que es discusión sin final y ruido en los diffs.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.expo/**',
      'reference/**',
      // El prototipo y los assets generados no son código nuestro.
      '**/*.config.js',
      '**/*.config.mjs',
      // Lo escribe Next en cada build.
      'apps/web/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        // Lo que existe en los tres entornos que conviven: navegador, Node y
        // React Native. Sin esto, `fetch` o `console` se reportan como no
        // definidos según el archivo.
        console: 'readonly', fetch: 'readonly', process: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
        alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        File: 'readonly', Blob: 'readonly', FormData: 'readonly', Response: 'readonly', Request: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
        Uint8Array: 'readonly', atob: 'readonly', btoa: 'readonly',
        HTMLInputElement: 'readonly', HTMLElement: 'readonly', React: 'readonly',
        // Node, para los scripts del repo.
        Buffer: 'readonly', __dirname: 'readonly', require: 'readonly', module: 'readonly',
      },
    },
    rules: {
      // Un `_` adelante marca "sé que no lo uso": pasa seguido con los args de
      // los callbacks y con el error de un catch.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // `any` aparece donde Supabase devuelve filas sin tipar. Avisa, no frena.
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // React Native carga las imágenes con `require()`: es el idioma del bundler
    // de Metro, no una costumbre vieja, y `import` de un .png no funciona igual.
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
