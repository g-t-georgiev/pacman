import { describe, expect, it } from "vite-plus/test";
import { LEVEL_TABLE, levelRow } from "../../src/game/levelTable";
import {
  FRUIT_CATALOG,
  SCATTER_CHASE_LEVEL_1,
  SCATTER_CHASE_LEVELS_2_TO_4,
  SCATTER_CHASE_LEVELS_5_PLUS,
} from "../../src/game/constants";

/**
 * The Dossier's Table A.1, typed in independently of LEVEL_TABLE (plan A3), one row per level:
 * bonus points, Pac-Man %, ghost %, ghost tunnel %, Elroy 1 dots, Elroy 1 %, Elroy 2 dots,
 * Elroy 2 %, frightened Pac-Man %, frightened ghost %, frightened seconds, flashes.
 * Level 21 stands for 21 and beyond. Frightened speeds on levels with no frightened time are
 * unused, so the table gives "-" there; they are null here.
 */
// prettier-ignore
const TABLE_A1: Array<[number, number, number, number, number, number, number, number, number, number | null, number | null, number, number]> = [
  // lvl pts   pac ghost tun e1dots e1%  e2dots e2%  frPac frGhost frSec flashes
  [1,  100,  80, 75, 40,  20,  80,  10,  85,  90,  50,  6, 5],
  [2,  300,  90, 85, 45,  30,  90,  15,  95,  95,  55,  5, 5],
  [3,  500,  90, 85, 45,  40,  90,  20,  95,  95,  55,  4, 5],
  [4,  500,  90, 85, 45,  40,  90,  20,  95,  95,  55,  3, 5],
  [5,  700,  100, 95, 50, 40,  100, 20,  105, 100, 60,  2, 5],
  [6,  700,  100, 95, 50, 50,  100, 25,  105, 100, 60,  5, 5],
  [7,  1000, 100, 95, 50, 50,  100, 25,  105, 100, 60,  2, 5],
  [8,  1000, 100, 95, 50, 50,  100, 25,  105, 100, 60,  2, 5],
  [9,  2000, 100, 95, 50, 60,  100, 30,  105, 100, 60,  1, 3],
  [10, 2000, 100, 95, 50, 60,  100, 30,  105, 100, 60,  5, 5],
  [11, 3000, 100, 95, 50, 60,  100, 30,  105, 100, 60,  2, 5],
  [12, 3000, 100, 95, 50, 80,  100, 40,  105, 100, 60,  1, 3],
  [13, 5000, 100, 95, 50, 80,  100, 40,  105, 100, 60,  1, 3],
  [14, 5000, 100, 95, 50, 80,  100, 40,  105, 100, 60,  3, 5],
  [15, 5000, 100, 95, 50, 100, 100, 50,  105, 100, 60,  1, 3],
  [16, 5000, 100, 95, 50, 100, 100, 50,  105, 100, 60,  1, 3],
  [17, 5000, 100, 95, 50, 100, 100, 50,  105, null, null, 0, 0],
  [18, 5000, 100, 95, 50, 100, 100, 50,  105, 100, 60,  1, 3],
  [19, 5000, 100, 95, 50, 120, 100, 60,  105, null, null, 0, 0],
  [20, 5000, 100, 95, 50, 120, 100, 60,  105, null, null, 0, 0],
  [21, 5000, 90,  95, 50, 120, 100, 60,  105, null, null, 0, 0],
];

describe("LEVEL_TABLE matches the Dossier's Table A.1 (A3)", () => {
  it.each(TABLE_A1)(
    "level %i",
    (level, pts, pac, ghost, tunnel, e1dots, e1, e2dots, e2, frPac, frGhost, frSec, flashes) => {
      const row = levelRow(level);
      expect(row.level).toBe(level);
      expect(FRUIT_CATALOG[row.fruit].points).toBe(pts);
      expect(row.speeds).toMatchObject({
        pacmanNormal: pac,
        ghostNormal: ghost,
        ghostTunnel: tunnel,
        elroy1: e1,
        elroy2: e2,
      });
      expect(row.elroy1Dots).toBe(e1dots);
      expect(row.elroy1Dots / 2).toBe(e2dots);
      if (frPac !== null) expect(row.speeds.pacmanFright).toBe(frPac);
      if (frGhost !== null) expect(row.speeds.ghostFrightened).toBe(frGhost);
      expect(row.frightSeconds).toBe(frSec);
      expect(row.flashes).toBe(flashes);
    }
  );

  it("levels past 21 use row 21", () => {
    expect(levelRow(22)).toBe(LEVEL_TABLE[20]);
    expect(levelRow(255)).toBe(LEVEL_TABLE[20]);
  });
});

describe("LEVEL_TABLE: the house and the schedule (Dossier, Home Sweet Home; Scatter, Chase)", () => {
  it("personal dot limits: L1 0/30/60, L2 0/0/50, then 0/0/0", () => {
    expect(levelRow(1).houseDotLimits).toEqual({ PINKY: 0, INKY: 30, CLYDE: 60 });
    expect(levelRow(2).houseDotLimits).toEqual({ PINKY: 0, INKY: 0, CLYDE: 50 });
    for (let level = 3; level <= 21; level++) {
      expect(levelRow(level).houseDotLimits).toEqual({ PINKY: 0, INKY: 0, CLYDE: 0 });
    }
  });

  it("idle timer: 4 s up to level 4, 3 s from level 5", () => {
    for (let level = 1; level <= 21; level++) {
      expect(levelRow(level).houseIdleSeconds).toBe(level < 5 ? 4 : 3);
    }
  });

  it("scatter/chase schedule: level 1, levels 2-4, levels 5+", () => {
    for (let level = 1; level <= 21; level++) {
      const expected =
        level === 1
          ? SCATTER_CHASE_LEVEL_1
          : level <= 4
            ? SCATTER_CHASE_LEVELS_2_TO_4
            : SCATTER_CHASE_LEVELS_5_PLUS;
      expect(levelRow(level).schedule).toBe(expected);
    }
  });
});
