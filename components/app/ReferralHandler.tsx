'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import {
  getReferrerFromCurrentUrl,
  savePendingReferrer,
  getPendingReferrer,
  clearPendingReferrer,
  isValidSuiAddress,
  isReferralCode,
} from '@/lib/referral';
import { REFERRAL_REWARDS } from '@/lib/constants';

/**
 * ReferralHandler Component
 *
 * Handles referral URL parameters and creates referral relationships
 * when a new user connects their wallet.
 *
 * Flow:
 * 1. Detect ?ref=referral_code or ?ref=wallet_address in URL
 * 2. Save to sessionStorage (pending_referrer)
 * 3. When wallet connects, call /api/referral to create relationship
 * 4. Show success toast with rewards
 */
export function ReferralHandler() {
  const searchParams = useSearchParams();
  const { address: walletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const address = walletAddress || zkAddress;

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Track if we've already processed the referral for this session
  const processedRef = useRef(false);

  // Step 1: Detect referrer from URL and save to sessionStorage
  useEffect(() => {
    const refParam = searchParams.get('ref');

    // Accept both referral codes (CLUB...) and wallet addresses (0x...)
    if (refParam && (isReferralCode(refParam) || isValidSuiAddress(refParam))) {
      savePendingReferrer(refParam);
    }
  }, [searchParams]);

  // Step 2: When wallet connects, process the referral
  useEffect(() => {
    if (!address || processedRef.current) return;

    const processReferral = async () => {
      const referrerCode = getPendingReferrer();

      if (!referrerCode) return;

      // Don't process self-referral (only check if it's a wallet address)
      if (!isReferralCode(referrerCode) && referrerCode === address) {
        clearPendingReferrer();
        return;
      }

      processedRef.current = true;

      try {
        const response = await fetch('/api/referral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referrerCode,
            referredWallet: address,
          }),
        });

        const data = await response.json();

        if (data.success) {
          // Show success toast
          setToastMessage(
            `Welcome! You received ${REFERRAL_REWARDS.invitee.club} $CLUB + ${REFERRAL_REWARDS.invitee.bonusTickets} tickets!`
          );
          setToastType('success');
          setShowToast(true);
        }
        // Silently ignore: already_referred, not_new_user, other reasons

        // Clear pending referrer regardless of result
        clearPendingReferrer();
      } catch {
        // Don't clear on error - might want to retry
      }
    };

    processReferral();
  }, [address]);

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  if (!showToast) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
      <div
        className={`px-6 py-4 rounded-2xl shadow-lg border backdrop-blur-xl ${
          toastType === 'success'
            ? 'bg-green-500/20 border-green-500/30'
            : 'bg-red-500/20 border-red-500/30'
        }`}
      >
        <div className="flex items-center gap-3">
          {toastType === 'success' ? (
            <span className="text-2xl">🎉</span>
          ) : (
            <span className="text-2xl">❌</span>
          )}
          <p className={`font-medium ${toastType === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {toastMessage}
          </p>
          <button
            onClick={() => setShowToast(false)}
            className="ml-2 text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
