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
    <div className="absolute inset-x-0 top-0 p-4 pointer-events-none">
      {/* Top bar */}
      <div className="flex justify-between items-start mb-3">
        {/* Distance & Time */}
        <div className="bg-black/60 rounded-lg px-4 py-2 backdrop-blur-sm">
          <p className="text-cyan-400 text-xs">DISTANCE</p>
          <p className="text-white text-2xl font-mono font-bold">
            {Math.floor(distance)}m
          </p>
          <p className="text-gray-400 text-xs">{formatTime(elapsedTime)}</p>
        </div>

        {/* Stats */}
        <div className="flex gap-2">
          {/* Difficulty badge */}
          <div className={`rounded-lg px-3 py-2 backdrop-blur-sm ${getDifficultyColor()}`}>
            <p className="text-xs font-bold uppercase">
              {difficulty}
            </p>
          </div>

          {/* Coins */}
          <div className="bg-black/60 rounded-lg px-3 py-2 backdrop-blur-sm">
            <p className="text-yellow-400 text-xs">COINS</p>
            <p className="text-white text-xl font-bold text-center">{coinCount}</p>
          </div>
        </div>
      </div>

      {/* Speed indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 bg-black/40 rounded-full h-1 backdrop-blur-sm overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isFeverMode ? 'bg-purple-500' : 'bg-cyan-400'
            }`}
            style={{ width: `${Math.min(100, (speed / 30) * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-400">{speed.toFixed(0)} km/h</span>
      </div>

      {/* Energy gauge */}
      <div className="absolute bottom-20 left-4 right-4">
        <div className="bg-black/60 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-1">
            <span className={`text-sm font-bold ${getEnergyTextColor()}`}>
              {isFeverMode ? 'FEVER MODE!' : 'ENERGY'}
            </span>
            <div className="flex items-center gap-2">
              {/* Consecutive coins indicator */}
              {consecutiveCoins > 0 && !isFeverMode && (
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < consecutiveCoins ? 'bg-yellow-400' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              )}
              <span className="text-white text-sm">{Math.floor(energy)}%</span>
            </div>
          </div>
          <div className="bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 bg-gradient-to-r ${getEnergyColor()} ${
                isFeverMode || energyPercent <= 30 ? 'animate-pulse' : ''
              }`}
              style={{ width: `${energyPercent}%` }}
            />
          </div>
          {energyPercent <= 30 && !isFeverMode && (
            <p className="text-red-400 text-xs mt-1 text-center animate-pulse">
              Low Energy! Collect coins!
            </p>
          )}
        </div>
      </div>

      {/* Fever overlay */}
      {isFeverMode && (
        <div className="absolute inset-0 pointer-events-none border-4 border-purple-500/50 animate-pulse" />
      )}
    </div>
  );
}
