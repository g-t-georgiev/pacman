import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { PRNG } from "../../src/core/PRNG";
import { hashGameState } from "../../src/game/gameState";
import type { Direction } from "../../src/types";

const sample = (prng: PRNG, n: number) => Array.from({ length: n }, () => prng.next());

const INPUTS: Direction[] = ["LEFT", "UP", "RIGHT", "DOWN"];

/** Applies the scripted input for frame f (1-based), then advances one frame. */
function step(engine: GameEngine, f: number): void {
  if (f % 45 === 0) engine.setInputDirection(INPUTS[(f / 45) % INPUTS.length]);
  if (f % 200 === 0) engine.triggerFrightenedMode();
  engine.update();
}

function newPlayingEngine(): GameEngine {
  const engine = new GameEngine("PACMAN", 0);
  engine.playState = "PLAYING";
  return engine;
}

/** Plays the fixed input script headlessly and returns the state hash after every frame. */
function playScript(frames: number): number[] {
  const engine = newPlayingEngine();
  const hashes: number[] = [];
  for (let f = 1; f <= frames; f++) {
    step(engine, f);
    hashes.push(hashGameState(engine.getState()));
  }
  return hashes;
}

describe("PRNG", () => {
  it("returns to the same sequence after reset", () => {
    const prng = new PRNG();
    const first = sample(prng, 32);
    prng.reset();
    expect(sample(prng, 32)).toEqual(first);
  });

  it("only yields direction indices 0..3", () => {
    expect(sample(new PRNG(), 500).every((d) => d >= 0 && d <= 3)).toBe(true);
  });
});

describe("Deterministic simulation", () => {
  it("the same inputs produce the same state, frame for frame", () => {
    const a = playScript(900);
    const b = playScript(900);
    expect(new Set(a).size).toBeGreaterThan(100); // the run actually changes state
    expect(b).toEqual(a);
  });

  it("each engine owns its PRNG, and loading a level resets it", () => {
    const a = new GameEngine("PACMAN", 0);
    const b = new GameEngine("PACMAN", 0);
    expect(a.prng).not.toBe(b.prng);

    a.prng.next();
    a.prng.next();
    a.loadLevel(1);
    expect(a.prng.state).toBe(b.prng.state);
  });
});

describe("GameState snapshots", () => {
  it("getState/setState round-trips exactly", () => {
    const engine = newPlayingEngine();
    for (let f = 1; f <= 300; f++) step(engine, f);

    const state = engine.getState();
    const other = new GameEngine("PACMAN", 0);
    other.setState(state);
    expect(other.getState()).toEqual(state);
  });

  it("a snapshot is a copy: playing on does not change it", () => {
    const engine = newPlayingEngine();
    const state = engine.getState();
    const json = JSON.stringify(state);
    for (let f = 1; f <= 120; f++) step(engine, f);
    expect(JSON.stringify(state)).toBe(json);
  });

  it("restoring a mid-game snapshot continues exactly like the uninterrupted run", () => {
    const reference = playScript(700);

    const engine = newPlayingEngine();
    for (let f = 1; f <= 400; f++) step(engine, f);
    const saved = engine.getState();

    // Play on, then jump back and replay the same frames
    for (let f = 401; f <= 550; f++) step(engine, f);
    engine.setState(saved);

    const replayed: number[] = [];
    for (let f = 401; f <= 700; f++) {
      step(engine, f);
      replayed.push(hashGameState(engine.getState()));
    }
    expect(replayed).toEqual(reference.slice(400));
  });
});

describe("Sim events", () => {
  it("the sim queues events instead of calling audio or the UI bus", () => {
    const engine = newPlayingEngine();
    engine.drainEvents();
    // Pac-Man starts on the 13/14 seam and steps into col 13 on the first frame
    const { row } = engine.pacman.tileCoord;
    engine.maze.tiles[row][13] = "DOT";
    engine.maze.tiles[row][14] = "DOT";

    engine.update();
    const types = engine.drainEvents().map((e) => e.type);

    expect(types).toContain("DOT_EATEN");
    expect(types).toContain("SCORE_CHANGED");
    expect(engine.drainEvents()).toEqual([]); // draining empties the outbox
  });
});
