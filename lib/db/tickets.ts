/**
 * Daily Tickets & Star Tickets Database Queries
 *
 * Two ticket types:
 * 1. Daily Tickets: 3 per day, reset at UTC 00:00
 * 2. Star Tickets: Bonus tickets that don't reset (earned/purchased)
 *
 * Usage priority: Daily tickets first, then Star tickets
 */

import { supabaseAdmin } from '@/lib/supabase';

const MAX_DAILY_TICKETS = 3;

export interface TicketStatus {
  canPlay: boolean;
  // Daily tickets
  dailyTickets: number;
  maxDailyTickets: number;
  // Star tickets (bonus)
  starTickets: number;
  // Total
  totalTickets: number;
  // Legacy fields for compatibility
  remainingTickets: number;
  maxTickets: number;
  ticketsUsed: number;
  date: string;
}

export interface UseTicketResult {
  success: boolean;
  dailyTickets: number;
  starTickets: number;
  totalTickets: number;
  usedType: 'daily' | 'star';
  // Legacy fields
  remainingTickets: number;
  ticketsUsed: number;
  error?: string;
}

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check ticket status for a user
 */
export async function checkTicketStatus(
  walletAddress: string,
  _gameType?: string
): Promise<TicketStatus> {
  const today = getTodayDate();

  if (!supabaseAdmin) {
    return {
      canPlay: true,
      dailyTickets: MAX_DAILY_TICKETS,
      maxDailyTickets: MAX_DAILY_TICKETS,
      starTickets: 0,
      totalTickets: MAX_DAILY_TICKETS,
      remainingTickets: MAX_DAILY_TICKETS,
      maxTickets: MAX_DAILY_TICKETS,
      ticketsUsed: 0,
      date: today,
    };
  }

  // Get user profile with ticket info
  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select('daily_tickets, star_tickets, last_ticket_reset')
    .eq('wallet_address', walletAddress)
    .single();

  if (error || !profile) {
    // User doesn't exist yet - they'll get full tickets when profile is created
    return {
      canPlay: true,
      dailyTickets: MAX_DAILY_TICKETS,
      maxDailyTickets: MAX_DAILY_TICKETS,
      starTickets: 0,
      totalTickets: MAX_DAILY_TICKETS,
      remainingTickets: MAX_DAILY_TICKETS,
      maxTickets: MAX_DAILY_TICKETS,
      ticketsUsed: 0,
      date: today,
    };
  }

  let dailyTickets = profile.daily_tickets ?? MAX_DAILY_TICKETS;
  const starTickets = profile.star_tickets ?? 0;

  // Check if daily tickets need to be reset (new day in UTC)
  const lastReset = profile.last_ticket_reset;
  if (lastReset !== today) {
    // Auto-reset daily tickets for new day (star tickets remain unchanged)
    dailyTickets = MAX_DAILY_TICKETS;
    await supabaseAdmin
      .from('user_profiles')
      .update({
        daily_tickets: MAX_DAILY_TICKETS,
        last_ticket_reset: today,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress);
  }

  const totalTickets = dailyTickets + starTickets;
  const ticketsUsed = MAX_DAILY_TICKETS - dailyTickets;

  return {
    canPlay: totalTickets > 0,
    dailyTickets,
    maxDailyTickets: MAX_DAILY_TICKETS,
    starTickets,
    totalTickets,
    remainingTickets: totalTickets,
    maxTickets: MAX_DAILY_TICKETS,
    ticketsUsed,
    date: today,
  };
}

/**
 * Use a ticket (daily first, then star tickets)
 */
export async function useTicket(
  walletAddress: string,
  _gameType?: string
): Promise<UseTicketResult> {
  const today = getTodayDate();

  if (!supabaseAdmin) {
    return {
      success: false,
      dailyTickets: 0,
      starTickets: 0,
      totalTickets: 0,
      usedType: 'daily',
      remainingTickets: 0,
      ticketsUsed: 0,
      error: 'Database not configured',
    };
  }

  // Get current ticket status (this also handles reset if needed)
  const status = await checkTicketStatus(walletAddress);

  if (!status.canPlay || status.totalTickets <= 0) {
    return {
      success: false,
      dailyTickets: status.dailyTickets,
      starTickets: status.starTickets,
      totalTickets: 0,
      usedType: 'daily',
      remainingTickets: 0,
      ticketsUsed: MAX_DAILY_TICKETS,
      error: 'No tickets remaining',
    };
  }

  let newDailyTickets = status.dailyTickets;
  let newStarTickets = status.starTickets;
  let usedType: 'daily' | 'star' = 'daily';

  // Use daily ticket first, then star ticket
  if (status.dailyTickets > 0) {
    newDailyTickets = status.dailyTickets - 1;
    usedType = 'daily';
  } else if (status.starTickets > 0) {
    newStarTickets = status.starTickets - 1;
    usedType = 'star';
  }

  // Update database
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      daily_tickets: newDailyTickets,
      star_tickets: newStarTickets,
      last_ticket_reset: today,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet_address', walletAddress);

  if (error) {
    console.error('Ticket use error:', error);
    return {
      success: false,
      dailyTickets: status.dailyTickets,
      starTickets: status.starTickets,
      totalTickets: status.totalTickets,
      usedType,
      remainingTickets: status.totalTickets,
      ticketsUsed: status.ticketsUsed,
      error: 'Failed to use ticket',
    };
  }

  const newTotal = newDailyTickets + newStarTickets;

  return {
    success: true,
    dailyTickets: newDailyTickets,
    starTickets: newStarTickets,
    totalTickets: newTotal,
    usedType,
    remainingTickets: newTotal,
    ticketsUsed: MAX_DAILY_TICKETS - newDailyTickets,
  };
}

/**
 * Add star tickets to a user (for purchases, rewards, etc.)
 */
export async function addStarTickets(
  walletAddress: string,
  amount: number
): Promise<{ success: boolean; newTotal: number; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, newTotal: 0, error: 'Database not configured' };
  }

  // Get current star ticket count
  const { data: profile, error: fetchError } = await supabaseAdmin
    .from('user_profiles')
    .select('star_tickets')
    .eq('wallet_address', walletAddress)
    .single();

  if (fetchError || !profile) {
    return { success: false, newTotal: 0, error: 'User not found' };
  }

  const currentStarTickets = profile.star_tickets ?? 0;
  const newTotal = currentStarTickets + amount;

  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      star_tickets: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet_address', walletAddress);

  if (updateError) {
    console.error('Add star tickets error:', updateError);
    return { success: false, newTotal: currentStarTickets, error: 'Failed to add star tickets' };
  }

  return { success: true, newTotal };
}

/**
 * Add daily tickets (legacy function - redirects to star tickets for bonus)
 */
export async function addTickets(
  walletAddress: string,
  amount: number
): Promise<{ success: boolean; newTotal: number; error?: string }> {
  // For compatibility, adding tickets now adds star tickets
  return addStarTickets(walletAddress, amount);
}

/**
 * Get ticket usage summary for a user (for analytics)
 */
export async function getTicketUsageSummary(
  walletAddress: string,
  _days: number = 7
): Promise<{ date: string; ticketsUsed: number }[]> {
  const status = await checkTicketStatus(walletAddress);

  return [{
    date: status.date,
    ticketsUsed: status.ticketsUsed,
  }];
}
