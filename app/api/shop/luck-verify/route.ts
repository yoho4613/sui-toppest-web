/**
 * $LUCK Payment Verification API Route
 * Verifies that a $LUCK token transfer was successful and grants rewards
 *
 * Flow:
 * 1. Client sends transaction digest after wallet execution
 * 2. Server verifies the $LUCK transfer on-chain
 * 3. Server completes purchase and grants rewards atomically
 */

import { NextRequest, NextResponse } from 'next/server';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { completePurchase, failPurchase, getPurchaseById } from '@/lib/db';

const NETWORK = (process.env.SUI_NETWORK || process.env.NEXT_PUBLIC_SUI_NETWORK || 'devnet') as 'devnet' | 'testnet' | 'mainnet';

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
    const luckPackageId = process.env.SUI_LUCK_PACKAGE_ID;

    if (!recipientAddress || !luckPackageId) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const expectedCoinType = `${luckPackageId}::luck_token::LUCK_TOKEN`;

    // Verify the transaction on-chain
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });

    const txResponse = await client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showBalanceChanges: true,
      },
    });

    // Check transaction was successful
    if (txResponse.effects?.status?.status !== 'success') {
      await failPurchase(purchaseId, 'Transaction failed on-chain');
      return NextResponse.json(
        { error: 'Transaction failed on-chain' },
        { status: 400 }
      );
    }

    // Find the $LUCK balance change for the recipient
    const balanceChanges = txResponse.balanceChanges || [];
    const recipientChange = balanceChanges.find(
      (change) => {
        if (change.coinType !== expectedCoinType) return false;
        if (typeof change.owner !== 'object' || change.owner === null) return false;
        if (!('AddressOwner' in change.owner)) return false;
        return change.owner.AddressOwner === recipientAddress && BigInt(change.amount) > 0;
      }
    );

    if (!recipientChange) {
      await failPurchase(purchaseId, 'No $LUCK transfer to recipient found');
      return NextResponse.json(
        { error: 'No $LUCK transfer to recipient found in transaction' },
        { status: 400 }
      );
    }

    const actualAmount = BigInt(recipientChange.amount);
    const expectedAmountBigInt = BigInt(purchase.amount_paid);

    // Allow 1% tolerance for rounding
    const minAmount = expectedAmountBigInt - (expectedAmountBigInt / 100n);

    if (actualAmount < minAmount) {
      await failPurchase(purchaseId, `Insufficient amount: ${actualAmount.toString()}`);
      return NextResponse.json(
        { error: `Insufficient $LUCK amount. Expected: ${purchase.amount_paid}, Got: ${actualAmount.toString()}` },
        { status: 400 }
      );
    }

    // Find sender address
    const senderChange = balanceChanges.find(
      (change) =>
        change.coinType === expectedCoinType &&
        BigInt(change.amount) < 0
    );

    let sender: string | null = null;
    if (senderChange && typeof senderChange.owner === 'object' && senderChange.owner !== null && 'AddressOwner' in senderChange.owner) {
      sender = senderChange.owner.AddressOwner;
    }

    // Complete purchase and grant reward atomically
    const result = await completePurchase(
      purchaseId,
      digest,
      sender || ''
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
      sender,
      amount: actualAmount.toString(),
      coinType: expectedCoinType,
      reward: {
        type: result.rewardType,
        amount: result.rewardAmount,
      },
    });
  } catch (error) {
    console.error('LUCK verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
