import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";

describe("Frame stepping while paused (T3)", () => {
  function pausedRunner(): GameRunner {
    const engine = new GameEngine("PACMAN", 0);
    engine.playState = "PLAYING";
    engine.paused = true;
    return new GameRunner(engine);
  }

  it("steps exactly the frames asked for, then holds", () => {
    const runner = pausedRunner();
    const e = runner.engine;
    const tick = e.tick;
    expect(runner.stepWhilePaused(1)).toBe(1);
    expect(e.tick).toBe(tick + 1);
    expect(e.paused).toBe(true);
    e.update(); // the real-time loop still sees a paused game
    expect(e.tick).toBe(tick + 1);
  });

  it("does nothing unless paused", () => {
    const runner = pausedRunner();
    runner.engine.paused = false;
    expect(runner.stepWhilePaused(5)).toBe(0);
  });

  it("steps to the next mode change", () => {
    const runner = pausedRunner();
    const e = runner.engine;
    const wave = e.timerController.waveIndex;
    const frames = runner.stepWhilePaused(60 * 60, () => e.timerController.waveIndex !== wave);
    expect(e.timerController.waveIndex).toBe(wave + 1);
    expect(frames).toBe(7 * 60); // level 1: the first scatter lasts 7 s
  });
});
