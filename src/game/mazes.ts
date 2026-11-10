import type { GameMode, MazeData, TileCoord, TileType } from "../types";
import { deriveIntersections } from "./mazeAnalysis";
import { DEFAULT_SCATTER_TARGETS, DEFAULT_SPAWN_CANDIDATES, TILE_SIZE } from "./constants";
import type { DualTileCoord, GhostType } from "../types";

/**
 * Where an actor stands for a pair of tiles: on the seam between them, on the row centerline
 * (F9). The arcade starts Pac-Man, Blinky and Pinky on the 13/14 seam, and seats Inky and Clyde
 * two tiles to either side, so spawning and reviving share these points.
 */
export function seamPx(pair: DualTileCoord): { x: number; y: number } {
  return { x: pair[1].col * TILE_SIZE, y: pair[0].row * TILE_SIZE + TILE_SIZE / 2 };
}

/** The x of a ghost's seat in the house when its eyes come home (Blinky uses Pinky's). */
export function houseSlotX(type: GhostType): number {
  return seamPx(DEFAULT_SPAWN_CANDIDATES[type === "BLINKY" ? "PINKY" : type]).x;
}

/**
 * Classic Arcade Pac-Man Maze (28 cols x 36 rows):
 * Rows 0-2: Top text UI (1UP / HIGH SCORE / 2UP)
 * Rows 3-33: Active maze grid
 * Rows 34-35: Bottom text / fruit rack
 */
const CLASSIC_PACMAN_MAP = [
  // 0 - 2 (Top UI rows)
  "                            ",
  "                            ",
  "                            ",
  // 3 - 33 (Active maze)
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "     #.##### ## #####.#     ",
  "     #.##          ##.#     ",
  "     #.## ###--### ##.#     ",
  "######.## #HHHHHH# ##.######",
  "TTTTTT.   #HHHHHH#   .TTTTTT",
  "######.## #HHHHHH# ##.######",
  "     #.## ######## ##.#     ",
  "     #.##          ##.#     ",
  "     #.## ######## ##.#     ",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......  .......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
  // 34 - 35 (Bottom UI rows)
  "                            ",
  "                            ",
];

/**
 * Ms. Pac-Man Maze:
 * Authentic asymmetric layout featuring distinctive dual tunnels (top tunnel at row 10, bottom tunnel at row 20)
 * and classic pink/salmon arcade styling!
 */
const MS_PACMAN_MAP = [
  // 0 - 2 (Top UI rows)
  "                            ",
  "                            ",
  "                            ",
  // 3 - 33 (Active maze)
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "TTTTTT.##.########.##.TTTTTT",
  "######.##....##....##.######",
  "     #.##### ## #####.#     ",
  "     #.##### ## #####.#     ",
  "     #.##          ##.#     ",
  "######.## ###--### ##.######",
  "#......## #HHHHHH# ##......#",
  "#.####.   #HHHHHH#   .####.#",
  "#.####.## #HHHHHH# ##.####.#",
  "#.####.## ######## ##.####.#",
  "TTTTTT.##          ##.TTTTTT",
  "######.## ######## ##.######",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......  .......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
  // 34 - 35 (Bottom UI rows)
  "                            ",
  "                            ",
];

function parseMapString(map: string[]): TileType[][] {
  return map.map((row) => {
    return row.split("").map((char): TileType => {
      switch (char) {
        case "#":
          return "WALL";
        case ".":
          return "DOT";
        case "o":
          return "ENERGIZER";
        case "-":
          return "GATE";
        case "H":
          return "GHOST_HOUSE";
        case "T":
          return "TUNNEL";
        default:
          return "EMPTY";
      }
    });
  });
}

/** A maze's data, with its intersections derived from the tiles (plan A4). */
export function getMazeData(mode: GameMode, level: number = 1): MazeData {
  const maze = buildMaze(mode, level);
  maze.intersections = deriveIntersections(maze);
  return maze;
}

function buildMaze(mode: GameMode, level: number): MazeData {
  const scatterTargets = DEFAULT_SCATTER_TARGETS[mode];
  switch (mode) {
    case "PACMAN": {
      return {
        width: 28,
        height: 36,
        tiles: parseMapString(CLASSIC_PACMAN_MAP),
        pacmanSpawn: {
          x: 13,
          y: 26,
          dir: "LEFT",
          candidates: DEFAULT_SPAWN_CANDIDATES.PACMAN,
        },
        ghostSpawns: {
          BLINKY: {
            x: 13,
            y: 14,
            inHouse: false,
            initialDir: "LEFT",
            candidates: DEFAULT_SPAWN_CANDIDATES.BLINKY,
            respawnSlot: DEFAULT_SPAWN_CANDIDATES.PINKY,
          },
          PINKY: {
            x: 13,
            y: 17,
            inHouse: true,
            initialDir: "UP",
            candidates: DEFAULT_SPAWN_CANDIDATES.PINKY,
            respawnSlot: DEFAULT_SPAWN_CANDIDATES.PINKY,
          },
          INKY: {
            x: 11,
            y: 17,
            inHouse: true,
            initialDir: "UP",
            candidates: DEFAULT_SPAWN_CANDIDATES.INKY,
            respawnSlot: DEFAULT_SPAWN_CANDIDATES.INKY,
          },
          CLYDE: {
            x: 15,
            y: 17,
            inHouse: true,
            initialDir: "UP",
            candidates: DEFAULT_SPAWN_CANDIDATES.CLYDE,
            respawnSlot: DEFAULT_SPAWN_CANDIDATES.CLYDE,
          },
        },
        fruitSpawn: {
          candidates: DEFAULT_SPAWN_CANDIDATES.FRUIT,
        },
        scatterTargets: {
          BLINKY: scatterTargets.BLINKY,
          PINKY: scatterTargets.PINKY,
          INKY: scatterTargets.INKY,
          CLYDE: scatterTargets.CLYDE,
        },
        tunnels: [{ y: 17, leftExit: 0, rightExit: 27 }],
        wallColor: "#2121ff", // Iconic arcade blue neon
        dotColor: "#ffb8ae", // Arcade warm peach/yellow dots
        bgColor: "#000000",
        gateColor: "#ffb8ff",
        specialNoUpTiles: [
          { col: 12, row: 14 },
          { col: 15, row: 14 },
          { col: 12, row: 26 },
          { col: 15, row: 26 },
        ],
      };
    }
    case "MS_PACMAN": {
      // Ms. Pac-Man alternated colors every few levels (Pink/Salmon, Light Blue, Brown, etc.)
      const isLevelEven = level % 2 === 0;
      return {
        width: 28,
        height: 36,
        tiles: parseMapString(MS_PACMAN_MAP),
        pacmanSpawn: {
          x: 13,
          y: 26,
          dir: "LEFT",
          candidates: DEFAULT_SPAWN_CANDIDATES.PACMAN,
        },
        ghostSpawns: {
          BLINKY: {
            x: 13,
            y: 14,
            inHouse: false,
            initialDir: "LEFT",
            candidates: DEFAULT_SPAWN_CANDIDATES.BLINKY,
            respawnSlot: DEFAULT_SPAWN_CANDIDATES.PINKY,
          },
          PINKY: {
            x: 13,
            y: 17,
            inHouse: true,
            initialDir: "UP",
            candidates: DEFAULT_SPAWN_CANDIDATES.PINKY,
            respawnSlot: DEFAULT_SPAWN_CANDIDATES.PINKY,
          },
          INKY: {
            x: 11,
            y: 17,
            inHouse: true,
            initialDir: "UP",
            candidates: DEFAULT_SPAWN_CANDIDATES.INKY,
            respawnSlot: DEFAULT_SPAWN_CANDIDATES.INKY,
          },
          CLYDE: {
            x: 15,
            y: 17,
            inHouse: true,
            initialDir: "UP",
            candidates: DEFAULT_SPAWN_CANDIDATES.CLYDE,
            respawnSlot: DEFAULT_SPAWN_CANDIDATES.CLYDE,
          },
        },
        fruitSpawn: {
          candidates: DEFAULT_SPAWN_CANDIDATES.FRUIT,
        },
        scatterTargets: {
          BLINKY: scatterTargets.BLINKY,
          PINKY: scatterTargets.PINKY,
          INKY: scatterTargets.INKY,
          CLYDE: scatterTargets.CLYDE,
        },
        // Dual tunnels!
        tunnels: [
          { y: 10, leftExit: 0, rightExit: 27 },
          { y: 20, leftExit: 0, rightExit: 27 },
        ],
        wallColor: isLevelEven ? "#00e5ff" : "#ff7b90", // Vibrant pink or cyan
        dotColor: "#ffffff",
        bgColor: "#000000",
        gateColor: "#ffb8ff",
        // No no-up tiles: the four once listed here were inside walls (no effect). Whether
        // Ms. Pac-Man restricts upward turns anywhere needs a source.
      };
    }
  }
}
