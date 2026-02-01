'use client';

import { ConnectButton } from '@mysten/dapp-kit';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useProfile } from '@/hooks/useProfile';
import { shortenAddress, formatSui, getExplorerAddressUrl } from '@/lib/sui-utils';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSuiClient } from '@mysten/dapp-kit';

export default function Home() {
  const client = useSuiClient();
  const { isConnected: isWalletConnected, address: walletAddress, getBalance, getTokenBalance, disconnect: disconnectWallet } = useSuiWallet();
  const { isAuthenticated: isZkLoginAuth, address: zkAddress, login: zkLogin, logout: zkLogout, isLoading: zkLoading, userInfo } = useZkLogin();

  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [luckBalance, setLuckBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);

  // Combined connection state
  const isConnected = isWalletConnected || isZkLoginAuth;
  const address = walletAddress || zkAddress;
  const authMethod = isWalletConnected ? 'wallet' : isZkLoginAuth ? 'zklogin' : null;

  // Auto-register user to DB on connection
  const { profile, createOrSyncProfile } = useProfile({
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
      // For zkLogin, wait for userInfo
      if (authMethod === 'zklogin' && !userInfo) return;
      createOrSyncProfile();
    }
  }, [isConnected, authMethod, userInfo, profile, createOrSyncProfile]);

  // Deployed contract info (devnet)
  const PACKAGE_ID = '0x5cbe88ff66b4772358bcda0e509b955d3c51d05f956343253f8d780a5361c661';
  const LUCK_COIN_TYPE = `${PACKAGE_ID}::luck_token::LUCK_TOKEN`;

  useEffect(() => {
    async function fetchBalances() {
      if (!isConnected || !address) {
        setSuiBalance('0');
        setLuckBalance('0');
        return;
      }

      setIsLoading(true);
      try {
        if (isWalletConnected) {
          // Use wallet hooks for dapp-kit connected wallet
          const [sui, luck] = await Promise.all([
            getBalance(),
            getTokenBalance(LUCK_COIN_TYPE),
          ]);
          setSuiBalance(sui);
          setLuckBalance(luck);
        } else if (isZkLoginAuth && zkAddress) {
          // Use client directly for zkLogin
          const [suiBalanceRes, luckBalanceRes] = await Promise.all([
            client.getBalance({ owner: zkAddress }),
            client.getBalance({ owner: zkAddress, coinType: LUCK_COIN_TYPE }).catch(() => ({ totalBalance: '0' })),
          ]);
          setSuiBalance(suiBalanceRes.totalBalance);
          setLuckBalance(luckBalanceRes.totalBalance);
        }
      } catch (error) {
        console.error('Failed to fetch balances:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBalances();
  }, [isConnected, address, isWalletConnected, isZkLoginAuth, zkAddress, getBalance, getTokenBalance, client, LUCK_COIN_TYPE]);

  const handleDisconnect = () => {
    if (isWalletConnected) {
      disconnectWallet();
    } else if (isZkLoginAuth) {
      zkLogout();
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-title mb-2 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">Toppest</h1>
          <p className="text-gray-400">SUI Network - Play to Earn</p>
        </div>

        {/* Wallet Connection Card */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Wallet</h2>
            <div className={`badge ${isConnected ? 'badge-success' : 'badge-warning'}`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              {isConnected ? (authMethod === 'zklogin' ? 'Google' : 'Connected') : 'Not Connected'}
            </div>
          </div>

          {/* Wallet Info (when connected) */}
          {isConnected && address && (
            <div className="space-y-4">
              {/* Auth Method Badge */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {authMethod === 'zklogin' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Signed in with Google
                  </span>
                )}
              </div>

              {/* Address */}
              <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                <span className="text-gray-400">Address</span>
                <a
                  href={getExplorerAddressUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 font-mono"
                >
                  {shortenAddress(address)}
                </a>
              </div>

              {/* SUI Balance */}
              <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                <span className="text-gray-400">SUI Balance</span>
                <span className="font-semibold">
                  {isLoading ? '...' : `${formatSui(suiBalance)} SUI`}
                </span>
              </div>

              {/* LUCK Balance */}
              <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                <span className="text-gray-400">$LUCK Balance</span>
                <span className="font-semibold text-yellow-400">
                  {isLoading ? '...' : `${formatSui(luckBalance)} LUCK`}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <Link href="/profile" className="btn btn-secondary text-center">
                  Profile
                </Link>
                <Link href="/shop" className="btn btn-primary text-center">
                  Shop
                </Link>
                <button
                  onClick={handleDisconnect}
                  className="btn btn-secondary"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          {/* Connect Options (when not connected) */}
          {!isConnected && (
            <div className="space-y-6">
              {/* Wallet Connect */}
              <div className="flex justify-center">
                <ConnectButton />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gray-700"></div>
                <span className="text-gray-500 text-sm">or</span>
                <div className="flex-1 h-px bg-gray-700"></div>
              </div>

              {/* Google Sign In (zkLogin) */}
              <button
                onClick={zkLogin}
                disabled={zkLoading}
                className="w-full flex items-center justify-center gap-3 p-4 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {zkLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continue with Google
              </button>

              <p className="text-center text-gray-500 text-sm">
                No wallet? Sign in with Google to create one instantly
              </p>
            </div>
          )}
        </div>

        {/* Network Info */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Network Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Network</span>
              <span className="badge badge-warning">Devnet</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Package ID</span>
              <a
                href={`https://suiscan.xyz/devnet/object/${PACKAGE_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-mono text-xs"
              >
                {shortenAddress(PACKAGE_ID)}
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Toppest - SUI Network</p>
        </div>
      </div>
    </main>
  );
}
