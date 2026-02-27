/**
 * Quests Database Queries
 */

import { supabaseAdmin } from '@/lib/supabase';

// Types
export interface Quest {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'daily' | 'weekly' | 'special';
  condition_type: string;
  condition_value: number;
  condition_game_type: string | null;
  reward_type: 'club' | 'star_ticket' | 'sui';
  reward_amount: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserQuest {
  id: string;
  wallet_address: string;
  quest_id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  period_start: string;
  completed_at: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestWithProgress extends Quest {
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface QuestsResult {
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

/**
 * Get current period start dates
 */
function getPeriodStarts(): { daily: string; weekly: string; special: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Calculate week start (Monday)
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  return {
    daily: today,
    weekly: weekStartStr,
    special: '1970-01-01', // Fixed date for special quests
  };
}

/**
 * Calculate time remaining until reset
 */
function getResetTimes(): { daily: string; weekly: string } {
  const now = new Date();

  // Daily reset: next UTC midnight
  const nextMidnight = new Date(now);
  nextMidnight.setUTCDate(now.getUTCDate() + 1);
  nextMidnight.setUTCHours(0, 0, 0, 0);
  const dailyMs = nextMidnight.getTime() - now.getTime();

  // Weekly reset: next Monday UTC midnight
  const dayOfWeek = now.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  const weeklyMs = nextMonday.getTime() - now.getTime();

  return {
    daily: formatDuration(dailyMs),
    weekly: formatDuration(weeklyMs),
  };
}

/**
 * Format milliseconds to human-readable duration
 */
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Get all quests with user's progress
 */
export async function getQuestsForUser(
  walletAddress: string
): Promise<QuestsResult | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const periods = getPeriodStarts();
  const resetTimes = getResetTimes();

  // Get all active quests
  const { data: quests, error: questsError } = await supabaseAdmin
    .from('quests')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (questsError || !quests) {
    console.error('Failed to fetch quests:', questsError);
    return null;
  }

  // Get user's quest progress
  const { data: userQuests, error: userQuestsError } = await supabaseAdmin
    .from('user_quests')
    .select('*')
    .eq('wallet_address', walletAddress);

  if (userQuestsError) {
    console.error('Failed to fetch user quests:', userQuestsError);
  }

  const userQuestsMap = new Map<string, UserQuest>();
  (userQuests || []).forEach((uq) => {
    // Key: quest_id + period_start
    const key = `${uq.quest_id}_${uq.period_start}`;
    userQuestsMap.set(key, uq);
  });

  // Combine quests with progress
  const daily: QuestWithProgress[] = [];
  const weekly: QuestWithProgress[] = [];
  const special: QuestWithProgress[] = [];

  for (const quest of quests) {
    const periodStart = periods[quest.category as keyof typeof periods];
    const key = `${quest.id}_${periodStart}`;
    const userQuest = userQuestsMap.get(key);

    const questWithProgress: QuestWithProgress = {
      ...quest,
      progress: userQuest?.progress || 0,
      completed: userQuest?.completed || false,
      claimed: userQuest?.claimed || false,
    };

    if (quest.category === 'daily') {
      daily.push(questWithProgress);
    } else if (quest.category === 'weekly') {
      weekly.push(questWithProgress);
    } else {
      special.push(questWithProgress);
    }
  }

  return {
    daily,
    weekly,
    special,
    stats: {
      dailyCompleted: daily.filter((q) => q.completed).length,
      dailyTotal: daily.length,
      weeklyCompleted: weekly.filter((q) => q.completed).length,
      weeklyTotal: weekly.length,
      resetIn: resetTimes,
    },
  };
}

/**
 * Update quest progress for a specific condition type
 */
export async function updateQuestProgress(
  walletAddress: string,
  conditionType: string,
  increment: number = 1
): Promise<boolean> {
  if (!supabaseAdmin) {
    return false;
  }

  const { error } = await supabaseAdmin.rpc('update_quest_progress', {
    p_wallet: walletAddress,
    p_condition_type: conditionType,
    p_increment: increment,
  });

  if (error) {
    console.error('Failed to update quest progress:', error);
    return false;
  }

  return true;
}

/**
 * Claim a quest reward
 */
export async function claimQuestReward(
  walletAddress: string,
  questId: string
): Promise<ClaimResult> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabaseAdmin.rpc('claim_quest_reward', {
    p_wallet: walletAddress,
    p_quest_id: questId,
  });

  if (error) {
    console.error('Failed to claim quest reward:', error);
    return { success: false, error: 'Failed to claim reward' };
  }

  const result = data?.[0];
  if (!result?.success) {
    return { success: false, error: result?.error_message || 'Unknown error' };
  }

  return {
    success: true,
    reward: {
      type: result.reward_type,
      amount: result.reward_amount,
    },
  };
}

/**
 * Get real-time progress for a condition type
 * This calculates progress from source tables (game_records, purchases, referrals)
 */
export async function calculateProgress(
  walletAddress: string,
  conditionType: string
): Promise<number> {
  if (!supabaseAdmin) {
    return 0;
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Week start (Monday)
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  switch (conditionType) {
    case 'games_played_daily': {
      const { count } = await supabaseAdmin
        .from('game_records')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress)
        .gte('played_at', `${today}T00:00:00Z`);
      return count || 0;
    }

    case 'games_played_weekly': {
      const { count } = await supabaseAdmin
        .from('game_records')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress)
        .gte('played_at', weekStart.toISOString());
      return count || 0;
    }

    case 'first_game': {
      const { count } = await supabaseAdmin
        .from('game_records')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress);
      return count && count > 0 ? 1 : 0;
    }

    case 'profile_complete': {
      const { data } = await supabaseAdmin
        .from('user_profiles')
        .select('nickname, google_email, email')
        .eq('wallet_address', walletAddress)
        .single();

      if (data) {
        const hasNickname = !!data.nickname && data.nickname.length > 0;
        const hasEmail = !!(data.google_email || data.email);
        return hasNickname && hasEmail ? 1 : 0;
      }
      return 0;
    }

    case 'purchase_made_daily': {
      const { count } = await supabaseAdmin
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress)
        .eq('status', 'completed')
        .gte('verified_at', `${today}T00:00:00Z`);
      return count && count > 0 ? 1 : 0;
    }

    case 'purchase_usd_weekly': {
      const { data } = await supabaseAdmin
        .from('purchases')
        .select('price_usd')
        .eq('wallet_address', walletAddress)
        .eq('status', 'completed')
        .gte('verified_at', weekStart.toISOString());

      if (data) {
        return data.reduce((sum, p) => sum + (p.price_usd || 0), 0);
      }
      return 0;
    }

    case 'first_purchase': {
      const { count } = await supabaseAdmin
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress)
        .eq('status', 'completed');
      return count && count > 0 ? 1 : 0;
    }

    // Referral conditions
    case 'referral_daily': {
      // Count referrals made today
      const { count } = await supabaseAdmin
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_wallet', walletAddress)
        .gte('created_at', `${today}T00:00:00Z`);
      return count || 0;
    }

    case 'referral_weekly': {
      // Count referrals made this week
      const { count } = await supabaseAdmin
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_wallet', walletAddress)
        .gte('created_at', weekStart.toISOString());
      return count || 0;
    }

    case 'referral_total': {
      // Get total referral count from user_profiles
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('referral_count')
        .eq('wallet_address', walletAddress)
        .single();
      return profile?.referral_count || 0;
    }

    default:
      console.warn('Unknown condition type:', conditionType);
      return 0;
  }
}

/**
 * Sync all quest progress for a user (recalculates from source data)
 */
export async function syncQuestProgress(
  walletAddress: string
): Promise<boolean> {
  if (!supabaseAdmin) {
    return false;
  }

  // Get all active quests
  const { data: quests } = await supabaseAdmin
    .from('quests')
    .select('*')
    .eq('is_active', true);

  if (!quests) {
    return false;
  }

  const periods = getPeriodStarts();

  for (const quest of quests) {
    const progress = await calculateProgress(walletAddress, quest.condition_type);
    const periodStart = periods[quest.category as keyof typeof periods];

    // Upsert user_quest with calculated progress
    await supabaseAdmin
      .from('user_quests')
      .upsert(
        {
          wallet_address: walletAddress,
          quest_id: quest.id,
          period_start: periodStart,
          progress: Math.min(progress, quest.condition_value),
          completed: progress >= quest.condition_value,
          completed_at: progress >= quest.condition_value ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'wallet_address,quest_id,period_start',
        }
      );
  }

  return true;
}
