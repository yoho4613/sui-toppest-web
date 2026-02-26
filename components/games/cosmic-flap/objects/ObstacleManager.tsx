/**
 * Obstacle Manager
 *
 * Handles spawning, movement, collision detection, and cleanup of obstacles.
 * Supports three obstacle types:
 * - Pipe: Basic laser gate (from start)
 * - Tunnel: Multi-segment connected pipes (500m+)
 * - UFO: Moving saucer obstacle (1000m+), dual variant at 2000m+
 *
 * Uses ref-based game loop for performance (no React re-render per frame).
 * React state is only updated when obstacles are added/removed.
 */

'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';
import { Pipe } from './Pipe';
import { UFO } from './UFO';
import { PowerUp, PowerUpType } from './PowerUp';
import {
  WORLD,
  PHYSICS,
  VISUALS,
  ITEM_SPAWN,
  OBSTACLE_THRESHOLDS,
  OBSTACLE_SPAWN,
  TUNNEL,
  UFO as UFO_CONFIG,
} from '../constants';

// ============================================
// Types
// ============================================

type ObstacleType = 'pipe' | 'tunnel' | 'ufo';

interface TunnelSegment {
  gapY: number;
  offsetX: number; // relative to obstacle group x
}

interface UFOBody {
  baseY: number;
  offsetY: number;
  activated: boolean;
  direction: 'up' | 'down' | 'stationary';
  movePhase: number;
}

interface ObstacleData {
  id: string;
  type: ObstacleType;
  x: number;
  passed: boolean;

  // Pipe / Tunnel shared
  gapY: number;
  gapSize: number;

  // Tunnel
  segments?: TunnelSegment[];
  totalWidth?: number;

  // UFO
  ufoBodies?: UFOBody[];

  // Item (pipes and tunnels only)
  item?: {
    type: PowerUpType;
    collected: boolean;
    posX: number; // relative X within group
    posY: number; // Y position
  };
}

// ============================================
// Constants
// ============================================

const FIRST_SPAWN_X = 6;
const SPAWN_AHEAD_X = 25;
const DUAL_UFO_PROBABILITY = 0.35;

// ============================================
// Helper Functions
// ============================================

function selectObstacleType(distance: number): ObstacleType {
  const hasTunnel = distance >= OBSTACLE_THRESHOLDS.TUNNEL;
  const hasUFO = distance >= OBSTACLE_THRESHOLDS.UFO;

  if (!hasTunnel) return 'pipe';

  const rand = Math.random();

  if (!hasUFO) {
    // Pipe vs tunnel only (UFO not unlocked yet)
    return rand < OBSTACLE_SPAWN.TUNNEL ? 'tunnel' : 'pipe';
  }

  // All types available: 60% pipe, 15% tunnel, 25% UFO
  if (rand < OBSTACLE_SPAWN.PIPE) return 'pipe';
  if (rand < OBSTACLE_SPAWN.PIPE + OBSTACLE_SPAWN.TUNNEL) return 'tunnel';
  return 'ufo';
}

function getTunnelSegmentCount(distance: number): number {
  if (distance >= OBSTACLE_THRESHOLDS.EXTREME_TUNNEL) return TUNNEL.EXTREME_SEGMENTS;
  if (distance >= OBSTACLE_THRESHOLDS.LONG_TUNNEL) return TUNNEL.LONG_SEGMENTS;
  return TUNNEL.STANDARD_SEGMENTS;
}

function shouldSpawnDualUFO(distance: number): boolean {
  if (distance < OBSTACLE_THRESHOLDS.DUAL_UFO) return false;
  return Math.random() < DUAL_UFO_PROBABILITY;
}

function getObstacleRightEdge(obs: ObstacleData): number {
  if (obs.type === 'tunnel' && obs.totalWidth) {
    return obs.x + obs.totalWidth;
  }
  if (obs.type === 'ufo') {
    return obs.x + VISUALS.UFO_SIZE.width / 2;
  }
  return obs.x + VISUALS.PIPE_WIDTH / 2;
}

function randomItem(): { type: PowerUpType; collected: boolean } | undefined {
  if (Math.random() >= ITEM_SPAWN.CHANCE) return undefined;
  const rand = Math.random();
  let type: PowerUpType;
  if (rand < ITEM_SPAWN.SLOW) {
    type = 'slow';
  } else if (rand < ITEM_SPAWN.SLOW + ITEM_SPAWN.SHIELD) {
    type = 'shield';
  } else {
    type = 'coin';
  }
  return { type, collected: false };
}

// ============================================
// Spawn Functions
// ============================================

function spawnPipe(
  id: string,
  x: number,
  gapY: number,
  gapSize: number
): ObstacleData {
  const itemBase = randomItem();
  return {
    id,
    type: 'pipe',
    x,
    gapY,
    gapSize,
    passed: false,
    item: itemBase ? { ...itemBase, posX: 0, posY: gapY } : undefined,
  };
}

function spawnTunnel(
  id: string,
  x: number,
  baseGapY: number,
  distance: number
): ObstacleData {
  const segmentCount = getTunnelSegmentCount(distance);
  const gapSize = TUNNEL.GAP_SIZE;
  const segments: TunnelSegment[] = [];
  let currentGapY = baseGapY;

  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      gapY: currentGapY,
      offsetX: i * VISUALS.TUNNEL_SEGMENT_WIDTH,
    });

    // Vary gap position for next segment
    const variation = (Math.random() * 2 - 1) * TUNNEL.GAP_VARIATION;
    currentGapY = Math.max(
      WORLD.MIN_Y + gapSize / 2 + 0.5,
      Math.min(WORLD.MAX_Y - gapSize / 2 - 0.5, currentGapY + variation)
    );
  }

  const totalWidth = segmentCount * VISUALS.TUNNEL_SEGMENT_WIDTH;

  // Item at middle segment
  const midSeg = segments[Math.floor(segments.length / 2)];
  const itemBase = randomItem();

  return {
    id,
    type: 'tunnel',
    x,
    gapY: baseGapY,
    gapSize,
    passed: false,
    segments,
    totalWidth,
    item: itemBase
      ? { ...itemBase, posX: midSeg.offsetX, posY: midSeg.gapY }
      : undefined,
  };
}

function spawnUFO(
  id: string,
  x: number,
  distance: number,
  currentGap: number
): ObstacleData {
  const isDual = shouldSpawnDualUFO(distance);
  const ufoBodies: UFOBody[] = [];

  if (isDual) {
    // Dual UFO: two bodies with a gap between them
    const minCenter = WORLD.MIN_Y + currentGap / 2 + VISUALS.UFO_SIZE.height + 0.5;
    const maxCenter = WORLD.MAX_Y - currentGap / 2 - VISUALS.UFO_SIZE.height - 0.5;
    const gapCenter = minCenter + Math.random() * (maxCenter - minCenter);

    // Random direction (both linked = same movement)
    const dirRand = Math.random();
    const dir: UFOBody['direction'] =
      dirRand < 0.33 ? 'stationary' : dirRand < 0.66 ? 'up' : 'down';

    ufoBodies.push(
      {
        baseY: gapCenter + currentGap / 2 + VISUALS.UFO_SIZE.height / 2,
        offsetY: 0,
        activated: false,
        direction: dir,
        movePhase: 0,
      },
      {
        baseY: gapCenter - currentGap / 2 - VISUALS.UFO_SIZE.height / 2,
        offsetY: 0,
        activated: false,
        direction: dir,
        movePhase: 0,
      }
    );
  } else {
    // Single UFO: random Y position
    const minY = WORLD.MIN_Y + VISUALS.UFO_SIZE.height / 2 + 0.5;
    const maxY = WORLD.MAX_Y - VISUALS.UFO_SIZE.height / 2 - 0.5;
    const baseY = minY + Math.random() * (maxY - minY);

    const dirRand = Math.random();
    const dir: UFOBody['direction'] =
      dirRand < 0.33 ? 'stationary' : dirRand < 0.66 ? 'up' : 'down';

    ufoBodies.push({
      baseY,
      offsetY: 0,
      activated: false,
      direction: dir,
      movePhase: 0,
    });
  }

  return {
    id,
    type: 'ufo',
    x,
    gapY: 0,
    gapSize: 0,
    passed: false,
    ufoBodies,
  };
}

// ============================================
// Obstacle Manager Component
// ============================================

export function ObstacleManager() {
  // Ref-based obstacle data (source of truth for game loop)
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const obstacleIdCounter = useRef(0);
  // Map of obstacle ID -> Three.js group ref for imperative position updates
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  // Map of UFO body refs for imperative Y updates
  const ufoBodyRefs = useRef<Map<string, THREE.Group>>(new Map());
  // React state version counter - only bumped when obstacle list changes (add/remove)
  const [renderVersion, setRenderVersion] = useState(0);

  const getState = useGameStore.getState;

  useFrame((_, delta) => {
    const state = getState();
    if (state.status !== 'playing') return;

    const {
      currentSpeed,
      currentGap,
      currentSpawnDistance,
      updateGame,
      passObstacle,
      passTunnel,
      passUFO,
      collectItem,
      triggerCollision,
    } = state;

    // Update game state (physics, distance, difficulty)
    updateGame(delta);

    // Re-read state AFTER updateGame for accurate collision/collection
    const postUpdate = getState();
    if (postUpdate.status !== 'playing') return;
    const { playerY, distance } = postUpdate;

    const obstacles = obstaclesRef.current;
    const playerX = PHYSICS.PLAYER_X;
    const playerHalfWidth = PHYSICS.PLAYER_SIZE.width / 2;
    const playerHalfHeight = PHYSICS.PLAYER_SIZE.height / 2;

    let listChanged = false;
    let rightmostEdge = -Infinity;

    // Move obstacles, check collisions (iterate backwards for safe splice)
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];

      // Move obstacle
      obs.x -= currentSpeed * delta;

      // Remove if fully off screen left
      const rightEdge = getObstacleRightEdge(obs);
      if (rightEdge < -15) {
        obstacles.splice(i, 1);
        groupRefs.current.delete(obs.id);
        // Clean up UFO body refs
        if (obs.ufoBodies) {
          obs.ufoBodies.forEach((_, idx) => {
            ufoBodyRefs.current.delete(`${obs.id}-${idx}`);
          });
        }
        listChanged = true;
        continue;
      }

      // Track rightmost edge for spawn logic
      if (rightEdge > rightmostEdge) {
        rightmostEdge = rightEdge;
      }

      // Update Three.js group position directly (no React re-render)
      const group = groupRefs.current.get(obs.id);
      if (group) {
        group.position.x = obs.x;
      }

      // ---- UFO movement ----
      if (obs.type === 'ufo' && obs.ufoBodies) {
        for (let bodyIdx = 0; bodyIdx < obs.ufoBodies.length; bodyIdx++) {
          const body = obs.ufoBodies[bodyIdx];

          // Activate when player gets close
          if (!body.activated) {
            const distToPlayer = obs.x - playerX;
            if (distToPlayer <= UFO_CONFIG.ACTIVATION_DISTANCE) {
              body.activated = true;
            }
          }

          // Move if activated and not stationary
          if (body.activated && body.direction !== 'stationary') {
            body.movePhase += delta * UFO_CONFIG.MOVE_SPEED;
            const sign = body.direction === 'up' ? 1 : -1;
            body.offsetY = sign * Math.sin(body.movePhase) * UFO_CONFIG.MOVE_RANGE;
          }

          // Update UFO body Y position imperatively
          const bodyRef = ufoBodyRefs.current.get(`${obs.id}-${bodyIdx}`);
          if (bodyRef) {
            bodyRef.position.y = body.baseY + body.offsetY;
          }
        }
      }

      // ---- Pass detection ----
      if (!obs.passed) {
        let passX: number;
        if (obs.type === 'tunnel' && obs.totalWidth) {
          // Tunnel passes when last segment goes past player
          passX = obs.x + obs.totalWidth;
        } else {
          passX = obs.x;
        }

        if (passX < playerX - playerHalfWidth) {
          obs.passed = true;
          if (obs.type === 'pipe') passObstacle();
          else if (obs.type === 'tunnel') passTunnel();
          else if (obs.type === 'ufo') passUFO();
        }
      }

      // ---- Collision detection ----
      let collided = false;

      if (obs.type === 'pipe') {
        // Pipe collision
        const pipeHalfWidth = VISUALS.PIPE_WIDTH / 2;
        const gapTop = obs.gapY + obs.gapSize / 2;
        const gapBottom = obs.gapY - obs.gapSize / 2;

        if (
          obs.x - pipeHalfWidth < playerX + playerHalfWidth &&
          obs.x + pipeHalfWidth > playerX - playerHalfWidth
        ) {
          if (
            playerY + playerHalfHeight > gapTop ||
            playerY - playerHalfHeight < gapBottom
          ) {
            collided = true;
          }
        }
      } else if (obs.type === 'tunnel' && obs.segments) {
        // Tunnel collision: check each segment
        for (const seg of obs.segments) {
          const segX = obs.x + seg.offsetX;
          const segHalfWidth = VISUALS.TUNNEL_SEGMENT_WIDTH / 2;
          const gapTop = seg.gapY + obs.gapSize / 2;
          const gapBottom = seg.gapY - obs.gapSize / 2;

          if (
            segX - segHalfWidth < playerX + playerHalfWidth &&
            segX + segHalfWidth > playerX - playerHalfWidth
          ) {
            if (
              playerY + playerHalfHeight > gapTop ||
              playerY - playerHalfHeight < gapBottom
            ) {
              collided = true;
              break;
            }
          }
        }
      } else if (obs.type === 'ufo' && obs.ufoBodies) {
        // UFO collision: check each body
        const ufoHalfWidth = VISUALS.UFO_SIZE.width / 2;
        const ufoHalfHeight = VISUALS.UFO_SIZE.height / 2;

        for (const body of obs.ufoBodies) {
          const ufoY = body.baseY + body.offsetY;

          if (
            obs.x - ufoHalfWidth < playerX + playerHalfWidth &&
            obs.x + ufoHalfWidth > playerX - playerHalfWidth &&
            ufoY - ufoHalfHeight < playerY + playerHalfHeight &&
            ufoY + ufoHalfHeight > playerY - playerHalfHeight
          ) {
            collided = true;
            break;
          }
        }
      }

      if (collided) {
        // Shield: 1회 장애물 방어 → 장애물 제거 + 쉴드 제거
        const { hasShield } = getState();
        if (hasShield) {
          getState().useShield();
          obstacles.splice(i, 1);
          groupRefs.current.delete(obs.id);
          if (obs.ufoBodies) {
            obs.ufoBodies.forEach((_, idx) => {
              ufoBodyRefs.current.delete(`${obs.id}-${idx}`);
            });
          }
          listChanged = true;
          continue;
        }
        triggerCollision();
        return; // 게임오버 - 즉시 useFrame 종료
      }

      // ---- Item collection ----
      if (obs.item && !obs.item.collected) {
        const itemWorldX = obs.x + obs.item.posX;
        const dx = itemWorldX - playerX;
        const dy = obs.item.posY - playerY;
        const distToItem = Math.sqrt(dx * dx + dy * dy);

        if (distToItem < VISUALS.ITEM_COLLECT_RADIUS) {
          obs.item.collected = true;
          collectItem(obs.item.type);
          listChanged = true;
        }
      }
    }

    // ---- Spawn new obstacles ----
    let spawnCount = 0;
    const spawnBase =
      rightmostEdge > -Infinity
        ? rightmostEdge
        : FIRST_SPAWN_X - currentSpawnDistance;

    let nextSpawnX = spawnBase + currentSpawnDistance;
    while (nextSpawnX < SPAWN_AHEAD_X && spawnCount < 5) {
      obstacleIdCounter.current++;
      const id = `obs-${obstacleIdCounter.current}`;

      // Select obstacle type based on current distance
      const obsType = selectObstacleType(distance);

      // Random gap position
      const minGapY = WORLD.MIN_Y + currentGap / 2 + 0.5;
      const maxGapY = WORLD.MAX_Y - currentGap / 2 - 0.5;
      const gapY = minGapY + Math.random() * (maxGapY - minGapY);

      let newObs: ObstacleData;

      if (obsType === 'tunnel') {
        newObs = spawnTunnel(id, nextSpawnX, gapY, distance);
        // Next spawn should be after the tunnel ends
        nextSpawnX = nextSpawnX + (newObs.totalWidth || 0) + currentSpawnDistance;
      } else if (obsType === 'ufo') {
        newObs = spawnUFO(id, nextSpawnX, distance, currentGap);
        nextSpawnX += currentSpawnDistance;
      } else {
        newObs = spawnPipe(id, nextSpawnX, gapY, currentGap);
        nextSpawnX += currentSpawnDistance;
      }

      obstacles.push(newObs);
      listChanged = true;
      spawnCount++;
    }

    // Only trigger React re-render when the obstacle list actually changed
    if (listChanged) {
      setRenderVersion((v) => v + 1);
    }
  });

  // Reset obstacles when game starts
  const status = useGameStore((s) => s.status);

  useEffect(() => {
    if (status === 'playing') {
      obstaclesRef.current = [];
      obstacleIdCounter.current = 0;
      groupRefs.current.clear();
      ufoBodyRefs.current.clear();
      setRenderVersion((v) => v + 1);
    }
  }, [status]);

  // Read from ref for rendering (re-evaluated when renderVersion changes)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _version = renderVersion; // ensure re-render dependency
  const obstacles = obstaclesRef.current;

  return (
    <>
      {obstacles.map((obs) => (
        <group
          key={obs.id}
          ref={(el: THREE.Group | null) => {
            if (el) {
              groupRefs.current.set(obs.id, el);
              el.position.x = obs.x;
            }
          }}
        >
          {/* Pipe obstacle */}
          {obs.type === 'pipe' && (
            <Pipe
              id={obs.id}
              position={[0, 0, 0]}
              gapY={obs.gapY}
              gapSize={obs.gapSize}
            />
          )}

          {/* Tunnel obstacle: multiple pipe segments with purple color */}
          {obs.type === 'tunnel' &&
            obs.segments?.map((seg, segIdx) => (
              <Pipe
                key={`seg-${segIdx}`}
                id={`${obs.id}-seg-${segIdx}`}
                position={[seg.offsetX, 0, 0]}
                gapY={seg.gapY}
                gapSize={obs.gapSize}
                color={VISUALS.TUNNEL_COLOR}
                emissiveColor="#a78bfa"
                pipeWidth={VISUALS.TUNNEL_SEGMENT_WIDTH}
              />
            ))}

          {/* UFO obstacle */}
          {obs.type === 'ufo' &&
            obs.ufoBodies?.map((body, bodyIdx) => (
              <group
                key={`ufo-${bodyIdx}`}
                ref={(el: THREE.Group | null) => {
                  const key = `${obs.id}-${bodyIdx}`;
                  if (el) {
                    ufoBodyRefs.current.set(key, el);
                    el.position.y = body.baseY;
                  } else {
                    ufoBodyRefs.current.delete(key);
                  }
                }}
              >
                <UFO />
              </group>
            ))}

          {/* Item */}
          {obs.item && !obs.item.collected && (
            <PowerUp
              id={`item-${obs.id}`}
              position={[obs.item.posX, obs.item.posY, 0]}
              type={obs.item.type}
            />
          )}
        </group>
      ))}
    </>
  );
}

export default ObstacleManager;
