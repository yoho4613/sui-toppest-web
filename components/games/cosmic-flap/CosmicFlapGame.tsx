/**
 * Cosmic Flap Game - Main Component
 *
 * A Flappy Bird-style space game built with Three.js/R3F.
 * Features:
 * - Tap to flap mechanics
 * - Pipe obstacles with gaps
 * - Power-up items (Shield, Slow, Coins)
 * - Distance-based scoring
 * - Anti-cheat compatible submission
 */

'use client';

import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGameStore } from './hooks/useGameStore';
import { useControls } from './hooks/useControls';
import { useGameAudio } from './hooks/useGameAudio';
import { useCosmicFlapSounds } from './hooks/useGameSounds';
import { Bird } from './objects/Bird';
import { Background } from './objects/Background';
import { ObstacleManager } from './objects/ObstacleManager';
import { GameHUD } from './ui/GameHUD';
import { OverlayManager } from './ui/CountdownOverlay';
import { useGameAPI } from '@/hooks/useGameAPI';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { GAME_TYPE } from './constants';

// ============================================
// Camera Controller (adapts to portrait/mobile)
// ============================================

function CameraController() {
  const { camera, size } = useThree();

  useEffect(() => {
    const aspect = size.width / size.height;

    if (aspect < 1) {
      // Portrait: t ranges from 0 (aspect=1) to 1 (aspect≤0.4)
      const t = Math.min(1, (1 - aspect) / 0.6);
      camera.position.z = 10 + t * 3;   // 10 → 13 (pull back to show more)
      camera.position.x = -t * 1;       // shift left to center on gameplay
    } else {
      camera.position.z = 10;
      camera.position.x = 0;
    }
  }, [camera, size]);

  return null;
}

// ============================================
// Game Scene
// ============================================

function GameScene() {
  // Initialize controls
  useControls();

  return (
    <>
      {/* Adapt camera for portrait/mobile screens */}
      <CameraController />

      {/* All materials are MeshBasicMaterial - no scene lights needed */}

      {/* Background */}
      <Background />

      {/* Player */}
      <Bird />

      {/* Obstacles */}
      <ObstacleManager />
    </>
  );
}

// ============================================
// Sound Effects Manager
// ============================================

function SoundManager() {
  useCosmicFlapSounds();
  return null;
}

// ============================================
// Audio Manager (BGM + mute button)
// ============================================

function AudioManager() {
  const { toggleMute, isMuted } = useGameAudio();
  const status = useGameStore((state) => state.status);
  const isPlaying = status === 'playing' || status === 'countdown';

  return (
    <button
      onClick={toggleMute}
      data-clickable
      className={`absolute top-4 right-4 z-50 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-base sm:text-xl hover:bg-black/70 transition-all duration-300 ${
        isPlaying ? 'opacity-30 scale-75' : 'opacity-100 scale-100'
      }`}
      aria-label={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? '🔇' : '🔊'}
    </button>
  );
}

// ============================================
// Loading Fallback
// ============================================

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 mt-4">Loading Cosmic Flap...</p>
      </div>
    </div>
  );
}

// ============================================
// Main Game Component
// ============================================

export function CosmicFlapGame() {
  const status = useGameStore((s) => s.status);
  const reset = useGameStore((s) => s.reset);
  const { startGameSession } = useGameAPI();
  const { address: suiWalletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const walletAddress = suiWalletAddress || zkAddress;

  // Start session when entering countdown
  useEffect(() => {
    if (status === 'countdown' && walletAddress) {
      startGameSession(walletAddress, GAME_TYPE).catch((err) => {
        console.error('Failed to start game session:', err);
      });
    }
  }, [status, walletAddress, startGameSession]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden touch-none select-none">
      {/* 3D Canvas */}
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          className="w-full h-full"
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          camera={{
            position: [0, 0, 10],
            fov: 60,
            near: 0.1,
            far: 100,
          }}
          dpr={1}
        >
          <GameScene />
        </Canvas>
      </Suspense>

      {/* Sound */}
      <SoundManager />

      {/* UI Overlays */}
      <GameHUD />
      <AudioManager />
      <OverlayManager />

      {/* Touch hint for mobile */}
      {status === 'playing' && (
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 text-gray-500 text-[10px] sm:text-xs animate-pulse pointer-events-none">
          Tap anywhere to flap
        </div>
      )}
    </div>
  );
}

export default CosmicFlapGame;
