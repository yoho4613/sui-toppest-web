'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import {
  generateReferralLink,
  generateShareText,
  formatAddress,
  formatJoinDate,
} from '@/lib/referral';
import { REFERRAL_REWARDS, REFERRAL_REVENUE_SHARE } from '@/lib/constants';

interface ReferralItem {
  id: string;
  walletAddress: string;
  nickname?: string;
  avatarUrl?: string;
  clubReward: number;
  ticketReward: number;
  revenueShare: number;
  joinedAt: string;
}

interface ReferralStats {
  totalCount: number;
  totalSignupRewards: number;
  totalRevenueShare: number;
}

export default function InvitePage() {
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [stats, setStats] = useState<ReferralStats>({
    totalCount: 0,
    totalSignupRewards: 0,
    totalRevenueShare: 0,
  });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const { address: walletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const address = walletAddress || zkAddress;

  // Generate referral link using referral_code (preferred) or wallet address (fallback)
  const referralLink = referralCode
    ? generateReferralLink(referralCode)
    : address
    ? generateReferralLink(address)
    : '';

  // Fetch referrals
  useEffect(() => {
    if (!address) return;

    const fetchReferrals = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/referral?wallet=${address}&page=0&limit=50`);
        const data = await response.json();

        if (response.ok) {
          setReferrals(data.referrals || []);
          setStats(data.stats || { totalCount: 0, totalSignupRewards: 0, totalRevenueShare: 0 });
          setReferralCode(data.referralCode || null);
          setHasMore(data.pagination?.hasMore || false);
        }
      } catch (error) {
        console.error('Failed to fetch referrals:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferrals();
  }, [address]);

  // Load more referrals
  const loadMore = async () => {
    if (!address || !hasMore) return;

    try {
      const nextPage = page + 1;
      const response = await fetch(`/api/referral?wallet=${address}&page=${nextPage}&limit=50`);
      const data = await response.json();

      if (response.ok) {
        setReferrals([...referrals, ...(data.referrals || [])]);
        setPage(nextPage);
        setHasMore(data.pagination?.hasMore || false);
      }
    } catch (error) {
      console.error('Failed to load more referrals:', error);
    }
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // Share link (native share or copy)
  const handleShare = async () => {
    const shareText = generateShareText();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Toppest!',
          text: shareText,
          url: referralLink,
        });
      } catch (error) {
        // User cancelled or error
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  // Not connected state
  if (!address) {
    return (
      <div className="px-5 flex flex-col gap-5 pb-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Invite Friends</h1>
          <p className="text-gray-400 text-sm">Earn rewards for every friend you invite!</p>
        </div>
        <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-gray-400 mb-2">Connect your wallet to get your invite link</p>
          <p className="text-gray-500 text-sm">Your referrals will be tracked automatically</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 flex flex-col gap-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/play/quests"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Invite Friends</h1>
          <p className="text-gray-400 text-sm">Earn $CLUB for every friend!</p>
        </div>
      </div>

      {/* Rewards Info Card */}
      <div className="bg-gradient-to-br from-[#4DA2FF]/20 to-purple-500/20 border border-[#4DA2FF]/30 rounded-2xl p-5">
        <h3 className="text-lg font-bold text-white mb-4 text-center">Referral Rewards</h3>

        {/* Your Earnings */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
          <p className="text-green-400 text-sm font-semibold text-center mb-3">You Earn</p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-[#1A1F26]/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-400">{REFERRAL_REVENUE_SHARE.earningSharePercent}%</p>
              <p className="text-gray-400 text-xs">of friend's earnings</p>
            </div>
            <div className="bg-[#1A1F26]/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-yellow-400">{REFERRAL_REVENUE_SHARE.purchaseMultiplier}×</p>
              <p className="text-gray-400 text-xs">of friend's purchase (CLUB)</p>
            </div>
          </div>
        </div>

        {/* Friend Gets */}
        <div className="bg-[#1A1F26]/50 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm mb-2">Your Friend Gets</p>
          <div className="flex items-center justify-center gap-4">
            <div>
              <p className="text-xl font-bold text-green-400">{REFERRAL_REWARDS.invitee.club}</p>
              <p className="text-gray-400 text-xs">$CLUB</p>
            </div>
            <span className="text-gray-600">+</span>
            <div>
              <p className="text-xl font-bold text-purple-400">{REFERRAL_REWARDS.invitee.bonusTickets}</p>
              <p className="text-gray-400 text-xs">Tickets</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1A1F26] border border-white/10 rounded-xl p-4 text-center">
          <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-gray-400 text-xs mb-1">Referrals</p>
          <p className="text-xl font-bold text-white">{stats.totalCount}</p>
        </div>

        <div className="bg-[#1A1F26] border border-white/10 rounded-xl p-4 text-center">
          <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-sm">🎁</span>
          </div>
          <p className="text-gray-400 text-xs mb-1">Sign-up</p>
          <p className="text-xl font-bold text-yellow-400">{stats.totalSignupRewards}</p>
          <p className="text-gray-500 text-xs">$CLUB</p>
        </div>

        <div className="bg-[#1A1F26] border border-white/10 rounded-xl p-4 text-center">
          <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-gray-400 text-xs mb-1">Rev Share</p>
          <p className="text-xl font-bold text-green-400">{stats.totalRevenueShare}</p>
          <p className="text-gray-500 text-xs">$CLUB</p>
        </div>
      </div>

      {/* Invite Link Section */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Your Invite Code</h3>
          {referralCode && (
            <span className="bg-gradient-to-r from-[#4DA2FF] to-purple-500 text-white text-lg font-bold px-4 py-1 rounded-full">
              {referralCode}
            </span>
          )}
        </div>

        <div className="bg-[#0F1419] rounded-xl p-4 mb-4 break-all text-[#4DA2FF] text-sm font-mono">
          {referralLink}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopyLink}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {copied ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>

          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-[#4DA2FF] to-purple-500 text-white hover:opacity-90 transition-opacity"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {/* Referral List */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Your Referrals ({stats.totalCount})
          </h3>
          {stats.totalCount > 0 && referrals.length < stats.totalCount && (
            <span className="text-xs text-gray-400">
              {referrals.length} / {stats.totalCount}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-[#4DA2FF] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Loading...</p>
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-gray-400">No referrals yet</p>
            <p className="text-gray-500 text-sm mt-1">Share your link to start earning!</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="bg-[#0F1419] rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4DA2FF] to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {referral.nickname?.charAt(0).toUpperCase() || referral.walletAddress.charAt(2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">
                        {referral.nickname || formatAddress(referral.walletAddress)}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {formatJoinDate(referral.joinedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-lg font-bold ${referral.revenueShare > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                      {referral.revenueShare > 0 ? `+${referral.revenueShare.toLocaleString()}` : '0'}
                    </p>
                    <p className="text-gray-500 text-xs">Earned $CLUB</p>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium transition-colors"
              >
                Load More ({stats.totalCount - referrals.length} remaining)
              </button>
            )}
          </>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5">
        <h4 className="text-purple-300 font-bold mb-3">How It Works</h4>
        <ul className="text-gray-400 text-sm space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-purple-400">1.</span>
            Share your invite link with friends
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">2.</span>
            When they join, they get {REFERRAL_REWARDS.invitee.club} $CLUB + {REFERRAL_REWARDS.invitee.bonusTickets} tickets
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">3.</span>
            You earn {REFERRAL_REVENUE_SHARE.earningSharePercent}% of their $CLUB earnings
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">4.</span>
            When they purchase, you get {REFERRAL_REVENUE_SHARE.purchaseMultiplier}× the USD amount in $CLUB
          </li>
        </ul>
      </div>
    </div>
  );
}
