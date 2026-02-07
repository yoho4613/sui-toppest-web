import type { Metadata } from 'next';
import { Orbitron, Plus_Jakarta_Sans } from 'next/font/google';
import { SuiWalletProvider } from '@/components/SuiWalletProvider';
import './globals.css';

// Next.js font optimization - prevents FOUC
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-orbitron',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Toppest - SUI Network',
  description: 'Toppest - Play to Earn on SUI Network',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${orbitron.variable}`} suppressHydrationWarning>
      <body className={plusJakarta.className}>
        <SuiWalletProvider>
          {children}
        </SuiWalletProvider>
      </body>
    </html>
  );
}
