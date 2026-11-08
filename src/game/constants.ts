import type {
  DualTileCoord,
  GameMode,
  GhostType,
  LevelSpeedConfig,
  ScatterChaseSchedule,
  TileCoord,
} from "../types";

/** Simulation ticks per second. Every timer in the sim counts these frames. */
export const SIM_FPS = 60;

/**
 * Tile size in sim pixels. The sim runs in the arcade's own coordinates: 8-px tiles, integer
 * pixel positions, so every pixel figure in the Dossier applies directly.
 */
export const TILE_SIZE = 8;
/** The renderer draws every sim pixel as RENDER_SCALE x RENDER_SCALE canvas pixels. */
export const RENDER_SCALE = 2;
/** Tile size on the canvas. Only the renderer and UI use this. */
export const RENDER_TILE_SIZE = TILE_SIZE * RENDER_SCALE;
export const MAZE_COLS = 28;
export const MAZE_ROWS = 36;
export const CANVAS_WIDTH = MAZE_COLS * RENDER_TILE_SIZE; // 448px
export const CANVAS_HEIGHT = MAZE_ROWS * RENDER_TILE_SIZE; // 576px

/** Remaining number of dots pacman has to eat for Blinky's "Elroy 1" mode to activate. */
export const ELROY_1_DOTS_LEFT = 20;
/** Remaining number of dots pacman has to eat for Blinky's "Elroy 2" mode to activate. */
export const ELROY_2_DOTS_LEFT = 10;

/**
 * Pac-Man's turn window around a turn's center pixel (Dossier, "Cornering"). Pac-Man may start a
 * turn while he is within CORNER_WINDOW_LOW pixels on the low-coordinate side of the center
 * (left / above) or CORNER_WINDOW_HIGH pixels on the high side (right / below). So entering from
 * the left or top gives 3 pre-turn and 4 post-turn pixels, and from the right or bottom 4 and 3.
 * The window is 8 pixels wide, so every position belongs to exactly one turn.
 */
export const CORNER_WINDOW_LOW = 3;
/** Follows from the 8-px window: TILE_SIZE - 1 - CORNER_WINDOW_LOW. */
export const CORNER_WINDOW_HIGH = TILE_SIZE - 1 - CORNER_WINDOW_LOW;

/**
 * Speed percentages: 100% = 75.7576 arcade px/s = 1.25 arcade px/frame at 60.606 Hz (Dossier, Table A.1).
 * Pac-Man's slower "eating" speeds are not separate entries: they come from the 1-frame (dot) and
 * 3-frame (energizer) stalls.
 */
export const SPEED_PCT_PER_LEVEL_1: LevelSpeedConfig = {
  pacmanNormal: 80, // 1 px/frame
  pacmanFright: 90, // 1.125 px/frame
  ghostNormal: 75, // 0.9375 px/frame
  ghostTunnel: 40, // 0.5 px/frame
  ghostFrightened: 50, // 0.625 px/frame
  elroy1: 80, // 1 px/frame
  elroy2: 85, // 1.0625 px/frame
};

export const SPEED_PCT_PER_LEVELS_2_TO_4: LevelSpeedConfig = {
  pacmanNormal: 90, // 1.125 px/frame
  pacmanFright: 95, // 1.1875 px/frame
  ghostNormal: 85, // 1.0625 px/frame
  ghostTunnel: 45, // 0.5625 px/frame
  ghostFrightened: 55, // 0.6875 px/frame
  elroy1: 90, // 1.125 px/frame
  elroy2: 95, // 1.1875 px/frame
};

export const SPEED_PCT_PER_LEVELS_5_TO_20: LevelSpeedConfig = {
  pacmanNormal: 100, // 1.25 px/frame
  pacmanFright: 100, // 1.25 px/frame
  ghostNormal: 95, // 1.1875 px/frame
  ghostTunnel: 50, // 0.625 px/frame
  ghostFrightened: 60, // 0.75 px/frame
  elroy1: 100, // 1.25 px/frame
  elroy2: 105, // 1.3125 px/frame
};

export const SPEED_PCT_PER_LEVELS_21_PLUS: LevelSpeedConfig = {
  pacmanNormal: 90, // 1.125 px/frame
  pacmanFright: 100, // 1.25 px/frame
  ghostNormal: 95, // 1.1875 px/frame
  ghostTunnel: 50, // 0.625 px/frame
  ghostFrightened: 60, // 0.75 px/frame
  elroy1: 100, // 1.25 px/frame
  elroy2: 105, // 1.3125 px/frame
};

/** Speed value for ghosts' eyes when eaten and return to the ghost house. */
export const GHOST_EATEN_SPEED_PCT = 200; // Key into SPEED_MASKS for returning eyes (see speedMasks.ts)
/** Speed value for ghosts inside the ghost house. */
export const GHOST_HOUSE_SPEED_PCT = 80;

/**
 * Scatter / Chase timing table (durations in seconds, stored in frames).
 *
 * Level 1:
 *
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 5s, CHASE: 20s
 * - SCATTER: 5s, CHASE: permanent
 */
export const SCATTER_CHASE_LEVEL_1: readonly ScatterChaseSchedule[] = [
  { mode: "SCATTER", frames: 7 * SIM_FPS },
  { mode: "CHASE", frames: 20 * SIM_FPS },
  { mode: "SCATTER", frames: 7 * SIM_FPS },
  { mode: "CHASE", frames: 20 * SIM_FPS },
  { mode: "SCATTER", frames: 5 * SIM_FPS },
  { mode: "CHASE", frames: 20 * SIM_FPS },
  { mode: "SCATTER", frames: 5 * SIM_FPS },
  { mode: "CHASE", frames: Infinity },
] as const;

/**
 * Scatter / Chase timing table (durations in seconds, stored in frames).
 *
 * Levels 2 - 4:
 *
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 5s, CHASE: 1033s (~17 min)
 * - SCATTER: 1/60s, CHASE: permanent
 */
export const SCATTER_CHASE_LEVELS_2_TO_4: readonly ScatterChaseSchedule[] = [
  { mode: "SCATTER", frames: 7 * SIM_FPS },
  { mode: "CHASE", frames: 20 * SIM_FPS },
  { mode: "SCATTER", frames: 7 * SIM_FPS },
  { mode: "CHASE", frames: 20 * SIM_FPS },
  { mode: "SCATTER", frames: 5 * SIM_FPS },
  { mode: "CHASE", frames: 1033 * SIM_FPS },
  { mode: "SCATTER", frames: 1 },
  { mode: "CHASE", frames: Infinity },
] as const;

/**
 * Scatter / Chase timing table (durations in seconds, stored in frames).
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
  { mode: "SCATTER", frames: 5 * SIM_FPS },
  { mode: "CHASE", frames: 20 * SIM_FPS },
  { mode: "SCATTER", frames: 5 * SIM_FPS },
  { mode: "CHASE", frames: 20 * SIM_FPS },
  { mode: "SCATTER", frames: 1 },
  { mode: "CHASE", frames: 1037 * SIM_FPS },
  { mode: "SCATTER", frames: 1 },
  { mode: "CHASE", frames: Infinity },
] as const;

/** Frightened duration per level, in seconds (Dossier, Table A.1). Use getFrightenedDuration() for frames. */
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
/** Frames per white/blue half-cycle of the frightened warning flash. */
export const FRIGHTENED_FLASH_TOGGLE_FRAMES = 14;

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

export type FruitDataType = typeof CLASSIC_FRUITS;

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
