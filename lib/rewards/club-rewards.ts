/**
 * $CLUB Token Reward System
 *
 * All games use $CLUB as the unified reward token.
 * Rewards are calculated proportionally based on distance/score.
 */

// Game-specific reward configuration
export interface GameRewardConfig {
  gameType: string;
  clubPerMeter: number;          // Base $CLUB per meter/point
  feverBonusPercent: number;     // Bonus % per fever activation
  perfectDodgeBonus: number;     // Bonus per perfect dodge
  coinBonus: number;             // Bonus per coin collected
  maxRewardPerGame: number;      // Cap on maximum reward per game
  difficultyMultipliers: Record<string, number>;
}

// Reward calculation result
export interface RewardResult {
  baseReward: number;
  feverBonus: number;
  perfectBonus: number;
  coinBonus: number;
  difficultyMultiplier: number;
  totalReward: number;
  breakdown: RewardBreakdown;
}

export interface RewardBreakdown {
  base: string;
  fever: string;
  perfect: string;
  coins: string;
  difficulty: string;
  total: string;
}

// Default reward configuration for Dash Trials
// 거리에 비례: 100m = 1 CLUB
const DASH_TRIALS_CONFIG: GameRewardConfig = {
  gameType: 'dash-trials',
  clubPerMeter: 0.01,            // 100m = 1 CLUB (1000m = 10 CLUB)
  feverBonusPercent: 10,         // 10% bonus per fever activation
  perfectDodgeBonus: 0.1,        // 0.1 $CLUB per perfect dodge
  coinBonus: 0.05,               // 0.05 $CLUB per coin
  maxRewardPerGame: 100,         // Max 100 $CLUB per game
  difficultyMultipliers: {
    tutorial: 0.5,
    easy: 0.8,
    medium: 1.0,
    hard: 1.2,
    extreme: 1.5,
  },
};

// Store all game configurations
const GAME_CONFIGS: Record<string, GameRewardConfig> = {
  'dash-trials': DASH_TRIALS_CONFIG,
  // Add more games here as they're developed
};

/**
 * Get reward configuration for a specific game
 */
export function getGameConfig(gameType: string): GameRewardConfig | null {
  return GAME_CONFIGS[gameType] || null;
}

/**
 * Calculate $CLUB rewards for a game session
 * 거리에 비례하여 계산
 */
export function calculateClubRewards(
  gameType: string,
  score: number,
  options: {
    feverCount?: number;
    perfectCount?: number;
    coinCount?: number;
    potionCount?: number;
    difficulty?: string;
  } = {}
): RewardResult {
  const config = getGameConfig(gameType);

  // Default result for unknown games (0.1 CLUB per point)
  if (!config) {
    const defaultReward = Math.floor(score * 0.1);
    return {
      baseReward: defaultReward,
      feverBonus: 0,
      perfectBonus: 0,
      coinBonus: 0,
      difficultyMultiplier: 1,
      totalReward: defaultReward,
      breakdown: {
        base: `${defaultReward} CLUB`,
        fever: 'N/A',
        perfect: 'N/A',
        coins: 'N/A',
        difficulty: '1x',
        total: `${defaultReward} CLUB`,
      },
    };
  }

  const {
    feverCount = 0,
    perfectCount = 0,
    coinCount = 0,
    difficulty = 'medium',
  } = options;

  // 1. 기본 리워드: 거리 × 미터당 CLUB
  const baseReward = Math.floor(score * config.clubPerMeter);

  // 2. Fever 보너스 (기본 리워드의 %)
  const feverBonus = Math.floor(baseReward * (config.feverBonusPercent / 100) * feverCount);

  // 3. Perfect dodge 보너스
  const perfectBonus = Math.floor(perfectCount * config.perfectDodgeBonus);

  // 4. Coin 보너스
  const coinBonusAmount = Math.floor(coinCount * config.coinBonus);

  // 5. 난이도 배율
  const diffMultiplier = config.difficultyMultipliers[difficulty] || 1.0;

  // 합계 계산 (난이도 배율 적용)
  const subtotal = baseReward + feverBonus + perfectBonus + coinBonusAmount;
  let totalReward = Math.floor(subtotal * diffMultiplier);

  // 6. 최대값 제한
  totalReward = Math.min(totalReward, config.maxRewardPerGame);

  return {
    baseReward,
    feverBonus,
    perfectBonus,
    coinBonus: coinBonusAmount,
    difficultyMultiplier: diffMultiplier,
    totalReward,
    breakdown: {
      base: `${baseReward} CLUB (${score}m × ${config.clubPerMeter})`,
      fever: feverBonus > 0 ? `+${feverBonus} CLUB (${feverCount}x fever)` : '-',
      perfect: perfectBonus > 0 ? `+${perfectBonus} CLUB (${perfectCount} perfect)` : '-',
      coins: coinBonusAmount > 0 ? `+${coinBonusAmount} CLUB (${coinCount} coins)` : '-',
      difficulty: `${diffMultiplier}x (${difficulty})`,
      total: `${totalReward} CLUB`,
    },
  };
}

/**
 * Quick calculation for display purposes
 */
export function quickCalculateRewards(
  gameType: string,
  score: number,
  difficulty: string = 'medium'
): number {
  const result = calculateClubRewards(gameType, score, { difficulty });
  return result.totalReward;
}

/**
 * Get reward preview for different distances
 */
export function getRewardPreview(gameType: string): Array<{ distance: number; reward: number }> {
  const distances = [100, 500, 1000, 2000, 5000];
  return distances.map(distance => ({
    distance,
    reward: quickCalculateRewards(gameType, distance),
  }));
}

/**
 * Format reward amount for display
 */
export function formatReward(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
}
