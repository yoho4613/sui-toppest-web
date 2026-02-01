'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

interface GameData {
  id: string;
  name: string;
  description: string;
  rules: string[];
  thumbnail: string;
  entryCost: number;
  entryType: 'energy' | 'luck';
  prizePool: string;
  players24h: number;
  topScore: number;
  yourBestScore: number;
  tags: string[];
}

const gamesData: Record<string, GameData> = {
  'spin-wheel': {
    id: 'spin-wheel',
    name: 'Spin & Win',
    description: 'Spin the wheel and test your luck! Land on multipliers to boost your rewards.',
    rules: [
      'Tap to spin the wheel',
      'Wait for it to stop on a prize',
      'Multipliers stack with your bet',
      'Jackpot gives 10x rewards!',
    ],
    thumbnail: '🎰',
    entryCost: 1,
    entryType: 'energy',
    prizePool: '50 SUI',
    players24h: 1247,
    topScore: 15420,
    yourBestScore: 0,
    tags: ['LIVE', 'HOT'],
  },
  'dice-roll': {
    id: 'dice-roll',
    name: 'Dice Master',
    description: 'Roll the dice and predict the outcome. Higher risk, higher reward!',
    rules: [
      'Choose your prediction (over/under)',
      'Set your bet amount',
      'Roll and win if correct',
      'Streak bonuses available!',
    ],
    thumbnail: '🎲',
    entryCost: 50,
    entryType: 'luck',
    prizePool: '30 SUI',
    players24h: 892,
    topScore: 12100,
    yourBestScore: 0,
    tags: ['NEW'],
  },
  'card-flip': {
    id: 'card-flip',
    name: 'Card Flip',
    description: 'Match the hidden cards. Memory meets luck in this exciting game!',
    rules: [
      'Flip cards to find matching pairs',
      'Complete the board to win',
      'Faster completion = higher score',
      'Daily challenges for bonus rewards',
    ],
    thumbnail: '🃏',
    entryCost: 1,
    entryType: 'energy',
    prizePool: '20 SUI',
    players24h: 634,
    topScore: 8900,
    yourBestScore: 0,
    tags: [],
  },
  'number-guess': {
    id: 'number-guess',
    name: 'Number Guess',
    description: 'Guess the mystery number. Get hints and narrow down your choices!',
    rules: [
      'Pick a number between 1-100',
      'Get hints: higher or lower',
      'Fewer guesses = higher score',
      'Perfect guess wins jackpot!',
    ],
    thumbnail: '🔢',
    entryCost: 25,
    entryType: 'luck',
    prizePool: '15 SUI',
    players24h: 423,
    topScore: 5600,
    yourBestScore: 0,
    tags: [],
  },
};

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;
  const [isPlaying, setIsPlaying] = useState(false);

  const game = gamesData[gameId];

  if (!game) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-gray-400 text-lg mb-4">Game not found</p>
        <Link href="/play" className="text-[#4DA2FF] font-semibold">
          ← Back to Games
        </Link>
      </div>
    );
  }

  const handlePlay = () => {
    setIsPlaying(true);
    // In real implementation, this would load the actual game component
    setTimeout(() => {
      setIsPlaying(false);
    }, 2000);
  };

  return (
    <div className="px-5 flex flex-col gap-5 pb-24">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-fit"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Game Header Card */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl overflow-hidden">
        {/* Game Visual */}
        <div className="h-48 bg-gradient-to-br from-[#4DA2FF]/20 to-purple-500/20 flex items-center justify-center relative">
          <span className="text-8xl">{game.thumbnail}</span>
          {/* Tags */}
          <div className="absolute top-4 right-4 flex gap-2">
            {game.tags.map((tag) => (
              <span
                key={tag}
                className={`px-2 py-1 text-xs font-bold rounded-full ${
                  tag === 'LIVE'
                    ? 'bg-red-500 text-white animate-pulse'
                    : tag === 'HOT'
                    ? 'bg-orange-500 text-white'
                    : tag === 'NEW'
                    ? 'bg-green-500 text-white'
                    : 'bg-white/20 text-white'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Game Info */}
        <div className="p-5">
          <h1 className="text-2xl font-bold text-white mb-2">{game.name}</h1>
          <p className="text-gray-400 text-sm leading-relaxed">{game.description}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1A1F26] border border-white/10 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Prize Pool</p>
          <p className="text-[#4DA2FF] font-bold">{game.prizePool}</p>
        </div>
        <div className="bg-[#1A1F26] border border-white/10 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Players (24h)</p>
          <p className="text-white font-bold">{game.players24h.toLocaleString()}</p>
        </div>
        <div className="bg-[#1A1F26] border border-white/10 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Top Score</p>
          <p className="text-yellow-400 font-bold">{game.topScore.toLocaleString()}</p>
        </div>
      </div>

      {/* Your Best Score */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Your Best Score</p>
            <p className="text-2xl font-bold text-white mt-1">
              {game.yourBestScore > 0 ? game.yourBestScore.toLocaleString() : '--'}
            </p>
          </div>
          {game.yourBestScore > 0 && (
            <div className="text-right">
              <p className="text-gray-400 text-xs">Rank</p>
              <p className="text-[#4DA2FF] font-bold">#42</p>
            </div>
          )}
        </div>
      </div>

      {/* Rules */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#4DA2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How to Play
        </h3>
        <ul className="space-y-2">
          {game.rules.map((rule, index) => (
            <li key={index} className="flex items-start gap-3 text-gray-400 text-sm">
              <span className="w-5 h-5 rounded-full bg-[#4DA2FF]/20 text-[#4DA2FF] text-xs flex items-center justify-center shrink-0 mt-0.5">
                {index + 1}
              </span>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      {/* Entry Cost & Play Button */}
      <div className="fixed bottom-24 left-0 right-0 px-5">
        <div className="max-w-[430px] mx-auto">
          <div className="bg-[#1A1F26]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Entry Cost</span>
              <span className="text-white font-bold">
                {game.entryCost} {game.entryType === 'energy' ? '⚡ Energy' : '🪙 LUCK'}
              </span>
            </div>
            <button
              onClick={handlePlay}
              disabled={isPlaying}
              className="w-full py-4 bg-gradient-to-r from-[#4DA2FF] to-purple-500 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(77,163,255,0.4)] hover:shadow-[0_0_30px_rgba(77,163,255,0.6)] transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isPlaying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                'Play Now'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard Preview */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="text-lg">🏆</span>
            Top Players
          </h3>
          <Link href="/play/ranking" className="text-[#4DA2FF] text-sm font-semibold">
            View All →
          </Link>
        </div>
        <div className="space-y-2">
          {[
            { rank: 1, name: 'CryptoKing', score: game.topScore },
            { rank: 2, name: 'LuckyDragon', score: Math.floor(game.topScore * 0.85) },
            { rank: 3, name: 'SuiMaster', score: Math.floor(game.topScore * 0.72) },
          ].map((player) => (
            <div key={player.rank} className="flex items-center gap-3 p-2 bg-white/5 rounded-xl">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                player.rank === 1
                  ? 'bg-yellow-500 text-black'
                  : player.rank === 2
                  ? 'bg-gray-400 text-black'
                  : 'bg-amber-600 text-white'
              }`}>
                {player.rank}
              </span>
              <span className="text-white font-medium flex-1">{player.name}</span>
              <span className="text-gray-400 text-sm">{player.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
