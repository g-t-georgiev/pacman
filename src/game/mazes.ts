import type { GameMode, MazeData, TileType } from "../types";
import { DEFAULT_SCATTER_TARGETS } from "./constants";
import { generateProceduralMaze } from "./proceduralMaze";

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
  "     #.##    X     ##.#     ",
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
  "     #.##    X     ##.#     ",
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

/**
 * Crazy Otto prototype map:
 * Authentic GCC prototype layout with open mid-lane corridors and emerald green / amber aesthetics!
 */
const CRAZY_OTTO_MAP = [
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
  "     #.##    X     ##.#     ",
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
        case "X":
          return "NO_UP_ZONE";
        default:
          return "EMPTY";
      }
    });
  });
}

export function getMazeData(mode: GameMode, level: number = 1, seed?: number): MazeData {
  const scatterTargets = DEFAULT_SCATTER_TARGETS[mode];
  switch (mode) {
    case "PACMAN": {
      return {
        width: 28,
        height: 36,
        tiles: parseMapString(CLASSIC_PACMAN_MAP),
        pacmanSpawn: { x: 13, y: 26, dir: "LEFT" },
        ghostSpawns: {
          BLINKY: { x: 13, y: 14, inHouse: false, initialDir: "LEFT" },
          PINKY: { x: 13, y: 17, inHouse: true, initialDir: "UP" },
          INKY: { x: 11, y: 17, inHouse: true, initialDir: "UP" },
          CLYDE: { x: 15, y: 17, inHouse: true, initialDir: "UP" },
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
      };
    }
    case "MS_PACMAN": {
      // Ms. Pac-Man alternated colors every few levels (Pink/Salmon, Light Blue, Brown, etc.)
      const isLevelEven = level % 2 === 0;
      return {
        width: 28,
        height: 36,
        tiles: parseMapString(MS_PACMAN_MAP),
        pacmanSpawn: { x: 13, y: 26, dir: "LEFT" },
        ghostSpawns: {
          BLINKY: { x: 13, y: 14, inHouse: false, initialDir: "LEFT" },
          PINKY: { x: 13, y: 17, inHouse: true, initialDir: "UP" },
          INKY: { x: 11, y: 17, inHouse: true, initialDir: "UP" },
          CLYDE: { x: 15, y: 17, inHouse: true, initialDir: "UP" },
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
      };
    }
    case "CRAZY_OTTO": {
      return {
        width: 28,
        height: 36,
        tiles: parseMapString(CRAZY_OTTO_MAP),
        pacmanSpawn: { x: 13, y: 26, dir: "LEFT" },
        ghostSpawns: {
          BLINKY: { x: 13, y: 14, inHouse: false, initialDir: "LEFT" },
          PINKY: { x: 13, y: 17, inHouse: true, initialDir: "UP" },
          INKY: { x: 11, y: 17, inHouse: true, initialDir: "UP" },
          CLYDE: { x: 15, y: 17, inHouse: true, initialDir: "UP" },
        },
        scatterTargets: {
          BLINKY: scatterTargets.BLINKY,
          PINKY: scatterTargets.PINKY,
          INKY: scatterTargets.INKY,
          CLYDE: scatterTargets.CLYDE,
        },
        tunnels: [{ y: 17, leftExit: 0, rightExit: 27 }],
        wallColor: "#00cc88", // Emerald proto green
        dotColor: "#ffff00", // Bright yellow dots
        bgColor: "#050a12",
        gateColor: "#ff4444",
      };
    }
    case "COOKIE_MAN": {
      return generateProceduralMaze(mode, seed);
    }
  }
}
