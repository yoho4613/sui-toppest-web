'use client';

import { create } from 'zustand';

export type QuestCategory = 'daily' | 'weekly' | 'special';
export type RewardType = 'club' | 'star_ticket' | 'sui';

export interface QuestWithProgress {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: QuestCategory;
  condition_type: string;
  condition_value: number;
  condition_game_type: string | null;
  reward_type: RewardType;
  reward_amount: number;
  is_active: boolean;
  sort_order: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface QuestsData {
  daily: QuestWithProgress[];
  weekly: QuestWithProgress[];
  special: QuestWithProgress[];
  stats: {
    dailyCompleted: number;
    dailyTotal: number;
    weeklyCompleted: number;
    weeklyTotal: number;
    resetIn: {
      daily: string;
      weekly: string;
    };
  };
}

export interface ClaimResult {
  success: boolean;
  reward?: {
    type: string;
    amount: number;
  };
  error?: string;
}

interface QuestStore {
  // State
  quests: QuestsData | null;
  isLoading: boolean;
  isClaiming: boolean;
  error: string | null;
  lastFetchedAddress: string | null;

  // Computed
  claimableCount: number;

  // Last claimed reward (for popup)
  lastClaimedReward: { type: string; amount: number } | null;
  showClaimSuccess: boolean;

  // Actions
  fetchQuests: (walletAddress: string, options?: { sync?: boolean }) => Promise<void>;
  claimQuest: (walletAddress: string, questId: string) => Promise<ClaimResult>;
  refreshAfterGame: (walletAddress: string) => Promise<void>;
  clearClaimSuccess: () => void;
  reset: () => void;
}

// Calculate claimable quests count
function countClaimable(quests: QuestsData | null): number {
  if (!quests) return 0;

  const allQuests = [...quests.daily, ...quests.weekly, ...quests.special];
  return allQuests.filter(q => q.completed && !q.claimed).length;
}

export const useQuestStore = create<QuestStore>((set, get) => ({
  // Initial state
  quests: null,
  isLoading: false,
  isClaiming: false,
  error: null,
  lastFetchedAddress: null,
  claimableCount: 0,
  lastClaimedReward: null,
  showClaimSuccess: false,

  // Fetch quests from API
  // sync=true triggers full progress recalculation (use on page navigation / game end)
  fetchQuests: async (walletAddress: string, options?: { sync?: boolean }) => {
    if (!walletAddress) return;

    set({ isLoading: true, error: null });

    try {
      const syncParam = options?.sync ? '&sync=true' : '';
      const response = await fetch(
        `/api/quests?address=${walletAddress}${syncParam}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch quests');
      }

      const quests: QuestsData = await response.json();

      set({
        quests,
        claimableCount: countClaimable(quests),
        lastFetchedAddress: walletAddress,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch quests',
        isLoading: false,
      });
    }
  },

  // Claim a quest reward
  claimQuest: async (walletAddress: string, questId: string) => {
    if (!walletAddress) {
      return { success: false, error: 'No wallet address' };
    }

    set({ isClaiming: true, error: null });

    try {
      const response = await fetch('/api/quests/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          questId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        set({ isClaiming: false, error: data.error });
        return { success: false, error: data.error };
      }

      // Refresh quests after claiming
      await get().fetchQuests(walletAddress);

      // Show success popup
      set({
        isClaiming: false,
        lastClaimedReward: data.reward,
        showClaimSuccess: true,
      });

      return {
        success: true,
        reward: data.reward,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to claim reward';
      set({ isClaiming: false, error });
      return { success: false, error };
    }
  },

  // Refresh quests after game completion (triggers full sync)
  refreshAfterGame: async (walletAddress: string) => {
    if (!walletAddress) return;

    // Small delay to allow server to process quest updates
    await new Promise(resolve => setTimeout(resolve, 500));

    await get().fetchQuests(walletAddress, { sync: true });
  },

  // Clear claim success popup
  clearClaimSuccess: () => {
    set({ showClaimSuccess: false, lastClaimedReward: null });
  },

  // Reset store
  reset: () => {
    set({
      quests: null,
      isLoading: false,
      isClaiming: false,
      error: null,
      lastFetchedAddress: null,
      claimableCount: 0,
      lastClaimedReward: null,
      showClaimSuccess: false,
    });
  },
}));

// Selector hooks for performance
export const useClaimableCount = () => useQuestStore((state) => state.claimableCount);
export const useQuestsLoading = () => useQuestStore((state) => state.isLoading);
export const useShowClaimSuccess = () => useQuestStore((state) => state.showClaimSuccess);
export const useLastClaimedReward = () => useQuestStore((state) => state.lastClaimedReward);
