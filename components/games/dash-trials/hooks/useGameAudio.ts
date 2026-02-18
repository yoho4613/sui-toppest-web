import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from './useGameStore';
import { useSoundSettings } from '@/hooks/useSoundSettings';

const BGM_PATH = '/audio/dash-trials-bgm.mp3';
const FADE_DURATION = 1000; // 1 second fade

interface AudioState {
  bgm: HTMLAudioElement | null;
}

export function useGameAudio() {
  const status = useGameStore((state) => state.status);
  const isFeverMode = useGameStore((state) => state.isFeverMode);

  // Use global sound settings
  const getEffectiveMusicVolume = useSoundSettings((s) => s.getEffectiveMusicVolume);
  const isMuted = useSoundSettings((s) => s.isMuted);
  const isMusicMuted = useSoundSettings((s) => s.isMusicMuted);
  const toggleMute = useSoundSettings((s) => s.toggleMute);

  const audioRef = useRef<AudioState>({
    bgm: null,
  });

  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio(BGM_PATH);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';

    audioRef.current.bgm = audio;

    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Fade in audio
  const fadeIn = useCallback(() => {
    const audio = audioRef.current.bgm;
    const effectiveVolume = getEffectiveMusicVolume();
    if (!audio || effectiveVolume === 0) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const targetVolume = effectiveVolume;
    const step = targetVolume / (FADE_DURATION / 50);

    audio.volume = 0;
    audio.play().catch(() => {
      // Autoplay blocked - will play on user interaction
    });

    fadeIntervalRef.current = setInterval(() => {
      if (audio.volume + step >= targetVolume) {
        audio.volume = targetVolume;
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
        }
      } else {
        audio.volume += step;
      }
    }, 50);
  }, [getEffectiveMusicVolume]);

  // Fade out audio
  const fadeOut = useCallback(() => {
    const audio = audioRef.current.bgm;
    if (!audio) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const step = audio.volume / (FADE_DURATION / 50);

    fadeIntervalRef.current = setInterval(() => {
      if (audio.volume - step <= 0) {
        audio.volume = 0;
        audio.pause();
        audio.currentTime = 0;
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
        }
      } else {
        audio.volume -= step;
      }
    }, 50);
  }, []);

  // Handle game status changes
  useEffect(() => {
    if (status === 'countdown' || status === 'playing') {
      fadeIn();
    } else if (status === 'gameover' || status === 'menu') {
      fadeOut();
    }
  }, [status, fadeIn, fadeOut]);

  // Update volume when global settings change
  useEffect(() => {
    const audio = audioRef.current.bgm;
    if (!audio) return;

    const effectiveVolume = getEffectiveMusicVolume();

    if (status === 'playing' || status === 'countdown') {
      if (effectiveVolume === 0) {
        audio.volume = 0;
      } else {
        // Apply fever mode boost
        const feverBoost = isFeverMode ? 1.3 : 1;
        audio.volume = Math.min(1, effectiveVolume * feverBoost);
      }
    }
  }, [isMuted, isMusicMuted, getEffectiveMusicVolume, status, isFeverMode]);

  // Increase volume during fever mode
  useEffect(() => {
    const audio = audioRef.current.bgm;
    const effectiveVolume = getEffectiveMusicVolume();
    if (!audio || effectiveVolume === 0) return;

    if (status === 'playing') {
      audio.volume = isFeverMode ? Math.min(1, effectiveVolume * 1.3) : effectiveVolume;
    }
  }, [isFeverMode, status, getEffectiveMusicVolume]);

  return {
    toggleMute,
    isMuted: isMuted || isMusicMuted,
  };
}
