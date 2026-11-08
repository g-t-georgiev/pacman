import type { GameMode, MazeData, TileCoord, TileType } from "../types";
import { DEFAULT_SCATTER_TARGETS, DEFAULT_SPAWN_CANDIDATES } from "./constants";

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

export const CLASSIC_PACMAN_INTERSECTIONS: TileCoord[] = [
  { col: 6, row: 4 },
  { col: 21, row: 4 },
  { col: 1, row: 8 },
  { col: 6, row: 8 },
  { col: 9, row: 8 },
  { col: 12, row: 8 },
  { col: 15, row: 8 },
  { col: 18, row: 8 },
  { col: 21, row: 8 },
  { col: 26, row: 8 },
  { col: 6, row: 11 },
  { col: 21, row: 11 },
  { col: 12, row: 14 },
  { col: 15, row: 14 },
  { col: 6, row: 17 },
  { col: 9, row: 17 },
  { col: 18, row: 17 },
  { col: 21, row: 17 },
  { col: 9, row: 20 },
  { col: 18, row: 20 },
  { col: 6, row: 23 },
  { col: 9, row: 23 },
  { col: 18, row: 23 },
  { col: 21, row: 23 },
  { col: 6, row: 26 },
  { col: 9, row: 26 },
  { col: 12, row: 26 },
  { col: 15, row: 26 },
  { col: 18, row: 26 },
  { col: 21, row: 26 },
  { col: 3, row: 29 },
  { col: 24, row: 29 },
  { col: 12, row: 32 },
  { col: 15, row: 32 },
];

export const MS_PACMAN_INTERSECTIONS: TileCoord[] = [
  { col: 6, row: 4 },
  { col: 21, row: 4 },
  { col: 1, row: 8 },
  { col: 6, row: 8 },
  { col: 9, row: 8 },
  { col: 12, row: 8 },
  { col: 15, row: 8 },
  { col: 18, row: 8 },
  { col: 21, row: 8 },
  { col: 26, row: 8 },
  { col: 1, row: 10 },
  { col: 6, row: 10 },
  { col: 21, row: 10 },
  { col: 26, row: 10 },
  { col: 12, row: 14 },
  { col: 15, row: 14 },
  { col: 6, row: 16 },
  { col: 21, row: 16 },
  { col: 6, row: 17 },
  { col: 9, row: 17 },
  { col: 18, row: 17 },
  { col: 21, row: 17 },
  { col: 6, row: 20 },
  { col: 9, row: 20 },
  { col: 18, row: 20 },
  { col: 21, row: 20 },
  { col: 6, row: 23 },
  { col: 9, row: 23 },
  { col: 18, row: 23 },
  { col: 21, row: 23 },
  { col: 6, row: 26 },
  { col: 9, row: 26 },
  { col: 12, row: 26 },
  { col: 15, row: 26 },
  { col: 18, row: 26 },
  { col: 21, row: 26 },
  { col: 3, row: 29 },
  { col: 24, row: 29 },
  { col: 12, row: 32 },
  { col: 15, row: 32 },
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

export function getMazeData(mode: GameMode, level: number = 1): MazeData {
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
        intersections: CLASSIC_PACMAN_INTERSECTIONS,
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
        specialNoUpTiles: [
          { col: 12, row: 15 },
          { col: 15, row: 15 },
          { col: 12, row: 27 },
          { col: 15, row: 27 },
        ],
        intersections: MS_PACMAN_INTERSECTIONS,
      };
    }
  }
}
