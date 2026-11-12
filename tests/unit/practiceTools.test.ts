import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";
import { AgentDriver } from "../../src/agent/AgentDriver";

/** An in-memory localStorage for these tests (restored afterwards). */
const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
beforeAll(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});
afterAll(() => {
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

function live(level = 2) {
  const engine = new GameEngine("PACMAN", 0);
  const runner = new GameRunner(engine);
  const agent = new AgentDriver(engine, runner);
  agent.scenario({ level, playState: "PLAYING" });
  return { engine, runner, agent };
}

describe("Practice tools (Phase 5)", () => {
  it("saves this life's route as the level's pattern, one point per level frame", () => {
    const { engine, runner } = live(2);
    for (let i = 0; i < 90; i++) runner.tick();
    const frame = engine.currLevelFrame;
    const at = { x: engine.pacman.x, y: engine.pacman.y };
    expect(runner.practice.savePattern(engine)).toBe(frame + 1);
    const route = runner.practice.pattern(engine)!;
    expect([route[frame * 2], route[frame * 2 + 1]]).toEqual([at.x, at.y]);
    // Another level has no pattern
    const other = live(3);
    expect(other.runner.practice.pattern(other.engine)).toBeNull();
    runner.practice.clearPattern(engine);
    expect(runner.practice.pattern(engine)).toBeNull();
  });

  it("a rewind forgets the frames that no longer happened", () => {
    const { engine, runner } = live(4);
    for (let i = 0; i < 180; i++) runner.tick();
    engine.rewindSeconds(1);
    engine.resumeFromScrub();
    runner.tick();
    expect(runner.practice.savePattern(engine)).toBe(engine.currLevelFrame + 1);
  });

  it("records only the first death on a level in the heatmap", () => {
    const { engine, runner, agent } = live(5);
    runner.practice.clearDeaths(engine);
    const die = () => {
      const b = agent.view().ghosts.BLINKY;
      agent.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } });
      for (let i = 0; i < 400 && engine.phase !== "READY"; i++) runner.tick();
      for (let i = 0; i < 400 && engine.phase === "READY"; i++) runner.tick();
    };
    die();
    die();
    expect(runner.practice.deathsHere(engine)).toHaveLength(1);
    engine.restartLevel(); // a fresh attempt: its first death counts again
    runner.flush();
    for (let i = 0; i < 300 && engine.phase === "READY"; i++) runner.tick();
    die();
    expect(runner.practice.deathsHere(engine)).toHaveLength(2);
  });
});
