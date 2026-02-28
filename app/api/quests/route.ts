/**
 * Quests API
 *
 * GET: Get all quests with user's progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQuestsForUser, syncQuestProgress } from '@/lib/db';

// Disable Next.js caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/quests?address=0x...&sync=true
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const shouldSync = searchParams.get('sync') === 'true';

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Only sync quest progress when explicitly requested (page navigation, game end)
    if (shouldSync) {
      await syncQuestProgress(address);
    }

    // Get quests with current progress
    const result = await getQuestsForUser(address);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to fetch quests' },
        { status: 500 }
      );
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Quests API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
