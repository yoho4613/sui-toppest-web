/**
 * Space Background Component
 *
 * Optimized: Single star layer, simplified grid using merged geometry,
 * no dynamic lights (all materials are MeshBasicMaterial).
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';

// ============================================
// Stars Component (single layer, reduced count)
// ============================================

function Stars() {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 120;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 50;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = -5 - Math.random() * 30;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    const { status, currentSpeed } = useGameStore.getState();
    if (ref.current && status === 'playing') {
      ref.current.position.x -= currentSpeed * delta * 0.15;
      if (ref.current.position.x < -25) {
        ref.current.position.x += 50;
      }
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={120}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.7}
      />
    </points>
  );
}

// ============================================
// Grid (merged into single line geometry)
// ============================================

function Grid() {
  const ref = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const verts: number[] = [];

    // Horizontal lines (fewer: every 3 units)
    for (let y = -6; y <= 6; y += 3) {
      verts.push(-30, y, -5, 30, y, -5);
    }

    // Vertical lines (fewer: every 8 units)
    for (let x = -30; x <= 30; x += 8) {
      verts.push(x, -6, -5, x, 6, -5);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, []);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#1a1a3a', transparent: true, opacity: 0.3 }),
    []
  );

  useFrame((_, delta) => {
    const { status, currentSpeed } = useGameStore.getState();
    if (ref.current && status === 'playing') {
      ref.current.position.x -= currentSpeed * delta * 0.5;
      if (ref.current.position.x < -8) {
        ref.current.position.x += 8;
      }
    }
  });

  return <lineSegments ref={ref} geometry={geometry} material={material} />;
}

// ============================================
// Main Background Component
// ============================================

export function Background() {
  return (
    <group>
      {/* Dark space background plane */}
      <mesh position={[0, 0, -20]}>
        <planeGeometry args={[60, 30]} />
        <meshBasicMaterial color="#0a0a1a" />
      </mesh>

      {/* Grid for depth perception (single merged geometry) */}
      <Grid />

      {/* Stars (single layer, 120 particles) */}
      <Stars />

    </group>
  );
}

export default Background;
