'use client';

import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useProfile } from '@/hooks/useProfile';
import { shortenAddress, formatSui, getExplorerAddressUrl } from '@/lib/sui-utils';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';

const PACKAGE_ID = '0x5cbe88ff66b4772358bcda0e509b955d3c51d05f956343253f8d780a5361c661';
const LUCK_COIN_TYPE = `${PACKAGE_ID}::luck_token::LUCK_TOKEN`;

export default function ProfilePage() {
  const router = useRouter();
  const client = useSuiClient();
  const {
    isConnected: isWalletConnected,
    address: walletAddress,
    getBalance,
    getTokenBalance,
    disconnect: disconnectWallet,
  } = useSuiWallet();
  const {
    isAuthenticated: isZkLoginAuth,
    address: zkAddress,
    logout: zkLogout,
    userInfo,
  } = useZkLogin();

  const isConnected = isWalletConnected || isZkLoginAuth;
  const address = walletAddress || zkAddress;
  const authMethod = isWalletConnected ? 'wallet' : isZkLoginAuth ? 'zklogin' : null;

  const {
    profile,
    isSaving,
    error: profileError,
    updateProfile,
  } = useProfile({
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

  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [luckBalance, setLuckBalance] = useState<string>('0');
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setEditNickname(profile.nickname || '');
      setEditEmail(profile.email || '');
    }
  }, [profile]);

  const fetchBalances = useCallback(async () => {
    if (!isConnected || !address) {
      setSuiBalance('0');
      setLuckBalance('0');
      return;
    }

    setIsBalanceLoading(true);
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
    } finally {
      setIsBalanceLoading(false);
    }
  }, [isConnected, address, isWalletConnected, isZkLoginAuth, zkAddress, getBalance, getTokenBalance, client]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const handleDisconnect = () => {
    if (isWalletConnected) {
      disconnectWallet();
    } else if (isZkLoginAuth) {
      zkLogout();
    }
    router.push('/');
  };

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSaveProfile = async () => {
    const updateData: { nickname?: string; email?: string } = {};

    if (editNickname.trim()) {
      updateData.nickname = editNickname.trim();
    }

    if (authMethod === 'wallet' && editEmail.trim()) {
      updateData.email = editEmail.trim();
    }

    const success = await updateProfile(updateData);

    if (success) {
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const displayName =
    profile?.nickname ||
    profile?.google_name ||
    userInfo?.name ||
    (address ? shortenAddress(address) : 'User');

  const avatar = userInfo?.picture || profile?.avatar_url || null;

  return (
    <div className="px-5 flex flex-col gap-5">
      {/* Profile Header */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#4DA2FF] to-purple-500 p-[2px] mb-4">
            <div className="w-full h-full rounded-full bg-[#1A1F26] flex items-center justify-center overflow-hidden">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
          </div>

          {/* Name */}
          <h2 className="text-xl font-bold text-white mb-1">{displayName}</h2>

          {/* Email for zkLogin */}
          {authMethod === 'zklogin' && (userInfo?.email || profile?.google_email) && (
            <p className="text-gray-400 text-sm mb-3">
              {userInfo?.email || profile?.google_email}
            </p>
          )}

          {/* Auth Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${authMethod === 'zklogin'
              ? 'bg-[#4DA2FF]/20 text-[#4DA2FF]'
              : 'bg-green-500/20 text-green-400'
            }`}>
            {authMethod === 'zklogin' ? '✓ Google Connected' : '✓ Wallet Connected'}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="text-center">
            <p className="text-xl font-bold text-white">0</p>
            <p className="text-gray-400 text-xs">Games</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">0</p>
            <p className="text-gray-400 text-xs">Wins</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#4DA2FF]">#--</p>
            <p className="text-gray-400 text-xs">Rank</p>
          </div>
        </div>
      </div>

      {/* Balances */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Balances</h3>
          <button
            onClick={fetchBalances}
            disabled={isBalanceLoading}
            className="text-gray-400 hover:text-white"
          >
            <svg className={`w-5 h-5 ${isBalanceLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {/* SUI */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#4DA2FF]/20 flex items-center justify-center">
                <span className="text-[#4DA2FF] font-bold">S</span>
              </div>
              <div>
                <p className="font-semibold text-white">SUI</p>
                <p className="text-gray-500 text-xs">Native Token</p>
              </div>
            </div>
            <p className="font-bold text-white">
              {isBalanceLoading ? '...' : formatSui(suiBalance)}
            </p>
          </div>

          {/* LUCK */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <span className="text-yellow-400 font-bold">L</span>
              </div>
              <div>
                <p className="font-semibold text-white">LUCK</p>
                <p className="text-gray-500 text-xs">Game Token</p>
              </div>
            </div>
            <p className="font-bold text-yellow-400">
              {isBalanceLoading ? '...' : formatSui(luckBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Profile Settings */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Profile Settings</h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-[#4DA2FF] text-sm font-semibold"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Nickname</label>
              <input
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="Enter nickname"
                maxLength={30}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#4DA2FF]"
              />
            </div>

            {authMethod === 'wallet' && (
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Enter email"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#4DA2FF]"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex-1 py-3 bg-[#4DA2FF] text-[#0F1419] font-semibold rounded-xl"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>

            {profileError && (
              <p className="text-red-400 text-sm">{profileError}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Nickname</span>
              <span className="text-white">{profile?.nickname || <span className="text-gray-500">Not set</span>}</span>
            </div>
            {authMethod === 'wallet' && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">Email</span>
                <span className="text-white">{profile?.email || <span className="text-gray-500">Not set</span>}</span>
              </div>
            )}
          </div>
        )}

        {saveSuccess && (
          <div className="mt-3 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-sm">
            ✓ Profile saved!
          </div>
        )}
      </div>

      {/* Wallet Address */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <h3 className="font-semibold text-white mb-3">Wallet Address</h3>
        <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
          <span className="font-mono text-sm text-gray-300 flex-1 truncate">
            {address}
          </span>
          <button
            onClick={copyAddress}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            {copied ? (
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
        <a
          href={getExplorerAddressUrl(address!)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#4DA2FF] text-sm mt-2 inline-flex items-center gap-1"
        >
          View on Explorer →
        </a>
      </div>

      {/* Network & Disconnect */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-400">Network</span>
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded-full">
            Devnet
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="w-full py-3 bg-red-500/20 text-red-400 font-semibold rounded-xl hover:bg-red-500/30"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
