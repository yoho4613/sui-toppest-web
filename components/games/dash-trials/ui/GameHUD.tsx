'use client';

import { useEffect, useRef, memo } from 'react';
import { useGameStore } from '../hooks/useGameStore';

// Memoized static components that rarely change
const DifficultyBadge = memo(function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'tutorial': return 'text-green-400 bg-green-400/20';
      case 'easy': return 'text-cyan-400 bg-cyan-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/20';
      case 'hard': return 'text-orange-400 bg-orange-400/20';
      case 'extreme': return 'text-red-400 bg-red-400/20';
      default: return 'text-white bg-white/20';
    }
  };

  return (
    <div className={`rounded-lg px-2 py-1 backdrop-blur-sm ${getDifficultyColor()}`}>
      <p className="text-[10px] sm:text-xs font-bold uppercase leading-tight">
        {difficulty}
      </p>
    </div>
  );
});

export function GameHUD() {
  // Refs for DOM direct manipulation (no React re-renders)
  const distanceRef = useRef<HTMLParagraphElement>(null);
  const timeRef = useRef<HTMLParagraphElement>(null);
  const healthBarRef = useRef<HTMLDivElement>(null);
  const healthTextRef = useRef<HTMLSpanElement>(null);
  const healthContainerRef = useRef<HTMLDivElement>(null);
  const healthGlowRef = useRef<HTMLDivElement>(null);
  const dangerIconRef = useRef<HTMLDivElement>(null);
  const coinCountRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const feverGaugeRef = useRef<HTMLDivElement>(null);
  const feverIndicatorRef = useRef<HTMLDivElement>(null);
  const feverOverlayRef = useRef<HTMLDivElement>(null);
  const lowHealthWarningRef = useRef<HTMLDivElement>(null);
  const feverDotsRef = useRef<HTMLDivElement[]>([]);

  // Only subscribe to values that need to trigger initial render
  // These rarely change (only on game state transitions)
  const status = useGameStore((state) => state.status);
  const difficulty = useGameStore((state) => state.difficulty);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // RAF-based update loop (no React re-renders)
  useEffect(() => {
    if (status !== 'playing') return;

    let animationId: number;
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 1000 / 30; // 30fps is enough for HUD

    const updateHUD = (timestamp: number) => {
      // Throttle updates to 30fps
      if (timestamp - lastUpdate < UPDATE_INTERVAL) {
        animationId = requestAnimationFrame(updateHUD);
        return;
      }
      lastUpdate = timestamp;

      const state = useGameStore.getState();
      const { distance, elapsedTime, health, maxHealth, coinCount, speed, consecutiveCoins, isFeverMode } = state;
      const healthPercent = (health / maxHealth) * 100;

      // Update distance
      if (distanceRef.current) {
        distanceRef.current.textContent = `${Math.floor(distance)}m`;
      }

      // Update time
      if (timeRef.current) {
        timeRef.current.textContent = formatTime(elapsedTime);
      }

      // Update health bar
      if (healthBarRef.current) {
        healthBarRef.current.style.width = `${healthPercent}%`;

        // Update gradient based on health level
        if (isFeverMode) {
          healthBarRef.current.style.background = 'linear-gradient(to right, #a855f7, #ec4899)';
        } else if (healthPercent > 50) {
          healthBarRef.current.style.background = 'linear-gradient(to right, #22c55e, #4ade80)';
        } else if (healthPercent > 25) {
          healthBarRef.current.style.background = 'linear-gradient(to right, #eab308, #fbbf24)';
        } else {
          healthBarRef.current.style.background = 'linear-gradient(to right, #dc2626, #ef4444)';
        }
      }

      // Update health text
      if (healthTextRef.current) {
        healthTextRef.current.textContent = `${Math.ceil(health)}%`;

        if (healthPercent <= 25 && !isFeverMode) {
          healthTextRef.current.className = 'text-[10px] font-bold drop-shadow-lg text-red-100';
        } else if (healthPercent <= 50 && !isFeverMode) {
          healthTextRef.current.className = 'text-[10px] font-bold drop-shadow-lg text-yellow-100';
        } else {
          healthTextRef.current.className = 'text-[10px] font-bold drop-shadow-lg text-white/90';
        }
      }

      // Update health container border
      if (healthContainerRef.current) {
        let borderClass = 'border-gray-600/50';
        let pulseClass = '';

        if (isFeverMode) {
          borderClass = 'border-purple-500/60';
        } else if (healthPercent <= 25) {
          borderClass = 'border-red-500/80';
          pulseClass = 'animate-pulse';
        } else if (healthPercent <= 50) {
          borderClass = 'border-yellow-500/60';
        }

        healthContainerRef.current.className = `relative w-full h-4 bg-gray-900/80 rounded-full overflow-hidden border-2 ${borderClass} ${pulseClass}`;
      }

      // Update health glow effect
      if (healthGlowRef.current) {
        if (healthPercent <= 25 && !isFeverMode) {
          healthGlowRef.current.style.opacity = '0.6';
          healthGlowRef.current.style.background = '#ef4444';
        } else if (healthPercent <= 50 && !isFeverMode) {
          healthGlowRef.current.style.opacity = '0.3';
          healthGlowRef.current.style.background = '#eab308';
        } else {
          healthGlowRef.current.style.opacity = '0';
        }
      }

      // Update danger icon
      if (dangerIconRef.current) {
        dangerIconRef.current.style.display = healthPercent <= 25 && !isFeverMode ? 'block' : 'none';
      }

      // Update coin count
      if (coinCountRef.current) {
        coinCountRef.current.textContent = String(coinCount);
      }

      // Update speed
      if (speedRef.current) {
        speedRef.current.textContent = `${speed.toFixed(0)} km/h`;
      }

      // Update fever gauge (consecutive coins)
      if (feverGaugeRef.current) {
        feverGaugeRef.current.style.display = consecutiveCoins > 0 && !isFeverMode ? 'flex' : 'none';
      }

      // Update fever dots
      feverDotsRef.current.forEach((dot, i) => {
        if (dot) {
          if (i < consecutiveCoins) {
            dot.className = 'w-1.5 h-1.5 rounded-full transition-all bg-yellow-400 scale-110';
          } else {
            dot.className = 'w-1.5 h-1.5 rounded-full transition-all bg-gray-600';
          }
        }
      });

      // Update fever indicator
      if (feverIndicatorRef.current) {
        feverIndicatorRef.current.style.display = isFeverMode ? 'block' : 'none';
      }

      // Update fever overlay
      if (feverOverlayRef.current) {
        feverOverlayRef.current.style.display = isFeverMode ? 'block' : 'none';
      }

      // Update low health warning
      if (lowHealthWarningRef.current) {
        lowHealthWarningRef.current.style.display = healthPercent <= 30 && !isFeverMode ? 'block' : 'none';
      }

      animationId = requestAnimationFrame(updateHUD);
    };

    animationId = requestAnimationFrame(updateHUD);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [status]);

  return (
    <div className="absolute inset-x-0 top-0 p-2 sm:p-4 pointer-events-none">
      {/* Health Bar - Full width at top */}
      <div className="relative mb-2">
        {/* Health bar glow effect */}
        <div
          ref={healthGlowRef}
          className="absolute inset-0 rounded-full blur-md"
          style={{ opacity: 0 }}
        />

        {/* Health bar container */}
        <div
          ref={healthContainerRef}
          className="relative w-full h-4 bg-gray-900/80 rounded-full overflow-hidden border-2 border-gray-600/50"
        >
          {/* Health bar fill */}
          <div
            ref={healthBarRef}
            className="h-full transition-all duration-150 relative"
            style={{
              width: '100%',
              background: 'linear-gradient(to right, #22c55e, #4ade80)',
            }}
          >
            {/* Highlight effect */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
              }}
            />
            {/* Drain effect */}
            <div
              className="absolute right-0 top-0 bottom-0 w-3"
              style={{
                background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.3))',
              }}
            />
          </div>

          {/* Health percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span ref={healthTextRef} className="text-[10px] font-bold drop-shadow-lg text-white/90">
              100%
            </span>
          </div>
        </div>

        {/* Danger warning icon */}
        <div ref={dangerIconRef} className="absolute -left-1 top-1/2 -translate-y-1/2 animate-pulse" style={{ display: 'none' }}>
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        </div>
      </div>

      {/* Distance display */}
      <div className="text-center mb-2">
        <p ref={distanceRef} className="text-white text-3xl sm:text-4xl font-bold drop-shadow-lg">
          0m
        </p>
        <p ref={timeRef} className="text-gray-400 text-xs">0:00</p>
      </div>

      {/* Bottom stats bar */}
      <div className="flex justify-between items-center gap-2">
        {/* Difficulty badge */}
        <DifficultyBadge difficulty={difficulty} />

        {/* Fever/Coins indicator */}
        <div className="flex items-center gap-2">
          {/* Consecutive coins indicator (fever progress) */}
          <div ref={feverGaugeRef} className="gap-0.5 bg-black/50 px-2 py-1 rounded-full" style={{ display: 'none' }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                ref={(el) => { if (el) feverDotsRef.current[i] = el; }}
                className="w-1.5 h-1.5 rounded-full transition-all bg-gray-600"
              />
            ))}
          </div>

          {/* Fever indicator */}
          <div ref={feverIndicatorRef} className="bg-purple-500/30 border border-purple-500/50 px-2 py-1 rounded-full animate-pulse" style={{ display: 'none' }}>
            <span className="text-purple-300 text-xs font-bold">FEVER!</span>
          </div>

          {/* Coins counter */}
          <div className="bg-black/50 rounded-lg px-2 py-1 flex items-center gap-1">
            <span className="text-yellow-400 text-sm">🪙</span>
            <span ref={coinCountRef} className="text-white text-sm font-bold">0</span>
          </div>
        </div>

        {/* Speed indicator */}
        <div className="bg-black/50 rounded-lg px-2 py-1">
          <span ref={speedRef} className="text-cyan-400 text-xs font-mono">0 km/h</span>
        </div>
      </div>

      {/* Low health warning - floating */}
      <div ref={lowHealthWarningRef} className="absolute bottom-32 sm:bottom-24 left-1/2 -translate-x-1/2" style={{ display: 'none' }}>
        <p className="text-red-400 text-xs sm:text-sm font-bold bg-black/70 px-3 py-1 rounded-full animate-pulse">
          ⚠️ Low Health! Find Potions!
        </p>
      </div>

      {/* Fever overlay */}
      <div ref={feverOverlayRef} className="absolute inset-0 pointer-events-none border-2 sm:border-4 border-purple-500/50 animate-pulse" style={{ display: 'none' }} />
    </div>
  );
}
