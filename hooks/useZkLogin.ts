'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import {
  getExtendedEphemeralPublicKey,
  genAddressSeed,
  getZkLoginSignature,
} from '@mysten/sui/zklogin';
import { jwtDecode } from 'jwt-decode';
import {
  initZkLoginSession,
  saveZkLoginSession,
  loadZkLoginSession,
  clearZkLoginSession,
  buildGoogleOAuthUrl,
  ZKLOGIN_STORAGE_KEYS,
  ZkProof,
} from '@/lib/zklogin-utils';

interface JwtPayload {
  sub: string;
  aud: string | string[];
  email?: string;
  name?: string;
  picture?: string;
  exp?: number;
}

export interface ZkLoginUserInfo {
  email: string | null;
  name: string | null;
  picture: string | null;
  sub: string | null;
}

// ZkProof type is imported from zklogin-utils

export interface UseZkLoginResult {
  // State
  isLoading: boolean;
  isAuthenticated: boolean;
  address: string | null;
  error: string | null;
  userInfo: ZkLoginUserInfo | null;

  // Actions
  login: () => Promise<void>;
  logout: () => void;
  handleCallback: () => Promise<boolean>;
  signAndExecuteTransaction: (
    tx: Transaction
  ) => Promise<{ success: boolean; digest?: string; error?: string }>;
}

const PROVER_URL =
  process.env.NEXT_PUBLIC_PROVER_URL || 'https://prover-dev.mystenlabs.com/v1';

export function useZkLogin(): UseZkLoginResult {
  const client = useSuiClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<ZkLoginUserInfo | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const session = loadZkLoginSession();
    if (session?.address && session?.proof) {
      setAddress(session.address);
      setIsAuthenticated(true);

      // Load user info from JWT if available
      if (session.jwt) {
        try {
          const decoded = jwtDecode<JwtPayload>(session.jwt);
          setUserInfo({
            email: decoded.email || null,
            name: decoded.name || null,
            picture: decoded.picture || null,
            sub: decoded.sub || null,
          });
        } catch {
          // JWT decode failed, ignore
        }
      }
    }
  }, []);

  /**
   * Start Google OAuth login flow
   */
  const login = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Initialize zkLogin session (generate keypair, nonce, etc.)
      const { nonce, ephemeralKeyPair, randomness, maxEpoch } =
        await initZkLoginSession(client);

      // Save session data to sessionStorage
      saveZkLoginSession({ ephemeralKeyPair, randomness, maxEpoch });

      // Redirect to Google OAuth
      const oauthUrl = buildGoogleOAuthUrl(nonce);
      window.location.href = oauthUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsLoading(false);
    }
  }, [client]);

  /**
   * Handle OAuth callback - process JWT and get ZK proof
   */
  const handleCallback = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Extract JWT from URL hash
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const jwt = params.get('id_token');

      if (!jwt) {
        throw new Error('No id_token in callback URL');
      }

      // Decode JWT
      const decodedJwt = jwtDecode<JwtPayload>(jwt);

      // Load session data
      const session = loadZkLoginSession();
      if (
        !session?.ephemeralKeyPair ||
        !session?.randomness ||
        !session?.maxEpoch
      ) {
        throw new Error('Session expired. Please try logging in again.');
      }

      // Get salt from our API
      const saltResponse = await fetch('/api/auth/salt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwt }),
      });

      if (!saltResponse.ok) {
        const saltError = await saltResponse.json();
        throw new Error(saltError.error || 'Failed to get salt');
      }

      const { salt } = await saltResponse.json();

      // Get extended ephemeral public key
      const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
        session.ephemeralKeyPair.getPublicKey()
      );

      // Request ZK proof from prover
      const proofResponse = await fetch(PROVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jwt,
          extendedEphemeralPublicKey,
          maxEpoch: session.maxEpoch,
          jwtRandomness: session.randomness,
          salt,
          keyClaimName: 'sub',
        }),
      });

      if (!proofResponse.ok) {
        const proofError = await proofResponse.text();
        console.error('Prover error:', proofError);
        throw new Error('Failed to get ZK proof');
      }

      const proof: ZkProof = await proofResponse.json();

      // Compute zkLogin address
      const aud = Array.isArray(decodedJwt.aud)
        ? decodedJwt.aud[0]
        : decodedJwt.aud;

      const addressSeed = genAddressSeed(
        BigInt(salt),
        'sub',
        decodedJwt.sub,
        aud
      ).toString();

      // Import jwtToAddress from zklogin
      const { jwtToAddress } = await import('@mysten/sui/zklogin');
      const zkAddress = jwtToAddress(jwt, salt);

      // Save complete session
      sessionStorage.setItem(ZKLOGIN_STORAGE_KEYS.JWT, jwt);
      sessionStorage.setItem(ZKLOGIN_STORAGE_KEYS.SALT, salt);
      sessionStorage.setItem(ZKLOGIN_STORAGE_KEYS.PROOF, JSON.stringify(proof));
      sessionStorage.setItem(ZKLOGIN_STORAGE_KEYS.ADDRESS, zkAddress);

      setAddress(zkAddress);
      setIsAuthenticated(true);
      setUserInfo({
        email: decodedJwt.email || null,
        name: decodedJwt.name || null,
        picture: decodedJwt.picture || null,
        sub: decodedJwt.sub || null,
      });
      setIsLoading(false);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Callback processing failed');
      setIsLoading(false);
      return false;
    }
  }, []);

  /**
   * Sign and execute a transaction using zkLogin
   */
  const signAndExecuteTransaction = useCallback(
    async (
      tx: Transaction
    ): Promise<{ success: boolean; digest?: string; error?: string }> => {
      const session = loadZkLoginSession();

      if (
        !session?.ephemeralKeyPair ||
        !session?.proof ||
        !session?.salt ||
        !session?.jwt ||
        !session?.maxEpoch ||
        !session?.address
      ) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        // Decode JWT for address seed calculation
        const decodedJwt = jwtDecode<JwtPayload>(session.jwt);
        const aud = Array.isArray(decodedJwt.aud)
          ? decodedJwt.aud[0]
          : decodedJwt.aud;

        const addressSeed = genAddressSeed(
          BigInt(session.salt),
          'sub',
          decodedJwt.sub,
          aud
        ).toString();

        // Set transaction sender
        tx.setSender(session.address);

        // Sign with ephemeral key
        const { bytes, signature: userSignature } = await tx.sign({
          client: client as any,
          signer: session.ephemeralKeyPair,
        });

        // Assemble zkLogin signature
        const zkLoginSignature = getZkLoginSignature({
          inputs: {
            ...session.proof,
            addressSeed,
          },
          maxEpoch: session.maxEpoch,
          userSignature,
        });

        // Execute transaction
        const result = await client.executeTransactionBlock({
          transactionBlock: bytes,
          signature: zkLoginSignature,
        });

        return {
          success: true,
          digest: result.digest,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Transaction failed',
        };
      }
    },
    [client]
  );

  /**
   * Logout and clear session
   */
  const logout = useCallback(() => {
    clearZkLoginSession();
    setAddress(null);
    setIsAuthenticated(false);
    setError(null);
    setUserInfo(null);
  }, []);

  return {
    isLoading,
    isAuthenticated,
    address,
    error,
    userInfo,
    login,
    logout,
    handleCallback,
    signAndExecuteTransaction,
  };
}
