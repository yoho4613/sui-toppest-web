'use client';

import { useRef, useMemo, useEffect, memo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';

const LANE_WIDTH = 2.5;

// Warning indicator colors
const WARNING_COLORS = {
  jump: '#ff4444',    // Red for jump obstacles
  slide: '#4488ff',   // Blue for slide obstacles
  avoid: '#ffaa00',   // Orange for avoid obstacles
};

export type ObstacleType = 'low' | 'high' | 'side-left' | 'side-right' | 'side-center' | 'double-lane' | 'moving';

interface ObstacleProps {
  type: ObstacleType;
  lane: -1 | 0 | 1;
  distance: number;
  onPassed: () => void;
  onCollision: () => void;
}

export const Obstacle = memo(function Obstacle({ type, lane, distance: spawnDistance, onPassed, onCollision }: ObstacleProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const passedRef = useRef(false);
  const movingOffsetRef = useRef(0);
  const pulseRef = useRef(0);

  // Only subscribe to status for conditional rendering
  const status = useGameStore((state) => state.status);

  // Use ref to access store values without causing re-renders
  const storeRef = useRef(useGameStore.getState());
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsubscribe;
  }, []);

  // Warning indicator type
  const warningType = useMemo(() => {
    if (type === 'low') return 'jump';
    if (type === 'high') return 'slide';
    return 'avoid';
  }, [type]);

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

  // Animation for moving obstacles and pulsing glow + position updates
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const { status: currentStatus, distance, isFeverMode, playerLane, playerAction } = storeRef.current;

    // Update position based on current distance
    const relativeZ = spawnDistance - distance;
    groupRef.current.position.z = -relativeZ;

    if (currentStatus !== 'playing') return;

    // Update pulse phase
    pulseRef.current += delta * 6;
    const pulseIntensity = 0.3 + Math.sin(pulseRef.current) * 0.2;

    // Animate glow intensity
    if (glowRef.current?.material && 'emissiveIntensity' in glowRef.current.material) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + pulseIntensity;
    }

    // Moving obstacle animation
    if (type === 'moving') {
      movingOffsetRef.current = Math.sin(state.clock.elapsedTime * 3) * LANE_WIDTH;
      groupRef.current.position.x = baseX + movingOffsetRef.current;
    }

    // Collision detection
    if (!isFeverMode && relativeZ < 1.5 && relativeZ > -1.5 && !passedRef.current) {
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

    // Mark as passed
    if (relativeZ < -2 && !passedRef.current) {
      passedRef.current = true;
      onPassed();
    }
  });

  // Current X position (initial value, moving obstacles update via ref)
  const currentX = baseX;

  // Calculate which lane the moving obstacle is currently in
  const getCurrentLane = (): -1 | 0 | 1 => {
    if (type !== 'moving') return lane;
    const effectiveX = baseX + movingOffsetRef.current;
    if (effectiveX < -LANE_WIDTH / 2) return -1;
    if (effectiveX > LANE_WIDTH / 2) return 1;
    return 0;
  };

  // Only render if within visible range (use initial check, position is updated in useFrame)
  const initialRelativeZ = spawnDistance - storeRef.current.distance;
  if (initialRelativeZ > 160 || initialRelativeZ < -15) return null;

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
      <group ref={groupRef} position={[currentX, 0, -initialRelativeZ]}>
        {/* Floor warning indicator - slide zone */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 1.5]}
        >
          <planeGeometry args={[width, 2.5]} />
          <meshStandardMaterial
            color={WARNING_COLORS.slide}
            emissive={WARNING_COLORS.slide}
            emissiveIntensity={0.4}
            transparent
            opacity={0.3}
          />
        </mesh>

        {/* Floor warning stripes */}
        {[0.5, 1.0, 1.5, 2.0].map((z) => (
          <mesh
            key={`stripe-${z}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.015, z]}
          >
            <planeGeometry args={[width - 0.3, 0.08]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={WARNING_COLORS.slide}
              emissiveIntensity={0.6}
            />
          </mesh>
        ))}

        {/* Hurdle bar - floating horizontal bar */}
        <mesh position={[0, baseY, 0]} ref={meshRef} castShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial
            color={colorConfig.main}
            emissive={colorConfig.main}
            emissiveIntensity={colorConfig.emissive}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>

        {/* Left leg with glow strip */}
        <mesh position={[-width / 2 + 0.1, baseY / 2, 0]} castShadow>
          <boxGeometry args={[0.12, baseY, 0.12]} />
          <meshStandardMaterial
            color="#1a1a2a"
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[-width / 2 + 0.1, baseY / 2, 0.07]}>
          <boxGeometry args={[0.04, baseY, 0.02]} />
          <meshStandardMaterial
            color={colorConfig.edge}
            emissive={colorConfig.edge}
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Right leg with glow strip */}
        <mesh position={[width / 2 - 0.1, baseY / 2, 0]} castShadow>
          <boxGeometry args={[0.12, baseY, 0.12]} />
          <meshStandardMaterial
            color="#1a1a2a"
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[width / 2 - 0.1, baseY / 2, 0.07]}>
          <boxGeometry args={[0.04, baseY, 0.02]} />
          <meshStandardMaterial
            color={colorConfig.edge}
            emissive={colorConfig.edge}
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Top glow line with pulse ref */}
        <mesh ref={glowRef} position={[0, baseY + height / 2 + 0.03, 0]}>
          <boxGeometry args={[width + 0.1, 0.06, depth + 0.1]} />
          <meshStandardMaterial
            color={colorConfig.edge}
            emissive={colorConfig.edge}
            emissiveIntensity={0.8}
          />
        </mesh>

        {/* Bottom bar glow */}
        <mesh position={[0, baseY - height / 2 - 0.02, 0]}>
          <boxGeometry args={[width + 0.05, 0.04, depth + 0.05]} />
          <meshStandardMaterial
            color={colorConfig.edge}
            emissive={colorConfig.edge}
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>
    );
  }

  // Regular ground obstacles (low, side-center, double-lane, moving)
  const warningColor = WARNING_COLORS[warningType];

  return (
    <group ref={groupRef} position={[currentX, 0, -initialRelativeZ]}>
      {/* Floor warning indicator */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 1.5]}
      >
        <planeGeometry args={[width + 0.5, 2.5]} />
        <meshStandardMaterial
          color={warningColor}
          emissive={warningColor}
          emissiveIntensity={0.3}
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Floor warning stripes */}
      {type === 'low' && [0.5, 1.0, 1.5, 2.0].map((z) => (
        <mesh
          key={`stripe-${z}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.015, z]}
        >
          <planeGeometry args={[width - 0.3, 0.08]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={warningColor}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* Main obstacle body */}
      <mesh ref={meshRef} position={[0, baseY, 0]} castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={colorConfig.main}
          emissive={colorConfig.main}
          emissiveIntensity={colorConfig.emissive}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      {/* Inner dark core for depth */}
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[width - 0.15, height - 0.15, depth + 0.01]} />
        <meshStandardMaterial
          color="#1a1a25"
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Top edge glow with pulse */}
      <mesh ref={glowRef} position={[0, baseY + height / 2 + 0.03, 0]}>
        <boxGeometry args={[width + 0.1, 0.06, depth + 0.1]} />
        <meshStandardMaterial
          color={colorConfig.edge}
          emissive={colorConfig.edge}
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Front edge glow */}
      <mesh position={[0, baseY, depth / 2 + 0.03]}>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.04]} />
        <meshStandardMaterial
          color={colorConfig.edge}
          emissive={colorConfig.edge}
          emissiveIntensity={0.6}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Side edge accents */}
      {[-1, 1].map((side) => (
        <mesh
          key={`side-${side}`}
          position={[side * (width / 2 + 0.03), baseY, 0]}
        >
          <boxGeometry args={[0.04, height, depth]} />
          <meshStandardMaterial
            color={colorConfig.edge}
            emissive={colorConfig.edge}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}

      {/* Bottom ground glow */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 0.3, depth + 0.3]} />
        <meshStandardMaterial
          color={colorConfig.main}
          emissive={colorConfig.main}
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Hazard symbol for jump obstacles */}
      {type === 'low' && (
        <mesh position={[0, baseY + height / 2 - 0.1, depth / 2 + 0.04]}>
          <boxGeometry args={[0.4, 0.08, 0.01]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.8}
          />
        </mesh>
      )}
    </group>
  );
});

// Coin component - for fever mode only
interface CoinProps {
  lane: -1 | 0 | 1;
  distance: number;
  onCollect: () => void;
}

export const Coin = memo(function Coin({ lane, distance: spawnDistance, onCollect }: CoinProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [collected, setCollected] = useState(false);

  // Only subscribe to status for conditional rendering
  const status = useGameStore((state) => state.status);

  // Use ref for frequently changing values
  const storeRef = useRef(useGameStore.getState());
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsubscribe;
  }, []);

  const x = lane * LANE_WIDTH;
  const initialRelativeZ = spawnDistance - storeRef.current.distance;

  // Rotation animation + position update + collection check
  useFrame((state, delta) => {
    if (!groupRef.current || collected) return;
    const { distance, playerLane, status: currentStatus, consecutiveCoins } = storeRef.current;
    const relativeZ = spawnDistance - distance;

    // Update position
    groupRef.current.position.z = -relativeZ;
    groupRef.current.rotation.y += delta * 3;

    // Update glow intensity based on consecutive coins
    const glowIntensity = 0.6 + (consecutiveCoins / 5) * 0.4;
    const mesh = groupRef.current.children[0] as THREE.Mesh;
    if (mesh?.material && 'emissiveIntensity' in mesh.material) {
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity;
    }

    // Collection check
    if (currentStatus !== 'playing') return;
    if (relativeZ < 1.5 && relativeZ > -1.5 && lane === playerLane) {
      setCollected(true);
      onCollect();
    }
  });

  if (initialRelativeZ > 160 || initialRelativeZ < -15 || collected) return null;

  // Initial glow intensity (updated in useFrame)
  const initialGlowIntensity = 0.6 + (storeRef.current.consecutiveCoins / 5) * 0.4;

  return (
    <group ref={groupRef} position={[x, 1.0, -initialRelativeZ]}>
      {/* Simple coin - single cylinder */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.06, 20]} />
        <meshStandardMaterial
          color="#ffdd00"
          emissive="#ffdd00"
          emissiveIntensity={initialGlowIntensity}
          metalness={0.95}
          roughness={0.05}
        />
      </mesh>
    </group>
  );
});

// Potion size types
export type PotionSize = 'small' | 'normal' | 'large';

// Potion configuration based on size - Pink/Magenta for visibility against green track
const POTION_CONFIG = {
  small: {
    scale: 0.6,
    color: '#ff66aa',      // Light pink
    glowIntensity: 0.8,
    label: 'S',
  },
  normal: {
    scale: 1.0,
    color: '#ff44cc',      // Bright magenta-pink
    glowIntensity: 1.0,
    label: 'M',
  },
  large: {
    scale: 1.4,
    color: '#ff22ff',      // Hot magenta
    glowIntensity: 1.4,
    label: 'L',
  },
};

// Health Potion component - for health recovery
interface HealthPotionProps {
  lane: -1 | 0 | 1;
  distance: number;
  size?: PotionSize;
  onCollect: () => void;
}

export const HealthPotion = memo(function HealthPotion({ lane, distance: spawnDistance, size = 'normal', onCollect }: HealthPotionProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [collected, setCollected] = useState(false);

  // Only subscribe to status for conditional rendering
  const status = useGameStore((state) => state.status);

  // Use ref for frequently changing values
  const storeRef = useRef(useGameStore.getState());
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsubscribe;
  }, []);

  const x = lane * LANE_WIDTH;
  const initialRelativeZ = spawnDistance - storeRef.current.distance;

  // Get size config
  const config = POTION_CONFIG[size];
  const scale = config.scale;
  const POTION_COLOR = config.color;

  // Rotation, floating animation, position update, and collection check
  useFrame((state, delta) => {
    if (!groupRef.current || collected) return;
    const { distance, playerLane, status: currentStatus } = storeRef.current;
    const relativeZ = spawnDistance - distance;

    // Update position with floating effect
    groupRef.current.position.z = -relativeZ;
    groupRef.current.position.y = 1.5 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    groupRef.current.rotation.y += delta * 2;

    // Collection check
    if (currentStatus !== 'playing') return;
    if (relativeZ < 1.5 && relativeZ > -1.5 && lane === playerLane) {
      setCollected(true);
      onCollect();
    }
  });

  if (initialRelativeZ > 160 || initialRelativeZ < -15 || collected) return null;

  // Pulse more when player has low health (static for initial render)
  const initialHealth = storeRef.current.health;
  const pulseIntensity = (initialHealth <= 30 ? 1.5 : 1.0) * config.glowIntensity;

  return (
    <group ref={groupRef} position={[x, 1.5, -initialRelativeZ]} scale={[scale, scale, scale]}>
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

      {/* Bottle neck - white cap */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.15, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={POTION_COLOR}
          emissiveIntensity={0.4}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>

      {/* Cross symbol - horizontal (white on pink) */}
      <mesh position={[0, 0, 0.22]}>
        <boxGeometry args={[0.25, 0.08, 0.02]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={pulseIntensity * 0.8}
        />
      </mesh>

      {/* Cross symbol - vertical */}
      <mesh position={[0, 0, 0.22]}>
        <boxGeometry args={[0.08, 0.25, 0.02]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={pulseIntensity * 0.8}
        />
      </mesh>

      {/* Outer glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[0.35, 0.03, 8, 16]} />
        <meshStandardMaterial
          color={POTION_COLOR}
          emissive={POTION_COLOR}
          emissiveIntensity={pulseIntensity * 1.2}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Heart shape glow behind */}
      <mesh position={[0, 0, -0.25]} rotation={[0, Math.PI, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial
          color={POTION_COLOR}
          emissive={POTION_COLOR}
          emissiveIntensity={pulseIntensity * 1.2}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Sparkle particles around potion */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(angle) * 0.45,
            Math.sin(angle * 2) * 0.25,
            Math.sin(angle) * 0.45,
          ]}
        >
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={POTION_COLOR}
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}

      {/* Point light for visibility */}
      <pointLight
        color={POTION_COLOR}
        intensity={2.5}
        distance={4}
      />
    </group>
  );
});
