'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, DifficultyLevel, PotionSize } from '../hooks/useGameStore';

// ============================================
// Constants
// ============================================
const LANE_WIDTH = 2.5;
const LANE_POSITIONS = [-LANE_WIDTH, 0, LANE_WIDTH];
const PLAYER_Z = 0; // Player is at z=0

// Visibility ranges
const OBSTACLE_SPAWN_Z = -160;
const OBSTACLE_REMOVE_Z = 15;
const COLLECTION_DISTANCE = 1.5;

// Moving obstacle settings
const MOVING_OBSTACLE_MIN_SPEED = 2.5;
const MOVING_OBSTACLE_MAX_SPEED = 4.5;

// Difficulty thresholds
const HURDLE_SPAWN_THRESHOLD = 45;
const MIXED_SPAWN_THRESHOLD = 60;
const ADVANCED_SPAWN_THRESHOLD = 90;
const MOVING_OBSTACLE_DISTANCE = 1500;

// Safe start distance (no obstacles before this)
const SAFE_START_DISTANCE = 50;

// ============================================
// Data Types
// ============================================
type ObstacleType = 'low' | 'high' | 'side-center' | 'moving';

interface ObstacleData {
  id: number;
  type: ObstacleType;
  lane: -1 | 0 | 1;
  spawnDistance: number;
  passed: boolean;
  // Moving obstacle properties
  isMoving?: boolean;
  moveDirection?: 1 | -1;
  moveSpeed?: number;
  currentX?: number;
}

interface CoinData {
  id: number;
  lane: -1 | 0 | 1;
  spawnDistance: number;
  collected: boolean;
}

interface PotionData {
  id: number;
  lane: -1 | 0 | 1;
  spawnDistance: number;
  size: PotionSize;
  collected: boolean;
}

// ============================================
// Pattern Generation (matching Neon Runner)
// ============================================
type ObstaclePattern =
  | 'single' | 'double' | 'jump_all' | 'hurdle_all'
  | 'normal2_jump1' | 'normal2_hurdle1' | 'advanced_mixed' | 'moving_single';

function selectPattern(elapsedTime: number, distance: number): ObstaclePattern {
  const rand = Math.random();

  let movingChance = 0;
  if (distance >= 2000) {
    movingChance = 0.3;
  } else if (distance >= MOVING_OBSTACLE_DISTANCE) {
    movingChance = 0.1 + ((distance - 1500) / 500) * 0.2;
  }

  if (movingChance > 0 && Math.random() < movingChance) {
    return 'moving_single';
  }

  const canSpawnHurdle = elapsedTime >= HURDLE_SPAWN_THRESHOLD;
  const canSpawnMixed = elapsedTime >= MIXED_SPAWN_THRESHOLD;
  const canSpawnAdvanced = elapsedTime >= ADVANCED_SPAWN_THRESHOLD;

  if (canSpawnAdvanced && rand < 0.15) return 'advanced_mixed';
  if (canSpawnMixed && rand < 0.25) return Math.random() < 0.5 ? 'normal2_jump1' : 'normal2_hurdle1';
  if (rand < 0.40) return 'single';
  if (rand < 0.65) return 'double';
  if (rand < 0.80) return 'jump_all';
  if (canSpawnHurdle) return 'hurdle_all';
  return 'jump_all';
}

function generatePatternObstacles(
  pattern: ObstaclePattern,
  distance: number,
  idCounter: { current: number }
): ObstacleData[] {
  const obstacles: ObstacleData[] = [];
  const lanes: (-1 | 0 | 1)[] = [-1, 0, 1];
  const shuffledLanes = [...lanes].sort(() => Math.random() - 0.5) as (-1 | 0 | 1)[];

  const createObs = (type: ObstacleType, lane: -1 | 0 | 1): ObstacleData => {
    const obs: ObstacleData = {
      id: idCounter.current++,
      type,
      lane,
      spawnDistance: distance,
      passed: false,
    };
    if (type === 'moving') {
      obs.isMoving = true;
      obs.moveDirection = Math.random() > 0.5 ? 1 : -1;
      obs.moveSpeed = MOVING_OBSTACLE_MIN_SPEED + Math.random() * (MOVING_OBSTACLE_MAX_SPEED - MOVING_OBSTACLE_MIN_SPEED);
      obs.currentX = lane * LANE_WIDTH;
    }
    return obs;
  };

  switch (pattern) {
    case 'single':
      obstacles.push(createObs('side-center', lanes[Math.floor(Math.random() * 3)]));
      break;
    case 'double': {
      const freeLane = Math.floor(Math.random() * 3);
      lanes.forEach((lane, i) => { if (i !== freeLane) obstacles.push(createObs('side-center', lane)); });
      break;
    }
    case 'jump_all':
      lanes.forEach(lane => obstacles.push(createObs('low', lane)));
      break;
    case 'hurdle_all':
      lanes.forEach(lane => obstacles.push(createObs('high', lane)));
      break;
    case 'normal2_jump1': {
      const jumpLane = shuffledLanes[0];
      lanes.forEach(lane => obstacles.push(createObs(lane === jumpLane ? 'low' : 'side-center', lane)));
      break;
    }
    case 'normal2_hurdle1': {
      const hurdleLane = shuffledLanes[0];
      lanes.forEach(lane => obstacles.push(createObs(lane === hurdleLane ? 'high' : 'side-center', lane)));
      break;
    }
    case 'advanced_mixed': {
      const types: ObstacleType[] = ['side-center', 'low', 'high'];
      const shuffledTypes = types.sort(() => Math.random() - 0.5);
      lanes.forEach((lane, i) => obstacles.push(createObs(shuffledTypes[i], lane)));
      break;
    }
    case 'moving_single':
      obstacles.push(createObs('moving', lanes[Math.floor(Math.random() * 3)]));
      break;
  }
  return obstacles;
}

function generateObstacles(
  startDistance: number,
  difficulty: DifficultyLevel,
  spawnRate: number,
  elapsedTime: number,
  idCounter: { current: number }
): ObstacleData[] {
  const obstacles: ObstacleData[] = [];
  const segmentLength = 100;
  const baseInterval = difficulty === 'tutorial' ? 18 : difficulty === 'easy' ? 14 :
                       difficulty === 'medium' ? 11 : difficulty === 'hard' ? 9 : 7;

  let currentDistance = startDistance + 8 + Math.random() * 4;

  while (currentDistance < startDistance + segmentLength) {
    const pattern = selectPattern(elapsedTime, currentDistance);
    obstacles.push(...generatePatternObstacles(pattern, currentDistance, idCounter));
    currentDistance += baseInterval + Math.random() * 10 * (1 - spawnRate);
  }
  return obstacles;
}

function generateCoins(startDistance: number, difficulty: DifficultyLevel, idCounter: { current: number }): CoinData[] {
  const coins: CoinData[] = [];
  const segmentLength = 100;
  const coinInterval = difficulty === 'tutorial' ? 16 : difficulty === 'easy' ? 14 :
                       difficulty === 'medium' ? 12 : difficulty === 'hard' ? 10 : 9;

  let currentDistance = startDistance + 5 + Math.random() * 3;

  while (currentDistance < startDistance + segmentLength) {
    currentDistance += coinInterval + Math.random() * 8;
    if (currentDistance >= startDistance + segmentLength) break;
    if (Math.random() < 0.5) {
      coins.push({
        id: idCounter.current++,
        lane: [0, -1, 1][Math.floor(Math.random() * 3)] as -1 | 0 | 1,
        spawnDistance: currentDistance,
        collected: false,
      });
    }
  }

  // Coin trail (30% chance)
  if (Math.random() > 0.7) {
    const trailStart = startDistance + 40 + Math.random() * 40;
    const trailLane = [0, -1, 1][Math.floor(Math.random() * 3)] as -1 | 0 | 1;
    for (let i = 0; i < 5; i++) {
      coins.push({
        id: idCounter.current++,
        lane: trailLane,
        spawnDistance: trailStart + i * 3,
        collected: false,
      });
    }
  }
  return coins;
}

function getRandomPotionSize(): PotionSize {
  const rand = Math.random();
  if (rand < 0.6) return 'small';
  if (rand < 0.9) return 'normal';
  return 'large';
}

function generatePotions(
  startDistance: number,
  difficulty: DifficultyLevel,
  obstacles: ObstacleData[],
  idCounter: { current: number }
): PotionData[] {
  const potions: PotionData[] = [];
  const segmentLength = 100;
  const potionChance = difficulty === 'tutorial' ? 0.9 : difficulty === 'easy' ? 0.8 :
                       difficulty === 'medium' ? 0.7 : difficulty === 'hard' ? 0.6 : 0.5;
  const minInterval = difficulty === 'tutorial' ? 20 : difficulty === 'easy' ? 25 :
                      difficulty === 'medium' ? 30 : difficulty === 'hard' ? 35 : 40;

  const potionCount = Math.random() < potionChance ? (Math.random() < 0.3 ? 3 : Math.random() < 0.6 ? 2 : 1) : 0;

  for (let i = 0; i < potionCount; i++) {
    const potionDistance = startDistance + minInterval + Math.random() * (segmentLength - minInterval - 10);
    const lane = [0, -1, 1][Math.floor(Math.random() * 3)] as -1 | 0 | 1;
    const tooClose = obstacles.some(obs => Math.abs(obs.spawnDistance - potionDistance) < 5 && obs.lane === lane);
    if (!tooClose) {
      potions.push({
        id: idCounter.current++,
        lane,
        spawnDistance: potionDistance,
        size: getRandomPotionSize(),
        collected: false,
      });
    }
  }
  return potions;
}

// ============================================
// Main Component - Lucky Day Pattern
// ============================================
export function ObstacleManager() {
  const status = useGameStore((state) => state.status);
  const groupRef = useRef<THREE.Group>(null);

  // Data refs (no React state - no re-renders)
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const coinsRef = useRef<CoinData[]>([]);
  const potionsRef = useRef<PotionData[]>([]);

  // Mesh refs (Map for O(1) lookup)
  const obstacleMeshesRef = useRef<Map<number, THREE.Group>>(new Map());
  const coinMeshesRef = useRef<Map<number, THREE.Group>>(new Map());
  const potionMeshesRef = useRef<Map<number, THREE.Group>>(new Map());

  // Generation tracking
  const lastGeneratedDistanceRef = useRef(0);
  const idCounterRef = useRef({ current: 1 });

  // ============================================
  // Shared Resources (created once, disposed on unmount)
  // Using shared geometries/materials is memory-efficient:
  // - Created once via useMemo
  // - Reused by all meshes (no per-mesh allocation)
  // - Only disposed when component unmounts
  // ============================================

  // Shared geometries (created once)
  const geometries = useMemo(() => ({
    // Obstacles
    sideCenter: new THREE.BoxGeometry(2.2, 1.8, 0.5),
    sideCenterGlow: new THREE.BoxGeometry(2.35, 1.95, 0.65),
    low: new THREE.BoxGeometry(2.2, 0.6, 0.5),
    lowGlow: new THREE.BoxGeometry(2.35, 0.75, 0.65),
    hurdleBar: new THREE.BoxGeometry(2.4, 0.3, 0.15),
    hurdleBarGlow: new THREE.BoxGeometry(2.55, 0.45, 0.3),
    hurdlePole: new THREE.BoxGeometry(0.12, 1.8, 0.12),
    moving: new THREE.BoxGeometry(2.2, 1.2, 0.5),
    movingGlow: new THREE.BoxGeometry(2.35, 1.35, 0.65),
    // Warning planes
    warningPlane: new THREE.PlaneGeometry(2.7, 2.5),
    warningStripe: new THREE.PlaneGeometry(1.9, 0.08),
    // Coins
    coin: new THREE.CylinderGeometry(0.3, 0.3, 0.06, 20),
    // Potions
    potionBody: new THREE.CapsuleGeometry(0.2, 0.3, 8, 16),
    potionNeck: new THREE.CylinderGeometry(0.08, 0.12, 0.15, 8),
    potionCross: new THREE.BoxGeometry(0.25, 0.08, 0.02),
    potionCrossV: new THREE.BoxGeometry(0.08, 0.25, 0.02),
    potionRing: new THREE.TorusGeometry(0.35, 0.03, 8, 16),
  }), []);

  // Shared materials (created once)
  const materials = useMemo(() => ({
    // Obstacle colors
    sideCenter: new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.4, metalness: 0.4, roughness: 0.5 }),
    sideCenterGlow: new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.3 }),
    low: new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff3333, emissiveIntensity: 0.4, metalness: 0.4, roughness: 0.5 }),
    lowGlow: new THREE.MeshBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.3 }),
    high: new THREE.MeshStandardMaterial({ color: 0x3366ff, emissive: 0x3366ff, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.4 }),
    highGlow: new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: 0.3 }),
    hurdlePole: new THREE.MeshStandardMaterial({ color: 0x1a1a2a, metalness: 0.6, roughness: 0.4 }),
    moving: new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 }),
    movingGlow: new THREE.MeshBasicMaterial({ color: 0xff66ff, transparent: true, opacity: 0.4 }),
    // Warnings
    warningJump: new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff4444, emissiveIntensity: 0.3, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    warningSlide: new THREE.MeshStandardMaterial({ color: 0x4488ff, emissive: 0x4488ff, emissiveIntensity: 0.3, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    warningAvoid: new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.3, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    warningStripe: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }),
    // Coins
    coin: new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0xffdd00, emissiveIntensity: 0.6, metalness: 0.95, roughness: 0.05 }),
    // Potions
    potionSmall: new THREE.MeshStandardMaterial({ color: 0xff66aa, emissive: 0xff66aa, emissiveIntensity: 0.8, transparent: true, opacity: 0.8, metalness: 0.2, roughness: 0.3 }),
    potionNormal: new THREE.MeshStandardMaterial({ color: 0xff44cc, emissive: 0xff44cc, emissiveIntensity: 1.0, transparent: true, opacity: 0.8, metalness: 0.2, roughness: 0.3 }),
    potionLarge: new THREE.MeshStandardMaterial({ color: 0xff22ff, emissive: 0xff22ff, emissiveIntensity: 1.4, transparent: true, opacity: 0.8, metalness: 0.2, roughness: 0.3 }),
    potionCap: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff66aa, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.3 }),
    potionCross: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 }),
  }), []);

  // Create obstacle mesh
  const createObstacleMesh = (obs: ObstacleData): THREE.Group => {
    const group = new THREE.Group();
    const x = obs.isMoving ? obs.currentX! : obs.lane * LANE_WIDTH;

    if (obs.type === 'high') {
      // Hurdle style
      const bar = new THREE.Mesh(geometries.hurdleBar, materials.high);
      bar.position.set(0, 1.8, 0);
      group.add(bar);

      const barGlow = new THREE.Mesh(geometries.hurdleBarGlow, materials.highGlow);
      barGlow.position.set(0, 1.8, 0);
      group.add(barGlow);

      // Poles
      [-1.0, 1.0].forEach(xOff => {
        const pole = new THREE.Mesh(geometries.hurdlePole, materials.hurdlePole);
        pole.position.set(xOff, 0.9, 0);
        group.add(pole);
      });

      // Warning
      const warning = new THREE.Mesh(geometries.warningPlane, materials.warningSlide);
      warning.rotation.x = -Math.PI / 2;
      warning.position.set(0, 0.01, 1.5);
      group.add(warning);
    } else if (obs.type === 'low') {
      const body = new THREE.Mesh(geometries.low, materials.low);
      body.position.set(0, 0.3, 0);
      group.add(body);

      const glow = new THREE.Mesh(geometries.lowGlow, materials.lowGlow);
      glow.position.set(0, 0.3, 0);
      group.add(glow);

      const warning = new THREE.Mesh(geometries.warningPlane, materials.warningJump);
      warning.rotation.x = -Math.PI / 2;
      warning.position.set(0, 0.01, 1.5);
      group.add(warning);
    } else if (obs.type === 'moving') {
      const body = new THREE.Mesh(geometries.moving, materials.moving);
      body.position.set(0, 0.6, 0);
      group.add(body);

      const glow = new THREE.Mesh(geometries.movingGlow, materials.movingGlow);
      glow.position.set(0, 0.6, 0);
      group.add(glow);
    } else {
      // side-center
      const body = new THREE.Mesh(geometries.sideCenter, materials.sideCenter);
      body.position.set(0, 0.9, 0);
      group.add(body);

      const glow = new THREE.Mesh(geometries.sideCenterGlow, materials.sideCenterGlow);
      glow.position.set(0, 0.9, 0);
      group.add(glow);

      const warning = new THREE.Mesh(geometries.warningPlane, materials.warningAvoid);
      warning.rotation.x = -Math.PI / 2;
      warning.position.set(0, 0.01, 1.5);
      group.add(warning);
    }

    group.position.set(x, 0, 0);
    return group;
  };

  // Create coin mesh
  const createCoinMesh = (): THREE.Group => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometries.coin, materials.coin);
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
    return group;
  };

  // Create potion mesh
  const createPotionMesh = (size: PotionSize): THREE.Group => {
    const group = new THREE.Group();
    const scale = size === 'small' ? 0.6 : size === 'normal' ? 1.0 : 1.4;
    const mat = size === 'small' ? materials.potionSmall : size === 'normal' ? materials.potionNormal : materials.potionLarge;

    const body = new THREE.Mesh(geometries.potionBody, mat);
    group.add(body);

    const neck = new THREE.Mesh(geometries.potionNeck, materials.potionCap);
    neck.position.y = 0.35;
    group.add(neck);

    const crossH = new THREE.Mesh(geometries.potionCross, materials.potionCross);
    crossH.position.z = 0.22;
    group.add(crossH);

    const crossV = new THREE.Mesh(geometries.potionCrossV, materials.potionCross);
    crossV.position.z = 0.22;
    group.add(crossV);

    const ring = new THREE.Mesh(geometries.potionRing, mat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    group.scale.set(scale, scale, scale);
    return group;
  };

  // Helper to dispose mesh group children (for cleanup)
  const disposeMeshGroup = (group: THREE.Group) => {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Note: We don't dispose geometry/material here as they're shared
        // Just remove references to help GC
        child.geometry = null!;
        child.material = null!;
      }
    });
  };

  // Cleanup shared resources on unmount
  useEffect(() => {
    return () => {
      // Dispose all geometries
      Object.values(geometries).forEach((geo) => {
        if (geo && typeof geo.dispose === 'function') {
          geo.dispose();
        }
      });

      // Dispose all materials
      Object.values(materials).forEach((mat) => {
        if (mat && typeof mat.dispose === 'function') {
          mat.dispose();
        }
      });

      // Clear all mesh groups
      if (groupRef.current) {
        obstacleMeshesRef.current.forEach((mesh) => {
          disposeMeshGroup(mesh);
          groupRef.current?.remove(mesh);
        });
        coinMeshesRef.current.forEach((mesh) => {
          disposeMeshGroup(mesh);
          groupRef.current?.remove(mesh);
        });
        potionMeshesRef.current.forEach((mesh) => {
          disposeMeshGroup(mesh);
          groupRef.current?.remove(mesh);
        });
      }

      obstacleMeshesRef.current.clear();
      coinMeshesRef.current.clear();
      potionMeshesRef.current.clear();
    };
  }, [geometries, materials]);

  // Reset on countdown
  useEffect(() => {
    if (status === 'countdown' && groupRef.current) {
      // Clear all meshes with proper cleanup
      obstacleMeshesRef.current.forEach((mesh) => {
        disposeMeshGroup(mesh);
        groupRef.current!.remove(mesh);
      });
      coinMeshesRef.current.forEach((mesh) => {
        disposeMeshGroup(mesh);
        groupRef.current!.remove(mesh);
      });
      potionMeshesRef.current.forEach((mesh) => {
        disposeMeshGroup(mesh);
        groupRef.current!.remove(mesh);
      });

      obstacleMeshesRef.current.clear();
      coinMeshesRef.current.clear();
      potionMeshesRef.current.clear();

      obstaclesRef.current = [];
      coinsRef.current = [];
      potionsRef.current = [];

      idCounterRef.current = { current: 1 };
      lastGeneratedDistanceRef.current = 0;

      // Generate initial content
      for (let d = SAFE_START_DISTANCE; d < SAFE_START_DISTANCE + 300; d += 100) {
        const segmentDifficulty: DifficultyLevel = d < SAFE_START_DISTANCE + 200 ? 'tutorial' : 'easy';
        const segmentObs = generateObstacles(d, segmentDifficulty, 0.4, 0, idCounterRef.current);
        obstaclesRef.current.push(...segmentObs);
        coinsRef.current.push(...generateCoins(d, segmentDifficulty, idCounterRef.current));
        potionsRef.current.push(...generatePotions(d, segmentDifficulty, segmentObs, idCounterRef.current));
      }
      lastGeneratedDistanceRef.current = SAFE_START_DISTANCE + 300;
    }
  }, [status]);

  // Main game loop - single useFrame for everything
  useFrame((state, delta) => {
    if (status !== 'playing' || !groupRef.current) return;

    // Get fresh state
    const store = useGameStore.getState();
    store.updateGame(delta);

    const { distance, playerLane, playerAction, isFeverMode, difficulty, elapsedTime, isCrashing } = store;

    // === GENERATE NEW CONTENT ===
    const generateAhead = 150;
    if (distance + generateAhead > lastGeneratedDistanceRef.current) {
      const startDist = lastGeneratedDistanceRef.current;
      const spawnRate = Math.min(0.8, 0.4 + (elapsedTime / 120) * 0.4);

      const newObs = generateObstacles(startDist, difficulty, spawnRate, elapsedTime, idCounterRef.current);
      obstaclesRef.current.push(...newObs);
      coinsRef.current.push(...generateCoins(startDist, difficulty, idCounterRef.current));
      potionsRef.current.push(...generatePotions(startDist, difficulty, newObs, idCounterRef.current));

      lastGeneratedDistanceRef.current = startDist + 100;
    }

    // === UPDATE OBSTACLES ===
    const playerX = playerLane * LANE_WIDTH;
    const playerY = store.playerY;

    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
      const obs = obstaclesRef.current[i];
      const relativeZ = obs.spawnDistance - distance;

      // Create mesh if needed
      if (!obstacleMeshesRef.current.has(obs.id) && relativeZ < 160 && relativeZ > -20) {
        const mesh = createObstacleMesh(obs);
        mesh.position.z = -relativeZ;
        groupRef.current.add(mesh);
        obstacleMeshesRef.current.set(obs.id, mesh);
      }

      const mesh = obstacleMeshesRef.current.get(obs.id);
      if (mesh) {
        // Update position
        mesh.position.z = -relativeZ;

        // Moving obstacle
        if (obs.isMoving && obs.currentX !== undefined && obs.moveDirection && obs.moveSpeed) {
          obs.currentX += obs.moveDirection * obs.moveSpeed * delta;
          const leftBound = LANE_POSITIONS[0] - 0.5;
          const rightBound = LANE_POSITIONS[2] + 0.5;
          if (obs.currentX <= leftBound) { obs.currentX = leftBound; obs.moveDirection = 1; }
          else if (obs.currentX >= rightBound) { obs.currentX = rightBound; obs.moveDirection = -1; }
          mesh.position.x = obs.currentX;
        }

        // Visibility
        mesh.visible = relativeZ <= 160 && relativeZ >= -15;

        // Collision detection
        if (!obs.passed && !isFeverMode && !isCrashing && mesh.visible) {
          const obsX = obs.isMoving ? obs.currentX! : obs.lane * LANE_WIDTH;
          const xDist = Math.abs(playerX - obsX);
          const zDist = Math.abs(relativeZ);

          if (xDist < 1.2 && zDist < COLLECTION_DISTANCE) {
            let avoided = false;
            if (obs.type === 'low' && playerAction === 'jumping') avoided = true;
            else if (obs.type === 'high' && playerAction === 'sliding') avoided = true;
            else if (obs.type === 'side-center' || obs.type === 'moving') avoided = false;

            if (!avoided) {
              store.triggerCrash();
            }
          }
        }

        // Mark as passed
        if (relativeZ < -2 && !obs.passed) {
          obs.passed = true;
          store.addPerfect();
        }

        // Remove if too far behind
        if (relativeZ < -OBSTACLE_REMOVE_Z) {
          disposeMeshGroup(mesh);
          groupRef.current.remove(mesh);
          obstacleMeshesRef.current.delete(obs.id);
          obstaclesRef.current.splice(i, 1);
        }
      }
    }

    // === UPDATE COINS ===
    for (let i = coinsRef.current.length - 1; i >= 0; i--) {
      const coin = coinsRef.current[i];
      if (coin.collected) continue;

      const relativeZ = coin.spawnDistance - distance;

      // Create mesh if needed
      if (!coinMeshesRef.current.has(coin.id) && relativeZ < 160 && relativeZ > -20) {
        const mesh = createCoinMesh();
        mesh.position.set(coin.lane * LANE_WIDTH, 1.0, -relativeZ);
        groupRef.current.add(mesh);
        coinMeshesRef.current.set(coin.id, mesh);
      }

      const mesh = coinMeshesRef.current.get(coin.id);
      if (mesh) {
        mesh.position.z = -relativeZ;
        mesh.visible = relativeZ <= 160 && relativeZ >= -15;

        // Collection check
        if (mesh.visible && !isCrashing) {
          const zDist = Math.abs(relativeZ);
          if (zDist < COLLECTION_DISTANCE && coin.lane === playerLane) {
            coin.collected = true;
            store.collectCoin();
            disposeMeshGroup(mesh);
            groupRef.current.remove(mesh);
            coinMeshesRef.current.delete(coin.id);
          }
        }

        // Remove if too far behind
        if (relativeZ < -OBSTACLE_REMOVE_Z) {
          disposeMeshGroup(mesh);
          groupRef.current.remove(mesh);
          coinMeshesRef.current.delete(coin.id);
          coinsRef.current.splice(i, 1);
        }
      }
    }

    // === UPDATE POTIONS ===
    for (let i = potionsRef.current.length - 1; i >= 0; i--) {
      const potion = potionsRef.current[i];
      if (potion.collected) continue;

      const relativeZ = potion.spawnDistance - distance;

      // Create mesh if needed
      if (!potionMeshesRef.current.has(potion.id) && relativeZ < 160 && relativeZ > -20) {
        const mesh = createPotionMesh(potion.size);
        mesh.position.set(potion.lane * LANE_WIDTH, 1.5, -relativeZ);
        groupRef.current.add(mesh);
        potionMeshesRef.current.set(potion.id, mesh);
      }

      const mesh = potionMeshesRef.current.get(potion.id);
      if (mesh) {
        mesh.position.z = -relativeZ;
        // Floating effect (no rotation)
        mesh.position.y = 1.5 + Math.sin(state.clock.elapsedTime * 3 + potion.id) * 0.15;
        mesh.visible = relativeZ <= 160 && relativeZ >= -15;

        // Collection check
        if (mesh.visible && !isCrashing) {
          const zDist = Math.abs(relativeZ);
          if (zDist < COLLECTION_DISTANCE && potion.lane === playerLane) {
            potion.collected = true;
            store.collectPotion(potion.size);
            disposeMeshGroup(mesh);
            groupRef.current.remove(mesh);
            potionMeshesRef.current.delete(potion.id);
          }
        }

        // Remove if too far behind
        if (relativeZ < -OBSTACLE_REMOVE_Z) {
          disposeMeshGroup(mesh);
          groupRef.current.remove(mesh);
          potionMeshesRef.current.delete(potion.id);
          potionsRef.current.splice(i, 1);
        }
      }
    }
  });

  return <group ref={groupRef} />;
}
