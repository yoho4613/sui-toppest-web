/**
 * Daily Tickets Database Queries
 *
 * Tickets are stored in user_profiles table (daily_tickets, last_ticket_reset)
 * - All users get 3 tickets per day
 * - Tickets are shared across all games
 * - Tickets reset at UTC 00:00
 */

import { supabaseAdmin } from '@/lib/supabase';

const MAX_DAILY_TICKETS = 3;

export interface TicketStatus {
  canPlay: boolean;
  remainingTickets: number;
  maxTickets: number;
  ticketsUsed: number;
  date: string;
}

export interface UseTicketResult {
  success: boolean;
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
 * gameType parameter is kept for API compatibility but ignored (tickets are shared)
 */
export async function checkTicketStatus(
  walletAddress: string,
  _gameType?: string
): Promise<TicketStatus> {
  const today = getTodayDate();

  if (!supabaseAdmin) {
    return {
      canPlay: true,
      remainingTickets: MAX_DAILY_TICKETS,
      maxTickets: MAX_DAILY_TICKETS,
      ticketsUsed: 0,
      date: today,
    };
  }

  // Get user profile with ticket info
  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select('daily_tickets, last_ticket_reset')
    .eq('wallet_address', walletAddress)
    .single();

  if (error || !profile) {
    // User doesn't exist yet - they'll get full tickets when profile is created
    return {
      canPlay: true,
      remainingTickets: MAX_DAILY_TICKETS,
      maxTickets: MAX_DAILY_TICKETS,
      ticketsUsed: 0,
      date: today,
    };
  }

  // Check if tickets need to be reset (new day in UTC)
  const lastReset = profile.last_ticket_reset;
  if (lastReset !== today) {
    // Auto-reset tickets for new day
    await supabaseAdmin
      .from('user_profiles')
      .update({
        daily_tickets: MAX_DAILY_TICKETS,
        last_ticket_reset: today,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress);

    return {
      canPlay: true,
      remainingTickets: MAX_DAILY_TICKETS,
      maxTickets: MAX_DAILY_TICKETS,
      ticketsUsed: 0,
      date: today,
    };
  }

  const remainingTickets = profile.daily_tickets ?? MAX_DAILY_TICKETS;
  const ticketsUsed = MAX_DAILY_TICKETS - remainingTickets;

  return {
    canPlay: remainingTickets > 0,
    remainingTickets,
    maxTickets: MAX_DAILY_TICKETS,
    ticketsUsed,
    date: today,
  };
}

/**
 * Use a ticket (decrement remaining tickets)
 * gameType parameter is kept for API compatibility but ignored (tickets are shared)
 */
export async function useTicket(
  walletAddress: string,
  _gameType?: string
): Promise<UseTicketResult> {
  const today = getTodayDate();

  if (!supabaseAdmin) {
    return {
      success: false,
      remainingTickets: 0,
      ticketsUsed: 0,
      error: 'Database not configured',
    };
  }

  // Get current ticket status (this also handles reset if needed)
  const status = await checkTicketStatus(walletAddress);

  if (!status.canPlay || status.remainingTickets <= 0) {
    return {
      success: false,
      remainingTickets: 0,
      ticketsUsed: MAX_DAILY_TICKETS,
      error: 'No tickets remaining for today',
    };
  }

  // Decrement ticket count
  const newTicketCount = status.remainingTickets - 1;
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      daily_tickets: newTicketCount,
      last_ticket_reset: today,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet_address', walletAddress);

  if (error) {
    console.error('Ticket use error:', error);
    return {
      success: false,
      remainingTickets: status.remainingTickets,
      ticketsUsed: status.ticketsUsed,
      error: 'Failed to use ticket',
    };
  }

  return {
    success: true,
    remainingTickets: newTicketCount,
    ticketsUsed: MAX_DAILY_TICKETS - newTicketCount,
  };
}

/**
 * Get ticket usage summary for a user (for analytics)
 * Note: This now just returns current day's usage since we don't track history
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

/**
 * Add tickets to a user (for purchases, rewards, etc.)
 */
export async function addTickets(
  walletAddress: string,
  amount: number
): Promise<{ success: boolean; newTotal: number; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, newTotal: 0, error: 'Database not configured' };
  }

  // Get current ticket count
  const { data: profile, error: fetchError } = await supabaseAdmin
    .from('user_profiles')
    .select('daily_tickets')
    .eq('wallet_address', walletAddress)
    .single();

  if (fetchError || !profile) {
    return { success: false, newTotal: 0, error: 'User not found' };
  }

  const currentTickets = profile.daily_tickets ?? 0;
  const newTotal = currentTickets + amount;

  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      daily_tickets: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet_address', walletAddress);

  if (updateError) {
    console.error('Add tickets error:', updateError);
    return { success: false, newTotal: currentTickets, error: 'Failed to add tickets' };
  }

  return { success: true, newTotal };
}
