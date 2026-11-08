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
  SPEED_MASKS,
  GHOST_EATEN_SPEED_PCT,
} from "../game/constants";
import type { LevelSpeedConfig, ScatterChaseSchedule } from "../types";

export function getFruitDataPerLevel(data: FruitDataType, level: number) {
  return data[Math.min(level - 1, data.length - 1)];
}

/**
 * Retrieves the frightened state duration (in seconds) for a given level.
 * Automatically handles endgame/infinite levels (Level 20+) by defaulting to 0.
 *
 * @param level The current level number (1-indexed).
 * @returns The fright mode duration in seconds.
 */
export function getFrightenedDuration(level: number): number {
  // Guard clause for safety against invalid inputs
  if (level < 1) return 0;

  // Return the explicit configuration if it exists, otherwise default to 0 for levels 20+
  return FRIGHTENED_DURATIONS[level] ?? 0;
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
 * Calculates the exact integer pixel movement step for the current level frame
 * based on the authentic 16-frame cycle bitmasks.
 *
 * @param currLevelFrame Monotonically increasing frame counter for the level.
 * @param speedPct Authentic speed percentage (e.g., 80, 75, 105, 200).
 * @param turboMultiplier Optional turbo chip speed multiplier.
 * @returns 0, 1, or 2 pixels to step this frame.
 */
export function getPixelStepsThisFrame(
  currLevelFrame: number,
  speedPct: number,
  turboMultiplier: number = 1.0
): number {
  // Determine base multiplier tier (2x steps for 200% eaten speed, 1x for everything else)
  const baseMultiplier = speedPct >= GHOST_EATEN_SPEED_PCT ? 2 : 1;

  // Cap the lookup percentage to valid 16-frame table entries (max 100%)
  const lookupPct = speedPct > 100 ? 100 : speedPct;
  const mask = SPEED_MASKS[lookupPct] ?? SPEED_MASKS[100];
  const frameBit = currLevelFrame % 16;

  // Extract basic binary bit step (0 or 1)
  let step = (mask >> (15 - frameBit)) & 1;

  // Cruise Elroy 2 (105% speed on level 5+) adds 1 extra pixel on frame 7 of the 16-frame cycle
  if (speedPct === SPEED_PCT_PER_LEVELS_21_PLUS.elroy2 && frameBit === 7) {
    step += 1;
  }

  // Apply the base speed tier scalar (forces eaten eyes to baseline 2 pixels/frame)
  step *= baseMultiplier;

  // Scale cleanly by turbo settings if active
  if (turboMultiplier > 1.0) {
    step = Math.round(step * turboMultiplier);
  }

  return step;
}
