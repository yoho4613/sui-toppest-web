/**
 * Bird (Player) Component
 *
 * A small spaceship that the player controls.
 * Optimized: MeshBasicMaterial (no lighting calc), no pointLight,
 * cached elapsed time instead of Date.now(), reduced geometry segments.
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';
import { PHYSICS, VISUALS, ITEM_EFFECTS } from '../constants';

export function Bird() {
  const groupRef = useRef<THREE.Group>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const elapsedRef = useRef(0);

  const getState = useGameStore.getState;

  // MeshBasicMaterial: no lighting calculation needed (huge perf win)
  const bodyMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: VISUALS.PLAYER_COLOR }),
    []
  );

  const wingMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#1e3a5f' }),
    []
  );

  const flameMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ff6b00',
        transparent: true,
        opacity: 0.8,
      }),
    []
  );

  const shieldMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: VISUALS.SHIELD_COLOR,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      }),
    []
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    elapsedRef.current += delta;
    const t = elapsedRef.current;

    const { playerY, velocity, hasShield, status, shieldEndTime } = getState();

    // Update position
    groupRef.current.position.y = playerY;

    // Update rotation based on velocity
    const targetRotation = THREE.MathUtils.clamp(velocity * 2, -0.8, 1.2);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      -targetRotation,
      delta * 8
    );

    // Animate flame (use cached elapsed time, not Date.now())
    if (flameRef.current) {
      const flameScale = status === 'playing' ? 1 + Math.sin(t * 20) * 0.3 : 0.5;
      flameRef.current.scale.setScalar(flameScale);
    }

    // Shield visibility and blink
    if (shieldRef.current) {
      if (hasShield) {
        const timeRemaining = shieldEndTime - Date.now();
        const shouldBlink = timeRemaining < ITEM_EFFECTS.SHIELD_BLINK_AT;
        const blinkOn = shouldBlink ? Math.sin(t * 10) > 0 : true;

        shieldRef.current.visible = blinkOn;
        shieldRef.current.rotation.y += delta * 2;
      } else {
        shieldRef.current.visible = false;
      }
    }
  });

  const hasShield = useGameStore((s) => s.hasShield);

  return (
    <group ref={groupRef} position={[PHYSICS.PLAYER_X, 0, 0]}>
      {/* Main body */}
      <mesh material={bodyMaterial}>
        <capsuleGeometry args={[0.2, 0.4, 4, 8]} />
      </mesh>

      {/* Cockpit */}
      <mesh position={[0.15, 0.1, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color="#4dd0e1" transparent opacity={0.9} />
      </mesh>

      {/* Left wing */}
      <mesh position={[-0.1, 0, 0.25]} rotation={[0, 0, -0.2]} material={wingMaterial}>
        <boxGeometry args={[0.3, 0.05, 0.4]} />
      </mesh>

      {/* Right wing */}
      <mesh position={[-0.1, 0, -0.25]} rotation={[0, 0, -0.2]} material={wingMaterial}>
        <boxGeometry args={[0.3, 0.05, 0.4]} />
      </mesh>

      {/* Engine flame */}
      <mesh ref={flameRef} position={[-0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={flameMaterial}>
        <coneGeometry args={[0.12, 0.4, 6]} />
      </mesh>

      {/* Shield effect */}
      <mesh ref={shieldRef} visible={hasShield} material={shieldMaterial}>
        <sphereGeometry args={[0.6, 8, 8]} />
      </mesh>

    </group>
  );
}

export default Bird;
