/**
 * Hook for game-related API calls
 */

import { useState, useCallback } from 'react';

export interface TicketStatus {
  canPlay: boolean;
  remainingTickets: number;
  maxTickets: number;
  ticketsUsed: number;
  date: string;
}

interface GameRecordInput {
  wallet_address: string;
  game_type: string;
  score: number;
  distance: number;
  time_ms: number;
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
  const [error, setError] = useState<string | null>(null);

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
  ): Promise<{ success: boolean; remainingTickets: number; ticketsUsed: number } | null> => {
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
          remainingTickets: data.remainingTickets ?? 0,
          ticketsUsed: data.ticketsUsed ?? 3,
        };
      }

      return {
        success: true,
        remainingTickets: data.remainingTickets,
        ticketsUsed: data.ticketsUsed,
      };
    } catch (err) {
      console.error('Use ticket error:', err);
      setError('Network error');
      // Allow play on network error (graceful degradation)
      return {
        success: true,
        remainingTickets: 2,
        ticketsUsed: 1,
      };
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  // Save game record
  const saveGameRecord = useCallback(async (
    record: GameRecordInput
  ): Promise<{ success: boolean; rewards?: { luck: number; club: number } } | null> => {
    try {
      setIsLoadingGame(true);
      setError(null);

      const response = await fetch('/api/game/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Save game record error:', data.error);
        setError(data.error || 'Failed to save game record');
        return { success: false };
      }

      return {
        success: true,
        rewards: data.rewards,
      };
    } catch (err) {
      console.error('Save game record error:', err);
      setError('Network error');
      return { success: false };
    } finally {
      setIsLoadingGame(false);
    }
  }, []);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async (
    gameType: string,
    filter: 'daily' | 'weekly' | 'alltime' = 'weekly',
    userAddress?: string
  ): Promise<LeaderboardData | null> => {
    try {
      setIsLoadingLeaderboard(true);
      setError(null);

      let url = `/api/game/leaderboard?game_type=${gameType}&filter=${filter}`;
      if (userAddress) {
        url += `&address=${userAddress}`;
      }

      const response = await fetch(url);

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
    isLoading: isLoadingTickets || isLoadingGame || isLoadingLeaderboard,
    isLoadingTickets,
    isLoadingGame,
    isLoadingLeaderboard,
    error,
    // Methods
    checkTickets,
    useTicket,
    saveGameRecord,
    fetchLeaderboard,
  };
}
