'use client';

import { useEffect, useRef } from 'react';
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

  // Separate cooldowns per action type to prevent blocking different actions
  const lastJumpTimeRef = useRef<number>(0);
  const lastSlideTimeRef = useRef<number>(0);
  const lastLaneChangeTimeRef = useRef<number>(0);

  // Cooldowns: store actions already have built-in checks (playerAction !== 'running')
  // These are just to prevent OS key-repeat from firing too rapidly
  const JUMP_COOLDOWN = 100; // Prevent rapid jump spam
  const SLIDE_COOLDOWN = 50; // Minimal cooldown for slide
  const LANE_CHANGE_COOLDOWN = 0; // No cooldown - animation handles rate limiting

  useEffect(() => {
    // Handle touch input - tap for lane change, swipe for jump/slide
    const handleTouchAction = (startX: number, startY: number, endX: number, endY: number) => {
      // Always get fresh state to avoid stale ref issues
      const { status, playerLane, setLane, jump, startSlide } = useGameStore.getState();
      if (status !== 'playing') return;

      const now = Date.now();
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Check if it's a swipe (vertical movement is significant)
      if (absY > SWIPE_THRESHOLD && absY > absX) {
        // Vertical swipe - jump or slide
        if (deltaY < 0) {
          // Jump with cooldown
          if (now - lastJumpTimeRef.current >= JUMP_COOLDOWN) {
            lastJumpTimeRef.current = now;
            jump();
          }
        } else {
          // Slide with cooldown
          if (now - lastSlideTimeRef.current >= SLIDE_COOLDOWN) {
            lastSlideTimeRef.current = now;
            startSlide();
          }
        }
        return;
      }

      // Check for horizontal swipe - lane change (no cooldown, animation handles rate limiting)
      if (absX > SWIPE_THRESHOLD && absX > absY) {
        if (now - lastLaneChangeTimeRef.current >= LANE_CHANGE_COOLDOWN) {
          if (deltaX > 0 && playerLane < 1) {
            lastLaneChangeTimeRef.current = now;
            setLane((playerLane + 1) as -1 | 0 | 1);
          } else if (deltaX < 0 && playerLane > -1) {
            lastLaneChangeTimeRef.current = now;
            setLane((playerLane - 1) as -1 | 0 | 1);
          }
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
          if (playerLane > -1 && now - lastLaneChangeTimeRef.current >= LANE_CHANGE_COOLDOWN) {
            lastLaneChangeTimeRef.current = now;
            setLane((playerLane - 1) as -1 | 0 | 1);
          }
        } else if (tapX > (screenWidth * 2) / 3) {
          if (playerLane < 1 && now - lastLaneChangeTimeRef.current >= LANE_CHANGE_COOLDOWN) {
            lastLaneChangeTimeRef.current = now;
            setLane((playerLane + 1) as -1 | 0 | 1);
          }
        } else {
          // Middle tap = jump
          if (now - lastJumpTimeRef.current >= JUMP_COOLDOWN) {
            lastJumpTimeRef.current = now;
            jump();
          }
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
      useGameStore.getState().endSlide();

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
      useGameStore.getState().endSlide();
      touchStartRef.current = null;
    };

    // Keyboard input - key down
    const handleKeyDown = (e: KeyboardEvent) => {
      // Always get fresh state to avoid stale ref issues
      const { status, playerLane, setLane, jump, startSlide } = useGameStore.getState();
      if (status !== 'playing') return;

      const now = Date.now();

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
        case ' ':
          e.preventDefault();
          // Jump with cooldown (prevents OS key-repeat spam)
          if (now - lastJumpTimeRef.current >= JUMP_COOLDOWN) {
            lastJumpTimeRef.current = now;
            jump();
          }
          break;
        case 's':
        case 'arrowdown':
          e.preventDefault();
          // Slide with minimal cooldown
          if (now - lastSlideTimeRef.current >= SLIDE_COOLDOWN) {
            lastSlideTimeRef.current = now;
            startSlide();
          }
          break;
        case 'a':
        case 'arrowleft':
          e.preventDefault();
          // Lane change - no cooldown (animation handles rate limiting)
          if (playerLane > -1 && now - lastLaneChangeTimeRef.current >= LANE_CHANGE_COOLDOWN) {
            lastLaneChangeTimeRef.current = now;
            setLane((playerLane - 1) as -1 | 0 | 1);
          }
          break;
        case 'd':
        case 'arrowright':
          e.preventDefault();
          // Lane change - no cooldown (animation handles rate limiting)
          if (playerLane < 1 && now - lastLaneChangeTimeRef.current >= LANE_CHANGE_COOLDOWN) {
            lastLaneChangeTimeRef.current = now;
            setLane((playerLane + 1) as -1 | 0 | 1);
          }
          break;
      }
    };

    // Keyboard input - key up (end slide)
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 's' || key === 'arrowdown') {
        useGameStore.getState().endSlide();
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
  }, []); // Empty deps - all state accessed via getState(), refs are stable
}
