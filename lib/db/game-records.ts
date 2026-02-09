/**
 * Game Records Database Queries
 */

import { supabaseAdmin, GameRecord } from '@/lib/supabase';

export interface CreateGameRecordInput {
  user_id: string;
  wallet_address: string;
  game_type: string;
  score: number;
  distance: number;
  time_ms: number;
  luck_earned: number;
  club_earned: number;
  season_id?: number | null;
}

export interface GameRecordResult {
  success: boolean;
  record?: GameRecord;
  error?: string;
}

/**
 * Create a new game record
 */
export async function createGameRecord(
  input: CreateGameRecordInput
): Promise<GameRecordResult> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabaseAdmin
    .from('game_records')
    .insert({
      user_id: input.user_id,
      wallet_address: input.wallet_address,
      game_type: input.game_type,
      score: input.score,
      distance: input.distance,
      time_ms: input.time_ms,
      luck_earned: input.luck_earned,
      club_earned: input.club_earned,
      season_id: input.season_id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Game record insert error:', error);
    return { success: false, error: 'Failed to save game record' };
  }

  return { success: true, record: data };
}

/**
 * Get game records for a user
 */
export async function getGameRecordsByUser(
  walletAddress: string,
  gameType?: string,
  limit: number = 10
): Promise<{ records: GameRecord[]; highScore: number }> {
  if (!supabaseAdmin) {
    return { records: [], highScore: 0 };
  }

  let query = supabaseAdmin
    .from('game_records')
    .select('*')
    .eq('wallet_address', walletAddress)
    .order('played_at', { ascending: false })
    .limit(limit);

  if (gameType) {
    query = query.eq('game_type', gameType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Game records fetch error:', error);
    return { records: [], highScore: 0 };
  }

  const records = data || [];
  const highScore = records.length > 0
    ? Math.max(...records.map((r) => r.score))
    : 0;

  return { records, highScore };
}

/**
 * Get user's high score for a specific game
 */
export async function getUserHighScore(
  walletAddress: string,
  gameType: string
): Promise<number> {
  if (!supabaseAdmin) {
    return 0;
  }

  const { data, error } = await supabaseAdmin
    .from('game_records')
    .select('score')
    .eq('wallet_address', walletAddress)
    .eq('game_type', gameType)
    .order('score', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.score;
}

/**
 * Get or create user profile by wallet address
 * Auto-creates a profile if it doesn't exist
 */
export async function getUserIdByWallet(
  walletAddress: string
): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  // Try to find existing profile
  const { data: existingProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('wallet_address', walletAddress)
    .single();

  if (existingProfile) {
    return existingProfile.id;
  }

  // Create a new profile if it doesn't exist
  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  const today = new Date().toISOString().split('T')[0];
  const { data: newProfile, error: insertError } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      wallet_address: walletAddress,
      nickname: shortAddress,
      auth_method: 'wallet',
      daily_tickets: 3,
      last_ticket_reset: today,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to create user profile:', insertError);
    return null;
  }

  return newProfile?.id || null;
}

/**
 * Get active season
 */
export async function getActiveSeason(): Promise<{ id: number } | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data } = await supabaseAdmin
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .single();

  return data;
}

/**
 * Get user's total CLUB rewards earned across all games
 */
export async function getUserTotalClub(
  walletAddress: string
): Promise<number> {
  if (!supabaseAdmin) {
    return 0;
  }

  const { data, error } = await supabaseAdmin
    .from('game_records')
    .select('club_earned')
    .eq('wallet_address', walletAddress);

  if (error || !data) {
    console.error('Get total club error:', error);
    return 0;
  }

  // Sum all club_earned values
  return data.reduce((total, record) => total + (record.club_earned || 0), 0);
}
