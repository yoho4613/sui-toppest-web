'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from './useGameStore';

const SWIPE_THRESHOLD = 30; // Reduced for faster response
const TAP_THRESHOLD = 15; // Max movement for a tap
const SWIPE_TIME_LIMIT = 300; // ms

interface TouchData {
  x: number;
  y: number;
  time: number;
  processed: boolean;
}

export function useControls() {
  const touchStartRef = useRef<TouchData | null>(null);
  const lastActionTimeRef = useRef<number>(0);
  const actionCooldown = 50; // ms - prevent double triggers

  // Use refs to avoid re-registering event listeners on every state change
  const storeRef = useRef(useGameStore.getState());

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsubscribe;
  }, []);

  // Debounced action executor
  const executeAction = useCallback((action: () => void) => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < actionCooldown) return false;
    lastActionTimeRef.current = now;
    action();
    return true;
  }, []);

  useEffect(() => {
    // Handle touch input - tap for lane change, swipe for jump/slide
    const handleTouchAction = (startX: number, startY: number, endX: number, endY: number) => {
      const { status, playerLane, setLane, jump, startSlide } = storeRef.current;
      if (status !== 'playing') return;

      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Check if it's a swipe (vertical movement is significant)
      if (absY > SWIPE_THRESHOLD && absY > absX) {
        // Vertical swipe - jump or slide
        if (deltaY < 0) {
          executeAction(() => jump());
        } else {
          executeAction(() => startSlide());
        }
        return;
      }

      // Check for horizontal swipe
      if (absX > SWIPE_THRESHOLD && absX > absY) {
        if (deltaX > 0 && playerLane < 1) {
          executeAction(() => setLane((playerLane + 1) as -1 | 0 | 1));
        } else if (deltaX < 0 && playerLane > -1) {
          executeAction(() => setLane((playerLane - 1) as -1 | 0 | 1));
        }
        return;
      }

      // Tap detection - if movement is minimal, use tap position
      if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD) {
        const screenWidth = window.innerWidth;
        const tapX = endX;

        // Left third of screen → move left
        // Right third of screen → move right
        // Middle → jump
        if (tapX < screenWidth / 3) {
          if (playerLane > -1) {
            executeAction(() => setLane((playerLane - 1) as -1 | 0 | 1));
          }
        } else if (tapX > (screenWidth * 2) / 3) {
          if (playerLane < 1) {
            executeAction(() => setLane((playerLane + 1) as -1 | 0 | 1));
          }
        } else {
          // Middle tap = jump
          executeAction(() => jump());
        }
      }
    };

    // Touch start
    const handleTouchStart = (e: TouchEvent) => {
      // Skip if touch started on a button or interactive element
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }

      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        processed: false,
      };
    };

    // Touch end (swipe/tap detection + end slide)
    const handleTouchEnd = (e: TouchEvent) => {
      // End sliding when touch ends
      const { endSlide } = storeRef.current;
      endSlide();

      if (!touchStartRef.current || touchStartRef.current.processed) return;

      const touch = e.changedTouches[0];
      const deltaTime = Date.now() - touchStartRef.current.time;

      if (deltaTime <= SWIPE_TIME_LIMIT) {
        handleTouchAction(
          touchStartRef.current.x,
          touchStartRef.current.y,
          touch.clientX,
          touch.clientY
        );
        touchStartRef.current.processed = true;
      }

      touchStartRef.current = null;
    };

    // Touch cancel
    const handleTouchCancel = () => {
      const { endSlide } = storeRef.current;
      endSlide();
      touchStartRef.current = null;
    };

    // Keyboard input - key down
    const handleKeyDown = (e: KeyboardEvent) => {
      const { status, playerLane, setLane, jump, startSlide } = storeRef.current;
      if (status !== 'playing') return;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
        case ' ':
          e.preventDefault();
          executeAction(() => jump());
          break;
        case 's':
        case 'arrowdown':
          e.preventDefault();
          executeAction(() => startSlide());
          break;
        case 'a':
        case 'arrowleft':
          e.preventDefault();
          if (playerLane > -1) executeAction(() => setLane((playerLane - 1) as -1 | 0 | 1));
          break;
        case 'd':
        case 'arrowright':
          e.preventDefault();
          if (playerLane < 1) executeAction(() => setLane((playerLane + 1) as -1 | 0 | 1));
          break;
      }
    };

    // Keyboard input - key up (end slide)
    const handleKeyUp = (e: KeyboardEvent) => {
      const { endSlide } = storeRef.current;
      const key = e.key.toLowerCase();
      if (key === 's' || key === 'arrowdown') {
        endSlide();
      }
    };

    // Register events with passive: false to allow preventDefault if needed
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [executeAction]);
}
