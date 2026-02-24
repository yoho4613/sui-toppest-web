'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSoundSettings } from './useSoundSettings';

/**
 * Shared BGM (Background Music) Hook
 *
 * Reusable across all games. Provides:
 * - Fade in/out with configurable duration
 * - Fever/alternate music track (pauses BGM, plays fever, resumes BGM)
 * - Global volume/mute integration
 * - Proper cleanup on unmount
 */

interface GameBGMConfig {
  bgmPath: string;
  feverPath?: string;
  fadeDuration?: number; // ms, default 1000
}

interface BGMAudioState {
  bgm: HTMLAudioElement | null;
  fever: HTMLAudioElement | null;
  isFeverPlaying: boolean;
  bgmTimeBeforeFever: number; // BGM currentTime when fever started
}

export function useGameBGM(config: GameBGMConfig) {
  const { bgmPath, feverPath, fadeDuration = 1000 } = config;

  const getEffectiveMusicVolume = useSoundSettings((s) => s.getEffectiveMusicVolume);
  const isMuted = useSoundSettings((s) => s.isMuted);
  const isMusicMuted = useSoundSettings((s) => s.isMusicMuted);
  const toggleMute = useSoundSettings((s) => s.toggleMute);

  const audioRef = useRef<BGMAudioState>({
    bgm: null,
    fever: null,
    isFeverPlaying: false,
    bgmTimeBeforeFever: 0,
  });

  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const feverFadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio elements on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const bgm = new Audio(bgmPath);
    bgm.loop = true;
    bgm.volume = 0;
    bgm.preload = 'auto';
    audioRef.current.bgm = bgm;

    if (feverPath) {
      const fever = new Audio(feverPath);
      fever.loop = true;
      fever.volume = 0;
      fever.preload = 'auto';
      audioRef.current.fever = fever;
    }

    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (feverFadeIntervalRef.current) clearInterval(feverFadeIntervalRef.current);

      bgm.pause();
      bgm.src = '';

      if (audioRef.current.fever) {
        audioRef.current.fever.pause();
        audioRef.current.fever.src = '';
      }

      audioRef.current = {
        bgm: null,
        fever: null,
        isFeverPlaying: false,
        bgmTimeBeforeFever: 0,
      };
    };
  }, [bgmPath, feverPath]);

  // Fade in BGM
  const fadeIn = useCallback(() => {
    const { bgm } = audioRef.current;
    const effectiveVolume = getEffectiveMusicVolume();
    if (!bgm || effectiveVolume === 0) return;

    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

    const targetVolume = effectiveVolume;
    const step = targetVolume / (fadeDuration / 50);

    bgm.volume = 0;
    bgm.play().catch(() => { /* autoplay blocked */ });

    fadeIntervalRef.current = setInterval(() => {
      if (bgm.volume + step >= targetVolume) {
        bgm.volume = targetVolume;
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      } else {
        bgm.volume += step;
      }
    }, 50);
  }, [getEffectiveMusicVolume, fadeDuration]);

  // Fade out BGM and stop completely
  const fadeOut = useCallback(() => {
    const { bgm, fever } = audioRef.current;

    // Stop fever music immediately
    if (fever) {
      fever.pause();
      fever.currentTime = 0;
      fever.volume = 0;
      audioRef.current.isFeverPlaying = false;
    }
    if (feverFadeIntervalRef.current) {
      clearInterval(feverFadeIntervalRef.current);
      feverFadeIntervalRef.current = null;
    }

    if (!bgm) return;

    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

    // If volume is already 0, just stop
    if (bgm.volume <= 0.01) {
      bgm.volume = 0;
      bgm.pause();
      bgm.currentTime = 0;
      return;
    }

    const step = bgm.volume / (fadeDuration / 50);

    fadeIntervalRef.current = setInterval(() => {
      if (bgm.volume - step <= 0.01) {
        bgm.volume = 0;
        bgm.pause();
        bgm.currentTime = 0;
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      } else {
        bgm.volume -= step;
      }
    }, 50);
  }, [fadeDuration]);

  // Force stop all audio (no fade, immediate)
  const forceStop = useCallback(() => {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    if (feverFadeIntervalRef.current) clearInterval(feverFadeIntervalRef.current);
    fadeIntervalRef.current = null;
    feverFadeIntervalRef.current = null;

    const { bgm, fever } = audioRef.current;
    if (bgm) {
      bgm.volume = 0;
      bgm.pause();
      bgm.currentTime = 0;
    }
    if (fever) {
      fever.volume = 0;
      fever.pause();
      fever.currentTime = 0;
    }
    audioRef.current.isFeverPlaying = false;
  }, []);

  // Start fever music (pauses BGM, plays fever track)
  const startFever = useCallback(() => {
    const { bgm, fever } = audioRef.current;
    const effectiveVolume = getEffectiveMusicVolume();
    if (!fever || effectiveVolume === 0) return;

    audioRef.current.isFeverPlaying = true;

    // Save BGM position and fade out BGM
    if (bgm) {
      audioRef.current.bgmTimeBeforeFever = bgm.currentTime;
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

      // Quick fade out BGM (300ms)
      const bgmStep = bgm.volume / (300 / 50);
      fadeIntervalRef.current = setInterval(() => {
        if (bgm.volume - bgmStep <= 0.01) {
          bgm.volume = 0;
          bgm.pause();
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        } else {
          bgm.volume -= bgmStep;
        }
      }, 50);
    }

    // Fade in fever music (300ms)
    if (feverFadeIntervalRef.current) clearInterval(feverFadeIntervalRef.current);
    const targetVolume = Math.min(1, effectiveVolume * 1.3);
    const feverStep = targetVolume / (300 / 50);
    fever.volume = 0;
    fever.currentTime = 0;
    fever.play().catch(() => { /* autoplay blocked */ });

    feverFadeIntervalRef.current = setInterval(() => {
      if (fever.volume + feverStep >= targetVolume) {
        fever.volume = targetVolume;
        if (feverFadeIntervalRef.current) clearInterval(feverFadeIntervalRef.current);
        feverFadeIntervalRef.current = null;
      } else {
        fever.volume += feverStep;
      }
    }, 50);
  }, [getEffectiveMusicVolume]);

  // Stop fever music (resumes BGM)
  const stopFever = useCallback(() => {
    const { bgm, fever } = audioRef.current;
    const effectiveVolume = getEffectiveMusicVolume();
    if (!audioRef.current.isFeverPlaying) return;

    audioRef.current.isFeverPlaying = false;

    // Fade out fever music (300ms)
    if (fever) {
      if (feverFadeIntervalRef.current) clearInterval(feverFadeIntervalRef.current);
      const feverStep = fever.volume / (300 / 50);
      feverFadeIntervalRef.current = setInterval(() => {
        if (fever.volume - feverStep <= 0.01) {
          fever.volume = 0;
          fever.pause();
          fever.currentTime = 0;
          if (feverFadeIntervalRef.current) clearInterval(feverFadeIntervalRef.current);
          feverFadeIntervalRef.current = null;
        } else {
          fever.volume -= feverStep;
        }
      }, 50);
    }

    // Resume BGM from where it was
    if (bgm && effectiveVolume > 0) {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      bgm.currentTime = audioRef.current.bgmTimeBeforeFever;
      bgm.volume = 0;
      bgm.play().catch(() => { /* autoplay blocked */ });

      const bgmStep = effectiveVolume / (500 / 50);
      fadeIntervalRef.current = setInterval(() => {
        if (bgm.volume + bgmStep >= effectiveVolume) {
          bgm.volume = effectiveVolume;
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        } else {
          bgm.volume += bgmStep;
        }
      }, 50);
    }
  }, [getEffectiveMusicVolume]);

  // Update volume when global settings change (while playing)
  useEffect(() => {
    const { bgm, fever, isFeverPlaying } = audioRef.current;
    const effectiveVolume = getEffectiveMusicVolume();

    if (isFeverPlaying && fever) {
      fever.volume = effectiveVolume === 0 ? 0 : Math.min(1, effectiveVolume * 1.3);
      if (bgm) bgm.volume = 0;
    } else if (bgm && !bgm.paused) {
      bgm.volume = effectiveVolume;
    }
  }, [isMuted, isMusicMuted, getEffectiveMusicVolume]);

  return {
    fadeIn,
    fadeOut,
    forceStop,
    startFever,
    stopFever,
    toggleMute,
    isMuted: isMuted || isMusicMuted,
  };
}
