/**
 * Game Record API
 *
 * POST: Save game record after game ends
 * GET: Get user's game history
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createGameRecord,
  getGameRecordsByUser,
  getUserIdByWallet,
  getActiveSeason,
} from '@/lib/db';

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
    } = body;

    if (!wallet_address || !game_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

    // Calculate rewards (can be adjusted later)
    const luckEarned = Math.floor(score / 100); // 1 LUCK per 100 score
    const clubEarned = 0; // Reserved for future use

    // Insert game record
    const result = await createGameRecord({
      user_id: userId,
      wallet_address,
      game_type,
      score,
      distance: distance || 0,
      time_ms: time_ms || 0,
      luck_earned: luckEarned,
      club_earned: clubEarned,
      season_id: activeSeason?.id || null,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to save game record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      record: result.record,
      rewards: {
        luck: luckEarned,
        club: clubEarned,
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
