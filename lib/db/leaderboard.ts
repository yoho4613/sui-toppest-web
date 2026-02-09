/**
 * Leaderboard Database Queries
 *
 * Uses dedicated leaderboard table for fast ranking queries.
 * The leaderboard table is updated on each game record insert.
 */

import { supabaseAdmin } from '@/lib/supabase';

export type TimeFilter = 'daily' | 'weekly' | 'alltime';

export interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  high_score: number;
  distance: number;
  display_name: string;
  avatar_url: string | null;
  games_played: number;
}

export interface LeaderboardResult {
  leaderboard: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  filter: TimeFilter;
  gameType: string;
  totalPlayers: number;
}

/**
 * Get score column based on time filter
 */
function getScoreColumn(filter: TimeFilter): string {
  switch (filter) {
    case 'daily':
      return 'daily_high_score';
    case 'weekly':
      return 'weekly_high_score';
    case 'alltime':
    default:
      return 'high_score';
  }
}

/**
 * Get distance column based on time filter
 */
function getDistanceColumn(filter: TimeFilter): string {
  switch (filter) {
    case 'daily':
      return 'daily_high_distance';
    case 'weekly':
      return 'weekly_high_distance';
    case 'alltime':
    default:
      return 'high_distance';
  }
}

/**
 * Update leaderboard after a game record is saved
 * Calls the PostgreSQL function update_leaderboard()
 */
export async function updateLeaderboard(
  walletAddress: string,
  gameType: string,
  score: number,
  distance: number,
  clubEarned: number
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabaseAdmin.rpc('update_leaderboard', {
    p_wallet: walletAddress,
    p_game_type: gameType,
    p_score: score,
    p_distance: distance,
    p_club: clubEarned,
  });

  if (error) {
    console.error('Update leaderboard error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Fetch leaderboard data for a specific game
 * Uses the dedicated leaderboard table for fast queries
 */
export async function getLeaderboard(
  gameType: string,
  filter: TimeFilter = 'weekly',
  userAddress?: string,
  limit: number = 50
): Promise<LeaderboardResult> {
  const emptyResult: LeaderboardResult = {
    leaderboard: [],
    userRank: null,
    filter,
    gameType,
    totalPlayers: 0,
  };

  if (!supabaseAdmin) {
    return emptyResult;
  }

  const scoreColumn = getScoreColumn(filter);
  const distanceColumn = getDistanceColumn(filter);

  // Query leaderboard table with user profile join
  // Select all score columns and filter in code for type safety
  const { data: entries, error } = await supabaseAdmin
    .from('leaderboard')
    .select(`
      wallet_address,
      high_score,
      high_distance,
      weekly_high_score,
      weekly_high_distance,
      daily_high_score,
      daily_high_distance,
      games_played,
      user_profiles(nickname, avatar_url, google_name, google_picture)
    `)
    .eq('game_type', gameType)
    .order(scoreColumn, { ascending: false })
    .limit(limit * 2); // Fetch extra to filter out zero scores

  if (error) {
    console.error('Leaderboard fetch error:', error);
    return emptyResult;
  }

  // Filter and transform to LeaderboardEntry format
  const getScore = (entry: any): number => {
    switch (filter) {
      case 'daily': return entry.daily_high_score || 0;
      case 'weekly': return entry.weekly_high_score || 0;
      default: return entry.high_score || 0;
    }
  };

  const getDistance = (entry: any): number => {
    switch (filter) {
      case 'daily': return entry.daily_high_distance || 0;
      case 'weekly': return entry.weekly_high_distance || 0;
      default: return entry.high_distance || 0;
    }
  };

  // Filter entries with score > 0 and limit
  const filteredEntries = (entries || [])
    .filter((entry: any) => getScore(entry) > 0)
    .slice(0, limit);

  const leaderboard: LeaderboardEntry[] = filteredEntries.map((entry: any, index: number) => {
    const profile = entry.user_profiles;
    const displayName = profile?.nickname || profile?.google_name ||
      `${entry.wallet_address.slice(0, 6)}...${entry.wallet_address.slice(-4)}`;
    const avatarUrl = profile?.avatar_url || profile?.google_picture || null;

    return {
      rank: index + 1,
      wallet_address: entry.wallet_address,
      high_score: getScore(entry),
      distance: getDistance(entry),
      display_name: displayName,
      avatar_url: avatarUrl,
      games_played: entry.games_played,
    };
  });

  // Get total player count for this game (with score > 0)
  const totalPlayers = filteredEntries.length;

  // Get user's rank if address provided
  let userRank: LeaderboardEntry | null = null;
  if (userAddress) {
    // First check if user is in the top results
    const userInList = leaderboard.find(e => e.wallet_address === userAddress);
    if (userInList) {
      userRank = userInList;
    } else {
      // Query user's specific rank
      const { data: userData } = await supabaseAdmin
        .from('leaderboard')
        .select(`
          wallet_address,
          high_score,
          high_distance,
          weekly_high_score,
          weekly_high_distance,
          daily_high_score,
          daily_high_distance,
          games_played,
          user_profiles(nickname, avatar_url, google_name, google_picture)
        `)
        .eq('game_type', gameType)
        .eq('wallet_address', userAddress)
        .single();

      if (userData) {
        const userScore = getScore(userData);
        const userDistance = getDistance(userData);

        if (userScore > 0) {
          // Count how many users have higher scores to get rank
          const { count: higherCount } = await supabaseAdmin
            .from('leaderboard')
            .select('*', { count: 'exact', head: true })
            .eq('game_type', gameType)
            .gt(scoreColumn, userScore);

          const profile = userData.user_profiles as any;
          const displayName = profile?.nickname || profile?.google_name ||
            `${userData.wallet_address.slice(0, 6)}...${userData.wallet_address.slice(-4)}`;
          const avatarUrl = profile?.avatar_url || profile?.google_picture || null;

          userRank = {
            rank: (higherCount || 0) + 1,
            wallet_address: userData.wallet_address,
            high_score: userScore,
            distance: userDistance,
            display_name: displayName,
            avatar_url: avatarUrl,
            games_played: userData.games_played,
          };
        }
      }
    }
  }

  return {
    leaderboard,
    userRank,
    filter,
    gameType,
    totalPlayers,
  };
}

/**
 * Get top N players for a specific game
 */
export async function getTopPlayers(
  gameType: string,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const result = await getLeaderboard(gameType, 'alltime', undefined, limit);
  return result.leaderboard;
}

/**
 * Get user's rank for a specific game
 */
export async function getUserRank(
  gameType: string,
  walletAddress: string,
  filter: TimeFilter = 'alltime'
): Promise<LeaderboardEntry | null> {
  const result = await getLeaderboard(gameType, filter, walletAddress, 1);
  return result.userRank;
}
