/**
 * Hook for game-related API calls
 *
 * Anti-Cheat Flow:
 * 1. Call startGameSession() before starting a game
 * 2. Store the returned session_token
 * 3. Pass session_token when calling saveGameRecord()
 */

import { useState, useCallback, useRef } from 'react';

export interface TicketStatus {
  canPlay: boolean;
  // Daily tickets
  dailyTickets: number;
  maxDailyTickets: number;
  // Star tickets (bonus)
  starTickets: number;
  // Total
  totalTickets: number;
  // $CLUB balance
  clubBalance: number;
  // Legacy fields for compatibility
  remainingTickets: number;
  maxTickets: number;
  ticketsUsed: number;
  date: string;
}

export interface GameSession {
  session_token: string;
  expires_at: number;
}

export interface UseTicketResult {
  success: boolean;
  dailyTickets: number;
  starTickets: number;
  totalTickets: number;
  usedType?: 'daily' | 'star';
  remainingTickets: number;
  ticketsUsed: number;
}

interface GameRecordInput {
  wallet_address: string;
  game_type: string;
  score: number;
  distance: number;
  time_ms: number;
  // Additional stats for $CLUB reward calculation
  fever_count?: number;
  perfect_count?: number;
  coin_count?: number;
  potion_count?: number;
  difficulty?: string;
  // Anti-cheat: session token from startGameSession()
  session_token?: string;
}

interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  high_score: number;
  distance: number;
  display_name: string;
  avatar_url: string | null;
  games_played: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  filter: string;
  gameType: string;
  totalPlayers: number;
}

export function useGameAPI() {
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store current game session token
  const currentSessionRef = useRef<GameSession | null>(null);

  // Check ticket status
  const checkTickets = useCallback(async (
    walletAddress: string,
    gameType: string
  ): Promise<TicketStatus | null> => {
    try {
      setIsLoadingTickets(true);
      setError(null);

      const response = await fetch(
        `/api/game/ticket?address=${walletAddress}&game_type=${gameType}`
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to check tickets');
        // Return default values on error
        return {
          canPlay: true,
          dailyTickets: 3,
          maxDailyTickets: 3,
          starTickets: 0,
          totalTickets: 3,
          clubBalance: 0,
          remainingTickets: 3,
          maxTickets: 3,
          ticketsUsed: 0,
          date: new Date().toISOString().split('T')[0],
        };
      }

      return await response.json();
    } catch (err) {
      console.error('Check tickets error:', err);
      setError('Network error');
      // Return default values on network error
      return {
        canPlay: true,
        dailyTickets: 3,
        maxDailyTickets: 3,
        starTickets: 0,
        totalTickets: 3,
        clubBalance: 0,
        remainingTickets: 3,
        maxTickets: 3,
        ticketsUsed: 0,
        date: new Date().toISOString().split('T')[0],
      };
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  // Use a ticket (call before game starts)
  const useTicket = useCallback(async (
    walletAddress: string,
    gameType: string
  ): Promise<UseTicketResult | null> => {
    try {
      setIsLoadingTickets(true);
      setError(null);

      const response = await fetch('/api/game/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          game_type: gameType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to use ticket');
        return {
          success: false,
          dailyTickets: data.dailyTickets ?? 0,
          starTickets: data.starTickets ?? 0,
          totalTickets: data.totalTickets ?? 0,
          remainingTickets: data.remainingTickets ?? 0,
          ticketsUsed: data.ticketsUsed ?? 3,
        };
      }

      return {
        success: true,
        dailyTickets: data.dailyTickets,
        starTickets: data.starTickets,
        totalTickets: data.totalTickets,
        usedType: data.usedType,
        remainingTickets: data.remainingTickets,
        ticketsUsed: data.ticketsUsed,
      };
    } catch (err) {
      console.error('Use ticket error:', err);
      setError('Network error');
      // Allow play on network error (graceful degradation)
      return {
        success: true,
        dailyTickets: 2,
        starTickets: 0,
        totalTickets: 2,
        remainingTickets: 2,
        ticketsUsed: 1,
      };
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  // Start a game session (call before game starts)
  // Returns a session token that must be passed to saveGameRecord
  const startGameSession = useCallback(async (
    walletAddress: string,
    gameType: string
  ): Promise<GameSession | null> => {
    try {
      setIsLoadingSession(true);
      setError(null);

      const response = await fetch('/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          game_type: gameType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Start game session error:', data.error);
        setError(data.error || 'Failed to start game session');
        return null;
      }

      const session: GameSession = {
        session_token: data.session_token,
        expires_at: data.expires_at,
      };

      // Store session for later use
      currentSessionRef.current = session;

      return session;
    } catch (err) {
      console.error('Start game session error:', err);
      setError('Network error');
      return null;
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  // Get current session token (if exists and not expired)
  const getCurrentSession = useCallback((): string | null => {
    const session = currentSessionRef.current;
    if (!session) return null;

    // Check if session is expired
    if (Date.now() > session.expires_at) {
      currentSessionRef.current = null;
      return null;
    }

    return session.session_token;
  }, []);

  // Clear current session (call after game ends)
  const clearSession = useCallback(() => {
    currentSessionRef.current = null;
  }, []);

  // Save game record
  // Automatically includes session token if available
  const saveGameRecord = useCallback(async (
    record: GameRecordInput
  ): Promise<{ success: boolean; rewards?: { luck: number; club: number }; error?: string } | null> => {
    try {
      setIsLoadingGame(true);
      setError(null);

      // Include session token if not provided and available
      const sessionToken = record.session_token || getCurrentSession();

      const response = await fetch('/api/game/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...record,
          session_token: sessionToken,
        }),
      });

      const data = await response.json();

      // Clear session after submission (whether successful or not)
      clearSession();

      if (!response.ok) {
        console.error('Save game record error:', data.error, data.details);
        setError(data.error || 'Failed to save game record');
        return { success: false, error: data.error };
      }

      return {
        success: true,
        rewards: data.rewards,
      };
    } catch (err) {
      console.error('Save game record error:', err);
      setError('Network error');
      clearSession();
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoadingGame(false);
    }
  }, [getCurrentSession, clearSession]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async (
    gameType: string,
    filter: 'daily' | 'weekly' | 'alltime' = 'weekly',
    userAddress?: string
  ): Promise<LeaderboardData | null> => {
    try {
      setIsLoadingLeaderboard(true);
      setError(null);

      // Add cache-busting timestamp to ensure fresh data after game
      let url = `/api/game/leaderboard?game_type=${gameType}&filter=${filter}&_t=${Date.now()}`;
      if (userAddress) {
        url += `&address=${userAddress}`;
      }

      const response = await fetch(url, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to fetch leaderboard');
        return null;
      }

      return await response.json();
    } catch (err) {
      console.error('Fetch leaderboard error:', err);
      setError('Network error');
      return null;
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, []);

  return {
    // Loading states
    isLoading: isLoadingTickets || isLoadingGame || isLoadingLeaderboard || isLoadingSession,
    isLoadingTickets,
    isLoadingGame,
    isLoadingLeaderboard,
    isLoadingSession,
    error,
    // Methods
    checkTickets,
    useTicket,
    startGameSession,
    getCurrentSession,
    clearSession,
    saveGameRecord,
    fetchLeaderboard,
  };
}
