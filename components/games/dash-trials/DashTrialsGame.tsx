'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Player } from './objects/Player';
import { Track, Environment } from './objects/Track';
import { ObstacleManager } from './objects/ObstacleManager';
import { GameHUD } from './ui/GameHUD';
import { CountdownOverlay, MenuOverlay, ResultOverlay } from './ui/CountdownOverlay';
import { useControls } from './hooks/useControls';
import { useGameStore } from './hooks/useGameStore';
import { useGameAudio } from './hooks/useGameAudio';

// Game loop component
function GameLoop() {
  const status = useGameStore((state) => state.status);
  const storeRef = useRef(useGameStore.getState());

  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;

    let lastTime = performance.now();
    let animationId: number;

    const gameLoop = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      storeRef.current.updateDistance(delta);
      storeRef.current.updateTime(delta);
      storeRef.current.updateEnergy(delta);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [status]);

  return null;
}

// Responsive camera component
function ResponsiveCamera() {
  const [fov, setFov] = useState(60);

  useEffect(() => {
    const updateFov = () => {
      // Wider FOV on mobile for better lane visibility
      const isMobile = window.innerWidth < 768;
      const isPortrait = window.innerHeight > window.innerWidth;

      if (isMobile && isPortrait) {
        setFov(85); // Much wider FOV for mobile portrait - prevent player cutoff
      } else if (isMobile) {
        setFov(75); // Wider for mobile landscape
      } else {
        setFov(60); // Desktop default
      }
    };

    updateFov();
    window.addEventListener('resize', updateFov);
    return () => window.removeEventListener('resize', updateFov);
  }, []);

  return (
    <PerspectiveCamera
      makeDefault
      position={[0, 4, 8]}
      rotation={[-0.3, 0, 0]}
      fov={fov}
    />
  );
}

// Game scene with 3D elements
function GameScene() {
  const status = useGameStore((state) => state.status);

  return (
    <>
      <Environment />

      {/* Responsive Camera */}
      <ResponsiveCamera />

      {/* Game elements */}
      <Physics gravity={[0, -30, 0]} paused={status !== 'playing'}>
        <Player />
        <Track />
        {(status === 'playing' || status === 'countdown') && <ObstacleManager />}
      </Physics>
    </>
  );
}

// Controls wrapper
function ControlsWrapper() {
  useControls();
  return null;
}

// Audio manager with mute button (hidden during gameplay for fullscreen)
function AudioManager() {
  const { toggleMute } = useGameAudio();
  const status = useGameStore((state) => state.status);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dashTrials_audioMuted');
    setIsMuted(saved === 'true');
  }, []);

  const handleToggle = () => {
    const newMuted = toggleMute();
    setIsMuted(newMuted);
  };

  // Hide during gameplay for fullscreen experience
  const isPlaying = status === 'playing' || status === 'countdown';

  return (
    <button
      onClick={handleToggle}
      className={`absolute top-4 right-4 z-50 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-base sm:text-xl hover:bg-black/70 transition-all duration-300 ${
        isPlaying ? 'opacity-30 scale-75' : 'opacity-100 scale-100'
      }`}
      aria-label={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? '🔇' : '🔊'}
    </button>
  );
}

// Touch zone hint overlay (shows briefly when game starts)
function TouchZoneHint() {
  const status = useGameStore((state) => state.status);
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (status === 'playing') {
      setVisible(true);
      setOpacity(1);

      // Fade out after 1.5 seconds
      const fadeTimer = setTimeout(() => {
        setOpacity(0);
      }, 1500);

      // Hide after fade completes
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 2000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    } else {
      setVisible(false);
      setOpacity(0);
    }
  }, [status]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-30 pointer-events-none flex transition-opacity duration-500"
      style={{ opacity }}
    >
      {/* Left zone */}
      <div className="flex-1 flex items-center justify-center border-r border-green-500/30 bg-green-500/10">
        <div className="text-center">
          <span className="text-2xl sm:text-4xl">👈</span>
          <p className="text-green-400 text-xs sm:text-sm font-bold mt-1">LEFT</p>
        </div>
      </div>

      {/* Middle zone */}
      <div className="flex-1 flex items-center justify-center bg-cyan-500/10">
        <div className="text-center">
          <span className="text-2xl sm:text-4xl">👆</span>
          <p className="text-cyan-400 text-xs sm:text-sm font-bold mt-1">JUMP</p>
          <p className="text-blue-400 text-[10px] sm:text-xs mt-1 bg-blue-500/20 px-2 py-0.5 rounded">↓ Swipe = Slide</p>
        </div>
      </div>

      {/* Right zone */}
      <div className="flex-1 flex items-center justify-center border-l border-green-500/30 bg-green-500/10">
        <div className="text-center">
          <span className="text-2xl sm:text-4xl">👉</span>
          <p className="text-green-400 text-xs sm:text-sm font-bold mt-1">RIGHT</p>
        </div>
      </div>
    </div>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
        <p className="text-gray-400">Loading game...</p>
      </div>
    </div>
  );
}

// Main game component
export function DashTrialsGame() {
  useEffect(() => {
    // Reset on unmount
    return () => {
      useGameStore.getState().reset();
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        className="touch-none"
      >
        <Suspense fallback={null}>
          <GameScene />
        </Suspense>
      </Canvas>

      {/* Game loop */}
      <GameLoop />

      {/* Controls */}
      <ControlsWrapper />

      {/* UI Overlays */}
      <GameHUD />
      <AudioManager />
      <TouchZoneHint />
      <CountdownOverlay />
      <MenuOverlay />
      <ResultOverlay />

      {/* Loading state (outside canvas) */}
      <Suspense fallback={<LoadingFallback />}>
        <div />
      </Suspense>
    </div>
  );
}
