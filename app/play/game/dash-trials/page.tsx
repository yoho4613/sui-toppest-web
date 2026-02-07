'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// Dynamically import the game component to avoid SSR issues with Three.js
const DashTrialsGame = dynamic(
  () => import('@/components/games/dash-trials').then((mod) => mod.DashTrialsGame),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
          <p className="text-gray-400">Loading Dash Trials...</p>
        </div>
      </div>
    ),
  }
);

export default function DashTrialsPage() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-sm rounded-lg text-gray-300 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Exit
      </button>

      {/* Game container */}
      <DashTrialsGame />
    </div>
  );
}
