'use client';

import { useEffect, Suspense } from 'react';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useAppStore } from '@/stores/useAppStore';
import { AppHeader, BottomNav, PaymentPopup, ReferralHandler } from '@/components/app';

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

  // Global app store
  const { init, isInitialized, reset, profile } = useAppStore();

  // Initialize app data when connected
  useEffect(() => {
    if (isConnected && address && !isInitialized) {
      // For zkLogin, wait until userInfo is available before init
      if (authMethod === 'zklogin' && !userInfo) return;
      init(address);
    }
  }, [isConnected, address, authMethod, userInfo, isInitialized, init]);

  // Auto-register profile if not exists (after init completes)
  useEffect(() => {
    async function ensureProfile() {
      if (!isInitialized || !isConnected || !address || !authMethod) return;
      if (profile) return; // Already has profile

      // For zkLogin, wait for userInfo
      if (authMethod === 'zklogin' && !userInfo) return;

      try {
        const body: Record<string, unknown> = {
          wallet_address: address,
          auth_method: authMethod,
        };

        if (authMethod === 'zklogin' && userInfo) {
          body.google_email = userInfo.email;
          body.google_name = userInfo.name;
          body.google_picture = userInfo.picture;
          body.google_sub = userInfo.sub;
        }

        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (error) {
        console.error('Failed to create profile:', error);
      }
    }

    ensureProfile();
  }, [isInitialized, isConnected, address, authMethod, userInfo, profile]);

  // Reset store on disconnect
  useEffect(() => {
    if (!isConnected) {
      reset();
    }
  }, [isConnected, reset]);

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

      {/* Global Payment Popup */}
      <PaymentPopup />

      {/* Referral Handler - detects ?ref= param and processes referrals */}
      <Suspense fallback={null}>
        <ReferralHandler />
      </Suspense>
    </div>
  );
}
