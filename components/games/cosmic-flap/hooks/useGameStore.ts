/**
 * Cosmic Flap Game Store
 *
 * Zustand-based state management for the game.
 * Handles player physics, scoring, items, and game state.
 *
 * Item logic:
 * - Slow(시계): 5초간 초기속도 유지 → 10초 동안 원래 속도로 복귀
 * - Shield(쉴드): 1회 장애물 방어 (장애물 제거), 10초 미사용 시 자동 제거 (3초전 깜빡임)
 * - Coin: CLUB +1
 */

import { create } from 'zustand';
import {
  PHYSICS,
  WORLD,
  DIFFICULTY,
  ITEM_EFFECTS,
  SCORING,
  TUNNEL,
} from '../constants';

// ============================================
// Types
// ============================================

export type GameStatus = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameover';

export interface ItemsCollected {
  slow: number;
  shield: number;
  coin: number;
}

export interface GameState {
  // Game status
  status: GameStatus;
  startTime: number;
  elapsedTime: number;

  // Player physics
  playerY: number;
  velocity: number;

  // Score metrics
  distance: number;
  obstaclesPassed: number;
  flapCount: number;

  // Obstacle tracking
  tunnelsPassed: number;
  ufosPassed: number;

  // Items
  coinsCollected: number;
  itemsCollected: ItemsCollected;

  // Active effects
  hasShield: boolean;
  shieldEndTime: number;
  isSlowed: boolean;
  slowCollectedAt: number;   // timestamp when slow was collected (0 = inactive)
  shieldUsed: number;

  // Difficulty
  currentSpeed: number;
  currentGap: number;
  currentSpawnDistance: number;

  // High score
  highScore: number;

  // Revive
  usedRevive: boolean;
  canRevive: boolean;
}

export interface GameActions {
  // Player actions
  flap: () => void;

  // Game loop
  updateGame: (delta: number) => void;

  // Obstacle events
  passObstacle: () => void;
  passTunnel: () => void;
  passUFO: () => void;

  // Item events
  collectItem: (type: 'slow' | 'shield' | 'coin') => void;
  useShield: () => void;

  // Game state
  triggerCollision: () => void;
  revive: () => void;
  startCountdown: () => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  gameOver: () => void;
  reset: () => void;

  // Getters for submission
  getSubmissionData: () => SubmissionData;
}

export interface SubmissionData {
  score: number;
  distance: number;
  time_ms: number;
  flap_count: number;
  obstacles_passed: number;
  tunnels_passed: number;
  ufos_passed: number;
  coins_collected: number;
  items_collected: ItemsCollected;
  shield_used: number;
  used_revive: boolean;
}

type GameStore = GameState & GameActions;

// ============================================
// Initial State
// ============================================

const getInitialState = (): GameState => ({
  status: 'menu',
  startTime: 0,
  elapsedTime: 0,

  playerY: 0,
  velocity: 0,

  distance: 0,
  obstaclesPassed: 0,
  flapCount: 0,

  tunnelsPassed: 0,
  ufosPassed: 0,

  coinsCollected: 0,
  itemsCollected: { slow: 0, shield: 0, coin: 0 },

  hasShield: false,
  shieldEndTime: 0,
  isSlowed: false,
  slowCollectedAt: 0,
  shieldUsed: 0,

  currentSpeed: DIFFICULTY.INITIAL_SPEED,
  currentGap: DIFFICULTY.INITIAL_GAP,
  currentSpawnDistance: DIFFICULTY.INITIAL_SPAWN_DISTANCE,

  highScore: typeof window !== 'undefined'
    ? parseInt(localStorage.getItem('cosmic-flap-highscore') || '0', 10)
    : 0,

  usedRevive: false,
  canRevive: true,
});

// ============================================
// Store
// ============================================

export const useGameStore = create<GameStore>((set, get) => ({
  ...getInitialState(),

  // ==========================================
  // Player Actions
  // ==========================================

  flap: () => {
    const { status } = get();
    if (status !== 'playing') return;

    set((state) => ({
      velocity: PHYSICS.FLAP_VELOCITY,
      flapCount: state.flapCount + 1,
    }));
  },

  // ==========================================
  // Game Loop
  // ==========================================

  updateGame: (delta: number) => {
    const state = get();
    if (state.status !== 'playing') return;

    const now = Date.now();
    const newElapsedTime = now - state.startTime;
    const elapsedSeconds = newElapsedTime / 1000;

    // Delta-based physics
    let newVelocity = state.velocity + PHYSICS.GRAVITY * delta;
    newVelocity = Math.max(newVelocity, -PHYSICS.MAX_FALL_VELOCITY);
    const newY = state.playerY + newVelocity * delta;

    // Check bounds (floor/ceiling = always game over, shield does NOT protect)
    if (newY <= WORLD.MIN_Y || newY >= WORLD.MAX_Y) {
      get().gameOver();
      return;
    }

    // Difficulty progression
    const difficultyProgress = Math.min(elapsedSeconds / DIFFICULTY.RAMP_UP_SECONDS, 1);

    const baseSpeed = DIFFICULTY.INITIAL_SPEED +
      (DIFFICULTY.MAX_SPEED - DIFFICULTY.INITIAL_SPEED) * difficultyProgress;

    const newGap = DIFFICULTY.INITIAL_GAP -
      (DIFFICULTY.INITIAL_GAP - DIFFICULTY.MIN_GAP) * difficultyProgress;

    const newSpawnDistance = DIFFICULTY.INITIAL_SPAWN_DISTANCE -
      (DIFFICULTY.INITIAL_SPAWN_DISTANCE - DIFFICULTY.MIN_SPAWN_DISTANCE) * difficultyProgress;

    // ---- Slow effect: 2-phase speed reduction ----
    let effectiveSpeed = baseSpeed;
    let isSlowed = state.isSlowed;
    let slowCollectedAt = state.slowCollectedAt;

    if (slowCollectedAt > 0) {
      const slowElapsed = now - slowCollectedAt;
      const holdDuration = ITEM_EFFECTS.SLOW_HOLD_DURATION;
      const recoveryDuration = ITEM_EFFECTS.SLOW_RECOVERY_DURATION;
      const totalDuration = holdDuration + recoveryDuration;

      if (slowElapsed < holdDuration) {
        // Phase 1: 5초간 초기 속도로 고정
        effectiveSpeed = DIFFICULTY.INITIAL_SPEED;
        isSlowed = true;
      } else if (slowElapsed < totalDuration) {
        // Phase 2: 10초에 걸쳐 현재 난이도 속도로 복귀
        const recoveryProgress = (slowElapsed - holdDuration) / recoveryDuration;
        effectiveSpeed = DIFFICULTY.INITIAL_SPEED + (baseSpeed - DIFFICULTY.INITIAL_SPEED) * recoveryProgress;
        isSlowed = true;
      } else {
        // 만료
        isSlowed = false;
        slowCollectedAt = 0;
      }
    }

    // Update distance
    const distanceIncrement = effectiveSpeed * delta * SCORING.DISTANCE_MULTIPLIER;
    const newDistance = state.distance + distanceIncrement;

    // ---- Shield expiration ----
    let hasShield = state.hasShield;
    if (hasShield && now >= state.shieldEndTime) {
      hasShield = false;
    }

    set({
      playerY: newY,
      velocity: newVelocity,
      elapsedTime: newElapsedTime,
      distance: newDistance,
      currentSpeed: effectiveSpeed,
      currentGap: newGap,
      currentSpawnDistance: newSpawnDistance,
      hasShield,
      isSlowed,
      slowCollectedAt,
    });
  },

  // ==========================================
  // Obstacle Events
  // ==========================================

  passObstacle: () => {
    set((state) => ({
      obstaclesPassed: state.obstaclesPassed + 1,
    }));
  },

  passTunnel: () => {
    set((state) => ({
      tunnelsPassed: state.tunnelsPassed + 1,
      obstaclesPassed: state.obstaclesPassed + 1,
      distance: state.distance + SCORING.TUNNEL_BONUS,
    }));
  },

  passUFO: () => {
    set((state) => ({
      ufosPassed: state.ufosPassed + 1,
      obstaclesPassed: state.obstaclesPassed + 1,
    }));
  },

  // ==========================================
  // Item Events
  // ==========================================

  collectItem: (type: 'slow' | 'shield' | 'coin') => {
    const now = Date.now();

    set((state) => {
      const newItemsCollected = { ...state.itemsCollected };
      newItemsCollected[type]++;

      const updates: Partial<GameState> = {
        itemsCollected: newItemsCollected,
      };

      if (type === 'coin') {
        updates.coinsCollected = state.coinsCollected + 1;
      } else if (type === 'shield') {
        updates.hasShield = true;
        updates.shieldEndTime = now + ITEM_EFFECTS.SHIELD_DURATION;
      } else if (type === 'slow') {
        updates.isSlowed = true;
        updates.slowCollectedAt = now;
      }

      return updates;
    });
  },

  useShield: () => {
    set((state) => ({
      hasShield: false,
      shieldUsed: state.shieldUsed + 1,
    }));
  },

  // ==========================================
  // Game State
  // ==========================================

  // triggerCollision: 바닥/천장 충돌 전용 (쉴드 무관하게 게임오버)
  // 장애물 충돌 시 쉴드 체크는 ObstacleManager에서 직접 처리
  triggerCollision: () => {
    const { status } = get();
    console.log('[CosmicFlap] triggerCollision called, status:', status);
    if (status !== 'playing') return;
    get().gameOver();
  },

  revive: () => {
    const { canRevive, usedRevive } = get();

    if (!canRevive || usedRevive) return;

    set({
      usedRevive: true,
      canRevive: false,
      playerY: 0,
      velocity: 0,
      hasShield: true,
      shieldEndTime: Date.now() + 3000,
      status: 'playing',
    });
  },

  startCountdown: () => {
    set({ status: 'countdown' });
  },

  startGame: () => {
    set({
      ...getInitialState(),
      status: 'playing',
      startTime: Date.now(),
      highScore: get().highScore,
    });
  },

  pauseGame: () => {
    const { status } = get();
    if (status === 'playing') {
      set({ status: 'paused' });
    }
  },

  resumeGame: () => {
    const { status } = get();
    if (status === 'paused') {
      set({ status: 'playing' });
    }
  },

  gameOver: () => {
    const { distance, highScore, status } = get();
    if (status === 'gameover') return;

    console.log('[CosmicFlap] gameOver called, distance:', Math.floor(distance), 'from status:', status);

    const finalDistance = Math.floor(distance);
    const newHighScore = finalDistance > highScore ? finalDistance : highScore;

    try {
      if (finalDistance > highScore && typeof window !== 'undefined') {
        localStorage.setItem('cosmic-flap-highscore', finalDistance.toString());
      }
    } catch { /* ignore */ }

    // 단일 set 호출로 status + highScore 동시 업데이트
    set({ status: 'gameover', highScore: newHighScore });
    console.log('[CosmicFlap] status set to gameover, verified:', get().status);
  },

  reset: () => {
    set({
      ...getInitialState(),
      highScore: get().highScore,
    });
  },

  // ==========================================
  // Submission Data
  // ==========================================

  getSubmissionData: (): SubmissionData => {
    const state = get();
    return {
      score: Math.floor(state.distance),
      distance: Math.floor(state.distance),
      time_ms: state.elapsedTime,
      flap_count: state.flapCount,
      obstacles_passed: state.obstaclesPassed,
      tunnels_passed: state.tunnelsPassed,
      ufos_passed: state.ufosPassed,
      coins_collected: state.coinsCollected,
      items_collected: { ...state.itemsCollected },
      shield_used: state.shieldUsed,
      used_revive: state.usedRevive,
    };
  },
}));

// ============================================
// Selectors (for performance)
// ============================================

export const selectStatus = (state: GameStore) => state.status;
export const selectPlayerY = (state: GameStore) => state.playerY;
export const selectVelocity = (state: GameStore) => state.velocity;
export const selectDistance = (state: GameStore) => state.distance;
export const selectHasShield = (state: GameStore) => state.hasShield;
export const selectIsSlowed = (state: GameStore) => state.isSlowed;
export const selectCurrentSpeed = (state: GameStore) => state.currentSpeed;
export const selectCurrentGap = (state: GameStore) => state.currentGap;
