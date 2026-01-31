/**
 * Server-side SUI Transfer Module
 * Replaces ton-transfer.ts from the TON version
 *
 * Key differences from TON:
 * - Uses Ed25519Keypair instead of mnemonic-based wallet
 * - PTB (Programmable Transaction Blocks) for batch operations
 * - Single atomic transaction for multiple transfers (vs TON's sequential 1s-delay sends)
 * - Instant finality (no polling needed)
 *
 * IMPORTANT: This file runs server-side only. Never expose private keys to the client.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const NETWORK = (process.env.SUI_NETWORK || process.env.NEXT_PUBLIC_SUI_NETWORK || 'devnet') as 'devnet' | 'testnet' | 'mainnet';

// === Internal Helpers ===

function getAdminKeypair(): Ed25519Keypair {
  const privateKey = process.env.SUI_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('SUI_ADMIN_PRIVATE_KEY not configured in environment variables');
  }

  // SUI private keys are bech32-encoded: suiprivkey1...
  const { secretKey } = decodeSuiPrivateKey(privateKey);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

function getServerClient(): SuiClient {
  return new SuiClient({ url: getFullnodeUrl(NETWORK) });
}

// === Transfer Results ===

export interface TransferResult {
  success: boolean;
  digest?: string;
  error?: string;
}

// === SUI Transfers ===

/**
 * Send SUI from admin wallet to a recipient
 * Used for: prize payouts, reward distribution
 */
export async function sendSui(params: {
  toAddress: string;
  amountMist: bigint;
}): Promise<TransferResult> {
  const client = getServerClient();
  const keypair = getAdminKeypair();

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [params.amountMist]);
  tx.transferObjects([coin], params.toAddress);

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true },
    });

    const success = result.effects?.status?.status === 'success';
    return {
      success,
      digest: result.digest,
      error: success ? undefined : result.effects?.status?.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transfer failed',
    };
  }
}

/**
 * Batch send SUI to multiple recipients in a single atomic transaction
 * Used for: leaderboard payouts, weekly rewards
 *
 * Major advantage over TON: all transfers execute in ONE transaction
 * (TON required sequential sends with 1-second delays between each)
 */
export async function batchSendSui(transfers: Array<{
  toAddress: string;
  amountMist: bigint;
}>): Promise<TransferResult> {
  if (transfers.length === 0) {
    return { success: false, error: 'Empty transfer list' };
  }

  const client = getServerClient();
  const keypair = getAdminKeypair();

  const tx = new Transaction();

  for (const transfer of transfers) {
    const [coin] = tx.splitCoins(tx.gas, [transfer.amountMist]);
    tx.transferObjects([coin], transfer.toAddress);
  }

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true },
    });

    const success = result.effects?.status?.status === 'success';
    return {
      success,
      digest: result.digest,
      error: success ? undefined : result.effects?.status?.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Batch transfer failed',
    };
  }
}

// === $LUCK Token Transfers ===

/**
 * Mint $LUCK tokens to a recipient
 * Calls the luck_token::mint Move function via PTB
 * Used for: game rewards, airdrops
 */
export async function mintLuckTokens(params: {
  toAddress: string;
  amount: bigint; // in token units with decimals (9 decimals)
}): Promise<TransferResult> {
  const client = getServerClient();
  const keypair = getAdminKeypair();
  const packageId = process.env.SUI_LUCK_PACKAGE_ID;
  const treasuryCapId = process.env.SUI_LUCK_TREASURY_CAP_ID;

  if (!packageId || !treasuryCapId) {
    return {
      success: false,
      error: 'SUI_LUCK_PACKAGE_ID or SUI_LUCK_TREASURY_CAP_ID not configured',
    };
  }

  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::luck_token::mint`,
    arguments: [
      tx.object(treasuryCapId),
      tx.pure.u64(params.amount),
      tx.pure.address(params.toAddress),
    ],
  });

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true },
    });

    const success = result.effects?.status?.status === 'success';
    return {
      success,
      digest: result.digest,
      error: success ? undefined : result.effects?.status?.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Mint failed',
    };
  }
}

/**
 * Batch mint $LUCK tokens to multiple recipients
 * Uses the luck_token::mint_batch Move function
 * Used for: leaderboard LUCK rewards, airdrop distribution
 */
export async function batchMintLuckTokens(recipients: Array<{
  toAddress: string;
  amount: bigint;
}>): Promise<TransferResult> {
  if (recipients.length === 0) {
    return { success: false, error: 'Empty recipient list' };
  }

  const client = getServerClient();
  const keypair = getAdminKeypair();
  const packageId = process.env.SUI_LUCK_PACKAGE_ID;
  const treasuryCapId = process.env.SUI_LUCK_TREASURY_CAP_ID;

  if (!packageId || !treasuryCapId) {
    return {
      success: false,
      error: 'SUI_LUCK_PACKAGE_ID or SUI_LUCK_TREASURY_CAP_ID not configured',
    };
  }

  const tx = new Transaction();
  const amounts = recipients.map(r => r.amount);
  const addresses = recipients.map(r => r.toAddress);

  tx.moveCall({
    target: `${packageId}::luck_token::mint_batch`,
    arguments: [
      tx.object(treasuryCapId),
      tx.pure.vector('u64', amounts),
      tx.pure.vector('address', addresses),
    ],
  });

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true },
    });

    const success = result.effects?.status?.status === 'success';
    return {
      success,
      digest: result.digest,
      error: success ? undefined : result.effects?.status?.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Batch mint failed',
    };
  }
}

// === Reward Pool Operations ===

/**
 * Distribute SUI reward from the reward pool to a winner
 * Calls reward_pool::distribute_reward
 */
export async function distributeRewardFromPool(params: {
  recipientAddress: string;
  amountMist: bigint;
}): Promise<TransferResult> {
  const client = getServerClient();
  const keypair = getAdminKeypair();
  const packageId = process.env.SUI_LUCK_PACKAGE_ID;
  const rewardPoolId = process.env.SUI_REWARD_POOL_ID;

  if (!packageId || !rewardPoolId) {
    return {
      success: false,
      error: 'SUI_LUCK_PACKAGE_ID or SUI_REWARD_POOL_ID not configured',
    };
  }

  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::reward_pool::distribute_reward`,
    arguments: [
      tx.object(rewardPoolId),
      tx.pure.u64(params.amountMist),
      tx.pure.address(params.recipientAddress),
    ],
  });

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true },
    });

    const success = result.effects?.status?.status === 'success';
    return {
      success,
      digest: result.digest,
      error: success ? undefined : result.effects?.status?.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Reward distribution failed',
    };
  }
}

/**
 * Get admin wallet balance
 */
export async function getAdminBalance(): Promise<{ sui: string; error?: string }> {
  try {
    const client = getServerClient();
    const keypair = getAdminKeypair();
    const address = keypair.getPublicKey().toSuiAddress();
    const balance = await client.getBalance({ owner: address });
    return { sui: balance.totalBalance };
  } catch (error) {
    return {
      sui: '0',
      error: error instanceof Error ? error.message : 'Failed to get balance',
    };
  }
}

/**
 * Get admin wallet address (for display/verification)
 */
export function getAdminAddress(): string {
  const keypair = getAdminKeypair();
  return keypair.getPublicKey().toSuiAddress();
}
