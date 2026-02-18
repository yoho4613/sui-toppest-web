'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SoundSettings {
  // Volume levels (0-1)
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;

  // Mute states
  isMuted: boolean;
  isMusicMuted: boolean;
  isSfxMuted: boolean;

  // Actions
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleMusicMute: () => void;
  toggleSfxMute: () => void;
  setMuted: (muted: boolean) => void;

  // Computed getters
  getEffectiveMusicVolume: () => number;
  getEffectiveSfxVolume: () => number;
}

export const useSoundSettings = create<SoundSettings>()(
  persist(
    (set, get) => ({
      // Default volumes
      masterVolume: 0.7,
      musicVolume: 0.5,
      sfxVolume: 0.6,

      // Default mute states
      isMuted: false,
      isMusicMuted: false,
      isSfxMuted: false,

      // Volume setters
      setMasterVolume: (volume) => set({ masterVolume: Math.max(0, Math.min(1, volume)) }),
      setMusicVolume: (volume) => set({ musicVolume: Math.max(0, Math.min(1, volume)) }),
      setSfxVolume: (volume) => set({ sfxVolume: Math.max(0, Math.min(1, volume)) }),

      // Mute toggles
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      toggleMusicMute: () => set((state) => ({ isMusicMuted: !state.isMusicMuted })),
      toggleSfxMute: () => set((state) => ({ isSfxMuted: !state.isSfxMuted })),
      setMuted: (muted) => set({ isMuted: muted }),

      // Computed effective volumes (respects master and individual mutes)
      getEffectiveMusicVolume: () => {
        const state = get();
        if (state.isMuted || state.isMusicMuted) return 0;
        return state.masterVolume * state.musicVolume;
      },
      getEffectiveSfxVolume: () => {
        const state = get();
        if (state.isMuted || state.isSfxMuted) return 0;
        return state.masterVolume * state.sfxVolume;
      },
    }),
    {
      name: 'toppest-sound-settings',
      version: 1,
    }
  )
);

// Selector hooks for performance
export const useMasterVolume = () => useSoundSettings((s) => s.masterVolume);
export const useMusicVolume = () => useSoundSettings((s) => s.musicVolume);
export const useSfxVolume = () => useSoundSettings((s) => s.sfxVolume);
export const useIsMuted = () => useSoundSettings((s) => s.isMuted);
export const useIsMusicMuted = () => useSoundSettings((s) => s.isMusicMuted);
export const useIsSfxMuted = () => useSoundSettings((s) => s.isSfxMuted);
