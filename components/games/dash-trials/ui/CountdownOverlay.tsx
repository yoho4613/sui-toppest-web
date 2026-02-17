'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '../hooks/useGameStore';
import { calculateClubRewards, formatReward as formatClubReward, type RewardResult } from '@/lib/rewards/club-rewards';
import { useGameAPI } from '@/hooks/useGameAPI';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { useAppStore } from '@/stores/useAppStore';
import { useQuestStore } from '@/hooks/useQuestStore';

const GAME_TYPE = 'dash-trials';

export function CountdownOverlay() {
  const status = useGameStore((state) => state.status);
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (status !== 'countdown') {
      setCount(3);
      return;
    }

    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  if (status !== 'countdown') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
      <div className="text-center">
        <div
          className={`text-9xl font-bold transition-all duration-300 ${
            count === 0
              ? 'text-green-400 scale-150'
              : 'text-white scale-100'
          }`}
        >
          {count === 0 ? 'GO!' : count}
        </div>
        <p className="text-gray-400 mt-4 text-lg">Get Ready...</p>
      </div>
    </div>
  );
}

export function MenuOverlay() {
  const router = useRouter();
  const status = useGameStore((state) => state.status);
  const highScore = useGameStore((state) => state.highScore);

  const { address: walletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const address = walletAddress || zkAddress;

  const { checkTickets, useTicket, startGameSession, isLoadingTickets, isLoadingSession } = useGameAPI();
  const [ticketStatus, setTicketStatus] = useState<{
    canPlay: boolean;
    dailyTickets: number;
    maxDailyTickets: number;
    starTickets: number;
    totalTickets: number;
  } | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Check tickets on mount and when returning to menu
  useEffect(() => {
    if (status === 'menu' && address) {
      setIsInitialLoading(true);
      setTicketError(null);
      checkTickets(address, GAME_TYPE).then((result) => {
        if (result) {
          setTicketStatus({
            canPlay: result.canPlay,
            dailyTickets: result.dailyTickets,
            maxDailyTickets: result.maxDailyTickets,
            starTickets: result.starTickets,
            totalTickets: result.totalTickets,
          });
        }
        setIsInitialLoading(false);
      });
    } else if (status === 'menu' && !address) {
      setIsInitialLoading(false);
    }
  }, [status, address, checkTickets]);

  if (status !== 'menu') return null;

  const handleStartGame = async () => {
    if (!address) {
      setTicketError('Please connect your wallet first');
      return;
    }

    // Use a ticket
    const ticketResult = await useTicket(address, GAME_TYPE);

    if (!ticketResult || !ticketResult.success) {
      setTicketError('No tickets remaining. Get more Star Tickets!');
      setTicketStatus((prev) => prev ? { ...prev, canPlay: false, totalTickets: 0 } : null);
      return;
    }

    // Update ticket status
    setTicketStatus((prev) => prev ? {
      ...prev,
      dailyTickets: ticketResult.dailyTickets,
      starTickets: ticketResult.starTickets,
      totalTickets: ticketResult.totalTickets,
      canPlay: ticketResult.totalTickets > 0,
    } : null);

    // Start game session (for anti-cheat validation)
    const sessionResult = await startGameSession(address, GAME_TYPE);
    if (!sessionResult) {
      console.error('Failed to start game session');
      // Still allow game to start (graceful degradation)
    }

    // Start the game
    useGameStore.getState().startGame();
  };

  const canPlay = !isInitialLoading && ticketStatus?.canPlay !== false;
  const isButtonLoading = (isLoadingTickets || isLoadingSession) && !isInitialLoading;

  return (
    <div className="absolute inset-0 flex items-start justify-center bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="text-center p-6 pb-28 max-w-md w-full my-4">
        <h1 className="text-3xl font-bold text-white mb-2">DASH TRIALS</h1>
        <p className="text-gray-400 mb-4">Endless runner - how far can you go?</p>

        {/* Ticket Status - Daily + Star */}
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-4 mb-4">
          {isInitialLoading ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400 text-sm">Loading tickets...</span>
            </div>
          ) : ticketStatus ? (
            <>
              {/* Daily Tickets */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎟️</span>
                  <span className="text-gray-400 text-sm">Daily Tickets</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-bold text-lg">
                    {ticketStatus.dailyTickets}
                  </span>
                  <span className="text-gray-400 text-sm"> / {ticketStatus.maxDailyTickets}</span>
                </div>
              </div>
              {/* Star Tickets */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⭐</span>
                  <span className="text-yellow-400 text-sm">Star Tickets</span>
                </div>
                <div className="text-right">
                  <span className="text-yellow-400 font-bold text-lg">
                    {ticketStatus.starTickets}
                  </span>
                </div>
              </div>
              {/* Total */}
              <div className="flex items-center justify-center mt-3 pt-2 border-t border-white/10">
                <span className="text-gray-400 text-sm">Total: </span>
                <span className="text-white font-bold text-lg ml-1">{ticketStatus.totalTickets}</span>
                <span className="text-gray-400 text-sm ml-1">plays available</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎟️</span>
                <span className="text-gray-400 text-sm">Daily Tickets</span>
              </div>
              <span className="text-gray-400 text-sm">3 / 3</span>
            </div>
          )}
          {ticketStatus?.totalTickets === 0 && (
            <p className="text-red-400 text-xs mt-2 text-center">No tickets! Get Star Tickets or wait for daily reset.</p>
          )}
        </div>

        {/* High Score */}
        {highScore > 0 && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-4 mb-6">
            <p className="text-yellow-400 text-sm font-bold">BEST DISTANCE</p>
            <p className="text-white text-3xl font-bold">{highScore}m</p>
          </div>
        )}

        {/* Controls info */}
        <div className="bg-white/5 rounded-xl p-4 mb-6 text-sm text-gray-400">
          <p className="font-bold text-white mb-3">Controls</p>

          {/* Mobile Touch Controls */}
          <div className="mb-3">
            <p className="text-cyan-400 text-xs font-semibold mb-2">📱 Touch</p>
            {/* Tap zones */}
            <div className="flex items-center justify-center gap-1 mb-2">
              <div className="flex-1 bg-green-500/20 border border-green-500/30 rounded-lg py-2 text-center text-green-400 text-xs">
                ← Left
              </div>
              <div className="flex-1 bg-cyan-500/20 border border-cyan-500/30 rounded-lg py-2 text-center text-cyan-400 text-xs">
                ↑ Jump
              </div>
              <div className="flex-1 bg-green-500/20 border border-green-500/30 rounded-lg py-2 text-center text-green-400 text-xs">
                Right →
              </div>
            </div>
            {/* Slide methods */}
            <div className="mt-2 space-y-1.5">
              <p className="text-blue-400 text-xs font-semibold">Slide (Duck)</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-1">
                  <span className="text-purple-400 text-sm">✌️</span>
                  <span className="text-gray-400 text-xs">2-Finger</span>
                </div>
                <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1">
                  <span className="text-blue-400 text-sm">↓</span>
                  <span className="text-gray-400 text-xs">Swipe Down</span>
                </div>
                <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1">
                  <span className="text-orange-400 text-sm">👆</span>
                  <span className="text-gray-400 text-xs">Long Press</span>
                </div>
              </div>
              <p className="text-gray-500 text-xs text-center">Hold to maintain slide</p>
            </div>
            {/* Jump */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-1.5">
                <span className="text-cyan-400 text-sm">↑</span>
                <span className="text-gray-400 text-xs">Swipe Up / Middle Tap = Jump</span>
              </div>
            </div>
          </div>

          {/* Keyboard Controls */}
          <div className="pt-2 border-t border-white/10">
            <p className="text-cyan-400 text-xs font-semibold mb-2">⌨️ Keyboard</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-left">
              <div>↑ / W / Space: Jump</div>
              <div>↓ / S: Slide</div>
              <div>← / A: Move Left</div>
              <div>→ / D: Move Right</div>
            </div>
          </div>

          <p className="text-yellow-400 mt-3 text-xs">Collect potions to restore energy!</p>
        </div>

        {/* Error Message */}
        {ticketError && (
          <p className="text-red-400 text-sm mb-4">{ticketError}</p>
        )}

        {/* Start button */}
        <button
          onClick={() => {
            if (canPlay) {
              handleStartGame();
            } else if (!isInitialLoading) {
              // No tickets - redirect to shop
              router.push('/play/shop');
            }
          }}
          disabled={isButtonLoading || isInitialLoading}
          className={`w-full py-4 px-8 rounded-xl text-white font-bold text-xl transition-transform ${
            isButtonLoading || isInitialLoading
              ? 'bg-gray-600 cursor-not-allowed'
              : canPlay
                ? 'bg-gradient-to-r from-green-500 to-cyan-500 hover:scale-105'
                : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:scale-105'
          }`}
        >
          {isInitialLoading ? 'Loading...' : isButtonLoading ? 'Starting...' : canPlay ? 'START GAME' : 'GET TICKETS →'}
        </button>
      </div>
    </div>
  );
}

// Game stats type for snapshot
interface GameStats {
  distance: number;
  elapsedTime: number;
  perfectCount: number;
  coinCount: number;
  potionCount: number;
  feverCount: number;
  highScore: number;
  difficulty: string;
  clubRewards: RewardResult;
}

export function ResultOverlay() {
  const router = useRouter();
  // Only subscribe to status - no other subscriptions during gameplay
  const status = useGameStore((state) => state.status);

  const { address: walletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const address = walletAddress || zkAddress;

  const { saveGameRecord, checkTickets, useTicket, startGameSession, isLoading } = useGameAPI();
  const { refreshLeaderboard, addClubReward } = useAppStore();
  const refreshQuestsAfterGame = useQuestStore((state) => state.refreshAfterGame);

  // Snapshot of game stats - only captured when gameover starts
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [clubEarned, setClubEarned] = useState(0);
  const [ticketStatus, setTicketStatus] = useState<{
    dailyTickets: number;
    maxDailyTickets: number;
    starTickets: number;
    totalTickets: number;
  } | null>(null);
  const hasSavedRef = useRef(false);

  // Capture game stats snapshot when gameover starts (no subscriptions needed)
  useEffect(() => {
    if (status === 'gameover' && !gameStats) {
      // Snapshot all values at once using getState()
      const state = useGameStore.getState();
      const rewards = calculateClubRewards(GAME_TYPE, Math.floor(state.distance), {
        feverCount: state.feverCount,
        perfectCount: state.perfectCount,
        coinCount: state.coinCount,
        potionCount: state.potionCount,
        difficulty: state.difficulty,
      });

      setGameStats({
        distance: state.distance,
        elapsedTime: state.elapsedTime,
        perfectCount: state.perfectCount,
        coinCount: state.coinCount,
        potionCount: state.potionCount,
        feverCount: state.feverCount,
        highScore: state.highScore,
        difficulty: state.difficulty,
        clubRewards: rewards,
      });
    }

    // Reset when returning to menu
    if (status === 'menu') {
      setGameStats(null);
      hasSavedRef.current = false;
      setIsSaved(false);
    }
  }, [status, gameStats]);

  // Save game record when gameover and stats are captured
  useEffect(() => {
    if (status === 'gameover' && address && gameStats && !hasSavedRef.current) {
      hasSavedRef.current = true;

      const finalDistance = Math.floor(gameStats.distance);

      // Save game record with all stats for reward calculation
      // Note: elapsedTime is in seconds, convert to milliseconds for time_ms
      saveGameRecord({
        wallet_address: address,
        game_type: GAME_TYPE,
        score: finalDistance,
        distance: finalDistance,
        time_ms: Math.floor(gameStats.elapsedTime * 1000),
        fever_count: gameStats.feverCount,
        perfect_count: gameStats.perfectCount,
        coin_count: gameStats.coinCount,
        potion_count: gameStats.potionCount,
        difficulty: gameStats.difficulty,
      }).then((result) => {
        if (result?.success) {
          setIsSaved(true);
          const earnedClub = result.rewards?.club || 0;
          setClubEarned(earnedClub);

          if (earnedClub > 0) {
            addClubReward(earnedClub);
          }

          refreshLeaderboard(GAME_TYPE, 'weekly', address);
          refreshQuestsAfterGame(address);
        }
      });

      // Check remaining tickets
      checkTickets(address, GAME_TYPE).then((result) => {
        if (result) {
          setTicketStatus({
            dailyTickets: result.dailyTickets,
            maxDailyTickets: result.maxDailyTickets,
            starTickets: result.starTickets,
            totalTickets: result.totalTickets,
          });
        }
      });
    }
  }, [status, address, gameStats, saveGameRecord, checkTickets, refreshLeaderboard, addClubReward, refreshQuestsAfterGame]);

  // Don't render during gameplay - avoids any subscription overhead
  if (status !== 'gameover' || !gameStats) return null;

  const finalDistance = Math.floor(gameStats.distance);
  const { clubRewards } = gameStats;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const isNewRecord = finalDistance >= gameStats.highScore && finalDistance > 0;

  const getDifficultyColor = () => {
    switch (gameStats.difficulty) {
      case 'tutorial': return 'text-green-400';
      case 'easy': return 'text-cyan-400';
      case 'medium': return 'text-yellow-400';
      case 'hard': return 'text-orange-400';
      case 'extreme': return 'text-red-400';
      default: return 'text-white';
    }
  };

  const handleReset = () => {
    useGameStore.getState().reset();
  };

  const handleRetry = async () => {
    if (!address) return;

    if (ticketStatus && ticketStatus.totalTickets <= 0) {
      return;
    }

    const ticketResult = await useTicket(address, GAME_TYPE);

    if (!ticketResult || !ticketResult.success) {
      setTicketStatus((prev) => prev ? { ...prev, totalTickets: 0 } : null);
      return;
    }

    setTicketStatus((prev) => prev ? {
      ...prev,
      dailyTickets: ticketResult.dailyTickets,
      starTickets: ticketResult.starTickets,
      totalTickets: ticketResult.totalTickets,
    } : null);

    const sessionResult = await startGameSession(address, GAME_TYPE);
    if (!sessionResult) {
      console.error('Failed to start game session');
    }

    useGameStore.getState().startGame();
  };

  const canRetry = ticketStatus ? ticketStatus.totalTickets > 0 : true;

  return (
    <div className="absolute inset-0 flex items-start justify-center bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="text-center p-6 pb-28 max-w-md w-full my-4">
        <h1 className="text-3xl font-bold text-red-400 mb-2">GAME OVER</h1>
        {isNewRecord ? (
          <p className="text-yellow-400 mb-4 text-lg font-bold">NEW RECORD!</p>
        ) : (
          <p className="text-gray-400 mb-4">Energy depleted!</p>
        )}

        {/* Distance */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-green-500/20 border border-cyan-500/30 rounded-xl p-4 mb-4">
          <p className="text-gray-400 text-sm">DISTANCE</p>
          <p className="text-white text-4xl font-bold">{finalDistance}m</p>
          <p className={`text-sm ${getDifficultyColor()}`}>
            Reached: {gameStats.difficulty.charAt(0).toUpperCase() + gameStats.difficulty.slice(1)} Zone
          </p>
        </div>

        {/* $CLUB Rewards - Main Focus */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">🏆</span>
            <span className="text-purple-400 font-bold text-lg">$CLUB Earned</span>
          </div>
          <p className="text-white text-4xl font-bold mb-3">
            +{isSaved ? formatClubReward(clubEarned) : formatClubReward(clubRewards.totalReward)}
          </p>

          {/* Reward Breakdown */}
          <div className="text-left bg-black/30 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">{finalDistance}m × 0.01</span>
              <span className="text-cyan-400">+{clubRewards.baseReward}</span>
            </div>
            {clubRewards.feverBonus > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Fever ({gameStats.feverCount}x)</span>
                <span className="text-pink-400">+{clubRewards.feverBonus}</span>
              </div>
            )}
            {clubRewards.perfectBonus > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Perfect ({gameStats.perfectCount})</span>
                <span className="text-purple-400">+{clubRewards.perfectBonus}</span>
              </div>
            )}
            {clubRewards.coinBonus > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Coins ({gameStats.coinCount})</span>
                <span className="text-yellow-400">+{clubRewards.coinBonus}</span>
              </div>
            )}
            {clubRewards.difficultyMultiplier !== 1 && (
              <div className="flex justify-between pt-1 border-t border-white/10">
                <span className="text-gray-400">Difficulty</span>
                <span className="text-white">×{clubRewards.difficultyMultiplier}</span>
              </div>
            )}
          </div>

          {isSaved && (
            <p className="text-green-400 text-xs mt-3">✓ Rewards saved</p>
          )}
        </div>

        {/* Game Stats */}
        <div className="bg-white/5 rounded-xl p-4 mb-4 text-left">
          <p className="text-white font-bold mb-3">Game Stats</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Time</span>
              <span className="text-white font-mono">{formatTime(gameStats.elapsedTime * 1000)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Coins Collected</span>
              <span className="text-yellow-400">{gameStats.coinCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Potions Used</span>
              <span className="text-green-400">{gameStats.potionCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fever Activations</span>
              <span className="text-pink-400">{gameStats.feverCount}</span>
            </div>
            {gameStats.highScore > 0 && (
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-gray-400">Best Distance</span>
                <span className="text-yellow-400">{gameStats.highScore}m</span>
              </div>
            )}
          </div>
        </div>

        {/* Remaining Tickets */}
        {ticketStatus && (
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <span>🎟️</span>
                <span className="text-gray-400">Daily:</span>
                <span className="text-white font-bold">{ticketStatus.dailyTickets}/{ticketStatus.maxDailyTickets}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>⭐</span>
                <span className="text-yellow-400">Star:</span>
                <span className="text-yellow-400 font-bold">{ticketStatus.starTickets}</span>
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 py-3 px-6 bg-white/10 rounded-xl text-white font-bold hover:bg-white/20 transition-colors"
          >
            MENU
          </button>
          <button
            onClick={() => {
              if (canRetry) {
                handleRetry();
              } else {
                router.push('/play/shop');
              }
            }}
            disabled={isLoading}
            className={`flex-1 py-3 px-6 rounded-xl text-white font-bold transition-transform ${
              isLoading
                ? 'bg-gray-600 cursor-not-allowed'
                : canRetry
                  ? 'bg-gradient-to-r from-green-500 to-cyan-500 hover:scale-105'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:scale-105'
            }`}
          >
            {isLoading ? '...' : canRetry ? 'RETRY' : 'GET TICKETS →'}
          </button>
        </div>
      </div>
    </div>
  );
}
