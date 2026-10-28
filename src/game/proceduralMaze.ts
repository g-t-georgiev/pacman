/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MazeData, TileType } from '../types/game';
import { MAZE_COLS, MAZE_ROWS } from './constants';

/**
 * Procedural maze generator for Cookie Man mode:
 * Generates an authentic horizontally-symmetric arcade-style maze with
 * outer walls, central ghost house, side wrap-around tunnels, and solvable loop connectivity.
 */
export function generateProceduralMaze(seed?: number): MazeData {
  const width = MAZE_COLS; // 28
  const height = MAZE_ROWS; // 36
  const activeTop = 3;
  const activeBottom = 33;

  // Initialize all as WALL
  const tiles: TileType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'WALL' as TileType)
  );

  // Clear top and bottom UI rows
  for (let r = 0; r < activeTop; r++) {
    for (let c = 0; c < width; c++) {
      tiles[r][c] = 'EMPTY';
    }
  }
  for (let r = activeBottom + 1; r < height; r++) {
    for (let c = 0; c < width; c++) {
      tiles[r][c] = 'EMPTY';
    }
  }

  // Define Ghost House region (centered)
  const houseLeft = 10;
  const houseRight = 17;
  const houseTop = 15;
  const houseBottom = 18;

  // Carve out ghost house interior
  for (let r = houseTop; r <= houseBottom; r++) {
    for (let c = houseLeft; c <= houseRight; c++) {
      if (r === houseTop && (c === 13 || c === 14)) {
        tiles[r][c] = 'GATE';
      } else if (r === houseTop || r === houseBottom || c === houseLeft || c === houseRight) {
        tiles[r][c] = 'WALL';
      } else {
        tiles[r][c] = 'GHOST_HOUSE';
      }
    }
  }

  // Create symmetric corridor skeleton on left half [1..13], mirror to right half [14..26]
  // We use a modular cellular grid for symmetric arcade aesthetic
  // Horizontal main pathways
  const hCorridors = [4, 7, 11, 14, 19, 23, 26, 30, 32];
  // Vertical main pathways
  const vCorridors = [1, 6, 9, 12];

  // Carve base grid
  for (const r of hCorridors) {
    for (let c = 1; c <= 13; c++) {
      tiles[r][c] = 'DOT';
    }
  }
  for (const c of vCorridors) {
    for (let r = activeTop + 1; r <= activeBottom - 1; r++) {
      // Don't overwrite ghost house
      if (r >= houseTop - 1 && r <= houseBottom + 1 && c >= houseLeft - 1 && c <= houseRight + 1) {
        continue;
      }
      tiles[r][c] = 'DOT';
    }
  }

  // Pseudo-random wall blocks to make the maze unique and interesting
  const rng = (s: number) => {
    let t = s + 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const currentSeed = seed !== undefined ? seed : Math.floor(Math.random() * 1000000);

  // Add random horizontal & vertical partition blocks (symmetric)
  const blockCandidates = [
    { r: 5, c: 3, w: 2, h: 2 },
    { r: 8, c: 3, w: 3, h: 2 },
    { r: 8, c: 7, w: 2, h: 2 },
    { r: 12, c: 3, w: 3, h: 1 },
    { r: 16, c: 3, w: 2, h: 2 },
    { r: 21, c: 3, w: 3, h: 1 },
    { r: 24, c: 3, w: 2, h: 2 },
    { r: 24, c: 7, w: 2, h: 2 },
    { r: 27, c: 3, w: 3, h: 2 },
    { r: 27, c: 9, w: 2, h: 2 },
    { r: 31, c: 3, w: 2, h: 1 },
  ];

  blockCandidates.forEach((b, idx) => {
    if (rng(currentSeed + idx * 79) > 0.35) {
      for (let ro = 0; ro < b.h; ro++) {
        for (let co = 0; co < b.w; co++) {
          const rr = b.r + ro;
          const cc = b.c + co;
          if (rr >= activeTop + 1 && rr <= activeBottom - 1 && cc >= 1 && cc <= 13) {
            tiles[rr][cc] = 'WALL';
          }
        }
      }
    }
  });

  // Ensure corridor right above ghost house gate is open
  for (let c = 11; c <= 16; c++) {
    tiles[houseTop - 1][c] = 'DOT';
  }

  // Tunnels (row 17)
  const tunnelRow = 17;
  for (let c = 0; c <= 5; c++) {
    tiles[tunnelRow][c] = 'TUNNEL';
  }

  // Mirror left half [1..13] to right half [14..26]
  for (let r = activeTop; r <= activeBottom; r++) {
    for (let c = 1; c <= 13; c++) {
      // Don't mirror into ghost house
      if (r >= houseTop && r <= houseBottom && c >= houseLeft) {
        continue;
      }
      const mirrorCol = width - 1 - c;
      if (!(r >= houseTop && r <= houseBottom && mirrorCol <= houseRight)) {
        tiles[r][mirrorCol] = tiles[r][c];
      }
    }
  }

  // Mirror tunnels to right exit
  for (let c = width - 6; c < width; c++) {
    tiles[tunnelRow][c] = 'TUNNEL';
  }

  // Set energizers at 4 key locations
  const energizerCoords = [
    { r: activeTop + 3, c: 1 },
    { r: activeTop + 3, c: width - 2 },
    { r: activeBottom - 4, c: 1 },
    { r: activeBottom - 4, c: width - 2 },
  ];
  energizerCoords.forEach(({ r, c }) => {
    tiles[r][c] = 'ENERGIZER';
  });

  // Pac-Man spawn point: row 26, col 13.5
  tiles[26][13] = 'EMPTY';
  tiles[26][14] = 'EMPTY';

  return {
    width,
    height,
    tiles,
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
    wallColor: '#8B4513', // Warm cookie gingerbread brown
    dotColor: '#D2B48C', // Chocolate chip beige
    bgColor: '#1A0F0A', // Deep dark espresso oven
    gateColor: '#FF69B4', // Strawberry icing pink gate
  };
}
