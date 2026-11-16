import type { LevelSpeedConfig, ScatterChaseSchedule } from "../types";
import {
  type FruitName,
  SCATTER_CHASE_LEVEL_1,
  SCATTER_CHASE_LEVELS_2_TO_4,
  SCATTER_CHASE_LEVELS_5_PLUS,
} from "./constants";

/** Everything that varies by level (plan A3): one row of the Dossier's Table A.1, and more. */
export interface LevelRow {
  level: number;
  fruit: FruitName;
  /** Speed percentages (100% = 1.25 px/frame). */
  speeds: LevelSpeedConfig;
  /** Dots left when Blinky becomes Elroy 1 (Elroy 2 at half). */
  elroy1Dots: number;
  /** Frightened time in seconds (0: an energizer only reverses the ghosts). */
  frightSeconds: number;
  /** White flashes before frightened ends. */
  flashes: number;
  /** Personal dot limits in the ghost house (Dossier "Home Sweet Home"). */
  houseDotLimits: { PINKY: number; INKY: number; CLYDE: number };
  /** Seconds without a dot before the preferred ghost is forced out. */
  houseIdleSeconds: number;
  schedule: readonly ScatterChaseSchedule[];
}

const L1 = SCATTER_CHASE_LEVEL_1;
const L2 = SCATTER_CHASE_LEVELS_2_TO_4;
const L5 = SCATTER_CHASE_LEVELS_5_PLUS;

/**
 * One row: level, fruit, then Table A.1's speeds (Pac-Man, Pac-Man frightened, ghost, ghost
 * tunnel, ghost frightened, Elroy 1, Elroy 2), Elroy 1 dots, frightened seconds, flashes, then
 * house dot limits (Pinky, Inky, Clyde), idle seconds and the scatter/chase schedule.
 */
function row(
  level: number,
  fruit: FruitName,
  [pacmanNormal, pacmanFright, ghostNormal, ghostTunnel, ghostFrightened, elroy1, elroy2]: number[],
  elroy1Dots: number,
  frightSeconds: number,
  flashes: number,
  [PINKY, INKY, CLYDE]: number[],
  houseIdleSeconds: number,
  schedule: readonly ScatterChaseSchedule[]
): LevelRow {
  return {
    level,
    fruit,
    speeds: {
      pacmanNormal,
      pacmanFright,
      ghostNormal,
      ghostTunnel,
      ghostFrightened,
      elroy1,
      elroy2,
    },
    elroy1Dots,
    frightSeconds,
    flashes,
    houseDotLimits: { PINKY, INKY, CLYDE },
    houseIdleSeconds,
    schedule,
  };
}

const S1 = [80, 90, 75, 40, 50, 80, 85];
const S2 = [90, 95, 85, 45, 55, 90, 95];
const S5 = [100, 100, 95, 50, 60, 100, 105];
const S21 = [90, 100, 95, 50, 60, 100, 105];

/**
 * Levels 1-21 (level 21 applies to every level after it). The single source of every per-level
 * value; `levelRow()` reads it and `levelTable.test.ts` checks it against Table A.1.
 */
// prettier-ignore
export const LEVEL_TABLE: readonly LevelRow[] = [
  //  lvl  fruit         speeds  elroy  fright flash  house dots    idle  schedule
  row(1,  "Cherry",     S1,     20,    6,     5,     [0, 30, 60],  4,    L1),
  row(2,  "Strawberry", S2,     30,    5,     5,     [0, 0, 50],   4,    L2),
  row(3,  "Peach",      S2,     40,    4,     5,     [0, 0, 0],    4,    L2),
  row(4,  "Peach",      S2,     40,    3,     5,     [0, 0, 0],    4,    L2),
  row(5,  "Apple",      S5,     40,    2,     5,     [0, 0, 0],    3,    L5),
  row(6,  "Apple",      S5,     50,    5,     5,     [0, 0, 0],    3,    L5),
  row(7,  "Melon",      S5,     50,    2,     5,     [0, 0, 0],    3,    L5),
  row(8,  "Melon",      S5,     50,    2,     5,     [0, 0, 0],    3,    L5),
  row(9,  "Galaxian",   S5,     60,    1,     3,     [0, 0, 0],    3,    L5),
  row(10, "Galaxian",   S5,     60,    5,     5,     [0, 0, 0],    3,    L5),
  row(11, "Bell",       S5,     60,    2,     5,     [0, 0, 0],    3,    L5),
  row(12, "Bell",       S5,     80,    1,     3,     [0, 0, 0],    3,    L5),
  row(13, "Key",        S5,     80,    1,     3,     [0, 0, 0],    3,    L5),
  row(14, "Key",        S5,     80,    3,     5,     [0, 0, 0],    3,    L5),
  row(15, "Key",        S5,     100,   1,     3,     [0, 0, 0],    3,    L5),
  row(16, "Key",        S5,     100,   1,     3,     [0, 0, 0],    3,    L5),
  row(17, "Key",        S5,     100,   0,     0,     [0, 0, 0],    3,    L5),
  row(18, "Key",        S5,     100,   1,     3,     [0, 0, 0],    3,    L5),
  row(19, "Key",        S5,     120,   0,     0,     [0, 0, 0],    3,    L5),
  row(20, "Key",        S5,     120,   0,     0,     [0, 0, 0],    3,    L5),
  row(21, "Key",        S21,    120,   0,     0,     [0, 0, 0],    3,    L5),
];

/** The row for a level (levels past 21 use row 21; anything below 1 uses row 1). */
export function levelRow(level: number): LevelRow {
  const i = Math.min(Math.max(Math.floor(level), 1), LEVEL_TABLE.length) - 1;
  return LEVEL_TABLE[i];
}
