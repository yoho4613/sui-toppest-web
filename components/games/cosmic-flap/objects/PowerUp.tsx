/**
 * PowerUp (Item) Component
 *
 * Collectible items that spawn in pipe gaps.
 * Types: Coin (gold), Shield (green), Slow (blue)
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

const TYPE_COLORS: Record<PowerUpType, string> = {
  coin: VISUALS.COIN_COLOR,
  shield: VISUALS.SHIELD_COLOR,
  slow: VISUALS.SLOW_COLOR,
};

export function PowerUp({ position, type }: PowerUpProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsedRef = useRef(0);

  const color = TYPE_COLORS[type];

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color }),
    [color]
  );

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const t = elapsedRef.current;

    if (meshRef.current) {
      // Rotate for visibility
      meshRef.current.rotation.y += delta * 3;
      // Bob up/down RELATIVE to parent group (parent is already at gapY)
      meshRef.current.position.y = Math.sin(t * 3) * 0.15;
    }
  });

  // Item sizes - larger for better visibility
  const size = VISUALS.ITEM_SIZE;

  return (
    <group position={position}>
      {type === 'coin' && (
        <mesh ref={meshRef} material={material}>
          <cylinderGeometry args={[size, size, 0.12, 12]} />
        </mesh>
      )}

      {type === 'shield' && (
        <mesh ref={meshRef} material={material}>
          <octahedronGeometry args={[size * 0.7]} />
        </mesh>
      )}

      {type === 'slow' && (
        <mesh ref={meshRef} material={material}>
          <torusGeometry args={[size * 0.5, size * 0.15, 8, 16]} />
        </mesh>
      )}
    </group>
  );
}

export default PowerUp;
