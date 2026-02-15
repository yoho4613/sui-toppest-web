/**
 * Referral System Utilities
 *
 * Uses unique referral codes (e.g., "CLUB7X9K") instead of wallet addresses
 * for shorter, cleaner referral links.
 */

// ============================================
// 레퍼럴 링크 생성
// ============================================

/**
 * 레퍼럴 링크 생성 (referral_code 기반)
 * @param referralCode - 유저의 고유 레퍼럴 코드 (예: "CLUB7X9K")
 */
export function generateReferralLink(referralCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://toppest.app';
  // Direct to /play for better conversion (skip landing page)
  return `${baseUrl}/play?ref=${referralCode}`;
}

/**
 * 레퍼럴 링크 생성 (wallet address fallback - 레거시 지원)
 */
export function generateReferralLinkByWallet(walletAddress: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://toppest.app';
  // Direct to /play for better conversion (skip landing page)
  return `${baseUrl}/play?ref=${walletAddress}`;
}

// ============================================
// URL 파싱
// ============================================

/**
 * URL에서 referrer 코드 추출 (referral_code 또는 wallet address)
 */
export function extractReferrerFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('ref');
  } catch {
    return null;
  }
}

/**
 * 현재 페이지 URL에서 referrer 추출 (클라이언트 전용)
 */
export function getReferrerFromCurrentUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return extractReferrerFromUrl(window.location.href);
}

/**
 * referrer 값이 referral_code인지 wallet address인지 판별
 */
export function isReferralCode(ref: string): boolean {
  return ref.startsWith('CLUB') && ref.length === 8;
}

// ============================================
// 세션 스토리지 (지갑 연결 전 임시 저장)
// ============================================

const REFERRER_STORAGE_KEY = 'pending_referrer';

/**
 * 레퍼럴 정보 임시 저장 (지갑 연결 전)
 * @param referrer - referral_code 또는 wallet address
 */
export function savePendingReferrer(referrer: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(REFERRER_STORAGE_KEY, referrer);
}

/**
 * 저장된 레퍼럴 정보 가져오기 (referral_code 또는 wallet address)
 */
export function getPendingReferrer(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(REFERRER_STORAGE_KEY);
}

/**
 * 레퍼럴 처리 완료 후 삭제
 */
export function clearPendingReferrer(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(REFERRER_STORAGE_KEY);
}

// ============================================
// 공유 텍스트 생성
// ============================================

/**
 * 공유 텍스트 생성
 */
export function generateShareText(nickname?: string): string {
  return `🎮 ${nickname || 'A friend'} invited you to Toppest!

🎁 Join now and get FREE rewards:
• 250 $CLUB tokens
• 3 bonus game tickets

Tap the link to start playing! 🚀`;
}

// ============================================
// SUI 주소 유효성 검증
// ============================================

/**
 * SUI 주소 형식 검증
 */
export function isValidSuiAddress(address: string): boolean {
  // SUI 주소는 0x로 시작하고 64자리 hex
  if (!address) return false;
  if (!address.startsWith('0x')) return false;
  // 0x 제외 64자리 hex
  const hex = address.slice(2);
  if (hex.length !== 64) return false;
  return /^[0-9a-fA-F]+$/.test(hex);
}

// ============================================
// 주소 포맷팅
// ============================================

/**
 * 주소 줄임 표시
 */
export function formatAddress(address: string, prefixLength = 6, suffixLength = 4): string {
  if (!address || address.length < prefixLength + suffixLength) return address;
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

/**
 * 날짜 포맷팅 (가입일 표시용)
 */
export function formatJoinDate(timestamp: string | number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
