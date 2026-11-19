import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { ENERGIZER_BLINK_FRAMES } from "../../src/game/constants";
import { playing } from "../helpers";

/** The energizers' look, as on footage of the original (docs/footage/2026-11-19.md). */
describe("Energizer blink", () => {
  it("stays on through PLAYER ONE and READY", () => {
    const e = new GameEngine("PACMAN", 0);
    expect(e.phase).toBe("PLAYER_ONE");
    while (e.playState === "READY") {
      expect(e.energizersShown).toBe(true);
      e.update();
    }
    expect(e.phase).toBe("PLAYING");
  });

  it("blinks in play: on and off for the same number of frames, on game frames", () => {
    const e = playing().engine;
    const seen: boolean[] = [];
    for (let i = 0; i < 4 * ENERGIZER_BLINK_FRAMES; i++) {
      seen.push(e.energizersShown);
      e.update();
    }
    const runs: number[] = [];
    let run = 1;
    for (let i = 1; i < seen.length; i++) {
      if (seen[i] === seen[i - 1]) run++;
      else {
        runs.push(run);
        run = 1;
      }
    }
    // Whole runs between two changes are exactly the blink length
    expect(runs.slice(1).length).toBeGreaterThan(1);
    for (const r of runs.slice(1)) expect(r).toBe(ENERGIZER_BLINK_FRAMES);

    // Paused, the frame doesn't advance, so the energizers hold still
    e.paused = true;
    const held = e.energizersShown;
    for (let i = 0; i < 2 * ENERGIZER_BLINK_FRAMES; i++) {
      e.update();
      expect(e.energizersShown).toBe(held);
    }
  });

  it("keeps blinking through a death", () => {
    const e = playing().engine;
    const blinky = e.ghosts.BLINKY;
    blinky.location = "ACTIVE";
    blinky.x = e.pacman.x;
    blinky.y = e.pacman.y;
    e.update();
    expect(e.phase).toBe("DEATH_FREEZE");
    const seen = new Set<boolean>();
    for (let i = 0; i < 2 * ENERGIZER_BLINK_FRAMES; i++) {
      seen.add(e.energizersShown);
      e.update();
    }
    expect([...seen].sort()).toEqual([false, true]);
  });
});
