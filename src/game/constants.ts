import type {
  DualTileCoord,
  GameMode,
  GhostType,
  LevelSpeedConfig,
  ScatterChaseSchedule,
  TileCoord,
} from "../types";

export const TILE_SIZE = 16;
export const MAZE_COLS = 28;
export const MAZE_ROWS = 36;
export const CANVAS_WIDTH = MAZE_COLS * TILE_SIZE; // 448px
export const CANVAS_HEIGHT = MAZE_ROWS * TILE_SIZE; // 576px

/** Remaining number of dots pacman has to eat for Blinky's "Elroy 1" mode to activate. */
export const ELROY_1_DOTS_LEFT = 20;
/** Remaining number of dots pacman has to eat for Blinky's "Elroy 2" mode to activate. */
export const ELROY_2_DOTS_LEFT = 10;

/** Default cornering tolerance in pixels for Pac-Man to initiate pre-turns */
export const PACMAN_CORNERING_TOLERANCE = 4;

/**
 * Authentic 16-frame cycle movement bitmasks from the original arcade ROM.
 * 1 means the actor advances 1 pixel on that frame; 0 means the actor pauses on that frame.
 */
export const SPEED_MASKS: Record<number, number> = {
  100: 0b1111_1111_1111_1111, // 16 steps (1px every frame)
  95: 0b1111_1111_1111_1101, // 15 steps
  90: 0b1111_0111_1111_0111, // 14 steps
  87: 0b1111_0111_1110_1110, // 14 steps
  85: 0b1110_1110_1111_0111, // 13 steps
  83: 0b1110_1110_1011_1101, // 13 steps
  80: 0b1110_1111_1110_1101, // 13 steps
  79: 0b1110_1011_1110_1011, // 12 steps (Pac-Man eating dots L2+)
  75: 0b1110_1110_1110_1110, // 12 steps (3 out of every 4 frames = 75%)
  71: 0b1110_1011_1110_1010, // 11 steps (Pac-Man eating dots L1)
  60: 0b1101_0110_1101_0110, // 10 steps (Ghost frightened L5+)
  55: 0b1010_1101_1010_0101, // 9 steps (Ghost frightened L2-4)
  50: 0b1010_1010_1010_1010, // 8 steps (Ghost frightened L1 / Tunnel L5+)
  45: 0b1001_0101_1001_0100, // 7 steps (Tunnel L2-4)
  40: 0b1001_0010_0100_1001, // 6 steps (Tunnel L1)
};

export const SPEED_PCT_PER_LEVEL_1: LevelSpeedConfig = {
  pacmanNormal: 80, // 1.01 px
  pacmanEating: 71, // 0.896375 px
  pacmanFright: 90, // 1.13625 px
  pacmanFrightEating: 83, // 1.047875 px
  ghostNormal: 75, // 0.946875 px
  ghostTunnel: 40, // 0.505 px
  ghostFrightened: 50, // 0.63125 px
  elroy1: 80, // 1.01 px
  elroy2: 85, // 1.073125 px
};

export const SPEED_PCT_PER_LEVELS_2_TO_4: LevelSpeedConfig = {
  pacmanNormal: 90, // 1.13625 px
  pacmanEating: 79, // 0.997375 px
  pacmanFright: 95, // 1.199375 px
  pacmanFrightEating: 87, // 1.098375 px
  ghostNormal: 85, // 1.073125 px
  ghostTunnel: 45, // 0.568125 px
  ghostFrightened: 55, // 0.694375 px
  elroy1: 90, // 1.13625 px
  elroy2: 95, // 1.199375 px
};

export const SPEED_PCT_PER_LEVELS_5_TO_20: LevelSpeedConfig = {
  pacmanNormal: 100, // 1.2625 px
  pacmanEating: 87, // 1.098375 px
  pacmanFright: 100, // 1.2625 px
  pacmanFrightEating: 87, // 1.098375 px
  ghostNormal: 95, // 1.199375 px
  ghostTunnel: 50, // 0.63125 px
  ghostFrightened: 60, // 0.7575 px
  elroy1: 100, // 1.2625 px
  elroy2: 105, // 1.325625 px
};

export const SPEED_PCT_PER_LEVELS_21_PLUS: LevelSpeedConfig = {
  pacmanNormal: 90, // 1.13625 px
  pacmanEating: 79, // 0.997375 px
  pacmanFright: 100, // 1.2625 px
  pacmanFrightEating: 87, // 1.098375 px
  ghostNormal: 95, // 1.199375 px
  ghostTunnel: 50, // 0.63125 px
  ghostFrightened: 60, // 0.7575 px
  elroy1: 100, // 1.2625 px
  elroy2: 105, // 1.325625 px
};

/** Speed value for ghosts' eyes when eaten and return to the ghost house. */
export const GHOST_EATEN_SPEED_PCT = 200; // 200% speed for returning eyes = 2.525 px;
/** Speed value for ghosts inside the ghost house. */
export const GHOST_HOUSE_SPEED_PCT = 80;

/**
 * Scatter / Chase timing table (in seconds).
 *
 * Level 1:
 *
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 5s, CHASE: 20s
 * - SCATTER: 5s, CHASE: permanent
 */
export const SCATTER_CHASE_LEVEL_1: readonly ScatterChaseSchedule[] = [
  { mode: "SCATTER", duration: 7 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 7 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 5 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 5 },
  { mode: "CHASE", duration: Infinity },
] as const;

/**
 * Scatter / Chase timing table (in seconds).
 *
 * Levels 2 - 4:
 *
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 5s, CHASE: 1033s (~17 min)
 * - SCATTER: 1/60s, CHASE: permanent
 */
export const SCATTER_CHASE_LEVELS_2_TO_4: readonly ScatterChaseSchedule[] = [
  { mode: "SCATTER", duration: 7 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 7 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 5 },
  { mode: "CHASE", duration: 1033 },
  { mode: "SCATTER", duration: 1 / 60 },
  { mode: "CHASE", duration: Infinity },
] as const;

/**
 * Scatter / Chase timing table (in seconds).
 *
 * Levels 5+:
 *
 * - SCATTER: 5s, CHASE: 20s
 * - SCATTER: 5s, CHASE: 20s
 * - SCATTER: 1/60s, CHASE: 1037s (~17.3 min)
 * - SCATTER: 1/60s, CHASE: permanent
 *
 * *Note: In level 5 and beyond every 3rd scatter drops down to 1 frame here due to an integer underflow in the ROM*
 */
export const SCATTER_CHASE_LEVELS_5_PLUS: readonly ScatterChaseSchedule[] = [
  { mode: "SCATTER", duration: 5 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 5 },
  { mode: "CHASE", duration: 20 },
  { mode: "SCATTER", duration: 1 / 60 },
  { mode: "CHASE", duration: 1037 },
  { mode: "SCATTER", duration: 1 / 60 },
  { mode: "CHASE", duration: Infinity },
] as const;

export const FRIGHTENED_DURATIONS: Record<number, number> = {
  1: 6,
  2: 5,
  3: 4,
  4: 3,
  5: 2,
  6: 5,
  7: 2,
  8: 2,
  9: 1,
  10: 5,
  11: 2,
  12: 1,
  13: 1,
  14: 3,
  15: 1,
  16: 1,
  17: 0,
  18: 1,
  19: 0,
} as const;

export const FRIGHTENED_FLASH_COUNTS: Record<number, number> = {
  1: 5,
  2: 5,
  3: 5,
  4: 5,
  5: 5,
  6: 5,
  7: 5,
  8: 5,
  9: 3,
  10: 5,
  11: 5,
  12: 3,
  13: 3,
  14: 5,
  15: 3,
  16: 3,
  17: 0,
  18: 3,
  19: 0,
} as const;

/**
 * Duration of each color phase (white or blue) during ghosts' warning flashes
 * (14 frames at 60 FPS = ~0.2333s) during last momemnts of frightened state.
 */
export const FRIGHTENED_FLASH_TOGGLE_DURATION = 14 / 60;

export const CLASSIC_FRUITS: Array<{
  name: string;
  points: number;
  symbol: string;
  color: string;
}> = [
  { name: "Cherry", points: 100, symbol: "🍒", color: "#ff2244" }, // Lvl 1
  { name: "Strawberry", points: 300, symbol: "🍓", color: "#ff3366" }, // Lvl 2
  { name: "Peach", points: 500, symbol: "🍑", color: "#ff9966" }, // Lvl 3
  { name: "Peach", points: 500, symbol: "🍑", color: "#ff9966" }, // Lvl 4
  { name: "Apple", points: 700, symbol: "🍎", color: "#ee1111" }, // Lvl 5
  { name: "Apple", points: 700, symbol: "🍎", color: "#ee1111" }, // Lvl 6
  { name: "Melon", points: 1000, symbol: "🍈", color: "#55dd66" }, // Lvl 7
  { name: "Melon", points: 1000, symbol: "🍈", color: "#55dd66" }, // Lvl 8
  { name: "Galaxian", points: 2000, symbol: "🚀", color: "#ffd700" }, // Lvl 9
  { name: "Galaxian", points: 2000, symbol: "🚀", color: "#ffd700" }, // Lvl 10
  { name: "Bell", points: 3000, symbol: "🔔", color: "#ffdd00" }, // Lvl 11
  { name: "Bell", points: 3000, symbol: "🔔", color: "#ffdd00" }, // Lvl 12
  { name: "Key", points: 5000, symbol: "🗝️", color: "#00ddff" }, // Lvl 13+
] as const;

export const CRAZY_OTTO_TREATS = [
  { name: "Red Apple", points: 100, symbol: "🍎", color: "#ff3333" }, // Lvl 1
  { name: "Banana", points: 300, symbol: "🍌", color: "#ffea00" }, // Lvl 2
  { name: "Pretzel", points: 500, symbol: "🥨", color: "#c68a4c" }, // Lvl 3
  { name: "Pear", points: 700, symbol: "🍐", color: "#88dd22" }, // Lvl 4
  { name: "Pineapple", points: 1000, symbol: "🍍", color: "#ffbb11" }, // Lvl 5+
] as const;

export const COOKIE_MAN_TREATS = [
  { name: "Glass of Milk", points: 200, symbol: "🥛", color: "#f0f4f8" }, // Lvl 1
  { name: "Frosted Cupcake", points: 400, symbol: "🧁", color: "#ff69b4" }, // Lvl 2
  { name: "Glazed Donut", points: 800, symbol: "🍩", color: "#e69555" }, // Lvl 3
  { name: "Hot Cocoa", points: 1200, symbol: "☕", color: "#8b4513" }, // Lvl 4
  { name: "Gingerbread House", points: 2500, symbol: "🏠", color: "#cd853f" }, // Lvl 5+
] as const;

export type FruitDataType =
  | typeof CLASSIC_FRUITS
  | typeof COOKIE_MAN_TREATS
  | typeof CRAZY_OTTO_TREATS;

export const DEFAULT_SCATTER_TARGETS: Record<GameMode, Record<GhostType, TileCoord>> = {
  PACMAN: {
    BLINKY: { col: 25, row: 0 },
    PINKY: { col: 2, row: 0 },
    INKY: { col: 27, row: 34 },
    CLYDE: { col: 0, row: 34 },
  },
  MS_PACMAN: {
    BLINKY: { col: 25, row: 0 },
    PINKY: { col: 2, row: 0 },
    INKY: { col: 27, row: 34 },
    CLYDE: { col: 0, row: 34 },
  },
  COOKIE_MAN: {
    BLINKY: { col: 25, row: 0 },
    PINKY: { col: 2, row: 0 },
    INKY: { col: 27, row: 34 },
    CLYDE: { col: 0, row: 34 },
  },
  CRAZY_OTTO: {
    BLINKY: { col: 25, row: 0 },
    PINKY: { col: 2, row: 0 },
    INKY: { col: 27, row: 34 },
    CLYDE: { col: 0, row: 34 },
  },
} as const;

export const GHOST_COLORS: Record<GhostType, { body: string; name: string; msName?: string }> = {
  BLINKY: { body: "#FF0000", name: "Blinky", msName: "Blinky" },
  PINKY: { body: "#FFB8FF", name: "Pinky", msName: "Pinky" },
  INKY: { body: "#00FFFF", name: "Inky", msName: "Inky" },
  CLYDE: { body: "#FFB852", name: "Clyde", msName: "Sue" },
} as const;

export const DEFAULT_SPAWN_CANDIDATES: Record<"PACMAN" | "FRUIT" | GhostType, DualTileCoord> = {
  PACMAN: [
    { col: 13, row: 26 },
    { col: 14, row: 26 },
  ] as const,
  BLINKY: [
    { col: 13, row: 14 },
    { col: 14, row: 14 },
  ] as const,
  PINKY: [
    { col: 13, row: 17 },
    { col: 14, row: 17 },
  ] as const,
  INKY: [
    { col: 11, row: 17 },
    { col: 12, row: 17 },
  ] as const,
  CLYDE: [
    { col: 15, row: 17 },
    { col: 16, row: 17 },
  ] as const,
  FRUIT: [
    { col: 13, row: 20 },
    { col: 14, row: 20 },
  ] as const,
} as const;
