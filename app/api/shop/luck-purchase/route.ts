/**
 * $LUCK Token Purchase API Route
 * Creates a purchase intent for spin packages paid with $LUCK tokens
 *
 * Flow:
 * 1. Client calls this route with package ID and user info
 * 2. Server returns the expected $LUCK amount and recipient
 * 3. Client transfers $LUCK tokens using sendToken
 * 4. Client sends the transaction digest to /api/shop/luck-verify
 */

import { NextRequest, NextResponse } from 'next/server';

// Spin package definitions with $LUCK pricing
// $LUCK is discounted compared to SUI to incentivize token usage
const SPIN_PACKAGES = {
  'pack_10': { spins: 10, luckPrice: 100, label: '10 Spins' },
  'pack_30': { spins: 30, luckPrice: 250, label: '30 Spins (+17% discount)' },
  'pack_100': { spins: 100, luckPrice: 700, label: '100 Spins (+30% discount)' },
} as const;

type PackageId = keyof typeof SPIN_PACKAGES;

// $LUCK has 9 decimals (same as SUI)
const LUCK_DECIMALS = 9;

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

    // Calculate amount with decimals
    const amountWithDecimals = BigInt(pkg.luckPrice) * BigInt(10 ** LUCK_DECIMALS);

    // Admin wallet address (where $LUCK payment should be sent)
    const recipientAddress = process.env.SUI_ADMIN_WALLET_ADDRESS;
    if (!recipientAddress) {
      return NextResponse.json(
        { error: 'Payment recipient not configured' },
        { status: 500 }
      );
    }

    // Package ID for $LUCK token type
    const luckPackageId = process.env.SUI_LUCK_PACKAGE_ID;
    if (!luckPackageId) {
      return NextResponse.json(
        { error: 'LUCK token package not configured' },
        { status: 500 }
      );
    }

    const coinType = `${luckPackageId}::luck_token::LUCK_TOKEN`;

    return NextResponse.json({
      success: true,
      purchase: {
        packageId,
        spins: pkg.spins,
        label: pkg.label,
        luckAmount: pkg.luckPrice,
        amountWithDecimals: amountWithDecimals.toString(),
        recipientAddress,
        coinType,
      },
    });
  } catch (error) {
    console.error('LUCK purchase error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
