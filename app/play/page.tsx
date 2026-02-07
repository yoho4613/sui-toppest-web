'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useGameAPI } from '@/hooks/useGameAPI';
import { LoginScreen } from '@/components/app';

const GAME_TYPE = 'dash-trials';

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
  const { address: walletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const address = walletAddress || zkAddress;

  const { checkTickets, isLoadingTickets } = useGameAPI();
  const [ticketStatus, setTicketStatus] = useState<{
    remainingTickets: number;
    maxTickets: number;
  } | null>(null);

  // Fetch ticket status on mount
  useEffect(() => {
    if (address) {
      checkTickets(address, GAME_TYPE).then((result) => {
        if (result) {
          setTicketStatus({
            remainingTickets: result.remainingTickets,
            maxTickets: result.maxTickets,
          });
        }
      });
    }
  }, [address, checkTickets]);

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
            <div className="flex items-center gap-2">
              <span className="text-xl">🎟️</span>
              <div className="text-right">
                {isLoadingTickets ? (
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : ticketStatus ? (
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-white font-bold text-lg">{ticketStatus.remainingTickets}</span>
                    <span className="text-gray-400 text-xs">/{ticketStatus.maxTickets}</span>
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">3/3</span>
                )}
              </div>
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
