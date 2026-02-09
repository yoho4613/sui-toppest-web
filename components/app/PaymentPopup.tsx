'use client';

import { useEffect, useState } from 'react';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { getExplorerTxUrl, formatSui } from '@/lib/sui-utils';
import { useAppStore } from '@/stores/useAppStore';

const SUI_USD_PRICE = parseFloat(process.env.NEXT_PUBLIC_SUI_USD_PRICE || '1.5');
const PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_LUCK_PACKAGE_ID || '0x7795285cd9a37afc24140e240d3fa0c0098f22a63fd93ca1adc3a50b5c036040';
const LUCK_COIN_TYPE = `${PACKAGE_ID}::luck_token::LUCK_TOKEN`;

/** Detect network mismatch errors and return user-friendly message */
function getPaymentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Purchase failed';

  // Network mismatch indicators
  if (message.includes('notExists') ||
      message.includes('No valid SUI') ||
      message.includes('input objects are invalid') ||
      message.includes('Object not found')) {
    return 'Network mismatch: Please switch your wallet to Devnet in wallet settings.';
  }

  return message;
}

export function PaymentPopup() {
  const client = useSuiClient();
  const { isConnected: isWalletConnected, address: walletAddress, sendSui, sendToken, getTokenBalance, getBalance } = useSuiWallet();
  const { isAuthenticated: isZkLoginAuth, address: zkAddress, signAndExecuteTransaction } = useZkLogin();

  const isConnected = isWalletConnected || isZkLoginAuth;
  const address = walletAddress || zkAddress;

  const {
    paymentPopup,
    closePaymentPopup,
    setPaymentMethod,
    setPaymentStatus,
    addStarTickets,
    triggerBalanceRefresh,
  } = useAppStore();

  const { isOpen, product, paymentMethod, status, error, txDigest, reward } = paymentPopup;

  // Balances
  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [luckBalance, setLuckBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Fetch balances when popup opens
  useEffect(() => {
    async function fetchBalances() {
      if (!isOpen || !isConnected || !address) return;

      setIsLoadingBalance(true);
      try {
        if (isWalletConnected) {
          const [sui, luck] = await Promise.all([
            getBalance(),
            getTokenBalance(LUCK_COIN_TYPE),
          ]);
          setSuiBalance(sui);
          setLuckBalance(luck);
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
      } finally {
        setIsLoadingBalance(false);
      }
    }
    fetchBalances();
  }, [isOpen, isConnected, isWalletConnected, isZkLoginAuth, address, zkAddress, getBalance, getTokenBalance, client]);

  if (!isOpen || !product) return null;

  const hasEnoughBalance = (): boolean => {
    if (paymentMethod === 'sui') {
      return BigInt(suiBalance) >= BigInt(product.price_sui_mist);
    } else {
      const requiredLuck = BigInt(product.price_luck) * BigInt(10 ** 9);
      return BigInt(luckBalance) >= requiredLuck;
    }
  };

  const handlePurchase = async () => {
    if (!isConnected || !address || !product) return;

    if (paymentMethod === 'sui') {
      await handlePurchaseWithSui();
    } else {
      await handlePurchaseWithLuck();
    }
  };

  const handlePurchaseWithSui = async () => {
    if (!address || !product) return;

    setPaymentStatus('creating');

    try {
      const purchaseRes = await fetch('/api/shop/sui-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          walletAddress: address,
        }),
      });

      const purchaseData = await purchaseRes.json();
      if (!purchaseData.success) {
        throw new Error(purchaseData.error || 'Failed to create purchase');
      }

      setPaymentStatus('signing');
      const { purchaseId, recipientAddress, amountMist } = purchaseData.purchase;

      let result: { success: boolean; digest?: string; error?: string };

      if (isWalletConnected) {
        result = await sendSui(recipientAddress, BigInt(amountMist));
      } else if (isZkLoginAuth && zkAddress) {
        // For zkLogin, get SUI coins
        const coins = await client.getCoins({
          owner: zkAddress,
          coinType: '0x2::sui::SUI',
        });

        if (coins.data.length === 0) {
          throw new Error('No SUI coins found');
        }

        // Check total balance
        const totalBalance = coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
        const requiredAmount = BigInt(amountMist) + BigInt(10_000_000); // transfer + gas buffer
        if (totalBalance < requiredAmount) {
          throw new Error('Insufficient SUI balance');
        }

        const tx = new Transaction();

        // Set all coins as gas payment sources - SDK will merge them if needed
        tx.setGasPayment(coins.data.map(c => ({
          objectId: c.coinObjectId,
          version: c.version,
          digest: c.digest,
        })));

        // Split from gas (which now has access to all coins)
        const [splitCoin] = tx.splitCoins(tx.gas, [BigInt(amountMist)]);
        tx.transferObjects([splitCoin], recipientAddress);

        tx.setGasBudget(10_000_000); // 0.01 SUI
        result = await signAndExecuteTransaction(tx);
      } else {
        throw new Error('Wallet not connected');
      }

      if (!result.success || !result.digest) {
        throw new Error(result.error || 'Transaction failed');
      }

      setPaymentStatus('verifying');
      const verifyRes = await fetch('/api/shop/sui-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: result.digest,
          purchaseId,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.verified) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      // Update star tickets if that was the reward
      if (verifyData.reward?.type === 'star_tickets') {
        addStarTickets(verifyData.reward.amount);
      }

      // Trigger header balance refresh
      triggerBalanceRefresh();

      setPaymentStatus('success', null, result.digest, verifyData.reward);
    } catch (err) {
      setPaymentStatus('error', getPaymentErrorMessage(err));
    }
  };

  const handlePurchaseWithLuck = async () => {
    if (!address || !product) return;

    setPaymentStatus('creating');

    try {
      const purchaseRes = await fetch('/api/shop/luck-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          walletAddress: address,
        }),
      });

      const purchaseData = await purchaseRes.json();
      if (!purchaseData.success) {
        throw new Error(purchaseData.error || 'Failed to create purchase');
      }

      setPaymentStatus('signing');
      const { purchaseId, recipientAddress, amountWithDecimals, coinType } = purchaseData.purchase;

      let result: { success: boolean; digest?: string; error?: string };

      if (isWalletConnected) {
        result = await sendToken(coinType, recipientAddress, BigInt(amountWithDecimals));
      } else if (isZkLoginAuth && zkAddress) {
        const tx = new Transaction();

        // Get fresh coin data
        const coins = await client.getCoins({
          owner: zkAddress,
          coinType: LUCK_COIN_TYPE,
        });

        if (coins.data.length === 0) {
          throw new Error('No LUCK tokens found');
        }

        // Calculate total balance
        const totalBalance = coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
        if (totalBalance < BigInt(amountWithDecimals)) {
          throw new Error(`Insufficient LUCK balance: have ${totalBalance}, need ${amountWithDecimals}`);
        }

        if (coins.data.length > 1) {
          const primaryCoin = coins.data[0];
          const coinsToMerge = coins.data.slice(1).map(c => c.coinObjectId);
          tx.mergeCoins(tx.object(primaryCoin.coinObjectId), coinsToMerge.map(id => tx.object(id)));
        }

        const [splitCoin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [BigInt(amountWithDecimals)]);
        tx.transferObjects([splitCoin], recipientAddress);

        tx.setGasBudget(10_000_000); // 0.01 SUI
        result = await signAndExecuteTransaction(tx);
      } else {
        throw new Error('Wallet not connected');
      }

      if (!result.success || !result.digest) {
        throw new Error(result.error || 'Transaction failed');
      }

      setPaymentStatus('verifying');
      const verifyRes = await fetch('/api/shop/luck-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: result.digest,
          purchaseId,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.verified) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      // Update star tickets if that was the reward
      if (verifyData.reward?.type === 'star_tickets') {
        addStarTickets(verifyData.reward.amount);
      }

      // Trigger header balance refresh
      triggerBalanceRefresh();

      setPaymentStatus('success', null, result.digest, verifyData.reward);
    } catch (err) {
      setPaymentStatus('error', getPaymentErrorMessage(err));
    }
  };

  const handleClose = () => {
    if (status === 'signing' || status === 'verifying' || status === 'creating') {
      return; // Don't allow closing during transaction
    }
    closePaymentPopup();
  };

  const renderContent = () => {
    // Loading balances
    if (isLoadingBalance) {
      return (
        <div className="py-8 text-center">
          <div className="w-8 h-8 border-2 border-[#4DA2FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      );
    }

    // Purchase in progress
    if (status === 'creating' || status === 'signing' || status === 'verifying') {
      return (
        <div className="py-8 text-center">
          <div className="w-12 h-12 border-4 border-[#4DA2FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">
            {status === 'creating' && 'Creating purchase...'}
            {status === 'signing' && 'Confirm in wallet...'}
            {status === 'verifying' && 'Verifying payment...'}
          </h3>
          <p className="text-gray-400 text-sm">
            {product.name} - {product.reward_amount} {product.reward_type === 'star_tickets' ? 'Star Tickets' : product.reward_type}
          </p>
        </div>
      );
    }

    // Success
    if (status === 'success') {
      return (
        <div className="py-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-green-400 mb-1">Purchase Complete!</h3>
          {reward && (
            <p className="text-gray-400 text-sm mb-4">
              +{reward.amount} {reward.type === 'star_tickets' ? 'Star Tickets' : reward.type}
            </p>
          )}
          {txDigest && (
            <a
              href={getExplorerTxUrl(txDigest)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4DA2FF] text-sm hover:underline"
            >
              View transaction
            </a>
          )}
          <button
            onClick={handleClose}
            className="w-full mt-6 py-3 bg-[#4DA2FF] text-[#0F1419] font-bold rounded-xl"
          >
            Done
          </button>
        </div>
      );
    }

    // Error
    if (status === 'error') {
      return (
        <div className="py-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-400 mb-1">Purchase Failed</h3>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={() => setPaymentStatus('idle')}
              className="flex-1 py-3 bg-[#4DA2FF] text-[#0F1419] font-semibold rounded-xl"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // Check balance
    const enoughBalance = hasEnoughBalance();
    const requiredAmount = paymentMethod === 'sui'
      ? formatSui(product.price_sui_mist)
      : product.price_luck.toString();
    const currentBalance = paymentMethod === 'sui'
      ? formatSui(suiBalance)
      : (Number(luckBalance) / 1e9).toFixed(0);

    // Default: show payment options
    return (
      <>
        {/* Product Info */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white">{product.name}</h3>
            {product.badge && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-400 rounded-full">
                {product.badge}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">{product.description}</p>
        </div>

        {/* Reward Info */}
        <div className="bg-white/5 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">You will receive</span>
            <span className="text-white font-bold">
              {product.reward_amount} {product.reward_type === 'star_tickets' ? '⭐ Star Tickets' : product.reward_type}
            </span>
          </div>
        </div>

        {/* Payment Method Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setPaymentMethod('sui')}
            className={`flex-1 p-3 rounded-xl font-semibold text-sm transition-all ${
              paymentMethod === 'sui'
                ? 'bg-[#4DA2FF] text-[#0F1419] shadow-[0_0_15px_rgba(77,163,255,0.3)]'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            Pay with SUI
          </button>
          <button
            onClick={() => setPaymentMethod('luck')}
            className={`flex-1 p-3 rounded-xl font-semibold text-sm transition-all ${
              paymentMethod === 'luck'
                ? 'bg-yellow-500 text-[#0F1419] shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            Pay with LUCK
          </button>
        </div>

        {/* Price & Balance */}
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">Price</span>
            <span className={`font-bold text-lg ${paymentMethod === 'sui' ? 'text-[#4DA2FF]' : 'text-yellow-400'}`}>
              {requiredAmount} {paymentMethod === 'sui' ? 'SUI' : 'LUCK'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Your Balance</span>
            <span className={`font-bold ${enoughBalance ? 'text-white' : 'text-red-400'}`}>
              {currentBalance} {paymentMethod === 'sui' ? 'SUI' : 'LUCK'}
            </span>
          </div>
          {!enoughBalance && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-red-400 text-xs text-center">Insufficient balance</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handlePurchase}
            disabled={!enoughBalance}
            className={`flex-1 py-3 font-semibold rounded-xl transition-all ${
              enoughBalance
                ? paymentMethod === 'sui'
                  ? 'bg-[#4DA2FF] text-[#0F1419]'
                  : 'bg-yellow-500 text-[#0F1419]'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {enoughBalance ? 'Confirm' : 'Insufficient Balance'}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#1A1F26] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        {renderContent()}
      </div>
    </div>
  );
}
