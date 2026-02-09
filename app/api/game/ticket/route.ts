/**
 * Game Ticket API
 *
 * GET: Check remaining tickets (daily + star)
 * POST: Use a ticket (daily first, then star)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkTicketStatus, useTicket, getUserTotalClub } from '@/lib/db';

// GET /api/game/ticket?address=0x...&game_type=dash-trials
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const gameType = searchParams.get('game_type');

    if (!address || !gameType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const [status, totalClub] = await Promise.all([
      checkTicketStatus(address, gameType),
      getUserTotalClub(address),
    ]);

    return NextResponse.json({
      ...status,
      clubBalance: totalClub,
    });
  } catch (error) {
    console.error('Ticket check API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/game/ticket - Use a ticket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, game_type } = body;

    if (!wallet_address || !game_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await useTicket(wallet_address, game_type);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'No tickets remaining',
          canPlay: false,
          dailyTickets: result.dailyTickets,
          starTickets: result.starTickets,
          totalTickets: result.totalTickets,
          remainingTickets: result.remainingTickets,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      canPlay: true,
      dailyTickets: result.dailyTickets,
      starTickets: result.starTickets,
      totalTickets: result.totalTickets,
      usedType: result.usedType,
      remainingTickets: result.remainingTickets,
      ticketsUsed: result.ticketsUsed,
    });
  } catch (error) {
    console.error('Ticket use API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
