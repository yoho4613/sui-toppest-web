'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';

const LANE_WIDTH = 2.5;
const LANE_TRANSITION_SPEED = 15;

// Color palette - High contrast for visibility against dark map
const SUIT_COLOR = '#d8e0f0';  // Bright white-gray
const SUIT_DARK = '#4a5568';   // Darker accent for depth
const SUIT_ARMOR = '#2d3748'; // Armor plates
const ACCENT_COLOR = '#00ff88';
const VISOR_COLOR = '#00ffff';  // Bright cyan
const FEVER_COLOR = '#ff00ff';
const WARNING_COLOR = '#ff6666';  // Bright red
const BOOSTER_FLAME = '#ff8844'; // Booster flame color

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

  // Game state
  const playerLane = useGameStore((state) => state.playerLane);
  const playerAction = useGameStore((state) => state.playerAction);
  const playerY = useGameStore((state) => state.playerY);
  const isFeverMode = useGameStore((state) => state.isFeverMode);
  const health = useGameStore((state) => state.health);
  const status = useGameStore((state) => state.status);
  const isCrashing = useGameStore((state) => state.isCrashing);
  const gameOverReason = useGameStore((state) => state.gameOverReason);

  const targetX = playerLane * LANE_WIDTH;
  const isLowHealth = health <= 30;
  const isExhausted = gameOverReason === 'exhaustion';

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

  // Get accent color based on state
  const getAccentColor = () => {
    if (isCrashing) return '#ff0000';
    if (isExhausted) return '#666666'; // Dim gray for exhaustion
    if (isFeverMode) return FEVER_COLOR;
    if (isLowHealth) return WARNING_COLOR;
    return ACCENT_COLOR;
  };

  const getVisorColor = () => {
    if (isCrashing) return '#ff0000';
    if (isExhausted) return '#333333'; // Dim for exhaustion
    if (isFeverMode) return FEVER_COLOR;
    if (isLowHealth) return WARNING_COLOR;
    return VISOR_COLOR;
  };

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current || !bodyRef.current) return;

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

    // Position update
    const currentX = groupRef.current.position.x;
    groupRef.current.position.x = THREE.MathUtils.lerp(currentX, targetX, delta * LANE_TRANSITION_SPEED);

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

  const accentColor = getAccentColor();
  const visorColor = getVisorColor();
  const emissiveIntensity = isCrashing ? 2.0 : isExhausted ? 0.1 : isFeverMode ? 1.2 : isLowHealth ? 0.8 : 0.5;

  return (
    <group ref={groupRef} position={[0, 0.5, 0]}>
      {/* Body group for animations */}
      <group ref={bodyRef}>
        {/* Torso */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <capsuleGeometry args={[0.25, 0.4, 8, 16]} />
          <meshStandardMaterial
            color={SUIT_COLOR}
            emissive={accentColor}
            emissiveIntensity={0.1}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>

        {/* Chest accent line */}
        <mesh position={[0, 0.45, 0.2]}>
          <boxGeometry args={[0.15, 0.3, 0.05]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={emissiveIntensity}
          />
        </mesh>

        {/* Core glow (chest) */}
        <mesh position={[0, 0.35, 0.22]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            color={visorColor}
            emissive={visorColor}
            emissiveIntensity={isFeverMode ? 1.5 : 0.8}
          />
        </mesh>

        {/* Head */}
        <group position={[0, 0.85, 0]}>
          {/* Head base */}
          <mesh castShadow>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial
              color={SUIT_COLOR}
              emissive={visorColor}
              emissiveIntensity={0.08}
              metalness={0.3}
              roughness={0.5}
            />
          </mesh>

          {/* Helmet visor */}
          <mesh position={[0, 0.02, 0.12]}>
            <boxGeometry args={[0.28, 0.12, 0.1]} />
            <meshStandardMaterial
              color={visorColor}
              emissive={visorColor}
              emissiveIntensity={isFeverMode ? 1.2 : 0.6}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* Helmet top stripe */}
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[0.05, 0.1, 0.3]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.35, 0.45, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.25, 8, 16]} />
            <meshStandardMaterial
              color={SUIT_DARK}
              emissive={accentColor}
              emissiveIntensity={0.08}
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>
          {/* Arm accent */}
          <mesh position={[-0.06, -0.15, 0]}>
            <boxGeometry args={[0.02, 0.2, 0.06]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={emissiveIntensity * 0.5}
            />
          </mesh>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.35, 0.45, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.25, 8, 16]} />
            <meshStandardMaterial
              color={SUIT_DARK}
              emissive={accentColor}
              emissiveIntensity={0.08}
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>
          {/* Arm accent */}
          <mesh position={[0.06, -0.15, 0]}>
            <boxGeometry args={[0.02, 0.2, 0.06]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={emissiveIntensity * 0.5}
            />
          </mesh>
        </group>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.12, 0, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.35, 8, 16]} />
            <meshStandardMaterial
              color={SUIT_DARK}
              emissive={accentColor}
              emissiveIntensity={0.08}
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>
          {/* Leg accent */}
          <mesh position={[-0.08, -0.2, 0]}>
            <boxGeometry args={[0.02, 0.3, 0.08]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={emissiveIntensity * 0.5}
            />
          </mesh>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.12, 0, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.35, 8, 16]} />
            <meshStandardMaterial
              color={SUIT_DARK}
              emissive={accentColor}
              emissiveIntensity={0.08}
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>
          {/* Leg accent */}
          <mesh position={[0.08, -0.2, 0]}>
            <boxGeometry args={[0.02, 0.3, 0.08]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={emissiveIntensity * 0.5}
            />
          </mesh>
        </group>

        {/* Shoulder armor - left */}
        <mesh position={[-0.32, 0.55, 0]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.18]} />
          <meshStandardMaterial
            color={SUIT_ARMOR}
            emissive={accentColor}
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
            emissive={accentColor}
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
              emissive={isFeverMode ? FEVER_COLOR : accentColor}
              emissiveIntensity={isFeverMode ? 0.4 : 0.15}
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
                emissive={isFeverMode ? FEVER_COLOR : BOOSTER_FLAME}
                emissiveIntensity={isFeverMode ? 1.0 : 0.5}
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
              color={isFeverMode ? FEVER_COLOR : BOOSTER_FLAME}
              emissive={isFeverMode ? FEVER_COLOR : BOOSTER_FLAME}
              emissiveIntensity={isFeverMode ? 2.0 : 1.0}
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
            emissive={accentColor}
            emissiveIntensity={0.2}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>

        {/* Belt buckle glow */}
        <mesh position={[0, 0.12, 0.2]}>
          <boxGeometry args={[0.1, 0.06, 0.04]} />
          <meshStandardMaterial
            color={visorColor}
            emissive={visorColor}
            emissiveIntensity={emissiveIntensity * 0.8}
          />
        </mesh>
      </group>

      {/* Player glow light */}
      <pointLight
        position={[0, 0.5, 0.3]}
        color={visorColor}
        intensity={isFeverMode ? 3.0 : isLowHealth ? 1.5 : 1.0}
        distance={isFeverMode ? 7 : 5}
      />

      {/* Booster glow light */}
      {status === 'playing' && (
        <pointLight
          position={[0, 0.2, -0.4]}
          color={isFeverMode ? FEVER_COLOR : BOOSTER_FLAME}
          intensity={isFeverMode ? 3.0 : 1.5}
          distance={isFeverMode ? 5 : 3}
        />
      )}
    </group>
  );
}
