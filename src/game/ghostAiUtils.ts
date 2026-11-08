import type { Direction, GhostState, MazeData, TileCoord } from "../types";
import { TILE_SIZE } from "./constants";

export function getOppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case "UP":
      return "DOWN";
    case "DOWN":
      return "UP";
    case "LEFT":
      return "RIGHT";
    case "RIGHT":
      return "LEFT";
    default:
      return "NONE";
  }
}

export function getDirectionVector(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case "UP":
      return { dx: 0, dy: -1 };
    case "DOWN":
      return { dx: 0, dy: 1 };
    case "LEFT":
      return { dx: -1, dy: 0 };
    case "RIGHT":
      return { dx: 1, dy: 0 };
    default:
      return { dx: 0, dy: 0 };
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

  if (tile === "WALL") return false;

  // Gate check: only passable when in house or entering house as eaten eyes
  if (tile === "GATE") {
    return ghost.inHouse || ghost.mode === "EATEN";
  }

  // Ghost house interior
  if (tile === "GHOST_HOUSE") {
    return ghost.inHouse || ghost.mode === "EATEN";
  }

  return true;
}

/**
 * Checks if a tile is one of the special arcade No-Up zones where ghosts are forbidden from turning UP.
 * Reconciles both tile map metadata and layered specialNoUpTiles coordinates.
 */
export function isTileNoUpZone(col: number, row: number, maze?: MazeData): boolean {
  if (!maze) return false;
  if (row >= 0 && row < maze.height && col >= 0 && col < maze.width) {
    if (maze.tiles[row][col] === "NO_UP_ZONE") return true;
  }
  if (maze.specialNoUpTiles) {
    return maze.specialNoUpTiles.some((t) => t.col === col && t.row === row);
  }
  return false;
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
  const directions: Direction[] = ["UP", "LEFT", "DOWN", "RIGHT"];
  const opposite = getOppositeDirection(evalDir);

  // 1. Gather all walkable candidate directions (excluding 180° opposite unless dead-end)
  const candidates: Direction[] = [];
  for (const dir of directions) {
    if (dir === opposite && evalDir !== "NONE") continue;
    if (dir === "UP" && isTileNoUpZone(evalCol, evalRow, maze) && ghost.mode !== "EATEN") continue;
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

  // If exactly 1 valid exit: forced corner turn or corridor continuation
  if (candidates.length === 1) {
    return candidates[0];
  }

  // Frightened decisions use the sim PRNG in GhostAiController.evaluateTileEntryLookahead. This
  // helper must stay deterministic (it also drives path previews), so a frightened ghost here
  // takes the first valid candidate.
  if (ghost.mode === "FRIGHTENED") {
    return candidates[0];
  }

  // Standard target-distance decision among candidates (tie-breaker order: UP > LEFT > DOWN > RIGHT)
  let targetToUse = target;
  if (ghost.mode === "EATEN" && (evalCol === 13 || evalCol === 14) && evalRow === 14) {
    targetToUse = { col: 13, row: 17 };
  }

  let bestDir: Direction = candidates[0];
  let bestDistSq = Infinity;
  for (const dir of candidates) {
    const { dx, dy } = getDirectionVector(dir);
    const nextCol = evalCol + dx;
    const nextRow = evalRow + dy;
    const distSq = (nextCol - targetToUse.col) ** 2 + (nextRow - targetToUse.row) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestDir = dir;
    }
  }

  return bestDir;
}
