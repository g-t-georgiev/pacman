import { describe, expect, it } from "vite-plus/test";
import { TimerController } from "../../src/controllers/TimerController";

describe("Layer 1 Unit Tests: TimerController & Scatter/Chase Schedule", () => {
  it("should initialize at wave 0 and advance through the level 1 scatter/chase schedule", () => {
    const timer = new TimerController(1);
    expect(timer.waveIndex).toBe(0);
    expect(timer.currentWave?.mode).toBe("SCATTER");
    expect(timer.currentWave?.duration).toBe(7);

    // Advance 7 seconds (7 * 60 = 420 frames at 60 FPS)
    let triggeredMode = "";
    for (let f = 0; f < 420; f++) {
      timer.update(1.0, (newMode) => {
        triggeredMode = newMode;
      });
    }

    // Should transition to Wave 1: CHASE (20s)
    expect(timer.waveIndex).toBe(1);
    expect(timer.currentWave?.mode).toBe("CHASE");
    expect(triggeredMode).toBe("CHASE");
  });

  it("should pause scatter/chase wave timer while frightened mode is active", () => {
    const timer = new TimerController(1);
    timer.waveTimer = 3.5;
    timer.triggerFrightened(6); // 6 seconds frightened mode

    expect(timer.isFrightened).toBe(true);

    // Advance 60 frames (1 second)
    for (let f = 0; f < 60; f++) {
      timer.update(1.0);
    }

    // Frightened timer decreased by 1 second (from 6 to 5)
    expect(timer.frightenedGlobalTimer).toBeCloseTo(5.0, 1);
    // Wave timer was PAUSED and stayed exactly 3.5!
    expect(timer.waveTimer).toBe(3.5);
  });

  it("should reset wave timer and wave index back to beginning on life loss or level clear", () => {
    const timer = new TimerController(1);
    timer.waveIndex = 4;
    timer.waveTimer = 12;
    timer.frightenedGlobalTimer = 3;

    timer.resetTimers();

    expect(timer.waveIndex).toBe(0);
    expect(timer.waveTimer).toBe(0);
    expect(timer.frightenedGlobalTimer).toBe(0);
  });
});
