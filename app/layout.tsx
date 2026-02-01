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
      <head>
        <title>Toppest - SUI Network</title>
        <meta name="description" content="Toppest - Play to Earn on SUI Network" />
      </head>
      <body>
        <SuiWalletProvider>
          {children}
        </SuiWalletProvider>
      </body>
    </html>
  );
}
