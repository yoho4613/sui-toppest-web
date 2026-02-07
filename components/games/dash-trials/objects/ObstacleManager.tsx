'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Obstacle, Coin, HealthPotion, ObstacleType, PotionSize } from './Obstacle';
import { useGameStore, DifficultyLevel } from '../hooks/useGameStore';

interface ObstacleData {
  id: string;
  type: ObstacleType;
  lane: -1 | 0 | 1;
  distance: number;
}

interface CoinData {
  id: string;
  lane: -1 | 0 | 1;
  distance: number;
}

interface PotionData {
  id: string;
  lane: -1 | 0 | 1;
  distance: number;
  size: PotionSize;
}

// Get obstacle types available for each difficulty
function getObstacleTypesForDifficulty(difficulty: DifficultyLevel): ObstacleType[] {
  switch (difficulty) {
    case 'tutorial':
      return ['low', 'high'];
    case 'easy':
      return ['low', 'high', 'side-center'];
    case 'medium':
      return ['low', 'high', 'side-center', 'double-lane'];
    case 'hard':
    case 'extreme':
      return ['low', 'high', 'side-center', 'double-lane', 'moving'];
    default:
      return ['low', 'high'];
  }
}

// Helper to check if obstacles at same distance block all lanes
function getBlockedLanes(obstacles: ObstacleData[], distance: number): Set<number> {
  const blocked = new Set<number>();
  obstacles
    .filter(obs => Math.abs(obs.distance - distance) < 2) // Within 2 units
    .forEach(obs => {
      // side-center and double-lane block a lane completely
      if (obs.type === 'side-center' || obs.type === 'double-lane' || obs.type === 'side-left' || obs.type === 'side-right') {
        blocked.add(obs.lane);
      }
    });
  return blocked;
}

// Generate obstacle pattern based on difficulty
function generateObstaclePattern(
  startDistance: number,
  difficulty: DifficultyLevel,
  spawnRate: number
): ObstacleData[] {
  const obstacles: ObstacleData[] = [];
  const types = getObstacleTypesForDifficulty(difficulty);
  const segmentLength = 100;

  const baseInterval = difficulty === 'tutorial' ? 20 :
                       difficulty === 'easy' ? 15 :
                       difficulty === 'medium' ? 12 :
                       difficulty === 'hard' ? 10 : 8;

  let currentDistance = startDistance;
  let id = Date.now() + Math.random() * 10000;

  while (currentDistance < startDistance + segmentLength) {
    const interval = baseInterval + Math.random() * 10 * (1 - spawnRate);
    currentDistance += interval;

    if (currentDistance >= startDistance + segmentLength) break;

    const type = types[Math.floor(Math.random() * types.length)];
    let lane = [0, -1, 1][Math.floor(Math.random() * 3)] as -1 | 0 | 1;

    // For double-lane, only block 2 lanes max, ensure 1 lane is always free
    if (type === 'double-lane') {
      // Pick which lane to leave open
      const openLane = [-1, 0, 1][Math.floor(Math.random() * 3)] as -1 | 0 | 1;
      const blockedLanes = ([-1, 0, 1] as const).filter(l => l !== openLane);

      // Add obstacle to first blocked lane
      obstacles.push({
        id: `obs-${id++}`,
        type: 'side-center',
        lane: blockedLanes[0],
        distance: currentDistance,
      });

      // Add obstacle to second blocked lane
      obstacles.push({
        id: `obs-${id++}`,
        type: 'side-center',
        lane: blockedLanes[1],
        distance: currentDistance,
      });

      continue; // Skip adding more obstacles at this distance
    }

    obstacles.push({
      id: `obs-${id++}`,
      type,
      lane,
      distance: currentDistance,
    });

    // For harder difficulties, sometimes add combo obstacles (but ensure at least 1 lane free)
    if ((difficulty === 'hard' || difficulty === 'extreme') && Math.random() > 0.7) {
      const blockedLanes = getBlockedLanes(obstacles, currentDistance + 3);

      // Only add combo if it won't block all lanes
      if (blockedLanes.size < 2) {
        const comboType = type === 'low' ? 'high' : 'low';
        // Pick a lane that's not already blocked
        const availableLanes = ([-1, 0, 1] as const).filter(l => !blockedLanes.has(l) && l !== lane);
        if (availableLanes.length > 0) {
          const comboLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
          obstacles.push({
            id: `obs-${id++}`,
            type: comboType,
            lane: comboLane,
            distance: currentDistance + 3,
          });
        }
      }
    }
  }

  return obstacles;
}

// Generate coins for a segment (for fever mode trigger) - reduced frequency
function generateCoins(startDistance: number, difficulty: DifficultyLevel): CoinData[] {
  const coins: CoinData[] = [];
  const segmentLength = 100;

  // Increased intervals for less frequent coins
  const coinInterval = difficulty === 'tutorial' ? 18 :
                       difficulty === 'easy' ? 15 :
                       difficulty === 'medium' ? 13 :
                       difficulty === 'hard' ? 11 : 10;

  let currentDistance = startDistance + 10;
  let id = Date.now() + Math.random() * 10000;

  while (currentDistance < startDistance + segmentLength) {
    const interval = coinInterval + Math.random() * 8;
    currentDistance += interval;

    if (currentDistance >= startDistance + segmentLength) break;

    // Reduced spawn chance from 0.7 to 0.5
    if (Math.random() < 0.5) {
      coins.push({
        id: `coin-${id++}`,
        lane: [0, -1, 1][Math.floor(Math.random() * 3)] as -1 | 0 | 1,
        distance: currentDistance,
      });
    }
  }

  // Coin trails less frequent (30% chance instead of 50%)
  if (Math.random() > 0.7) {
    const trailStart = startDistance + 40 + Math.random() * 40;
    const trailLane = [0, -1, 1][Math.floor(Math.random() * 3)] as -1 | 0 | 1;
    const trailLength = 5; // 5 coins for immediate fever

    for (let i = 0; i < trailLength; i++) {
      coins.push({
        id: `coin-trail-${id++}-${i}`,
        lane: trailLane,
        distance: trailStart + i * 3,
      });
    }
  }

  return coins;
}

// Determine potion size based on probability
// Small: 60%, Normal: 30%, Large: 10%
function getRandomPotionSize(): PotionSize {
  const rand = Math.random();
  if (rand < 0.6) return 'small';
  if (rand < 0.9) return 'normal';
  return 'large';
}

// Generate health potions for a segment (tiered by size)
function generatePotions(
  startDistance: number,
  difficulty: DifficultyLevel,
  obstacles: ObstacleData[]
): PotionData[] {
  const potions: PotionData[] = [];
  const segmentLength = 100;

  // More potions spawn now (since small ones give less energy)
  const potionChance = difficulty === 'tutorial' ? 0.9 :
                       difficulty === 'easy' ? 0.8 :
                       difficulty === 'medium' ? 0.7 :
                       difficulty === 'hard' ? 0.6 : 0.5;

  const minInterval = difficulty === 'tutorial' ? 20 :
                      difficulty === 'easy' ? 25 :
                      difficulty === 'medium' ? 30 :
                      difficulty === 'hard' ? 35 : 40;

  let id = Date.now() + Math.random() * 10000;

  // 1-3 potions per 100m segment
  const potionCount = Math.random() < potionChance ?
    (Math.random() < 0.3 ? 3 : Math.random() < 0.6 ? 2 : 1) : 0;

  for (let i = 0; i < potionCount; i++) {
    const potionDistance = startDistance + minInterval + Math.random() * (segmentLength - minInterval - 10);
    const lane = [0, -1, 1][Math.floor(Math.random() * 3)] as -1 | 0 | 1;

    // Check if potion is too close to an obstacle
    const tooCloseToObstacle = obstacles.some(
      obs => Math.abs(obs.distance - potionDistance) < 5 && obs.lane === lane
    );

    if (!tooCloseToObstacle) {
      potions.push({
        id: `potion-${id++}`,
        lane,
        distance: potionDistance,
        size: getRandomPotionSize(),
      });
    }
  }

  return potions;
}

export function ObstacleManager() {
  const distance = useGameStore((state) => state.distance);
  const difficulty = useGameStore((state) => state.difficulty);
  const obstacleSpawnRate = useGameStore((state) => state.obstacleSpawnRate);
  const status = useGameStore((state) => state.status);

  const [obstacles, setObstacles] = useState<ObstacleData[]>([]);
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [potions, setPotions] = useState<PotionData[]>([]);
  const lastGeneratedDistance = useRef(0);
  const collectedCoinsRef = useRef<Set<string>>(new Set());
  const collectedPotionsRef = useRef<Set<string>>(new Set());
  const passedObstaclesRef = useRef<Set<string>>(new Set());

  // Reset and generate initial obstacles when game starts
  useEffect(() => {
    if (status === 'countdown') {
      collectedCoinsRef.current.clear();
      collectedPotionsRef.current.clear();
      passedObstaclesRef.current.clear();
      lastGeneratedDistance.current = 0;

      const initialObstacles: ObstacleData[] = [];
      const initialCoins: CoinData[] = [];
      const initialPotions: PotionData[] = [];

      for (let d = 0; d < 300; d += 100) {
        const segmentDifficulty: DifficultyLevel = d < 200 ? 'tutorial' : 'easy';
        const segmentObstacles = generateObstaclePattern(d, segmentDifficulty, 0.4);
        initialObstacles.push(...segmentObstacles);
        initialCoins.push(...generateCoins(d, segmentDifficulty));
        initialPotions.push(...generatePotions(d, segmentDifficulty, segmentObstacles));
      }

      setObstacles(initialObstacles);
      setCoins(initialCoins);
      setPotions(initialPotions);
      lastGeneratedDistance.current = 300;
    }
  }, [status]);

  // Dynamically generate more obstacles as player progresses
  useEffect(() => {
    if (status !== 'playing') return;

    const generateAheadDistance = 150;

    if (distance + generateAheadDistance > lastGeneratedDistance.current) {
      const newSegmentStart = lastGeneratedDistance.current;

      const newObstacles = generateObstaclePattern(newSegmentStart, difficulty, obstacleSpawnRate);
      const newCoins = generateCoins(newSegmentStart, difficulty);
      const newPotions = generatePotions(newSegmentStart, difficulty, newObstacles);

      setObstacles(prev => {
        const filtered = prev.filter(obs => obs.distance > distance - 30);
        return [...filtered, ...newObstacles];
      });

      setCoins(prev => {
        const filtered = prev.filter(coin => coin.distance > distance - 30);
        return [...filtered, ...newCoins];
      });

      setPotions(prev => {
        const filtered = prev.filter(potion => potion.distance > distance - 30);
        return [...filtered, ...newPotions];
      });

      lastGeneratedDistance.current = newSegmentStart + 100;
    }
  }, [distance, difficulty, obstacleSpawnRate, status]);

  const handleObstaclePassed = useCallback((id: string) => {
    if (!passedObstaclesRef.current.has(id)) {
      passedObstaclesRef.current.add(id);
      useGameStore.getState().addPerfect();
    }
  }, []);

  const handleCollision = useCallback(() => {
    useGameStore.getState().triggerCrash();
  }, []);

  const handleCoinCollect = useCallback((id: string) => {
    if (!collectedCoinsRef.current.has(id)) {
      collectedCoinsRef.current.add(id);
      useGameStore.getState().collectCoin();
    }
  }, []);

  const handlePotionCollect = useCallback((id: string, size: PotionSize) => {
    if (!collectedPotionsRef.current.has(id)) {
      collectedPotionsRef.current.add(id);
      useGameStore.getState().collectPotion(size);
    }
  }, []);

  const visibleObstacles = obstacles.filter(
    obs => obs.distance > distance - 15 && obs.distance < distance + 80
  );
  const visibleCoins = coins.filter(
    coin => coin.distance > distance - 15 && coin.distance < distance + 80 &&
            !collectedCoinsRef.current.has(coin.id)
  );
  const visiblePotions = potions.filter(
    potion => potion.distance > distance - 15 && potion.distance < distance + 80 &&
              !collectedPotionsRef.current.has(potion.id)
  );

  return (
    <group>
      {visibleObstacles.map((obs) => (
        <Obstacle
          key={obs.id}
          type={obs.type}
          lane={obs.lane}
          distance={obs.distance}
          onPassed={() => handleObstaclePassed(obs.id)}
          onCollision={handleCollision}
        />
      ))}
      {visibleCoins.map((coin) => (
        <Coin
          key={coin.id}
          lane={coin.lane}
          distance={coin.distance}
          onCollect={() => handleCoinCollect(coin.id)}
        />
      ))}
      {visiblePotions.map((potion) => (
        <HealthPotion
          key={potion.id}
          lane={potion.lane}
          distance={potion.distance}
          size={potion.size}
          onCollect={() => handlePotionCollect(potion.id, potion.size)}
        />
      ))}
    </group>
  );
}
