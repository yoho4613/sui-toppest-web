/**
 * Unified Reward System
 *
 * All games use $CLUB as the reward token.
 * Rewards are proportional to distance/score.
 */

export {
  calculateClubRewards,
  quickCalculateRewards,
  getRewardPreview,
  formatReward,
  getGameConfig,
  type RewardResult,
  type RewardBreakdown,
  type GameRewardConfig,
} from './club-rewards';
