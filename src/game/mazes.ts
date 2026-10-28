/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameMode, MazeData, TileType } from '../types/game';
import { generateProceduralMaze } from './proceduralMaze';

/**
 * Classic Arcade Pac-Man Maze (28 cols x 36 rows):
 * Rows 0-2: Top text UI (1UP / HIGH SCORE / 2UP)
 * Rows 3-33: Active maze grid
 * Rows 34-35: Bottom text / fruit rack
 */
const CLASSIC_PACMAN_MAP = [
  // 0 - 2 (Top UI rows)
  '                            ',
  '                            ',
  '                            ',
  // 3 - 33 (Active maze)
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##    X     ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #HHHHHH# ##.######',
  'TTTTTT.   #HHHHHH#   .TTTTTT',
  '######.## #HHHHHH# ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
  // 34 - 35 (Bottom UI rows)
  '                            ',
  '                            ',
];

/**
 * Ms. Pac-Man Maze:
 * Distinctive dual tunnels (top tunnel and bottom tunnel) and pink/salmon arcade maze!
 */
const MS_PACMAN_MAP = [
  '                            ',
  '                            ',
  '                            ',
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  'TTTTTT.##.########.##.TTTTTT',
  '######.##....##....##.######',
  '     #.##### ## #####.#     ',
  '     #.##### ## #####.#     ',
  '     #.##    X     ##.#     ',
  '######.## ###--### ##.######',
  '#      ## #HHHHHH# ##      #',
  '#.####    #HHHHHH#    ####.#',
  '#.####.## #HHHHHH# ##.####.#',
  '#.####.## ######## ##.####.#',
  'TTTTTT.##          ##.TTTTTT',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
  '                            ',
  '                            ',
];

/**
 * Crazy Otto prototype map:
 * Psychedelic cyan & amber maze with fast open mid-lane corridors!
 */
const CRAZY_OTTO_MAP = [
  '                            ',
  '                            ',
  '                            ',
  '############################',
  '#............##............#',
  '#.###.######.##.######.###.#',
  '#o###.######.##.######.###o#',
  '#..........................#',
  '#.###.##.##########.##.###.#',
  '#.###.##.##########.##.###.#',
  '#.....##.....##.....##.....#',
  '#####.###### ## ######.#####',
  '    #.###### ## ######.#    ',
  '    #.##     X      ##.#    ',
  '    #.## ###----### ##.#    ',
  '#####.## # HHHHHH # ##.#####',
  'TTTTT.   # HHHHHH #   .TTTTT',
  '#####.## # HHHHHH # ##.#####',
  '    #.## ########## ##.#    ',
  '    #.##            ##.#    ',
  '    #.## ########## ##.#    ',
  '#####.## ########## ##.#####',
  '#............##............#',
  '#.###.######.##.######.###.#',
  '#o..#.######.##.######.#..o#',
  '###.#........  ........#.###',
  '###.#.##.##########.##.#.###',
  '#.....##.....##.....##.....#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
  '                            ',
  '                            ',
];

function parseMapString(map: string[]): TileType[][] {
  return map.map((row) => {
    return row.split('').map((char): TileType => {
      switch (char) {
        case '#':
          return 'WALL';
        case '.':
          return 'DOT';
        case 'o':
          return 'ENERGIZER';
        case '-':
          return 'GATE';
        case 'H':
          return 'GHOST_HOUSE';
        case 'T':
          return 'TUNNEL';
        case 'X':
          return 'NO_UP_ZONE';
        default:
          return 'EMPTY';
      }
    });
  });
}

export function getMazeData(mode: GameMode, level: number = 1, seed?: number): MazeData {
  switch (mode) {
    case 'PACMAN': {
      return {
        width: 28,
        height: 36,
        tiles: parseMapString(CLASSIC_PACMAN_MAP),
        pacmanSpawn: { x: 13, y: 26, dir: 'LEFT' },
        ghostSpawns: {
          BLINKY: { x: 13, y: 14, inHouse: false, initialDir: 'LEFT' },
          PINKY: { x: 13, y: 17, inHouse: true, initialDir: 'UP' },
          INKY: { x: 11, y: 17, inHouse: true, initialDir: 'UP' },
          CLYDE: { x: 15, y: 17, inHouse: true, initialDir: 'UP' },
        },
        scatterTargets: {
          BLINKY: { col: 25, row: 0 },
          PINKY: { col: 2, row: 0 },
          INKY: { col: 27, row: 34 },
          CLYDE: { col: 0, row: 34 },
        },
        tunnels: [{ y: 17, leftExit: 0, rightExit: 27 }],
        wallColor: '#2121ff', // Iconic arcade blue neon
        dotColor: '#ffb8ae', // Arcade warm peach/yellow dots
        bgColor: '#000000',
        gateColor: '#ffb8ff',
      };
    }
    case 'MS_PACMAN': {
      // Ms. Pac-Man alternated colors every few levels (Pink/Salmon, Light Blue, Brown, etc.)
      const isLevelEven = level % 2 === 0;
      return {
        width: 28,
        height: 36,
        tiles: parseMapString(MS_PACMAN_MAP),
        pacmanSpawn: { x: 13, y: 26, dir: 'LEFT' },
        ghostSpawns: {
          BLINKY: { x: 13, y: 14, inHouse: false, initialDir: 'LEFT' },
          PINKY: { x: 13, y: 17, inHouse: true, initialDir: 'UP' },
          INKY: { x: 11, y: 17, inHouse: true, initialDir: 'UP' },
          CLYDE: { x: 15, y: 17, inHouse: true, initialDir: 'UP' },
        },
        scatterTargets: {
          BLINKY: { col: 25, row: 0 },
          PINKY: { col: 2, row: 0 },
          INKY: { col: 27, row: 34 },
          CLYDE: { col: 0, row: 34 },
        },
        // Dual tunnels!
        tunnels: [
          { y: 10, leftExit: 0, rightExit: 27 },
          { y: 20, leftExit: 0, rightExit: 27 },
        ],
        wallColor: isLevelEven ? '#00e5ff' : '#ff7b90', // Vibrant pink or cyan
        dotColor: '#ffffff',
        bgColor: '#000000',
        gateColor: '#ffb8ff',
      };
    }
    case 'CRAZY_OTTO': {
      return {
        width: 28,
        height: 36,
        tiles: parseMapString(CRAZY_OTTO_MAP),
        pacmanSpawn: { x: 13, y: 26, dir: 'LEFT' },
        ghostSpawns: {
          BLINKY: { x: 13, y: 14, inHouse: false, initialDir: 'LEFT' },
          PINKY: { x: 13, y: 17, inHouse: true, initialDir: 'UP' },
          INKY: { x: 11, y: 17, inHouse: true, initialDir: 'UP' },
          CLYDE: { x: 15, y: 17, inHouse: true, initialDir: 'UP' },
        },
        scatterTargets: {
          BLINKY: { col: 25, row: 0 },
          PINKY: { col: 2, row: 0 },
          INKY: { col: 27, row: 34 },
          CLYDE: { col: 0, row: 34 },
        },
        tunnels: [{ y: 17, leftExit: 0, rightExit: 27 }],
        wallColor: '#00cc88', // Emerald proto green
        dotColor: '#ffff00', // Bright yellow dots
        bgColor: '#050a12',
        gateColor: '#ff4444',
      };
    }
    case 'COOKIE_MAN': {
      return generateProceduralMaze(seed);
    }
  }
}
