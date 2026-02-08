'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';

const LANE_WIDTH = 2.5;

export type ObstacleType = 'low' | 'high' | 'side-left' | 'side-right' | 'side-center' | 'double-lane' | 'moving';

interface ObstacleProps {
  type: ObstacleType;
  lane: -1 | 0 | 1;
  distance: number;
  onPassed: () => void;
  onCollision: () => void;
}

export function Obstacle({ type, lane, distance: spawnDistance, onPassed, onCollision }: ObstacleProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const passedRef = useRef(false);
  const [movingOffset, setMovingOffset] = useState(0);

  const distance = useGameStore((state) => state.distance);
  const playerLane = useGameStore((state) => state.playerLane);
  const playerAction = useGameStore((state) => state.playerAction);
  const isFeverMode = useGameStore((state) => state.isFeverMode);
  const status = useGameStore((state) => state.status);

  const relativeZ = spawnDistance - distance;

  // Obstacle dimensions based on type
  const getDimensions = () => {
    switch (type) {
      case 'low':
        // Jump obstacle - short box on ground
        return { width: 2.2, height: 0.6, depth: 0.5 };
      case 'high':
        // Slide obstacle - hurdle bar floating above ground
        return { width: 2.4, height: 0.3, depth: 0.15 };
      case 'side-left':
      case 'side-right':
        return { width: 2, height: 1.8, depth: 0.5 };
      case 'side-center':
        return { width: 2.2, height: 1.8, depth: 0.5 };
      case 'double-lane':
        return { width: 4.5, height: 1.8, depth: 0.5 };
      case 'moving':
        return { width: 2.2, height: 1.2, depth: 0.5 };
      default:
        return { width: 2, height: 1, depth: 0.5 };
    }
  };

  const { width, height, depth } = getDimensions();
  // High obstacles float like hurdles (player slides under)
  // Low and others are on the ground
  const baseY = type === 'high' ? 1.8 : height / 2;
  const baseX = lane * LANE_WIDTH;

  // Animation for moving obstacles
  useFrame((state) => {
    if (type === 'moving' && status === 'playing') {
      const newOffset = Math.sin(state.clock.elapsedTime * 3) * LANE_WIDTH;
      setMovingOffset(newOffset);
    }
  });

  // Current X position
  const currentX = type === 'moving' ? baseX + movingOffset : baseX;

  // Calculate which lane the moving obstacle is currently in
  const getCurrentLane = (): -1 | 0 | 1 => {
    if (type !== 'moving') return lane;
    const effectiveX = currentX;
    if (effectiveX < -LANE_WIDTH / 2) return -1;
    if (effectiveX > LANE_WIDTH / 2) return 1;
    return 0;
  };

  // Check collision
  useFrame(() => {
    if (status !== 'playing' || isFeverMode) return;

    if (relativeZ < 1.5 && relativeZ > -1.5 && !passedRef.current) {
      const currentObstacleLane = getCurrentLane();
      let isInSameLane = false;

      if (type === 'double-lane') {
        const blockedLanes = [lane];
        if (lane === 0) blockedLanes.push(Math.random() > 0.5 ? -1 : 1);
        else if (lane === -1) blockedLanes.push(0);
        else blockedLanes.push(0);
        isInSameLane = blockedLanes.includes(playerLane);
      } else {
        isInSameLane = currentObstacleLane === playerLane;
      }

      let collision = false;

      if (isInSameLane) {
        if (type === 'low' && playerAction !== 'jumping') {
          collision = true;
        } else if (type === 'high' && playerAction !== 'sliding') {
          collision = true;
        } else if (type === 'side-left' || type === 'side-right' || type === 'side-center' || type === 'double-lane') {
          collision = true;
        } else if (type === 'moving') {
          if (playerAction !== 'jumping') {
            collision = true;
          }
        }
      }

      if (collision) {
        onCollision();
      }
    }

    if (relativeZ < -2 && !passedRef.current) {
      passedRef.current = true;
      onPassed();
    }
  });

  if (relativeZ > 80 || relativeZ < -10) return null;

  // Color and glow based on type
  const getColorConfig = () => {
    switch (type) {
      case 'low':
        return { main: '#ff3333', edge: '#ff6666', emissive: 0.4 };
      case 'high':
        return { main: '#3366ff', edge: '#6699ff', emissive: 0.4 };
      case 'moving':
        return { main: '#ff00ff', edge: '#ff66ff', emissive: 0.6 };
      case 'double-lane':
        return { main: '#ff6600', edge: '#ff9933', emissive: 0.5 };
      default:
        return { main: '#ffaa00', edge: '#ffcc44', emissive: 0.4 };
    }
  };

  const colorConfig = getColorConfig();

  // Warning indicator text
  const getTypeLabel = () => {
    switch (type) {
      case 'low': return 'JUMP';
      case 'high': return 'SLIDE';
      default: return 'AVOID';
    }
  };

  // Render hurdle-style for high obstacles (slide under)
  if (type === 'high') {
    return (
      <group position={[currentX, 0, -relativeZ]}>
        {/* Hurdle bar - floating horizontal bar */}
        <mesh position={[0, baseY, 0]} ref={meshRef} castShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial
            color={colorConfig.main}
            emissive={colorConfig.main}
            emissiveIntensity={colorConfig.emissive}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>

        {/* Left leg */}
        <mesh position={[-width / 2 + 0.1, baseY / 2, 0]} castShadow>
          <boxGeometry args={[0.1, baseY, 0.1]} />
          <meshStandardMaterial
            color={colorConfig.edge}
            emissive={colorConfig.edge}
            emissiveIntensity={0.3}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>

        {/* Right leg */}
        <mesh position={[width / 2 - 0.1, baseY / 2, 0]} castShadow>
          <boxGeometry args={[0.1, baseY, 0.1]} />
          <meshStandardMaterial
            color={colorConfig.edge}
            emissive={colorConfig.edge}
            emissiveIntensity={0.3}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>

        {/* Top glow line */}
        <mesh position={[0, baseY + height / 2 + 0.02, 0]}>
          <boxGeometry args={[width + 0.05, 0.04, depth + 0.05]} />
          <meshStandardMaterial
            color={colorConfig.edge}
            emissive={colorConfig.edge}
            emissiveIntensity={0.8}
          />
        </mesh>
      </group>
    );
  }

  // Regular ground obstacles (low, side-center, double-lane, moving)
  return (
    <group position={[currentX, baseY, -relativeZ]}>
      {/* Main obstacle body */}
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={colorConfig.main}
          emissive={colorConfig.main}
          emissiveIntensity={colorConfig.emissive}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>

      {/* Top edge glow */}
      <mesh position={[0, height / 2 + 0.02, 0]}>
        <boxGeometry args={[width + 0.08, 0.04, depth + 0.08]} />
        <meshStandardMaterial
          color={colorConfig.edge}
          emissive={colorConfig.edge}
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Front edge glow */}
      <mesh position={[0, 0, depth / 2 + 0.02]}>
        <boxGeometry args={[width + 0.05, height, 0.03]} />
        <meshStandardMaterial
          color={colorConfig.edge}
          emissive={colorConfig.edge}
          emissiveIntensity={0.5}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

// Coin component - for fever mode only
interface CoinProps {
  lane: -1 | 0 | 1;
  distance: number;
  onCollect: () => void;
}

export function Coin({ lane, distance: spawnDistance, onCollect }: CoinProps) {
  const groupRef = useRef<THREE.Group>(null);
  const collectedRef = useRef(false);
  const distance = useGameStore((state) => state.distance);
  const playerLane = useGameStore((state) => state.playerLane);
  const status = useGameStore((state) => state.status);
  const consecutiveCoins = useGameStore((state) => state.consecutiveCoins);

  const relativeZ = spawnDistance - distance;
  const x = lane * LANE_WIDTH;

  // Rotation animation - rotate the whole group
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 3;
    }
  });

  // Collection check
  useFrame(() => {
    if (status !== 'playing' || collectedRef.current) return;

    if (relativeZ < 1.5 && relativeZ > -1.5 && lane === playerLane) {
      collectedRef.current = true;
      onCollect();
    }
  });

  if (relativeZ > 80 || relativeZ < -10 || collectedRef.current) return null;

  // Glow more intensely as fever approaches
  const glowIntensity = 0.6 + (consecutiveCoins / 5) * 0.4;

  return (
    <group ref={groupRef} position={[x, 1.0, -relativeZ]}>
      {/* Simple coin - single cylinder */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.06, 20]} />
        <meshStandardMaterial
          color="#ffdd00"
          emissive="#ffdd00"
          emissiveIntensity={glowIntensity}
          metalness={0.95}
          roughness={0.05}
        />
      </mesh>
    </group>
  );
}

// Potion size types
export type PotionSize = 'small' | 'normal' | 'large';

// Potion configuration based on size
const POTION_CONFIG = {
  small: {
    scale: 0.6,
    color: '#66ff99',      // Light green
    glowIntensity: 0.6,
    label: 'S',
  },
  normal: {
    scale: 1.0,
    color: '#00ff66',      // Green
    glowIntensity: 0.8,
    label: 'M',
  },
  large: {
    scale: 1.4,
    color: '#00ffaa',      // Bright cyan-green
    glowIntensity: 1.2,
    label: 'L',
  },
};

// Health Potion component - for energy recovery
interface HealthPotionProps {
  lane: -1 | 0 | 1;
  distance: number;
  size?: PotionSize;
  onCollect: () => void;
}

export function HealthPotion({ lane, distance: spawnDistance, size = 'normal', onCollect }: HealthPotionProps) {
  const groupRef = useRef<THREE.Group>(null);
  const collectedRef = useRef(false);
  const distance = useGameStore((state) => state.distance);
  const playerLane = useGameStore((state) => state.playerLane);
  const status = useGameStore((state) => state.status);
  const energy = useGameStore((state) => state.energy);

  const relativeZ = spawnDistance - distance;
  const x = lane * LANE_WIDTH;

  // Rotation and floating animation
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 2;
      groupRef.current.position.y = 1.5 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }
  });

  // Collection check
  useFrame(() => {
    if (status !== 'playing' || collectedRef.current) return;

    if (relativeZ < 1.5 && relativeZ > -1.5 && lane === playerLane) {
      collectedRef.current = true;
      onCollect();
    }
  });

  if (relativeZ > 80 || relativeZ < -10 || collectedRef.current) return null;

  // Get size config
  const config = POTION_CONFIG[size];
  const scale = config.scale;

  // Pulse more when player has low energy
  const pulseIntensity = (energy <= 30 ? 1.5 : 1.0) * config.glowIntensity;
  const POTION_COLOR = config.color;

  return (
    <group ref={groupRef} position={[x, 1.5, -relativeZ]} scale={[scale, scale, scale]}>
      {/* Potion bottle body */}
      <mesh>
        <capsuleGeometry args={[0.2, 0.3, 8, 16]} />
        <meshStandardMaterial
          color={POTION_COLOR}
          emissive={POTION_COLOR}
          emissiveIntensity={pulseIntensity}
          transparent
          opacity={0.8}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>

      {/* Bottle neck */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.15, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#00ff66"
          emissiveIntensity={0.3}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>

      {/* Cross symbol - horizontal */}
      <mesh position={[0, 0, 0.22]}>
        <boxGeometry args={[0.25, 0.08, 0.02]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={pulseIntensity * 0.5}
        />
      </mesh>

      {/* Cross symbol - vertical */}
      <mesh position={[0, 0, 0.22]}>
        <boxGeometry args={[0.08, 0.25, 0.02]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={pulseIntensity * 0.5}
        />
      </mesh>

      {/* Heart shape glow behind */}
      <mesh position={[0, 0, -0.25]} rotation={[0, Math.PI, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial
          color={POTION_COLOR}
          emissive={POTION_COLOR}
          emissiveIntensity={pulseIntensity}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Sparkle particles around potion - reduced for performance */}
      {[0, Math.PI].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(angle) * 0.4,
            Math.sin(angle * 2) * 0.2,
            Math.sin(angle) * 0.4,
          ]}
        >
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={POTION_COLOR}
            emissiveIntensity={1.2}
          />
        </mesh>
      ))}
      {/* Removed point light for performance - using emissive materials instead */}
    </group>
  );
}
