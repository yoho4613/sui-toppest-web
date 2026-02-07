import { create } from 'zustand';

export type Lane = -1 | 0 | 1;
export type PlayerAction = 'running' | 'jumping' | 'sliding' | 'crashed';
export type GameStatus = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameover';

// Difficulty levels based on distance
export type DifficultyLevel = 'tutorial' | 'easy' | 'medium' | 'hard' | 'extreme';

// Potion size types
export type PotionSize = 'small' | 'normal' | 'large';

// Energy recovery amounts for each potion size
const POTION_ENERGY_AMOUNTS: Record<PotionSize, number> = {
  small: 15,   // 15% energy
  normal: 30,  // 30% energy
  large: 50,   // 50% energy
};

interface GameState {
  // Game state
  status: GameStatus;
  difficulty: DifficultyLevel;

  // Player state
  playerLane: Lane;
  playerAction: PlayerAction;
  playerY: number;

  // Energy system
  energy: number;
  maxEnergy: number;
  energyDrainRate: number;

  // Fever mode (triggered by collecting many coins)
  isFeverMode: boolean;
  feverCount: number;
  consecutiveCoins: number;

  // Progress
  distance: number;
  elapsedTime: number;
  perfectCount: number;
  coinCount: number;
  potionCount: number;
  speed: number;
  baseSpeed: number;

  // Dynamic difficulty config
  potionEnergyBonus: number;
  obstacleSpawnRate: number;

  // High score
  highScore: number;

  // Crash animation
  isCrashing: boolean;
  crashTime: number;

  // Exhaustion animation (energy depleted)
  isExhausted: boolean;
  exhaustionTime: number;

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
  updateDistance: (delta: number) => void;
  updateTime: (delta: number) => void;
  updateEnergy: (delta: number) => void;
  updateDifficulty: () => void;
  triggerCrash: () => void;
  triggerExhaustion: () => void;
  gameOver: () => void;
  reset: () => void;
  startGame: () => void;
}

// Difficulty configuration based on distance
const DIFFICULTY_CONFIG = {
  tutorial: {
    minDistance: 0,
    maxDistance: 200,
    speedMultiplier: 1.0,
    energyDrainRate: 4,
    potionEnergyBonus: 35, // Potion gives 35% energy
    obstacleSpawnRate: 0.4, // 40% density
  },
  easy: {
    minDistance: 200,
    maxDistance: 500,
    speedMultiplier: 1.15,
    energyDrainRate: 5,
    potionEnergyBonus: 32,
    obstacleSpawnRate: 0.5,
  },
  medium: {
    minDistance: 500,
    maxDistance: 1000,
    speedMultiplier: 1.3,
    energyDrainRate: 6,
    potionEnergyBonus: 28,
    obstacleSpawnRate: 0.6,
  },
  hard: {
    minDistance: 1000,
    maxDistance: 2000,
    speedMultiplier: 1.5,
    energyDrainRate: 7,
    potionEnergyBonus: 25,
    obstacleSpawnRate: 0.7,
  },
  extreme: {
    minDistance: 2000,
    maxDistance: Infinity,
    speedMultiplier: 1.7,
    energyDrainRate: 8,
    potionEnergyBonus: 22,
    obstacleSpawnRate: 0.8,
  },
};

const BASE_SPEED = 15;
const MAX_ENERGY = 100;
const FEVER_MULTIPLIER = 1.5;
const CONSECUTIVE_COINS_FOR_FEVER = 5;

// Get difficulty level based on distance
function getDifficultyLevel(distance: number): DifficultyLevel {
  if (distance < DIFFICULTY_CONFIG.tutorial.maxDistance) return 'tutorial';
  if (distance < DIFFICULTY_CONFIG.easy.maxDistance) return 'easy';
  if (distance < DIFFICULTY_CONFIG.medium.maxDistance) return 'medium';
  if (distance < DIFFICULTY_CONFIG.hard.maxDistance) return 'hard';
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
  energy: MAX_ENERGY,
  maxEnergy: MAX_ENERGY,
  energyDrainRate: DIFFICULTY_CONFIG.tutorial.energyDrainRate,
  isFeverMode: false,
  feverCount: 0,
  consecutiveCoins: 0,
  distance: 0,
  elapsedTime: 0,
  perfectCount: 0,
  coinCount: 0,
  potionCount: 0,
  speed: BASE_SPEED,
  baseSpeed: BASE_SPEED,
  potionEnergyBonus: DIFFICULTY_CONFIG.tutorial.potionEnergyBonus,
  obstacleSpawnRate: DIFFICULTY_CONFIG.tutorial.obstacleSpawnRate,
  highScore: loadHighScore(),
  isCrashing: false,
  crashTime: 0,
  isExhausted: false,
  exhaustionTime: 0,

  // Actions
  setStatus: (status) => set({ status }),

  setLane: (lane) => set({ playerLane: lane }),

  jump: () => {
    const { playerAction, status } = get();
    if (playerAction !== 'running' || status !== 'playing') return;

    set({ playerAction: 'jumping', playerY: 2 });

    setTimeout(() => {
      const current = get();
      if (current.playerAction === 'jumping') {
        set({ playerAction: 'running', playerY: 0 });
      }
    }, 600);
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
    const newCount = current.perfectCount + 1;
    // Just count perfect, no energy bonus (energy only from potions)
    set({ perfectCount: newCount });
  },

  // Coins only trigger fever mode (no energy recovery)
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

  // Potions recover energy based on size
  collectPotion: (size: PotionSize = 'normal') => {
    const current = get();
    const newPotionCount = current.potionCount + 1;
    const energyBonus = POTION_ENERGY_AMOUNTS[size];
    const newEnergy = Math.min(current.maxEnergy, current.energy + energyBonus);

    set({
      potionCount: newPotionCount,
      energy: newEnergy,
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
    setTimeout(() => {
      const current = get();
      set({
        isFeverMode: false,
        speed: current.baseSpeed,
        consecutiveCoins: 0,
      });
    }, 3000);
  },

  updateDifficulty: () => {
    const { distance, isFeverMode } = get();
    const newDifficulty = getDifficultyLevel(distance);
    const config = DIFFICULTY_CONFIG[newDifficulty];

    const newBaseSpeed = BASE_SPEED * config.speedMultiplier;

    set({
      difficulty: newDifficulty,
      baseSpeed: newBaseSpeed,
      speed: isFeverMode ? newBaseSpeed * FEVER_MULTIPLIER : newBaseSpeed,
      energyDrainRate: config.energyDrainRate,
      potionEnergyBonus: config.potionEnergyBonus,
      obstacleSpawnRate: config.obstacleSpawnRate,
    });
  },

  updateDistance: (delta) => {
    const { speed, status } = get();
    if (status !== 'playing') return;

    const newDistance = get().distance + speed * delta;
    set({ distance: newDistance });

    // Update difficulty based on new distance
    get().updateDifficulty();
  },

  updateTime: (delta) => {
    const { status } = get();
    if (status !== 'playing') return;
    set((state) => ({ elapsedTime: state.elapsedTime + delta * 1000 }));
  },

  updateEnergy: (delta) => {
    const { status, isFeverMode, energyDrainRate, isExhausted } = get();
    if (status !== 'playing' || isExhausted) return;

    // Fever mode: no energy drain
    if (isFeverMode) return;

    const newEnergy = get().energy - energyDrainRate * delta;

    if (newEnergy <= 0) {
      set({ energy: 0 });
      get().triggerExhaustion();
    } else {
      set({ energy: newEnergy });
    }
  },

  triggerCrash: () => {
    const { isCrashing, isExhausted } = get();
    if (isCrashing || isExhausted) return;

    set({
      isCrashing: true,
      crashTime: Date.now(),
      playerAction: 'crashed',
    });

    // Delay gameover to show crash animation
    setTimeout(() => {
      get().gameOver();
    }, 1200);
  },

  triggerExhaustion: () => {
    const { isCrashing, isExhausted } = get();
    if (isCrashing || isExhausted) return;

    set({
      isExhausted: true,
      exhaustionTime: Date.now(),
      playerAction: 'crashed', // Reuse crashed state for animation
      speed: 0, // Stop running immediately
    });

    // Delay gameover to show exhaustion animation
    setTimeout(() => {
      get().gameOver();
    }, 2000); // Longer delay for kneeling animation
  },

  gameOver: () => {
    const { distance, highScore } = get();
    const finalScore = Math.floor(distance);

    // Update high score if beaten
    if (finalScore > highScore) {
      saveHighScore(finalScore);
      set({ highScore: finalScore });
    }

    set({ status: 'gameover', isCrashing: false, isExhausted: false });
  },

  startGame: () => {
    const config = DIFFICULTY_CONFIG.tutorial;
    set({
      status: 'countdown',
      difficulty: 'tutorial',
      distance: 0,
      elapsedTime: 0,
      perfectCount: 0,
      coinCount: 0,
      potionCount: 0,
      feverCount: 0,
      consecutiveCoins: 0,
      isFeverMode: false,
      playerLane: 0,
      playerAction: 'running',
      playerY: 0,
      speed: BASE_SPEED,
      baseSpeed: BASE_SPEED,
      energy: MAX_ENERGY,
      energyDrainRate: config.energyDrainRate,
      potionEnergyBonus: config.potionEnergyBonus,
      obstacleSpawnRate: config.obstacleSpawnRate,
    });

    // Countdown: 3, 2, 1, GO!
    setTimeout(() => {
      set({ status: 'playing' });
    }, 3000);
  },

  reset: () =>
    set({
      status: 'menu',
      difficulty: 'tutorial',
      playerLane: 0,
      playerAction: 'running',
      playerY: 0,
      energy: MAX_ENERGY,
      isFeverMode: false,
      isCrashing: false,
      crashTime: 0,
      isExhausted: false,
      exhaustionTime: 0,
      consecutiveCoins: 0,
      distance: 0,
      elapsedTime: 0,
      perfectCount: 0,
      coinCount: 0,
      potionCount: 0,
      feverCount: 0,
      speed: BASE_SPEED,
      baseSpeed: BASE_SPEED,
    }),
}));

// Export difficulty config for ObstacleManager
export { DIFFICULTY_CONFIG, getDifficultyLevel };

// Individual selector hooks for performance
export const useGameStatus = () => useGameStore((state) => state.status);
export const useDifficulty = () => useGameStore((state) => state.difficulty);
