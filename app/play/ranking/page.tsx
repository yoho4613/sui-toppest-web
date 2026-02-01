'use client';

import { useState } from 'react';

type TimeFilter = 'daily' | 'weekly' | 'alltime';

interface LeaderboardEntry {
  rank: number;
  nickname: string;
  avatar?: string;
  score: number;
  prize?: string;
  isCurrentUser?: boolean;
}

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, nickname: 'CryptoKing', score: 15420, prize: '50 SUI' },
  { rank: 2, nickname: 'LuckyDragon', score: 12850, prize: '30 SUI' },
  { rank: 3, nickname: 'SuiMaster', score: 11200, prize: '20 SUI' },
  { rank: 4, nickname: 'BlockchainBoss', score: 9800 },
  { rank: 5, nickname: 'TokenTrader', score: 8650 },
  { rank: 6, nickname: 'Web3Wizard', score: 7420 },
  { rank: 7, nickname: 'MoveDevGod', score: 6890 },
  { rank: 8, nickname: 'NFTCollector', score: 5640 },
  { rank: 9, nickname: 'DeFiDegen', score: 4320 },
  { rank: 10, nickname: 'ChainGamer', score: 3150 },
];

export default function RankingPage() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('weekly');

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500 to-amber-400 text-black';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-black';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white';
    return 'bg-white/10 text-white';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '👑';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div className="px-5 flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-gray-400 text-sm">Compete for weekly prizes!</p>
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

      {/* Prize Pool Banner */}
      <div className="bg-gradient-to-r from-[#4DA2FF]/20 to-purple-500/20 border border-[#4DA2FF]/30 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Weekly Prize Pool</p>
            <p className="text-2xl font-bold text-white mt-1">100 SUI</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Ends in</p>
            <p className="text-[#4DA2FF] font-bold">3d 14h 22m</p>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="flex items-end justify-center gap-3 py-4">
        {/* 2nd Place */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-gray-300 to-gray-400 p-[2px] mb-2">
            <div className="w-full h-full rounded-full bg-[#1A1F26] flex items-center justify-center">
              <span className="text-xl">🥈</span>
            </div>
          </div>
          <p className="text-white text-sm font-semibold truncate max-w-[70px]">
            {mockLeaderboard[1].nickname}
          </p>
          <p className="text-gray-400 text-xs">{mockLeaderboard[1].score.toLocaleString()}</p>
          <div className="mt-2 h-16 w-16 bg-gray-400/20 rounded-t-lg flex items-center justify-center">
            <span className="text-gray-300 font-bold text-xl">2</span>
          </div>
        </div>

        {/* 1st Place */}
        <div className="flex flex-col items-center -mt-4">
          <div className="w-18 h-18 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 p-[3px] mb-2 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">👑</div>
            <div className="w-16 h-16 rounded-full bg-[#1A1F26] flex items-center justify-center">
              <span className="text-2xl">🏆</span>
            </div>
          </div>
          <p className="text-white text-sm font-semibold truncate max-w-[80px]">
            {mockLeaderboard[0].nickname}
          </p>
          <p className="text-yellow-400 text-xs font-semibold">{mockLeaderboard[0].score.toLocaleString()}</p>
          <div className="mt-2 h-24 w-18 bg-yellow-500/20 rounded-t-lg flex items-center justify-center w-[72px]">
            <span className="text-yellow-400 font-bold text-2xl">1</span>
          </div>
        </div>

        {/* 3rd Place */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 to-amber-700 p-[2px] mb-2">
            <div className="w-full h-full rounded-full bg-[#1A1F26] flex items-center justify-center">
              <span className="text-xl">🥉</span>
            </div>
          </div>
          <p className="text-white text-sm font-semibold truncate max-w-[70px]">
            {mockLeaderboard[2].nickname}
          </p>
          <p className="text-gray-400 text-xs">{mockLeaderboard[2].score.toLocaleString()}</p>
          <div className="mt-2 h-12 w-16 bg-amber-600/20 rounded-t-lg flex items-center justify-center">
            <span className="text-amber-500 font-bold text-xl">3</span>
          </div>
        </div>
      </div>

      {/* Rest of Leaderboard */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl overflow-hidden">
        {mockLeaderboard.slice(3).map((entry, index) => (
          <div
            key={entry.rank}
            className={`flex items-center gap-3 p-4 ${
              index !== mockLeaderboard.length - 4 ? 'border-b border-white/5' : ''
            } ${entry.isCurrentUser ? 'bg-[#4DA2FF]/10' : ''}`}
          >
            {/* Rank */}
            <div className={`w-8 h-8 rounded-full ${getRankStyle(entry.rank)} flex items-center justify-center font-bold text-sm`}>
              {entry.rank}
            </div>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#4DA2FF] to-purple-500 p-[1px]">
              <div className="w-full h-full rounded-full bg-[#1A1F26] flex items-center justify-center">
                {entry.avatar ? (
                  <img src={entry.avatar} alt={entry.nickname} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-xs font-bold">
                    {entry.nickname.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Name & Score */}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold truncate ${entry.isCurrentUser ? 'text-[#4DA2FF]' : 'text-white'}`}>
                {entry.nickname}
                {entry.isCurrentUser && <span className="text-xs ml-2">(You)</span>}
              </p>
              <p className="text-gray-400 text-xs">{entry.score.toLocaleString()} pts</p>
            </div>

            {/* Prize (if any) */}
            {entry.prize && (
              <span className="px-2 py-1 bg-[#4DA2FF]/20 text-[#4DA2FF] text-xs font-semibold rounded-full">
                {entry.prize}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Your Rank Card (if not in top 10) */}
      <div className="bg-[#1A1F26] border border-[#4DA2FF]/30 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#4DA2FF]/20 flex items-center justify-center font-bold text-[#4DA2FF]">
            --
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">Your Rank</p>
            <p className="text-gray-400 text-xs">Play more to climb the leaderboard!</p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold">0</p>
            <p className="text-gray-500 text-xs">points</p>
          </div>
        </div>
      </div>
    </div>
  );
}
