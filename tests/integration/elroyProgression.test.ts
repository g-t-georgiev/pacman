import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { getElroyDotThresholds, getElroyStage } from "../../src/utils";

describe("Layer 2 Integration Tests: Blinky Cruise Elroy Progression", () => {
  it("should increase Blinky speed tier when dots remaining reach Elroy 1 and Elroy 2 thresholds", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    const blinky = engine.ghosts.BLINKY;
    blinky.location = "ACTIVE";
    blinky.wave = "CHASE";

    const speedAt = (stage: 0 | 1 | 2) => {
      blinky.elroyStage = stage;
      return blinky.getSpeedPercentage(engine.maze, 1);
    };
    const baseSpeedPct = speedAt(0);
    const elroy1SpeedPct = speedAt(1);
    const elroy2SpeedPct = speedAt(2);

    expect(baseSpeedPct).toBe(75);
    expect(elroy1SpeedPct).toBe(80);
    expect(elroy2SpeedPct).toBe(85);
    expect(elroy1SpeedPct).toBeGreaterThan(baseSpeedPct);
    expect(elroy2SpeedPct).toBeGreaterThan(elroy1SpeedPct);
  });

  it("Cruise Elroy Blinky keeps chasing Pac-Man during a scatter wave", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const blinky = engine.ghosts.BLINKY;
    const pinky = engine.ghosts.PINKY;
    blinky.location = "ACTIVE";
    pinky.location = "ACTIVE";
    blinky.wave = "CHASE";
    pinky.wave = "CHASE";

    // Set dots remaining to trigger Cruise Elroy 1
    engine.dotsRemaining = 20; // level 1 Elroy 1 threshold

    // Fast forward to trigger a wave switch from CHASE to SCATTER
    engine.timerController.waveIndex = 1; // CHASE wave
    engine.timerController.waveTimer = 20 * 60 - 5; // 5 frames before the 20 s chase ends

    for (let f = 0; f < 10; f++) {
      engine.update();
    }

    // Both follow the global wave into SCATTER...
    expect(pinky.mode).toBe("SCATTER");
    expect(blinky.mode).toBe("SCATTER");
    // ...but Elroy Blinky keeps targeting Pac-Man instead of his corner (Dossier, Blinky)
    const pac = engine.pacman.tileCoord;
    expect(blinky.target).toEqual({ col: pac.col, row: pac.row });
    expect(pinky.target).toEqual(engine.maze.scatterTargets.PINKY);
  });

  it("uses the Dossier's per-level Elroy thresholds (F11)", () => {
    const rows = [1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 18, 19, 40].map((level) => [
      level,
      getElroyDotThresholds(level).elroy1,
      getElroyDotThresholds(level).elroy2,
    ]);
    expect(rows).toEqual([
      [1, 20, 10],
      [2, 30, 15],
      [3, 40, 20],
      [5, 40, 20],
      [6, 50, 25],
      [8, 50, 25],
      [9, 60, 30],
      [11, 60, 30],
      [12, 80, 40],
      [14, 80, 40],
      [15, 100, 50],
      [18, 100, 50],
      [19, 120, 60],
      [40, 120, 60],
    ]);
    expect(getElroyStage(3, 41, false)).toBe(0);
    expect(getElroyStage(3, 40, false)).toBe(1);
    expect(getElroyStage(3, 20, false)).toBe(2);
    expect(getElroyStage(3, 5, true)).toBe(0);
  });

  it("suspends Elroy after a death until Clyde starts leaving the house (F13)", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 3); // level 3: every dot limit is 0
    engine.playState = "PLAYING";
    engine.dotsRemaining = 15; // deep in Elroy 2 territory
    let blinky = engine.ghosts.BLINKY;

    engine.update();
    expect(blinky.elroyStage).toBe(2);

    // Lose a life: run the death sequence
    engine.playState = "DYING";
    for (let f = 0; f < 400 && engine.playState === "DYING"; f++) engine.update();
    expect(engine.playState).toBe("READY");
    engine.playState = "PLAYING";
    blinky = engine.ghosts.BLINKY; // actors are recreated on respawn

    // Global counter: nobody leaves until 7 dots (or the idle timer), so Clyde stays in
    engine.update();
    expect(engine.ghosts.CLYDE.location).toBe("HOUSE");
    expect(blinky.elroyStage).toBe(0);
    expect(blinky.getSpeedPercentage(engine.maze, 3)).toBe(85); // normal level 3 ghost speed

    // Clyde heads for the door: Elroy is back
    engine.ghosts.CLYDE.location = "HOUSE";
    engine.houseController.state.globalCounterActive = false; // personal limit 0 releases him
    engine.ghosts.PINKY.location = "ACTIVE";
    engine.ghosts.INKY.location = "ACTIVE";
    engine.update();
    expect(engine.ghosts.CLYDE.location).toBe("LEAVING");
    expect(blinky.elroyStage).toBe(2);
  });
});
