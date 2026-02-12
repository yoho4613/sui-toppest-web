import { create } from 'zustand';

export type Lane = -1 | 0 | 1;
export type PlayerAction = 'running' | 'jumping' | 'sliding' | 'crashed';
export type GameStatus = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameover';

// Difficulty based on elapsed time (matching Neon Dash)
export type DifficultyLevel = 'tutorial' | 'easy' | 'medium' | 'hard' | 'extreme';

// Potion size types (matching Neon Dash)
export type PotionSize = 'small' | 'normal' | 'large';

// Potion heal amounts (matching Neon Dash)
const POTION_HEAL_AMOUNTS: Record<PotionSize, number> = {
  small: 15,   // 15% health
  normal: 30,  // 30% health
  large: 50,   // 50% health
};

// Potion spawn weights (matching Neon Dash)
export const POTION_SPAWN_WEIGHTS: Record<PotionSize, number> = {
  small: 60,   // 60% chance
  normal: 30,  // 30% chance
  large: 10,   // 10% chance
};

// Game constants (increased for faster gameplay)
const BASE_SPEED = 22;
const MAX_SPEED = 45;
const DIFFICULTY_INCREASE_RATE = 0.0008; // Faster speed increase
const DISTANCE_MULTIPLIER = 0.5; // Distance counts at 0.5x speed

// Health system (matching Neon Dash)
const INITIAL_HEALTH = 100;
const MAX_HEALTH = 100;
const BASE_HEALTH_DECAY = 1.5;       // HP per second base decay
const HEALTH_DECAY_INCREASE = 0.02;  // Decay rate increase per second

// Fever mode
const FEVER_MULTIPLIER = 1.5;
const CONSECUTIVE_COINS_FOR_FEVER = 5;

// Jump timing (matching Neon Dash)
const JUMP_DURATION = 400; // ms

// Obstacle spawn thresholds (time-based, matching Neon Dash)
export const HURDLE_SPAWN_THRESHOLD = 45;  // 45s for hurdle obstacles
export const MIXED_SPAWN_THRESHOLD = 60;   // 60s for mixed patterns
export const ADVANCED_SPAWN_THRESHOLD = 90; // 90s for advanced patterns
export const MOVING_OBSTACLE_DISTANCE = 1500; // 1500m for moving obstacles

// Game over reasons
export type GameOverReason = 'collision' | 'exhaustion' | null;

interface GameState {
  // Game state
  status: GameStatus;
  difficulty: DifficultyLevel;

  // Player state
  playerLane: Lane;
  playerAction: PlayerAction;
  playerY: number;

  // Health system (replaces energy)
  health: number;
  maxHealth: number;

  // Fever mode (triggered by consecutive coins)
  isFeverMode: boolean;
  feverCount: number;
  consecutiveCoins: number;

  // Progress
  distance: number;
  elapsedTime: number;
  perfectCount: number;
  coinCount: number;
  potionCount: number;
  laneChanges: number;
  dodgeCount: number;
  speed: number;
  baseSpeed: number;

  // High score
  highScore: number;

  // Crash state
  isCrashing: boolean;
  crashTime: number;
  gameOverReason: GameOverReason;

  // Actions
  setStatus: (status: GameStatus) => void;
  setLane: (lane: Lane) => void;
  jump: () => void;
  startSlide: () => void;
  endSlide: () => void;
  addPerfect: () => void;
  collectCoin: () => void;
  collectPotion: (size?: PotionSize) => void;
  activateFever: () => void;
  updateGame: (delta: number) => void;
  triggerCrash: () => void;
  triggerExhaustion: () => void;
  gameOver: () => void;
  reset: () => void;
  startGame: () => void;
}

// Store timeout IDs for cleanup
const timeoutIds: Set<ReturnType<typeof setTimeout>> = new Set();

function addTimeout(callback: () => void, delay: number): void {
  const id = setTimeout(() => {
    timeoutIds.delete(id);
    callback();
  }, delay);
  timeoutIds.add(id);
}

function clearAllTimeouts(): void {
  timeoutIds.forEach(id => clearTimeout(id));
  timeoutIds.clear();
}

// Get difficulty level based on elapsed time (matching Neon Dash thresholds)
function getDifficultyLevel(elapsedTime: number): DifficultyLevel {
  if (elapsedTime < 15) return 'tutorial';
  if (elapsedTime < HURDLE_SPAWN_THRESHOLD) return 'easy';
  if (elapsedTime < MIXED_SPAWN_THRESHOLD) return 'medium';
  if (elapsedTime < ADVANCED_SPAWN_THRESHOLD) return 'hard';
  return 'extreme';
}

// Load high score from localStorage
function loadHighScore(): number {
  if (typeof window === 'undefined') return 0;
  const saved = localStorage.getItem('dashTrials_highScore');
  return saved ? parseInt(saved, 10) : 0;
}

// Save high score to localStorage
function saveHighScore(score: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dashTrials_highScore', score.toString());
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial values
  status: 'menu',
  difficulty: 'tutorial',
  playerLane: 0,
  playerAction: 'running',
  playerY: 0,
  health: INITIAL_HEALTH,
  maxHealth: MAX_HEALTH,
  isFeverMode: false,
  feverCount: 0,
  consecutiveCoins: 0,
  distance: 0,
  elapsedTime: 0,
  perfectCount: 0,
  coinCount: 0,
  potionCount: 0,
  laneChanges: 0,
  dodgeCount: 0,
  speed: BASE_SPEED,
  baseSpeed: BASE_SPEED,
  highScore: loadHighScore(),
  isCrashing: false,
  crashTime: 0,
  gameOverReason: null,

  // Actions
  setStatus: (status) => set({ status }),

  setLane: (lane) => {
    const { playerAction, status, playerLane } = get();
    // Can't change lane while jumping or sliding (matching Neon Dash)
    if (playerAction !== 'running' || status !== 'playing') return;
    if (lane === playerLane) return;

    set({ playerLane: lane, laneChanges: get().laneChanges + 1 });
  },

  jump: () => {
    const { playerAction, status } = get();
    if (playerAction !== 'running' || status !== 'playing') return;

    set({ playerAction: 'jumping', playerY: 2 });

    addTimeout(() => {
      const current = get();
      if (current.playerAction === 'jumping') {
        set({ playerAction: 'running', playerY: 0 });
      }
    }, JUMP_DURATION);
  },

  startSlide: () => {
    const { playerAction, status } = get();
    if (playerAction !== 'running' || status !== 'playing') return;
    set({ playerAction: 'sliding' });
  },

  endSlide: () => {
    const { playerAction } = get();
    if (playerAction === 'sliding') {
      set({ playerAction: 'running' });
    }
  },

  addPerfect: () => {
    const current = get();
    set({
      perfectCount: current.perfectCount + 1,
      dodgeCount: current.dodgeCount + 1,
    });
  },

  // Coins trigger fever mode (no health recovery)
  collectCoin: () => {
    const current = get();
    const newCoinCount = current.coinCount + 1;
    const newConsecutive = current.consecutiveCoins + 1;

    // Check for fever mode (5 consecutive coins)
    if (newConsecutive >= CONSECUTIVE_COINS_FOR_FEVER && !current.isFeverMode) {
      set({
        coinCount: newCoinCount,
        consecutiveCoins: 0,
      });
      get().activateFever();
    } else {
      set({
        coinCount: newCoinCount,
        consecutiveCoins: newConsecutive,
      });
    }
  },

  // Potions recover health based on size (matching Neon Dash)
  collectPotion: (size: PotionSize = 'normal') => {
    const current = get();
    const healAmount = POTION_HEAL_AMOUNTS[size];
    const newHealth = Math.min(current.maxHealth, current.health + healAmount);

    set({
      potionCount: current.potionCount + 1,
      health: newHealth,
    });
  },

  activateFever: () => {
    const { baseSpeed } = get();
    set({
      isFeverMode: true,
      feverCount: get().feverCount + 1,
      speed: baseSpeed * FEVER_MULTIPLIER,
    });

    // Fever ends after 3 seconds
    addTimeout(() => {
      const current = get();
      set({
        isFeverMode: false,
        speed: current.baseSpeed,
        consecutiveCoins: 0,
      });
    }, 3000);
  },

  // Combined update function for distance, time, health, and difficulty (matching Neon Dash)
  updateGame: (delta) => {
    const { status, isFeverMode, isCrashing, health } = get();
    if (status !== 'playing' || isCrashing) return;

    const currentState = get();

    // Update elapsed time
    const newElapsedTime = currentState.elapsedTime + delta;

    // Calculate speed based on distance (matching Neon Dash formula)
    const multiplier = 1 + currentState.distance * DIFFICULTY_INCREASE_RATE;
    const calculatedSpeed = Math.min(BASE_SPEED * multiplier, MAX_SPEED);
    const actualSpeed = isFeverMode ? calculatedSpeed * FEVER_MULTIPLIER : calculatedSpeed;

    // Update distance (0.5x multiplier like Neon Dash)
    const newDistance = currentState.distance + actualSpeed * delta * DISTANCE_MULTIPLIER;

    // Update difficulty based on elapsed time
    const newDifficulty = getDifficultyLevel(newElapsedTime);

    // Health decay (faster over time, matching Neon Dash)
    let newHealth = health;
    if (!isFeverMode) {
      const decayRate = BASE_HEALTH_DECAY + (newElapsedTime * HEALTH_DECAY_INCREASE);
      newHealth = Math.max(0, health - decayRate * delta);
    }

    set({
      elapsedTime: newElapsedTime,
      distance: newDistance,
      speed: actualSpeed,
      baseSpeed: calculatedSpeed,
      difficulty: newDifficulty,
      health: newHealth,
    });

    // Check for exhaustion (health depleted)
    if (newHealth <= 0) {
      get().triggerExhaustion();
    }
  },

  triggerCrash: () => {
    const { isCrashing, gameOverReason } = get();
    if (isCrashing || gameOverReason !== null) return;

    set({
      isCrashing: true,
      crashTime: Date.now(),
      playerAction: 'crashed',
      gameOverReason: 'collision',
    });

    // Delay gameover to show crash animation
    addTimeout(() => {
      get().gameOver();
    }, 1200);
  },

  triggerExhaustion: () => {
    const { isCrashing, gameOverReason } = get();
    if (isCrashing || gameOverReason !== null) return;

    set({
      isCrashing: true,
      crashTime: Date.now(),
      playerAction: 'crashed',
      speed: 0,
      gameOverReason: 'exhaustion',
    });

    // Delay gameover to show exhaustion animation
    addTimeout(() => {
      get().gameOver();
    }, 2000);
  },

  gameOver: () => {
    const { distance, highScore } = get();
    const finalScore = Math.floor(distance);

    // Update high score if beaten
    if (finalScore > highScore) {
      saveHighScore(finalScore);
      set({ highScore: finalScore });
    }

    set({ status: 'gameover', isCrashing: false });
  },

  startGame: () => {
    set({
      status: 'countdown',
      difficulty: 'tutorial',
      distance: 0,
      elapsedTime: 0,
      perfectCount: 0,
      coinCount: 0,
      potionCount: 0,
      feverCount: 0,
      laneChanges: 0,
      dodgeCount: 0,
      consecutiveCoins: 0,
      isFeverMode: false,
      playerLane: 0,
      playerAction: 'running',
      playerY: 0,
      speed: BASE_SPEED,
      baseSpeed: BASE_SPEED,
      health: INITIAL_HEALTH,
      gameOverReason: null,
      isCrashing: false,
      crashTime: 0,
    });

    // Countdown: 3, 2, 1, GO!
    addTimeout(() => {
      set({ status: 'playing' });
    }, 3000);
  },

  reset: () => {
    clearAllTimeouts();
    set({
      status: 'menu',
      difficulty: 'tutorial',
      playerLane: 0,
      playerAction: 'running',
      playerY: 0,
      health: INITIAL_HEALTH,
      isFeverMode: false,
      isCrashing: false,
      crashTime: 0,
      gameOverReason: null,
      consecutiveCoins: 0,
      distance: 0,
      elapsedTime: 0,
      perfectCount: 0,
      coinCount: 0,
      potionCount: 0,
      feverCount: 0,
      laneChanges: 0,
      dodgeCount: 0,
      speed: BASE_SPEED,
      baseSpeed: BASE_SPEED,
    });
  },
}));

// Export constants for ObstacleManager
export {
  getDifficultyLevel,
  BASE_SPEED,
  MAX_SPEED,
  DIFFICULTY_INCREASE_RATE,
  DISTANCE_MULTIPLIER,
  INITIAL_HEALTH,
  MAX_HEALTH,
};

// Individual selector hooks for performance
export const useGameStatus = () => useGameStore((state) => state.status);
export const useDifficulty = () => useGameStore((state) => state.difficulty);
