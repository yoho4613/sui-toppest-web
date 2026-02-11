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
  updateLeaderboard,
  updateQuestProgress,
  grantRevenueShare,
} from '@/lib/db';
import { calculateClubRewards } from '@/lib/rewards/club-rewards';
import { REFERRAL_REVENUE_SHARE } from '@/lib/constants';

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

    // Calculate $CLUB rewards based on score and game stats
    const rewardResult = calculateClubRewards(game_type, score, {
      feverCount: fever_count || 0,
      perfectCount: perfect_count || 0,
      coinCount: coin_count || 0,
      potionCount: potion_count || 0,
      difficulty: difficulty || 'medium',
    });

    const clubEarned = rewardResult.totalReward;
    const luckEarned = 0; // Deprecated: using $CLUB instead

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

    // Update leaderboard (async, don't block response)
    updateLeaderboard(
      wallet_address,
      game_type,
      score || 0,
      distance || 0,
      clubEarned
    ).catch((err) => {
      console.error('Failed to update leaderboard:', err);
    });

    // Update quest progress (async, don't block response)
    Promise.all([
      updateQuestProgress(wallet_address, 'games_played_daily', 1),
      updateQuestProgress(wallet_address, 'games_played_weekly', 1),
      updateQuestProgress(wallet_address, 'first_game', 1),
    ]).catch((err) => {
      console.error('Failed to update quest progress:', err);
    });

    // Referral revenue share: Grant 1% of CLUB earnings to referrer
    if (clubEarned > 0) {
      const shareAmount = Math.floor(
        clubEarned * REFERRAL_REVENUE_SHARE.earningSharePercent / 100
      );
      if (shareAmount > 0) {
        grantRevenueShare(wallet_address, shareAmount).catch((err) => {
          console.error('Failed to grant referral revenue share:', err);
        });
      }
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
