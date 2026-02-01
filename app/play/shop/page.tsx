'use client';

import { useState, useEffect } from 'react';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { getExplorerTxUrl, formatSui } from '@/lib/sui-utils';

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
  { id: 'pack_10', spins: 10, priceUsd: 1.75, luckPrice: 100, label: 'Starter' },
  { id: 'pack_30', spins: 30, priceUsd: 4.20, luckPrice: 250, label: 'Popular', bonus: '+20%', luckDiscount: '-17%' },
  { id: 'pack_100', spins: 100, priceUsd: 12.25, luckPrice: 700, label: 'Premium', bonus: '+30%', luckDiscount: '-30%' },
];

type PaymentMethod = 'sui' | 'luck';
type PurchaseStatus = 'idle' | 'creating' | 'signing' | 'verifying' | 'success' | 'error';

const PACKAGE_ID = '0x5cbe88ff66b4772358bcda0e509b955d3c51d05f956343253f8d780a5361c661';
const LUCK_COIN_TYPE = `${PACKAGE_ID}::luck_token::LUCK_TOKEN`;
const SUI_USD_PRICE = parseFloat(process.env.NEXT_PUBLIC_SUI_USD_PRICE || '1.5');

export default function ShopPage() {
  const client = useSuiClient();
  const { isConnected: isWalletConnected, address: walletAddress, sendSui, sendToken, getTokenBalance, getBalance } = useSuiWallet();
  const { isAuthenticated: isZkLoginAuth, address: zkAddress, signAndExecuteTransaction } = useZkLogin();

  const isConnected = isWalletConnected || isZkLoginAuth;
  const address = walletAddress || zkAddress;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sui');
  const [selectedPackage, setSelectedPackage] = useState<SpinPackage | null>(null);
  const [status, setStatus] = useState<PurchaseStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [luckBalance, setLuckBalance] = useState<string>('0');
  const [suiBalance, setSuiBalance] = useState<string>('0');

  // Insufficient balance popup state
  const [showInsufficientPopup, setShowInsufficientPopup] = useState(false);
  const [insufficientInfo, setInsufficientInfo] = useState<{
    required: string;
    current: string;
    currency: string;
  } | null>(null);

  // zkLogin confirmation popup state
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [pendingPackage, setPendingPackage] = useState<SpinPackage | null>(null);

  useEffect(() => {
    async function fetchBalances() {
      if (isConnected && address) {
        try {
          if (isWalletConnected) {
            const [luck, sui] = await Promise.all([
              getTokenBalance(LUCK_COIN_TYPE),
              getBalance(),
            ]);
            setLuckBalance(luck);
            setSuiBalance(sui);
          } else if (isZkLoginAuth && zkAddress) {
            const [suiRes, luckRes] = await Promise.all([
              client.getBalance({ owner: zkAddress }),
              client.getBalance({ owner: zkAddress, coinType: LUCK_COIN_TYPE }).catch(() => ({ totalBalance: '0' })),
            ]);
            setSuiBalance(suiRes.totalBalance);
            setLuckBalance(luckRes.totalBalance);
          }
        } catch (err) {
          console.error('Failed to fetch balances:', err);
        }
      } else {
        setLuckBalance('0');
        setSuiBalance('0');
      }
    }
    fetchBalances();
  }, [isConnected, isWalletConnected, isZkLoginAuth, address, zkAddress, getTokenBalance, getBalance, client]);

  const getRequiredSuiMist = (pkg: SpinPackage): bigint => {
    const suiAmount = pkg.priceUsd / SUI_USD_PRICE;
    return BigInt(Math.ceil(suiAmount * 1e9));
  };

  const hasEnoughBalance = (pkg: SpinPackage): boolean => {
    if (paymentMethod === 'sui') {
      const requiredMist = getRequiredSuiMist(pkg);
      return BigInt(suiBalance) >= requiredMist;
    } else {
      const requiredLuck = BigInt(pkg.luckPrice) * BigInt(10 ** 9);
      return BigInt(luckBalance) >= requiredLuck;
    }
  };

  const handlePackageClick = (pkg: SpinPackage) => {
    if (!isConnected) return;

    // Check balance
    if (!hasEnoughBalance(pkg)) {
      // Show insufficient balance popup
      if (paymentMethod === 'sui') {
        const requiredMist = getRequiredSuiMist(pkg);
        const requiredSui = (Number(requiredMist) / 1e9).toFixed(2);
        const currentSui = (Number(suiBalance) / 1e9).toFixed(2);
        setInsufficientInfo({
          required: requiredSui,
          current: currentSui,
          currency: 'SUI',
        });
      } else {
        const currentLuck = (Number(luckBalance) / 1e9).toFixed(0);
        setInsufficientInfo({
          required: pkg.luckPrice.toString(),
          current: currentLuck,
          currency: 'LUCK',
        });
      }
      setShowInsufficientPopup(true);
      return;
    }

    // For zkLogin users, show confirmation popup first
    if (isZkLoginAuth) {
      setPendingPackage(pkg);
      setShowConfirmPopup(true);
      return;
    }

    // For wallet users, proceed directly (wallet will show its own popup)
    handlePurchase(pkg);
  };

  const handleConfirmPurchase = () => {
    if (pendingPackage) {
      setShowConfirmPopup(false);
      handlePurchase(pendingPackage);
      setPendingPackage(null);
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirmPopup(false);
    setPendingPackage(null);
  };

  const handlePurchaseWithSui = async (pkg: SpinPackage) => {
    if (!isConnected || !address) return;

    setSelectedPackage(pkg);
    setStatus('creating');
    setError(null);
    setTxDigest(null);

    try {
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

      setStatus('signing');
      const { recipientAddress, amountMist } = purchaseData.purchase;

      let result: { success: boolean; digest?: string; error?: string };

      if (isWalletConnected) {
        // Use wallet SDK for regular wallet users
        result = await sendSui(recipientAddress, BigInt(amountMist));
      } else if (isZkLoginAuth) {
        // Use zkLogin transaction signing
        const tx = new Transaction();
        const [coin] = tx.splitCoins(tx.gas, [BigInt(amountMist)]);
        tx.transferObjects([coin], recipientAddress);
        result = await signAndExecuteTransaction(tx);
      } else {
        throw new Error('Wallet not connected');
      }

      if (!result.success || !result.digest) {
        throw new Error(result.error || 'Transaction failed');
      }

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
    if (!isConnected || !address) return;

    setSelectedPackage(pkg);
    setStatus('creating');
    setError(null);
    setTxDigest(null);

    try {
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

      setStatus('signing');
      const { recipientAddress, amountWithDecimals, coinType } = purchaseData.purchase;

      let result: { success: boolean; digest?: string; error?: string };

      if (isWalletConnected) {
        // Use wallet SDK for regular wallet users
        result = await sendToken(coinType, recipientAddress, BigInt(amountWithDecimals));
      } else if (isZkLoginAuth && zkAddress) {
        // Use zkLogin transaction signing for LUCK token transfer
        const tx = new Transaction();

        // Get user's LUCK coins
        const coins = await client.getCoins({
          owner: zkAddress,
          coinType: LUCK_COIN_TYPE,
        });

        if (coins.data.length === 0) {
          throw new Error('No LUCK tokens found');
        }

        // If we have multiple coins, merge them first
        if (coins.data.length > 1) {
          const primaryCoin = coins.data[0];
          const coinsToMerge = coins.data.slice(1).map(c => c.coinObjectId);
          tx.mergeCoins(tx.object(primaryCoin.coinObjectId), coinsToMerge.map(id => tx.object(id)));
        }

        // Split the required amount and transfer
        const [splitCoin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [BigInt(amountWithDecimals)]);
        tx.transferObjects([splitCoin], recipientAddress);

        result = await signAndExecuteTransaction(tx);
      } else {
        throw new Error('Wallet not connected');
      }

      if (!result.success || !result.digest) {
        throw new Error(result.error || 'Transaction failed');
      }

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

      // Refresh balance
      if (isWalletConnected) {
        const newBalance = await getTokenBalance(LUCK_COIN_TYPE);
        setLuckBalance(newBalance);
      } else if (isZkLoginAuth && zkAddress) {
        const luckRes = await client.getBalance({ owner: zkAddress, coinType: LUCK_COIN_TYPE }).catch(() => ({ totalBalance: '0' }));
        setLuckBalance(luckRes.totalBalance);
      }
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
    <div className="px-5 flex flex-col gap-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Energy Shop</h1>
        <p className="text-gray-400 text-sm">Buy energy to play games</p>
      </div>

      {/* Balance Card */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-sm">Your Balance</span>
          <span className={`text-sm font-bold ${paymentMethod === 'sui' ? 'text-[#4DA2FF]' : 'text-yellow-400'}`}>
            {paymentMethod === 'sui'
              ? `${formatSui(suiBalance)} SUI`
              : `${formatSui(luckBalance)} LUCK`
            }
          </span>
        </div>

        {/* Payment Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPaymentMethod('sui')}
            className={`p-3 rounded-xl font-semibold text-sm transition-all ${
              paymentMethod === 'sui'
                ? 'bg-[#4DA2FF] text-[#0F1419] shadow-[0_0_15px_rgba(77,163,255,0.3)]'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            Pay with SUI
          </button>
          <button
            onClick={() => setPaymentMethod('luck')}
            className={`p-3 rounded-xl font-semibold text-sm transition-all ${
              paymentMethod === 'luck'
                ? 'bg-yellow-500 text-[#0F1419] shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            Pay with LUCK
          </button>
        </div>
      </div>

      {/* Packages */}
      {status === 'idle' && (
        <div className="flex flex-col gap-3">
          {SPIN_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => handlePackageClick(pkg)}
              className="bg-[#1A1F26] border border-white/10 hover:border-[#4DA2FF]/50 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{pkg.label}</h3>
                    {paymentMethod === 'sui' && pkg.bonus && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-400 rounded-full">
                        {pkg.bonus}
                      </span>
                    )}
                    {paymentMethod === 'luck' && pkg.luckDiscount && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-yellow-500/20 text-yellow-400 rounded-full">
                        {pkg.luckDiscount}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">{pkg.spins} energy units</p>
                </div>
                <div className="text-right">
                  {paymentMethod === 'sui' ? (
                    <>
                      <p className="text-xl font-bold text-white">${pkg.priceUsd.toFixed(2)}</p>
                      <p className="text-gray-500 text-xs">~{(pkg.priceUsd / SUI_USD_PRICE).toFixed(2)} SUI</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-yellow-400">{pkg.luckPrice}</p>
                      <p className="text-gray-500 text-xs">LUCK</p>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Purchase in Progress */}
      {status !== 'idle' && status !== 'success' && status !== 'error' && (
        <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 border-4 border-[#4DA2FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">
            {status === 'creating' && 'Creating purchase...'}
            {status === 'signing' && 'Confirm in wallet...'}
            {status === 'verifying' && 'Verifying payment...'}
          </h3>
          {selectedPackage && (
            <p className="text-gray-400 text-sm">
              {selectedPackage.label} - {selectedPackage.spins} energy
            </p>
          )}
        </div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="bg-[#1A1F26] border border-green-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-green-400 mb-1">Purchase Complete!</h3>
          {selectedPackage && (
            <p className="text-gray-400 text-sm mb-4">
              {selectedPackage.spins} energy added
            </p>
          )}
          {txDigest && (
            <a
              href={getExplorerTxUrl(txDigest)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4DA2FF] text-sm hover:underline"
            >
              View transaction →
            </a>
          )}
          <button
            onClick={resetPurchase}
            className="w-full mt-6 py-3 bg-[#4DA2FF] text-[#0F1419] font-bold rounded-xl"
          >
            Continue
          </button>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="bg-[#1A1F26] border border-red-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-400 mb-1">Purchase Failed</h3>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={resetPurchase}
            className="w-full py-3 bg-white/10 text-white font-bold rounded-xl"
          >
            Try Again
          </button>
        </div>
      )}

      {/* zkLogin Confirmation Popup */}
      {showConfirmPopup && pendingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCancelConfirm}
          />

          {/* Modal */}
          <div className="relative bg-[#1A1F26] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            {/* Icon */}
            <div className="w-16 h-16 bg-[#4DA2FF]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#4DA2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-white text-center mb-2">
              Confirm Purchase
            </h3>
            <p className="text-gray-400 text-sm text-center mb-4">
              You are about to purchase the following package:
            </p>

            {/* Package Info */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-white font-bold text-lg">{pendingPackage.label}</span>
                <span className="text-gray-400">{pendingPackage.spins} energy</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-white/10">
                <span className="text-gray-400 text-sm">Total</span>
                <span className={`font-bold text-lg ${paymentMethod === 'sui' ? 'text-[#4DA2FF]' : 'text-yellow-400'}`}>
                  {paymentMethod === 'sui'
                    ? `${(pendingPackage.priceUsd / SUI_USD_PRICE).toFixed(2)} SUI`
                    : `${pendingPackage.luckPrice} LUCK`
                  }
                </span>
              </div>
            </div>

            {/* Balance after purchase */}
            <div className="text-center text-xs text-gray-500 mb-4">
              Balance after purchase:{' '}
              <span className={paymentMethod === 'sui' ? 'text-[#4DA2FF]' : 'text-yellow-400'}>
                {paymentMethod === 'sui'
                  ? `${(Number(suiBalance) / 1e9 - pendingPackage.priceUsd / SUI_USD_PRICE).toFixed(2)} SUI`
                  : `${(Number(luckBalance) / 1e9 - pendingPackage.luckPrice).toFixed(0)} LUCK`
                }
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelConfirm}
                className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurchase}
                className={`flex-1 py-3 font-semibold rounded-xl ${
                  paymentMethod === 'sui'
                    ? 'bg-[#4DA2FF] text-[#0F1419]'
                    : 'bg-yellow-500 text-[#0F1419]'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insufficient Balance Popup */}
      {showInsufficientPopup && insufficientInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowInsufficientPopup(false)}
          />

          {/* Modal */}
          <div className="relative bg-[#1A1F26] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            {/* Icon */}
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-white text-center mb-2">
              Insufficient Balance
            </h3>
            <p className="text-gray-400 text-sm text-center mb-4">
              You don&apos;t have enough {insufficientInfo.currency} for this purchase.
            </p>

            {/* Balance Info */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm">Required</span>
                <span className={`font-bold ${insufficientInfo.currency === 'SUI' ? 'text-[#4DA2FF]' : 'text-yellow-400'}`}>
                  {insufficientInfo.required} {insufficientInfo.currency}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Your Balance</span>
                <span className="text-white font-bold">
                  {insufficientInfo.current} {insufficientInfo.currency}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Shortage</span>
                <span className="text-red-400 font-bold">
                  {(parseFloat(insufficientInfo.required) - parseFloat(insufficientInfo.current)).toFixed(2)} {insufficientInfo.currency}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowInsufficientPopup(false)}
                className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowInsufficientPopup(false);
                  // Could link to a faucet or exchange here
                }}
                className="flex-1 py-3 bg-[#4DA2FF] text-[#0F1419] font-semibold rounded-xl"
              >
                Get {insufficientInfo.currency}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
