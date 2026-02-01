'use client';

import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { formatSui } from '@/lib/sui-utils';
import { useEffect, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import Link from 'next/link';

const PACKAGE_ID = '0x5cbe88ff66b4772358bcda0e509b955d3c51d05f956343253f8d780a5361c661';
const LUCK_COIN_TYPE = `${PACKAGE_ID}::luck_token::LUCK_TOKEN`;

export function AppHeader() {
  const client = useSuiClient();
  const { isConnected: isWalletConnected, address: walletAddress, getBalance, getTokenBalance } = useSuiWallet();
  const { isAuthenticated: isZkLoginAuth, address: zkAddress, userInfo } = useZkLogin();

  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [luckBalance, setLuckBalance] = useState<string>('0');

  const isConnected = isWalletConnected || isZkLoginAuth;
  const address = walletAddress || zkAddress;

  useEffect(() => {
    async function fetchBalances() {
      if (!isConnected || !address) {
        setSuiBalance('0');
        setLuckBalance('0');
        return;
      }

      try {
        if (isWalletConnected) {
          const [sui, luck] = await Promise.all([
            getBalance(),
            getTokenBalance(LUCK_COIN_TYPE),
          ]);
          setSuiBalance(sui);
          setLuckBalance(luck);
        } else if (isZkLoginAuth && zkAddress) {
          const [suiBalanceRes, luckBalanceRes] = await Promise.all([
            client.getBalance({ owner: zkAddress }),
            client.getBalance({ owner: zkAddress, coinType: LUCK_COIN_TYPE }).catch(() => ({ totalBalance: '0' })),
          ]);
          setSuiBalance(suiBalanceRes.totalBalance);
          setLuckBalance(luckBalanceRes.totalBalance);
        }
      } catch (error) {
        console.error('Failed to fetch balances:', error);
      }
    }

    fetchBalances();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [isConnected, address, isWalletConnected, isZkLoginAuth, zkAddress, getBalance, getTokenBalance, client]);

  // Get avatar
  const avatar = userInfo?.picture || null;

  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-4 sticky top-0 bg-[#0F1419]/90 backdrop-blur-lg z-40">
      {/* Left: Avatar */}
      <Link href="/play/profile" className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#4DA2FF] to-purple-500 p-[2px]">
          <div className="w-full h-full rounded-full bg-[#1A1F26] flex items-center justify-center overflow-hidden">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
        </div>
      </Link>

      {/* Right: Balances */}
      <div className="flex items-center gap-2">
        {/* Energy (placeholder - can be dynamic later) */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1F26] border border-white/5 rounded-full">
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs font-bold text-white">5/5</span>
        </div>

        {/* LUCK Balance */}
        <Link
          href="/play/shop"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4DA2FF]/20 border border-[#4DA2FF]/30 rounded-full hover:bg-[#4DA2FF]/30 transition-colors"
        >
          <svg className="w-4 h-4 text-[#4DA2FF]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
          </svg>
          <span className="text-xs font-bold text-[#4DA2FF]">
            {formatSui(luckBalance)} LUCK
          </span>
        </Link>
      </div>
    </header>
  );
}
