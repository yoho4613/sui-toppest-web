'use client';

import { useMemo } from 'react';
import { useGameStore } from './useGameStore';
import { calculateClubRewards, formatReward, type RewardResult } from '@/lib/rewards/club-rewards';

const GAME_TYPE = 'dash-trials';

/**
 * Hook to calculate and display $CLUB rewards for the current game session
 */
export function useClubRewards(): RewardResult & { formattedTotal: string } {
  const distance = useGameStore((state) => state.distance);
  const feverCount = useGameStore((state) => state.feverCount);
  const perfectCount = useGameStore((state) => state.perfectCount);
  const coinCount = useGameStore((state) => state.coinCount);
  const potionCount = useGameStore((state) => state.potionCount);
  const difficulty = useGameStore((state) => state.difficulty);

  const rewards = useMemo(() => {
    const score = Math.floor(distance);
    return calculateClubRewards(GAME_TYPE, score, {
      feverCount,
      perfectCount,
      coinCount,
      potionCount,
      difficulty,
    });
  }, [distance, feverCount, perfectCount, coinCount, potionCount, difficulty]);

  return {
    ...rewards,
    formattedTotal: formatReward(rewards.totalReward),
  };
}

/**
 * Hook to get live reward preview during gameplay
 */
export function useLiveRewardPreview(): number {
  const distance = useGameStore((state) => state.distance);
  const difficulty = useGameStore((state) => state.difficulty);

  return useMemo(() => {
    const score = Math.floor(distance);
    const result = calculateClubRewards(GAME_TYPE, score, { difficulty });
    return result.totalReward;
  }, [distance, difficulty]);
}
