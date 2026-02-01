'use client';

import { useState } from 'react';

type QuestCategory = 'daily' | 'weekly' | 'special';

interface Quest {
  id: string;
  title: string;
  description: string;
  reward: {
    type: 'luck' | 'sui' | 'energy';
    amount: number;
  };
  progress: number;
  total: number;
  completed: boolean;
  claimed: boolean;
  category: QuestCategory;
  icon: string;
}

const mockQuests: Quest[] = [
  // Daily
  {
    id: 'd1',
    title: 'First Game of the Day',
    description: 'Play any game once',
    reward: { type: 'luck', amount: 50 },
    progress: 0,
    total: 1,
    completed: false,
    claimed: false,
    category: 'daily',
    icon: '🎮',
  },
  {
    id: 'd2',
    title: 'Lucky Streak',
    description: 'Win 3 games in a row',
    reward: { type: 'luck', amount: 150 },
    progress: 1,
    total: 3,
    completed: false,
    claimed: false,
    category: 'daily',
    icon: '🔥',
  },
  {
    id: 'd3',
    title: 'High Roller',
    description: 'Score 1000+ points in any game',
    reward: { type: 'energy', amount: 1 },
    progress: 1,
    total: 1,
    completed: true,
    claimed: false,
    category: 'daily',
    icon: '💎',
  },
  // Weekly
  {
    id: 'w1',
    title: 'Dedicated Player',
    description: 'Play 20 games this week',
    reward: { type: 'luck', amount: 500 },
    progress: 8,
    total: 20,
    completed: false,
    claimed: false,
    category: 'weekly',
    icon: '📅',
  },
  {
    id: 'w2',
    title: 'Game Explorer',
    description: 'Try 5 different games',
    reward: { type: 'luck', amount: 300 },
    progress: 3,
    total: 5,
    completed: false,
    claimed: false,
    category: 'weekly',
    icon: '🗺️',
  },
  {
    id: 'w3',
    title: 'Leaderboard Climber',
    description: 'Reach Top 100 in any game',
    reward: { type: 'sui', amount: 1 },
    progress: 0,
    total: 1,
    completed: false,
    claimed: false,
    category: 'weekly',
    icon: '🏆',
  },
  // Special
  {
    id: 's1',
    title: 'Early Bird',
    description: 'Complete profile setup',
    reward: { type: 'luck', amount: 200 },
    progress: 1,
    total: 1,
    completed: true,
    claimed: true,
    category: 'special',
    icon: '🌟',
  },
  {
    id: 's2',
    title: 'Social Butterfly',
    description: 'Invite 3 friends to join',
    reward: { type: 'sui', amount: 5 },
    progress: 0,
    total: 3,
    completed: false,
    claimed: false,
    category: 'special',
    icon: '🦋',
  },
];

export default function QuestsPage() {
  const [activeCategory, setActiveCategory] = useState<QuestCategory>('daily');

  const filteredQuests = mockQuests.filter((q) => q.category === activeCategory);

  const dailyCompleted = mockQuests.filter((q) => q.category === 'daily' && q.completed).length;
  const dailyTotal = mockQuests.filter((q) => q.category === 'daily').length;

  const getRewardIcon = (type: 'luck' | 'sui' | 'energy') => {
    if (type === 'luck') return '🪙';
    if (type === 'sui') return '💎';
    return '⚡';
  };

  const getRewardLabel = (type: 'luck' | 'sui' | 'energy', amount: number) => {
    if (type === 'luck') return `${amount} LUCK`;
    if (type === 'sui') return `${amount} SUI`;
    return `${amount} Energy`;
  };

  return (
    <div className="px-5 flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Quests</h1>
        <p className="text-gray-400 text-sm">Complete quests to earn rewards!</p>
      </div>

      {/* Daily Progress Banner */}
      <div className="bg-gradient-to-r from-[#4DA2FF]/20 to-purple-500/20 border border-[#4DA2FF]/30 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Daily Progress</p>
            <p className="text-white font-bold mt-1">{dailyCompleted}/{dailyTotal} Completed</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Resets in</p>
            <p className="text-[#4DA2FF] font-bold">14h 32m</p>
          </div>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#4DA2FF] to-purple-500 rounded-full transition-all"
            style={{ width: `${(dailyCompleted / dailyTotal) * 100}%` }}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex bg-[#1A1F26] rounded-full p-1 border border-white/10">
        {(['daily', 'weekly', 'special'] as QuestCategory[]).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${
              activeCategory === category
                ? 'bg-[#4DA2FF] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      {/* Quest List */}
      <div className="space-y-3">
        {filteredQuests.map((quest) => (
          <div
            key={quest.id}
            className={`bg-[#1A1F26] border rounded-2xl p-4 transition-all ${
              quest.claimed
                ? 'border-white/5 opacity-60'
                : quest.completed
                ? 'border-green-500/30'
                : 'border-white/10'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl shrink-0">
                {quest.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className={`font-semibold ${quest.claimed ? 'text-gray-500' : 'text-white'}`}>
                      {quest.title}
                    </h3>
                    <p className="text-gray-400 text-sm mt-0.5">{quest.description}</p>
                  </div>

                  {/* Reward Badge */}
                  <div className={`px-2 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                    quest.reward.type === 'sui'
                      ? 'bg-[#4DA2FF]/20 text-[#4DA2FF]'
                      : quest.reward.type === 'luck'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {getRewardIcon(quest.reward.type)} {getRewardLabel(quest.reward.type, quest.reward.amount)}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-500 text-xs">
                      {quest.progress}/{quest.total}
                    </span>
                    {quest.completed && !quest.claimed && (
                      <span className="text-green-400 text-xs font-semibold">Ready to claim!</span>
                    )}
                    {quest.claimed && (
                      <span className="text-gray-500 text-xs">Claimed</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        quest.completed
                          ? 'bg-green-500'
                          : 'bg-gradient-to-r from-[#4DA2FF] to-purple-500'
                      }`}
                      style={{ width: `${(quest.progress / quest.total) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Claim Button */}
                {quest.completed && !quest.claimed && (
                  <button className="mt-3 w-full py-2 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors">
                    Claim Reward
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Friends CTA */}
      <div className="bg-[#1A1F26] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#4DA2FF]/20 flex items-center justify-center text-2xl">
            🎁
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Invite Friends</h3>
            <p className="text-gray-400 text-sm">Earn 100 LUCK for each friend!</p>
          </div>
          <button className="px-4 py-2 bg-[#4DA2FF] text-white font-semibold rounded-xl text-sm">
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}
