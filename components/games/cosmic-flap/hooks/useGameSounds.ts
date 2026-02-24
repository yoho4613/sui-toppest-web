'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore';
import { useGameSounds as useGlobalGameSounds } from '@/hooks/useGameSounds';

/**
 * Cosmic Flap Sound Effects Hook
 *
 * Listens to game state changes and plays sound effects.
 * Uses shared useGameSounds (global SFX player) with Dash-common sounds:
 * - Flap → jump sound
 * - Coin collect → coin sound
 * - Item collect (shield/slow) → potion sound
 * - Obstacle hit → hit sound
 * - Game over → death sound
 * - Countdown → countdown sound
 * - High score → highscore sound
 */
export function useCosmicFlapSounds() {
  const { play } = useGlobalGameSounds();

  const prevValues = useRef({
    flapCount: 0,
    coinsCollected: 0,
    obstaclesPassed: 0,
    hasShield: false,
    isSlowed: false,
    status: 'menu' as string,
    shieldUsed: 0,
  });

  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      const prev = prevValues.current;

      // Flap sound (= jump)
      if (state.flapCount > prev.flapCount) {
        play.jump();
      }

      // Coin collect sound
      if (state.coinsCollected > prev.coinsCollected) {
        play.coin();
      }

      // Shield item collect (= potion sound)
      if (state.hasShield && !prev.hasShield) {
        play.potion();
      }

      // Slow item collect (= potion sound)
      if (state.isSlowed && !prev.isSlowed) {
        play.potion();
      }

      // Shield used (blocked obstacle) → hit sound
      if (state.shieldUsed > prev.shieldUsed) {
        play.hit();
      }

      // Countdown start
      if (state.status === 'countdown' && prev.status !== 'countdown') {
        play.countdown();
      }

      // Game start (GO!)
      if (state.status === 'playing' && prev.status === 'countdown') {
        play.go();
      }

      // Game over
      if (state.status === 'gameover' && prev.status === 'playing') {
        play.death();

        // High score check
        const finalScore = Math.floor(state.distance);
        if (finalScore > state.highScore) {
          // Delay highscore sound slightly
          setTimeout(() => play.highscore(), 500);
        }
      }

      // Update previous values
      prevValues.current = {
        flapCount: state.flapCount,
        coinsCollected: state.coinsCollected,
        obstaclesPassed: state.obstaclesPassed,
        hasShield: state.hasShield,
        isSlowed: state.isSlowed,
        status: state.status,
        shieldUsed: state.shieldUsed,
      };
    });

    return () => unsubscribe();
  }, [play]);
}
