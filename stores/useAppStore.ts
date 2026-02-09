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

// Shop types
export interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_usd: number;
  price_sui: number;
  price_sui_mist: string;
  price_luck: number;
  reward_type: string;
  reward_amount: number;
  badge: string | null;
  bonus_text: string | null;
}

export type PaymentMethod = 'sui' | 'luck';
export type PurchaseStatus = 'idle' | 'creating' | 'signing' | 'verifying' | 'success' | 'error';

interface PaymentPopupState {
  isOpen: boolean;
  product: ShopProduct | null;
  paymentMethod: PaymentMethod;
  status: PurchaseStatus;
  error: string | null;
  txDigest: string | null;
  reward: { type: string; amount: number } | null;
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

  // Shop data
  products: ShopProduct[];
  paymentPopup: PaymentPopupState;

  // Balance refresh trigger (increment to force header refresh)
  balanceRefreshTrigger: number;

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
  addStarTickets: (amount: number) => void;
  reset: () => void;

  // Shop actions
  fetchProducts: () => Promise<void>;
  openPaymentPopup: (product: ShopProduct, method?: PaymentMethod) => void;
  closePaymentPopup: () => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setPaymentStatus: (status: PurchaseStatus, error?: string | null, txDigest?: string | null, reward?: { type: string; amount: number } | null) => void;

  // Balance actions
  triggerBalanceRefresh: () => void;
}

const DEFAULT_GAME_TYPE = 'dash-trials';

const DEFAULT_PAYMENT_POPUP: PaymentPopupState = {
  isOpen: false,
  product: null,
  paymentMethod: 'sui',
  status: 'idle',
  error: null,
  txDigest: null,
  reward: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isInitializing: false,
  initError: null,
  ticketData: null,
  profile: null,
  leaderboard: [],
  userRank: null,
  products: [],
  paymentPopup: DEFAULT_PAYMENT_POPUP,
  balanceRefreshTrigger: 0,

  // Initialize all data at once
  init: async (walletAddress: string, gameType: string = DEFAULT_GAME_TYPE) => {
    const state = get();

    // Skip if already initialized or initializing
    if (state.isInitialized || state.isInitializing) {
      return;
    }

    set({ isInitializing: true, initError: null });

    try {
      // Fetch all data in parallel (including shop products)
      const [ticketRes, profileRes, leaderboardRes, productsRes] = await Promise.all([
        fetch(`/api/game/ticket?address=${walletAddress}&game_type=${gameType}`),
        fetch(`/api/profile?address=${encodeURIComponent(walletAddress)}`),
        fetch(`/api/game/leaderboard?game_type=${gameType}&filter=weekly&address=${walletAddress}`),
        fetch('/api/shop/products'),
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

      // Process shop products
      let products: ShopProduct[] = [];
      if (productsRes.ok) {
        const data = await productsRes.json();
        products = data.products || [];
      }

      set({
        isInitialized: true,
        isInitializing: false,
        ticketData,
        profile,
        leaderboard,
        userRank,
        products,
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

  // Add star tickets after purchase (optimistic update)
  addStarTickets: (amount: number) => {
    const state = get();
    if (state.ticketData) {
      set({
        ticketData: {
          ...state.ticketData,
          starTickets: state.ticketData.starTickets + amount,
          totalTickets: state.ticketData.totalTickets + amount,
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
      products: [],
      paymentPopup: DEFAULT_PAYMENT_POPUP,
    });
  },

  // Shop actions
  fetchProducts: async () => {
    try {
      const res = await fetch('/api/shop/products');
      if (res.ok) {
        const data = await res.json();
        set({ products: data.products || [] });
      }
    } catch (error) {
      console.error('Fetch products error:', error);
    }
  },

  openPaymentPopup: (product: ShopProduct, method: PaymentMethod = 'sui') => {
    set({
      paymentPopup: {
        ...DEFAULT_PAYMENT_POPUP,
        isOpen: true,
        product,
        paymentMethod: method,
      },
    });
  },

  closePaymentPopup: () => {
    set({ paymentPopup: DEFAULT_PAYMENT_POPUP });
  },

  setPaymentMethod: (method: PaymentMethod) => {
    const state = get();
    set({
      paymentPopup: {
        ...state.paymentPopup,
        paymentMethod: method,
      },
    });
  },

  setPaymentStatus: (status: PurchaseStatus, error?: string | null, txDigest?: string | null, reward?: { type: string; amount: number } | null) => {
    const state = get();
    set({
      paymentPopup: {
        ...state.paymentPopup,
        status,
        error: error ?? null,
        txDigest: txDigest ?? null,
        reward: reward ?? null,
      },
    });
  },

  // Trigger balance refresh (called after successful payment)
  triggerBalanceRefresh: () => {
    const state = get();
    set({ balanceRefreshTrigger: state.balanceRefreshTrigger + 1 });
  },
}));
