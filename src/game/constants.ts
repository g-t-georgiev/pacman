/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GhostType, TileCoord } from "../types/game";

export const TILE_SIZE = 16;
export const MAZE_COLS = 28;
export const MAZE_ROWS = 36;
export const CANVAS_WIDTH = MAZE_COLS * TILE_SIZE; // 448px
export const CANVAS_HEIGHT = MAZE_ROWS * TILE_SIZE; // 576px

// Speeds in pixels per frame at 60 FPS
export const PACMAN_BASE_SPEED = 1.6;
export const PACMAN_EATING_SPEED = 1.45;
export const PACMAN_TURBO_SPEED = 2.4;

export const GHOST_BASE_SPEED = 1.5;
export const GHOST_TUNNEL_SPEED = 0.8;
export const GHOST_FRIGHTENED_SPEED = 0.9;
export const GHOST_EATEN_SPEED = 3.2;
export const GHOST_HOUSE_SPEED = 0.8;

// Elroy speed boosts for Blinky when dots left <= 20 and <= 10
export const ELROY_1_SPEED = 1.65;
export const ELROY_2_SPEED = 1.8;

// Scatter / Chase timing table (in seconds)
export const SCATTER_CHASE_SCHEDULE = [
  { mode: "SCATTER", duration: 7 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 7 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 5 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 5 },
  { mode: "CHASE", duration: Infinity },
];

// Frightened durations by level (in seconds)
export const FRIGHTENED_DURATIONS: Record<number, number> = {
  1: 8,
  2: 6,
  3: 4,
  4: 3,
  5: 2,
};

// Fruit metadata per level for classic Pac-Man
export const CLASSIC_FRUITS: Array<{ name: string; points: number; symbol: string; color: string }> = [
  { name: "Cherry", points: 100, symbol: "🍒", color: "#ff2244" },
  { name: "Strawberry", points: 300, symbol: "🍓", color: "#ff3366" },
  { name: "Peach", points: 500, symbol: "🍑", color: "#ff9966" },
  { name: "Peach", points: 500, symbol: "🍑", color: "#ff9966" },
  { name: "Apple", points: 700, symbol: "🍎", color: "#ee1111" },
  { name: "Apple", points: 700, symbol: "🍎", color: "#ee1111" },
  { name: "Melon", points: 1000, symbol: "🍈", color: "#55dd66" },
  { name: "Melon", points: 1000, symbol: "🍈", color: "#55dd66" },
  { name: "Galaxian", points: 2000, symbol: "🚀", color: "#ffd700" },
  { name: "Galaxian", points: 2000, symbol: "🚀", color: "#ffd700" },
  { name: "Bell", points: 3000, symbol: "🔔", color: "#ffdd00" },
  { name: "Bell", points: 3000, symbol: "🔔", color: "#ffdd00" },
  { name: "Key", points: 5000, symbol: "🗝️", color: "#00ddff" },
];

export const CRAZY_OTTO_TREATS = [
  { name: "Red Apple", points: 100, symbol: "🍎", color: "#ff3333" },
  { name: "Banana", points: 300, symbol: "🍌", color: "#ffea00" },
  { name: "Pretzel", points: 500, symbol: "🥨", color: "#c68a4c" },
  { name: "Pear", points: 700, symbol: "🍐", color: "#88dd22" },
  { name: "Pineapple", points: 1000, symbol: "🍍", color: "#ffbb11" },
];

export const COOKIE_MAN_TREATS = [
  { name: "Glass of Milk", points: 200, symbol: "🥛", color: "#f0f4f8" },
  { name: "Frosted Cupcake", points: 400, symbol: "🧁", color: "#ff69b4" },
  { name: "Glazed Donut", points: 800, symbol: "🍩", color: "#e69555" },
  { name: "Hot Cocoa", points: 1200, symbol: "☕", color: "#8b4513" },
  { name: "Gingerbread House", points: 2500, symbol: "🏠", color: "#cd853f" },
];

// Scatter home corners (col, row in tile coords)
export const DEFAULT_SCATTER_TARGETS: Record<GhostType, TileCoord> = {
  BLINKY: { col: 25, row: 0 },
  PINKY: { col: 2, row: 0 },
  INKY: { col: 27, row: 34 },
  CLYDE: { col: 0, row: 34 },
};

// Ghost colors
export const GHOST_COLORS: Record<GhostType, { body: string; name: string; msName?: string }> = {
  BLINKY: { body: "#FF0000", name: "Blinky", msName: "Blinky" },
  PINKY: { body: "#FFB8FF", name: "Pinky", msName: "Pinky" },
  INKY: { body: "#00FFFF", name: "Inky", msName: "Inky" },
  CLYDE: { body: "#FFB852", name: "Clyde", msName: "Sue" },
};
