'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  useQuestStore,
  useShowClaimSuccess,
  useLastClaimedReward,
  QuestWithProgress,
} from '@/hooks/useQuestStore';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';

type QuestCategory = 'daily' | 'weekly' | 'special';

// Claim Success Popup Component
function ClaimSuccessPopup() {
  const showClaimSuccess = useShowClaimSuccess();
  const lastClaimedReward = useLastClaimedReward();
  const clearClaimSuccess = useQuestStore((state) => state.clearClaimSuccess);

  useEffect(() => {
    if (showClaimSuccess) {
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        clearClaimSuccess();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showClaimSuccess, clearClaimSuccess]);

  if (!showClaimSuccess || !lastClaimedReward) return null;

  const getRewardIcon = (type: string) => {
    if (type === 'club') return '💰';
    if (type === 'sui') return '💎';
    return '⭐';
  };

  const getRewardLabel = (type: string, amount: number) => {
    if (type === 'club') return `${amount} $CLUB`;
    if (type === 'sui') return `${amount} SUI`;
    return `${amount} Star Ticket${amount > 1 ? 's' : ''}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        onClick={clearClaimSuccess}
      />

      {/* Popup */}
      <div className="relative bg-gradient-to-b from-[#1A1F26] to-[#0F1419] border border-green-500/30 rounded-3xl p-8 shadow-2xl animate-bounce-in pointer-events-auto">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-green-500/10 rounded-3xl blur-xl" />

        <div className="relative text-center">
          {/* Success icon */}
          <div className="w-20 h-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center animate-pulse">
            <span className="text-5xl">🎉</span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2">
            Quest Complete!
          </h2>

          {/* Reward */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full">
            <span className="text-2xl">{getRewardIcon(lastClaimedReward.type)}</span>
            <span className="text-green-400 font-bold text-lg">
              +{getRewardLabel(lastClaimedReward.type, lastClaimedReward.amount)}
            </span>
          </div>

          {/* Close hint */}
          <p className="text-gray-500 text-sm mt-4">Tap anywhere to close</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function QuestsPage() {
  const [activeCategory, setActiveCategory] = useState<QuestCategory>('daily');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const quests = useQuestStore((state) => state.quests);
  const isLoading = useQuestStore((state) => state.isLoading);
  const isClaiming = useQuestStore((state) => state.isClaiming);
  const fetchQuests = useQuestStore((state) => state.fetchQuests);
  const claimQuest = useQuestStore((state) => state.claimQuest);

  const { address: walletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const address = walletAddress || zkAddress;

  // Load quests on mount
  useEffect(() => {
    if (address) {
      fetchQuests(address);
    }
  }, [address, fetchQuests]);

  // Handle claim reward
  const handleClaim = async (questId: string) => {
    if (!address || isClaiming) return;

    setClaimingId(questId);
    await claimQuest(address, questId);
    setClaimingId(null);
  };

  const getQuestsForCategory = (category: QuestCategory): QuestWithProgress[] => {
    if (!quests) return [];
    return quests[category] || [];
  };

  const filteredQuests = getQuestsForCategory(activeCategory);

  // Calculate claimable count for each category
  const getClaimableCount = (category: QuestCategory): number => {
    const categoryQuests = getQuestsForCategory(category);
    return categoryQuests.filter(q => q.completed && !q.claimed).length;
  };

  const dailyClaimable = getClaimableCount('daily');
  const weeklyClaimable = getClaimableCount('weekly');
  const specialClaimable = getClaimableCount('special');

  const dailyCompleted = quests?.stats.dailyCompleted || 0;
  const dailyTotal = quests?.stats.dailyTotal || 0;
  const dailyResetIn = quests?.stats.resetIn.daily || '--';
  const weeklyResetIn = quests?.stats.resetIn.weekly || '--';

  const getRewardIcon = (type: 'club' | 'star_ticket' | 'sui') => {
    if (type === 'club') return '💰';
    if (type === 'sui') return '💎';
    return '⭐';
  };

  const getRewardLabel = (type: 'club' | 'star_ticket' | 'sui', amount: number) => {
    if (type === 'club') return `${amount} $CLUB`;
    if (type === 'sui') return `${amount} SUI`;
    return `${amount} Star Ticket${amount > 1 ? 's' : ''}`;
  };

  // Not connected state
  if (!address) {
    return (
      <div className="px-5 flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Quests</h1>
          <p className="text-gray-400 text-sm">Complete quests to earn rewards!</p>
        </div>
        <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-gray-400 mb-2">Connect your wallet to view quests</p>
          <p className="text-gray-500 text-sm">Your progress will be synced automatically</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Claim Success Popup */}
      <ClaimSuccessPopup />

      <div className="px-5 flex flex-col gap-5">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Quests</h1>
          <p className="text-gray-400 text-sm">Complete quests to earn rewards!</p>
        </div>

        {/* Daily Progress Banner */}
        <div className="bg-gradient-to-r from-[#4DA2FF]/20 to-purple-500/20 border border-[#4DA2FF]/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Daily Progress</p>
              <p className="text-white font-bold mt-1">{dailyCompleted}/{dailyTotal} Completed</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs">Resets in</p>
              <p className="text-[#4DA2FF] font-bold">{dailyResetIn}</p>
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4DA2FF] to-purple-500 rounded-full transition-all"
              style={{ width: dailyTotal > 0 ? `${(dailyCompleted / dailyTotal) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex bg-[#1A1F26] rounded-full p-1 border border-white/10">
          {(['daily', 'weekly', 'special'] as QuestCategory[]).map((category) => {
            const claimableCount = category === 'daily' ? dailyClaimable
              : category === 'weekly' ? weeklyClaimable
              : specialClaimable;

            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`relative flex-1 py-2 text-sm font-semibold rounded-full transition-all ${
                  activeCategory === category
                    ? 'bg-[#4DA2FF] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
                {/* Claimable Badge */}
                {claimableCount > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center px-1 ${
                    activeCategory === category
                      ? 'bg-white text-[#4DA2FF]'
                      : 'bg-green-500 text-white animate-pulse'
                  }`}>
                    {claimableCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Reset Timer for Weekly */}
        {activeCategory === 'weekly' && (
          <div className="text-center text-gray-400 text-sm">
            Weekly quests reset in <span className="text-[#4DA2FF] font-semibold">{weeklyResetIn}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !quests && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#4DA2FF] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Quest List */}
        {!isLoading || quests ? (
          <div className="space-y-3">
            {filteredQuests.length === 0 ? (
              <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-gray-400">No quests available</p>
              </div>
            ) : (
              filteredQuests.map((quest) => (
                <div
                  key={quest.id}
                  className={`bg-[#1A1F26] border rounded-2xl p-4 transition-all ${
                    quest.claimed
                      ? 'border-white/5 opacity-60'
                      : quest.completed
                      ? 'border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl shrink-0">
                      {quest.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={`font-semibold ${quest.claimed ? 'text-gray-500' : 'text-white'}`}>
                            {quest.title}
                          </h3>
                          <p className="text-gray-400 text-sm mt-0.5">{quest.description}</p>
                        </div>

                        {/* Reward Badge */}
                        <div className={`px-2 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                          quest.reward_type === 'sui'
                            ? 'bg-[#4DA2FF]/20 text-[#4DA2FF]'
                            : quest.reward_type === 'club'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {getRewardIcon(quest.reward_type)} {getRewardLabel(quest.reward_type, quest.reward_amount)}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-500 text-xs">
                            {quest.progress}/{quest.condition_value}
                          </span>
                          {quest.completed && !quest.claimed && (
                            <span className="text-green-400 text-xs font-semibold animate-pulse">Ready to claim!</span>
                          )}
                          {quest.claimed && (
                            <span className="text-gray-500 text-xs">Claimed</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              quest.completed
                                ? 'bg-green-500'
                                : 'bg-gradient-to-r from-[#4DA2FF] to-purple-500'
                            }`}
                            style={{ width: `${Math.min((quest.progress / quest.condition_value) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Claim Button */}
                      {quest.completed && !quest.claimed && (
                        <button
                          onClick={() => handleClaim(quest.id)}
                          disabled={claimingId === quest.id}
                          className="mt-3 w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
                        >
                          {claimingId === quest.id ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Claiming...
                            </span>
                          ) : (
                            'Claim Reward'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {/* Invite Friends CTA */}
        <Link href="/play/invite" className="block">
          <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4 hover:border-[#4DA2FF]/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#4DA2FF]/20 flex items-center justify-center text-2xl">
                🎁
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">Invite Friends</h3>
                <p className="text-gray-400 text-sm">Earn $CLUB for each friend!</p>
              </div>
              <div className="px-4 py-2 bg-[#4DA2FF] text-white font-semibold rounded-xl text-sm">
                Invite
              </div>
            </div>
          </div>
        </Link>
      </div>
    </>
  );
}
