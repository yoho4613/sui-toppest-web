'use client';

import { useEffect, useState } from 'react';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useSuiClient } from '@mysten/dapp-kit';
import { formatSui } from '@/lib/sui-utils';
import { useAppStore, type ShopProduct, type PaymentMethod } from '@/stores/useAppStore';

const PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_LUCK_PACKAGE_ID || '0x7795285cd9a37afc24140e240d3fa0c0098f22a63fd93ca1adc3a50b5c036040';
const LUCK_COIN_TYPE = `${PACKAGE_ID}::luck_token::LUCK_TOKEN`;

export default function ShopPage() {
  const client = useSuiClient();
  const { isConnected: isWalletConnected, address: walletAddress, getTokenBalance, getBalance } = useSuiWallet();
  const { isAuthenticated: isZkLoginAuth, address: zkAddress } = useZkLogin();

  const isConnected = isWalletConnected || isZkLoginAuth;
  const address = walletAddress || zkAddress;

  // Global store (products are pre-fetched during app init)
  const { products, openPaymentPopup } = useAppStore();

  // Local state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sui');
  const [luckBalance, setLuckBalance] = useState<string>('0');
  const [suiBalance, setSuiBalance] = useState<string>('0');

  // Products are pre-fetched during app init, so no need to fetch here

  // Fetch balances
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

  // Group products by category
  const productsByCategory = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, ShopProduct[]>);

  // Category display names
  const categoryLabels: Record<string, string> = {
    tickets: 'Star Tickets',
    boosters: 'Boosters',
    cosmetics: 'Cosmetics',
  };

  // Category icons
  const categoryIcons: Record<string, string> = {
    tickets: '⭐',
    boosters: '🚀',
    cosmetics: '🎨',
  };

  const handleProductClick = (product: ShopProduct) => {
    if (!isConnected) return;
    openPaymentPopup(product, paymentMethod);
  };

  return (
    <div className="px-5 flex flex-col gap-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Shop</h1>
        <p className="text-gray-400 text-sm">Purchase items to enhance your gaming experience</p>
      </div>

      {/* Balance Card */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-sm">Your Balance</span>
          <span className={`text-sm font-bold ${
            paymentMethod === 'sui' ? 'text-[#4DA2FF]' : 'text-yellow-400'
          }`}>
            {paymentMethod === 'sui' && `${formatSui(suiBalance)} SUI`}
            {paymentMethod === 'luck' && `${formatSui(luckBalance)} LUCK`}
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

      {/* Products by Category */}
      {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
        <div key={category} className="flex flex-col gap-3">
          {/* Category Header */}
          <div className="flex items-center gap-2">
            <span className="text-xl">{categoryIcons[category] || '📦'}</span>
            <h2 className="text-lg font-bold text-white">
              {categoryLabels[category] || category}
            </h2>
          </div>

          {/* Products Grid */}
          <div className="flex flex-col gap-3">
            {categoryProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="bg-[#1A1F26] border border-white/10 hover:border-[#4DA2FF]/50 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{product.name}</h3>
                      {product.badge && (
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          product.badge === 'BEST'
                            ? 'bg-purple-500/20 text-purple-400'
                            : product.badge === 'POPULAR'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {product.badge}
                        </span>
                      )}
                      {product.bonus_text && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-yellow-500/20 text-yellow-400 rounded-full">
                          {product.bonus_text}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">
                      {product.reward_amount} {product.reward_type === 'star_tickets' ? 'Star Tickets' : product.reward_type}
                    </p>
                  </div>
                  <div className="text-right">
                    {paymentMethod === 'sui' ? (
                      <>
                        <p className="text-xl font-bold text-white">${product.price_usd.toFixed(2)}</p>
                        <p className="text-gray-500 text-xs">~{product.price_sui.toFixed(2)} SUI</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-bold text-yellow-400">{product.price_luck}</p>
                        <p className="text-gray-500 text-xs">LUCK</p>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Empty State */}
      {products.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-400">No products available</p>
        </div>
      )}

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  );
}
