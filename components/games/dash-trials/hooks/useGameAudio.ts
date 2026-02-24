import { useEffect } from 'react';
import { useGameStore } from './useGameStore';
import { useGameBGM } from '@/hooks/useGameBGM';

/**
 * Dash Trials Audio Hook
 *
 * Uses shared useGameBGM for BGM management.
 * - Fade in on countdown/playing
 * - Fade out on gameover/menu
 * - Fever: BGM pauses → fever music plays → BGM resumes
 */
export function useGameAudio() {
  const status = useGameStore((state) => state.status);
  const isFeverMode = useGameStore((state) => state.isFeverMode);

  const bgm = useGameBGM({
    bgmPath: '/audio/dash-trials-bgm.mp3',
    feverPath: '/sounds/fever.mp3',
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

  // Handle fever mode: pause BGM → play fever music → resume BGM
  useEffect(() => {
    if (status !== 'playing') return;

    if (isFeverMode) {
      bgm.startFever();
    } else {
      bgm.stopFever();
    }
  }, [isFeverMode, status, bgm.startFever, bgm.stopFever]);

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
