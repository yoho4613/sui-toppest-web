'use client';

import Link from 'next/link';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useAppStore } from '@/stores/useAppStore';
import { LoginScreen } from '@/components/app';

// Game data - only active games
const GAMES = [
  {
    id: 'dash-trials',
    name: 'Dash Trials',
    image: '🏃',
    tag: 'NEW',
    tagColor: 'bg-green-500',
    description: '3D Time Attack Runner',
  },
];

// Game Lobby Component (shown when logged in)
function GameLobby() {
  // Use global store - data already loaded in layout
  const { ticketData, isInitializing } = useAppStore();

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Title with Ticket Count */}
      <div className="px-5 mt-2">
        <div className="flex items-start justify-between">
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

          {/* Ticket Count */}
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl px-3 py-2">
            {isInitializing ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ticketData ? (
              <div className="flex flex-col gap-1">
                {/* Daily Tickets */}
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🎟️</span>
                  <span className="text-white font-bold text-sm">{ticketData.dailyTickets}</span>
                  <span className="text-gray-400 text-xs">/{ticketData.maxDailyTickets}</span>
                </div>
                {/* Star Tickets */}
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">⭐</span>
                  <span className="text-yellow-400 font-bold text-sm">{ticketData.starTickets}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl">🎟️</span>
                <span className="text-gray-400 text-sm">3/3</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CLUB Reward Balance */}
      <div className="px-5">
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                {/* Club (Clover) Card Suit Icon */}
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a4 4 0 0 0-4 4c0 1.16.5 2.21 1.29 2.94-.47.36-.85.84-1.1 1.4A4 4 0 0 0 2 14a4 4 0 0 0 4 4c.74 0 1.43-.2 2.03-.55.03.18.05.36.05.55 0 .34-.03.67-.09 1H10a2 2 0 0 0 2 2 2 2 0 0 0 2-2h1.91c-.06-.33-.09-.66-.09-1 0-.19.02-.37.05-.55.6.35 1.29.55 2.03.55a4 4 0 0 0 4-4 4 4 0 0 0-6.19-3.34c-.25-.56-.63-1.04-1.1-1.4A3.97 3.97 0 0 0 16 6a4 4 0 0 0-4-4z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400">$CLUB Rewards</p>
                <p className="text-white font-bold">
                  {isInitializing ? (
                    <span className="inline-block w-12 h-4 bg-white/10 rounded animate-pulse" />
                  ) : (
                    <>{(ticketData?.clubBalance ?? 0).toLocaleString()} CLUB</>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Earned from games</p>
              <p className="text-xs text-purple-400">Play more to earn!</p>
            </div>
          </div>
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
              <p className="text-[11px] text-gray-400">{game.description}</p>
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
