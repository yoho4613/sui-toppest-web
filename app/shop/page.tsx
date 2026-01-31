'use client';

import { useState, useEffect } from 'react';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { getExplorerTxUrl, formatSui } from '@/lib/sui-utils';
import Link from 'next/link';

interface SpinPackage {
  id: string;
  spins: number;
  priceUsd: number;
  luckPrice: number;
  label: string;
  bonus?: string;
  luckDiscount?: string;
}

const SPIN_PACKAGES: SpinPackage[] = [
  { id: 'pack_10', spins: 10, priceUsd: 1.75, luckPrice: 100, label: '10 Spins' },
  { id: 'pack_30', spins: 30, priceUsd: 4.20, luckPrice: 250, label: '30 Spins', bonus: '+20%', luckDiscount: '-17%' },
  { id: 'pack_100', spins: 100, priceUsd: 12.25, luckPrice: 700, label: '100 Spins', bonus: '+30%', luckDiscount: '-30%' },
];

type PaymentMethod = 'sui' | 'luck';
type PurchaseStatus = 'idle' | 'creating' | 'signing' | 'verifying' | 'success' | 'error';

const PACKAGE_ID = '0x5cbe88ff66b4772358bcda0e509b955d3c51d05f956343253f8d780a5361c661';
const LUCK_COIN_TYPE = `${PACKAGE_ID}::luck_token::LUCK_TOKEN`;

// SUI price in USD (from env or default)
const SUI_USD_PRICE = parseFloat(process.env.NEXT_PUBLIC_SUI_USD_PRICE || '1.5');

export default function ShopPage() {
  const { isConnected, address, sendSui, sendToken, getTokenBalance, getBalance } = useSuiWallet();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sui');
  const [selectedPackage, setSelectedPackage] = useState<SpinPackage | null>(null);
  const [status, setStatus] = useState<PurchaseStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [luckBalance, setLuckBalance] = useState<string>('0');
  const [suiBalance, setSuiBalance] = useState<string>('0');

  // Fetch balances
  useEffect(() => {
    async function fetchBalances() {
      if (isConnected) {
        const [luck, sui] = await Promise.all([
          getTokenBalance(LUCK_COIN_TYPE),
          getBalance(),
        ]);
        setLuckBalance(luck);
        setSuiBalance(sui);
      } else {
        setLuckBalance('0');
        setSuiBalance('0');
      }
    }
    fetchBalances();
  }, [isConnected, getTokenBalance, getBalance]);

  // Calculate required SUI for a package (in MIST)
  const getRequiredSuiMist = (pkg: SpinPackage): bigint => {
    const suiAmount = pkg.priceUsd / SUI_USD_PRICE;
    return BigInt(Math.ceil(suiAmount * 1e9));
  };

  // Check if user has enough balance for a package
  const hasEnoughBalance = (pkg: SpinPackage): boolean => {
    if (paymentMethod === 'sui') {
      const requiredMist = getRequiredSuiMist(pkg);
      return BigInt(suiBalance) >= requiredMist;
    } else {
      const requiredLuck = BigInt(pkg.luckPrice) * BigInt(10 ** 9);
      return BigInt(luckBalance) >= requiredLuck;
    }
  };

  // Get insufficient balance message
  const getInsufficientMessage = (pkg: SpinPackage): string | null => {
    if (!isConnected) return null;
    if (hasEnoughBalance(pkg)) return null;

    if (paymentMethod === 'sui') {
      const requiredMist = getRequiredSuiMist(pkg);
      const requiredSui = Number(requiredMist) / 1e9;
      const currentSui = Number(suiBalance) / 1e9;
      return `Insufficient SUI (Need ${requiredSui.toFixed(4)}, Have ${currentSui.toFixed(4)})`;
    } else {
      const currentLuck = Number(luckBalance) / 1e9;
      return `Insufficient $LUCK (Need ${pkg.luckPrice}, Have ${currentLuck.toFixed(0)})`;
    }
  };

  const handlePurchaseWithSui = async (pkg: SpinPackage) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    setSelectedPackage(pkg);
    setStatus('creating');
    setError(null);
    setTxDigest(null);

    try {
      // Step 1: Create purchase intent
      const purchaseRes = await fetch('/api/shop/sui-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          userId: address,
          walletAddress: address,
        }),
      });

      const purchaseData = await purchaseRes.json();
      if (!purchaseData.success) {
        throw new Error(purchaseData.error || 'Failed to create purchase');
      }

      // Step 2: Send SUI payment
      setStatus('signing');
      const { recipientAddress, amountMist } = purchaseData.purchase;

      const result = await sendSui(recipientAddress, BigInt(amountMist));

      if (!result.success || !result.digest) {
        throw new Error(result.error || 'Transaction failed');
      }

      // Step 3: Verify payment
      setStatus('verifying');
      const verifyRes = await fetch('/api/shop/sui-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: result.digest,
          userId: address,
          packageId: pkg.id,
          expectedAmountMist: amountMist,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.verified) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      setTxDigest(result.digest);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
      setStatus('error');
    }
  };

  const handlePurchaseWithLuck = async (pkg: SpinPackage) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    // Check if user has enough $LUCK
    const requiredAmount = BigInt(pkg.luckPrice) * BigInt(10 ** 9);
    if (BigInt(luckBalance) < requiredAmount) {
      setError(`Insufficient $LUCK balance. Need ${pkg.luckPrice} LUCK`);
      setStatus('error');
      return;
    }

    setSelectedPackage(pkg);
    setStatus('creating');
    setError(null);
    setTxDigest(null);

    try {
      // Step 1: Create purchase intent
      const purchaseRes = await fetch('/api/shop/luck-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          userId: address,
          walletAddress: address,
        }),
      });

      const purchaseData = await purchaseRes.json();
      if (!purchaseData.success) {
        throw new Error(purchaseData.error || 'Failed to create purchase');
      }

      // Step 2: Send $LUCK payment
      setStatus('signing');
      const { recipientAddress, amountWithDecimals, coinType } = purchaseData.purchase;

      const result = await sendToken(coinType, recipientAddress, BigInt(amountWithDecimals));

      if (!result.success || !result.digest) {
        throw new Error(result.error || 'Transaction failed');
      }

      // Step 3: Verify payment
      setStatus('verifying');
      const verifyRes = await fetch('/api/shop/luck-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: result.digest,
          userId: address,
          packageId: pkg.id,
          expectedAmount: amountWithDecimals,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.verified) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      setTxDigest(result.digest);
      setStatus('success');

      // Refresh $LUCK balance
      const newBalance = await getTokenBalance(LUCK_COIN_TYPE);
      setLuckBalance(newBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
      setStatus('error');
    }
  };

  const handlePurchase = (pkg: SpinPackage) => {
    if (paymentMethod === 'sui') {
      handlePurchaseWithSui(pkg);
    } else {
      handlePurchaseWithLuck(pkg);
    }
  };

  const resetPurchase = () => {
    setStatus('idle');
    setError(null);
    setTxDigest(null);
    setSelectedPackage(null);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Shop</h1>
            <p className="text-gray-400">Buy energy to play games</p>
          </div>
          <Link href="/" className="btn btn-secondary">
            Back
          </Link>
        </div>

        {/* Wallet Status */}
        {!isConnected && (
          <div className="card mb-8 text-center">
            <p className="text-yellow-400 mb-2">Wallet not connected</p>
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              Connect wallet to purchase
            </Link>
          </div>
        )}

        {/* Payment Method Toggle */}
        {isConnected && status === 'idle' && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Payment Method</span>
              <span className={`text-sm ${paymentMethod === 'sui' ? 'text-blue-400' : 'text-yellow-400'}`}>
                Balance: {paymentMethod === 'sui'
                  ? `${formatSui(suiBalance)} SUI`
                  : `${formatSui(luckBalance)} LUCK`
                }
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod('sui')}
                className={`p-3 rounded-lg font-medium transition-colors ${
                  paymentMethod === 'sui'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Pay with SUI
              </button>
              <button
                onClick={() => setPaymentMethod('luck')}
                className={`p-3 rounded-lg font-medium transition-colors ${
                  paymentMethod === 'luck'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Pay with $LUCK
              </button>
            </div>
          </div>
        )}

        {/* Package Selection */}
        {status === 'idle' && (
          <div className="space-y-4">
            {SPIN_PACKAGES.map((pkg) => {
              const insufficientMsg = getInsufficientMessage(pkg);
              const canPurchase = isConnected && !insufficientMsg;

              return (
                <div
                  key={pkg.id}
                  className={`card transition-colors ${
                    canPurchase
                      ? `cursor-pointer ${paymentMethod === 'sui' ? 'hover:border-blue-500' : 'hover:border-yellow-500'}`
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                  onClick={() => canPurchase && handlePurchase(pkg)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold">{pkg.label}</h3>
                        {paymentMethod === 'sui' && pkg.bonus && (
                          <span className="badge badge-success text-xs">{pkg.bonus}</span>
                        )}
                        {paymentMethod === 'luck' && pkg.luckDiscount && (
                          <span className="badge badge-warning text-xs">{pkg.luckDiscount}</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{pkg.spins} energy units</p>
                    </div>
                    <div className="text-right">
                      {paymentMethod === 'sui' ? (
                        <>
                          <p className="text-2xl font-bold">${pkg.priceUsd.toFixed(2)}</p>
                          <p className="text-gray-500 text-xs">Pay with SUI</p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-yellow-400">{pkg.luckPrice} LUCK</p>
                          <p className="text-gray-500 text-xs">Pay with $LUCK</p>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Insufficient Balance Warning */}
                  {insufficientMsg && (
                    <div className="mt-3 pt-3 border-t border-red-500/30">
                      <p className="text-red-400 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {insufficientMsg}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Purchase in Progress */}
        {status !== 'idle' && status !== 'success' && status !== 'error' && (
          <div className="card text-center py-12">
            <div className="mb-4">
              <div className={`w-12 h-12 border-4 ${paymentMethod === 'sui' ? 'border-blue-500' : 'border-yellow-500'} border-t-transparent rounded-full animate-spin mx-auto`}></div>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {status === 'creating' && 'Creating purchase...'}
              {status === 'signing' && 'Confirm in your wallet...'}
              {status === 'verifying' && 'Verifying payment...'}
            </h3>
            {selectedPackage && (
              <p className="text-gray-400">
                {selectedPackage.label} - {paymentMethod === 'sui'
                  ? `$${selectedPackage.priceUsd.toFixed(2)}`
                  : `${selectedPackage.luckPrice} LUCK`
                }
              </p>
            )}
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="card text-center py-12">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-green-400 mb-2">Purchase Complete!</h3>
            {selectedPackage && (
              <p className="text-gray-400 mb-4">
                {selectedPackage.spins} energy added to your account
              </p>
            )}
            {txDigest && (
              <a
                href={getExplorerTxUrl(txDigest)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View transaction
              </a>
            )}
            <button onClick={resetPurchase} className="btn btn-primary mt-6">
              Continue Shopping
            </button>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="card text-center py-12">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-red-400 mb-2">Purchase Failed</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <button onClick={resetPurchase} className="btn btn-primary">
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
