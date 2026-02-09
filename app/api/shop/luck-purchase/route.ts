/**
 * $LUCK Token Purchase API Route
 * Creates a purchase intent for products paid with $LUCK tokens
 *
 * Flow:
 * 1. Client calls this route with product ID and user info
 * 2. Server creates a pending purchase record with expected amount
 * 3. Client transfers $LUCK tokens using sendToken
 * 4. Client sends the transaction digest to /api/shop/luck-verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProductById, createPurchase } from '@/lib/db';

// $LUCK has 9 decimals (same as SUI)
const LUCK_DECIMALS = 9;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, walletAddress } = body as {
      productId: string;
      walletAddress: string;
    };

    // Validate input
    if (!productId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, walletAddress' },
        { status: 400 }
      );
    }

    // Get product from DB
    const product = await getProductById(productId);
    if (!product) {
      return NextResponse.json(
        { error: `Product not found: ${productId}` },
        { status: 400 }
      );
    }

    // Calculate amount with decimals
    const amountWithDecimals = BigInt(product.price_luck) * BigInt(10 ** LUCK_DECIMALS);

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

    // Create pending purchase record in DB
    const purchaseResult = await createPurchase({
      wallet_address: walletAddress,
      product_id: productId,
      payment_method: 'luck',
      amount_paid: amountWithDecimals.toString(),
    });

    if (!purchaseResult.success || !purchaseResult.purchase) {
      return NextResponse.json(
        { error: purchaseResult.error || 'Failed to create purchase' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      purchase: {
        purchaseId: purchaseResult.purchase.id,
        productId,
        productName: product.name,
        rewardType: product.reward_type,
        rewardAmount: product.reward_amount,
        luckAmount: product.price_luck,
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
