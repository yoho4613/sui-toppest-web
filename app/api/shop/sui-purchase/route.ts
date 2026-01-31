/**
 * SUI Purchase API Route
 * Creates a purchase intent for spin packages paid with SUI
 *
 * Flow:
 * 1. Client calls this route with package ID and user info
 * 2. Server creates a pending purchase record with expected amount
 * 3. Client builds a PTB, signs with wallet, executes transaction
 * 4. Client sends the transaction digest to /api/shop/sui-verify
 *
 * Unlike TON which generated a BOC + comment for identification,
 * SUI uses the transaction digest directly for verification.
 */

import { NextRequest, NextResponse } from 'next/server';

// Spin package definitions
const SPIN_PACKAGES = {
  'pack_10': { spins: 10, priceUsd: 1.75, label: '10 Spins' },
  'pack_30': { spins: 30, priceUsd: 4.20, label: '30 Spins (+20% bonus)' },
  'pack_100': { spins: 100, priceUsd: 12.25, label: '100 Spins (+30% bonus)' },
} as const;

type PackageId = keyof typeof SPIN_PACKAGES;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { packageId, userId, walletAddress } = body as {
      packageId: string;
      userId: string;
      walletAddress: string;
    };

    // Validate input
    if (!packageId || !userId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: packageId, userId, walletAddress' },
        { status: 400 }
      );
    }

    const pkg = SPIN_PACKAGES[packageId as PackageId];
    if (!pkg) {
      return NextResponse.json(
        { error: `Invalid package ID: ${packageId}` },
        { status: 400 }
      );
    }

    // Get SUI price (in production, fetch from oracle or price feed)
    const suiUsdPrice = parseFloat(process.env.SUI_USD_PRICE || '1.5');
    const suiAmount = pkg.priceUsd / suiUsdPrice;
    const amountMist = BigInt(Math.round(suiAmount * 1_000_000_000));

    // Admin wallet address (where payment should be sent)
    const recipientAddress = process.env.SUI_ADMIN_WALLET_ADDRESS;
    if (!recipientAddress) {
      return NextResponse.json(
        { error: 'Payment recipient not configured' },
        { status: 500 }
      );
    }

    // TODO: Create pending purchase record in Supabase
    // const purchase = await supabase.from('purchases').insert({
    //   user_id: userId,
    //   package_id: packageId,
    //   spins: pkg.spins,
    //   amount_mist: amountMist.toString(),
    //   sui_amount: suiAmount,
    //   usd_amount: pkg.priceUsd,
    //   wallet_address: walletAddress,
    //   status: 'pending',
    //   payment_method: 'sui',
    // }).select().single();

    return NextResponse.json({
      success: true,
      purchase: {
        packageId,
        spins: pkg.spins,
        label: pkg.label,
        priceUsd: pkg.priceUsd,
        suiAmount: suiAmount.toFixed(4),
        amountMist: amountMist.toString(),
        recipientAddress,
      },
    });
  } catch (error) {
    console.error('SUI purchase error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
