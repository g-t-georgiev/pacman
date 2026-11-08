import { describe, expect, it } from "vite-plus/test";
import { TimerController } from "../../src/controllers/TimerController";
import type { GhostBehavior } from "../../src/types";
import { getFrightenedDuration } from "../../src/utils";

describe("TimerController & Scatter/Chase Schedule (integer frames)", () => {
  it("switches from the first scatter to chase after exactly 420 frames (7 s) on level 1", () => {
    const timer = new TimerController(1);
    expect(timer.waveIndex).toBe(0);
    expect(timer.currentWave?.mode).toBe("SCATTER");
    expect(timer.currentWave?.frames).toBe(420);

    let triggeredMode: GhostBehavior | "" = "";
    const onWaveChange = (newMode: GhostBehavior) => {
      triggeredMode = newMode;
    };

    for (let f = 0; f < 419; f++) timer.update(onWaveChange);
    expect(timer.waveIndex).toBe(0);

    timer.update(onWaveChange);
    expect(timer.waveIndex).toBe(1);
    expect(timer.currentWave?.mode).toBe("CHASE");
    expect(triggeredMode).toBe("CHASE");
  });

  it("pauses the wave timer while frightened mode is active", () => {
    const timer = new TimerController(1);
    timer.waveTimer = 210;
    timer.triggerFrightened(getFrightenedDuration(1));

    expect(timer.isFrightened).toBe(true);
    expect(timer.frightenedGlobalTimer).toBe(360); // 6 s on level 1

    for (let f = 0; f < 60; f++) timer.update();

    expect(timer.frightenedGlobalTimer).toBe(300);
    expect(timer.waveTimer).toBe(210);
  });

  it("calls onFrightenedEnd exactly once, on the frame the timer reaches zero", () => {
    const timer = new TimerController(1);
    timer.triggerFrightened(3);
    let ended = 0;
    for (let f = 0; f < 10; f++) timer.update(undefined, () => ended++);
    expect(ended).toBe(1);
    expect(timer.frightenedGlobalTimer).toBe(0);
  });

  it("resets wave timer and wave index on life loss or level clear", () => {
    const timer = new TimerController(1);
    timer.waveIndex = 4;
    timer.waveTimer = 720;
    timer.frightenedGlobalTimer = 180;

    timer.resetTimers();

    expect(timer.waveIndex).toBe(0);
    expect(timer.waveTimer).toBe(0);
    expect(timer.frightenedGlobalTimer).toBe(0);
  });
});
