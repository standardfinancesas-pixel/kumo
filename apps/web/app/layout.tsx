import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { SITIO } from '@kumo/shared';
// Fuentes self-hosted (Baloo 2 + DM Sans) vía @fontsource — sin depender de Google Fonts en runtime.
import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import './globals.css';

/*
 * Cómo se presenta Kumo afuera: en Google, en la pestaña del navegador y cuando
 * alguien comparte el link.
 *
 * `metadataBase` es lo que convierte las rutas relativas en absolutas. Sin eso, la
 * imagen para compartir queda con una URL relativa y ni WhatsApp ni Facebook la
 * resuelven: el link aparece pelado, que es como estaba.
 *
 * La imagen sale de `opengraph-image.jpg`, que Next engancha solo por el nombre del
 * archivo. No se edita a mano: la dibuja `scripts/armar-og.mjs`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: 'Kumo · App de mascotas con beneficios',
  description: 'Descuentos en veterinarias y pet shops, consultas online, carnet digital de salud y reintegros de tus gastos. Todo en un solo lugar.',
  applicationName: 'Kumo',
  // El canónico manda a www: el apex redirige, y sin esto Google puede indexar las
  // dos versiones y repartir el posicionamiento entre ellas.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Kumo',
    locale: 'es_AR',
    url: '/',
    title: 'Kumo · App de mascotas con beneficios',
    description: 'Descuentos en veterinarias y pet shops, carnet digital de salud y reintegros de tus gastos.',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
