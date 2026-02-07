/**
 * Leaderboard Database Queries
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
 * Get date filter based on time filter type
 */
function getDateFilter(filter: TimeFilter): string | null {
  const now = new Date();

  if (filter === 'daily') {
    return now.toISOString().split('T')[0]; // Today
  } else if (filter === 'weekly') {
    // Start of current week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek.toISOString();
  }

  return null; // All time
}

/**
 * Fetch leaderboard data for a specific game
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

  const dateFilter = getDateFilter(filter);

  // Build query - use left join to include users without profiles
  let query = supabaseAdmin
    .from('game_records')
    .select(`
      wallet_address,
      score,
      distance,
      played_at,
      user_profiles(nickname, avatar_url, google_name, google_picture)
    `)
    .eq('game_type', gameType)
    .order('score', { ascending: false });

  if (dateFilter) {
    query = query.gte('played_at', dateFilter);
  }

  const { data: records, error } = await query;

  if (error) {
    console.error('Leaderboard fetch error:', error);
    return emptyResult;
  }

  // Process records to get unique users with their high scores
  const userHighScores = new Map<string, {
    wallet_address: string;
    high_score: number;
    distance: number;
    display_name: string;
    avatar_url: string | null;
    games_played: number;
  }>();

  records?.forEach((record: any) => {
    const existing = userHighScores.get(record.wallet_address);
    const profile = record.user_profiles;
    const displayName = profile?.nickname || profile?.google_name ||
      `${record.wallet_address.slice(0, 6)}...${record.wallet_address.slice(-4)}`;
    const avatarUrl = profile?.avatar_url || profile?.google_picture || null;

    if (!existing || record.score > existing.high_score) {
      userHighScores.set(record.wallet_address, {
        wallet_address: record.wallet_address,
        high_score: record.score,
        distance: record.distance,
        display_name: displayName,
        avatar_url: avatarUrl,
        games_played: existing ? existing.games_played + 1 : 1,
      });
    } else {
      existing.games_played += 1;
    }
  });

  // Convert to array and sort by high score
  const sortedEntries = Array.from(userHighScores.values())
    .sort((a, b) => b.high_score - a.high_score);

  const leaderboard = sortedEntries
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

  // Get user's rank if address provided
  let userRank: LeaderboardEntry | null = null;
  if (userAddress) {
    const userIndex = sortedEntries
      .findIndex((entry) => entry.wallet_address === userAddress);

    if (userIndex !== -1) {
      const userData = userHighScores.get(userAddress);
      if (userData) {
        userRank = {
          rank: userIndex + 1,
          ...userData,
        };
      }
    }
  }

  return {
    leaderboard,
    userRank,
    filter,
    gameType,
    totalPlayers: userHighScores.size,
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
  const result = await getLeaderboard(gameType, filter, walletAddress, 1000);
  return result.userRank;
}
