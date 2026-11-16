import { FRUIT_CATALOG, type FruitInfo, SIM_FPS } from "../game/constants";
import { levelRow } from "../game/levelTable";
import type { ElroyStage, LevelSpeedConfig, ScatterChaseSchedule } from "../types";
import { SPEED_MASKS, arcadeStepsOnFrame } from "../game/speedMasks";

/** Dots remaining at which Blinky becomes Elroy 1 and Elroy 2 on a level (Dossier, Table A.1). */
export function getElroyDotThresholds(level: number): { elroy1: number; elroy2: number } {
  const elroy1 = levelRow(level).elroy1Dots;
  return { elroy1, elroy2: elroy1 / 2 };
}

/**
 * Blinky's Cruise Elroy stage. After a life is lost, Elroy is suspended (stage 0) until Clyde
 * starts leaving the house (Dossier, Blinky).
 */
export function getElroyStage(
  level: number,
  dotsRemaining: number,
  suspended: boolean
): ElroyStage {
  if (suspended) return 0;
  const { elroy1, elroy2 } = getElroyDotThresholds(level);
  if (dotsRemaining <= elroy2) return 2;
  if (dotsRemaining <= elroy1) return 1;
  return 0;
}

/** The bonus fruit a level shows (LEVEL_TABLE), with its points and art. */
export function getFruitDataPerLevel(level: number): FruitInfo {
  return FRUIT_CATALOG[levelRow(level).fruit];
}

/** Frightened duration for a level, in frames (0: an energizer only reverses the ghosts). */
export function getFrightenedDuration(level: number): number {
  return levelRow(level).frightSeconds * SIM_FPS;
}

/**
 * Retrieves the exact number of warning flashes a ghost performs at the end of the frightened phase.
 * Automatically defaults to 0 for Level 20+ to match the 0-second duration behavior.
 *
 * @param level The current level number (1-indexed).
 * @returns The number of warning flashes before a ghost's frightened phase ends.
 */
export function getFrightenedFlashCount(level: number): number {
  return levelRow(level).flashes;
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
  return levelRow(level).schedule;
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
  return levelRow(level).speeds;
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
