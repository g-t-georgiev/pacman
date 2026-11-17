import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { GhostAiController } from "../../src/controllers/GhostAiController";
import { HouseController, getHouseIdleLimit } from "../../src/controllers/HouseController";
import { Ghost } from "../../src/core/Ghost";
import { Pacman } from "../../src/core/Pacman";
import { getMazeData } from "../../src/game/mazes";
import { applyRulesPreset } from "../../src/game/presets";
import { levelRow } from "../../src/game/levelTable";
import { PHASE_FRAMES } from "../../src/game/RoundSequencer";
import { EXTRA_LIFE_SCORE, SIM_FPS, TILE_SIZE } from "../../src/game/constants";
import { getPixelStepsThisFrame } from "../../src/game/speedMasks";
import type { Direction, GhostType } from "../../src/types";
import { playHashes, playing, randomInput } from "../helpers";

/**
 * Regression suite (plan T6), part 1: the contracts the rest of the game stands on, one block
 * per subsystem, small and fast (it runs on every commit). Detailed behavior lives in the unit,
 * fidelity and golden suites; this is the short list that must never break.
 */

const at = (col: number, row: number) => ({
  x: col * TILE_SIZE + TILE_SIZE / 2,
  y: row * TILE_SIZE + TILE_SIZE / 2,
});

describe("Regression: determinism and saved state", () => {
  it("the same inputs give the same game, hash for hash", () => {
    const a = playHashes(playing(1), 900, randomInput(11, 20));
    const b = playHashes(playing(1), 900, randomInput(11, 20));
    expect(b).toEqual(a);
  });

  it("a game saved mid-play and loaded elsewhere continues identically", () => {
    const first = playing(2);
    playHashes(first, 400, randomInput(12, 16));
    const second = new AgentDriver(new GameEngine("PACMAN", 0));
    second.load(first.save());
    expect(playHashes(second, 600, randomInput(13, 16))).toEqual(
      playHashes(first, 600, randomInput(13, 16))
    );
  });

  it("a rewind shows exactly the frame that was played", () => {
    const agent = playing(1);
    const e = agent.engine;
    const byTick = new Map<number, number>();
    const input = randomInput(14, 18);
    for (let i = 0; i < 400; i++) {
      const dir = input(e.tick + 1);
      if (dir) e.setInputDirection(dir);
      e.update();
      byTick.set(e.tick, agent.hash());
    }
    e.timeline.rewindSeconds(3);
    expect(agent.hash()).toBe(byTick.get(e.tick));
  });

  it("replays record every rule and nothing else; no setting is both (P1)", () => {
    const agent = playing(1);
    agent.advance(10);
    const recorded = Object.keys(agent.saveReplay().settings).sort();
    expect(recorded).toEqual(Object.keys(agent.engine.rules).sort());
    const both = Object.keys(agent.engine.settings).filter((k) => k in agent.engine.rules);
    expect(both).toEqual([]);
  });

  it("a held game changes nothing, not even its frame counters", () => {
    const agent = playing(1);
    const e = agent.engine;
    const before = agent.hash();
    e.paused = true;
    for (let i = 0; i < 30; i++) e.update();
    expect(agent.hash()).toBe(before);
  });
});

describe("Regression: speeds (16-frame step masks)", () => {
  it.each([1, 2, 5, 21])("level %i: every speed moves exactly pct/5 px per 16 frames", (level) => {
    const speeds: Record<string, number> = { ...levelRow(level).speeds };
    for (const pct of Object.values(speeds)) {
      let px = 0;
      for (let f = 0; f < 16; f++) px += getPixelStepsThisFrame(f, pct);
      expect(px, `${pct}%`).toBe(pct / 5);
    }
  });

  it("Pac-Man is faster than the ghosts until level 21, slower from it", () => {
    for (const level of [1, 2, 5, 20]) {
      const s = levelRow(level).speeds;
      expect(s.pacmanNormal, `level ${level}`).toBeGreaterThan(s.ghostNormal);
    }
    const s21 = levelRow(21).speeds;
    expect(s21.pacmanNormal).toBeLessThan(s21.ghostNormal);
  });
});

describe("Regression: ghost targeting", () => {
  const maze = getMazeData("PACMAN", 1);
  const ghost = (type: GhostType, col: number, row: number) => {
    const p = at(col, row);
    const g = new Ghost(type, p.x, p.y, "LEFT", false);
    g.wave = "CHASE";
    return g;
  };
  const pacman = (col: number, row: number, dir: Direction) => {
    const p = at(col, row);
    return new Pacman(p.x, p.y, dir);
  };
  const target = (quirks: boolean, g: Ghost, p: Pacman, blinky: Ghost) =>
    new GhostAiController(quirks).calculateTarget(g, p, blinky, maze);

  it("Blinky targets Pac-Man's tile", () => {
    const blinky = ghost("BLINKY", 5, 5);
    expect(target(true, blinky, pacman(14, 20, "LEFT"), blinky)).toEqual({ col: 14, row: 20 });
  });

  it("Pinky targets 4 tiles ahead; facing up, also 4 left with the arcade overflow", () => {
    const blinky = ghost("BLINKY", 5, 5);
    const pinky = ghost("PINKY", 5, 6);
    expect(target(true, pinky, pacman(14, 20, "LEFT"), blinky)).toEqual({ col: 10, row: 20 });
    expect(target(true, pinky, pacman(14, 20, "UP"), blinky)).toEqual({ col: 10, row: 16 });
    expect(target(false, pinky, pacman(14, 20, "UP"), blinky)).toEqual({ col: 14, row: 16 });
  });

  it("Inky doubles the vector from Blinky to 2 tiles ahead of Pac-Man", () => {
    // 2 ahead of (14, 20) facing left = (12, 20); Blinky (10, 18) to (12, 20), doubled = (14, 22)
    const blinky = ghost("BLINKY", 10, 18);
    expect(target(true, ghost("INKY", 5, 6), pacman(14, 20, "LEFT"), blinky)).toEqual({
      col: 14,
      row: 22,
    });
  });

  it("the engine's ghost AI follows the rules preset with no copy to sync (O1)", () => {
    const e = new GameEngine("PACMAN", 0);
    applyRulesPreset(e, "MODERN");
    expect(e.ghostAiController.emulateRomQuirks).toBe(false);
    applyRulesPreset(e, "ARCADE");
    expect(e.ghostAiController.emulateRomQuirks).toBe(true);
  });

  it("Clyde chases from 8 tiles or more, and heads for his corner when closer", () => {
    const blinky = ghost("BLINKY", 5, 5);
    expect(target(true, ghost("CLYDE", 1, 20), pacman(14, 20, "LEFT"), blinky)).toEqual({
      col: 14,
      row: 20,
    });
    expect(target(true, ghost("CLYDE", 12, 20), pacman(14, 20, "LEFT"), blinky)).toEqual(
      maze.scatterTargets.CLYDE
    );
  });
});

describe("Regression: ghost house", () => {
  const houseGhosts = (): Record<GhostType, Ghost> => ({
    BLINKY: new Ghost("BLINKY", 0, 0, "LEFT", false),
    PINKY: new Ghost("PINKY", 112, 140, "UP", true),
    INKY: new Ghost("INKY", 96, 140, "UP", true),
    CLYDE: new Ghost("CLYDE", 128, 140, "UP", true),
  });
  const inside = (g: Record<GhostType, Ghost>) =>
    (["PINKY", "INKY", "CLYDE"] as const).filter((t) => g[t].location === "HOUSE");
  const eat = (house: HouseController, g: Record<GhostType, Ghost>, dots: number, level = 1) => {
    for (let i = 0; i < dots; i++) {
      house.onDotEaten(g);
      house.update(g, level);
    }
  };

  it("level 1: Pinky at once, Inky after 30 dots, Clyde after 60 more, in that order", () => {
    const house = new HouseController();
    const g = houseGhosts();
    house.update(g, 1);
    expect(inside(g)).toEqual(["INKY", "CLYDE"]);
    eat(house, g, 30);
    expect(inside(g)).toEqual(["CLYDE"]);
    eat(house, g, 60);
    expect(inside(g)).toEqual([]);
  });

  it("after a death the global counter releases Pinky at 7 and Inky at 17", () => {
    const house = new HouseController();
    const g = houseGhosts();
    house.onLifeLost();
    eat(house, g, 7);
    expect(inside(g)).toEqual(["INKY", "CLYDE"]);
    eat(house, g, 10);
    expect(inside(g)).toEqual(["CLYDE"]);
  });

  it("the no-dot timer is 4 s, 3 s from level 5", () => {
    expect(getHouseIdleLimit(4)).toBe(4 * SIM_FPS);
    expect(getHouseIdleLimit(5)).toBe(3 * SIM_FPS);
  });
});

describe("Regression: the level table (Dossier Table A.1 spot checks)", () => {
  it("frightened time and flashes", () => {
    expect([levelRow(1).frightSeconds, levelRow(1).flashes]).toEqual([6, 5]);
    expect(levelRow(17).frightSeconds).toBe(0);
    expect(levelRow(19).frightSeconds).toBe(0);
  });

  it("Cruise Elroy starts at 20 dots left on level 1", () => {
    expect(levelRow(1).elroy1Dots).toBe(20);
  });

  it("level 1 opens with 7 s scatter, 20 s chase; scatter is 5 s from level 5", () => {
    expect(
      levelRow(1)
        .schedule.slice(0, 2)
        .map((w) => [w.mode, w.frames])
    ).toEqual([
      ["SCATTER", 7 * SIM_FPS],
      ["CHASE", 20 * SIM_FPS],
    ]);
    expect(levelRow(5).schedule[0].frames).toBe(5 * SIM_FPS);
  });
});

describe("Regression: scoring and round flow", () => {
  it("a dot is 10, an energizer 50", () => {
    const agent = playing(1);
    const e = agent.engine;
    agent.scenario({ pacman: { col: 1, row: 8, dir: "RIGHT" } });
    e.maze.tiles[8][1] = "EMPTY"; // his own tile
    e.maze.tiles[8][2] = "DOT";
    e.maze.tiles[8][3] = "ENERGIZER";
    const score = e.score;
    agent.runUntil((v) => v.pacman.col === 2, 30);
    expect(e.score - score).toBe(10);
    agent.runUntil((v) => v.pacman.col === 3, 30);
    expect(e.score - score).toBe(60);
  });

  it("the extra life comes at 10,000", () => {
    expect(EXTRA_LIFE_SCORE).toBe(10000);
  });

  it("eating a ghost holds the game 1 s; a death freezes 1 s before the animation", () => {
    expect(PHASE_FRAMES.GHOST_EATEN_PAUSE).toBe(SIM_FPS);
    expect(PHASE_FRAMES.DEATH_FREEZE).toBe(SIM_FPS);
  });
});
