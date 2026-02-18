'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore';
import { useGameSounds as useGlobalGameSounds } from '@/hooks/useGameSounds';

/**
 * Hook that listens to game state changes and plays appropriate sound effects.
 * This integrates the global useGameSounds hook with the Dash Trials game.
 */
export function useDashTrialsSounds() {
  const { play } = useGlobalGameSounds();

  // Track previous values to detect changes
  const prevValues = useRef({
    playerAction: 'running' as string,
    playerLane: 0 as number,
    coinCount: 0,
    potionCount: 0,
    isFeverMode: false,
    isCrashing: false,
    perfectCount: 0,
    status: 'menu' as string,
  });

  useEffect(() => {
    // Subscribe to store changes
    const unsubscribe = useGameStore.subscribe((state) => {
      const prev = prevValues.current;

      // Jump sound
      if (state.playerAction === 'jumping' && prev.playerAction !== 'jumping') {
        play.jump();
      }

      // Slide sound
      if (state.playerAction === 'sliding' && prev.playerAction !== 'sliding') {
        play.slide();
      }

      // Lane change sound
      if (state.playerLane !== prev.playerLane && state.status === 'playing') {
        play.laneChange();
      }

      // Coin collect sound
      if (state.coinCount > prev.coinCount) {
        play.coin();
      }

      // Potion collect sound
      if (state.potionCount > prev.potionCount) {
        play.potion();
      }

      // Fever mode activation sound
      if (state.isFeverMode && !prev.isFeverMode) {
        play.fever();
      }

      // Crash/hit sound
      if (state.isCrashing && !prev.isCrashing) {
        if (state.gameOverReason === 'collision') {
          play.hit();
        } else {
          play.death();
        }
      }

      // Perfect dodge sound (less frequent - every 5 perfects)
      if (state.perfectCount > prev.perfectCount && state.perfectCount % 5 === 0) {
        play.perfect();
      }

      // Countdown sounds
      if (state.status === 'countdown' && prev.status !== 'countdown') {
        // Play countdown sound at start
        play.countdown();
      }

      // Game over high score sound
      if (state.status === 'gameover' && prev.status === 'playing') {
        const finalScore = Math.floor(state.distance);
        if (finalScore > state.highScore) {
          play.highscore();
        }
      }

      // Update previous values
      prevValues.current = {
        playerAction: state.playerAction,
        playerLane: state.playerLane,
        coinCount: state.coinCount,
        potionCount: state.potionCount,
        isFeverMode: state.isFeverMode,
        isCrashing: state.isCrashing,
        perfectCount: state.perfectCount,
        status: state.status,
      };
    });

    return () => {
      unsubscribe();
    };
  }, [play]);
}
