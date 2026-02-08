'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';

const TRACK_LENGTH = 120; // Extended to cover camera area (camera at z=8)
const TRACK_WIDTH = 10;  // Narrower for mobile visibility
const LANE_WIDTH = 2.5;  // Reduced for mobile - prevents player cutoff
const SEGMENT_COUNT = 12;
const WALL_HEIGHT = 4;

export function Track() {
  // Separate ref for moving elements only (grid lines)
  const movingGroupRef = useRef<THREE.Group>(null);
  const distance = useGameStore((state) => state.distance);
  const status = useGameStore((state) => state.status);
  const isFeverMode = useGameStore((state) => state.isFeverMode);
  const prevDistance = useRef(0);

  // Create track segments for grid lines
  const segments = useMemo(() => {
    return Array.from({ length: SEGMENT_COUNT }, (_, i) => ({
      id: i,
      zOffset: i * (TRACK_LENGTH / SEGMENT_COUNT),
    }));
  }, []);

  // Create wall LED segments
  const wallLedSegments = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      zOffset: i * 20,
    }));
  }, []);

  // Move only grid lines based on distance
  useFrame(() => {
    if (!movingGroupRef.current || status !== 'playing') return;

    const deltaDistance = distance - prevDistance.current;
    prevDistance.current = distance;

    movingGroupRef.current.children.forEach((child) => {
      child.position.z += deltaDistance;
      if (child.position.z > 10) {
        child.position.z -= TRACK_LENGTH;
      }
    });
  });

  // Colors - BRIGHT and clearly visible
  const floorColor = isFeverMode ? '#3d2055' : '#2a2a3a';
  const laneColor = isFeverMode ? '#4d3065' : '#353548';
  const wallColor = isFeverMode ? '#5a3070' : '#404055';
  const lineColor = isFeverMode ? '#ff00ff' : '#00ff88';
  const accentColor = isFeverMode ? '#ff66ff' : '#00ffff';

  return (
    <group>
      {/* === STATIC ELEMENTS (do not move) === */}

      {/* Main floor - visible base (extends past camera at z=8) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -TRACK_LENGTH / 2 + 10]} receiveShadow>
        <planeGeometry args={[TRACK_WIDTH, TRACK_LENGTH]} />
        <meshStandardMaterial
          color={floorColor}
          emissive={floorColor}
          emissiveIntensity={0.1}
          metalness={0.2}
          roughness={0.7}
        />
      </mesh>

      {/* Lane surfaces - bright and visible */}
      {[-1, 0, 1].map((lane) => (
        <mesh
          key={`lane-${lane}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[lane * LANE_WIDTH, 0.01, -TRACK_LENGTH / 2 + 10]}
          receiveShadow
        >
          <planeGeometry args={[LANE_WIDTH - 0.3, TRACK_LENGTH]} />
          <meshStandardMaterial
            color={lane === 0 ? laneColor : floorColor}
            emissive={lane === 0 ? laneColor : floorColor}
            emissiveIntensity={0.15}
            metalness={0.2}
            roughness={0.6}
          />
        </mesh>
      ))}

      {/* 3D Lane divider rails */}
      {[-LANE_WIDTH / 2 - LANE_WIDTH, -LANE_WIDTH / 2, LANE_WIDTH / 2, LANE_WIDTH / 2 + LANE_WIDTH].map(
        (x, i) => (
          <group key={`divider-${i}`}>
            {/* Rail base */}
            <mesh position={[x, 0.05, -TRACK_LENGTH / 2 + 10]}>
              <boxGeometry args={[0.15, 0.1, TRACK_LENGTH]} />
              <meshStandardMaterial
                color="#222230"
                metalness={0.6}
                roughness={0.4}
              />
            </mesh>
            {/* Glowing top line */}
            <mesh position={[x, 0.11, -TRACK_LENGTH / 2 + 10]}>
              <boxGeometry args={[0.08, 0.02, TRACK_LENGTH]} />
              <meshStandardMaterial
                color={lineColor}
                emissive={lineColor}
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>
        )
      )}

      {/* Side walls - bright and clearly visible */}
      {[-1, 1].map((side) => (
        <group key={`wall-group-${side}`}>
          {/* Main wall body - solid bright */}
          <mesh position={[side * (TRACK_WIDTH / 2 + 0.4), WALL_HEIGHT / 2, -TRACK_LENGTH / 2 + 10]}>
            <boxGeometry args={[0.8, WALL_HEIGHT, TRACK_LENGTH]} />
            <meshStandardMaterial
              color={wallColor}
              emissive={wallColor}
              emissiveIntensity={0.2}
              metalness={0.2}
              roughness={0.6}
            />
          </mesh>

          {/* Wall inner edge - bright neon strip at bottom */}
          <mesh position={[side * (TRACK_WIDTH / 2), 0.2, -TRACK_LENGTH / 2 + 10]}>
            <boxGeometry args={[0.15, 0.4, TRACK_LENGTH]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={1.5}
            />
          </mesh>

          {/* Wall top edge - bright neon strip */}
          <mesh position={[side * (TRACK_WIDTH / 2 + 0.4), WALL_HEIGHT + 0.1, -TRACK_LENGTH / 2 + 10]}>
            <boxGeometry args={[0.9, 0.15, TRACK_LENGTH]} />
            <meshStandardMaterial
              color={lineColor}
              emissive={lineColor}
              emissiveIntensity={1.0}
            />
          </mesh>

          {/* Vertical LED strips on walls - static */}
          {wallLedSegments.map((seg) => (
            <mesh
              key={`led-${side}-${seg.id}`}
              position={[side * (TRACK_WIDTH / 2 + 0.05), WALL_HEIGHT / 2, -seg.zOffset]}
            >
              <boxGeometry args={[0.08, WALL_HEIGHT - 0.3, 0.4]} />
              <meshStandardMaterial
                color={accentColor}
                emissive={accentColor}
                emissiveIntensity={1.0}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* === MOVING ELEMENTS (scroll with distance) === */}
      <group ref={movingGroupRef}>
        {/* Grid lines on floor for movement perception */}
        {segments.map((seg) => (
          <mesh
            key={seg.id}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, -seg.zOffset]}
          >
            <planeGeometry args={[TRACK_WIDTH - 1, 0.12]} />
            <meshStandardMaterial
              color={lineColor}
              emissive={lineColor}
              emissiveIntensity={0.6}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}

      </group>
    </group>
  );
}

export function Environment() {
  const isFeverMode = useGameStore((state) => state.isFeverMode);
  const difficulty = useGameStore((state) => state.difficulty);

  // Background color based on difficulty
  const getBgColor = () => {
    if (isFeverMode) return '#150015';
    switch (difficulty) {
      case 'tutorial':
        return '#050510';
      case 'easy':
        return '#050812';
      case 'medium':
        return '#081008';
      case 'hard':
        return '#100505';
      case 'extreme':
        return '#050505';
      default:
        return '#050510';
    }
  };

  const lightColor = isFeverMode ? '#ff00ff' : '#00ff88';

  return (
    <>
      {/* Ambient light - very bright for floor visibility */}
      <ambientLight intensity={0.8} />

      {/* Main directional light - bright */}
      <directionalLight
        position={[0, 20, 5]}
        intensity={2.0}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Track edge lights */}
      <pointLight
        position={[-6, 2, -25]}
        color={lightColor}
        intensity={3}
        distance={40}
      />
      <pointLight
        position={[6, 2, -55]}
        color={isFeverMode ? '#ff00ff' : '#0088ff'}
        intensity={3}
        distance={40}
      />

      {/* Overhead spotlight for player area */}
      <spotLight
        position={[0, 10, 5]}
        angle={0.4}
        penumbra={0.5}
        intensity={1}
        color="#ffffff"
        castShadow
      />

      {/* Fog for depth - pushed back so floor is visible */}
      <fog attach="fog" args={[getBgColor(), 40, 100]} />

      {/* Background */}
      <color attach="background" args={[getBgColor()]} />
    </>
  );
}
