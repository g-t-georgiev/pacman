import type { MazeData, TileCoord } from "../types";

/**
 * What can be worked out from a maze's tiles alone (plan A4): its corridors, its intersections,
 * its tunnel slow zones, and whether it is a valid maze at all.
 */

const STEPS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

const key = (col: number, row: number) => `${col},${row}`;

/** Tiles Pac-Man may stand on (walls, the gate and the house interior excluded). */
function isWalkable(maze: MazeData, col: number, row: number): boolean {
  if (row < 0 || row >= maze.height || col < 0 || col >= maze.width) return false;
  const tile = maze.tiles[row][col];
  return tile !== "WALL" && tile !== "GATE" && tile !== "GHOST_HOUSE";
}

/** Horizontal neighbor with tunnel wrap on tunnel rows. */
function wrapCol(maze: MazeData, col: number, row: number): number | null {
  if (col >= 0 && col < maze.width) return col;
  return maze.tunnels.some((t) => t.y === row) ? (col + maze.width) % maze.width : null;
}

/**
 * The maze's corridors: every tile Pac-Man can reach from his spawn (tunnels wrap). Blank rows
 * above and below the maze and the empty areas outside its walls are not corridors.
 */
export function corridorTiles(maze: MazeData): Set<string> {
  const start = maze.pacmanSpawn.candidates[0];
  const seen = new Set<string>([key(start.col, start.row)]);
  const queue: Array<[number, number]> = [[start.col, start.row]];
  while (queue.length > 0) {
    const [col, row] = queue.shift()!;
    for (const [dc, dr] of STEPS) {
      const c = wrapCol(maze, col + dc, row + dr);
      const r = row + dr;
      if (c === null || seen.has(key(c, r)) || !isWalkable(maze, c, r)) continue;
      seen.add(key(c, r));
      queue.push([c, r]);
    }
  }
  return seen;
}

/** Corridor neighbors of a corridor tile (tunnels wrap). */
function exits(maze: MazeData, corridors: Set<string>, col: number, row: number): number {
  return STEPS.filter(([dc, dr]) => {
    const c = wrapCol(maze, col + dc, row + dr);
    return c !== null && corridors.has(key(c, row + dr));
  }).length;
}

/** Intersections: corridor tiles with three or more corridor exits. */
export function deriveIntersections(maze: MazeData): TileCoord[] {
  const corridors = corridorTiles(maze);
  const out: TileCoord[] = [];
  for (let row = 0; row < maze.height; row++) {
    for (let col = 0; col < maze.width; col++) {
      if (corridors.has(key(col, row)) && exits(maze, corridors, col, row) >= 3) {
        out.push({ col, row });
      }
    }
  }
  return out;
}

/** Ghosts slow down in a tunnel row within 6 tiles of either edge (Dossier, Speed). */
export const TUNNEL_SLOW_TILES = 6;

export function isTunnelSlowZone(maze: MazeData, col: number, row: number): boolean {
  return maze.tunnels.some(
    (t) => t.y === row && (col < TUNNEL_SLOW_TILES || col >= maze.width - TUNNEL_SLOW_TILES)
  );
}

/**
 * Checks that a maze is playable. Returns the problems found (empty when valid):
 * every dot reachable, no dead ends, tunnels open at both edges, the house door reachable from
 * a corridor, spawn and no-up tiles in corridors.
 */
export function validateMaze(maze: MazeData): string[] {
  const problems: string[] = [];
  const corridors = corridorTiles(maze);

  for (let row = 0; row < maze.height; row++) {
    for (let col = 0; col < maze.width; col++) {
      const tile = maze.tiles[row][col];
      if ((tile === "DOT" || tile === "ENERGIZER") && !corridors.has(key(col, row))) {
        problems.push(`unreachable ${tile.toLowerCase()} at (${col}, ${row})`);
      }
      if (corridors.has(key(col, row)) && exits(maze, corridors, col, row) < 2) {
        problems.push(`dead end at (${col}, ${row})`);
      }
    }
  }

  for (const t of maze.tunnels) {
    if (!corridors.has(key(0, t.y)) || !corridors.has(key(maze.width - 1, t.y))) {
      problems.push(`tunnel row ${t.y} is not open at both edges`);
    }
  }

  const gates: TileCoord[] = [];
  maze.tiles.forEach((r, row) =>
    r.forEach((tile, col) => tile === "GATE" && gates.push({ col, row }))
  );
  if (gates.length === 0) problems.push("no ghost house door");
  else if (!gates.some((g) => corridors.has(key(g.col, g.row - 1)))) {
    problems.push("the ghost house door is not reachable from a corridor");
  }

  for (const c of maze.pacmanSpawn.candidates) {
    if (!corridors.has(key(c.col, c.row))) problems.push(`Pac-Man spawn (${c.col}, ${c.row})`);
  }
  for (const t of maze.specialNoUpTiles ?? []) {
    if (!corridors.has(key(t.col, t.row))) {
      problems.push(`no-up tile (${t.col}, ${t.row}) is not a corridor`);
    }
  }
  return problems;
}
