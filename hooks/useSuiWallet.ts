'use client';

import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useDisconnectWallet,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useCallback } from 'react';

export interface SendSuiResult {
  success: boolean;
  digest?: string;
  error?: string;
}

export function useSuiWallet() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { mutate: disconnect } = useDisconnectWallet();

  const isConnected = !!account;
  const address = account?.address || null;

  /**
   * Send SUI to a recipient address
   * @param recipientAddress - Target SUI address (0x...)
   * @param amountInMist - Amount in MIST (1 SUI = 1_000_000_000 MIST)
   */
  const sendSui = useCallback(async (
    recipientAddress: string,
    amountInMist: bigint,
  ): Promise<SendSuiResult> => {
    if (!account) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      // Get all SUI coins
      const coins = await client.getCoins({
        owner: account.address,
        coinType: '0x2::sui::SUI',
      });

      if (coins.data.length === 0) {
        return { success: false, error: 'No SUI coins found' };
      }

      // Check total balance
      const totalBalance = coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
      const requiredAmount = amountInMist + BigInt(10_000_000); // transfer + gas buffer
      if (totalBalance < requiredAmount) {
        return { success: false, error: `Insufficient SUI balance` };
      }

      const tx = new Transaction();

      // Set all coins as gas payment sources - SDK will merge them if needed
      tx.setGasPayment(coins.data.map(c => ({
        objectId: c.coinObjectId,
        version: c.version,
        digest: c.digest,
      })));

      // Split from gas (which now has access to all coins)
      const [splitCoin] = tx.splitCoins(tx.gas, [amountInMist]);
      tx.transferObjects([splitCoin], recipientAddress);

      // Set gas budget explicitly
      tx.setGasBudget(10_000_000); // 0.01 SUI

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await signAndExecute({
        transaction: tx as any,
      });

      return {
        success: true,
        digest: result.digest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';

      // Detect network mismatch errors
      if (errorMessage.includes('notExists') ||
          errorMessage.includes('No valid SUI') ||
          errorMessage.includes('input objects are invalid')) {
        return {
          success: false,
          error: 'Network mismatch: Please switch your wallet to Devnet in wallet settings.',
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [account, client, signAndExecute]);

  /**
   * Get SUI balance for the connected wallet
   * @returns Balance in MIST as string
   */
  const getBalance = useCallback(async (): Promise<string> => {
    if (!account) return '0';
    try {
      const balance = await client.getBalance({ owner: account.address });
      return balance.totalBalance;
    } catch {
      return '0';
    }
  }, [account, client]);

  /**
   * Get $LUCK token balance for the connected wallet
   * @param coinType - Full coin type (e.g., "0xPACKAGE::luck_token::LUCK_TOKEN")
   */
  const getTokenBalance = useCallback(async (coinType: string): Promise<string> => {
    if (!account) return '0';
    try {
      const balance = await client.getBalance({
        owner: account.address,
        coinType,
      });
      return balance.totalBalance;
    } catch {
      return '0';
    }
  }, [account, client]);

  /**
   * Send custom token (like $LUCK) to a recipient address
   * @param coinType - Full coin type (e.g., "0xPACKAGE::luck_token::LUCK_TOKEN")
   * @param recipientAddress - Target SUI address (0x...)
   * @param amount - Amount in smallest unit (with decimals applied)
   */
  const sendToken = useCallback(async (
    coinType: string,
    recipientAddress: string,
    amount: bigint,
  ): Promise<SendSuiResult> => {
    if (!account) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      // Get all coins of the specified type owned by the user (fresh data)
      const coins = await client.getCoins({
        owner: account.address,
        coinType,
      });

      if (coins.data.length === 0) {
        return { success: false, error: 'No tokens found in wallet' };
      }

      // Calculate total balance
      const totalBalance = coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
      if (totalBalance < amount) {
        return { success: false, error: `Insufficient balance: have ${totalBalance}, need ${amount}` };
      }

      const tx = new Transaction();

      // If we have multiple coins, merge them first
      if (coins.data.length > 1) {
        const [primaryCoin, ...otherCoins] = coins.data;
        if (otherCoins.length > 0) {
          tx.mergeCoins(
            tx.object(primaryCoin.coinObjectId),
            otherCoins.map(c => tx.object(c.coinObjectId))
          );
        }
        const [splitCoin] = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [amount]);
        tx.transferObjects([splitCoin], recipientAddress);
      } else {
        // Single coin, just split and transfer
        const [splitCoin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [amount]);
        tx.transferObjects([splitCoin], recipientAddress);
      }

      // Set gas budget explicitly
      tx.setGasBudget(10_000_000); // 0.01 SUI

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await signAndExecute({
        transaction: tx as any,
      });

      return {
        success: true,
        digest: result.digest,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';

      // Detect network mismatch errors
      if (errorMessage.includes('notExists') ||
          errorMessage.includes('No valid SUI') ||
          errorMessage.includes('input objects are invalid')) {
        return {
          success: false,
          error: 'Network mismatch: Please switch your wallet to Devnet in wallet settings.',
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [account, client, signAndExecute]);

  return {
    isConnected,
    address,
    account,
    sendSui,
    sendToken,
    getBalance,
    getTokenBalance,
    disconnect,
    signAndExecute,
    client,
  };
}
