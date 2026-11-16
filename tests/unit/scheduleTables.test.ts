import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_SCATTER_TARGETS, SIM_FPS } from "../../src/game/constants";
import { getScatterChaseSchedule } from "../../src/utils";

/** A schedule as [mode, seconds] pairs; 1/60 s and "indefinite" kept readable. */
function seconds(level: number): Array<[string, number | string]> {
  return getScatterChaseSchedule(level).map(({ mode, frames }) => [
    mode,
    frames === Infinity ? "indefinite" : frames === 1 ? "1/60" : frames / SIM_FPS,
  ]);
}

describe("Scatter/chase tables (Dossier, Scatter/Chase; F10)", () => {
  it("level 1", () => {
    expect(seconds(1)).toEqual([
      ["SCATTER", 7],
      ["CHASE", 20],
      ["SCATTER", 7],
      ["CHASE", 20],
      ["SCATTER", 5],
      ["CHASE", 20],
      ["SCATTER", 5],
      ["CHASE", "indefinite"],
    ]);
  });

  it.each([2, 3, 4])("level %i", (level) => {
    expect(seconds(level)).toEqual([
      ["SCATTER", 7],
      ["CHASE", 20],
      ["SCATTER", 7],
      ["CHASE", 20],
      ["SCATTER", 5],
      ["CHASE", 1033],
      ["SCATTER", "1/60"],
      ["CHASE", "indefinite"],
    ]);
  });

  it.each([5, 12, 21])("level %i: the third scatter is still 5 s", (level) => {
    expect(seconds(level)).toEqual([
      ["SCATTER", 5],
      ["CHASE", 20],
      ["SCATTER", 5],
      ["CHASE", 20],
      ["SCATTER", 5],
      ["CHASE", 1037],
      ["SCATTER", "1/60"],
      ["CHASE", "indefinite"],
    ]);
  });
});

describe("Scatter targets (Dossier, Fixed Target Tiles; F23)", () => {
  it("sit in the dead space above and below the maze, in the outermost rows", () => {
    expect(DEFAULT_SCATTER_TARGETS.PACMAN).toEqual({
      BLINKY: { col: 25, row: 0 },
      PINKY: { col: 2, row: 0 },
      INKY: { col: 27, row: 35 },
      CLYDE: { col: 0, row: 35 },
    });
  });
});
