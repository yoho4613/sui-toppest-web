'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore';

const SWIPE_THRESHOLD = 25; // Reduced for easier swipe detection
const TAP_THRESHOLD = 15; // Max movement for a tap
const SWIPE_TIME_LIMIT = 400; // ms - increased for easier swipe
const LONG_PRESS_DURATION = 300; // ms - long press to slide

interface TouchData {
  x: number;
  y: number;
  time: number;
  processed: boolean;
}

export function useControls() {
  const touchStartRef = useRef<TouchData | null>(null);
  const isSlidingRef = useRef<boolean>(false); // Track if currently sliding
  const isTwoFingerTouchRef = useRef<boolean>(false); // Track two-finger touch
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Long press timer
  const isLongPressSlideRef = useRef<boolean>(false); // Track if slide was triggered by long press

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
          // Swipe up = Jump with cooldown
          if (now - lastJumpTimeRef.current >= JUMP_COOLDOWN) {
            lastJumpTimeRef.current = now;
            jump();
          }
        } else {
          // Swipe down = Slide with cooldown
          if (now - lastSlideTimeRef.current >= SLIDE_COOLDOWN) {
            lastSlideTimeRef.current = now;
            isSlidingRef.current = true;
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

    // Helper to clear long press timer
    const clearLongPressTimer = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    // Touch start - detect single or multi-touch
    const handleTouchStart = (e: TouchEvent) => {
      // Skip if touch started on a button or interactive element
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }

      const { status, startSlide } = useGameStore.getState();

      // TWO-FINGER TOUCH = SLIDE (works on mobile/tablet)
      if (e.touches.length >= 2 && status === 'playing') {
        clearLongPressTimer();
        isTwoFingerTouchRef.current = true;
        isSlidingRef.current = true;
        startSlide();
        return;
      }

      // Single touch - record start position
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        processed: false,
      };

      // Start long press timer for single finger (300ms)
      if (status === 'playing' && e.touches.length === 1) {
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          // Check if still single finger and not moved much
          if (touchStartRef.current && !isSlidingRef.current && !isTwoFingerTouchRef.current) {
            const { status: currentStatus, startSlide: slide } = useGameStore.getState();
            if (currentStatus === 'playing') {
              isLongPressSlideRef.current = true;
              isSlidingRef.current = true;
              slide();
              touchStartRef.current.processed = true;
            }
          }
        }, LONG_PRESS_DURATION);
      }
    };

    // Touch move - detect swipe-down hold for continuous slide
    const handleTouchMove = (e: TouchEvent) => {
      const { status, startSlide } = useGameStore.getState();
      if (status !== 'playing') return;

      // Check for two-finger touch during move
      if (e.touches.length >= 2 && !isTwoFingerTouchRef.current) {
        clearLongPressTimer();
        isTwoFingerTouchRef.current = true;
        isSlidingRef.current = true;
        startSlide();
        return;
      }

      // Single finger - check for movement
      if (touchStartRef.current && e.touches.length === 1) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
        const deltaY = touch.clientY - touchStartRef.current.y;
        const absDeltaY = Math.abs(deltaY);

        // If moved significantly, cancel long press timer
        if (deltaX > TAP_THRESHOLD || absDeltaY > TAP_THRESHOLD) {
          clearLongPressTimer();
        }

        // If dragging down significantly, start slide
        if (!isSlidingRef.current && deltaY > SWIPE_THRESHOLD) {
          clearLongPressTimer();
          isSlidingRef.current = true;
          startSlide();
          touchStartRef.current.processed = true;
        }
      }
    };

    // Touch end (swipe/tap detection + end slide)
    const handleTouchEnd = (e: TouchEvent) => {
      // Check remaining touches
      const remainingTouches = e.touches.length;

      // Clear long press timer
      clearLongPressTimer();

      // If was two-finger sliding and now less than 2 fingers, end slide
      if (isTwoFingerTouchRef.current && remainingTouches < 2) {
        isTwoFingerTouchRef.current = false;
        isSlidingRef.current = false;
        isLongPressSlideRef.current = false;
        useGameStore.getState().endSlide();
      }

      // If no touches remain, end all sliding
      if (remainingTouches === 0) {
        if (isSlidingRef.current) {
          isSlidingRef.current = false;
          isLongPressSlideRef.current = false;
          useGameStore.getState().endSlide();
        }

        // Process tap/swipe if not already processed
        if (touchStartRef.current && !touchStartRef.current.processed) {
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
        }

        touchStartRef.current = null;
        isTwoFingerTouchRef.current = false;
        isLongPressSlideRef.current = false;
      }
    };

    // Touch cancel
    const handleTouchCancel = () => {
      clearLongPressTimer();
      isSlidingRef.current = false;
      isTwoFingerTouchRef.current = false;
      isLongPressSlideRef.current = false;
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

    // Register events with passive: true for better scroll performance
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      clearLongPressTimer();
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // Empty deps - all state accessed via getState(), refs are stable
}
