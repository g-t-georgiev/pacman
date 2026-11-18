import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { live } from "../helpers";
import { faceBlinky } from "../helpers";

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

describe("Practice tools (Phase 5)", () => {
  it("saves this life's route as the level's pattern, one point per level frame", () => {
    const { engine, runner } = live(2);
    for (let i = 0; i < 90; i++) runner.tick();
    const frame = engine.lifeFrame;
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
    engine.timeline.rewindSeconds(1);
    engine.timeline.resume();
    runner.tick();
    expect(runner.practice.savePattern(engine)).toBe(engine.lifeFrame + 1);
  });

  it("records only the first death on a level in the heatmap", () => {
    const { engine, runner, agent } = live(5);
    runner.practice.clearDeaths(engine);
    const die = () => {
      faceBlinky(agent);
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
