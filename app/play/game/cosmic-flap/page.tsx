'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Import game store to check game status
import { useGameStore } from '@/components/games/cosmic-flap/hooks/useGameStore';

// Dynamically import the game component to avoid SSR issues with Three.js
const CosmicFlapGame = dynamic(
  () => import('@/components/games/cosmic-flap/CosmicFlapGame'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
          <p className="text-gray-400">Loading Cosmic Flap...</p>
        </div>
      </div>
    ),
  }
);

// Back button component that hides during gameplay
function BackButton() {
  const router = useRouter();
  const status = useGameStore((state) => state.status);
  const [isVisible, setIsVisible] = useState(true);

  // Hide during gameplay, show on menu/gameover
  useEffect(() => {
    if (status === 'playing' || status === 'countdown') {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }
  }, [status]);

  if (!isVisible) return null;

  return (
    <button
      onClick={() => router.back()}
      className="absolute top-4 left-4 z-[60] flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-sm rounded-lg text-gray-300 hover:text-white transition-colors"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Exit
    </button>
  );
}

export default function CosmicFlapPage() {
  return (
    <div className="fixed inset-0 bg-slate-900 z-50">
      {/* Back button - hidden during gameplay */}
      <BackButton />

      {/* Game container */}
      <CosmicFlapGame />
    </div>
  );
}
