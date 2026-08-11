import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kumo · Mi cuenta',
  description: 'Tu carnet, reintegros y beneficios.',
};

export default function WebappLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
