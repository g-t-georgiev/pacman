import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";
import { getMazeData } from "../../src/game/mazes";
import { corridorTiles, deriveIntersections } from "../../src/game/debugOverlay";

const key = (t: { col: number; row: number }) => `${t.col},${t.row}`;

describe("Derived intersections (T1 layer, groundwork for A4)", () => {
  it("match the hand-made Pac-Man list exactly", () => {
    const maze = getMazeData("PACMAN", 1);
    const derived = deriveIntersections(maze).map(key).sort();
    expect(derived).toEqual((maze.intersections ?? []).map(key).sort());
  });

  it("corridors are only what Pac-Man can reach (no dead rows, no outside areas)", () => {
    const corridors = corridorTiles(getMazeData("PACMAN", 1));
    expect(corridors.has("13,0")).toBe(false); // blank row above the maze
    expect(corridors.has("1,14")).toBe(false); // outside the walls beside the tunnel
    expect(corridors.has("0,17")).toBe(true); // the tunnel itself
    expect(corridors.has("1,4")).toBe(true);
  });
});

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
