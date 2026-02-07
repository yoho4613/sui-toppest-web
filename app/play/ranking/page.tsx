'use client';

import { useState, useEffect } from 'react';
import { useGameAPI } from '@/hooks/useGameAPI';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';

type TimeFilter = 'daily' | 'weekly' | 'alltime';
type GameType = 'dash-trials'; // Add more games as they're added

interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  high_score: number;
  distance: number;
  display_name: string;
  avatar_url: string | null;
  games_played: number;
}

const GAMES: { id: GameType; name: string; emoji: string }[] = [
  { id: 'dash-trials', name: 'Dash Trials', emoji: '🏃' },
  // Add more games here as they're added
];

export default function RankingPage() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('weekly');
  const [selectedGame, setSelectedGame] = useState<GameType>('dash-trials');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const { fetchLeaderboard } = useGameAPI();
  const { address: walletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const address = walletAddress || zkAddress;

  // Fetch leaderboard data
  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      const data = await fetchLeaderboard(selectedGame, timeFilter, address || undefined);
      if (data) {
        setLeaderboard(data.leaderboard);
        setUserRank(data.userRank);
        setTotalPlayers(data.totalPlayers);
      }
      setIsLoading(false);
    };

    loadLeaderboard();
  }, [timeFilter, selectedGame, address, fetchLeaderboard]);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500 to-amber-400 text-black';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-black';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white';
    return 'bg-white/10 text-white';
  };

  const selectedGameData = GAMES.find(g => g.id === selectedGame);

  // Empty state when no data
  const EmptyState = () => (
    <div className="text-center py-12">
      <p className="text-gray-400 text-lg mb-2">No rankings yet</p>
      <p className="text-gray-500 text-sm">Be the first to play and set a record!</p>
    </div>
  );

  return (
    <div className="px-5 flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-gray-400 text-sm">Compete for the top spot!</p>
      </div>

      {/* Game Selector (for multiple games) */}
      {GAMES.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                selectedGame === game.id
                  ? 'bg-[#4DA2FF] text-white'
                  : 'bg-[#1A1F26] border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <span>{game.emoji}</span>
              <span className="text-sm font-medium">{game.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Current Game Badge */}
      <div className="flex items-center justify-center gap-2 py-2">
        <span className="text-2xl">{selectedGameData?.emoji}</span>
        <span className="text-white font-bold">{selectedGameData?.name}</span>
      </div>

      {/* Time Filter Tabs */}
      <div className="flex bg-[#1A1F26] rounded-full p-1 border border-white/10">
        {(['daily', 'weekly', 'alltime'] as TimeFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setTimeFilter(filter)}
            className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${
              timeFilter === filter
                ? 'bg-[#4DA2FF] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {filter === 'alltime' ? 'All Time' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Player Count */}
      <div className="text-center text-gray-400 text-sm">
        {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} ranked
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#4DA2FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Top 3 Podium */}
          {leaderboard.length >= 3 && (
            <div className="flex items-end justify-center gap-3 py-4">
              {/* 2nd Place */}
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-gray-300 to-gray-400 p-[2px] mb-2">
                  <div className="w-full h-full rounded-full bg-[#1A1F26] flex items-center justify-center overflow-hidden">
                    {leaderboard[1].avatar_url ? (
                      <img src={leaderboard[1].avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">🥈</span>
                    )}
                  </div>
                </div>
                <p className="text-white text-sm font-semibold truncate max-w-[70px]">
                  {leaderboard[1].display_name}
                </p>
                <p className="text-cyan-400 text-xs font-semibold">{leaderboard[1].distance.toLocaleString()}m</p>
                <div className="mt-2 h-16 w-16 bg-gray-400/20 rounded-t-lg flex items-center justify-center">
                  <span className="text-gray-300 font-bold text-xl">2</span>
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center -mt-4">
                <div className="w-18 h-18 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 p-[3px] mb-2 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">👑</div>
                  <div className="w-16 h-16 rounded-full bg-[#1A1F26] flex items-center justify-center overflow-hidden">
                    {leaderboard[0].avatar_url ? (
                      <img src={leaderboard[0].avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🏆</span>
                    )}
                  </div>
                </div>
                <p className="text-white text-sm font-semibold truncate max-w-[80px]">
                  {leaderboard[0].display_name}
                </p>
                <p className="text-yellow-400 text-xs font-semibold">{leaderboard[0].distance.toLocaleString()}m</p>
                <div className="mt-2 h-24 w-18 bg-yellow-500/20 rounded-t-lg flex items-center justify-center w-[72px]">
                  <span className="text-yellow-400 font-bold text-2xl">1</span>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 to-amber-700 p-[2px] mb-2">
                  <div className="w-full h-full rounded-full bg-[#1A1F26] flex items-center justify-center overflow-hidden">
                    {leaderboard[2].avatar_url ? (
                      <img src={leaderboard[2].avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">🥉</span>
                    )}
                  </div>
                </div>
                <p className="text-white text-sm font-semibold truncate max-w-[70px]">
                  {leaderboard[2].display_name}
                </p>
                <p className="text-cyan-400 text-xs font-semibold">{leaderboard[2].distance.toLocaleString()}m</p>
                <div className="mt-2 h-12 w-16 bg-amber-600/20 rounded-t-lg flex items-center justify-center">
                  <span className="text-amber-500 font-bold text-xl">3</span>
                </div>
              </div>
            </div>
          )}

          {/* Rest of Leaderboard */}
          {leaderboard.length > 3 && (
            <div className="bg-[#1A1F26] border border-white/10 rounded-2xl overflow-hidden">
              {leaderboard.slice(3).map((entry, index) => {
                const isCurrentUser = address && entry.wallet_address === address;
                return (
                  <div
                    key={entry.wallet_address}
                    className={`flex items-center gap-3 p-4 ${
                      index !== leaderboard.length - 4 ? 'border-b border-white/5' : ''
                    } ${isCurrentUser ? 'bg-[#4DA2FF]/10' : ''}`}
                  >
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-full ${getRankStyle(entry.rank)} flex items-center justify-center font-bold text-sm`}>
                      {entry.rank}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#4DA2FF] to-purple-500 p-[1px]">
                      <div className="w-full h-full rounded-full bg-[#1A1F26] flex items-center justify-center overflow-hidden">
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt={entry.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-400 text-xs font-bold">
                            {entry.display_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Name & Distance */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${isCurrentUser ? 'text-[#4DA2FF]' : 'text-white'}`}>
                        {entry.display_name}
                        {isCurrentUser && <span className="text-xs ml-2">(You)</span>}
                      </p>
                      <p className="text-gray-400 text-xs">{entry.games_played} game{entry.games_played !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Distance */}
                    <div className="text-right">
                      <p className="text-cyan-400 font-bold">{entry.distance.toLocaleString()}m</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Your Rank Card (if not in top list) */}
          {userRank && userRank.rank > 10 && (
            <div className="bg-[#1A1F26] border border-[#4DA2FF]/30 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#4DA2FF]/20 flex items-center justify-center font-bold text-[#4DA2FF]">
                  {userRank.rank}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Your Rank</p>
                  <p className="text-gray-400 text-xs">{userRank.games_played} game{userRank.games_played !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-cyan-400 font-bold">{userRank.distance.toLocaleString()}m</p>
                </div>
              </div>
            </div>
          )}

          {/* If user has no rank */}
          {!userRank && address && (
            <div className="bg-[#1A1F26] border border-[#4DA2FF]/30 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#4DA2FF]/20 flex items-center justify-center font-bold text-[#4DA2FF]">
                  --
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Your Rank</p>
                  <p className="text-gray-400 text-xs">Play to get on the leaderboard!</p>
                </div>
                <div className="text-right">
                  <p className="text-cyan-400 font-bold">0m</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
