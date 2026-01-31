'use client';

import { SuiWalletProvider } from '@/components/SuiWalletProvider';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SuiWalletProvider>
          {children}
        </SuiWalletProvider>
      </body>
    </html>
  );
}
