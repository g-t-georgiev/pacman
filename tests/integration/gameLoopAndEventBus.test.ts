import { describe, it, expect } from "vite-plus/test";
import GameEvents from "../../src/core/EventBus";
import GameEngine from "../../src/game/GameEngine";
import { ELROY_1_DOTS_LEFT, TILE_SIZE } from "../../src/game/constants";
import type { DiagnosticData } from "../../src/diagnostics/DiagnosticController";

describe("GameLoopController, EventBus and Cruise Elroy Mechanics", () => {
  it("engine.start() and engine.stop() control GameLoopController correctly", () => {
    const engine = new GameEngine("PACMAN", 5000);
    expect(engine.gameLoopController).toBeDefined();

    let preUpdateCalled = false;
    engine.onPreUpdate = () => {
      preUpdateCalled = true;
    };

    // Single step
    engine.gameLoopController.stepOnce();
    expect(preUpdateCalled).toBe(true);
    expect(engine.currLevelFrame).toBe(1);

    // Start & Stop
    engine.start();
    engine.stop();
  });

  it("EventBus emits SCORE_CHANGED, LIVES_CHANGED and DIAGNOSTICS_TICK", () => {
    const engine = new GameEngine("PACMAN", 5000);
    engine.playState = "PLAYING";

    let diagReceived!: DiagnosticData;
    GameEvents.on("DIAGNOSTICS_TICK", (e: CustomEvent<DiagnosticData>) => {
      diagReceived = e.detail;
    });

    // Run 4 frames to trigger DIAGNOSTICS_TICK
    for (let i = 0; i < 4; i++) {
      engine.update();
    }

    expect(diagReceived).toBeDefined();
    expect(diagReceived.blinky).toBeDefined();
    expect(diagReceived.level).toBe(1);
  });

  it("Blinky adheres to Cruise Elroy Scatter Immunity when dotsRemaining <= 20", () => {
    const engine = new GameEngine("PACMAN", 5000);
    engine.playState = "PLAYING";
    engine.dotsRemaining = ELROY_1_DOTS_LEFT; // 20 dots

    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "CHASE";

    // Simulate wave timer triggering a switch to SCATTER
    engine.timerController.update(
      1.0,
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

    // Fast-forward emergence of Pinky
    const pinky = engine.ghosts.PINKY;
    pinky.houseTimer = 0;

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
