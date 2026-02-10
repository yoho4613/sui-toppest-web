/**
 * Quest Claim API
 *
 * POST: Claim a completed quest's reward
 */

import { NextRequest, NextResponse } from 'next/server';
import { claimQuestReward } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questId, walletAddress } = body as {
      questId: string;
      walletAddress: string;
    };

    // Validate input
    if (!questId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: questId, walletAddress' },
        { status: 400 }
      );
    }

    // Claim the reward
    const result = await claimQuestReward(walletAddress, questId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to claim reward' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      reward: result.reward,
    });
  } catch (error) {
    console.error('Quest claim error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
