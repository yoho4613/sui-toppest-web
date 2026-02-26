/**
 * Space Background Component
 *
 * Multi-layer parallax space scene:
 * - Gradient sky (canvas texture)
 * - Nebula clouds (radial gradient textures)
 * - Distant planets with rings & shadows
 * - 3 star layers at different depths/speeds
 * - Subtle grid for depth perception
 *
 * All MeshBasicMaterial (no lighting calculations).
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';

// ============================================
// Gradient Background
// ============================================

function GradientSky() {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#020210');
    gradient.addColorStop(0.2, '#06061e');
    gradient.addColorStop(0.4, '#0d0a2a');
    gradient.addColorStop(0.5, '#140e30');
    gradient.addColorStop(0.6, '#0d0a2a');
    gradient.addColorStop(0.8, '#06061e');
    gradient.addColorStop(1, '#020210');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);
    return new THREE.CanvasTexture(canvas);
  }, []);

  if (!texture) return null;

  return (
    <mesh position={[0, 0, -30]}>
      <planeGeometry args={[80, 40]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

// ============================================
// Nebula Clouds (soft radial gradient)
// ============================================

function createNebulaTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.05)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

interface NebulaConfig {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  color: string;
  opacity: number;
}

function Nebulae() {
  const ref = useRef<THREE.Group>(null);

  const nebulaTexture = useMemo(() => createNebulaTexture(), []);

  const clouds: NebulaConfig[] = useMemo(
    () => [
      { x: 10, y: 4, z: -25, scaleX: 18, scaleY: 10, color: '#2a1055', opacity: 0.6 },
      { x: -15, y: -3, z: -24, scaleX: 14, scaleY: 8, color: '#0c2850', opacity: 0.5 },
      { x: 30, y: -1, z: -26, scaleX: 20, scaleY: 12, color: '#1e0a3d', opacity: 0.4 },
      { x: -30, y: 5, z: -23, scaleX: 12, scaleY: 7, color: '#0a2040', opacity: 0.45 },
      { x: 50, y: 2, z: -27, scaleX: 16, scaleY: 9, color: '#2d0a35', opacity: 0.35 },
      { x: -45, y: -4, z: -25, scaleX: 13, scaleY: 8, color: '#152050', opacity: 0.4 },
    ],
    []
  );

  useFrame((_, delta) => {
    const { status, currentSpeed } = useGameStore.getState();
    if (ref.current && status === 'playing') {
      ref.current.position.x -= currentSpeed * delta * 0.03;
      if (ref.current.position.x < -50) {
        ref.current.position.x += 100;
      }
    }
  });

  if (!nebulaTexture) return null;

  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]}>
          <planeGeometry args={[c.scaleX, c.scaleY]} />
          <meshBasicMaterial
            map={nebulaTexture}
            color={c.color}
            transparent
            opacity={c.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// ============================================
// Distant Planets
// ============================================

interface PlanetConfig {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  hasRing: boolean;
  ringColor?: string;
}

function Planets() {
  const ref = useRef<THREE.Group>(null);

  const planets: PlanetConfig[] = useMemo(
    () => [
      // 큰 보라 행성 (토성처럼 링 있음)
      { x: 18, y: 5.5, z: -22, radius: 2.0, color: '#2d1b69', hasRing: true, ringColor: '#5b3fa0' },
      // 작은 파란 행성
      { x: -22, y: -4, z: -20, radius: 0.7, color: '#1a4a6e', hasRing: false },
      // 붉은 행성 (화성)
      { x: 38, y: 3.5, z: -24, radius: 1.5, color: '#6b2020', hasRing: false },
      // 작은 초록 행성
      { x: -8, y: 7, z: -28, radius: 0.5, color: '#1a4a3e', hasRing: false },
      // 갈색 행성 (링 있음)
      { x: 55, y: -5, z: -21, radius: 1.2, color: '#5a3a1a', hasRing: true, ringColor: '#8a6a3a' },
    ],
    []
  );

  useFrame((_, delta) => {
    const { status, currentSpeed } = useGameStore.getState();
    if (ref.current && status === 'playing') {
      ref.current.position.x -= currentSpeed * delta * 0.06;
      if (ref.current.position.x < -60) {
        ref.current.position.x += 120;
      }
    }
  });

  return (
    <group ref={ref}>
      {planets.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          {/* Planet body */}
          <mesh>
            <sphereGeometry args={[p.radius, 20, 14]} />
            <meshBasicMaterial color={p.color} />
          </mesh>

          {/* Dark side shadow (hemisphere overlay) */}
          <mesh position={[p.radius * 0.15, 0, 0.02]} rotation={[0, -0.5, 0]}>
            <circleGeometry args={[p.radius * 0.99, 20]} />
            <meshBasicMaterial
              color="#000000"
              transparent
              opacity={0.45}
              depthWrite={false}
            />
          </mesh>

          {/* Atmosphere glow */}
          <mesh>
            <sphereGeometry args={[p.radius * 1.08, 16, 12]} />
            <meshBasicMaterial
              color={p.color}
              transparent
              opacity={0.15}
              depthWrite={false}
            />
          </mesh>

          {/* Ring */}
          {p.hasRing && (
            <mesh rotation={[Math.PI * 0.4, 0.3, 0.1]}>
              <torusGeometry args={[p.radius * 1.7, p.radius * 0.06, 8, 40]} />
              <meshBasicMaterial
                color={p.ringColor}
                transparent
                opacity={0.6}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

// ============================================
// Star Layer (parallax points)
// ============================================

function StarLayer({
  count,
  speed,
  size,
  color,
  spread,
  opacity,
}: {
  count: number;
  speed: number;
  size: number;
  color: string;
  spread: number;
  opacity: number;
}) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = -6 - Math.random() * 15;
    }
    return arr;
  }, [count, spread]);

  useFrame((_, delta) => {
    const { status, currentSpeed } = useGameStore.getState();
    if (ref.current && status === 'playing') {
      ref.current.position.x -= currentSpeed * delta * speed;
      if (ref.current.position.x < -spread / 2) {
        ref.current.position.x += spread;
      }
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
      />
    </points>
  );
}

// ============================================
// Shooting Stars (occasional streaks)
// ============================================

function ShootingStars() {
  const ref = useRef<THREE.Group>(null);
  const timerRef = useRef(0);
  const activeRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  } | null>(null);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.8,
      }),
    []
  );

  useFrame((_, delta) => {
    const { status } = useGameStore.getState();
    if (status !== 'playing' || !ref.current) return;

    timerRef.current += delta;

    // Spawn new shooting star every ~8 seconds
    if (!activeRef.current && timerRef.current > 6 + Math.random() * 4) {
      timerRef.current = 0;
      activeRef.current = {
        x: 10 + Math.random() * 10,
        y: 2 + Math.random() * 5,
        vx: -(15 + Math.random() * 10),
        vy: -(3 + Math.random() * 4),
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
      };
    }

    if (activeRef.current) {
      const s = activeRef.current;
      s.life += delta;
      s.x += s.vx * delta;
      s.y += s.vy * delta;

      const progress = s.life / s.maxLife;
      ref.current.position.set(s.x, s.y, -8);
      ref.current.rotation.z = Math.atan2(s.vy, s.vx);
      ref.current.scale.set(1 - progress * 0.5, 1, 1);
      ref.current.visible = true;
      material.opacity = 0.8 * (1 - progress);

      if (s.life >= s.maxLife) {
        activeRef.current = null;
        ref.current.visible = false;
      }
    }
  });

  return (
    <group ref={ref} visible={false}>
      {/* Streak line */}
      <mesh material={material}>
        <boxGeometry args={[1.5, 0.03, 0.01]} />
      </mesh>
      {/* Bright head */}
      <mesh position={[0.75, 0, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

// ============================================
// Grid (subtle depth perception)
// ============================================

function Grid() {
  const ref = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const verts: number[] = [];
    for (let y = -6; y <= 6; y += 3) {
      verts.push(-30, y, -5, 30, y, -5);
    }
    for (let x = -30; x <= 30; x += 8) {
      verts.push(x, -6, -5, x, 6, -5);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, []);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#1a1a3a', transparent: true, opacity: 0.12 }),
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
      {/* Layer 1: Gradient sky (furthest) */}
      <GradientSky />

      {/* Layer 2: Nebula clouds (very slow parallax) */}
      <Nebulae />

      {/* Layer 3: Distant planets (slow parallax) */}
      <Planets />

      {/* Layer 4: Stars - 3 depth layers */}
      <StarLayer count={50} speed={0.04} size={0.03} color="#aaaacc" spread={60} opacity={0.35} />
      <StarLayer count={80} speed={0.10} size={0.06} color="#ffffff" spread={50} opacity={0.55} />
      <StarLayer count={30} speed={0.18} size={0.10} color="#88ccff" spread={50} opacity={0.75} />

      {/* Layer 5: Shooting stars (occasional) */}
      <ShootingStars />

      {/* Layer 6: Grid (closest, subtle) */}
      <Grid />
    </group>
  );
}

export default Background;
