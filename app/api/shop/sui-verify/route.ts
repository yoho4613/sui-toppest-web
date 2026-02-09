/**
 * SUI Payment Verification API Route
 * Verifies that a SUI transaction was successful and grants rewards
 *
 * Flow:
 * 1. Client sends transaction digest after wallet execution
 * 2. Server verifies the transaction on-chain (instant, no polling needed)
 * 3. Server completes purchase and grants rewards atomically
 *
 * Unlike TON which required polling with timeouts,
 * SUI verification is instant via getTransactionBlock.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/sui-utils';
import { completePurchase, failPurchase, getPurchaseById } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { digest, purchaseId } = body as {
      digest: string;
      purchaseId: string;
    };

    // Validate input
    if (!digest || !purchaseId) {
      return NextResponse.json(
        { error: 'Missing required fields: digest, purchaseId' },
        { status: 400 }
      );
    }

    // Get purchase record
    const purchase = await getPurchaseById(purchaseId);
    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase not found' },
        { status: 404 }
      );
    }

    if (purchase.status !== 'pending') {
      return NextResponse.json(
        { error: `Purchase already ${purchase.status}` },
        { status: 400 }
      );
    }

    const recipientAddress = process.env.SUI_ADMIN_WALLET_ADDRESS;
    if (!recipientAddress) {
      return NextResponse.json(
        { error: 'Payment recipient not configured' },
        { status: 500 }
      );
    }

    // Verify the transaction on-chain
    const verification = await verifyPayment({
      digest,
      expectedRecipient: recipientAddress,
      expectedAmountMist: BigInt(purchase.amount_paid),
      tolerancePercent: 5,
    });

    if (!verification.verified) {
      // Mark purchase as failed
      await failPurchase(purchaseId, verification.error);
      return NextResponse.json(
        { error: `Payment verification failed: ${verification.error}` },
        { status: 400 }
      );
    }

    // Complete purchase and grant reward atomically
    const result = await completePurchase(
      purchaseId,
      digest,
      verification.sender || ''
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to complete purchase' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      digest,
      sender: verification.sender,
      amount: verification.actualAmount?.toString(),
      reward: {
        type: result.rewardType,
        amount: result.rewardAmount,
      },
    });
  } catch (error) {
    console.error('SUI verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
