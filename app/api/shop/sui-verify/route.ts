/**
 * SUI Payment Verification API Route
 * Verifies that a SUI transaction was successful and grants spins
 *
 * Flow:
 * 1. Client sends transaction digest after wallet execution
 * 2. Server verifies the transaction on-chain (instant, no polling needed)
 * 3. Server grants spins to the user
 *
 * Unlike TON which required polling with timeouts,
 * SUI verification is instant via getTransactionBlock.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/sui-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { digest, userId, packageId, expectedAmountMist } = body as {
      digest: string;
      userId: string;
      packageId: string;
      expectedAmountMist: string;
    };

    // Validate input
    if (!digest || !userId || !packageId || !expectedAmountMist) {
      return NextResponse.json(
        { error: 'Missing required fields: digest, userId, packageId, expectedAmountMist' },
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
      expectedAmountMist: BigInt(expectedAmountMist),
      tolerancePercent: 5,
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: `Payment verification failed: ${verification.error}` },
        { status: 400 }
      );
    }

    // TODO: Update purchase record in Supabase
    // await supabase.from('purchases').update({
    //   status: 'completed',
    //   transaction_digest: digest,
    //   sender_address: verification.sender,
    //   actual_amount_mist: verification.actualAmount?.toString(),
    //   verified_at: new Date().toISOString(),
    // }).eq('user_id', userId).eq('package_id', packageId).eq('status', 'pending');

    // TODO: Grant spins to user
    // await supabase.rpc('add_spins', { p_user_id: userId, p_spins: package.spins });

    return NextResponse.json({
      success: true,
      verified: true,
      digest,
      sender: verification.sender,
      amount: verification.actualAmount?.toString(),
    });
  } catch (error) {
    console.error('SUI verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
