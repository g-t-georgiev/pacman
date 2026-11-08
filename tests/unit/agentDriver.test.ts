import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";

function driver(level = 1): AgentDriver {
  const agent = new AgentDriver(new GameEngine("PACMAN", 0));
  agent.scenario({ level, playState: "PLAYING" });
  agent.events(); // drop the level-start events
  return agent;
}

describe("AgentDriver (headless)", () => {
  it("steps exact frames and reports the view", () => {
    const agent = driver();
    const { frames, view } = agent.step(10);
    expect(frames).toBe(10);
    expect(view.frame).toBe(10);
    expect(view.playState).toBe("PLAYING");
  });

  it("runs until a condition holds, with the frame count", () => {
    const agent = driver();
    const result = agent.runUntil((v) => v.ghosts.PINKY.location === "ACTIVE", 300);
    expect(result.reached).toBe(true);
    expect(result.view.ghosts.PINKY.dir).toBe("LEFT");
    expect(result.frames).toBeGreaterThan(0);
  });

  it("records sim events between calls", () => {
    const agent = driver();
    agent.scenario({ pacman: { col: 1, row: 8, dir: "RIGHT" } });
    agent.engine.maze.tiles[8][2] = "DOT";
    const { events } = agent.runUntil((v) => v.pacman.col === 2, 20);
    expect(events.map((e) => e.type)).toContain("DOT_EATEN");
    expect(agent.events()).toEqual([]);
  });

  it("places actors and ghosts with a scenario", () => {
    const agent = driver();
    const view = agent.scenario({
      dotsRemaining: 15,
      pacman: { col: 6, row: 8, dir: "UP" },
      ghosts: { INKY: { col: 21, row: 8, dir: "LEFT" } },
    });
    expect(view.pacman).toMatchObject({ col: 6, row: 8, dir: "UP" });
    expect(view.ghosts.INKY).toMatchObject({ col: 21, row: 8, location: "ACTIVE" });
    expect(view.dotsRemaining).toBe(15);
  });

  it("dotsRemaining removes dots from the maze so the board matches the count", () => {
    const agent = driver();
    agent.scenario({ dotsRemaining: 3 });
    const left = agent.engine.maze.tiles.flat().filter((t) => t === "DOT" || t === "ENERGIZER");
    expect(left).toEqual(["ENERGIZER", "ENERGIZER", "ENERGIZER"]);
    expect(() => agent.scenario({ dotsRemaining: 10 })).toThrow();
  });

  it("save/load rewinds exactly, and the hash proves it", () => {
    const agent = driver();
    agent.step(50);
    const saved = agent.save();
    const hashAtSave = agent.hash();
    const later = agent.trace(100, (v) => v.pacman.x);
    agent.load(saved);
    expect(agent.hash()).toBe(hashAtSave);
    expect(agent.trace(100, (v) => v.pacman.x)).toEqual(later);
  });

  it("collects failing diagnostics", () => {
    const agent = driver();
    agent.step(120);
    expect(agent.diagnostics().failing).toEqual([]);
  });
});
