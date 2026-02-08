'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { useGameAPI } from '@/hooks/useGameAPI';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';

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
  const status = useGameStore((state) => state.status);
  const highScore = useGameStore((state) => state.highScore);

  const { address: walletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const address = walletAddress || zkAddress;

  const { checkTickets, useTicket, isLoadingTickets } = useGameAPI();
  const [ticketStatus, setTicketStatus] = useState<{
    canPlay: boolean;
    remainingTickets: number;
    maxTickets: number;
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
          setTicketStatus(result);
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
    const result = await useTicket(address, GAME_TYPE);

    if (!result || !result.success) {
      setTicketError('No tickets remaining for today. Come back tomorrow!');
      setTicketStatus((prev) => prev ? { ...prev, canPlay: false, remainingTickets: 0 } : null);
      return;
    }

    // Update ticket status
    setTicketStatus((prev) => prev ? {
      ...prev,
      remainingTickets: result.remainingTickets,
      canPlay: result.remainingTickets > 0,
    } : null);

    // Start the game
    useGameStore.getState().startGame();
  };

  const canPlay = !isInitialLoading && ticketStatus?.canPlay !== false;
  const isButtonLoading = isLoadingTickets && !isInitialLoading;

  return (
    <div className="absolute inset-0 flex items-start justify-center bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="text-center p-6 pb-28 max-w-md w-full my-4">
        <h1 className="text-3xl font-bold text-white mb-2">DASH TRIALS</h1>
        <p className="text-gray-400 mb-4">Endless runner - how far can you go?</p>

        {/* Ticket Status */}
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎟️</span>
              <span className="text-gray-400 text-sm">Daily Tickets</span>
            </div>
            <div className="text-right">
              {isInitialLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-400 text-sm">Loading...</span>
                </div>
              ) : ticketStatus ? (
                <>
                  <span className="text-white font-bold text-xl">
                    {ticketStatus.remainingTickets}
                  </span>
                  <span className="text-gray-400 text-sm"> / {ticketStatus.maxTickets}</span>
                </>
              ) : (
                <span className="text-gray-400 text-sm">3 / 3</span>
              )}
            </div>
          </div>
          {ticketStatus?.remainingTickets === 0 && (
            <p className="text-red-400 text-xs mt-2">Come back tomorrow for more plays!</p>
          )}
        </div>

        {/* High Score */}
        {highScore > 0 && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-4 mb-6">
            <p className="text-yellow-400 text-sm font-bold">BEST DISTANCE</p>
            <p className="text-white text-3xl font-bold">{highScore}m</p>
          </div>
        )}

        {/* Difficulty Info */}
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <p className="font-bold text-white mb-3">Difficulty Zones</p>
          <div className="space-y-2 text-sm text-left">
            <div className="flex justify-between items-center">
              <span className="text-green-400">Tutorial</span>
              <span className="text-gray-400">0 - 200m</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cyan-400">Easy</span>
              <span className="text-gray-400">200 - 500m</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-yellow-400">Medium</span>
              <span className="text-gray-400">500 - 1000m</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-orange-400">Hard</span>
              <span className="text-gray-400">1000 - 2000m</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-red-400">Extreme</span>
              <span className="text-gray-400">2000m+</span>
            </div>
          </div>
        </div>

        {/* Controls info */}
        <div className="bg-white/5 rounded-xl p-4 mb-6 text-sm text-gray-400">
          <p className="font-bold text-white mb-3">Controls</p>

          {/* Mobile Touch Controls */}
          <div className="mb-3">
            <p className="text-cyan-400 text-xs font-semibold mb-2">📱 Touch</p>
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
            <p className="text-gray-500 text-xs text-center">Swipe ↑ Jump · Swipe ↓ Slide</p>
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
          onClick={handleStartGame}
          disabled={!canPlay || isButtonLoading || isInitialLoading}
          className={`w-full py-4 px-8 rounded-xl text-white font-bold text-xl transition-transform ${
            canPlay && !isButtonLoading && !isInitialLoading
              ? 'bg-gradient-to-r from-green-500 to-cyan-500 hover:scale-105'
              : 'bg-gray-600 cursor-not-allowed'
          }`}
        >
          {isInitialLoading ? 'Loading...' : isButtonLoading ? 'Starting...' : canPlay ? 'START GAME' : 'NO TICKETS'}
        </button>
      </div>
    </div>
  );
}

export function ResultOverlay() {
  const status = useGameStore((state) => state.status);
  const distance = useGameStore((state) => state.distance);
  const elapsedTime = useGameStore((state) => state.elapsedTime);
  const perfectCount = useGameStore((state) => state.perfectCount);
  const coinCount = useGameStore((state) => state.coinCount);
  const feverCount = useGameStore((state) => state.feverCount);
  const highScore = useGameStore((state) => state.highScore);
  const difficulty = useGameStore((state) => state.difficulty);

  const { address: walletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const address = walletAddress || zkAddress;

  const { saveGameRecord, checkTickets, useTicket, isLoading } = useGameAPI();
  const [isSaved, setIsSaved] = useState(false);
  const [luckEarned, setLuckEarned] = useState(0);
  const [ticketStatus, setTicketStatus] = useState<{
    remainingTickets: number;
    maxTickets: number;
  } | null>(null);
  const hasSavedRef = useRef(false);

  // Calculate score
  const finalDistance = Math.floor(distance);
  const distanceScore = finalDistance * 10;
  const perfectBonus = perfectCount * 50;
  const coinBonus = coinCount * 20;
  const feverBonus = feverCount * 200;
  const totalScore = distanceScore + perfectBonus + coinBonus + feverBonus;

  // Save game record when game is over
  useEffect(() => {
    if (status === 'gameover' && address && !hasSavedRef.current) {
      hasSavedRef.current = true;

      // Save game record
      saveGameRecord({
        wallet_address: address,
        game_type: GAME_TYPE,
        score: totalScore,
        distance: finalDistance,
        time_ms: Math.floor(elapsedTime),
      }).then((result) => {
        if (result?.success) {
          setIsSaved(true);
          setLuckEarned(result.rewards?.luck || 0);
        }
      });

      // Check remaining tickets
      checkTickets(address, GAME_TYPE).then((result) => {
        if (result) {
          setTicketStatus({
            remainingTickets: result.remainingTickets,
            maxTickets: result.maxTickets,
          });
        }
      });
    }

    // Reset saved flag when returning to menu
    if (status === 'menu') {
      hasSavedRef.current = false;
      setIsSaved(false);
    }
  }, [status, address, totalScore, finalDistance, elapsedTime, saveGameRecord, checkTickets]);

  if (status !== 'gameover') return null;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const isNewRecord = finalDistance >= highScore && finalDistance > 0;

  const getDifficultyColor = () => {
    switch (difficulty) {
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

    // Check if user has tickets
    if (ticketStatus && ticketStatus.remainingTickets <= 0) {
      return;
    }

    // Use a ticket
    const result = await useTicket(address, GAME_TYPE);

    if (!result || !result.success) {
      setTicketStatus((prev) => prev ? { ...prev, remainingTickets: 0 } : null);
      return;
    }

    // Update ticket status
    setTicketStatus((prev) => prev ? {
      ...prev,
      remainingTickets: result.remainingTickets,
    } : null);

    // Start the game
    useGameStore.getState().startGame();
  };

  const canRetry = ticketStatus ? ticketStatus.remainingTickets > 0 : true;

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
            Reached: {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Zone
          </p>
        </div>

        {/* Stats */}
        <div className="bg-white/5 rounded-xl p-4 mb-4 text-left">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Time</span>
              <span className="text-white font-mono font-bold">
                {formatTime(elapsedTime)}
              </span>
            </div>
            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Distance</span>
                <span className="text-cyan-400">+{distanceScore}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Perfect ({perfectCount})</span>
                <span className="text-purple-400">+{perfectBonus}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Coins ({coinCount})</span>
                <span className="text-yellow-400">+{coinBonus}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Fever ({feverCount})</span>
                <span className="text-pink-400">+{feverBonus}</span>
              </div>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between">
              <span className="text-white font-bold">TOTAL SCORE</span>
              <span className="text-green-400 font-bold text-2xl">{totalScore}</span>
            </div>
            {highScore > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Best Distance</span>
                <span className="text-yellow-400">{highScore}m</span>
              </div>
            )}
          </div>
        </div>

        {/* Rewards & Save Status */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🍀</span>
              <span className="text-gray-400 text-sm">LUCK Earned</span>
            </div>
            <span className="text-purple-400 font-bold">+{luckEarned}</span>
          </div>
          {isSaved && (
            <p className="text-green-400 text-xs mt-2">✓ Score saved to leaderboard</p>
          )}
        </div>

        {/* Remaining Tickets */}
        {ticketStatus && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-gray-400 text-sm">Remaining tickets:</span>
            <span className="text-white font-bold">
              {ticketStatus.remainingTickets} / {ticketStatus.maxTickets}
            </span>
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
            onClick={handleRetry}
            disabled={!canRetry || isLoading}
            className={`flex-1 py-3 px-6 rounded-xl text-white font-bold transition-transform ${
              canRetry && !isLoading
                ? 'bg-gradient-to-r from-green-500 to-cyan-500 hover:scale-105'
                : 'bg-gray-600 cursor-not-allowed'
            }`}
          >
            {isLoading ? '...' : canRetry ? 'RETRY' : 'NO TICKETS'}
          </button>
        </div>
      </div>
    </div>
  );
}
