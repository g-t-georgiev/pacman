import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { ELROY_1_DOTS_LEFT, ELROY_2_DOTS_LEFT } from "../../src/game/constants";

describe("Layer 2 Integration Tests: Blinky Cruise Elroy Progression", () => {
  it("should increase Blinky speed tier when dots remaining reach Elroy 1 and Elroy 2 thresholds", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "CHASE";

    // Standard speed: 200 dots left
    const baseSpeedPct = blinky.getSpeedPercentage(engine.maze, 200, 1);
    // Elroy 1: 20 dots left
    const elroy1SpeedPct = blinky.getSpeedPercentage(engine.maze, ELROY_1_DOTS_LEFT, 1);
    // Elroy 2: 10 dots left
    const elroy2SpeedPct = blinky.getSpeedPercentage(engine.maze, ELROY_2_DOTS_LEFT, 1);

    expect(baseSpeedPct).toBe(75);
    expect(elroy1SpeedPct).toBe(80);
    expect(elroy2SpeedPct).toBe(85);
    expect(elroy1SpeedPct).toBeGreaterThan(baseSpeedPct);
    expect(elroy2SpeedPct).toBeGreaterThan(elroy1SpeedPct);
  });

  it("should make Cruise Elroy Blinky ignore scatter wave transitions and stay in CHASE", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const blinky = engine.ghosts.BLINKY;
    const pinky = engine.ghosts.PINKY;
    blinky.inHouse = false;
    pinky.inHouse = false;
    blinky.mode = "CHASE";
    pinky.mode = "CHASE";

    // Set dots remaining to trigger Cruise Elroy 1
    engine.dotsRemaining = ELROY_1_DOTS_LEFT;

    // Fast forward to trigger a wave switch from CHASE to SCATTER
    engine.timerController.waveIndex = 1; // CHASE wave
    engine.timerController.waveTimer = 19.99; // Almost 20s

    for (let f = 0; f < 10; f++) {
      engine.update();
    }

    // Pinky switches to SCATTER
    expect(pinky.mode).toBe("SCATTER");
    // Cruise Elroy Blinky ignores SCATTER and stays in CHASE!
    expect(blinky.mode).toBe("CHASE");
  });
});
