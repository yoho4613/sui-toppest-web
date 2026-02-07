'use client';

import { useCallback } from 'react';
import { useGameStore } from '../hooks/useGameStore';

export function ControlPad() {
  const status = useGameStore((state) => state.status);
  const playerLane = useGameStore((state) => state.playerLane);
  const setLane = useGameStore((state) => state.setLane);
  const jump = useGameStore((state) => state.jump);
  const startSlide = useGameStore((state) => state.startSlide);
  const endSlide = useGameStore((state) => state.endSlide);

  const handleLeft = useCallback(() => {
    if (status !== 'playing') return;
    if (playerLane > -1) {
      setLane((playerLane - 1) as -1 | 0 | 1);
    }
  }, [status, playerLane, setLane]);

  const handleRight = useCallback(() => {
    if (status !== 'playing') return;
    if (playerLane < 1) {
      setLane((playerLane + 1) as -1 | 0 | 1);
    }
  }, [status, playerLane, setLane]);

  const handleJump = useCallback(() => {
    if (status !== 'playing') return;
    jump();
  }, [status, jump]);

  const handleSlideStart = useCallback(() => {
    if (status !== 'playing') return;
    startSlide();
  }, [status, startSlide]);

  const handleSlideEnd = useCallback(() => {
    endSlide();
  }, [endSlide]);

  if (status !== 'playing') return null;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      {/* D-pad style control */}
      <div className="relative w-40 h-40">
        {/* Up button (Jump) */}
        <button
          className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14
                     bg-cyan-500/30 active:bg-cyan-500/60
                     border-2 border-cyan-400/50 rounded-lg
                     flex items-center justify-center
                     touch-none select-none"
          onTouchStart={(e) => {
            e.preventDefault();
            handleJump();
          }}
          onMouseDown={handleJump}
        >
          <svg className="w-8 h-8 text-cyan-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 4l-8 8h5v8h6v-8h5z" />
          </svg>
        </button>

        {/* Down button (Slide) - supports hold */}
        <button
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-14
                     bg-blue-500/30 active:bg-blue-500/60
                     border-2 border-blue-400/50 rounded-lg
                     flex items-center justify-center
                     touch-none select-none"
          onTouchStart={(e) => {
            e.preventDefault();
            handleSlideStart();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleSlideEnd();
          }}
          onTouchCancel={(e) => {
            e.preventDefault();
            handleSlideEnd();
          }}
          onMouseDown={handleSlideStart}
          onMouseUp={handleSlideEnd}
          onMouseLeave={handleSlideEnd}
        >
          <svg className="w-8 h-8 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 20l8-8h-5V4H9v8H4z" />
          </svg>
        </button>

        {/* Left button */}
        <button
          className="absolute left-0 top-1/2 -translate-y-1/2 w-14 h-14
                     bg-green-500/30 active:bg-green-500/60
                     border-2 border-green-400/50 rounded-lg
                     flex items-center justify-center
                     touch-none select-none"
          onTouchStart={(e) => {
            e.preventDefault();
            handleLeft();
          }}
          onMouseDown={handleLeft}
        >
          <svg className="w-8 h-8 text-green-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 12l8-8v5h8v6h-8v5z" />
          </svg>
        </button>

        {/* Right button */}
        <button
          className="absolute right-0 top-1/2 -translate-y-1/2 w-14 h-14
                     bg-green-500/30 active:bg-green-500/60
                     border-2 border-green-400/50 rounded-lg
                     flex items-center justify-center
                     touch-none select-none"
          onTouchStart={(e) => {
            e.preventDefault();
            handleRight();
          }}
          onMouseDown={handleRight}
        >
          <svg className="w-8 h-8 text-green-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 12l-8 8v-5H4v-6h8V4z" />
          </svg>
        </button>

        {/* Center indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-10 h-10 rounded-full bg-gray-800/50 border border-gray-600/50" />
      </div>
    </div>
  );
}
