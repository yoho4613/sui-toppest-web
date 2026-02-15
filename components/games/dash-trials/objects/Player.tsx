'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';

const LANE_WIDTH = 2.5;
const LANE_TRANSITION_SPEED = 15; // Smooth lane transition (matching Lucky Day)

// Color palette - High contrast for visibility against dark map
const SUIT_COLOR = '#d8e0f0';  // Bright white-gray
const SUIT_DARK = '#4a5568';   // Darker accent for depth
const SUIT_ARMOR = '#2d3748'; // Armor plates
const ACCENT_COLOR = '#00ff88';
const VISOR_COLOR = '#00ffff';  // Bright cyan
const FEVER_COLOR = '#ff00ff';
const WARNING_COLOR = '#ff6666';  // Bright red
const BOOSTER_FLAME = '#ff8844'; // Booster flame color

// Pre-create color objects to avoid GC
const COLOR_ACCENT = new THREE.Color(ACCENT_COLOR);
const COLOR_VISOR = new THREE.Color(VISOR_COLOR);
const COLOR_FEVER = new THREE.Color(FEVER_COLOR);
const COLOR_WARNING = new THREE.Color(WARNING_COLOR);
const COLOR_CRASH = new THREE.Color('#ff0000');
const COLOR_EXHAUSTED = new THREE.Color('#666666');
const COLOR_EXHAUSTED_VISOR = new THREE.Color('#333333');
const COLOR_BOOSTER = new THREE.Color(BOOSTER_FLAME);

export function Player() {
  // Refs for animation
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const boosterRef = useRef<THREE.Mesh>(null);
  const boosterFlameRef = useRef<THREE.Mesh>(null);
  const runPhaseRef = useRef(0);
  const crashPhaseRef = useRef(0);
  const exhaustionPhaseRef = useRef(0);
  const boosterPhaseRef = useRef(0);

  // Material refs for dynamic color updates (no re-render needed)
  const accentMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const visorMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const boosterMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const playerLightRef = useRef<THREE.PointLight>(null);
  const boosterLightRef = useRef<THREE.PointLight>(null);

  // Cache for last known state (to detect changes)
  const lastStateRef = useRef({
    isFeverMode: false,
    isCrashing: false,
    isLowHealth: false,
    isExhausted: false,
  });

  // Only subscribe to status (for useEffect and conditional rendering)
  // All other values are read via getState() in useFrame
  const status = useGameStore((state) => state.status);

  // Reset player position when game restarts (countdown starts)
  useEffect(() => {
    if (status === 'countdown') {
      // Reset all refs to initial position
      if (groupRef.current) {
        groupRef.current.position.set(0, 0.5, 0);
        groupRef.current.rotation.set(0, 0, 0);
      }
      if (bodyRef.current) {
        bodyRef.current.position.set(0, 0, 0);
        bodyRef.current.rotation.set(0, 0, 0);
      }
      if (leftArmRef.current) {
        leftArmRef.current.rotation.set(0, 0, 0);
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.set(0, 0, 0);
      }
      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(0, 0, 0);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(0, 0, 0);
      }
      // Reset animation phases
      runPhaseRef.current = 0;
      crashPhaseRef.current = 0;
      exhaustionPhaseRef.current = 0;
    }
  }, [status]);

  // Animation loop - all state read via getState() (no subscriptions = no re-renders)
  useFrame((state, delta) => {
    if (!groupRef.current || !bodyRef.current) return;

    // Read all game state at once (no React re-render triggered)
    const gameState = useGameStore.getState();
    const {
      playerLane,
      playerAction,
      playerY,
      isFeverMode,
      isCrashing,
      health,
      gameOverReason,
    } = gameState;

    const targetX = playerLane * LANE_WIDTH;
    const isExhausted = gameOverReason === 'exhaustion';
    const isLowHealth = health <= 30;

    // Update colors only when state changes (not every frame)
    const stateChanged =
      lastStateRef.current.isFeverMode !== isFeverMode ||
      lastStateRef.current.isCrashing !== isCrashing ||
      lastStateRef.current.isLowHealth !== isLowHealth ||
      lastStateRef.current.isExhausted !== isExhausted;

    if (stateChanged) {
      lastStateRef.current = { isFeverMode, isCrashing, isLowHealth, isExhausted };

      // Determine colors
      let accentColor: THREE.Color;
      let visorColor: THREE.Color;
      let emissiveIntensity: number;

      if (isCrashing) {
        accentColor = COLOR_CRASH;
        visorColor = COLOR_CRASH;
        emissiveIntensity = 2.0;
      } else if (isExhausted) {
        accentColor = COLOR_EXHAUSTED;
        visorColor = COLOR_EXHAUSTED_VISOR;
        emissiveIntensity = 0.1;
      } else if (isFeverMode) {
        accentColor = COLOR_FEVER;
        visorColor = COLOR_FEVER;
        emissiveIntensity = 1.2;
      } else if (isLowHealth) {
        accentColor = COLOR_WARNING;
        visorColor = COLOR_WARNING;
        emissiveIntensity = 0.8;
      } else {
        accentColor = COLOR_ACCENT;
        visorColor = COLOR_VISOR;
        emissiveIntensity = 0.5;
      }

      // Update accent materials
      accentMaterialsRef.current.forEach((mat) => {
        if (mat) {
          mat.color.copy(accentColor);
          mat.emissive.copy(accentColor);
          mat.emissiveIntensity = emissiveIntensity;
        }
      });

      // Update visor materials
      visorMaterialsRef.current.forEach((mat) => {
        if (mat) {
          mat.color.copy(visorColor);
          mat.emissive.copy(visorColor);
          mat.emissiveIntensity = isFeverMode ? 1.2 : 0.6;
        }
      });

      // Update booster materials
      const boosterColor = isFeverMode ? COLOR_FEVER : COLOR_BOOSTER;
      boosterMaterialsRef.current.forEach((mat) => {
        if (mat) {
          mat.color.copy(boosterColor);
          mat.emissive.copy(boosterColor);
          mat.emissiveIntensity = isFeverMode ? 2.0 : 1.0;
        }
      });

      // Update player light
      if (playerLightRef.current) {
        playerLightRef.current.color.copy(visorColor);
        playerLightRef.current.intensity = isFeverMode ? 3.0 : isLowHealth ? 1.5 : 1.0;
        playerLightRef.current.distance = isFeverMode ? 7 : 5;
      }

      // Update booster light
      if (boosterLightRef.current) {
        boosterLightRef.current.color.copy(boosterColor);
        boosterLightRef.current.intensity = isFeverMode ? 3.0 : 1.5;
        boosterLightRef.current.distance = isFeverMode ? 5 : 3;
      }
    }

    // Update booster flame animation
    boosterPhaseRef.current += delta * 15;

    // Animate booster flame
    if (boosterFlameRef.current && status === 'playing') {
      const flameScale = isFeverMode
        ? 1.5 + Math.sin(boosterPhaseRef.current) * 0.5
        : 0.8 + Math.sin(boosterPhaseRef.current) * 0.3;

      boosterFlameRef.current.scale.set(1, flameScale, 1);

      if (boosterFlameRef.current.material && 'emissiveIntensity' in boosterFlameRef.current.material) {
        const mat = boosterFlameRef.current.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = isFeverMode
          ? 2.0 + Math.sin(boosterPhaseRef.current * 2) * 0.5
          : 1.0 + Math.sin(boosterPhaseRef.current * 2) * 0.3;
      }
    }

    // Smooth lane transition (matching Lucky Day pattern)
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX,
      delta * LANE_TRANSITION_SPEED
    );

    // Running animation (when not jumping/sliding)
    if (status === 'playing' && playerAction === 'running') {
      runPhaseRef.current += delta * 12;
      const swing = Math.sin(runPhaseRef.current) * 0.8;
      const legSwing = Math.sin(runPhaseRef.current) * 1.0;

      // Arm swing
      if (leftArmRef.current) leftArmRef.current.rotation.x = swing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -swing;

      // Leg swing
      if (leftLegRef.current) leftLegRef.current.rotation.x = -legSwing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = legSwing;

      // Subtle body bob
      bodyRef.current.position.y = Math.abs(Math.sin(runPhaseRef.current * 2)) * 0.05;
    }

    // Jump pose
    if (playerAction === 'jumping') {
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        playerY + 0.5,
        delta * LANE_TRANSITION_SPEED
      );
      // Arms up, legs tucked
      if (leftArmRef.current) leftArmRef.current.rotation.x = -1.2;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -1.2;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0.5;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0.5;
    } else {
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        0.5,
        delta * LANE_TRANSITION_SPEED
      );
    }

    // Slide pose
    if (playerAction === 'sliding') {
      bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, -1.2, delta * 15);
      bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, -0.3, delta * 15);
      // Legs forward
      if (leftLegRef.current) leftLegRef.current.rotation.x = -1.5;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -1.5;
      // Arms back
      if (leftArmRef.current) leftArmRef.current.rotation.x = 1.0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 1.0;
    } else if (playerAction !== 'jumping') {
      bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0, delta * 15);
      bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0, delta * 15);
    }

    // Exhaustion animation (health depleted - kneel down from tiredness)
    if (isExhausted && !isCrashing) {
      exhaustionPhaseRef.current += delta * 1.5; // Slower for dramatic effect
      const exhaustProgress = Math.min(exhaustionPhaseRef.current / 1.5, 1); // 1.5 seconds total

      // Phase 1: Stumble and slow down (0-0.3)
      // Phase 2: Start kneeling (0.3-0.7)
      // Phase 3: Full kneel with head down (0.7-1.0)

      if (exhaustProgress < 0.3) {
        // Phase 1: Stumble - slight wobble
        groupRef.current.rotation.z = Math.sin(exhaustionPhaseRef.current * 8) * 0.1;
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(
          bodyRef.current.rotation.x,
          0.2, // Slight forward lean
          delta * 3
        );
      } else if (exhaustProgress < 0.7) {
        // Phase 2: Going down to knees
        const kneeProgress = (exhaustProgress - 0.3) / 0.4;

        // Lower body position (kneeling down)
        groupRef.current.position.y = THREE.MathUtils.lerp(
          groupRef.current.position.y,
          -0.3, // Kneel height
          delta * 3
        );

        // Body leans forward slightly
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(
          bodyRef.current.rotation.x,
          0.4,
          delta * 4
        );

        // Legs bend for kneeling
        if (leftLegRef.current) {
          leftLegRef.current.rotation.x = THREE.MathUtils.lerp(
            leftLegRef.current.rotation.x,
            -1.8, // Deep knee bend
            delta * 4
          );
        }
        if (rightLegRef.current) {
          rightLegRef.current.rotation.x = THREE.MathUtils.lerp(
            rightLegRef.current.rotation.x,
            -1.8,
            delta * 4
          );
        }

        // Arms go down to support
        if (leftArmRef.current) {
          leftArmRef.current.rotation.x = THREE.MathUtils.lerp(
            leftArmRef.current.rotation.x,
            0.5,
            delta * 3
          );
          leftArmRef.current.rotation.z = -0.2;
        }
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = THREE.MathUtils.lerp(
            rightArmRef.current.rotation.x,
            0.5,
            delta * 3
          );
          rightArmRef.current.rotation.z = 0.2;
        }

        // Reset wobble
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, delta * 5);
      } else {
        // Phase 3: Full kneel - head drops, exhausted pose
        groupRef.current.position.y = THREE.MathUtils.lerp(
          groupRef.current.position.y,
          -0.35,
          delta * 2
        );

        // Head/body drops forward (defeated pose)
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(
          bodyRef.current.rotation.x,
          0.6, // Head down
          delta * 2
        );

        // Arms hang limply
        if (leftArmRef.current) {
          leftArmRef.current.rotation.x = THREE.MathUtils.lerp(
            leftArmRef.current.rotation.x,
            1.2, // Hanging
            delta * 2
          );
          leftArmRef.current.rotation.z = -0.1;
        }
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = THREE.MathUtils.lerp(
            rightArmRef.current.rotation.x,
            1.2,
            delta * 2
          );
          rightArmRef.current.rotation.z = 0.1;
        }

        // Slight breathing motion
        const breathe = Math.sin(exhaustionPhaseRef.current * 4) * 0.02;
        bodyRef.current.position.y = breathe;
      }

      return; // Skip other animations during exhaustion
    } else {
      exhaustionPhaseRef.current = 0;
    }

    // Crash animation (obstacle collision - tumble backward)
    if (playerAction === 'crashed' || isCrashing) {
      crashPhaseRef.current += delta * 4;
      const crashProgress = Math.min(crashPhaseRef.current, 1);

      // Tumble backward
      bodyRef.current.rotation.x = THREE.MathUtils.lerp(
        bodyRef.current.rotation.x,
        -Math.PI * 0.8,
        delta * 8
      );

      // Spin slightly
      groupRef.current.rotation.y += delta * 3;
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        0.5,
        delta * 5
      );

      // Fall and fly backward
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        -0.3,
        delta * 3
      );
      groupRef.current.position.z += delta * 8;

      // Ragdoll arms - flail outward
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -2.0 + Math.sin(crashPhaseRef.current * 8) * 0.5;
        leftArmRef.current.rotation.z = -1.2;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -2.0 + Math.sin(crashPhaseRef.current * 8 + 1) * 0.5;
        rightArmRef.current.rotation.z = 1.2;
      }

      // Ragdoll legs - spread out
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = -0.8 + Math.sin(crashPhaseRef.current * 6) * 0.3;
        leftLegRef.current.rotation.z = -0.4;
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = -0.8 + Math.sin(crashPhaseRef.current * 6 + 0.5) * 0.3;
        rightLegRef.current.rotation.z = 0.4;
      }

      return; // Skip other animations during crash
    } else {
      crashPhaseRef.current = 0;
    }

    // Lane change tilt
    const tilt = (targetX - groupRef.current.position.x) * 0.15;
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, tilt, delta * 10);
  });

  // Register material refs on mount (collect all accent/visor materials)
  const registerAccentMaterial = (mat: THREE.MeshStandardMaterial | null) => {
    if (mat && !accentMaterialsRef.current.includes(mat)) {
      accentMaterialsRef.current.push(mat);
    }
  };

  const registerVisorMaterial = (mat: THREE.MeshStandardMaterial | null) => {
    if (mat && !visorMaterialsRef.current.includes(mat)) {
      visorMaterialsRef.current.push(mat);
    }
  };

  const registerBoosterMaterial = (mat: THREE.MeshStandardMaterial | null) => {
    if (mat && !boosterMaterialsRef.current.includes(mat)) {
      boosterMaterialsRef.current.push(mat);
    }
  };

  // Initial colors (will be updated in useFrame when state changes)
  const initialAccent = ACCENT_COLOR;
  const initialVisor = VISOR_COLOR;
  const initialEmissive = 0.5;

  return (
    <group ref={groupRef} position={[0, 0.5, 0]}>
      {/* Body group for animations */}
      <group ref={bodyRef}>
        {/* Torso */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <capsuleGeometry args={[0.25, 0.4, 8, 16]} />
          <meshStandardMaterial
            color={SUIT_COLOR}
            emissive={initialAccent}
            emissiveIntensity={0.1}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>

        {/* Chest accent line */}
        <mesh position={[0, 0.45, 0.2]}>
          <boxGeometry args={[0.15, 0.3, 0.05]} />
          <meshStandardMaterial
            ref={registerAccentMaterial}
            color={initialAccent}
            emissive={initialAccent}
            emissiveIntensity={initialEmissive}
          />
        </mesh>

        {/* Core glow (chest) */}
        <mesh position={[0, 0.35, 0.22]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            ref={registerVisorMaterial}
            color={initialVisor}
            emissive={initialVisor}
            emissiveIntensity={0.8}
          />
        </mesh>

        {/* Head */}
        <group position={[0, 0.85, 0]}>
          {/* Head base */}
          <mesh castShadow>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial
              color={SUIT_COLOR}
              emissive={initialVisor}
              emissiveIntensity={0.08}
              metalness={0.3}
              roughness={0.5}
            />
          </mesh>

          {/* Helmet visor */}
          <mesh position={[0, 0.02, 0.12]}>
            <boxGeometry args={[0.28, 0.12, 0.1]} />
            <meshStandardMaterial
              ref={registerVisorMaterial}
              color={initialVisor}
              emissive={initialVisor}
              emissiveIntensity={0.6}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* Helmet top stripe */}
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[0.05, 0.1, 0.3]} />
            <meshStandardMaterial
              ref={registerAccentMaterial}
              color={initialAccent}
              emissive={initialAccent}
              emissiveIntensity={initialEmissive}
            />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.35, 0.45, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.25, 8, 16]} />
            <meshStandardMaterial
              color={SUIT_DARK}
              emissive={initialAccent}
              emissiveIntensity={0.08}
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>
          {/* Arm accent */}
          <mesh position={[-0.06, -0.15, 0]}>
            <boxGeometry args={[0.02, 0.2, 0.06]} />
            <meshStandardMaterial
              ref={registerAccentMaterial}
              color={initialAccent}
              emissive={initialAccent}
              emissiveIntensity={initialEmissive * 0.5}
            />
          </mesh>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.35, 0.45, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.25, 8, 16]} />
            <meshStandardMaterial
              color={SUIT_DARK}
              emissive={initialAccent}
              emissiveIntensity={0.08}
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>
          {/* Arm accent */}
          <mesh position={[0.06, -0.15, 0]}>
            <boxGeometry args={[0.02, 0.2, 0.06]} />
            <meshStandardMaterial
              ref={registerAccentMaterial}
              color={initialAccent}
              emissive={initialAccent}
              emissiveIntensity={initialEmissive * 0.5}
            />
          </mesh>
        </group>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.12, 0, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.35, 8, 16]} />
            <meshStandardMaterial
              color={SUIT_DARK}
              emissive={initialAccent}
              emissiveIntensity={0.08}
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>
          {/* Leg accent */}
          <mesh position={[-0.08, -0.2, 0]}>
            <boxGeometry args={[0.02, 0.3, 0.08]} />
            <meshStandardMaterial
              ref={registerAccentMaterial}
              color={initialAccent}
              emissive={initialAccent}
              emissiveIntensity={initialEmissive * 0.5}
            />
          </mesh>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.12, 0, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.35, 8, 16]} />
            <meshStandardMaterial
              color={SUIT_DARK}
              emissive={initialAccent}
              emissiveIntensity={0.08}
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>
          {/* Leg accent */}
          <mesh position={[0.08, -0.2, 0]}>
            <boxGeometry args={[0.02, 0.3, 0.08]} />
            <meshStandardMaterial
              ref={registerAccentMaterial}
              color={initialAccent}
              emissive={initialAccent}
              emissiveIntensity={initialEmissive * 0.5}
            />
          </mesh>
        </group>

        {/* Shoulder armor - left */}
        <mesh position={[-0.32, 0.55, 0]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.18]} />
          <meshStandardMaterial
            color={SUIT_ARMOR}
            emissive={initialAccent}
            emissiveIntensity={0.15}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>

        {/* Shoulder armor - right */}
        <mesh position={[0.32, 0.55, 0]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.18]} />
          <meshStandardMaterial
            color={SUIT_ARMOR}
            emissive={initialAccent}
            emissiveIntensity={0.15}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>

        {/* Back booster pack */}
        <group position={[0, 0.35, -0.22]}>
          {/* Main booster housing */}
          <mesh ref={boosterRef}>
            <boxGeometry args={[0.25, 0.2, 0.12]} />
            <meshStandardMaterial
              color={SUIT_ARMOR}
              emissive={initialAccent}
              emissiveIntensity={0.15}
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>

          {/* Booster vents */}
          {[-0.08, 0.08].map((x, i) => (
            <mesh key={`vent-${i}`} position={[x, -0.08, -0.02]}>
              <cylinderGeometry args={[0.04, 0.05, 0.08, 8]} />
              <meshStandardMaterial
                color="#1a1a1a"
                emissive={BOOSTER_FLAME}
                emissiveIntensity={0.5}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
          ))}

          {/* Booster flame (animated) */}
          <mesh
            ref={boosterFlameRef}
            position={[0, -0.18, -0.02]}
            rotation={[Math.PI, 0, 0]}
          >
            <coneGeometry args={[0.12, 0.25, 8]} />
            <meshStandardMaterial
              ref={registerBoosterMaterial}
              color={BOOSTER_FLAME}
              emissive={BOOSTER_FLAME}
              emissiveIntensity={1.0}
              transparent
              opacity={status === 'playing' ? 0.9 : 0.3}
            />
          </mesh>

          {/* Inner flame core */}
          <mesh
            position={[0, -0.15, -0.02]}
            rotation={[Math.PI, 0, 0]}
          >
            <coneGeometry args={[0.06, 0.15, 6]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffff88"
              emissiveIntensity={status === 'playing' ? 1.5 : 0.3}
              transparent
              opacity={status === 'playing' ? 0.8 : 0.2}
            />
          </mesh>
        </group>

        {/* Belt/hip accent */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 16]} />
          <meshStandardMaterial
            color={SUIT_ARMOR}
            emissive={initialAccent}
            emissiveIntensity={0.2}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>

        {/* Belt buckle glow */}
        <mesh position={[0, 0.12, 0.2]}>
          <boxGeometry args={[0.1, 0.06, 0.04]} />
          <meshStandardMaterial
            ref={registerVisorMaterial}
            color={initialVisor}
            emissive={initialVisor}
            emissiveIntensity={initialEmissive * 0.8}
          />
        </mesh>
      </group>

      {/* Player glow light */}
      <pointLight
        ref={playerLightRef}
        position={[0, 0.5, 0.3]}
        color={initialVisor}
        intensity={1.0}
        distance={5}
      />

      {/* Booster glow light */}
      {status === 'playing' && (
        <pointLight
          ref={boosterLightRef}
          position={[0, 0.2, -0.4]}
          color={BOOSTER_FLAME}
          intensity={1.5}
          distance={3}
        />
      )}
    </group>
  );
}
