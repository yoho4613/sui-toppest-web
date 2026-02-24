/**
 * Cosmic Flap Game Constants
 *
 * Physics and gameplay constants for the Flappy Bird-style space game.
 * These values are tuned for balance and anti-cheat validation.
 */

export const GAME_TYPE = 'cosmic-flap';

// ============================================
// Physics Constants
// ============================================
export const PHYSICS = {
  GRAVITY: -15,                    // Gravity acceleration in units/sec² (negative = down)
  FLAP_VELOCITY: 6,               // Upward velocity on flap in units/sec (positive = up)
  MAX_FALL_VELOCITY: 8,            // Terminal fall speed in units/sec (absolute)
  PLAYER_SIZE: { width: 0.8, height: 0.6 },
  PLAYER_X: -3,                    // Fixed X position of player
};

// ============================================
// World Bounds
// ============================================
export const WORLD = {
  HEIGHT: 10,                      // Total world height (-5 to +5)
  MIN_Y: -4.5,                     // Floor
  MAX_Y: 4.5,                      // Ceiling
};

// ============================================
// Difficulty Progression
// ============================================
export const DIFFICULTY = {
  // Speed
  INITIAL_SPEED: 4,                // Initial obstacle speed
  MAX_SPEED: 8,                    // Maximum obstacle speed
  SPEED_INCREASE_RATE: 0.015,      // Speed increase per second

  // Gap size
  INITIAL_GAP: 3.5,                // Initial gap between pipes
  MIN_GAP: 2.2,                    // Minimum gap (hardest)
  GAP_DECREASE_RATE: 0.008,        // Gap decrease per second

  // Spawn timing
  INITIAL_SPAWN_DISTANCE: 8,       // Initial distance between obstacles
  MIN_SPAWN_DISTANCE: 5,           // Minimum distance between obstacles
  SPAWN_DECREASE_RATE: 0.005,      // Spawn distance decrease per second

  // Difficulty ramp
  RAMP_UP_SECONDS: 30,             // Seconds to reach max difficulty
};

// ============================================
// Obstacle Thresholds (distance-based)
// ============================================
export const OBSTACLE_THRESHOLDS = {
  PIPE: 0,                         // Basic pipes from start
  TUNNEL: 500,                     // Tunnels appear at 500m
  UFO: 1000,                       // UFOs appear at 1000m
  LONG_TUNNEL: 1500,               // Long tunnels at 1500m
  DUAL_UFO: 2000,                  // Dual UFOs at 2000m
  EXTREME_TUNNEL: 2500,            // Extreme tunnels at 2500m
};

// ============================================
// Obstacle Spawn Probabilities
// ============================================
export const OBSTACLE_SPAWN = {
  PIPE: 0.60,                      // 60% basic pipe
  TUNNEL: 0.15,                    // 15% tunnel (after threshold)
  UFO: 0.25,                       // 25% UFO (after threshold)
};

// ============================================
// Item Spawn Configuration
// ============================================
export const ITEM_SPAWN = {
  CHANCE: 0.15,                    // 15% chance per gap
  SLOW: 0.25,                      // 25% of items are slow
  SHIELD: 0.20,                    // 20% of items are shield
  COIN: 0.55,                      // 55% of items are coins
};

// ============================================
// Item Effects
// ============================================
export const ITEM_EFFECTS = {
  SLOW_HOLD_DURATION: 5000,        // 5초간 초기 속도로 하향
  SLOW_RECOVERY_DURATION: 10000,   // 이후 10초에 걸쳐 원래 속도로 복귀
  SHIELD_DURATION: 10000,          // 10초간 장애물 방어
  SHIELD_BLINK_AT: 3000,           // 만료 3초 전부터 깜빡임
};

// ============================================
// Scoring & Rewards (matches Dash Trials)
// ============================================
export const SCORING = {
  DISTANCE_MULTIPLIER: 2.5,        // Convert speed to meters/sec (speed 4 → 10m/s)
  COIN_CLUBS: 10,                  // CLUBS per coin (for display)
  TUNNEL_BONUS: 100,               // Bonus CLUBS per tunnel (for display)
};

// ============================================
// Visual Constants
// ============================================
export const VISUALS = {
  // Colors
  PLAYER_COLOR: '#22d3ee',         // Cyan
  PLAYER_EMISSIVE: '#0ea5e9',
  PIPE_COLOR: '#ec4899',           // Pink/Magenta
  PIPE_EMISSIVE: '#f472b6',
  TUNNEL_COLOR: '#8b5cf6',         // Purple
  UFO_COLOR: '#ef4444',            // Red
  SHIELD_COLOR: '#22c55e',         // Green
  SLOW_COLOR: '#3b82f6',           // Blue
  COIN_COLOR: '#fbbf24',           // Gold

  // Sizes
  PIPE_WIDTH: 0.6,
  TUNNEL_SEGMENT_WIDTH: 1.2,
  UFO_SIZE: { width: 1.5, height: 0.8 },
  ITEM_SIZE: 0.5,
  ITEM_COLLECT_RADIUS: 1.0,        // 아이템 수집 판정 반경
};

// ============================================
// Tunnel Configuration
// ============================================
export const TUNNEL = {
  STANDARD_SEGMENTS: 4,
  LONG_SEGMENTS: 6,
  EXTREME_SEGMENTS: 9,
  GAP_SIZE: 2.5,
  GAP_VARIATION: 0.5,
};

// ============================================
// UFO Configuration
// ============================================
export const UFO = {
  MOVE_RANGE: 2,                   // ±2 units vertical movement
  MOVE_SPEED: 3,                   // Movement speed
  ACTIVATION_DISTANCE: 6,          // Activate when player is this close
};

// ============================================
// Audio
// ============================================
export const AUDIO = {
  BGM_VOLUME: 0.3,
  SFX_VOLUME: 0.5,
  FLAP_VOLUME: 0.4,
};
