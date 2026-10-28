/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Direction, GhostBehavior, GhostState, GhostType, MazeData, PacmanState, TileCoord, TileType } from '../types/game';
import {
  ELROY_1_SPEED,
  ELROY_2_SPEED,
  GHOST_BASE_SPEED,
  GHOST_EATEN_SPEED,
  GHOST_FRIGHTENED_SPEED,
  GHOST_HOUSE_SPEED,
  GHOST_TUNNEL_SPEED,
  TILE_SIZE,
} from './constants';

export function getOppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case 'UP':
      return 'DOWN';
    case 'DOWN':
      return 'UP';
    case 'LEFT':
      return 'RIGHT';
    case 'RIGHT':
      return 'LEFT';
    default:
      return 'NONE';
  }
}

export function getDirectionVector(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case 'UP':
      return { dx: 0, dy: -1 };
    case 'DOWN':
      return { dx: 0, dy: 1 };
    case 'LEFT':
      return { dx: -1, dy: 0 };
    case 'RIGHT':
      return { dx: 1, dy: 0 };
    default:
      return { dx: 0, dy: 0 };
  }
}

/**
 * Calculates authentic arcade target tile for each ghost
 */
export function calculateGhostTarget(
  ghost: GhostState,
  pacman: PacmanState,
  blinky: GhostState,
  maze: MazeData,
  dotsRemaining: number
): TileCoord {
  const pacCol = Math.floor(pacman.x / TILE_SIZE);
  const pacRow = Math.floor(pacman.y / TILE_SIZE);
  const ghostCol = Math.floor(ghost.x / TILE_SIZE);
  const ghostRow = Math.floor(ghost.y / TILE_SIZE);

  // EATEN (Eyes): Target ghost house interior to enter the pen
  if (ghost.mode === 'EATEN') {
    return { col: 13, row: 17 };
  }

  // SCATTER mode: Retreat to home corners (unless Blinky is in Cruise Elroy)
  if (ghost.mode === 'SCATTER') {
    if (ghost.type === 'BLINKY' && dotsRemaining <= 20) {
      // Cruise Elroy Blinky ignores scatter and stays in chase!
    } else {
      return maze.scatterTargets[ghost.type];
    }
  }

  // FRIGHTENED mode: Wanders randomly; target is pseudo-random or dummy
  if (ghost.mode === 'FRIGHTENED') {
    return {
      col: Math.floor(Math.sin(ghost.x * 0.1) * 10) + 14,
      row: Math.floor(Math.cos(ghost.y * 0.1) * 10) + 17,
    };
  }

  // CHASE mode: Distinct arcade personalities
  switch (ghost.type) {
    case 'BLINKY': {
      // 1. Blinky (Shadow / Chaser):
      // Actively pursues Pac-Man by directly targeting Pac-Man's current tile.
      return { col: pacCol, row: pacRow };
    }

    case 'PINKY': {
      // 2. Pinky (Speedy / Ambusher):
      // Attempts to ambush Pac-Man by targeting 4 tiles ahead of Pac-Man's path.
      // Classic Arcade Quirk: Facing UP in the original code also offset 4 tiles LEFT!
      let targetCol = pacCol;
      let targetRow = pacRow;
      switch (pacman.dir) {
        case 'UP':
          targetRow -= 4;
          targetCol -= 4; // Classic arcade 1980 overflow bug
          break;
        case 'DOWN':
          targetRow += 4;
          break;
        case 'LEFT':
          targetCol -= 4;
          break;
        case 'RIGHT':
          targetCol += 4;
          break;
      }
      return { col: targetCol, row: targetRow };
    }

    case 'INKY': {
      // 3. Inky (Bashful / Flanker):
      // Uses a combination of Pac-Man's position and Blinky's position.
      // 1) Find the intermediate tile 2 tiles ahead of Pac-Man (with the classic UP bug).
      let pivotCol = pacCol;
      let pivotRow = pacRow;
      switch (pacman.dir) {
        case 'UP':
          pivotRow -= 2;
          pivotCol -= 2; // Classic arcade overflow bug
          break;
        case 'DOWN':
          pivotRow += 2;
          break;
        case 'LEFT':
          pivotCol -= 2;
          break;
        case 'RIGHT':
          pivotCol += 2;
          break;
      }

      ghost.intermediateTarget = { col: pivotCol, row: pivotRow };

      const blinkyCol = Math.floor(blinky.x / TILE_SIZE);
      const blinkyRow = Math.floor(blinky.y / TILE_SIZE);

      // 2) Take vector from Blinky to intermediate tile, and double it:
      // Inky Target = Pivot + (Pivot - Blinky) = 2 * Pivot - Blinky
      const targetCol = pivotCol + (pivotCol - blinkyCol);
      const targetRow = pivotRow + (pivotRow - blinkyRow);
      return { col: targetCol, row: targetRow };
    }

    case 'CLYDE': {
      // 4. Clyde (Pokey / Coward):
      // Calculates distance to Pac-Man:
      const distSq = (pacCol - ghostCol) ** 2 + (pacRow - ghostRow) ** 2;
      const isClose = distSq < 64; // Closer than 8 tiles (8 * 8 = 64)

      if (isClose) {
        // Classic behavior: When within 8 tiles of Pac-Man, Clyde gets scared and flees to scatter corner
        return maze.scatterTargets.CLYDE;
      } else {
        // When far away (>= 8 tiles), Clyde randomly switches between actively chasing
        // Pac-Man and wandering/fleeing back toward his scatter corner
        const wanderState = ghost.clydeWanderState || 'CHASE';
        if (wanderState === 'CHASE') {
          return { col: pacCol, row: pacRow };
        } else {
          return maze.scatterTargets.CLYDE;
        }
      }
    }
  }
}

/**
 * Checks if a tile is walkable for a ghost given its state
 */
export function isTileWalkableForGhost(
  col: number,
  row: number,
  ghost: GhostState,
  maze: MazeData
): boolean {
  if (row < 0 || row >= maze.height) return false;

  // Tunnel wrap-around check
  if (col < 0 || col >= maze.width) {
    const isTunnelRow = maze.tunnels.some((t) => t.y === row);
    return isTunnelRow;
  }

  const tile = maze.tiles[row][col];

  if (tile === 'WALL') return false;

  // Gate check: only passable when in house or entering house as eaten eyes
  if (tile === 'GATE') {
    return ghost.inHouse || ghost.mode === 'EATEN';
  }

  // Ghost house interior
  if (tile === 'GHOST_HOUSE') {
    return ghost.inHouse || ghost.mode === 'EATEN';
  }

  return true;
}

/**
 * Arcade ghost decision logic at intersections:
 * Chooses next direction with smallest Euclidean distance to target.
 * Priority order on tie: UP > LEFT > DOWN > RIGHT
 */
export function chooseNextGhostDirection(
  ghost: GhostState,
  target: TileCoord,
  maze: MazeData,
  fromCol?: number,
  fromRow?: number,
  currentDir?: Direction
): Direction {
  const evalCol = fromCol !== undefined ? fromCol : Math.floor(ghost.x / TILE_SIZE);
  const evalRow = fromRow !== undefined ? fromRow : Math.floor(ghost.y / TILE_SIZE);
  const evalDir = currentDir !== undefined ? currentDir : ghost.dir;

  // Directions evaluated in strict arcade tie-breaker order: UP, LEFT, DOWN, RIGHT
  const directions: Direction[] = ['UP', 'LEFT', 'DOWN', 'RIGHT'];
  const opposite = getOppositeDirection(evalDir);

  const currentTileType =
    evalRow >= 0 && evalRow < maze.height && evalCol >= 0 && evalCol < maze.width
      ? maze.tiles[evalRow][evalCol]
      : 'EMPTY';

  // 1. Gather all walkable candidate directions (excluding 180° opposite unless dead-end)
  const candidates: Direction[] = [];
  for (const dir of directions) {
    if (dir === opposite && evalDir !== 'NONE') continue;
    if (dir === 'UP' && currentTileType === 'NO_UP_ZONE' && ghost.mode !== 'EATEN') continue;
    const { dx, dy } = getDirectionVector(dir);
    if (isTileWalkableForGhost(evalCol + dx, evalRow + dy, ghost, maze)) {
      candidates.push(dir);
    }
  }

  // If no forward or turn direction was walkable (e.g. dead end), allow reverse
  if (candidates.length === 0) {
    const oppV = getDirectionVector(opposite);
    if (isTileWalkableForGhost(evalCol + oppV.dx, evalRow + oppV.dy, ghost, maze)) {
      return opposite;
    }
    for (const dir of directions) {
      const v = getDirectionVector(dir);
      if (isTileWalkableForGhost(evalCol + v.dx, evalRow + v.dy, ghost, maze)) {
        return dir;
      }
    }
    return evalDir;
  }

  // Frightened ghost uses pseudo-random selection among valid candidates
  if (ghost.mode === 'FRIGHTENED') {
    const randIdx = Math.floor(Math.random() * candidates.length);
    return candidates[randIdx];
  }

  // Standard target-distance decision among candidates (tie-breaker order: UP > LEFT > DOWN > RIGHT)
  let bestDir: Direction = candidates[0];
  let bestDistSq = Infinity;
  for (const dir of candidates) {
    const { dx, dy } = getDirectionVector(dir);
    const nextCol = evalCol + dx;
    const nextRow = evalRow + dy;
    const distSq = (nextCol - target.col) ** 2 + (nextRow - target.row) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestDir = dir;
    }
  }

  return bestDir;
}

/**
 * Calculates current speed of ghost based on location, state, and Cruise Elroy
 */
export function getGhostSpeed(
  ghost: GhostState,
  maze: MazeData,
  dotsRemaining: number,
  turboMultiplier: number = 1.0
): number {
  if (ghost.mode === 'EATEN') {
    return GHOST_EATEN_SPEED * turboMultiplier;
  }

  if (ghost.inHouse) {
    return GHOST_HOUSE_SPEED * turboMultiplier;
  }

  const col = Math.floor(ghost.x / TILE_SIZE);
  const row = Math.floor(ghost.y / TILE_SIZE);

  // Speed reduction in warp tunnels
  const inTunnel = maze.tunnels.some((t) => t.y === row && (col <= 5 || col >= maze.width - 6));
  if (inTunnel) {
    return GHOST_TUNNEL_SPEED * turboMultiplier;
  }

  if (ghost.mode === 'FRIGHTENED') {
    return GHOST_FRIGHTENED_SPEED * turboMultiplier;
  }

  // Cruise Elroy for Blinky
  if (ghost.type === 'BLINKY') {
    if (dotsRemaining <= 10) {
      return ELROY_2_SPEED * turboMultiplier;
    }
    if (dotsRemaining <= 20) {
      return ELROY_1_SPEED * turboMultiplier;
    }
  }

  return GHOST_BASE_SPEED * turboMultiplier;
}
