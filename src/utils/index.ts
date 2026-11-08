import {
  type FruitDataType,
  FRIGHTENED_DURATIONS,
  FRIGHTENED_FLASH_COUNTS,
  SCATTER_CHASE_LEVEL_1,
  SCATTER_CHASE_LEVELS_2_TO_4,
  SCATTER_CHASE_LEVELS_5_PLUS,
  SPEED_PCT_PER_LEVEL_1,
  SPEED_PCT_PER_LEVELS_2_TO_4,
  SPEED_PCT_PER_LEVELS_5_TO_20,
  SPEED_PCT_PER_LEVELS_21_PLUS,
  SIM_FPS,
} from "../game/constants";
import type { LevelSpeedConfig, ScatterChaseSchedule } from "../types";
import { SPEED_MASKS, arcadeStepsOnFrame } from "../game/speedMasks";

export function getFruitDataPerLevel(data: FruitDataType, level: number) {
  return data[Math.min(level - 1, data.length - 1)];
}

/**
 * Frightened duration for a level, in frames. Levels past the table (19+) have none.
 *
 * @param level The current level number (1-indexed).
 */
export function getFrightenedDuration(level: number): number {
  return (FRIGHTENED_DURATIONS[level] ?? 0) * SIM_FPS;
}

/**
 * Retrieves the exact number of warning flashes a ghost performs at the end of the frightened phase.
 * Automatically defaults to 0 for Level 20+ to match the 0-second duration behavior.
 *
 * @param level The current level number (1-indexed).
 * @returns The number of warning flashes before a ghost's frightened phase ends.
 */
export function getFrightenedFlashCount(level: number): number {
  if (level < 1) return 0;
  return FRIGHTENED_FLASH_COUNTS[level] ?? 0;
}

/**
 * Scatter / Chase timing table (in seconds).
 *
 * Level 1:
 *
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 5s, CHASE: 20s
 * - SCATTER: 5s, CHASE: permanent
 *
 * Levels 2 - 4:
 *
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 7s, CHASE: 20s
 * - SCATTER: 5s, CHASE: 1033s (~17 min)
 * - SCATTER: 1/60s, CHASE: permanent
 *
 * Levels 5+:
 *
 * - SCATTER: 5s, CHASE: 20s
 * - SCATTER: 5s, CHASE: 20s
 * - SCATTER: 1/60s, CHASE: 1037s (~17.3 min)
 * - SCATTER: 1/60s, CHASE: permanent
 *
 * *Note: In level 5 and beyond every 3rd scatter drops down to 1 frame here due to an integer underflow in the ROM*
 *
 * @param level The current level number (1-indexed).
 * @returns The array of schedule phases for this level tier.
 */
export function getScatterChaseSchedule(level: number): readonly ScatterChaseSchedule[] {
  if (level <= 1) return SCATTER_CHASE_LEVEL_1;
  if (level >= 5) return SCATTER_CHASE_LEVELS_5_PLUS;
  return SCATTER_CHASE_LEVELS_2_TO_4;
}

/**
 * Retrieves the authentic arcade movement speed configuration for a given level.
 * Uses pre-allocated static configurations in constants to avoid GC pressure in the render loop.
 *
 * - Level 1
 * - Levels 2-4
 * - Levels 5-20
 * - Levels 21+
 *
 * @param level The current level number (1-indexed).
 * @returns The LevelSpeedConfig for the corresponding level tier.
 */
export function getSpeedConfigForLevel(level: number): LevelSpeedConfig {
  if (level <= 1) return SPEED_PCT_PER_LEVEL_1;
  if (level <= 4) return SPEED_PCT_PER_LEVELS_2_TO_4;
  if (level <= 20) return SPEED_PCT_PER_LEVELS_5_TO_20;
  return SPEED_PCT_PER_LEVELS_21_PLUS;
}

/**
 * Pixels to move this frame, from the speed's 16-frame step masks (see `speedMasks.ts`).
 * Callers must move one sim pixel at a time and run full per-pixel logic for each.
 *
 * @param currLevelFrame Monotonically increasing frame counter for the level.
 * @param speedPct A speed percentage that has an entry in SPEED_MASKS.
 * @param turboMultiplier Optional turbo multiplier (to be replaced by tick-rate scaling, plan D2).
 */
export function getPixelStepsThisFrame(
  currLevelFrame: number,
  speedPct: number,
  turboMultiplier: number = 1.0
): number {
  const steps = arcadeStepsOnFrame(SPEED_MASKS[speedPct], currLevelFrame);
  return turboMultiplier > 1.0 ? Math.round(steps * turboMultiplier) : steps;
}
