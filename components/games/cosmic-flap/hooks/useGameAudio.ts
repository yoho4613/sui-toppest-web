import { useEffect } from 'react';
import { useGameStore } from './useGameStore';
import { useGameBGM } from '@/hooks/useGameBGM';

/**
 * Cosmic Flap Audio Hook
 *
 * Uses shared useGameBGM for BGM management.
 * - Fade in on countdown/playing
 * - Fade out on gameover/menu
 *
 * TODO: Replace BGM path with a Cosmic Flap-specific track
 */
export function useGameAudio() {
  const status = useGameStore((state) => state.status);

  const bgm = useGameBGM({
    bgmPath: '/audio/cosmic-flap-bgm.mp3',
    fadeDuration: 1000,
  });

  // Handle game status changes
  useEffect(() => {
    if (status === 'countdown' || status === 'playing') {
      bgm.fadeIn();
    } else if (status === 'gameover' || status === 'menu') {
      bgm.fadeOut();
    }
  }, [status, bgm.fadeIn, bgm.fadeOut]);

  // Force stop on unmount (safety net)
  useEffect(() => {
    return () => {
      bgm.forceStop();
    };
  }, [bgm.forceStop]);

  return {
    toggleMute: bgm.toggleMute,
    isMuted: bgm.isMuted,
  };
}
