import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wanelle Tortas',
  description: 'Gestão de pedidos, agenda, estoque e financeiro da Wanelle Tortas.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
