/**
 * Anti-Cheat System
 *
 * Server-side validation utilities to prevent game abuse.
 * All game submissions must pass these validations.
 */

import crypto from 'crypto';

// ============================================
// Game Constants - Physics-based limits
// ============================================

export const GAME_LIMITS = {
  'dash-trials': {
    // Maximum speed in m/s (based on game physics)
    // Base speed 8 + max fever boost (~1.5x) = ~12 m/s max sustained
    MAX_SPEED_MS: 15, // With buffer for acceleration spikes

    // Minimum time for any valid game (milliseconds)
    MIN_GAME_TIME_MS: 5000, // 5 seconds minimum

    // Maximum time for a single game session (30 minutes)
    MAX_GAME_TIME_MS: 30 * 60 * 1000,

    // Coin/item collection limits per 100 meters
    MAX_COINS_PER_100M: 20,
    MAX_POTIONS_PER_100M: 5,
    MAX_FEVER_COUNT_PER_100M: 2,

    // Perfect dodge limits (based on obstacle spawn rate)
    MAX_PERFECT_PER_100M: 10,

    // Maximum reward per game (redundant with club-rewards.ts but explicit)
    MAX_CLUB_PER_GAME: 100,
  },
} as const;

// ============================================
// Session Token Configuration
// ============================================

export const SESSION_CONFIG = {
  // Session token expiry (10 minutes - covers longest reasonable game)
  TOKEN_EXPIRY_MS: 10 * 60 * 1000,

  // Maximum games per wallet per hour
  MAX_GAMES_PER_HOUR: 20,

  // Maximum games per wallet per day
  MAX_GAMES_PER_DAY: 100,

  // Minimum time between game submissions (seconds)
  MIN_SUBMISSION_INTERVAL_MS: 5000,
} as const;

// ============================================
// Validation Types
// ============================================

export interface GameSessionData {
  sessionToken: string;
  walletAddress: string;
  gameType: string;
  startTime: number;
  expiresAt: number;
  used: boolean;
}

export interface GameSubmission {
  wallet_address: string;
  game_type: string;
  score: number;
  distance: number;
  time_ms: number;
  fever_count?: number;
  perfect_count?: number;
  coin_count?: number;
  potion_count?: number;
  difficulty?: string;
  session_token?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// Token Generation
// ============================================

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create HMAC signature for session data
 */
export function signSessionData(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify session signature
 */
export function verifySessionSignature(
  data: string,
  signature: string,
  secret: string
): boolean {
  const expected = signSessionData(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate game submission against physics-based limits
 */
export function validateGameSubmission(
  submission: GameSubmission
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const limits = GAME_LIMITS[submission.game_type as keyof typeof GAME_LIMITS];

  if (!limits) {
    warnings.push(`Unknown game type: ${submission.game_type}`);
    return { valid: true, errors, warnings };
  }

  const {
    score,
    distance,
    time_ms,
    fever_count = 0,
    perfect_count = 0,
    coin_count = 0,
    potion_count = 0,
  } = submission;

  // 1. Time validation
  if (time_ms < limits.MIN_GAME_TIME_MS) {
    errors.push(`Game too short: ${time_ms}ms < ${limits.MIN_GAME_TIME_MS}ms minimum`);
  }

  if (time_ms > limits.MAX_GAME_TIME_MS) {
    errors.push(`Game too long: ${time_ms}ms > ${limits.MAX_GAME_TIME_MS}ms maximum`);
  }

  // 2. Distance vs time validation (speed check)
  // distance (meters) / time (seconds) = speed (m/s)
  const timeSeconds = time_ms / 1000;
  const calculatedSpeed = distance / timeSeconds;

  if (calculatedSpeed > limits.MAX_SPEED_MS) {
    errors.push(
      `Impossible speed: ${calculatedSpeed.toFixed(2)} m/s > ${limits.MAX_SPEED_MS} m/s max`
    );
  }

  // 3. Score vs distance consistency (for dash-trials, score = distance)
  if (submission.game_type === 'dash-trials') {
    if (Math.abs(score - distance) > 10) {
      // Allow small rounding differences
      warnings.push(`Score/distance mismatch: score=${score}, distance=${distance}`);
    }
  }

  // 4. Item collection rate validation
  const distanceUnits = Math.max(distance / 100, 1); // Per 100 meters

  if (coin_count / distanceUnits > limits.MAX_COINS_PER_100M) {
    errors.push(
      `Too many coins: ${coin_count} coins in ${distance}m (${(coin_count / distanceUnits).toFixed(1)}/100m > ${limits.MAX_COINS_PER_100M}/100m)`
    );
  }

  if (potion_count / distanceUnits > limits.MAX_POTIONS_PER_100M) {
    errors.push(
      `Too many potions: ${potion_count} potions in ${distance}m`
    );
  }

  if (fever_count / distanceUnits > limits.MAX_FEVER_COUNT_PER_100M) {
    errors.push(
      `Too many fever activations: ${fever_count} in ${distance}m`
    );
  }

  if (perfect_count / distanceUnits > limits.MAX_PERFECT_PER_100M) {
    errors.push(
      `Too many perfect dodges: ${perfect_count} in ${distance}m`
    );
  }

  // 5. Negative value check
  if (score < 0 || distance < 0 || time_ms < 0) {
    errors.push('Negative values detected');
  }

  if (fever_count < 0 || perfect_count < 0 || coin_count < 0 || potion_count < 0) {
    errors.push('Negative item counts detected');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if submission rate is within limits
 */
export function checkRateLimit(
  recentSubmissions: { played_at: string }[],
  now: Date = new Date()
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const gamesLastHour = recentSubmissions.filter(
    (s) => new Date(s.played_at) > oneHourAgo
  ).length;

  const gamesLastDay = recentSubmissions.filter(
    (s) => new Date(s.played_at) > oneDayAgo
  ).length;

  if (gamesLastHour >= SESSION_CONFIG.MAX_GAMES_PER_HOUR) {
    errors.push(
      `Hourly rate limit exceeded: ${gamesLastHour}/${SESSION_CONFIG.MAX_GAMES_PER_HOUR} games`
    );
  }

  if (gamesLastDay >= SESSION_CONFIG.MAX_GAMES_PER_DAY) {
    errors.push(
      `Daily rate limit exceeded: ${gamesLastDay}/${SESSION_CONFIG.MAX_GAMES_PER_DAY} games`
    );
  }

  // Check for suspiciously rapid submissions
  if (recentSubmissions.length > 0) {
    const lastSubmission = new Date(recentSubmissions[0].played_at);
    const timeSinceLastMs = now.getTime() - lastSubmission.getTime();

    if (timeSinceLastMs < SESSION_CONFIG.MIN_SUBMISSION_INTERVAL_MS) {
      errors.push(
        `Submission too fast: ${timeSinceLastMs}ms since last game`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log suspicious activity for monitoring
 */
export function logSuspiciousActivity(
  walletAddress: string,
  reason: string,
  details: Record<string, unknown>
): void {
  console.warn('[ANTI-CHEAT]', {
    timestamp: new Date().toISOString(),
    wallet: walletAddress,
    reason,
    details,
  });
}
