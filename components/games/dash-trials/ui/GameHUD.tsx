'use client';

import { useGameStore } from '../hooks/useGameStore';

export function GameHUD() {
  const distance = useGameStore((state) => state.distance);
  const elapsedTime = useGameStore((state) => state.elapsedTime);
  const health = useGameStore((state) => state.health);
  const maxHealth = useGameStore((state) => state.maxHealth);
  const coinCount = useGameStore((state) => state.coinCount);
  const isFeverMode = useGameStore((state) => state.isFeverMode);
  const consecutiveCoins = useGameStore((state) => state.consecutiveCoins);
  const difficulty = useGameStore((state) => state.difficulty);
  const speed = useGameStore((state) => state.speed);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const healthPercent = (health / maxHealth) * 100;

  // Difficulty color
  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'tutorial': return 'text-green-400 bg-green-400/20';
      case 'easy': return 'text-cyan-400 bg-cyan-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/20';
      case 'hard': return 'text-orange-400 bg-orange-400/20';
      case 'extreme': return 'text-red-400 bg-red-400/20';
      default: return 'text-white bg-white/20';
    }
  };

  // Health bar color based on level (matching Neon Dash style)
  const getHealthBarStyle = () => {
    if (isFeverMode) return 'linear-gradient(to right, #a855f7, #ec4899)';
    if (healthPercent > 50) return 'linear-gradient(to right, #22c55e, #4ade80)';
    if (healthPercent > 25) return 'linear-gradient(to right, #eab308, #fbbf24)';
    return 'linear-gradient(to right, #dc2626, #ef4444)';
  };

  const getHealthTextColor = () => {
    if (isFeverMode) return 'text-purple-400';
    if (healthPercent > 50) return 'text-green-400';
    if (healthPercent > 25) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBorderColor = () => {
    if (isFeverMode) return 'border-purple-500/60';
    if (healthPercent > 50) return 'border-gray-600/50';
    if (healthPercent > 25) return 'border-yellow-500/60';
    return 'border-red-500/80';
  };

  return (
    <div className="absolute inset-x-0 top-0 p-2 sm:p-4 pointer-events-none">
      {/* Health Bar - Full width at top (matching Neon Dash) */}
      <div className="relative mb-2">
        {/* Health bar glow effect for low health */}
        <div
          className={`absolute inset-0 rounded-full blur-md transition-opacity ${
            healthPercent <= 25 && !isFeverMode ? 'opacity-60' : healthPercent <= 50 && !isFeverMode ? 'opacity-30' : 'opacity-0'
          }`}
          style={{
            background: healthPercent <= 25 ? '#ef4444' : '#eab308',
          }}
        />

        {/* Health bar container */}
        <div
          className={`relative w-full h-4 bg-gray-900/80 rounded-full overflow-hidden border-2 ${getHealthBorderColor()} ${
            healthPercent <= 25 && !isFeverMode ? 'animate-pulse' : ''
          }`}
        >
          {/* Health bar fill */}
          <div
            className="h-full transition-all duration-150 relative"
            style={{
              width: `${healthPercent}%`,
              background: getHealthBarStyle(),
            }}
          >
            {/* Highlight effect */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
              }}
            />
            {/* Drain effect - right edge glow */}
            <div
              className="absolute right-0 top-0 bottom-0 w-3"
              style={{
                background: healthPercent > 50
                  ? 'linear-gradient(to right, transparent, rgba(255,255,255,0.3))'
                  : healthPercent > 25
                    ? 'linear-gradient(to right, transparent, rgba(255,200,0,0.5))'
                    : 'linear-gradient(to right, transparent, rgba(255,100,100,0.6))',
              }}
            />
          </div>

          {/* Health percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`text-[10px] font-bold drop-shadow-lg ${
                healthPercent <= 25 && !isFeverMode ? 'text-red-100' : healthPercent <= 50 && !isFeverMode ? 'text-yellow-100' : 'text-white/90'
              }`}
            >
              {Math.ceil(health)}%
            </span>
          </div>
        </div>

        {/* Danger warning icon (health <= 25%) */}
        {healthPercent <= 25 && !isFeverMode && (
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 animate-pulse">
            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          </div>
        )}
      </div>

      {/* Distance display - large centered text (matching Neon Dash) */}
      <div className="text-center mb-2">
        <p className="text-white text-3xl sm:text-4xl font-bold drop-shadow-lg">
          {Math.floor(distance)}m
        </p>
        <p className="text-gray-400 text-xs">{formatTime(elapsedTime)}</p>
      </div>

      {/* Bottom stats bar */}
      <div className="flex justify-between items-center gap-2">
        {/* Difficulty badge */}
        <div className={`rounded-lg px-2 py-1 backdrop-blur-sm ${getDifficultyColor()}`}>
          <p className="text-[10px] sm:text-xs font-bold uppercase leading-tight">
            {difficulty}
          </p>
        </div>

        {/* Fever/Coins indicator */}
        <div className="flex items-center gap-2">
          {/* Consecutive coins indicator (fever progress) */}
          {consecutiveCoins > 0 && !isFeverMode && (
            <div className="flex gap-0.5 bg-black/50 px-2 py-1 rounded-full">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i < consecutiveCoins ? 'bg-yellow-400 scale-110' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Fever indicator */}
          {isFeverMode && (
            <div className="bg-purple-500/30 border border-purple-500/50 px-2 py-1 rounded-full animate-pulse">
              <span className="text-purple-300 text-xs font-bold">FEVER!</span>
            </div>
          )}

          {/* Coins counter */}
          <div className="bg-black/50 rounded-lg px-2 py-1 flex items-center gap-1">
            <span className="text-yellow-400 text-sm">🪙</span>
            <span className="text-white text-sm font-bold">{coinCount}</span>
          </div>
        </div>

        {/* Speed indicator */}
        <div className="bg-black/50 rounded-lg px-2 py-1">
          <span className="text-cyan-400 text-xs font-mono">{speed.toFixed(0)} km/h</span>
        </div>
      </div>

      {/* Low health warning - floating */}
      {healthPercent <= 30 && !isFeverMode && (
        <div className="absolute bottom-32 sm:bottom-24 left-1/2 -translate-x-1/2">
          <p className="text-red-400 text-xs sm:text-sm font-bold bg-black/70 px-3 py-1 rounded-full animate-pulse">
            ⚠️ Low Health! Find Potions!
          </p>
        </div>
      )}

      {/* Fever overlay */}
      {isFeverMode && (
        <div className="absolute inset-0 pointer-events-none border-2 sm:border-4 border-purple-500/50 animate-pulse" />
      )}
    </div>
  );
}
