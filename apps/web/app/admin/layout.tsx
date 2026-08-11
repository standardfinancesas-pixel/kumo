import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kumo · Panel del club',
  description: 'Panel de administración de Kumo.',
};

/**
 * El panel usa un gris apenas distinto al del resto del sitio (#f7f6fa contra
 * #f5f4f8). Antes venía del `body` de su propio globals.css; ahora que las tres
 * secciones comparten uno, se aplica acá y queda contenido al segmento.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div style={{ background: '#f7f6fa', minHeight: '100vh' }}>{children}</div>;
}
