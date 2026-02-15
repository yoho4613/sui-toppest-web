/**
 * Game Sessions Database Queries
 *
 * Manages game session tokens to prevent replay attacks and abuse.
 * Each game must start with a valid session token, which can only be used once.
 */

import { supabaseAdmin } from '@/lib/supabase';
import {
  generateSessionToken,
  SESSION_CONFIG,
  type GameSessionData,
} from '@/lib/anti-cheat';

export interface CreateSessionResult {
  success: boolean;
  session?: GameSessionData;
  error?: string;
}

export interface ValidateSessionResult {
  valid: boolean;
  session?: GameSessionData;
  error?: string;
}

/**
 * Create a new game session token
 * This should be called when a game starts
 */
export async function createGameSession(
  walletAddress: string,
  gameType: string
): Promise<CreateSessionResult> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not configured' };
  }

  const token = generateSessionToken();
  const now = Date.now();
  const expiresAt = now + SESSION_CONFIG.TOKEN_EXPIRY_MS;

  const sessionData: GameSessionData = {
    sessionToken: token,
    walletAddress,
    gameType,
    startTime: now,
    expiresAt,
    used: false,
  };

  const { error } = await supabaseAdmin.from('game_sessions').insert({
    session_token: token,
    wallet_address: walletAddress,
    game_type: gameType,
    start_time: new Date(now).toISOString(),
    expires_at: new Date(expiresAt).toISOString(),
    used: false,
  });

  if (error) {
    console.error('Failed to create game session:', error);
    return { success: false, error: 'Failed to create game session' };
  }

  return { success: true, session: sessionData };
}

/**
 * Validate and consume a game session token
 * Returns valid=true only if:
 * 1. Token exists
 * 2. Token is not expired
 * 3. Token has not been used
 * 4. Token matches the wallet and game type
 */
export async function validateAndConsumeSession(
  token: string,
  walletAddress: string,
  gameType: string
): Promise<ValidateSessionResult> {
  if (!supabaseAdmin) {
    return { valid: false, error: 'Database not configured' };
  }

  // Find the session
  const { data: session, error: fetchError } = await supabaseAdmin
    .from('game_sessions')
    .select('*')
    .eq('session_token', token)
    .single();

  if (fetchError || !session) {
    return { valid: false, error: 'Invalid session token' };
  }

  // Validate session
  if (session.used) {
    return { valid: false, error: 'Session token already used' };
  }

  if (new Date(session.expires_at) < new Date()) {
    return { valid: false, error: 'Session token expired' };
  }

  if (session.wallet_address !== walletAddress) {
    return { valid: false, error: 'Session wallet mismatch' };
  }

  if (session.game_type !== gameType) {
    return { valid: false, error: 'Session game type mismatch' };
  }

  // Mark session as used (atomic update)
  const { error: updateError } = await supabaseAdmin
    .from('game_sessions')
    .update({
      used: true,
      used_at: new Date().toISOString(),
    })
    .eq('session_token', token)
    .eq('used', false); // Ensure we only update if still unused (race condition protection)

  if (updateError) {
    console.error('Failed to mark session as used:', updateError);
    return { valid: false, error: 'Failed to consume session' };
  }

  return {
    valid: true,
    session: {
      sessionToken: session.session_token,
      walletAddress: session.wallet_address,
      gameType: session.game_type,
      startTime: new Date(session.start_time).getTime(),
      expiresAt: new Date(session.expires_at).getTime(),
      used: true,
    },
  };
}

/**
 * Get recent game records for rate limiting
 */
export async function getRecentGameRecords(
  walletAddress: string,
  hours: number = 24
): Promise<{ played_at: string }[]> {
  if (!supabaseAdmin) {
    return [];
  }

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('game_records')
    .select('played_at')
    .eq('wallet_address', walletAddress)
    .gte('played_at', cutoff)
    .order('played_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch recent game records:', error);
    return [];
  }

  return data || [];
}

/**
 * Clean up expired sessions (can be called periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  if (!supabaseAdmin) {
    return 0;
  }

  const { data, error } = await supabaseAdmin
    .from('game_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }

  return data?.length || 0;
}
