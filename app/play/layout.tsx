'use client';

import { useEffect } from 'react';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useProfile } from '@/hooks/useProfile';
import { AppHeader, BottomNav } from '@/components/app';

export default function PlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isConnected: isWalletConnected, address: walletAddress } = useSuiWallet();
  const { isAuthenticated: isZkLoginAuth, address: zkAddress, userInfo } = useZkLogin();

  const isConnected = isWalletConnected || isZkLoginAuth;
  const address = walletAddress || zkAddress;
  const authMethod = isWalletConnected ? 'wallet' : isZkLoginAuth ? 'zklogin' : null;

  // Auto-register user to DB
  const { createOrSyncProfile, profile } = useProfile({
    walletAddress: address,
    authMethod,
    googleInfo: userInfo
      ? {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          sub: userInfo.sub,
        }
      : undefined,
  });

  // Auto-register on first connection
  useEffect(() => {
    if (isConnected && authMethod && !profile) {
      if (authMethod === 'zklogin' && !userInfo) return;
      createOrSyncProfile();
    }
  }, [isConnected, authMethod, userInfo, profile, createOrSyncProfile]);

  return (
    <div className="min-h-screen bg-[#0F1419] relative">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[40%] bg-[#4DA2FF]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[50%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      {/* App content */}
      <div className="relative z-10 max-w-[430px] mx-auto min-h-screen flex flex-col">
        {/* Only show header and nav when logged in */}
        {isConnected && <AppHeader />}
        <main className={`flex-1 overflow-y-auto ${isConnected ? 'pb-28' : ''}`}>
          {children}
        </main>
        {isConnected && <BottomNav />}
      </div>
    </div>
  );
}
