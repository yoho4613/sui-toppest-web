/**
 * PowerUp (Item) Component
 *
 * Collectible items that spawn in pipe gaps.
 * Types: Coin (gold), Shield (green), Slow/Clock (blue)
 *
 * Position: parent group is already at (obs.x, obs.gapY, 0),
 * so all mesh positions are RELATIVE (centered at 0,0,0).
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VISUALS } from '../constants';

export type PowerUpType = 'coin' | 'shield' | 'slow';

interface PowerUpProps {
  position: [number, number, number];
  type: PowerUpType;
  id: string;
}

export function PowerUp({ position, type }: PowerUpProps) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);

  const size = VISUALS.ITEM_SIZE;

  // Shared materials (useMemo per type)
  const coinMat = useMemo(() => new THREE.MeshBasicMaterial({ color: VISUALS.COIN_COLOR }), []);
  const coinDarkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#b8860b' }), []);
  const coinSymbolMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#8B6914' }), []);

  const shieldMat = useMemo(() => new THREE.MeshBasicMaterial({ color: VISUALS.SHIELD_COLOR }), []);
  const shieldDarkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#15803d' }), []);
  const shieldCenterMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#bbf7d0' }), []);

  const clockMat = useMemo(() => new THREE.MeshBasicMaterial({ color: VISUALS.SLOW_COLOR }), []);
  const clockFaceMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#dbeafe' }), []);
  const clockHandMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1e3a5f' }), []);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const t = elapsedRef.current;

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 2.5;
      // Bob around base position (position[1] = gapY), not around y=0
      groupRef.current.position.y = position[1] + Math.sin(t * 3) * 0.15;
    }
  });

  return (
    <group position={position} ref={groupRef}>
      {type === 'coin' && <CoinModel size={size} mainMat={coinMat} darkMat={coinDarkMat} symbolMat={coinSymbolMat} />}
      {type === 'shield' && <ShieldModel size={size} mainMat={shieldMat} darkMat={shieldDarkMat} centerMat={shieldCenterMat} />}
      {type === 'slow' && <ClockModel size={size} frameMat={clockMat} faceMat={clockFaceMat} handMat={clockHandMat} />}
    </group>
  );
}

// ============================================
// Coin: flat disc with raised edge ring + "$" mark
// ============================================

function CoinModel({
  size,
  mainMat,
  darkMat,
  symbolMat,
}: {
  size: number;
  mainMat: THREE.MeshBasicMaterial;
  darkMat: THREE.MeshBasicMaterial;
  symbolMat: THREE.MeshBasicMaterial;
}) {
  const r = size * 0.5;
  return (
    <group>
      {/* Outer edge ring */}
      <mesh material={darkMat} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r, r * 0.18, 8, 16]} />
      </mesh>
      {/* Front face */}
      <mesh material={mainMat} position={[0, 0, 0]}>
        <cylinderGeometry args={[r * 0.85, r * 0.85, 0.08, 16]} />
      </mesh>
      {/* Center "$" mark - vertical bar */}
      <mesh material={symbolMat} position={[0, 0, 0.05]}>
        <boxGeometry args={[r * 0.12, r * 0.9, 0.02]} />
      </mesh>
      {/* Center "$" mark - top curve */}
      <mesh material={symbolMat} position={[0, r * 0.18, 0.05]}>
        <boxGeometry args={[r * 0.5, r * 0.12, 0.02]} />
      </mesh>
      {/* Center "$" mark - bottom curve */}
      <mesh material={symbolMat} position={[0, -r * 0.18, 0.05]}>
        <boxGeometry args={[r * 0.5, r * 0.12, 0.02]} />
      </mesh>
    </group>
  );
}

// ============================================
// Shield: flat shield shape (pentagon-ish) with cross
// ============================================

function ShieldModel({
  size,
  mainMat,
  darkMat,
  centerMat,
}: {
  size: number;
  mainMat: THREE.MeshBasicMaterial;
  darkMat: THREE.MeshBasicMaterial;
  centerMat: THREE.MeshBasicMaterial;
}) {
  const s = size * 0.55;

  // Shield shape using custom geometry
  const shieldGeo = useMemo(() => {
    const shape = new THREE.Shape();
    // Shield outline (top rounded, bottom pointed)
    shape.moveTo(0, s * 0.9);       // top center
    shape.quadraticCurveTo(s * 0.9, s * 0.9, s * 0.8, s * 0.3);  // top-right curve
    shape.lineTo(s * 0.6, -s * 0.3);   // right side
    shape.quadraticCurveTo(0, -s * 1.0, 0, -s * 1.0); // bottom point (right)
    shape.quadraticCurveTo(0, -s * 1.0, -s * 0.6, -s * 0.3); // bottom point (left)
    shape.lineTo(-s * 0.8, s * 0.3);   // left side
    shape.quadraticCurveTo(-s * 0.9, s * 0.9, 0, s * 0.9); // top-left curve

    const extrudeSettings = { depth: 0.1, bevelEnabled: false };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [s]);

  return (
    <group>
      {/* Shield body */}
      <mesh geometry={shieldGeo} material={mainMat} position={[0, 0, -0.05]} />
      {/* Border - slightly larger behind */}
      <mesh geometry={shieldGeo} material={darkMat} position={[0, 0, -0.08]} scale={[1.1, 1.1, 0.5]} />
      {/* Center cross - vertical */}
      <mesh material={centerMat} position={[0, -0.05, 0.06]}>
        <boxGeometry args={[s * 0.15, s * 1.2, 0.02]} />
      </mesh>
      {/* Center cross - horizontal */}
      <mesh material={centerMat} position={[0, s * 0.2, 0.06]}>
        <boxGeometry args={[s * 0.8, s * 0.15, 0.02]} />
      </mesh>
    </group>
  );
}

// ============================================
// Clock: circular face with hour/minute hands
// ============================================

function ClockModel({
  size,
  frameMat,
  faceMat,
  handMat,
}: {
  size: number;
  frameMat: THREE.MeshBasicMaterial;
  faceMat: THREE.MeshBasicMaterial;
  handMat: THREE.MeshBasicMaterial;
}) {
  const r = size * 0.5;
  const hourHandRef = useRef<THREE.Mesh>(null);
  const minuteHandRef = useRef<THREE.Mesh>(null);

  // Animate clock hands
  useFrame((_, delta) => {
    if (minuteHandRef.current) {
      minuteHandRef.current.rotation.z -= delta * 4; // fast spin
    }
    if (hourHandRef.current) {
      hourHandRef.current.rotation.z -= delta * 1.5; // slower spin
    }
  });

  return (
    <group>
      {/* Outer frame ring */}
      <mesh material={frameMat} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r, r * 0.15, 8, 20]} />
      </mesh>
      {/* Clock face (white disc) */}
      <mesh material={faceMat}>
        <cylinderGeometry args={[r * 0.88, r * 0.88, 0.06, 16]} />
      </mesh>
      {/* Hour markers (12, 3, 6, 9 positions) */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={i}
          material={handMat}
          position={[
            Math.sin(angle) * r * 0.65,
            0.04,
            Math.cos(angle) * r * 0.65,
          ]}
        >
          <boxGeometry args={[0.04, 0.02, 0.08]} />
        </mesh>
      ))}
      {/* Center dot */}
      <mesh material={handMat} position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.03, 6]} />
      </mesh>
      {/* Minute hand (long) */}
      <mesh ref={minuteHandRef} material={handMat} position={[0, 0.05, 0]}>
        <group>
          <mesh position={[0, 0, r * 0.3]}>
            <boxGeometry args={[0.03, 0.02, r * 0.55]} />
          </mesh>
        </group>
      </mesh>
      {/* Hour hand (short) */}
      <mesh ref={hourHandRef} material={handMat} position={[0, 0.06, 0]}>
        <group>
          <mesh position={[r * 0.18, 0, 0]}>
            <boxGeometry args={[r * 0.4, 0.025, 0.04]} />
          </mesh>
        </group>
      </mesh>
    </group>
  );
}

export default PowerUp;
