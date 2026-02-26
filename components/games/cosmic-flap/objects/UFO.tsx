/**
 * UFO Obstacle Component
 *
 * A flying saucer obstacle with:
 * - Ellipsoid body
 * - Cockpit dome
 * - Rim accent line
 * All MeshBasicMaterial (no lighting needed).
 */

'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { VISUALS } from '../constants';

export function UFO() {
  const w = VISUALS.UFO_SIZE.width;
  const h = VISUALS.UFO_SIZE.height;

  const bodyMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: VISUALS.UFO_COLOR }),
    []
  );
  const domeMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ff7777' }),
    []
  );
  const rimMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffaaaa',
        transparent: true,
        opacity: 0.7,
      }),
    []
  );
  const beamMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: VISUALS.UFO_COLOR,
        transparent: true,
        opacity: 0.25,
      }),
    []
  );

  return (
    <group>
      {/* Saucer body - ellipsoid */}
      <mesh scale={[1, 0.35, 0.6]} material={bodyMaterial}>
        <sphereGeometry args={[w / 2, 16, 12]} />
      </mesh>

      {/* Cockpit dome */}
      <mesh position={[0, h * 0.18, 0]} material={domeMaterial}>
        <sphereGeometry args={[w / 5, 12, 8]} />
      </mesh>

      {/* Rim accent line */}
      <mesh material={rimMaterial}>
        <boxGeometry args={[w * 0.95, 0.04, 0.04]} />
      </mesh>

      {/* Bottom beam glow */}
      <mesh position={[0, -h * 0.3, 0]} scale={[1, 0.3, 0.5]} material={beamMaterial}>
        <sphereGeometry args={[w / 4, 10, 8]} />
      </mesh>
    </group>
  );
}

export default UFO;
