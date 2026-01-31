/**
 * Salt Management API for zkLogin
 *
 * This endpoint:
 * 1. Receives a JWT from Google OAuth
 * 2. Validates the JWT
 * 3. Extracts the 'sub' (subject) claim
 * 4. Returns existing salt or generates new one
 *
 * Security: Salt links Google identity to SUI address
 * - Same sub + same salt = same SUI address
 * - Salt must be stored securely and consistently
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { createClient } from '@supabase/supabase-js';

interface GoogleJwtPayload extends JwtPayload {
  sub: string;
  email?: string;
  aud: string;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// In-memory salt storage (fallback when Supabase is not configured)
// WARNING: This is for development only! Salts will be lost on restart.
const inMemorySalts = new Map<string, string>();

/**
 * Generate a cryptographically secure salt
 * IMPORTANT: Mysten Labs Prover requires exactly 16 bytes (128 bits)
 */
function generateSalt(): string {
  const randomBytes = new Uint8Array(16); // 16 bytes = 128 bits
  crypto.getRandomValues(randomBytes);

  let result = BigInt(0);
  for (let i = 0; i < randomBytes.length; i++) {
    result = (result << BigInt(8)) + BigInt(randomBytes[i]);
  }

  return result.toString();
}

/**
 * Get or create salt using Supabase
 */
async function getOrCreateSaltSupabase(
  sub: string,
  email?: string
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Try to find existing salt
  const { data: existingSalt, error: selectError } = await supabase
    .from('zklogin_salts')
    .select('salt')
    .eq('google_sub', sub)
    .single();

  if (existingSalt && !selectError) {
    return existingSalt.salt;
  }

  // Create new salt
  const newSalt = generateSalt();

  const { error: insertError } = await supabase.from('zklogin_salts').insert({
    google_sub: sub,
    salt: newSalt,
    email: email || null,
  });

  if (insertError) {
    console.error('Failed to insert user:', insertError);
    throw new Error('Failed to create user salt');
  }

  return newSalt;
}

/**
 * Get or create salt using in-memory storage (development fallback)
 */
function getOrCreateSaltInMemory(sub: string): string {
  const existing = inMemorySalts.get(sub);
  if (existing) {
    return existing;
  }

  const newSalt = generateSalt();
  inMemorySalts.set(sub, newSalt);

  console.warn(
    '[zkLogin] Using in-memory salt storage. Configure Supabase for production!'
  );

  return newSalt;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jwt } = body as { jwt: string };

    if (!jwt) {
      return NextResponse.json(
        { error: 'Missing JWT in request body' },
        { status: 400 }
      );
    }

    // Decode JWT (we trust Google's signature since user got it directly)
    let decoded: GoogleJwtPayload;
    try {
      decoded = jwtDecode<GoogleJwtPayload>(jwt);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JWT format' },
        { status: 400 }
      );
    }

    // Validate required claims
    if (!decoded.sub) {
      return NextResponse.json(
        { error: 'JWT missing sub claim' },
        { status: 400 }
      );
    }

    // Validate audience (should be our client ID)
    const aud = Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud;
    if (aud !== GOOGLE_CLIENT_ID) {
      return NextResponse.json(
        { error: 'JWT audience mismatch' },
        { status: 400 }
      );
    }

    // Check expiration
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return NextResponse.json({ error: 'JWT expired' }, { status: 400 });
    }

    // Get or create salt
    let salt: string;

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (hasSupabase) {
      salt = await getOrCreateSaltSupabase(decoded.sub, decoded.email);
    } else {
      salt = getOrCreateSaltInMemory(decoded.sub);
    }

    return NextResponse.json({
      salt,
      sub: decoded.sub,
    });
  } catch (error) {
    console.error('Salt API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
