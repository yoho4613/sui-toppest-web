/**
 * Application Constants
 */

// ============================================
// 레퍼럴 보상 설정
// ============================================

export const REFERRAL_REWARDS = {
  invitee: {
    club: 250,         // 피초대자 가입 보상 $CLUB
    bonusTickets: 3,   // 피초대자 보너스 티켓
  },
  referrer: {
    signupBonus: 0,    // 가입 시 보너스 없음 (abuse 방지)
  },
};

// ============================================
// 레퍼럴 수익 공유 설정
// 피초대자 활동/구매 시 초대자에게 리워드
// ============================================

export const REFERRAL_REVENUE_SHARE = {
  // 피초대자 구매 시: USD × 10 = CLUB
  purchaseMultiplier: 10,
  // 피초대자 CLUB 획득 시: 1% 추가 지급
  earningSharePercent: 1,
};

// ============================================
// 게임 설정
// ============================================

export const GAME_CONFIG = {
  // 일일 무료 티켓 수
  dailyFreeTickets: 3,
  // 일일 티켓 리셋 시간 (UTC 기준)
  dailyResetHourUtc: 0,
};

// ============================================
// UI 색상
// ============================================

export const COLORS = {
  primary: '#4DA2FF',
  secondary: '#8B5CF6',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // 보상 타입별 색상
  reward: {
    club: '#F59E0B',      // 금색 (CLUB)
    sui: '#4DA2FF',       // 파랑 (SUI)
    starTicket: '#8B5CF6', // 보라 (Star Ticket)
  },
};
