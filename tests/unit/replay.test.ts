import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { SimRandom } from "../../src/core/SimRandom";
import { hashGameState } from "../../src/game/gameState";
import { CHECKPOINT_TICKS, KEYFRAME_TICKS } from "../../src/game/replay";
import type { Direction } from "../../src/types";

/** Headless driver on level `level`, playing, Pac-Man invincible so runs stay long. */
function playing(level = 1): AgentDriver {
  const agent = new AgentDriver(new GameEngine("PACMAN", 0));
  agent.engine.settings.invincible = true;
  agent.scenario({ level, playState: "PLAYING" });
  agent.engine.pacman.invincible = true;
  agent.scenario({}); // restart the recording with invincibility in place
  return agent;
}

/** Steps `frames` frames with random input every 20 frames. */
function playRandomly(agent: AgentDriver, frames: number, seed = 7): void {
  const rng = new SimRandom();
  rng.reset(seed);
  const dirs: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  for (let f = 0; f < frames; f++) {
    if (f % 20 === 0) agent.input(dirs[rng.nextInt(4)]);
    agent.advance(1);
  }
}

describe("Pause is invisible to the sim", () => {
  it("paused frames change nothing, not even the frame counter that drives speed masks", () => {
    const a = playing();
    const b = playing();
    a.step(37);
    b.step(37);
    b.engine.paused = true;
    b.step(50);
    b.engine.paused = false;
    a.step(200);
    b.step(200);
    expect(b.hash()).toBe(a.hash());
  });
});

describe("Score popups (F26)", () => {
  it("are cleared when a life is lost", () => {
    const agent = playing();
    const e = agent.engine;
    e.settings.invincible = false;
    e.pacman.invincible = false;
    e.scorePopups.push({ id: "fruit", text: "100", x: 112, y: 164, life: 50, color: "#fff" });
    const b = agent.view().ghosts.BLINKY;
    agent.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } });
    agent.runUntil((v) => v.phase === "READY", 400);
    expect(e.scorePopups).toEqual([]);
  });
});

describe("Replay log (T4)", () => {
  it("a saved replay reproduces the game exactly", () => {
    const agent = playing(2);
    playRandomly(agent, 2500);
    const replay = agent.saveReplay();
    expect(replay.endTick).toBe(agent.engine.tick);
    expect(replay.checkpoints.length).toBeGreaterThan(30);

    const result = agent.verifyReplay(replay);
    expect(result).toMatchObject({ matched: true, divergedAt: null });
    expect(result.ticks).toBe(replay.endTick - replay.start.tick);
  });

  it("loadReplay fast-forwards a fresh engine to the recorded state", () => {
    const agent = playing(2);
    playRandomly(agent, 900);
    const replay = agent.saveReplay();
    const target = agent.hash();

    const other = new AgentDriver(new GameEngine("PACMAN", 0));
    const loaded = other.loadReplay(replay);
    expect(loaded.matched).toBe(true);
    expect(other.hash()).toBe(target);

    // ...or stops early, at a tick of your choice
    const early = other.loadReplay(replay, replay.start.tick + 120);
    expect(early.view.frame).toBeLessThan(agent.view().frame);
    expect(other.engine.tick).toBe(replay.start.tick + 120);
  });

  it("names the second where a tampered replay stops matching", () => {
    const agent = playing();
    playRandomly(agent, 1200);
    const replay = agent.saveReplay();
    const opposite: Record<Direction, Direction> = {
      UP: "DOWN",
      DOWN: "UP",
      LEFT: "RIGHT",
      RIGHT: "LEFT",
      NONE: "NONE",
    };
    const from = replay.start.tick + 300;
    replay.inputs = replay.inputs.map(([t, dir]) => [t, t > from ? opposite[dir] : dir]);

    const result = agent.verifyReplay(replay);
    expect(result.matched).toBe(false);
    expect(result.divergedAt).toBeGreaterThan(from);
    expect(result.lastMatchedAt).toBeGreaterThanOrEqual(from - CHECKPOINT_TICKS);
  });

  it("saveReplay(seconds) starts at a keyframe at least that far back", () => {
    const agent = playing();
    playRandomly(agent, 1900);
    const now = agent.engine.tick;
    const replay = agent.saveReplay(5);
    expect(replay.start.tick).toBeLessThanOrEqual(now - 5 * 60);
    expect(now - replay.start.tick).toBeLessThanOrEqual(5 * 60 + KEYFRAME_TICKS);
    expect(agent.verifyReplay(replay).matched).toBe(true);
  });

  it("starts over when a sim setting changes, so the recording stays replayable", () => {
    const agent = playing();
    playRandomly(agent, 700);
    agent.engine.settings.emulateRomQuirks = false;
    agent.advance(1);
    const changedAt = agent.engine.tick;
    playRandomly(agent, 300);
    const replay = agent.saveReplay();
    expect(replay.start.tick).toBe(changedAt);
    expect(replay.settings.emulateRomQuirks).toBe(false);
    expect(agent.verifyReplay(replay).matched).toBe(true);
  });

  it("the end hash is the hash of the live state", () => {
    const agent = playing();
    playRandomly(agent, 400);
    const replay = agent.saveReplay();
    expect(replay.checkpoints.at(-1)).toEqual([agent.engine.tick, hashGameState(agent.save())]);
  });
});
