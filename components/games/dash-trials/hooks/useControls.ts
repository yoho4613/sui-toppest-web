'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore';

const SWIPE_THRESHOLD = 50;
const SWIPE_TIME_LIMIT = 300; // ms

export function useControls() {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Use refs to avoid re-registering event listeners on every state change
  const storeRef = useRef(useGameStore.getState());

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleSwipe = (deltaX: number, deltaY: number) => {
      const { status, playerLane, setLane, jump, startSlide } = storeRef.current;
      if (status !== 'playing') return;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY && absX > SWIPE_THRESHOLD) {
        // Horizontal swipe - lane change
        if (deltaX > 0 && playerLane < 1) {
          setLane((playerLane + 1) as -1 | 0 | 1);
        } else if (deltaX < 0 && playerLane > -1) {
          setLane((playerLane - 1) as -1 | 0 | 1);
        }
      } else if (absY > SWIPE_THRESHOLD) {
        // Vertical swipe - jump or slide
        if (deltaY < 0) {
          jump();
        } else {
          startSlide();
        }
      }
    };

    // Touch start
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    // Touch end (swipe detection + end slide)
    const handleTouchEnd = (e: TouchEvent) => {
      // End sliding when touch ends
      const { endSlide } = storeRef.current;
      endSlide();

      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      if (deltaTime <= SWIPE_TIME_LIMIT) {
        handleSwipe(deltaX, deltaY);
      }

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
          jump();
          break;
        case 's':
        case 'arrowdown':
          e.preventDefault();
          startSlide();
          break;
        case 'a':
        case 'arrowleft':
          e.preventDefault();
          if (playerLane > -1) setLane((playerLane - 1) as -1 | 0 | 1);
          break;
        case 'd':
        case 'arrowright':
          e.preventDefault();
          if (playerLane < 1) setLane((playerLane + 1) as -1 | 0 | 1);
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

    // Register events
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
}
