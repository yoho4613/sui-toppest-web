'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { LoginScreen } from '@/components/app';

// Mock game data - will be replaced with real data later
const GAMES = [
  {
    id: 'spin-wheel',
    name: 'Spin & Win',
    image: '🎰',
    players: 1247,
    reward: '50 SUI',
    tag: 'LIVE',
    tagColor: 'bg-red-500',
  },
  {
    id: 'dice-roll',
    name: 'Dice Master',
    image: '🎲',
    players: 892,
    reward: '30 SUI',
    tag: 'HOT',
    tagColor: 'bg-orange-500',
  },
  {
    id: 'card-flip',
    name: 'Card Flip',
    image: '🃏',
    players: 634,
    reward: '20 SUI',
    tag: 'NEW',
    tagColor: 'bg-purple-500',
  },
  {
    id: 'number-guess',
    name: 'Number Guess',
    image: '🔢',
    players: 423,
    reward: '15 SUI',
    tag: null,
    tagColor: null,
  },
];

const CATEGORIES = ['All Games', 'New', 'Top Earners', 'Casual'];

// Game Lobby Component (shown when logged in)
function GameLobby() {
  const [activeCategory, setActiveCategory] = useState('All Games');

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Title */}
      <div className="px-5 mt-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-black tracking-tight text-white leading-none">
            TOP<span className="bg-gradient-to-r from-[#4DA2FF] to-blue-300 bg-clip-text text-transparent">PEST</span>
          </h1>
          <div className="flex items-center gap-2">
            <div className="h-[2px] w-8 bg-[#4DA2FF]" />
            <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">
              Play to Earn on SUI
            </p>
          </div>
        </div>
      </div>

      {/* Featured Card */}
      <div className="px-5">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#1A1F26] to-[#1A1F26]/50 border border-white/10">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-gradient-to-r from-[#4DA2FF]/20 to-purple-500/20" />
          </div>

          <div className="relative p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/80 text-white mb-2 border border-white/10">
                  LIMITED TIME
                </span>
                <h3 className="text-xl font-bold text-white leading-tight">
                  Weekly Challenge
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-300">Prize Pool</p>
              <span className="text-2xl font-black text-[#4DA2FF]">5,000 SUI</span>
            </div>

            <button className="w-full py-3 bg-[#4DA2FF] hover:bg-blue-400 transition-colors text-[#0F1419] font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(77,163,255,0.3)]">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play Now
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="pl-5">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pr-5 pb-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex-shrink-0 px-5 py-2.5 font-bold text-sm rounded-full transition-all active:scale-95 ${
                activeCategory === category
                  ? 'bg-[#4DA2FF] text-[#0F1419] shadow-[0_0_15px_rgba(77,163,255,0.3)]'
                  : 'bg-[#1A1F26] border border-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Game Grid */}
      <div className="px-5 grid grid-cols-2 gap-4">
        {GAMES.map((game) => (
          <Link
            key={game.id}
            href={`/play/game/${game.id}`}
            className="bg-[#1A1F26] rounded-2xl p-2.5 border border-white/5 shadow-lg group active:scale-95 transition-transform duration-200"
          >
            {/* Game Thumbnail */}
            <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-white/10 to-white/5">
              {/* Tag */}
              {game.tag && (
                <div className={`absolute top-2 left-2 ${game.tagColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10 shadow-lg`}>
                  {game.tag === 'LIVE' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                  {game.tag}
                </div>
              )}

              {/* Game Icon */}
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-5xl group-hover:scale-110 transition-transform duration-300">
                  {game.image}
                </span>
              </div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>

            {/* Game Info */}
            <div className="px-1">
              <h4 className="text-white font-bold text-sm mb-1 truncate">
                {game.name}
              </h4>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {game.players}
                </span>
                <span className="text-[10px] font-medium text-[#4DA2FF] bg-[#4DA2FF]/10 px-1.5 py-0.5 rounded">
                  {game.reward}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom spacer for scroll */}
      <div className="h-4" />
    </div>
  );
}

// Main Page Component
export default function PlayPage() {
  const { isConnected: isWalletConnected } = useSuiWallet();
  const { isAuthenticated: isZkLoginAuth } = useZkLogin();

  const isConnected = isWalletConnected || isZkLoginAuth;

  // Show login screen if not connected
  if (!isConnected) {
    return <LoginScreen />;
  }

  // Show game lobby if connected
  return <GameLobby />;
}
