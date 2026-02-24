/**
 * Countdown & Menu Overlay Components
 *
 * Handles:
 * - Menu screen (pre-game)
 * - Countdown (3-2-1-GO)
 * - Game over result screen
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, Component, type ErrorInfo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../hooks/useGameStore';
import { useGameAPI } from '@/hooks/useGameAPI';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useZkLogin } from '@/hooks/useZkLogin';
import { calculateClubRewards, type RewardResult } from '@/lib/rewards/club-rewards';
import { GAME_TYPE } from '../constants';

// ============================================
// Menu Overlay
// ============================================

interface MenuOverlayProps {
  onStart: () => void;
}

export function MenuOverlay({ onStart }: MenuOverlayProps) {
  const highScore = useGameStore((s) => s.highScore);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20"
    >
      <div className="text-center space-y-6 p-6">
        {/* Title */}
        <motion.h1
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-4xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500"
        >
          COSMIC FLAP
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-300"
        >
          Navigate through space obstacles
        </motion.p>

        {/* High Score */}
        {highScore > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-black/40 rounded-lg px-4 py-2 inline-block"
          >
            <span className="text-gray-400 text-sm">BEST: </span>
            <span className="text-cyan-400 font-bold font-orbitron">{highScore}m</span>
          </motion.div>
        )}

        {/* Controls hint */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-400 text-sm space-y-1"
        >
          <p>📱 Tap anywhere to flap</p>
          <p>⌨️ Space / W / ↑ to flap</p>
        </motion.div>

        {/* Start button */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={onStart}
          data-clickable
          className="mt-6 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-bold text-white text-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all active:scale-95"
        >
          TAP TO START
        </motion.button>
      </div>
    </motion.div>
  );
}

// ============================================
// Countdown Overlay
// ============================================

interface CountdownOverlayProps {
  onComplete: () => void;
}

export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    }

    // count === 0: "GO!" 표시 후 게임 시작
    const goTimer = setTimeout(() => {
      onComplete();
    }, 500);
    return () => clearTimeout(goTimer);
  }, [count, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/40 z-20"
    >
      <motion.div
        key={count}
        initial={{ scale: 2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="text-7xl font-bold font-orbitron text-white"
      >
        {count > 0 ? count : 'GO!'}
      </motion.div>
    </motion.div>
  );
}

// ============================================
// Result Overlay
// ============================================

interface ResultOverlayProps {
  onPlayAgain: () => void;
  onMenu: () => void;
}

export function ResultOverlay({ onPlayAgain, onMenu }: ResultOverlayProps) {
  const [saving, setSaving] = useState(true);
  const [saved, setSaved] = useState(false);
  const [rewards, setRewards] = useState<RewardResult | null>(null);
  const hasSaved = useRef(false);

  // Capture submission data ONCE on mount (useMemo with empty deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const submissionData = useMemo(() => useGameStore.getState().getSubmissionData(), []);
  const highScore = useGameStore((s) => s.highScore);
  const isNewRecord = submissionData.distance >= highScore;

  const { saveGameRecord, getCurrentSession } = useGameAPI();
  const { address: suiWalletAddress } = useSuiWallet();
  const { address: zkAddress } = useZkLogin();
  const walletAddress = suiWalletAddress || zkAddress;

  // Calculate rewards (once, with error protection)
  useEffect(() => {
    try {
      const result = calculateClubRewards(GAME_TYPE, submissionData.distance, {
        feverCount: submissionData.tunnels_passed,
        perfectCount: submissionData.ufos_passed,
        coinCount: submissionData.coins_collected,
        difficulty: getDifficultyFromTime(submissionData.time_ms),
      });
      setRewards(result);
    } catch (err) {
      console.error('[CosmicFlap] Failed to calculate rewards:', err);
      setRewards({ totalReward: 0, baseReward: 0, feverBonus: 0, perfectBonus: 0, coinBonus: 0, difficultyMultiplier: 1, breakdown: {} } as unknown as RewardResult);
    }
  }, [submissionData]);

  // Save record (once, guarded by ref)
  useEffect(() => {
    if (hasSaved.current) return;
    hasSaved.current = true;

    const save = async () => {
      const sessionToken = getCurrentSession();
      if (!walletAddress) {
        setSaving(false);
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recordData: any = {
          wallet_address: walletAddress,
          game_type: GAME_TYPE,
          score: submissionData.distance,
          distance: submissionData.distance,
          time_ms: submissionData.time_ms,
          fever_count: submissionData.tunnels_passed,
          perfect_count: submissionData.ufos_passed,
          coin_count: submissionData.coins_collected,
          session_token: sessionToken,
          obstacles_passed: submissionData.obstacles_passed,
          flap_count: submissionData.flap_count,
          tunnels_passed: submissionData.tunnels_passed,
          ufos_passed: submissionData.ufos_passed,
          items_collected: submissionData.items_collected,
        };
        await saveGameRecord(recordData);
        setSaved(true);
      } catch (error) {
        console.error('Failed to save record:', error);
      } finally {
        setSaving(false);
      }
    };

    save();
  }, [walletAddress, submissionData, saveGameRecord, getCurrentSession]);

  // Get difficulty string from time
  function getDifficultyFromTime(timeMs: number): string {
    const seconds = timeMs / 1000;
    if (seconds < 30) return 'easy';
    if (seconds < 60) return 'medium';
    if (seconds < 120) return 'hard';
    return 'extreme';
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-20 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-900/90 rounded-2xl p-6 max-w-sm w-full space-y-4 border border-slate-700"
      >
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold font-orbitron text-white">GAME OVER</h2>
          {isNewRecord && (
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-yellow-400 font-bold mt-1"
            >
              🎉 NEW RECORD!
            </motion.p>
          )}
        </div>

        {/* Score */}
        <div className="text-center bg-black/40 rounded-xl p-4">
          <p className="text-gray-400 text-sm">DISTANCE</p>
          <p className="text-4xl font-bold font-orbitron text-cyan-400">
            {submissionData.distance}m
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-gray-400 text-xs">Obstacles</p>
            <p className="text-white font-bold">{submissionData.obstacles_passed}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-gray-400 text-xs">Coins</p>
            <p className="text-yellow-400 font-bold">{submissionData.coins_collected}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-gray-400 text-xs">Flaps</p>
            <p className="text-white font-bold">{submissionData.flap_count}</p>
          </div>
        </div>

        {/* Rewards */}
        {rewards && (
          <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl p-4">
            <p className="text-gray-300 text-sm mb-2">REWARDS EARNED</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                +{rewards.totalReward}
              </span>
              <span className="text-yellow-400 font-bold">$CLUB</span>
            </div>
            {saving && <p className="text-gray-400 text-xs mt-2 text-center">Saving...</p>}
            {saved && <p className="text-green-400 text-xs mt-2 text-center">✓ Saved</p>}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onMenu}
            data-clickable
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-white transition-colors"
          >
            Menu
          </button>
          <button
            onClick={onPlayAgain}
            data-clickable
            className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-bold text-white transition-colors hover:opacity-90"
          >
            Play Again
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// Error Boundary for Result Overlay
// ============================================

interface ResultErrorBoundaryProps {
  onPlayAgain: () => void;
  onMenu: () => void;
  children: ReactNode;
}

interface ResultErrorBoundaryState {
  hasError: boolean;
}

class ResultErrorBoundary extends Component<ResultErrorBoundaryProps, ResultErrorBoundaryState> {
  constructor(props: ResultErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ResultErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CosmicFlap] ResultOverlay crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback game over screen
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-20 p-4">
          <div className="bg-slate-900/90 rounded-2xl p-6 max-w-sm w-full space-y-4 border border-slate-700 text-center">
            <h2 className="text-2xl font-bold font-orbitron text-white">GAME OVER</h2>
            <div className="flex gap-3 mt-6">
              <button
                onClick={this.props.onMenu}
                data-clickable
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-white transition-colors"
              >
                Menu
              </button>
              <button
                onClick={this.props.onPlayAgain}
                data-clickable
                className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-bold text-white transition-colors hover:opacity-90"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================
// Combined Overlay Manager
// ============================================

export function OverlayManager() {
  const status = useGameStore((s) => s.status);
  const startCountdown = useGameStore((s) => s.startCountdown);
  const startGame = useGameStore((s) => s.startGame);
  const reset = useGameStore((s) => s.reset);

  const handleStart = useCallback(() => {
    startCountdown();
  }, [startCountdown]);

  const handlePlayAgain = useCallback(() => {
    reset();
    startCountdown();
  }, [reset, startCountdown]);

  const handleMenu = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <AnimatePresence>
      {status === 'menu' && <MenuOverlay key="menu" onStart={handleStart} />}
      {status === 'countdown' && <CountdownOverlay key="countdown" onComplete={startGame} />}
      {status === 'gameover' && (
        <ResultErrorBoundary key="result-boundary" onPlayAgain={handlePlayAgain} onMenu={handleMenu}>
          <ResultOverlay key="result" onPlayAgain={handlePlayAgain} onMenu={handleMenu} />
        </ResultErrorBoundary>
      )}
    </AnimatePresence>
  );
}

export default OverlayManager;
