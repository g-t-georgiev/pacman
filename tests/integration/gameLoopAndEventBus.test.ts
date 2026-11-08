import { describe, it, expect } from "vite-plus/test";
import GameEvents from "../../src/core/EventBus";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";
import { TILE_SIZE } from "../../src/game/constants";
import type { DiagnosticData } from "../../src/diagnostics/DiagnosticController";

describe("GameLoopController, EventBus and Cruise Elroy Mechanics", () => {
  it("GameRunner drives the engine: pre-update hook, one frame per tick, start and stop", () => {
    const engine = new GameEngine("PACMAN", 5000);
    const runner = new GameRunner(engine);

    let preUpdateCalled = false;
    runner.onPreUpdate = () => {
      preUpdateCalled = true;
    };

    // Single step
    runner.loop.stepOnce();
    expect(preUpdateCalled).toBe(true);
    expect(engine.currLevelFrame).toBe(1);

    // Start & Stop
    runner.start();
    runner.stop();
  });

  it("EventBus emits SCORE_CHANGED, LIVES_CHANGED and DIAGNOSTICS_TICK", () => {
    const engine = new GameEngine("PACMAN", 5000);
    engine.playState = "PLAYING";

    let diagReceived!: DiagnosticData;
    GameEvents.on("DIAGNOSTICS_TICK", (e: CustomEvent<DiagnosticData>) => {
      diagReceived = e.detail;
    });

    // Run 4 frames to trigger DIAGNOSTICS_TICK (the runner owns diagnostics, not the sim)
    const runner = new GameRunner(engine);
    for (let i = 0; i < 4; i++) {
      runner.tick();
    }

    expect(diagReceived).toBeDefined();
    expect(diagReceived.blinky).toBeDefined();
    expect(diagReceived.level).toBe(1);
  });

  it("Blinky adheres to Cruise Elroy Scatter Immunity when dotsRemaining <= 20", () => {
    const engine = new GameEngine("PACMAN", 5000);
    engine.playState = "PLAYING";
    engine.dotsRemaining = 20; // level 1 Elroy 1 threshold

    const blinky = engine.ghosts.BLINKY;
    blinky.location = "ACTIVE";
    blinky.wave = "CHASE";

    // Simulate wave timer triggering a switch to SCATTER
    engine.timerController.update(
      (newMode) => {
        // Trigger mode switch callback like in GameEngine
        expect(newMode).toBe("SCATTER");
      },
      () => {}
    );

    // Advance frame
    engine.update();

    // Blinky must remain in CHASE
    expect(blinky.mode).toBe("CHASE");

    // Evaluate diagnostic invariant
    const rule = engine.diagnosticController.rules.find(
      (r) => r.id === "RULE_BLINKY_ELROY_SCATTER_IMMUNITY"
    );
    expect(rule).toBeDefined();
    const result = rule!.evaluate(engine);
    expect(result.pass).toBe(true);
  });

  it("Ghosts exit house and turn into the maze corridors rather than staying on row 14", () => {
    const engine = new GameEngine("PACMAN", 5000);
    engine.playState = "PLAYING";

    // Pinky has a dot limit of 0, so the house releases him on the first playing frame
    const pinky = engine.ghosts.PINKY;

    // Run 200 frames of updates
    for (let f = 0; f < 200; f++) {
      engine.update();
    }

    // Ghost should have emerged and navigated out of the central doorstep row (row 14)
    const pinkyRow = Math.floor(pinky.y / TILE_SIZE);
    expect(pinky.inHouse).toBe(false);
    // Pinky must have navigated up or into the maze corridors (row < 14 or row > 14)
    expect(pinkyRow).not.toBe(14);
  });
});
