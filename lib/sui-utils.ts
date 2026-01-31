/**
 * SUI Blockchain Utilities
 * Replaces ton-utils.ts from the TON version
 *
 * Key difference from TON:
 * - SUI returns transaction results instantly (no polling needed)
 * - Transaction digest is the unique identifier (replaces BOC hash)
 * - Sub-second finality vs TON's polling-based confirmation
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'devnet') as 'devnet' | 'testnet' | 'mainnet';

// === Client ===

let _client: SuiClient | null = null;

export function getSuiClient(): SuiClient {
  if (!_client) {
    _client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
  }
  return _client;
}

// === Transaction Verification ===

export interface SuiTransactionResult {
  success: boolean;
  status: 'confirmed' | 'failed';
  digest: string;
  sender?: string;
  gasUsed?: string;
  errorMessage?: string;
}

/**
 * Verify a SUI transaction by its digest
 * Unlike TON which requires 60-second polling, SUI provides instant verification
 */
export async function verifyTransaction(digest: string): Promise<SuiTransactionResult> {
  const client = getSuiClient();

  try {
    const txResponse = await client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
      },
    });

    const status = txResponse.effects?.status?.status;
    const sender = txResponse.transaction?.data?.sender;
    const gasUsed = txResponse.effects?.gasUsed;
    const totalGas = gasUsed
      ? (BigInt(gasUsed.computationCost) + BigInt(gasUsed.storageCost) - BigInt(gasUsed.storageRebate)).toString()
      : undefined;

    return {
      success: status === 'success',
      status: status === 'success' ? 'confirmed' : 'failed',
      digest,
      sender,
      gasUsed: totalGas,
      errorMessage: status !== 'success'
        ? txResponse.effects?.status?.error || 'Transaction failed'
        : undefined,
    };
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      digest,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify a SUI payment transaction
 * Checks that the correct amount was sent to the expected recipient
 */
export async function verifyPayment(params: {
  digest: string;
  expectedRecipient: string;
  expectedAmountMist: bigint;
  tolerancePercent?: number; // default 5%
}): Promise<{
  verified: boolean;
  actualAmount?: bigint;
  sender?: string;
  error?: string;
}> {
  const { digest, expectedRecipient, expectedAmountMist, tolerancePercent = 5 } = params;
  const client = getSuiClient();

  try {
    const txResponse = await client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showBalanceChanges: true,
        showInput: true,
      },
    });

    if (txResponse.effects?.status?.status !== 'success') {
      return { verified: false, error: 'Transaction failed' };
    }

    const sender = txResponse.transaction?.data?.sender;
    const balanceChanges = txResponse.balanceChanges || [];

    // Find the recipient's balance change for SUI
    const recipientChange = balanceChanges.find(
      (change) =>
        'AddressOwner' in (change.owner as Record<string, unknown>) &&
        (change.owner as { AddressOwner: string }).AddressOwner === expectedRecipient &&
        change.coinType === '0x2::sui::SUI'
    );

    if (!recipientChange) {
      return { verified: false, sender, error: 'Recipient did not receive SUI in this transaction' };
    }

    const actualAmount = BigInt(recipientChange.amount);
    const minAmount = expectedAmountMist - (expectedAmountMist * BigInt(tolerancePercent)) / 100n;

    if (actualAmount < minAmount) {
      return {
        verified: false,
        actualAmount,
        sender,
        error: `Insufficient amount: expected ${expectedAmountMist}, received ${actualAmount}`,
      };
    }

    return {
      verified: true,
      actualAmount,
      sender,
    };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

// === Address Utilities ===

/**
 * Validate a SUI address format (0x + 64 hex characters)
 */
export function isValidSuiAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

/**
 * Shorten a SUI address for display (e.g., 0x1234...abcd)
 */
export function shortenAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// === Explorer URLs ===

/**
 * Get SUI Explorer URL for a transaction
 */
export function getExplorerTxUrl(digest: string): string {
  if (NETWORK === 'mainnet') {
    return `https://suiscan.xyz/mainnet/tx/${digest}`;
  }
  return `https://suiscan.xyz/${NETWORK}/tx/${digest}`;
}

/**
 * Get SUI Explorer URL for an address
 */
export function getExplorerAddressUrl(address: string): string {
  if (NETWORK === 'mainnet') {
    return `https://suiscan.xyz/mainnet/account/${address}`;
  }
  return `https://suiscan.xyz/${NETWORK}/account/${address}`;
}

/**
 * Get SUI Explorer URL for a coin/object
 */
export function getExplorerObjectUrl(objectId: string): string {
  if (NETWORK === 'mainnet') {
    return `https://suiscan.xyz/mainnet/object/${objectId}`;
  }
  return `https://suiscan.xyz/${NETWORK}/object/${objectId}`;
}

// === Conversion Utilities ===

/** Convert SUI to MIST (1 SUI = 10^9 MIST) */
export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * 1_000_000_000));
}

/** Convert MIST to SUI */
export function mistToSui(mist: bigint | string): number {
  return Number(BigInt(mist)) / 1_000_000_000;
}

/** Format MIST amount as SUI string for display */
export function formatSui(mist: bigint | string, decimals: number = 4): string {
  const sui = mistToSui(mist);
  return sui.toFixed(decimals);
}
