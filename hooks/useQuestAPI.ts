/**
 * Hook for quest-related API calls
 */

import { useState, useCallback } from 'react';

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

export function useQuestAPI() {
  const [isLoadingQuests, setIsLoadingQuests] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all quests with user progress
  const fetchQuests = useCallback(async (
    walletAddress: string
  ): Promise<QuestsData | null> => {
    try {
      setIsLoadingQuests(true);
      setError(null);

      const response = await fetch(
        `/api/quests?address=${walletAddress}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to fetch quests');
        return null;
      }

      return await response.json();
    } catch (err) {
      console.error('Fetch quests error:', err);
      setError('Network error');
      return null;
    } finally {
      setIsLoadingQuests(false);
    }
  }, []);

  // Claim a quest reward
  const claimReward = useCallback(async (
    walletAddress: string,
    questId: string
  ): Promise<ClaimResult> => {
    try {
      setIsClaiming(true);
      setError(null);

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
        setError(data.error || 'Failed to claim reward');
        return { success: false, error: data.error };
      }

      return {
        success: true,
        reward: data.reward,
      };
    } catch (err) {
      console.error('Claim reward error:', err);
      setError('Network error');
      return { success: false, error: 'Network error' };
    } finally {
      setIsClaiming(false);
    }
  }, []);

  return {
    // Loading states
    isLoading: isLoadingQuests || isClaiming,
    isLoadingQuests,
    isClaiming,
    error,
    // Methods
    fetchQuests,
    claimReward,
  };
}
