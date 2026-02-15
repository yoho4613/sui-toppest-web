/**
 * Game Record API
 *
 * POST: Save game record after game ends (with anti-cheat validation)
 * GET: Get user's game history
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createGameRecord,
  getGameRecordsByUser,
  getUserIdByWallet,
  getActiveSeason,
  updateLeaderboard,
  updateQuestProgress,
  processClubEarningShare,
  validateAndConsumeSession,
  getRecentGameRecords,
} from '@/lib/db';
import { calculateClubRewards } from '@/lib/rewards/club-rewards';
import {
  validateGameSubmission,
  checkRateLimit,
  logSuspiciousActivity,
  type GameSubmission,
} from '@/lib/anti-cheat';

// Extract client info from request headers
function extractClientInfo(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || undefined;
  const acceptLanguage = request.headers.get('accept-language') || undefined;

  return {
    user_agent: userAgent,
    platform: userAgent?.includes('Mobile') ? 'mobile' : 'desktop',
    // Additional info can be sent from client
    accept_language: acceptLanguage,
  };
}

// Build game-specific metadata based on game_type
// Each game can have different metadata structure - stored as JSONB
function buildGameMetadata(gameType: string, submission: GameSubmission) {
  switch (gameType) {
    case 'dash-trials':
      return {
        fever_count: submission.fever_count || 0,
        perfect_count: submission.perfect_count || 0,
        coin_count: submission.coin_count || 0,
        potion_count: submission.potion_count || 0,
        difficulty: submission.difficulty || 'medium',
      };
    // Add more game types here as they are developed
    // case 'puzzle-quest':
    //   return { level: submission.level, combo_count: submission.combo_count };
    default:
      // For unknown games, return any provided metadata
      return {
        fever_count: submission.fever_count,
        perfect_count: submission.perfect_count,
        coin_count: submission.coin_count,
        potion_count: submission.potion_count,
        difficulty: submission.difficulty,
      };
  }
}

// POST /api/game/record - Save game record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      wallet_address,
      game_type,
      score,
      distance,
      time_ms,
      // Game stats for reward calculation
      fever_count,
      perfect_count,
      coin_count,
      potion_count,
      difficulty,
      // Anti-cheat: session token from /api/game/session
      session_token,
      // Client info (optional, sent from browser)
      client_info: clientInfoFromBody,
    } = body;

    if (!wallet_address || !game_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ========================================
    // ANTI-CHEAT VALIDATION
    // ========================================

    // 1. Session token validation (required)
    if (!session_token) {
      logSuspiciousActivity(wallet_address, 'Missing session token', { game_type });
      return NextResponse.json(
        { error: 'Missing session token. Start game via /api/game/session first.' },
        { status: 400 }
      );
    }

    const sessionResult = await validateAndConsumeSession(
      session_token,
      wallet_address,
      game_type
    );

    if (!sessionResult.valid) {
      logSuspiciousActivity(wallet_address, 'Invalid session token', {
        error: sessionResult.error,
        game_type,
      });
      return NextResponse.json(
        { error: sessionResult.error || 'Invalid session token' },
        { status: 403 }
      );
    }

    // 2. Game submission validation (physics-based checks)
    const submission: GameSubmission = {
      wallet_address,
      game_type,
      score: score || 0,
      distance: distance || 0,
      time_ms: time_ms || 0,
      fever_count: fever_count || 0,
      perfect_count: perfect_count || 0,
      coin_count: coin_count || 0,
      potion_count: potion_count || 0,
      difficulty: difficulty || 'medium',
    };

    const validationResult = validateGameSubmission(submission);

    if (!validationResult.valid) {
      logSuspiciousActivity(wallet_address, 'Invalid game submission', {
        errors: validationResult.errors,
        submission,
      });
      return NextResponse.json(
        {
          error: 'Invalid game data detected',
          details: validationResult.errors,
        },
        { status: 400 }
      );
    }

    // Log warnings (but still allow submission)
    if (validationResult.warnings.length > 0) {
      logSuspiciousActivity(wallet_address, 'Game submission warnings', {
        warnings: validationResult.warnings,
        submission,
      });
    }

    // 3. Rate limit check
    const recentRecords = await getRecentGameRecords(wallet_address, 24);
    const rateLimitResult = checkRateLimit(recentRecords);

    if (!rateLimitResult.valid) {
      logSuspiciousActivity(wallet_address, 'Rate limit exceeded on submission', {
        errors: rateLimitResult.errors,
        recentGamesCount: recentRecords.length,
      });
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: rateLimitResult.errors,
        },
        { status: 429 }
      );
    }

    // 4. Session time validation (game duration should match session time)
    if (sessionResult.session) {
      const sessionDuration = Date.now() - sessionResult.session.startTime;
      const reportedDuration = time_ms || 0;

      // Allow some tolerance (session can be created slightly before game starts)
      // But reported duration should not exceed session duration by much
      if (reportedDuration > sessionDuration + 5000) {
        logSuspiciousActivity(wallet_address, 'Time manipulation detected', {
          sessionDuration,
          reportedDuration,
          difference: reportedDuration - sessionDuration,
        });
        return NextResponse.json(
          { error: 'Game duration exceeds session time' },
          { status: 400 }
        );
      }
    }

    // ========================================
    // VALIDATED - PROCEED WITH RECORD CREATION
    // ========================================

    // Get user profile ID
    const userId = await getUserIdByWallet(wallet_address);
    if (!userId) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Get active season (if any)
    const activeSeason = await getActiveSeason();

    // Calculate $CLUB rewards based on validated score and game stats
    const rewardResult = calculateClubRewards(game_type, submission.score, {
      feverCount: submission.fever_count || 0,
      perfectCount: submission.perfect_count || 0,
      coinCount: submission.coin_count || 0,
      potionCount: submission.potion_count || 0,
      difficulty: submission.difficulty || 'medium',
    });

    const clubEarned = rewardResult.totalReward;
    const luckEarned = 0; // Deprecated: using $CLUB instead

    // Build client info from request headers + client-provided data
    const serverClientInfo = extractClientInfo(request);
    const mergedClientInfo = {
      ...serverClientInfo,
      ...(clientInfoFromBody || {}),
    };

    // Calculate session duration
    const sessionDurationMs = sessionResult.session
      ? Date.now() - sessionResult.session.startTime
      : null;

    // Build game-specific metadata based on game_type
    // This structure can vary per game - stored as JSONB
    const gameMetadata = buildGameMetadata(game_type, submission);

    // Insert game record with full metadata
    const result = await createGameRecord({
      // Core fields
      user_id: userId,
      wallet_address,
      game_type,
      score: submission.score,
      distance: submission.distance,
      time_ms: submission.time_ms,
      luck_earned: luckEarned,
      club_earned: clubEarned,
      season_id: activeSeason?.id || null,

      // Game-specific metadata (JSONB - structure varies by game_type)
      game_metadata: gameMetadata,

      // Session & anti-cheat tracking (common to all games)
      session_token: session_token,
      session_start_time: sessionResult.session?.startTime,
      session_duration_ms: sessionDurationMs ?? undefined,
      validation_warnings:
        validationResult.warnings.length > 0
          ? validationResult.warnings
          : undefined,

      // Client info
      client_info: mergedClientInfo,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to save game record' },
        { status: 500 }
      );
    }

    // Update leaderboard (async, don't block response)
    updateLeaderboard(
      wallet_address,
      game_type,
      submission.score,
      submission.distance,
      clubEarned
    ).catch((err) => {
      console.error('Failed to update leaderboard:', err);
    });

    // Update quest progress (async, don't block response)
    Promise.all([
      updateQuestProgress(wallet_address, 'games_played_daily', 1),
      updateQuestProgress(wallet_address, 'games_played_weekly', 1),
      updateQuestProgress(wallet_address, 'first_game', 1),
    ]).catch((err: unknown) => {
      console.error('Failed to update quest progress:', err);
    });

    // Referral revenue share: Grant 1% of CLUB earnings to referrer
    if (clubEarned > 0) {
      processClubEarningShare(wallet_address, clubEarned).catch((err: unknown) => {
        console.error('Failed to grant referral revenue share:', err);
      });
    }

    return NextResponse.json({
      success: true,
      record: result.record,
      rewards: {
        club: clubEarned,
        breakdown: rewardResult.breakdown,
      },
    });
  } catch (error) {
    console.error('Game record API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/game/record?address=0x...&game_type=dash-trials&limit=10
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const gameType = searchParams.get('game_type');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!address) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 }
      );
    }

    const { records, highScore } = await getGameRecordsByUser(
      address,
      gameType || undefined,
      limit
    );

    return NextResponse.json({
      records,
      highScore,
    });
  } catch (error) {
    console.error('Game record API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
