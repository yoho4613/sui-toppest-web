/**
 * Game HUD Component
 *
 * Displays in-game stats:
 * - Distance (center top)
 * - Obstacles passed (left)
 * - Coins collected (right)
 * - Active item effects (bottom)
 */

'use client';

import { useRef, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { ITEM_EFFECTS } from '../constants';

export function GameHUD() {
  // Refs for direct DOM manipulation (performance)
  const distanceRef = useRef<HTMLDivElement>(null);
  const obstaclesRef = useRef<HTMLDivElement>(null);
  const coinsRef = useRef<HTMLDivElement>(null);
  const shieldBarRef = useRef<HTMLDivElement>(null);
  const slowBarRef = useRef<HTMLDivElement>(null);

  // Animation frame update
  useEffect(() => {
    let animationId: number;

    const update = () => {
      const state = useGameStore.getState();

      if (state.status !== 'playing') {
        animationId = requestAnimationFrame(update);
        return;
      }

      // Update distance
      if (distanceRef.current) {
        distanceRef.current.textContent = `${Math.floor(state.distance)}m`;
      }

      // Update obstacles
      if (obstaclesRef.current) {
        obstaclesRef.current.textContent = state.obstaclesPassed.toString();
      }

      // Update coins
      if (coinsRef.current) {
        coinsRef.current.textContent = state.coinsCollected.toString();
      }

      // Update shield bar
      if (shieldBarRef.current) {
        if (state.hasShield) {
          const remaining = state.shieldEndTime - Date.now();
          const percent = Math.max(0, (remaining / ITEM_EFFECTS.SHIELD_DURATION) * 100);
          shieldBarRef.current.style.width = `${percent}%`;
          shieldBarRef.current.parentElement!.style.opacity = '1';

          // Blink when low
          if (remaining < ITEM_EFFECTS.SHIELD_BLINK_AT) {
            shieldBarRef.current.style.opacity = Math.sin(Date.now() * 0.01) > 0 ? '1' : '0.3';
          } else {
            shieldBarRef.current.style.opacity = '1';
          }
        } else {
          shieldBarRef.current.parentElement!.style.opacity = '0';
        }
      }

      // Update slow bar (phase 1: hold + phase 2: recovery)
      if (slowBarRef.current) {
        if (state.isSlowed && state.slowCollectedAt > 0) {
          const totalDuration = ITEM_EFFECTS.SLOW_HOLD_DURATION + ITEM_EFFECTS.SLOW_RECOVERY_DURATION;
          const elapsed = Date.now() - state.slowCollectedAt;
          const remaining = totalDuration - elapsed;
          const percent = Math.max(0, (remaining / totalDuration) * 100);
          slowBarRef.current.style.width = `${percent}%`;
          slowBarRef.current.parentElement!.style.opacity = '1';
        } else {
          slowBarRef.current.parentElement!.style.opacity = '0';
        }
      }

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(animationId);
  }, []);

  const status = useGameStore((s) => s.status);

  if (status !== 'playing') return null;

  return (
    <div className="absolute inset-0 pointer-events-none p-4">
      {/* Top bar */}
      <div className="flex justify-between items-start">
        {/* Obstacles count */}
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2">
          <span className="text-pink-400 text-lg">🎯</span>
          <span ref={obstaclesRef} className="text-white font-bold text-xl font-orbitron">
            0
          </span>
        </div>

        {/* Distance (center) */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2">
          <span ref={distanceRef} className="text-cyan-400 font-bold text-2xl font-orbitron">
            0m
          </span>
        </div>

        {/* Coins */}
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2">
          <span className="text-yellow-400 text-lg">🪙</span>
          <span ref={coinsRef} className="text-white font-bold text-xl font-orbitron">
            0
          </span>
        </div>
      </div>

      {/* Bottom effect bars */}
      <div className="absolute bottom-4 left-4 right-4 space-y-2">
        {/* Shield bar */}
        <div className="opacity-0 transition-opacity duration-200">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm">🛡️ SHIELD</span>
            <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
              <div
                ref={shieldBarRef}
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Slow bar */}
        <div className="opacity-0 transition-opacity duration-200">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 text-sm">⏱️ SLOW</span>
            <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
              <div
                ref={slowBarRef}
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameHUD;
