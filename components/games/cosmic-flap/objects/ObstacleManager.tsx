/**
 * Obstacle Manager
 *
 * Handles spawning, movement, collision detection, and cleanup of obstacles.
 * Uses ref-based game loop for performance (no React re-render per frame).
 * React state is only updated when obstacles are added/removed.
 */

'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore';
import { Pipe } from './Pipe';
import { PowerUp, PowerUpType } from './PowerUp';
import {
  WORLD,
  PHYSICS,
  VISUALS,
  ITEM_SPAWN,
} from '../constants';

// ============================================
// Types
// ============================================

interface ObstacleData {
  id: string;
  x: number;
  gapY: number;
  gapSize: number;
  passed: boolean;
  item?: {
    type: PowerUpType;
    collected: boolean;
  };
}

// ============================================
// Constants
// ============================================

// First obstacle starts just off-screen right
const FIRST_SPAWN_X = 6;
// Keep spawning until rightmost obstacle reaches this X
const SPAWN_AHEAD_X = 25;

// ============================================
// Obstacle Manager Component
// ============================================

export function ObstacleManager() {
  // Ref-based obstacle data (source of truth for game loop)
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const obstacleIdCounter = useRef(0);
  // Map of obstacle ID -> Three.js group ref for imperative position updates
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
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
      collectItem,
      triggerCollision,
    } = state;

    // Update game state (physics, distance, difficulty)
    updateGame(delta);

    // Re-read playerY AFTER updateGame for accurate collision/collection
    // Also check if updateGame triggered gameOver (bounds check)
    const postUpdate = getState();
    if (postUpdate.status !== 'playing') return;
    const { playerY } = postUpdate;

    const obstacles = obstaclesRef.current;
    const playerX = PHYSICS.PLAYER_X;
    const playerHalfWidth = PHYSICS.PLAYER_SIZE.width / 2;
    const playerHalfHeight = PHYSICS.PLAYER_SIZE.height / 2;

    let listChanged = false;
    let rightmostX = -Infinity;

    // Move obstacles, check collisions (iterate backwards for safe splice)
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];

      // Move obstacle
      obs.x -= currentSpeed * delta;

      // Remove if off screen left
      if (obs.x < -15) {
        obstacles.splice(i, 1);
        groupRefs.current.delete(obs.id);
        listChanged = true;
        continue;
      }

      // Track rightmost obstacle
      if (obs.x > rightmostX) {
        rightmostX = obs.x;
      }

      // Update Three.js position directly (no React re-render)
      const group = groupRefs.current.get(obs.id);
      if (group) {
        group.position.x = obs.x;
      }

      // Check if passed player
      if (!obs.passed && obs.x < playerX - playerHalfWidth) {
        obs.passed = true;
        passObstacle();
      }

      // Collision detection with pipes
      const pipeHalfWidth = 0.3;
      const gapTop = obs.gapY + obs.gapSize / 2;
      const gapBottom = obs.gapY - obs.gapSize / 2;

      if (
        obs.x - pipeHalfWidth < playerX + playerHalfWidth &&
        obs.x + pipeHalfWidth > playerX - playerHalfWidth
      ) {
        if (playerY + playerHalfHeight > gapTop || playerY - playerHalfHeight < gapBottom) {
          // Shield: 1회 장애물 방어 → 장애물 제거 + 쉴드 제거
          const { hasShield } = getState();
          if (hasShield) {
            getState().useShield();
            obstacles.splice(i, 1);
            groupRefs.current.delete(obs.id);
            listChanged = true;
            continue; // skip to next obstacle
          }
          console.log('[CosmicFlap] Obstacle collision! Calling triggerCollision, obs:', obs.id);
          triggerCollision();
          return; // 게임오버 - 즉시 useFrame 종료
        }
      }

      // Item collection
      if (obs.item && !obs.item.collected) {
        const dx = obs.x - playerX;
        const dy = obs.gapY - playerY;
        const distToItem = Math.sqrt(dx * dx + dy * dy);

        if (distToItem < VISUALS.ITEM_COLLECT_RADIUS) {
          obs.item.collected = true;
          collectItem(obs.item.type);
          listChanged = true; // re-render to hide PowerUp
        }
      }
    }

    // Spawn new obstacles - fill ahead of screen
    // rightmostX is computed synchronously from the ref, so spawn logic is reliable
    let spawnCount = 0;
    const spawnBase = rightmostX > -Infinity ? rightmostX : FIRST_SPAWN_X - currentSpawnDistance;

    let nextSpawnX = spawnBase + currentSpawnDistance;
    while (nextSpawnX < SPAWN_AHEAD_X && spawnCount < 5) {
      // Random gap position (keep away from edges)
      const minGapY = WORLD.MIN_Y + currentGap / 2 + 0.5;
      const maxGapY = WORLD.MAX_Y - currentGap / 2 - 0.5;
      const gapY = minGapY + Math.random() * (maxGapY - minGapY);

      // Determine if item should spawn
      let item: ObstacleData['item'] | undefined;
      if (Math.random() < ITEM_SPAWN.CHANCE) {
        const rand = Math.random();
        let type: PowerUpType;
        if (rand < ITEM_SPAWN.SLOW) {
          type = 'slow';
        } else if (rand < ITEM_SPAWN.SLOW + ITEM_SPAWN.SHIELD) {
          type = 'shield';
        } else {
          type = 'coin';
        }
        item = { type, collected: false };
      }

      obstacleIdCounter.current++;
      const newObs: ObstacleData = {
        id: `obs-${obstacleIdCounter.current}`,
        x: nextSpawnX,
        gapY,
        gapSize: currentGap,
        passed: false,
        item,
      };

      obstacles.push(newObs);
      listChanged = true;

      nextSpawnX += currentSpawnDistance;
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
              el.position.x = obs.x; // set initial position
            }
          }}
        >
          {/* Pipe position is relative to parent group (x managed imperatively) */}
          <Pipe
            id={obs.id}
            position={[0, 0, 0]}
            gapY={obs.gapY}
            gapSize={obs.gapSize}
          />
          {obs.item && !obs.item.collected && (
            <PowerUp
              id={`item-${obs.id}`}
              position={[0, obs.gapY, 0]}
              type={obs.item.type}
            />
          )}
        </group>
      ))}
    </>
  );
}

export default ObstacleManager;
