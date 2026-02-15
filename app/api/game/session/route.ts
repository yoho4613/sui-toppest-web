/**
 * Game Session API
 *
 * POST: Create a new game session token (call before game starts)
 *
 * The session token must be submitted with the game record to prevent:
 * - Replay attacks (resubmitting the same results)
 * - Fabricated submissions (no actual game played)
 * - Rate limiting bypass
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createGameSession,
  getRecentGameRecords,
  getUserIdByWallet,
} from '@/lib/db';
import { checkRateLimit, logSuspiciousActivity } from '@/lib/anti-cheat';

// POST /api/game/session - Create a new game session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, game_type } = body;

    if (!wallet_address || !game_type) {
      return NextResponse.json(
        { error: 'Missing required fields: wallet_address, game_type' },
        { status: 400 }
      );
    }

    // Verify user exists
    const userId = await getUserIdByWallet(wallet_address);
    if (!userId) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check rate limits before creating session
    const recentRecords = await getRecentGameRecords(wallet_address, 24);
    const rateLimitResult = checkRateLimit(recentRecords);

    if (!rateLimitResult.valid) {
      logSuspiciousActivity(wallet_address, 'Rate limit exceeded', {
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

    // Create new session
    const result = await createGameSession(wallet_address, game_type);

    if (!result.success || !result.session) {
      return NextResponse.json(
        { error: result.error || 'Failed to create game session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session_token: result.session.sessionToken,
      expires_at: result.session.expiresAt,
    });
  } catch (error) {
    console.error('Game session API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
