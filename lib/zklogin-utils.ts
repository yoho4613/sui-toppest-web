/**
 * zkLogin Utility Functions
 * Helpers for SUI zkLogin implementation
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness } from '@mysten/sui/zklogin';
// Note: fromBase64/toBase64 not needed - SDK handles base64 strings directly

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;

// ZkProof type for zkLogin
export interface ZkProof {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}

// Client interface that works with both dapp-kit and direct SuiClient
interface SuiClientLike {
  getLatestSuiSystemState: () => Promise<{ epoch: string }>;
}

// Session storage keys
export const ZKLOGIN_STORAGE_KEYS = {
  EPHEMERAL_KEY: 'zklogin_ephemeral',
  RANDOMNESS: 'zklogin_randomness',
  MAX_EPOCH: 'zklogin_maxEpoch',
  JWT: 'zklogin_jwt',
  SALT: 'zklogin_salt',
  PROOF: 'zklogin_proof',
  ADDRESS: 'zklogin_address',
} as const;

/**
 * Generate ephemeral keypair and nonce for zkLogin
 */
export async function initZkLoginSession(client: SuiClientLike): Promise<{
  nonce: string;
  ephemeralKeyPair: Ed25519Keypair;
  randomness: string;
  maxEpoch: number;
}> {
  // Generate ephemeral keypair
  const ephemeralKeyPair = new Ed25519Keypair();

  // Get current epoch and set expiration (10 epochs = ~1 day)
  const { epoch } = await client.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 10;

  // Generate randomness and nonce
  const randomness = generateRandomness();
  const nonce = generateNonce(
    ephemeralKeyPair.getPublicKey(),
    maxEpoch,
    randomness
  );

  return {
    nonce,
    ephemeralKeyPair,
    randomness,
    maxEpoch,
  };
}

/**
 * Save zkLogin session to sessionStorage
 */
export function saveZkLoginSession(data: {
  ephemeralKeyPair: Ed25519Keypair;
  randomness: string;
  maxEpoch: number;
}): void {
  if (typeof window === 'undefined') return;

  // Export keypair - getSecretKey() returns base64 string in newer SDK
  const keypairExport = data.ephemeralKeyPair.getSecretKey();

  sessionStorage.setItem(
    ZKLOGIN_STORAGE_KEYS.EPHEMERAL_KEY,
    keypairExport
  );
  sessionStorage.setItem(ZKLOGIN_STORAGE_KEYS.RANDOMNESS, data.randomness);
  sessionStorage.setItem(
    ZKLOGIN_STORAGE_KEYS.MAX_EPOCH,
    data.maxEpoch.toString()
  );
}

/**
 * Load zkLogin session from sessionStorage
 */
export function loadZkLoginSession(): {
  ephemeralKeyPair: Ed25519Keypair | null;
  randomness: string | null;
  maxEpoch: number | null;
  jwt: string | null;
  salt: string | null;
  proof: ZkProof | null;
  address: string | null;
} | null {
  if (typeof window === 'undefined') return null;

  const ephemeralKeyB64 = sessionStorage.getItem(
    ZKLOGIN_STORAGE_KEYS.EPHEMERAL_KEY
  );
  const randomness = sessionStorage.getItem(ZKLOGIN_STORAGE_KEYS.RANDOMNESS);
  const maxEpochStr = sessionStorage.getItem(ZKLOGIN_STORAGE_KEYS.MAX_EPOCH);
  const jwt = sessionStorage.getItem(ZKLOGIN_STORAGE_KEYS.JWT);
  const salt = sessionStorage.getItem(ZKLOGIN_STORAGE_KEYS.SALT);
  const proofStr = sessionStorage.getItem(ZKLOGIN_STORAGE_KEYS.PROOF);
  const address = sessionStorage.getItem(ZKLOGIN_STORAGE_KEYS.ADDRESS);

  let ephemeralKeyPair: Ed25519Keypair | null = null;
  if (ephemeralKeyB64) {
    try {
      // fromSecretKey accepts base64 string directly in newer SDK
      ephemeralKeyPair = Ed25519Keypair.fromSecretKey(ephemeralKeyB64);
    } catch {
      ephemeralKeyPair = null;
    }
  }

  return {
    ephemeralKeyPair,
    randomness,
    maxEpoch: maxEpochStr ? Number(maxEpochStr) : null,
    jwt,
    salt,
    proof: proofStr ? JSON.parse(proofStr) : null,
    address,
  };
}

/**
 * Clear zkLogin session from sessionStorage
 */
export function clearZkLoginSession(): void {
  if (typeof window === 'undefined') return;

  Object.values(ZKLOGIN_STORAGE_KEYS).forEach((key) => {
    sessionStorage.removeItem(key);
  });
}

/**
 * Build Google OAuth URL for zkLogin
 */
export function buildGoogleOAuthUrl(nonce: string, redirectUri?: string): string {
  const redirect = redirectUri || `${window.location.origin}/auth/callback`;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirect,
    response_type: 'id_token',
    scope: 'openid email',
    nonce: nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Extract id_token from OAuth callback URL hash
 */
export function extractJwtFromCallback(): string | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('id_token');
}

/**
 * Generate a random salt (32 bytes as decimal string)
 */
export function generateSalt(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  // Convert to BigInt and then to string
  let result = BigInt(0);
  for (let i = 0; i < randomBytes.length; i++) {
    result = (result << BigInt(8)) + BigInt(randomBytes[i]);
  }

  return result.toString();
}

/**
 * Check if zkLogin session is valid (not expired)
 */
export async function isSessionValid(client: SuiClientLike): Promise<boolean> {
  const session = loadZkLoginSession();
  if (!session || !session.maxEpoch || !session.proof || !session.address) {
    return false;
  }

  try {
    const { epoch } = await client.getLatestSuiSystemState();
    return Number(epoch) < session.maxEpoch;
  } catch {
    return false;
  }
}
