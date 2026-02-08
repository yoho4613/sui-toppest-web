'use client';

import { useGameStore } from '../hooks/useGameStore';

export function GameHUD() {
  const distance = useGameStore((state) => state.distance);
  const elapsedTime = useGameStore((state) => state.elapsedTime);
  const energy = useGameStore((state) => state.energy);
  const maxEnergy = useGameStore((state) => state.maxEnergy);
  const perfectCount = useGameStore((state) => state.perfectCount);
  const coinCount = useGameStore((state) => state.coinCount);
  const isFeverMode = useGameStore((state) => state.isFeverMode);
  const consecutiveCoins = useGameStore((state) => state.consecutiveCoins);
  const difficulty = useGameStore((state) => state.difficulty);
  const speed = useGameStore((state) => state.speed);

  // Format time as MM:SS.ms
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const energyPercent = (energy / maxEnergy) * 100;

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

  // Energy bar color based on level
  const getEnergyColor = () => {
    if (isFeverMode) return 'from-purple-500 via-pink-500 to-purple-500';
    if (energyPercent > 60) return 'from-green-400 to-cyan-400';
    if (energyPercent > 30) return 'from-yellow-400 to-orange-400';
    return 'from-red-500 to-red-400';
  };

  const getEnergyTextColor = () => {
    if (isFeverMode) return 'text-purple-400';
    if (energyPercent > 60) return 'text-green-400';
    if (energyPercent > 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="absolute inset-x-0 top-0 p-2 sm:p-4 pointer-events-none">
      {/* Top bar - compact for mobile */}
      <div className="flex justify-between items-start gap-2 mb-2">
        {/* Distance & Time - compact */}
        <div className="bg-black/70 rounded-lg px-2 sm:px-3 py-1.5 backdrop-blur-sm">
          <p className="text-cyan-400 text-[10px] sm:text-xs leading-tight">DISTANCE</p>
          <p className="text-white text-lg sm:text-xl font-mono font-bold leading-tight">
            {Math.floor(distance)}m
          </p>
          <p className="text-gray-400 text-[10px] sm:text-xs">{formatTime(elapsedTime)}</p>
        </div>

        {/* Energy gauge - moved to top center for mobile */}
        <div className="flex-1 max-w-[140px] sm:max-w-[180px] bg-black/70 rounded-lg px-2 py-1.5 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-0.5">
            <span className={`text-[10px] sm:text-xs font-bold ${getEnergyTextColor()}`}>
              {isFeverMode ? 'FEVER!' : 'ENERGY'}
            </span>
            <div className="flex items-center gap-1">
              {/* Consecutive coins indicator - smaller */}
              {consecutiveCoins > 0 && !isFeverMode && (
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i < consecutiveCoins ? 'bg-yellow-400' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              )}
              <span className="text-white text-[10px] sm:text-xs">{Math.floor(energy)}%</span>
            </div>
          </div>
          <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 bg-gradient-to-r ${getEnergyColor()} ${
                isFeverMode || energyPercent <= 30 ? 'animate-pulse' : ''
              }`}
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>

        {/* Stats - compact */}
        <div className="flex gap-1 sm:gap-2">
          {/* Difficulty badge - smaller */}
          <div className={`rounded-lg px-2 py-1.5 backdrop-blur-sm ${getDifficultyColor()}`}>
            <p className="text-[10px] sm:text-xs font-bold uppercase leading-tight">
              {difficulty.slice(0, 4)}
            </p>
          </div>

          {/* Coins - smaller */}
          <div className="bg-black/70 rounded-lg px-2 py-1.5 backdrop-blur-sm">
            <p className="text-yellow-400 text-[10px] leading-tight">🪙</p>
            <p className="text-white text-sm sm:text-base font-bold text-center leading-tight">{coinCount}</p>
          </div>
        </div>
      </div>

      {/* Speed indicator - thinner */}
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="flex-1 bg-black/40 rounded-full h-1 backdrop-blur-sm overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isFeverMode ? 'bg-purple-500' : 'bg-cyan-400'
            }`}
            style={{ width: `${Math.min(100, (speed / 30) * 100)}%` }}
          />
        </div>
        <span className="text-[10px] sm:text-xs text-gray-400 min-w-[45px] text-right">{speed.toFixed(0)} km/h</span>
      </div>

      {/* Low energy warning - floating at bottom but above touch zone */}
      {energyPercent <= 30 && !isFeverMode && (
        <div className="absolute bottom-32 sm:bottom-24 left-1/2 -translate-x-1/2">
          <p className="text-red-400 text-xs sm:text-sm font-bold bg-black/70 px-3 py-1 rounded-full animate-pulse">
            ⚠️ Low Energy!
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
