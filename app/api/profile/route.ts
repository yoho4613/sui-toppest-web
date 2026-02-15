/**
 * Profile API
 *
 * GET: Fetch user profile by wallet address
 * POST: Create or update user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, UserProfile } from '@/lib/supabase';
import { updateQuestProgress } from '@/lib/db';

// Check if profile is complete (has nickname and email)
function isProfileComplete(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return !!(profile.nickname && profile.email);
}

// GET /api/profile?address=0x...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('wallet_address', address)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Profile fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: data || null });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      wallet_address,
      nickname,
      avatar_url,
      email, // For wallet users
      auth_method,
      google_email,
      google_name,
      google_picture,
      google_sub,
    } = body as Partial<UserProfile> & { wallet_address: string };

    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Missing wallet_address' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Check if profile exists
    const { data: existing } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('wallet_address', wallet_address)
      .single();

    if (existing) {
      // Update existing profile
      const updateData: Partial<UserProfile> = {};

      if (nickname !== undefined) updateData.nickname = nickname;
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
      if (email !== undefined) updateData.email = email; // For wallet users

      // Only update Google info if provided (for zkLogin users)
      if (google_email !== undefined) updateData.google_email = google_email;
      if (google_name !== undefined) updateData.google_name = google_name;
      if (google_picture !== undefined)
        updateData.google_picture = google_picture;

      // If no fields to update, just return existing profile
      if (Object.keys(updateData).length === 0) {
        const { data } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('wallet_address', wallet_address)
          .single();

        return NextResponse.json({ profile: data, unchanged: true });
      }

      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update(updateData)
        .eq('wallet_address', wallet_address)
        .select()
        .single();

      if (error) {
        console.error('Profile update error:', error);
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        );
      }

      // Check if profile is now complete and update quest progress
      if (isProfileComplete(data)) {
        updateQuestProgress(wallet_address, 'profile_complete', 1).catch((err) => {
          console.error('Failed to update profile_complete quest:', err);
        });
      }

      return NextResponse.json({ profile: data, updated: true });
    } else {
      // Create new profile
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          wallet_address,
          nickname: nickname || null,
          avatar_url: avatar_url || null,
          email: email || null, // For wallet users
          auth_method: auth_method || 'wallet',
          google_email: google_email || null,
          google_name: google_name || null,
          google_picture: google_picture || null,
          google_sub: google_sub || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Profile create error:', error);
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        );
      }

      // Check if profile is complete on creation and update quest progress
      if (isProfileComplete(data)) {
        updateQuestProgress(wallet_address, 'profile_complete', 1).catch((err) => {
          console.error('Failed to update profile_complete quest:', err);
        });
      }

      return NextResponse.json({ profile: data, created: true });
    }
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
