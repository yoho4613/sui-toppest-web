'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';

const TRACK_LENGTH = 120; // Extended to cover camera area (camera at z=8)
const TRACK_WIDTH = 10;  // Narrower for mobile visibility
const LANE_WIDTH = 2.5;  // Reduced for mobile - prevents player cutoff
const SEGMENT_COUNT = 20; // More segments for denser grid
const WALL_HEIGHT = 5;   // Taller walls for better visibility
const WALL_LED_SPACING = 12; // Spacing between wall LEDs

export function Track() {
  // Separate ref for moving elements only (grid lines)
  const movingGroupRef = useRef<THREE.Group>(null);
  // Separate refs for moving wall LEDs
  const leftWallLedsRef = useRef<THREE.Group>(null);
  const rightWallLedsRef = useRef<THREE.Group>(null);
  // Refs for pulsing animations
  const laneDividerRefs = useRef<THREE.Mesh[]>([]);
  const wallLedRefs = useRef<THREE.Mesh[]>([]);

  // Only subscribe to status and isFeverMode (rarely change, needed for JSX styling)
  // Distance is accessed via getState() in useFrame to avoid per-frame re-renders
  const status = useGameStore((state) => state.status);
  const isFeverMode = useGameStore((state) => state.isFeverMode);
  const prevDistance = useRef(0);
  const pulseTime = useRef(0);

  // Create track segments for grid lines (horizontal + vertical for grid pattern)
  const horizontalSegments = useMemo(() => {
    return Array.from({ length: SEGMENT_COUNT }, (_, i) => ({
      id: i,
      zOffset: i * (TRACK_LENGTH / SEGMENT_COUNT),
    }));
  }, []);

  // Vertical grid lines (perpendicular to movement)
  const verticalLines = useMemo(() => {
    const lines = [];
    const spacing = 1.5; // Grid cell spacing
    for (let x = -TRACK_WIDTH / 2 + spacing; x < TRACK_WIDTH / 2; x += spacing) {
      lines.push({ x, id: `v-${x}` });
    }
    return lines;
  }, []);

  // Create wall LED segments - more frequent
  const wallLedSegments = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      zOffset: i * 12,
    }));
  }, []);

  // Move grid lines and animate pulsing effects
  useFrame((_, delta) => {
    if (status !== 'playing') return;

    // Get distance via getState() to avoid subscription re-renders
    const { distance, isFeverMode: currentFeverMode } = useGameStore.getState();

    // Update pulse time
    pulseTime.current += delta * 3;
    const feverPulseIntensity = 0.3 + Math.sin(pulseTime.current * 2) * 0.7;

    // Animate lane divider glow
    laneDividerRefs.current.forEach((mesh, index) => {
      if (mesh?.material && 'emissiveIntensity' in mesh.material) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        const offset = index * 0.5;
        material.emissiveIntensity = currentFeverMode
          ? feverPulseIntensity + Math.sin(pulseTime.current + offset) * 0.3
          : 0.6 + Math.sin(pulseTime.current + offset) * 0.3;
      }
    });

    // Animate wall LEDs
    wallLedRefs.current.forEach((mesh, index) => {
      if (mesh?.material && 'emissiveIntensity' in mesh.material) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        const offset = index * 0.3;
        material.emissiveIntensity = currentFeverMode
          ? 1.5 + Math.sin(pulseTime.current * 2 + offset) * 0.5
          : 0.8 + Math.sin(pulseTime.current + offset) * 0.4;
      }
    });

    // Move grid lines
    if (movingGroupRef.current) {
      const deltaDistance = distance - prevDistance.current;
      prevDistance.current = distance;

      movingGroupRef.current.children.forEach((child) => {
        child.position.z += deltaDistance;
        if (child.position.z > 10) {
          child.position.z -= TRACK_LENGTH;
        }
      });

      // Move wall LEDs (same looping logic)
      const wallLedLoopLength = WALL_LED_SPACING * 8; // 8 LED segments
      [leftWallLedsRef.current, rightWallLedsRef.current].forEach((wallGroup) => {
        if (wallGroup) {
          wallGroup.children.forEach((child) => {
            child.position.z += deltaDistance;
            if (child.position.z > 10) {
              child.position.z -= wallLedLoopLength;
            }
          });
        }
      });
    }
  });

  // Colors - Cyberpunk neon theme with clear contrast
  const floorColor = isFeverMode ? '#1a0825' : '#0a0a15'; // Darker floor
  const laneColor = isFeverMode ? '#2d1540' : '#151520';
  const wallColor = isFeverMode ? '#3a1850' : '#1a2a3a'; // Blue-tinted walls
  const lineColor = isFeverMode ? '#ff00ff' : '#00ff88';
  const accentColor = isFeverMode ? '#ff66ff' : '#00ddff';
  const gridColor = isFeverMode ? '#660066' : '#1a4040'; // Subtle grid

  return (
    <group>
      {/* === STATIC ELEMENTS (do not move) === */}

      {/* Main floor - dark base for contrast */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -TRACK_LENGTH / 2 + 10]} receiveShadow>
        <planeGeometry args={[TRACK_WIDTH, TRACK_LENGTH]} />
        <meshStandardMaterial
          color={floorColor}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      {/* Lane surfaces - each lane has distinct subtle coloring */}
      {[-1, 0, 1].map((lane) => (
        <mesh
          key={`lane-${lane}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[lane * LANE_WIDTH, -0.01, -TRACK_LENGTH / 2 + 10]}
          receiveShadow
        >
          <planeGeometry args={[LANE_WIDTH - 0.4, TRACK_LENGTH]} />
          <meshStandardMaterial
            color={lane === 0 ? laneColor : floorColor}
            emissive={lane === 0 ? lineColor : floorColor}
            emissiveIntensity={lane === 0 ? 0.05 : 0.02}
            metalness={0.5}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* Static vertical grid lines for depth perception */}
      {verticalLines.map((line) => (
        <mesh
          key={line.id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[line.x, 0.001, -TRACK_LENGTH / 2 + 10]}
        >
          <planeGeometry args={[0.03, TRACK_LENGTH]} />
          <meshStandardMaterial
            color={gridColor}
            emissive={gridColor}
            emissiveIntensity={0.3}
            transparent
            opacity={0.5}
          />
        </mesh>
      ))}

      {/* 3D Lane divider rails with pulsing glow */}
      {[-LANE_WIDTH / 2 - LANE_WIDTH, -LANE_WIDTH / 2, LANE_WIDTH / 2, LANE_WIDTH / 2 + LANE_WIDTH].map(
        (x, i) => (
          <group key={`divider-${i}`}>
            {/* Rail base - metallic */}
            <mesh position={[x, 0.06, -TRACK_LENGTH / 2 + 10]}>
              <boxGeometry args={[0.18, 0.12, TRACK_LENGTH]} />
              <meshStandardMaterial
                color="#181820"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
            {/* Inner glow channel */}
            <mesh position={[x, 0.08, -TRACK_LENGTH / 2 + 10]}>
              <boxGeometry args={[0.06, 0.04, TRACK_LENGTH]} />
              <meshStandardMaterial
                color={lineColor}
                emissive={lineColor}
                emissiveIntensity={0.4}
              />
            </mesh>
            {/* Glowing top line with pulsing */}
            <mesh
              ref={(el) => {
                if (el) laneDividerRefs.current[i] = el;
              }}
              position={[x, 0.13, -TRACK_LENGTH / 2 + 10]}
            >
              <boxGeometry args={[0.1, 0.03, TRACK_LENGTH]} />
              <meshStandardMaterial
                color={lineColor}
                emissive={lineColor}
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>
        )
      )}

      {/* Side walls - taller with distinct cyberpunk style */}
      {[-1, 1].map((side) => (
        <group key={`wall-group-${side}`}>
          {/* Wall base - darker foundation */}
          <mesh position={[side * (TRACK_WIDTH / 2 + 0.5), 0.3, -TRACK_LENGTH / 2 + 10]}>
            <boxGeometry args={[1.0, 0.6, TRACK_LENGTH]} />
            <meshStandardMaterial
              color="#101015"
              metalness={0.7}
              roughness={0.4}
            />
          </mesh>

          {/* Main wall body - visible but not distracting */}
          <mesh position={[side * (TRACK_WIDTH / 2 + 0.5), WALL_HEIGHT / 2 + 0.3, -TRACK_LENGTH / 2 + 10]}>
            <boxGeometry args={[0.9, WALL_HEIGHT - 0.6, TRACK_LENGTH]} />
            <meshStandardMaterial
              color={wallColor}
              emissive={wallColor}
              emissiveIntensity={0.1}
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>

          {/* Wall inner edge - bright neon strip at bottom (danger zone indicator) */}
          <mesh position={[side * (TRACK_WIDTH / 2 + 0.05), 0.15, -TRACK_LENGTH / 2 + 10]}>
            <boxGeometry args={[0.1, 0.3, TRACK_LENGTH]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={1.2}
            />
          </mesh>

          {/* Wall horizontal accent lines */}
          {[1.5, 3.0, 4.5].map((y) => (
            <mesh
              key={`wall-line-${side}-${y}`}
              position={[side * (TRACK_WIDTH / 2 + 0.1), y, -TRACK_LENGTH / 2 + 10]}
            >
              <boxGeometry args={[0.04, 0.06, TRACK_LENGTH]} />
              <meshStandardMaterial
                color={gridColor}
                emissive={gridColor}
                emissiveIntensity={0.5}
              />
            </mesh>
          ))}

          {/* Wall top edge - bright neon strip */}
          <mesh position={[side * (TRACK_WIDTH / 2 + 0.5), WALL_HEIGHT + 0.1, -TRACK_LENGTH / 2 + 10]}>
            <boxGeometry args={[1.0, 0.12, TRACK_LENGTH]} />
            <meshStandardMaterial
              color={lineColor}
              emissive={lineColor}
              emissiveIntensity={0.9}
            />
          </mesh>

        </group>
      ))}

      {/* === MOVING WALL LEDs (scroll with distance) === */}
      {/* Left wall LEDs */}
      <group ref={leftWallLedsRef}>
        {wallLedSegments.map((seg, idx) => (
          <mesh
            key={`led-left-${seg.id}`}
            ref={(el) => {
              if (el) wallLedRefs.current[idx] = el;
            }}
            position={[-(TRACK_WIDTH / 2 + 0.08), WALL_HEIGHT / 2 + 0.3, -seg.zOffset]}
          >
            <boxGeometry args={[0.06, WALL_HEIGHT - 0.8, 0.3]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={1.0}
            />
          </mesh>
        ))}
      </group>

      {/* Right wall LEDs */}
      <group ref={rightWallLedsRef}>
        {wallLedSegments.map((seg, idx) => (
          <mesh
            key={`led-right-${seg.id}`}
            ref={(el) => {
              if (el) wallLedRefs.current[idx + wallLedSegments.length] = el;
            }}
            position={[(TRACK_WIDTH / 2 + 0.08), WALL_HEIGHT / 2 + 0.3, -seg.zOffset]}
          >
            <boxGeometry args={[0.06, WALL_HEIGHT - 0.8, 0.3]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={1.0}
            />
          </mesh>
        ))}
      </group>

      {/* === MOVING ELEMENTS (scroll with distance) === */}
      <group ref={movingGroupRef}>
        {/* Horizontal grid lines for movement/speed perception */}
        {horizontalSegments.map((seg) => (
          <group key={seg.id} position={[0, 0, -seg.zOffset]}>
            {/* Main bright line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
              <planeGeometry args={[TRACK_WIDTH - 0.5, 0.08]} />
              <meshStandardMaterial
                color={lineColor}
                emissive={lineColor}
                emissiveIntensity={0.7}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Secondary thinner line for density */}
            {seg.id % 2 === 0 && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, TRACK_LENGTH / SEGMENT_COUNT / 2]}>
                <planeGeometry args={[TRACK_WIDTH - 1.5, 0.04]} />
                <meshStandardMaterial
                  color={gridColor}
                  emissive={gridColor}
                  emissiveIntensity={0.4}
                  transparent
                  opacity={0.6}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

export function Environment() {
  const isFeverMode = useGameStore((state) => state.isFeverMode);
  const difficulty = useGameStore((state) => state.difficulty);

  // Background color based on difficulty - darker for better contrast
  const getBgColor = () => {
    if (isFeverMode) return '#0a000a';
    switch (difficulty) {
      case 'tutorial':
        return '#020208';
      case 'easy':
        return '#020408';
      case 'medium':
        return '#030504';
      case 'hard':
        return '#050202';
      case 'extreme':
        return '#020202';
      default:
        return '#020208';
    }
  };

  const primaryColor = isFeverMode ? '#ff00ff' : '#00ff88';
  const secondaryColor = isFeverMode ? '#ff66cc' : '#00ddff';

  return (
    <>
      {/* Ambient light - balanced for visibility without washing out neon */}
      <ambientLight intensity={0.5} />

      {/* Main directional light from above */}
      <directionalLight
        position={[0, 15, 5]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        color={isFeverMode ? '#ffccff' : '#ffffff'}
      />

      {/* Secondary directional from behind */}
      <directionalLight
        position={[0, 8, -30]}
        intensity={0.6}
        color={primaryColor}
      />

      {/* Track edge lights - create cyberpunk glow */}
      <pointLight
        position={[-6, 3, -20]}
        color={primaryColor}
        intensity={isFeverMode ? 5 : 3}
        distance={50}
      />
      <pointLight
        position={[6, 3, -40]}
        color={secondaryColor}
        intensity={isFeverMode ? 5 : 3}
        distance={50}
      />
      <pointLight
        position={[0, 2, -60]}
        color={primaryColor}
        intensity={isFeverMode ? 4 : 2}
        distance={40}
      />

      {/* Overhead spotlight for player area */}
      <spotLight
        position={[0, 12, 5]}
        angle={0.5}
        penumbra={0.6}
        intensity={isFeverMode ? 2 : 1.2}
        color={isFeverMode ? '#ffccff' : '#ffffff'}
        castShadow
      />

      {/* Low rim lights for floor edge visibility */}
      <pointLight
        position={[-5, 0.5, 0]}
        color={secondaryColor}
        intensity={1.5}
        distance={15}
      />
      <pointLight
        position={[5, 0.5, 0]}
        color={secondaryColor}
        intensity={1.5}
        distance={15}
      />

      {/* Fog for depth - creates atmosphere (starts further to prevent pop-in) */}
      <fog attach="fog" args={[getBgColor(), 60, 120]} />

      {/* Background */}
      <color attach="background" args={[getBgColor()]} />
    </>
  );
}
