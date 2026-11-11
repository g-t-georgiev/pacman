import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { PHASE_FRAMES, READY_FRAMES_GAME_START } from "../../src/game/RoundSequencer";
import { EXTRA_LIFE_SCORE, FRUIT_EXTRA_FRAMES, FRUIT_MIN_FRAMES } from "../../src/game/constants";
import type { RoundPhase } from "../../src/game/RoundSequencer";

function playing(level = 1): AgentDriver {
  const agent = new AgentDriver(new GameEngine("PACMAN", 0));
  agent.scenario({ level, playState: "PLAYING" });
  agent.events();
  return agent;
}

/** Steps until the phase changes; returns how many frames the phase lasted. */
function phaseLength(engine: GameEngine): { frames: number; next: RoundPhase } {
  const start = engine.phase;
  let frames = 0;
  while (engine.phase === start && frames < 1000) {
    engine.update();
    frames++;
  }
  return { frames, next: engine.phase };
}

describe("Round sequencer (A2)", () => {
  it("READY is longer at game start than after a death", () => {
    const engine = new GameEngine("PACMAN", 0);
    expect(engine.phase).toBe("READY");
    expect(phaseLength(engine)).toEqual({ frames: READY_FRAMES_GAME_START, next: "PLAYING" });
  });

  it("death: freeze with ghosts visible, then the animation, then a wait, then READY", () => {
    const agent = playing();
    const e = agent.engine;
    const b = agent.view().ghosts.BLINKY;
    // One tile left of Blinky, facing him: they meet in the same tile on the next frame
    agent.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } });
    e.drainEvents();
    e.update();

    expect(e.phase).toBe("DEATH_FREEZE");
    expect(e.ghostsVisible).toBe(true);
    expect(e.pacman.isDying).toBe(false);
    // A phase entered during a play frame runs its full length after that frame
    expect(phaseLength(e)).toEqual({ frames: PHASE_FRAMES.DEATH_FREEZE, next: "DEATH_ANIM" });

    // The death sound starts with the animation, not at the collision
    expect(e.drainEvents().map((ev) => ev.type)).toContain("PACMAN_DIED");
    expect(e.ghostsVisible).toBe(false);
    expect(e.pacman.isDying).toBe(true);

    // The animation runs on sim frames, so it slows down with the practice speed
    e.update();
    expect(e.pacman.deathProgress).toBeCloseTo(1 / PHASE_FRAMES.DEATH_ANIM);
    expect(phaseLength(e).next).toBe("DEATH_WAIT");
    expect(e.pacman.deathProgress).toBe(1);
    expect(e.pacmanVisible).toBe(false);

    expect(phaseLength(e)).toEqual({ frames: PHASE_FRAMES.DEATH_WAIT, next: "READY" });
    expect(e.lives).toBe(2);
    expect(e.phaseFramesLeft).toBe(PHASE_FRAMES.READY);
  });

  it("after the last death the ghosts stay gone through game over", () => {
    const agent = playing();
    const e = agent.engine;
    e.lives = 1;
    const b = agent.view().ghosts.BLINKY;
    agent.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } });
    agent.runUntil((v) => v.phase === "GAME_OVER", 600);
    expect(e.phase).toBe("GAME_OVER");
    expect(e.ghostsVisible).toBe(false);
    expect(e.pacmanVisible).toBe(false);
    agent.advance(120);
    expect(e.ghostsVisible).toBe(false);
  });

  it("eating a ghost pauses the action; eyes already going home keep moving", () => {
    const agent = playing();
    const e = agent.engine;
    agent.scenario({
      frightened: true,
      pacman: { col: 6, row: 8, dir: "LEFT" },
      ghosts: {
        BLINKY: { col: 6, row: 8, dir: "RIGHT" },
        PINKY: { col: 21, row: 8, dir: "LEFT", location: "EYES" },
      },
    });
    const frightenedLeft = e.frightenedGlobalTimer;
    const waveTimer = e.waveTimer;
    e.update();

    expect(e.phase).toBe("GHOST_EATEN_PAUSE");
    expect(e.sequencer.state).toMatchObject({ eatenGhost: "BLINKY", eatenPoints: 200 });
    expect(e.pacmanVisible).toBe(false);

    const pac = { x: e.pacman.x, y: e.pacman.y };
    const blinky = { x: e.ghosts.BLINKY.x, y: e.ghosts.BLINKY.y };
    const pinkyX = e.ghosts.PINKY.x;
    const frightAfterEat = e.frightenedGlobalTimer;

    const { frames, next } = phaseLength(e);
    expect(next).toBe("PLAYING");
    expect(frames).toBe(PHASE_FRAMES.GHOST_EATEN_PAUSE);

    // Pac-Man, the eaten ghost and every timer are frozen; Pinky's eyes moved
    expect({ x: e.pacman.x, y: e.pacman.y }).toEqual(pac);
    expect({ x: e.ghosts.BLINKY.x, y: e.ghosts.BLINKY.y }).toEqual(blinky);
    expect(e.ghosts.PINKY.x).not.toBe(pinkyX);
    expect(e.frightenedGlobalTimer).toBe(frightAfterEat);
    expect(frightAfterEat).toBe(frightenedLeft - 1);
    expect(e.waveTimer).toBe(waveTimer);
  });

  it("two frightened ghosts on Pac-Man's tile: one per pause, the second after it", () => {
    const agent = playing();
    const e = agent.engine;
    agent.scenario({
      frightened: true,
      pacman: { col: 6, row: 8, dir: "LEFT" },
      ghosts: { BLINKY: { col: 6, row: 8 }, INKY: { col: 6, row: 8 } },
    });
    e.maze.tiles[8][6] = "EMPTY";
    e.update();
    expect(e.score).toBe(200);
    phaseLength(e); // the pause
    e.update();
    expect(e.score).toBe(600); // 200 + 400
    expect(e.sequencer.state.eatenPoints).toBe(400);
  });

  it("level clear: freeze, maze flash with ghosts hidden, then READY on the next level", () => {
    const agent = playing();
    const e = agent.engine;
    agent.scenario({ dotsRemaining: 1 });
    const last = e.maze.tiles.flatMap((row, r) =>
      row.flatMap((t, c) => (t === "DOT" || t === "ENERGIZER" ? [{ col: c, row: r }] : []))
    )[0];
    agent.scenario({ pacman: { col: last.col, row: last.row } });
    e.update();

    expect(e.phase).toBe("LEVEL_CLEAR_FREEZE");
    expect(phaseLength(e)).toEqual({
      frames: PHASE_FRAMES.LEVEL_CLEAR_FREEZE,
      next: "MAZE_FLASH",
    });
    expect(e.ghostsVisible).toBe(false);
    let whiteFrames = 0;
    while (e.phase === "MAZE_FLASH") {
      if (e.isMazeFlashWhite) whiteFrames++;
      e.update();
    }
    expect(whiteFrames).toBeGreaterThan(0);
    expect(e.phase).toBe("READY");
    expect(e.level).toBe(2);
  });
});

describe("Extra life (F19)", () => {
  it("awards one life at 10,000 points, once", () => {
    const agent = playing();
    const e = agent.engine;
    e.score = EXTRA_LIFE_SCORE - 10;
    agent.scenario({ pacman: { col: 1, row: 8, dir: "RIGHT" } });
    e.maze.tiles[8][2] = "DOT";
    e.maze.tiles[8][3] = "DOT";

    const { events } = agent.runUntil((v) => v.pacman.col === 2, 30);
    expect(e.lives).toBe(4);
    expect(events.map((ev) => ev.type)).toContain("EXTRA_LIFE");

    agent.runUntil((v) => v.pacman.col === 3, 30);
    expect(e.lives).toBe(4);
  });

  it("a new game gives it again", () => {
    const e = new GameEngine("PACMAN", 0);
    e.extraLifeAwarded = true;
    e.initGame("PACMAN", 1);
    expect(e.extraLifeAwarded).toBe(false);
  });
});

describe("Fruit timer (F22)", () => {
  it("lasts 9-10 s, drawn from the sim stream, the same on every run", () => {
    const durations = (): number[] => {
      const e = new GameEngine("PACMAN", 0);
      const out: number[] = [];
      for (let i = 0; i < 20; i++) {
        e.spawnFruit();
        out.push(e.fruit!.duration);
      }
      return out;
    };
    const first = durations();
    expect(durations()).toEqual(first);
    for (const d of first) {
      expect(d).toBeGreaterThanOrEqual(FRUIT_MIN_FRAMES);
      expect(d).toBeLessThan(FRUIT_MIN_FRAMES + FRUIT_EXTRA_FRAMES);
    }
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it("drawing a fruit timer doesn't touch the frightened ghost PRNG", () => {
    const e = new GameEngine("PACMAN", 0);
    const before = e.prng.state;
    e.spawnFruit();
    expect(e.prng.state).toBe(before);
  });
});

describe("Sequencer state in GameState", () => {
  it("save/load mid-pause resumes the same pause", () => {
    const agent = playing();
    const e = agent.engine;
    agent.scenario({
      frightened: true,
      pacman: { col: 6, row: 8, dir: "LEFT" },
      ghosts: { BLINKY: { col: 6, row: 8 } },
    });
    agent.step(10);
    const saved = agent.save();
    const hash = agent.hash();
    const later = agent.trace(80, (v) => `${v.playState}:${v.pacman.x}`);
    agent.load(saved);
    expect(e.phase).toBe("GHOST_EATEN_PAUSE");
    expect(agent.hash()).toBe(hash);
    expect(agent.trace(80, (v) => `${v.playState}:${v.pacman.x}`)).toEqual(later);
  });
});
