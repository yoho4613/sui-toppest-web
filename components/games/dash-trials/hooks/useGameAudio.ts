import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from './useGameStore';

const BGM_PATH = '/audio/dash-trials-bgm.mp3';
const FADE_DURATION = 1000; // 1 second fade

interface AudioState {
  bgm: HTMLAudioElement | null;
  isMuted: boolean;
  volume: number;
}

export function useGameAudio() {
  const status = useGameStore((state) => state.status);
  const isFeverMode = useGameStore((state) => state.isFeverMode);

  const audioRef = useRef<AudioState>({
    bgm: null,
    isMuted: false,
    volume: 0.5,
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

    // Load mute preference
    const savedMute = localStorage.getItem('dashTrials_audioMuted');
    if (savedMute === 'true') {
      audioRef.current.isMuted = true;
    }

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
    if (!audio || audioRef.current.isMuted) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const targetVolume = audioRef.current.volume;
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
  }, []);

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

  // Increase volume during fever mode
  useEffect(() => {
    const audio = audioRef.current.bgm;
    if (!audio || audioRef.current.isMuted) return;

    if (status === 'playing') {
      const baseVolume = audioRef.current.volume;
      audio.volume = isFeverMode ? Math.min(1, baseVolume * 1.3) : baseVolume;
    }
  }, [isFeverMode, status]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const audio = audioRef.current.bgm;
    audioRef.current.isMuted = !audioRef.current.isMuted;

    if (audio) {
      audio.muted = audioRef.current.isMuted;
    }

    localStorage.setItem('dashTrials_audioMuted', String(audioRef.current.isMuted));

    return audioRef.current.isMuted;
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    audioRef.current.volume = Math.max(0, Math.min(1, volume));
    const audio = audioRef.current.bgm;
    if (audio && !audioRef.current.isMuted) {
      audio.volume = audioRef.current.volume;
    }
  }, []);

  return {
    toggleMute,
    setVolume,
    isMuted: audioRef.current.isMuted,
  };
}
