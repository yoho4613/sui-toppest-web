'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useSoundSettings } from './useSoundSettings';

// Sound effect types available across all games
export type SoundEffect =
  // Common game sounds
  | 'jump'
  | 'slide'
  | 'laneChange'
  | 'coin'
  | 'potion'
  | 'fever'
  | 'hit'
  | 'death'
  | 'countdown'
  | 'go'
  | 'warning'
  | 'perfect'
  | 'highscore'
  // UI sounds
  | 'buttonClick'
  | 'success'
  | 'error';

// Sound file paths - add new sounds here
const SOUND_PATHS: Record<SoundEffect, string> = {
  // Game sounds
  jump: '/sounds/jump.mp3',
  slide: '/sounds/slide.mp3',
  laneChange: '/sounds/whoosh.mp3',
  coin: '/sounds/coin.mp3',
  potion: '/sounds/potion.mp3',
  fever: '/sounds/fever.mp3',
  hit: '/sounds/hit.mp3',
  death: '/sounds/death.mp3',
  countdown: '/sounds/countdown.mp3',
  go: '/sounds/go.mp3',
  warning: '/sounds/warning.mp3',
  perfect: '/sounds/perfect.mp3',
  highscore: '/sounds/highscore.mp3',
  // UI sounds
  buttonClick: '/sounds/click.mp3',
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
};

// Default volumes for each sound (relative to SFX volume)
const DEFAULT_VOLUMES: Partial<Record<SoundEffect, number>> = {
  coin: 0.4,
  laneChange: 0.3,
  jump: 0.5,
  slide: 0.4,
  fever: 0.8,
  death: 0.7,
  countdown: 0.6,
  go: 0.8,
  hit: 0.6,
  warning: 0.5,
  perfect: 0.6,
  highscore: 0.8,
  buttonClick: 0.3,
  success: 0.5,
  error: 0.5,
  potion: 0.5,
};

interface AudioCache {
  [key: string]: HTMLAudioElement;
}

export function useGameSounds() {
  const audioCache = useRef<AudioCache>({});
  const getEffectiveSfxVolume = useSoundSettings((s) => s.getEffectiveSfxVolume);

  // Preload commonly used sounds
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Preload essential sounds
    const essentialSounds: SoundEffect[] = ['coin', 'jump', 'hit', 'death', 'fever'];

    essentialSounds.forEach((sound) => {
      const path = SOUND_PATHS[sound];
      if (path && !audioCache.current[sound]) {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audioCache.current[sound] = audio;
      }
    });

    return () => {
      // Cleanup
      Object.values(audioCache.current).forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audioCache.current = {};
    };
  }, []);

  // Play a sound effect
  const playSound = useCallback(
    (sound: SoundEffect, volumeOverride?: number) => {
      if (typeof window === 'undefined') return;

      const effectiveVolume = getEffectiveSfxVolume();
      if (effectiveVolume === 0) return;

      const path = SOUND_PATHS[sound];
      if (!path) {
        console.warn(`Sound not found: ${sound}`);
        return;
      }

      try {
        // Create new audio instance for overlapping sounds
        const audio = new Audio(path);
        const baseVolume = volumeOverride ?? DEFAULT_VOLUMES[sound] ?? 0.5;
        audio.volume = effectiveVolume * baseVolume;

        audio.play().catch(() => {
          // Autoplay blocked - ignore
        });

        // Clean up after playing
        audio.onended = () => {
          audio.src = '';
        };
      } catch {
        // Ignore errors
      }
    },
    [getEffectiveSfxVolume]
  );

  // Play specific sounds with proper typing
  const play = {
    jump: useCallback(() => playSound('jump'), [playSound]),
    slide: useCallback(() => playSound('slide'), [playSound]),
    laneChange: useCallback(() => playSound('laneChange'), [playSound]),
    coin: useCallback(() => playSound('coin'), [playSound]),
    potion: useCallback(() => playSound('potion'), [playSound]),
    fever: useCallback(() => playSound('fever'), [playSound]),
    hit: useCallback(() => playSound('hit'), [playSound]),
    death: useCallback(() => playSound('death'), [playSound]),
    countdown: useCallback(() => playSound('countdown'), [playSound]),
    go: useCallback(() => playSound('go'), [playSound]),
    warning: useCallback(() => playSound('warning'), [playSound]),
    perfect: useCallback(() => playSound('perfect'), [playSound]),
    highscore: useCallback(() => playSound('highscore'), [playSound]),
    buttonClick: useCallback(() => playSound('buttonClick'), [playSound]),
    success: useCallback(() => playSound('success'), [playSound]),
    error: useCallback(() => playSound('error'), [playSound]),
  };

  return {
    playSound,
    play,
  };
}
