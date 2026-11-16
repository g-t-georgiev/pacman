import type { DualTileCoord, GameMode, GhostType, ScatterChaseSchedule, TileCoord } from "../types";

/**
 * Frames per second used to turn the Dossier's seconds into frame counts. Every timer in the sim
 * counts frames; one tick is one arcade frame.
 */
export const SIM_FPS = 60;

/**
 * The arcade's real refresh rate (Dossier, App. C: 60.606 Hz). With `settings.arcadeRefreshRate`
 * on (the default) the real-time loop runs this many ticks per second, so 100% speed is the
 * Dossier's 75.76 px/s. Off, it runs at a plain 60 (about 1% slower). Ticks never change.
 */
export const ARCADE_REFRESH_HZ = 60.606_06;

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

/*
 * Per-level values (speeds, Elroy, frightened time, flashes, fruit, house limits) live in
 * LEVEL_TABLE (levelTable.ts). Speeds are percentages: 100% = 75.7576 arcade px/s = 1.25 px per
 * frame at 60.606 Hz (Dossier, Table A.1); Pac-Man's slower "eating" speeds come from the 1- and
 * 3-frame stalls, not from separate entries.
 */

/** Speed value for ghosts' eyes when eaten and return to the ghost house. */
export const GHOST_EATEN_SPEED_PCT = 200; // Key into SPEED_MASKS for returning eyes (see speedMasks.ts)
/** Speed inside the ghost house (bobbing and leaving). Not in the Dossier: an estimate. */
export const GHOST_HOUSE_SPEED_PCT = 50;

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
 * - SCATTER: 5s, CHASE: 1037s (~17.3 min)
 * - SCATTER: 1/60s, CHASE: permanent
 *
 * The third scatter is 5 s on every level (Dossier, Scatter/Chase table).
 */
export const SCATTER_CHASE_LEVELS_5_PLUS: readonly ScatterChaseSchedule[] = [
  { mode: "SCATTER", frames: 5 * SIM_FPS },
  { mode: "CHASE", frames: 20 * SIM_FPS },
  { mode: "SCATTER", frames: 5 * SIM_FPS },
  { mode: "CHASE", frames: 20 * SIM_FPS },
  { mode: "SCATTER", frames: 5 * SIM_FPS },
  { mode: "CHASE", frames: 1037 * SIM_FPS },
  { mode: "SCATTER", frames: 1 },
  { mode: "CHASE", frames: Infinity },
] as const;

/** Frames per white/blue half-cycle of the frightened warning flash. */
export const FRIGHTENED_FLASH_TOGGLE_FRAMES = 14;

/** Bonus fruit names; which one a level shows is in LEVEL_TABLE (levelTable.ts). */
export type FruitName =
  | "Cherry"
  | "Strawberry"
  | "Peach"
  | "Apple"
  | "Melon"
  | "Galaxian"
  | "Bell"
  | "Key";

export interface FruitInfo {
  name: FruitName;
  points: number;
  symbol: string;
  color: string;
}

/** Points per fruit (Dossier, Table A.1) and how the UI shows it. */
export const FRUIT_CATALOG: Record<FruitName, FruitInfo> = {
  Cherry: { name: "Cherry", points: 100, symbol: "🍒", color: "#ff2244" },
  Strawberry: { name: "Strawberry", points: 300, symbol: "🍓", color: "#ff3366" },
  Peach: { name: "Peach", points: 500, symbol: "🍑", color: "#ff9966" },
  Apple: { name: "Apple", points: 700, symbol: "🍎", color: "#ee1111" },
  Melon: { name: "Melon", points: 1000, symbol: "🍈", color: "#55dd66" },
  Galaxian: { name: "Galaxian", points: 2000, symbol: "🚀", color: "#ffd700" },
  Bell: { name: "Bell", points: 3000, symbol: "🔔", color: "#ffdd00" },
  Key: { name: "Key", points: 5000, symbol: "🗝️", color: "#00ddff" },
};

export const DEFAULT_SCATTER_TARGETS: Record<GameMode, Record<GhostType, TileCoord>> = {
  PACMAN: {
    BLINKY: { col: 25, row: 0 },
    PINKY: { col: 2, row: 0 },
    INKY: { col: 27, row: 35 },
    CLYDE: { col: 0, row: 35 },
  },
  MS_PACMAN: {
    BLINKY: { col: 25, row: 0 },
    PINKY: { col: 2, row: 0 },
    INKY: { col: 27, row: 35 },
    CLYDE: { col: 0, row: 35 },
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

/** One bonus life at this score (the arcade's default DIP-switch setting). */
export const EXTRA_LIFE_SCORE = 10_000;

/**
 * Bonus fruit stays between 9 and 10 seconds (Dossier, "The Basics"). The exact length is drawn
 * from the sim's random stream, so patterns can't rely on it but replays stay exact.
 */
export const FRUIT_MIN_FRAMES = 9 * SIM_FPS;
export const FRUIT_EXTRA_FRAMES = SIM_FPS;

/**
 * The canvas font for game texts (score rows, banners, pop-ups): Emulogic, a pixel font on an
 * 8-px grid, so 16 px (one canvas tile) and 8 px stay crisp. Falls back while it loads.
 */
export const arcadeFont = (px: number): string => `${px}px "Emulogic", "Courier New", monospace`;

/**
 * Actor sprites are 16x16 arcade pixels (2x2 tiles) centered on the actor, so they overlap the
 * walls beside a corridor, as in the arcade (F27). Purely visual: an actor occupies only the tile
 * of its center point (Dossier, "What Tile Am I In?"). The shapes are drawn on a one-tile box and
 * scaled up around the center.
 */
/** Half the sprite box, in canvas pixels (one tile). */
export const SPRITE_HALF = RENDER_TILE_SIZE;
/** Pac-Man's body: ~13 of 16 arcade px across. Drawn with radius 9, so scaled 13 / 9. */
export const PACMAN_DRAW_SCALE = (13 * RENDER_SCALE) / 2 / 9;
/** A ghost: ~14 of 16 arcade px wide. Drawn one tile (16 canvas px) wide, so scaled 28 / 16. */
export const GHOST_DRAW_SCALE = (14 * RENDER_SCALE) / RENDER_TILE_SIZE;
/** The bonus fruit, drawn as an emoji about two tiles tall. */
export const FRUIT_FONT_PX = Math.round(RENDER_TILE_SIZE * 1.75);
