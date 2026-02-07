/**
 * Leaderboard API
 *
 * GET: Get leaderboard rankings by game type and time filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard, type TimeFilter } from '@/lib/db';

// GET /api/game/leaderboard?game_type=dash-trials&filter=weekly&limit=50
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameType = searchParams.get('game_type') || 'dash-trials';
    const filter = (searchParams.get('filter') || 'weekly') as TimeFilter;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const userAddress = searchParams.get('address') || undefined;

    const result = await getLeaderboard(gameType, filter, userAddress, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
