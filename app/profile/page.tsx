'use client';

import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useProfile } from '@/hooks/useProfile';
import {
  shortenAddress,
  formatSui,
  getExplorerAddressUrl,
} from '@/lib/sui-utils';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSuiClient } from '@mysten/dapp-kit';

export default function ProfilePage() {
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

  // Combined connection state
  const isConnected = isWalletConnected || isZkLoginAuth;
  const address = walletAddress || zkAddress;
  const authMethod = isWalletConnected
    ? 'wallet'
    : isZkLoginAuth
      ? 'zklogin'
      : null;

  // Profile management
  const {
    profile,
    isLoading: isProfileLoading,
    isSaving,
    error: profileError,
    updateProfile,
    createOrSyncProfile,
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

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deployed contract info (devnet)
  const PACKAGE_ID =
    '0x5cbe88ff66b4772358bcda0e509b955d3c51d05f956343253f8d780a5361c661';
  const LUCK_COIN_TYPE = `${PACKAGE_ID}::luck_token::LUCK_TOKEN`;

  // Auto-register user to DB on connection (both wallet and zkLogin)
  useEffect(() => {
    if (isConnected && authMethod && !profile) {
      // For zkLogin, wait for userInfo to be available
      if (authMethod === 'zklogin' && !userInfo) return;
      createOrSyncProfile();
    }
  }, [isConnected, authMethod, userInfo, profile, createOrSyncProfile]);

  // Initialize edit form when profile loads
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
          client
            .getBalance({ owner: zkAddress, coinType: LUCK_COIN_TYPE })
            .catch(() => ({ totalBalance: '0' })),
        ]);
        setSuiBalance(suiBalanceRes.totalBalance);
        setLuckBalance(luckBalanceRes.totalBalance);
      }
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setIsBalanceLoading(false);
    }
  }, [
    isConnected,
    address,
    isWalletConnected,
    isZkLoginAuth,
    zkAddress,
    getBalance,
    getTokenBalance,
    client,
    LUCK_COIN_TYPE,
  ]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const handleDisconnect = () => {
    if (isWalletConnected) {
      disconnectWallet();
    } else if (isZkLoginAuth) {
      zkLogout();
    }
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

    // Only allow email update for wallet users
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

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditNickname(profile?.nickname || '');
    setEditEmail(profile?.email || '');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('wallet_address', address);

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload avatar');
      }

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: data.url });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Avatar upload error:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Get display name (nickname > google name > shortened address)
  const displayName =
    profile?.nickname ||
    profile?.google_name ||
    userInfo?.name ||
    (address ? shortenAddress(address) : 'User');

  // Not connected - redirect prompt
  if (!isConnected) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-md mx-auto text-center">
          <div className="card">
            <div className="text-6xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold mb-2">Connect Wallet</h1>
            <p className="text-gray-400 mb-6">
              Please connect your wallet to view your profile
            </p>
            <Link href="/" className="btn btn-primary">
              Go to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-gray-400 hover:text-white">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold">Profile</h1>
          <div className="w-16"></div>
        </div>

        {/* Profile Card */}
        <div className="card mb-6">
          {/* Avatar & Auth Method */}
          <div className="flex flex-col items-center mb-6">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
            />

            {/* Profile Picture (clickable for wallet users) */}
            <div className="relative group">
              {authMethod === 'zklogin' && userInfo?.picture ? (
                <img
                  src={userInfo.picture}
                  alt="Profile"
                  className="w-20 h-20 rounded-full mb-4"
                  referrerPolicy="no-referrer"
                />
              ) : profile?.avatar_url ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="relative"
                >
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="w-20 h-20 rounded-full mb-4 object-cover"
                  />
                  <div className="absolute inset-0 mb-4 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl mb-4 relative group"
                >
                  {isUploading ? (
                    <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : authMethod === 'zklogin' ? (
                    <svg
                      className="w-10 h-10 text-white"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  ) : (
                    '👤'
                  )}
                  {!isUploading && authMethod === 'wallet' && (
                    <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                </button>
              )}
            </div>

            {/* Upload hint for wallet users */}
            {authMethod === 'wallet' && !isUploading && (
              <p className="text-gray-500 text-xs mb-2">Click to upload avatar</p>
            )}

            {/* Upload error */}
            {uploadError && (
              <p className="text-red-400 text-xs mb-2">{uploadError}</p>
            )}

            {/* Display Name */}
            <h2 className="text-xl font-semibold mb-1">{displayName}</h2>

            {/* Email (for zkLogin users) */}
            {authMethod === 'zklogin' &&
              (userInfo?.email || profile?.google_email) && (
                <p className="text-gray-400 text-sm mb-3">
                  {userInfo?.email || profile?.google_email}
                </p>
              )}

            {/* Auth Method Badge */}
            <div
              className={`badge ${
                authMethod === 'zklogin'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
            >
              {authMethod === 'zklogin' ? 'Google Account' : 'Wallet Connected'}
            </div>
          </div>

          {/* Profile Edit Section */}
          <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-300">
                Profile Settings
              </h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                {/* Nickname Input */}
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">
                    Nickname
                  </label>
                  <input
                    type="text"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="Enter your nickname"
                    maxLength={30}
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    {editNickname.length}/30 characters
                  </p>
                </div>

                {/* Email Input (wallet users only) */}
                {authMethod === 'wallet' && (
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Enter your email (optional)"
                      className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Used for notifications and updates
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex-1 btn bg-white/10 hover:bg-white/20 text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex-1 btn btn-primary flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <svg
                          className="w-4 h-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>

                {/* Error Message */}
                {profileError && (
                  <p className="text-red-400 text-sm">{profileError}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Nickname</span>
                  <span className="text-white">
                    {profile?.nickname || (
                      <span className="text-gray-500 italic">Not set</span>
                    )}
                  </span>
                </div>
                {authMethod === 'wallet' && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Email</span>
                    <span className="text-white">
                      {profile?.email || (
                        <span className="text-gray-500 italic">Not set</span>
                      )}
                    </span>
                  </div>
                )}
                {authMethod === 'zklogin' && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Google Name</span>
                      <span className="text-white">
                        {profile?.google_name || userInfo?.name || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Email</span>
                      <span className="text-white">
                        {profile?.google_email || userInfo?.email || '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Success Message */}
            {saveSuccess && (
              <div className="mt-3 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Profile saved successfully!
              </div>
            )}
          </div>

          {/* Wallet Address */}
          <div className="mb-6">
            <label className="text-gray-400 text-sm mb-2 block">
              Wallet Address
            </label>
            <div className="flex items-center gap-2 p-4 bg-black/30 rounded-lg">
              <span className="font-mono text-sm flex-1 break-all">
                {address}
              </span>
              <button
                onClick={copyAddress}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <svg
                    className="w-5 h-5 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <a
              href={getExplorerAddressUrl(address!)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-flex items-center gap-1"
            >
              View on Explorer
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* Balances Card */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Balances</h2>
            <button
              onClick={fetchBalances}
              disabled={isBalanceLoading}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh balances"
            >
              <svg
                className={`w-5 h-5 text-gray-400 ${isBalanceLoading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>

          {/* SUI Balance */}
          <div className="p-4 bg-black/30 rounded-lg mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-blue-400 font-bold">S</span>
                </div>
                <div>
                  <div className="font-medium">SUI</div>
                  <div className="text-gray-500 text-sm">Native Token</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {isBalanceLoading ? '...' : formatSui(suiBalance)}
                </div>
                <div className="text-gray-500 text-sm">SUI</div>
              </div>
            </div>
          </div>

          {/* LUCK Balance */}
          <div className="p-4 bg-black/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <span className="text-yellow-400 font-bold">L</span>
                </div>
                <div>
                  <div className="font-medium">$LUCK</div>
                  <div className="text-gray-500 text-sm">Game Token</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-yellow-400">
                  {isBalanceLoading ? '...' : formatSui(luckBalance)}
                </div>
                <div className="text-gray-500 text-sm">LUCK</div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/shop" className="btn btn-primary text-center">
              Buy $LUCK
            </Link>
            <button
              onClick={() => {
                // TODO: Implement send functionality
                alert('Send feature coming soon!');
              }}
              className="btn btn-secondary"
            >
              Send
            </button>
          </div>
        </div>

        {/* Network Info */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Network</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Network</span>
              <span className="badge badge-warning">Devnet</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">$LUCK Contract</span>
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

        {/* Disconnect Button */}
        <button
          onClick={handleDisconnect}
          className="w-full btn bg-red-500/20 text-red-400 hover:bg-red-500/30"
        >
          Disconnect
        </button>
      </div>
    </main>
  );
}
