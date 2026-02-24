/**
 * Cosmic Flap Controls Hook
 *
 * Handles touch, click, and keyboard input for the flap action.
 * Simple single-action game - any input triggers flap.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore';

export function useControls() {
  const flap = useGameStore((state) => state.flap);
  const status = useGameStore((state) => state.status);
  const startGame = useGameStore((state) => state.startGame);
  const startCountdown = useGameStore((state) => state.startCountdown);

  // Prevent double-tap zoom on mobile
  const lastTapTime = useRef(0);
  const TAP_DEBOUNCE = 50; // ms

  const handleInput = useCallback(
    (e: TouchEvent | MouseEvent | KeyboardEvent) => {
      // Debounce rapid inputs
      const now = Date.now();
      if (now - lastTapTime.current < TAP_DEBOUNCE) return;
      lastTapTime.current = now;

      // Don't handle if clicking on UI elements
      if (e.target instanceof HTMLElement) {
        const isButton = e.target.closest('button');
        const isClickable = e.target.closest('[data-clickable]');
        if (isButton || isClickable) return;
      }

      e.preventDefault();

      if (status === 'playing') {
        flap();
      } else if (status === 'menu') {
        // First tap starts countdown
        startCountdown();
      }
    },
    [status, flap, startCountdown]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Space or Up arrow to flap
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        handleInput(e);
      }
    },
    [handleInput]
  );

  useEffect(() => {
    // Touch events
    const touchHandler = (e: TouchEvent) => handleInput(e);
    window.addEventListener('touchstart', touchHandler, { passive: false });

    // Mouse events
    const mouseHandler = (e: MouseEvent) => handleInput(e);
    window.addEventListener('mousedown', mouseHandler);

    // Keyboard events
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('touchstart', touchHandler);
      window.removeEventListener('mousedown', mouseHandler);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleInput, handleKeyDown]);

  // Countdown auto-start
  useEffect(() => {
    if (status === 'countdown') {
      const timer = setTimeout(() => {
        startGame();
      }, 3000); // 3 second countdown

      return () => clearTimeout(timer);
    }
  }, [status, startGame]);
}

export default useControls;
