/**
 * Leaderboard API
 *
 * GET: Get leaderboard rankings by game type and time filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard, type TimeFilter } from '@/lib/db';

// Disable Next.js caching for this route - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/game/leaderboard?game_type=dash-trials&filter=weekly&limit=50
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameType = searchParams.get('game_type') || 'dash-trials';
    const filter = (searchParams.get('filter') || 'weekly') as TimeFilter;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const userAddress = searchParams.get('address') || undefined;

    const result = await getLeaderboard(gameType, filter, userAddress, limit);

    // Disable caching to ensure fresh data after game completion
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
