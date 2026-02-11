/**
 * Referral API Route
 *
 * POST: Create referral relationship
 * GET: Get user's referrals and stats
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createReferral,
  getReferralsByWallet,
  getReferralStats,
  getUserReferralCode,
} from '@/lib/db';
import { isValidSuiAddress } from '@/lib/referral';

// POST /api/referral - Create referral relationship
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referrerCode, referredWallet } = body as {
      referrerCode: string;  // referral_code (e.g., "CLUB7X9K") or wallet address
      referredWallet: string;
    };

    // Validate input
    if (!referrerCode || !referredWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: referrerCode, referredWallet' },
        { status: 400 }
      );
    }

    // Validate referrer: either referral_code (CLUB...) or wallet address (0x...)
    const isReferralCode = referrerCode.startsWith('CLUB') && referrerCode.length === 8;
    if (!isReferralCode && !isValidSuiAddress(referrerCode)) {
      return NextResponse.json(
        { error: 'Invalid referrer code or wallet address' },
        { status: 400 }
      );
    }

    if (!isValidSuiAddress(referredWallet)) {
      return NextResponse.json(
        { error: 'Invalid referred wallet address' },
        { status: 400 }
      );
    }

    // Create referral (RPC function handles self-referral check)
    const result = await createReferral(referrerCode, referredWallet);

    if (!result.success) {
      // Map error reasons to user-friendly messages
      const errorMessages: Record<string, string> = {
        self_referral: 'Cannot refer yourself',
        already_referred: 'User has already been referred',
        not_new_user: 'Referral bonus is only available for new users',
        referrer_not_found: 'Referrer not found',
        referred_user_not_found: 'User not found',
        database_error: 'Database error',
      };

      return NextResponse.json(
        {
          success: false,
          error: errorMessages[result.reason || ''] || 'Failed to create referral',
          reason: result.reason,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      referralId: result.referralId,
      reward: {
        club: result.clubReward,
        tickets: result.ticketReward,
      },
    });
  } catch (error) {
    console.error('Referral API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/referral?wallet=0x...&page=0&limit=50
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const page = parseInt(searchParams.get('page') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet parameter' },
        { status: 400 }
      );
    }

    if (!isValidSuiAddress(wallet)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Fetch referrals, stats, and referral code in parallel
    const [referrals, stats, referralCode] = await Promise.all([
      getReferralsByWallet(wallet, page, limit),
      getReferralStats(wallet),
      getUserReferralCode(wallet),
    ]);

    return NextResponse.json({
      referralCode,
      referrals: referrals.map((r) => ({
        id: r.id,
        walletAddress: r.referred_wallet,
        nickname: r.nickname,
        avatarUrl: r.avatar_url,
        clubReward: r.invitee_club_reward,
        ticketReward: r.invitee_ticket_reward,
        revenueShare: r.revenue_share_club,
        joinedAt: r.created_at,
      })),
      stats: {
        totalCount: stats.totalCount,
        totalSignupRewards: stats.totalSignupRewards,
        totalRevenueShare: stats.totalRevenueShare,
      },
      pagination: {
        page,
        limit,
        hasMore: referrals.length === limit,
      },
    });
  } catch (error) {
    console.error('Referral API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
