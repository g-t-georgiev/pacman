import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";

/** Feeds `seconds` of real time to the runner's loop in 10 ms slices; returns the ticks run. */
function ticksIn(runner: GameRunner, seconds: number): number {
  let ticks = 0;
  for (let ms = 0; ms < seconds * 1000; ms += 10) ticks += runner.loop.advance(10);
  return ticks;
}

describe("Real-time loop rate (F5)", () => {
  it("runs at the arcade's 60.606 Hz by default", () => {
    const runner = new GameRunner(new GameEngine("PACMAN", 0));
    expect(runner.ticksPerSecond).toBeCloseTo(60.606, 3);
    expect(ticksIn(runner, 10)).toBe(606);
  });

  it("runs at a plain 60 Hz with the setting off, scaled by the practice speed", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.settings.arcadeRefreshRate = false;
    const runner = new GameRunner(engine);
    expect(ticksIn(runner, 10)).toBe(600);
    engine.settings.gameSpeed = 0.5;
    expect(ticksIn(runner, 10)).toBe(300);
  });
});
