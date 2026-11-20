import type { Direction } from "../../src/types";
import { mouthFrameShown } from "../../src/game/render/actors";
import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { faceBlinky } from "../helpers";

describe("Pac-Man's mouth (sprite frames)", () => {
  it("is a closed circle through PLAYER ONE and READY, and until he first moves", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    const e = agent.engine;
    expect(e.phase).toBe("PLAYER_ONE");
    const frames = new Set<number>();
    while (e.playState === "READY") {
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
    agent.scenario({ phase: "PLAYING", pacman: { col: 21, row: 26, dir: "LEFT" } });
    const e = agent.engine;
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      e.update();
      if (seen[seen.length - 1] !== e.pacman.mouthFrame) seen.push(e.pacman.mouthFrame);
    }
    const cycle = seen.slice(seen.indexOf(0), seen.indexOf(0) + 5);
    expect(cycle).toEqual([0, 1, 2, 1, 0]);
  });

  /** Runs Pac-Man from a tile until a wall stops him; the frames he holds there. */
  function stopFrames(col: number, row: number, dir: Direction): number[] {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    agent.scenario({ phase: "PLAYING", pacman: { col, row, dir } });
    const e = agent.engine;
    e.rules.invincible = true;
    let last = { x: NaN, y: NaN };
    let still = 0;
    const frames = new Set<number>();
    for (let i = 0; i < 400 && still < 30; i++) {
      e.update();
      const stopped = e.pacman.x === last.x && e.pacman.y === last.y;
      still = stopped ? still + 1 : 0;
      if (!stopped) frames.clear();
      else frames.add(e.pacman.mouthFrame);
      last = { x: e.pacman.x, y: e.pacman.y };
    }
    expect(still, `${dir} from (${col}, ${row})`).toBe(30);
    return [...frames];
  }

  // Footage of the original (docs/footage/2026-11-19.md): at a wall he stops on the tile center,
  // wide open facing right or down, half open facing left or up
  it("holds wide open against a wall facing right or down, half open facing left or up", () => {
    expect(stopFrames(1, 26, "UP")).toEqual([1]);
    expect(stopFrames(3, 26, "LEFT")).toEqual([1]);
    expect(stopFrames(24, 26, "RIGHT")).toEqual([2]);
    expect(stopFrames(1, 30, "DOWN")).toEqual([2]);
  });

  it("is closed again after a death, until he moves", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    agent.scenario({ phase: "PLAYING" });
    faceBlinky(agent);
    agent.runUntil((v) => v.phase === "READY", 600);
    expect(agent.engine.pacman.mouthFrame).toBe(0);
  });

  it("is a closed circle through a level clear", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    agent.scenario({ phase: "PLAYING", pacman: { col: 24, row: 26, dir: "RIGHT" } });
    const e = agent.engine;
    e.rules.invincible = true;
    for (let i = 0; i < 300; i++) e.update(); // stopped against the wall, wide open
    expect(mouthFrameShown(e)).toBe(2);
    for (const phase of ["LEVEL_CLEAR_FREEZE", "MAZE_FLASH"] as const) {
      e.enterPhase(phase);
      expect(mouthFrameShown(e), phase).toBe(0);
    }
  });
});
