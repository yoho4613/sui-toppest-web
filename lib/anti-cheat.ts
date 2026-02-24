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
    // Phase 1 강화: 15 → 12 (더 엄격한 속도 제한)
    MAX_SPEED_MS: 12,

    // Minimum time for any valid game (milliseconds)
    // Phase 1 강화: 5초 → 10초 (너무 짧은 게임 방지)
    MIN_GAME_TIME_MS: 10000,

    // Maximum time for a single game session
    // Phase 1 강화: 30분 → 10분 (긴 세션 악용 방지)
    MAX_GAME_TIME_MS: 10 * 60 * 1000,

    // Coin/item collection limits per 100 meters
    // Phase 1 강화: 20 → 15 (비정상적 코인 수집 차단)
    MAX_COINS_PER_100M: 15,
    MAX_POTIONS_PER_100M: 5,
    // Phase 1 강화: 2 → 1 (Fever 남용 방지)
    MAX_FEVER_COUNT_PER_100M: 1,

    // Perfect dodge limits (based on obstacle spawn rate)
    // Phase 1 강화: 10 → 5 (완벽한 회피 남용 방지)
    MAX_PERFECT_PER_100M: 5,

    // Maximum reward per game (redundant with club-rewards.ts but explicit)
    MAX_CLUB_PER_GAME: 100,
  },

  'cosmic-flap': {
    // Maximum speed in m/s (based on flappy game physics)
    // Initial speed 4 + max progression = ~8 m/s
    MAX_SPEED_MS: 10,

    // Minimum time for any valid game (milliseconds)
    // Flappy games tend to be shorter - minimum 5 seconds
    MIN_GAME_TIME_MS: 5000,

    // Maximum time for a single game session (10 minutes)
    MAX_GAME_TIME_MS: 10 * 60 * 1000,

    // Coin/item collection limits per 100 meters
    // Items spawn at 15% rate, ~1 per 6 obstacles
    MAX_COINS_PER_100M: 20,
    MAX_POTIONS_PER_100M: 10, // Shield + Slow items

    // Tunnel passages (similar to fever) - 1 per 500m after 500m mark
    MAX_FEVER_COUNT_PER_100M: 0.5,

    // UFO dodges (similar to perfect) - 1 per 1000m after 1000m mark
    MAX_PERFECT_PER_100M: 0.2,

    // Maximum obstacles per 100m (pipe gap ~2.5, so ~40 per 100m max)
    MAX_OBSTACLES_PER_100M: 50,

    // Maximum flaps per second (human limit ~10 taps/sec)
    MAX_FLAPS_PER_SECOND: 15,

    // Maximum reward per game
    MAX_CLUB_PER_GAME: 100,
  },
} as const;

// ============================================
// Session Token Configuration
// ============================================

export const SESSION_CONFIG = {
  // Session token expiry
  // Phase 1 강화: 10분 → 3분 (토큰 재사용 공격 윈도우 축소)
  TOKEN_EXPIRY_MS: 3 * 60 * 1000,

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
  // Cosmic Flap specific fields
  obstacles_passed?: number;
  flap_count?: number;
  tunnels_passed?: number;
  ufos_passed?: number;
  items_collected?: number;
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
// Server-side Difficulty Calculation
// ============================================

/**
 * Calculate difficulty based on game time (server-authoritative)
 * Phase 1: 클라이언트 난이도 무시, 시간 기반 서버 계산
 */
export function calculateServerDifficulty(timeMs: number): string {
  const seconds = timeMs / 1000;
  if (seconds < 30) return 'easy';       // 0-30초
  if (seconds < 60) return 'medium';     // 30-60초
  if (seconds < 120) return 'hard';      // 1-2분
  return 'extreme';                       // 2분+
}

// ============================================
// Fever Validation
// ============================================

/**
 * Validate fever count against coin collection
 * Phase 1: Fever는 10개 연속 코인 수집 필요
 * @returns true if valid, false if suspicious
 */
export function validateFeverCount(feverCount: number, coinCount: number): boolean {
  // 각 Fever 활성화에는 최소 10개 코인 필요
  const maxPossibleFever = Math.floor(coinCount / 10);
  return feverCount <= maxPossibleFever;
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

  // 3b. Cosmic Flap specific validation
  if (submission.game_type === 'cosmic-flap') {
    const {
      obstacles_passed = 0,
      flap_count = 0,
      tunnels_passed = 0,
      ufos_passed = 0,
    } = submission;

    const cosmicLimits = limits as typeof GAME_LIMITS['cosmic-flap'];

    // Score should roughly equal obstacles passed in flappy games
    if (Math.abs(score - obstacles_passed) > 5) {
      warnings.push(`Score/obstacles mismatch: score=${score}, obstacles=${obstacles_passed}`);
    }

    // Flap count validation (detect auto-tappers)
    const flapsPerSecond = flap_count / timeSeconds;
    if (flapsPerSecond > cosmicLimits.MAX_FLAPS_PER_SECOND) {
      errors.push(
        `Too many flaps: ${flapsPerSecond.toFixed(1)} flaps/sec > ${cosmicLimits.MAX_FLAPS_PER_SECOND} max`
      );
    }

    // Minimum flaps required (can't play without flapping)
    const minFlapsRequired = Math.max(1, Math.floor(timeSeconds / 2)); // At least 1 flap per 2 seconds
    if (flap_count < minFlapsRequired && distance > 50) {
      errors.push(
        `Too few flaps: ${flap_count} flaps in ${timeSeconds.toFixed(1)}s (min: ${minFlapsRequired})`
      );
    }

    // Obstacles per distance validation
    const cosmicDistanceUnits = Math.max(distance / 100, 1);
    const obstaclesPerUnit = obstacles_passed / cosmicDistanceUnits;
    if (obstaclesPerUnit > cosmicLimits.MAX_OBSTACLES_PER_100M) {
      errors.push(
        `Too many obstacles: ${obstacles_passed} in ${distance}m`
      );
    }

    // Tunnel validation (only spawn after 500m)
    if (tunnels_passed > 0 && distance < 500) {
      warnings.push(`Tunnels passed before 500m threshold`);
    }

    // UFO validation (only spawn after 1000m)
    if (ufos_passed > 0 && distance < 1000) {
      warnings.push(`UFOs passed before 1000m threshold`);
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

  // 5. Fever vs Coin consistency validation (Phase 1)
  // Fever requires 10 consecutive coins to activate
  if (!validateFeverCount(fever_count, coin_count)) {
    const maxPossibleFever = Math.floor(coin_count / 10);
    errors.push(
      `Impossible fever count: ${fever_count} fevers with only ${coin_count} coins (max possible: ${maxPossibleFever})`
    );
  }

  // 6. Negative value check
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
