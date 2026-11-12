import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";

describe("Pac-Man's mouth (sprite frames)", () => {
  it("is a closed circle through READY and until he first moves", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    const e = agent.engine;
    expect(e.phase).toBe("READY");
    const frames = new Set<number>();
    while (e.phase === "READY") {
      frames.add(e.pacman.mouthFrame);
      e.update();
    }
    expect([...frames]).toEqual([0]);
    expect(e.pacman.hasMoved).toBe(false);
    const { x } = e.pacman;
    agent.runUntil(() => e.pacman.x !== x, 10);
    expect(e.pacman.hasMoved).toBe(true);
  });

  it("chomps closed, half, open, half while he moves", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    agent.scenario({ playState: "PLAYING", pacman: { col: 21, row: 26, dir: "LEFT" } });
    const e = agent.engine;
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      e.update();
      if (seen[seen.length - 1] !== e.pacman.mouthFrame) seen.push(e.pacman.mouthFrame);
    }
    const cycle = seen.slice(seen.indexOf(0), seen.indexOf(0) + 5);
    expect(cycle).toEqual([0, 1, 2, 1, 0]);
  });

  it("holds a half-open mouth while blocked by a wall", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    agent.scenario({ playState: "PLAYING", pacman: { col: 1, row: 26, dir: "UP" } });
    const e = agent.engine;
    // Up from the bottom-left corner: the wall at the top of the corridor stops him at a tile center
    let last = { x: NaN, y: NaN };
    let still = 0;
    const frames = new Set<number>();
    for (let i = 0; i < 300 && still < 30; i++) {
      e.update();
      const stopped = e.pacman.x === last.x && e.pacman.y === last.y;
      still = stopped ? still + 1 : 0;
      if (!stopped) frames.clear();
      else frames.add(e.pacman.mouthFrame);
      last = { x: e.pacman.x, y: e.pacman.y };
    }
    expect(still).toBe(30);
    expect([...frames]).toEqual([1]);
  });

  it("is closed again after a death, until he moves", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    agent.scenario({ playState: "PLAYING" });
    const b = agent.view().ghosts.BLINKY;
    agent.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } });
    agent.runUntil((v) => v.phase === "READY", 600);
    expect(agent.engine.pacman.mouthFrame).toBe(0);
  });
});
