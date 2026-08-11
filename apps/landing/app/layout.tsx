import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Kumo · Club de beneficios para mascotas',
  description: 'Cuidar a tu mascota, por fin simple y más barato. Descuentos, consultas online, carnet digital y reintegros.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
