/**
 * Global App Store
 *
 * Centralized state management for the app.
 * Data is fetched once on init and cached in memory.
 */

import { create } from 'zustand';

interface TicketData {
  dailyTickets: number;
  maxDailyTickets: number;
  starTickets: number;
  totalTickets: number;
  clubBalance: number;
}

interface ProfileData {
  id: string;
  wallet_address: string;
  nickname: string | null;
  avatar_url: string | null;
  email: string | null;
  google_email: string | null;
  google_name: string | null;
  google_picture: string | null;
  auth_method: 'wallet' | 'zklogin';
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

interface AppState {
  // Initialization state
  isInitialized: boolean;
  isInitializing: boolean;
  initError: string | null;

  // Data
  ticketData: TicketData | null;
  profile: ProfileData | null;
  leaderboard: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;

  // Actions
  init: (walletAddress: string, gameType?: string) => Promise<void>;
  refreshTickets: (walletAddress: string, gameType?: string) => Promise<void>;
  refreshProfile: (walletAddress: string) => Promise<void>;
  refreshLeaderboard: (gameType: string, filter?: string, walletAddress?: string) => Promise<void>;
  updateTicketsAfterUse: (result: {
    dailyTickets: number;
    starTickets: number;
    totalTickets: number;
  }) => void;
  addClubReward: (amount: number) => void;
  reset: () => void;
}

const DEFAULT_GAME_TYPE = 'dash-trials';

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isInitializing: false,
  initError: null,
  ticketData: null,
  profile: null,
  leaderboard: [],
  userRank: null,

  // Initialize all data at once
  init: async (walletAddress: string, gameType: string = DEFAULT_GAME_TYPE) => {
    const state = get();

    // Skip if already initialized or initializing
    if (state.isInitialized || state.isInitializing) {
      return;
    }

    set({ isInitializing: true, initError: null });

    try {
      // Fetch all data in parallel
      const [ticketRes, profileRes, leaderboardRes] = await Promise.all([
        fetch(`/api/game/ticket?address=${walletAddress}&game_type=${gameType}`),
        fetch(`/api/profile?address=${encodeURIComponent(walletAddress)}`),
        fetch(`/api/game/leaderboard?game_type=${gameType}&filter=weekly&address=${walletAddress}`),
      ]);

      // Process ticket data
      let ticketData: TicketData | null = null;
      if (ticketRes.ok) {
        const data = await ticketRes.json();
        ticketData = {
          dailyTickets: data.dailyTickets ?? 3,
          maxDailyTickets: data.maxDailyTickets ?? 3,
          starTickets: data.starTickets ?? 0,
          totalTickets: data.totalTickets ?? 3,
          clubBalance: data.clubBalance ?? 0,
        };
      }

      // Process profile data
      let profile: ProfileData | null = null;
      if (profileRes.ok) {
        const data = await profileRes.json();
        profile = data.profile || null;
      }

      // Process leaderboard data
      let leaderboard: LeaderboardEntry[] = [];
      let userRank: LeaderboardEntry | null = null;
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json();
        leaderboard = data.leaderboard || [];
        userRank = data.userRank || null;
      }

      set({
        isInitialized: true,
        isInitializing: false,
        ticketData,
        profile,
        leaderboard,
        userRank,
      });
    } catch (error) {
      console.error('App init error:', error);
      set({
        isInitializing: false,
        initError: error instanceof Error ? error.message : 'Failed to initialize',
      });
    }
  },

  // Refresh only ticket data
  refreshTickets: async (walletAddress: string, gameType: string = DEFAULT_GAME_TYPE) => {
    try {
      const res = await fetch(`/api/game/ticket?address=${walletAddress}&game_type=${gameType}`);
      if (res.ok) {
        const data = await res.json();
        set({
          ticketData: {
            dailyTickets: data.dailyTickets ?? 3,
            maxDailyTickets: data.maxDailyTickets ?? 3,
            starTickets: data.starTickets ?? 0,
            totalTickets: data.totalTickets ?? 3,
            clubBalance: data.clubBalance ?? 0,
          },
        });
      }
    } catch (error) {
      console.error('Refresh tickets error:', error);
    }
  },

  // Refresh only profile data
  refreshProfile: async (walletAddress: string) => {
    try {
      const res = await fetch(`/api/profile?address=${encodeURIComponent(walletAddress)}`);
      if (res.ok) {
        const data = await res.json();
        set({ profile: data.profile || null });
      }
    } catch (error) {
      console.error('Refresh profile error:', error);
    }
  },

  // Refresh leaderboard data
  refreshLeaderboard: async (
    gameType: string,
    filter: string = 'weekly',
    walletAddress?: string
  ) => {
    try {
      let url = `/api/game/leaderboard?game_type=${gameType}&filter=${filter}`;
      if (walletAddress) {
        url += `&address=${walletAddress}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        set({
          leaderboard: data.leaderboard || [],
          userRank: data.userRank || null,
        });
      }
    } catch (error) {
      console.error('Refresh leaderboard error:', error);
    }
  },

  // Update tickets after using one (optimistic update)
  updateTicketsAfterUse: (result) => {
    const state = get();
    if (state.ticketData) {
      set({
        ticketData: {
          ...state.ticketData,
          dailyTickets: result.dailyTickets,
          starTickets: result.starTickets,
          totalTickets: result.totalTickets,
        },
      });
    }
  },

  // Add CLUB reward after game (optimistic update)
  addClubReward: (amount: number) => {
    const state = get();
    if (state.ticketData) {
      set({
        ticketData: {
          ...state.ticketData,
          clubBalance: state.ticketData.clubBalance + amount,
        },
      });
    }
  },

  // Reset all state (on logout)
  reset: () => {
    set({
      isInitialized: false,
      isInitializing: false,
      initError: null,
      ticketData: null,
      profile: null,
      leaderboard: [],
      userRank: null,
    });
  },
}));
