/**
 * Referral Database Functions
 */

import { supabaseAdmin } from '@/lib/supabase';
import { REFERRAL_REWARDS, REFERRAL_REVENUE_SHARE } from '@/lib/constants';

// ============================================
// Types
// ============================================

export interface Referral {
  id: string;
  referrer_wallet: string;
  referred_wallet: string;
  invitee_club_reward: number;
  invitee_ticket_reward: number;
  revenue_share_club: number;
  status: 'pending' | 'completed';
  created_at: string;
}

export interface ReferralWithUser extends Referral {
  nickname?: string;
  avatar_url?: string;
}

export interface ReferralStats {
  totalCount: number;
  totalSignupRewards: number;
  totalRevenueShare: number;
}

export interface CreateReferralResult {
  success: boolean;
  reason?: string;
  referralId?: string;
  referrerWallet?: string;
  clubReward?: number;
  ticketReward?: number;
}

// ============================================
// Create Referral
// ============================================

/**
 * 레퍼럴 관계 생성 (RPC 함수 호출)
 * @param referrerCode - referral_code (예: "CLUB7X9K") 또는 wallet address
 * @param referredWallet - 피초대자의 wallet address
 */
export async function createReferral(
  referrerCode: string,
  referredWallet: string
): Promise<CreateReferralResult> {
  if (!supabaseAdmin) {
    return { success: false, reason: 'database_not_configured' };
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('create_referral', {
      p_referrer_code: referrerCode,
      p_referred_wallet: referredWallet,
      p_club_reward: REFERRAL_REWARDS.invitee.club,
      p_ticket_reward: REFERRAL_REWARDS.invitee.bonusTickets,
    });

    if (error) {
      console.error('Create referral error:', error);
      return { success: false, reason: 'database_error' };
    }

    const result = data as {
      success: boolean;
      reason?: string;
      referral_id?: string;
      referrer_wallet?: string;
      club_reward?: number;
      ticket_reward?: number;
    };

    return {
      success: result.success,
      reason: result.reason,
      referralId: result.referral_id,
      referrerWallet: result.referrer_wallet,
      clubReward: result.club_reward,
      ticketReward: result.ticket_reward,
    };
  } catch (error) {
    console.error('Create referral exception:', error);
    return { success: false, reason: 'exception' };
  }
}

// ============================================
// Get Referrals
// ============================================

/**
 * 내 레퍼럴 목록 조회
 */
export async function getReferralsByWallet(
  walletAddress: string,
  page = 0,
  limit = 50
): Promise<ReferralWithUser[]> {
  if (!supabaseAdmin) {
    return [];
  }

  try {
    const from = page * limit;
    const to = from + limit - 1;

    const { data, error } = await supabaseAdmin
      .from('referrals')
      .select(`
        id,
        referrer_wallet,
        referred_wallet,
        invitee_club_reward,
        invitee_ticket_reward,
        revenue_share_club,
        status,
        created_at
      `)
      .eq('referrer_wallet', walletAddress)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Get referrals error:', error);
      return [];
    }

    // 피초대자 정보 조회
    const referredWallets = data.map((r) => r.referred_wallet);
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address, nickname, avatar_url')
      .in('wallet_address', referredWallets);

    const profileMap = new Map(
      profiles?.map((p) => [p.wallet_address, p]) || []
    );

    return data.map((referral) => {
      const profile = profileMap.get(referral.referred_wallet);
      return {
        ...referral,
        nickname: profile?.nickname,
        avatar_url: profile?.avatar_url,
      };
    });
  } catch (error) {
    console.error('Get referrals exception:', error);
    return [];
  }
}

// ============================================
// Get Referral Stats
// ============================================

/**
 * 레퍼럴 통계 조회
 */
export async function getReferralStats(
  walletAddress: string
): Promise<ReferralStats> {
  if (!supabaseAdmin) {
    return { totalCount: 0, totalSignupRewards: 0, totalRevenueShare: 0 };
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('get_referral_stats', {
      p_wallet_address: walletAddress,
    });

    if (error) {
      console.error('Get referral stats error:', error);
      return { totalCount: 0, totalSignupRewards: 0, totalRevenueShare: 0 };
    }

    const result = data as {
      total_count: number;
      total_signup_rewards: number;
      total_revenue_share: number;
    };

    return {
      totalCount: result.total_count || 0,
      totalSignupRewards: result.total_signup_rewards || 0,
      totalRevenueShare: result.total_revenue_share || 0,
    };
  } catch (error) {
    console.error('Get referral stats exception:', error);
    return { totalCount: 0, totalSignupRewards: 0, totalRevenueShare: 0 };
  }
}

// ============================================
// Revenue Share
// ============================================

/**
 * 수익 공유 지급 (CLUB 획득 또는 구매 시)
 */
export async function grantRevenueShare(
  referredWallet: string,
  clubAmount: number
): Promise<boolean> {
  if (!supabaseAdmin) {
    return false;
  }

  if (clubAmount <= 0) {
    return false;
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('grant_referral_revenue_share', {
      p_referred_wallet: referredWallet,
      p_club_amount: clubAmount,
    });

    if (error) {
      console.error('Grant revenue share error:', error);
      return false;
    }

    const result = data as { success: boolean; reason?: string };
    return result.success;
  } catch (error) {
    console.error('Grant revenue share exception:', error);
    return false;
  }
}

// ============================================
// Check Referrer
// ============================================

/**
 * 유저가 초대받은 사람인지 확인 (referred_by 조회)
 */
export async function getUserReferredBy(
  walletAddress: string
): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('referred_by')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !data) {
      return null;
    }

    return data.referred_by;
  } catch (error) {
    console.error('Get user referred_by exception:', error);
    return null;
  }
}

/**
 * 유저의 referral_count 조회
 */
export async function getUserReferralCount(
  walletAddress: string
): Promise<number> {
  if (!supabaseAdmin) {
    return 0;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('referral_count')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !data) {
      return 0;
    }

    return data.referral_count || 0;
  } catch (error) {
    console.error('Get user referral count exception:', error);
    return 0;
  }
}

// ============================================
// Get Referral Code
// ============================================

/**
 * 유저의 referral_code 조회
 */
export async function getUserReferralCode(
  walletAddress: string
): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('referral_code')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !data) {
      return null;
    }

    return data.referral_code || null;
  } catch (error) {
    console.error('Get user referral code exception:', error);
    return null;
  }
}

/**
 * referral_code로 wallet address 조회
 */
export async function getWalletByReferralCode(
  referralCode: string
): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('referral_code', referralCode)
      .single();

    if (error || !data) {
      return null;
    }

    return data.wallet_address || null;
  } catch (error) {
    console.error('Get wallet by referral code exception:', error);
    return null;
  }
}

// ============================================
// Shared Revenue Share Utilities
// 수익이 발생하는 모든 곳에서 이 함수들을 호출
// ============================================

export interface RevenueShareResult {
  success: boolean;
  shareAmount: number;
  referrerWallet?: string;
}

/**
 * CLUB 획득 시 수익 공유 처리 (1% 공유)
 * 게임 보상, 퀘스트 보상 등 CLUB 획득 시 호출
 *
 * @param walletAddress - CLUB을 획득한 유저의 지갑 주소
 * @param clubAmount - 획득한 CLUB 양
 * @returns 수익 공유 결과
 *
 * @example
 * // 게임에서 100 CLUB 획득 시
 * await processClubEarningShare('0x...', 100);
 * // → 초대자에게 1 CLUB (1%) 지급
 */
export async function processClubEarningShare(
  walletAddress: string,
  clubAmount: number
): Promise<RevenueShareResult> {
  if (clubAmount <= 0) {
    return { success: false, shareAmount: 0 };
  }

  // 1% 계산 (소수점 버림)
  const shareAmount = Math.floor(clubAmount * REFERRAL_REVENUE_SHARE.earningSharePercent / 100);

  if (shareAmount <= 0) {
    return { success: false, shareAmount: 0 };
  }

  const success = await grantRevenueShare(walletAddress, shareAmount);

  return {
    success,
    shareAmount: success ? shareAmount : 0,
  };
}

/**
 * 결제 시 수익 공유 처리 (USD × 10 CLUB 공유)
 * 상점 결제 완료 시 호출
 *
 * @param walletAddress - 결제한 유저의 지갑 주소
 * @param usdAmount - 결제 금액 (USD)
 * @returns 수익 공유 결과
 *
 * @example
 * // $5 결제 시
 * await processPurchaseShare('0x...', 5);
 * // → 초대자에게 50 CLUB (5 × 10) 지급
 */
export async function processPurchaseShare(
  walletAddress: string,
  usdAmount: number
): Promise<RevenueShareResult> {
  if (usdAmount <= 0) {
    return { success: false, shareAmount: 0 };
  }

  // USD × 10 = CLUB
  const shareAmount = Math.round(usdAmount * REFERRAL_REVENUE_SHARE.purchaseMultiplier);

  if (shareAmount <= 0) {
    return { success: false, shareAmount: 0 };
  }

  const success = await grantRevenueShare(walletAddress, shareAmount);

  return {
    success,
    shareAmount: success ? shareAmount : 0,
  };
}
