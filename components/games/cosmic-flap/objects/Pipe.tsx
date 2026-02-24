/**
 * Pipe (Laser Gate) Component
 *
 * A pair of vertical obstacles with a gap.
 * Features:
 * - Top and bottom pipes
 * - Glow effect
 * - Pass detection
 */

'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { WORLD, VISUALS } from '../constants';

interface PipeProps {
  position: [number, number, number];
  gapY: number;
  gapSize: number;
  id: string;
}

export function Pipe({ position, gapY, gapSize }: PipeProps) {
  // Calculate pipe heights
  const gapTop = gapY + gapSize / 2;
  const gapBottom = gapY - gapSize / 2;

  const topHeight = WORLD.MAX_Y - gapTop;
  const bottomHeight = gapBottom - WORLD.MIN_Y;

  const topY = gapTop + topHeight / 2;
  const bottomY = WORLD.MIN_Y + bottomHeight / 2;

  // Materials
  // MeshBasicMaterial: no lighting calculation (major perf win)
  const pipeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: VISUALS.PIPE_COLOR,
      }),
    []
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: VISUALS.PIPE_EMISSIVE,
        transparent: true,
        opacity: 0.5,
      }),
    []
  );

  return (
    <group position={position}>
      {/* Top pipe */}
      {topHeight > 0 && (
        <group position={[0, topY, 0]}>
          {/* Main body */}
          <mesh material={pipeMaterial}>
            <boxGeometry args={[VISUALS.PIPE_WIDTH, topHeight, VISUALS.PIPE_WIDTH]} />
          </mesh>
          {/* Glow edge at bottom */}
          <mesh position={[0, -topHeight / 2 + 0.05, 0]} material={glowMaterial}>
            <boxGeometry args={[VISUALS.PIPE_WIDTH + 0.1, 0.1, VISUALS.PIPE_WIDTH + 0.1]} />
          </mesh>
        </group>
      )}

      {/* Bottom pipe */}
      {bottomHeight > 0 && (
        <group position={[0, bottomY, 0]}>
          {/* Main body */}
          <mesh material={pipeMaterial}>
            <boxGeometry args={[VISUALS.PIPE_WIDTH, bottomHeight, VISUALS.PIPE_WIDTH]} />
          </mesh>
          {/* Glow edge at top */}
          <mesh position={[0, bottomHeight / 2 - 0.05, 0]} material={glowMaterial}>
            <boxGeometry args={[VISUALS.PIPE_WIDTH + 0.1, 0.1, VISUALS.PIPE_WIDTH + 0.1]} />
          </mesh>
        </group>
      )}

      {/* Center glow line (laser effect) */}
      <mesh position={[0, gapY, 0]}>
        <boxGeometry args={[0.02, gapSize, 0.02]} />
        <meshBasicMaterial color={VISUALS.PIPE_COLOR} transparent opacity={0.2} />
      </mesh>

      {/* Emissive glow edges replace expensive pointLights */}
    </group>
  );
}

export default Pipe;
