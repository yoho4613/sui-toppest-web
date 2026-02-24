import type { Metadata, Viewport } from 'next';
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3b82f6',
};

export const metadata: Metadata = {
  title: 'Toppest - SUI Network',
  description: 'Toppest - Play to Earn on SUI Network',
  applicationName: 'Toppest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Toppest',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png?v=3', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png?v=3', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png?v=3', sizes: '180x180' }],
  },
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
