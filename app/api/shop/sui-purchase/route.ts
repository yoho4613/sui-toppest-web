/**
 * SUI Purchase API Route
 * Creates a purchase intent for products paid with SUI
 *
 * Flow:
 * 1. Client calls this route with product ID and user info
 * 2. Server creates a pending purchase record with expected amount
 * 3. Client builds a PTB, signs with wallet, executes transaction
 * 4. Client sends the transaction digest to /api/shop/sui-verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProductById, createPurchase } from '@/lib/db';

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

    // Calculate SUI amount
    const suiUsdPrice = parseFloat(process.env.SUI_USD_PRICE || '1.5');
    const suiAmount = product.price_usd / suiUsdPrice;
    const amountMist = BigInt(Math.ceil(suiAmount * 1_000_000_000));

    // Admin wallet address (where payment should be sent)
    const recipientAddress = process.env.SUI_ADMIN_WALLET_ADDRESS;
    if (!recipientAddress) {
      return NextResponse.json(
        { error: 'Payment recipient not configured' },
        { status: 500 }
      );
    }

    // Create pending purchase record in DB
    const purchaseResult = await createPurchase({
      wallet_address: walletAddress,
      product_id: productId,
      payment_method: 'sui',
      amount_paid: amountMist.toString(),
      price_usd: product.price_usd,
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
        priceUsd: product.price_usd,
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
