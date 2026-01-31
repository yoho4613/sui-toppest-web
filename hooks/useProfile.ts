'use client';

import { useState, useCallback, useEffect } from 'react';
import { UserProfile } from '@/lib/supabase';

interface UseProfileOptions {
  walletAddress: string | null;
  authMethod: 'wallet' | 'zklogin' | null;
  googleInfo?: {
    email: string | null;
    name: string | null;
    picture: string | null;
    sub: string | null;
  };
}

interface UseProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: { nickname?: string; avatar_url?: string; email?: string }) => Promise<boolean>;
  createOrSyncProfile: () => Promise<void>;
}

export function useProfile({
  walletAddress,
  authMethod,
  googleInfo,
}: UseProfileOptions): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!walletAddress) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/profile?address=${encodeURIComponent(walletAddress)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch profile');
      }

      setProfile(data.profile);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const createOrSyncProfile = useCallback(async () => {
    if (!walletAddress || !authMethod) return;

    setIsLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        wallet_address: walletAddress,
        auth_method: authMethod,
      };

      // Include Google info for zkLogin users
      if (authMethod === 'zklogin' && googleInfo) {
        body.google_email = googleInfo.email;
        body.google_name = googleInfo.name;
        body.google_picture = googleInfo.picture;
        body.google_sub = googleInfo.sub;
      }

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create/sync profile');
      }

      setProfile(data.profile);
    } catch (err) {
      console.error('Failed to create/sync profile:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to create/sync profile'
      );
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, authMethod, googleInfo]);

  const updateProfile = useCallback(
    async (data: { nickname?: string; avatar_url?: string; email?: string }): Promise<boolean> => {
      if (!walletAddress) return false;

      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address: walletAddress,
            ...data,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update profile');
        }

        setProfile(result.profile);
        return true;
      } catch (err) {
        console.error('Failed to update profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to update profile');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [walletAddress]
  );

  // Auto-fetch profile when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [walletAddress, fetchProfile]);

  return {
    profile,
    isLoading,
    isSaving,
    error,
    fetchProfile,
    updateProfile,
    createOrSyncProfile,
  };
}
