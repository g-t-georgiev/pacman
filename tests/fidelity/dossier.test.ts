import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { SIM_FPS } from "../../src/game/constants";
import {
  getFrightenedDuration,
  getFrightenedFlashCount,
  getFruitDataPerLevel,
} from "../../src/utils";
import { ghostSpeed, pacmanSpeed } from "../../src/game/speedSource";
import { getSpeedConfigForLevel } from "../../src/utils";
import { getOppositeDirection } from "../../src/game/ghostAiUtils";

/**
 * Fidelity checklist (plan T9): one test per claim from "The Pac-Man Dossier", grouped by its
 * chapters. Claims tested elsewhere:
 *
 * - Speeds per Table A.1, measured in play: tests/integration/speedTables.test.ts
 * - Scatter/chase tables: tests/unit/scheduleTables.test.ts
 * - Cornering (pre-/post-turns, diagonal moves): tests/unit/cornering.test.ts
 * - Ghost house dot limits, global counter, idle timer: tests/unit/ghostHouse.test.ts
 * - Cruise Elroy thresholds and suspension: tests/integration/elroyProgression.test.ts
 * - Pass-through when swapping tiles: tests/integration/arcadePhysicsAndEatenRouting.test.ts
 * - Frightened PRNG and no-up zones while frightened: tests/unit/frightenedPrng.test.ts
 * - Reversal on tile entry, decisions one tile ahead: tests/unit/actorMovement.test.ts,
 *   tests/integration/ghostSoak.test.ts
 * - Targeting (Pinky/Inky up-quirk, Clyde's 8 tiles): tests/unit/targetingQuirks.test.ts
 * - Extra life at 10,000, freezes when eating a ghost, death sequence: tests/unit/roundSequencer.test.ts
 */

/** A headless game on `level`, already playing. */
function playing(level = 1): AgentDriver {
  const agent = new AgentDriver(new GameEngine("PACMAN", 0));
  agent.scenario({ level, playState: "PLAYING" });
  agent.events();
  return agent;
}

describe("Dossier · The Basics", () => {
  it("each maze has 240 dots and 4 energizers", () => {
    const tiles = playing().engine.maze.tiles.flat();
    expect(tiles.filter((t) => t === "DOT")).toHaveLength(240);
    expect(tiles.filter((t) => t === "ENERGIZER")).toHaveLength(4);
  });

  it("a dot stops Pac-Man for 1 frame, an energizer for 3", () => {
    const agent = playing();
    const e = agent.engine;
    agent.scenario({ pacman: { col: 1, row: 8, dir: "RIGHT" } });
    e.maze.tiles[8][2] = "DOT";
    e.maze.tiles[8][3] = "ENERGIZER";
    agent.runUntil((v) => v.pacman.col === 2, 30);
    expect(e.pacman.eatingFreezeFrames).toBe(1);
    agent.runUntil((v) => v.pacman.col === 3, 30);
    expect(e.pacman.eatingFreezeFrames).toBe(3);
    const x = e.pacman.x;
    agent.step(3);
    expect(e.pacman.x).toBe(x); // held for exactly 3 frames...
    agent.advance(1);
    expect(e.pacman.x).not.toBe(x); // ...then moves on
  });

  it("bonus fruit appears after 70 and 170 dots eaten", () => {
    const agent = playing();
    const e = agent.engine;
    e.dotsEatenThisRound = 69;
    agent.scenario({ pacman: { col: 1, row: 8, dir: "RIGHT" } });
    e.maze.tiles[8][2] = "DOT";
    agent.runUntil((v) => v.pacman.col === 2, 30);
    expect(e.fruit?.active).toBe(true);

    e.spawnFruit(); // reset to a fresh, unrelated fruit object...
    e.fruit!.active = false; // ...that is not showing
    e.dotsEatenThisRound = 169;
    e.maze.tiles[8][3] = "DOT";
    agent.runUntil((v) => v.pacman.col === 3, 30);
    expect(e.fruit?.active).toBe(true);
  });

  it("fruit points per level: 100, 300, 500 x2, 700 x2, 1000 x2, 2000 x2, 3000 x2, then 5000", () => {
    const points = Array.from({ length: 14 }, (_, i) => getFruitDataPerLevel(i + 1).points);
    expect(points).toEqual([
      100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000, 5000,
    ]);
    expect(getFruitDataPerLevel(100).points).toBe(5000);
  });
});

describe("Dossier · Scatter, Chase, Repeat", () => {
  it("the scatter/chase timer stops while the ghosts are frightened, then carries on", () => {
    const agent = playing();
    const e = agent.engine;
    agent.step(100);
    const waveTimer = e.waveTimer;
    agent.scenario({ frightened: true });
    agent.step(60);
    expect(e.waveTimer).toBe(waveTimer);
    agent.runUntil(() => e.frightenedGlobalTimer === 0, 10 * SIM_FPS);
    agent.step(30);
    expect(e.waveTimer).toBeGreaterThan(waveTimer);
  });

  it("ghosts reverse when chase and scatter switch", () => {
    const agent = playing();
    const e = agent.engine;
    agent.step(200);
    const before = new Map(Object.values(e.ghosts).map((g) => [g.type, g.dir]));
    e.timerController.waveTimer = e.timerController.currentWave!.frames - 1;
    agent.advance(1);
    for (const g of Object.values(e.ghosts)) {
      if (g.location !== "ACTIVE" && g.location !== "HOUSE") continue;
      // Latched, or already turned around (it entered a new tile on this very frame)
      const turned = g.dir === getOppositeDirection(before.get(g.type)!);
      expect(g.reversalPrimed || turned, g.type).toBe(true);
    }
  });

  it("ghosts reverse on entering frightened mode, but not when it ends", () => {
    const agent = playing();
    const e = agent.engine;
    agent.step(200);
    e.triggerFrightenedMode();
    expect(e.ghosts.BLINKY.reversalPrimed).toBe(true);
    agent.runUntil(() => e.frightenedGlobalTimer === 0, 10 * SIM_FPS);
    for (const g of Object.values(e.ghosts)) g.reversalPrimed = false;
    agent.advance(1);
    for (const g of Object.values(e.ghosts)) expect(g.reversalPrimed).toBe(false);
  });
});

describe("Dossier · Frightening Behavior", () => {
  it("frightened time and warning flashes per level (Table A.1)", () => {
    const seconds = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1, 0, 0, 0];
    const flashes = [5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 3, 3, 5, 3, 3, 0, 3, 0, 0, 0];
    seconds.forEach((s, i) =>
      expect(getFrightenedDuration(i + 1), `level ${i + 1}`).toBe(s * SIM_FPS)
    );
    flashes.forEach((n, i) => expect(getFrightenedFlashCount(i + 1), `level ${i + 1}`).toBe(n));
  });

  it.each([17, 19, 21])(
    "on level %i an energizer only reverses the ghosts: they never turn blue",
    (level) => {
      const agent = playing(level);
      const e = agent.engine;
      agent.step(200);
      e.triggerFrightenedMode();
      for (const g of Object.values(e.ghosts)) {
        expect(g.frightened).toBe(false);
        if (!g.isEyes) expect(g.reversalPrimed).toBe(true);
      }
    }
  );

  it("eating ghosts scores 200, 400, 800, 1600, and the chain restarts with the next energizer", () => {
    const agent = playing();
    const e = agent.engine;
    const eat = (type: "BLINKY" | "PINKY" | "INKY" | "CLYDE") => {
      agent.scenario({ ghosts: { [type]: { col: 6, row: 8 } }, pacman: { col: 6, row: 8 } });
      e.maze.tiles[8][6] = "EMPTY";
      const before = e.score;
      agent.advance(1);
      const points = e.score - before;
      agent.runUntil((v) => v.phase === "PLAYING", 120); // the eat pause
      return points;
    };
    agent.scenario({ frightened: true });
    e.eatenGhostsInEnergizer = 0;
    expect([eat("BLINKY"), eat("PINKY"), eat("INKY"), eat("CLYDE")]).toEqual([200, 400, 800, 1600]);

    // A new energizer starts the chain again
    agent.scenario({ pacman: { col: 1, row: 6, dir: "UP" } });
    e.maze.tiles[6][1] = "ENERGIZER";
    agent.runUntil((v) => v.pacman.row === 6, 30);
    expect(e.eatenGhostsInEnergizer).toBe(0);
  });
});

describe("Dossier · Speed", () => {
  it("in the tunnel ghosts slow down to the tunnel speed; Pac-Man does not", () => {
    const agent = playing();
    const e = agent.engine;
    agent.scenario({
      pacman: { col: 2, row: 17, dir: "LEFT" },
      ghosts: { BLINKY: { col: 3, row: 17, dir: "LEFT" } },
    });
    const cfg = getSpeedConfigForLevel(1);
    expect(ghostSpeed(e, e.ghosts.BLINKY)).toEqual({
      source: "ghost-tunnel",
      pct: cfg.ghostTunnel,
    });
    expect(pacmanSpeed(e)).toEqual({ source: "pacman-normal", pct: cfg.pacmanNormal });
  });
});

describe("Dossier · Maze Logic 101", () => {
  it("in scatter mode Blinky ends up circling the block below his top-right target", () => {
    const agent = playing();
    const e = agent.engine;
    e.settings.invincible = true;
    e.pacman.invincible = true;
    const visited = new Set<string>();
    for (let f = 0; f < 1500; f++) {
      e.timerController.waveIndex = 0; // hold the first scatter
      e.timerController.waveTimer = 0;
      agent.advance(1);
      if (f >= 900)
        visited.add(`${e.ghosts.BLINKY.tileCoord.col},${e.ghosts.BLINKY.tileCoord.row}`);
    }
    for (const tile of visited) {
      const [col, row] = tile.split(",").map(Number);
      expect(col, `Blinky at ${tile}`).toBeGreaterThanOrEqual(15);
      expect(row, `Blinky at ${tile}`).toBeLessThanOrEqual(12);
    }
    expect(visited.size).toBeGreaterThan(10); // moving round the loop, not parked
  });
});

describe("Dossier · Meet the Ghosts", () => {
  it("Pinky's head-fake: met head-on within 4 tiles, she turns away at the next junction", () => {
    // Row 8, Pac-Man heading right toward Pinky heading left. Pinky's target is 4 tiles ahead of
    // Pac-Man, which is now behind her, so at the junction (18, 8) she turns down, not into him.
    const agent = playing();
    const e = agent.engine;
    agent.scenario({
      waveIndex: 1, // chase
      pacman: { col: 14, row: 8, dir: "RIGHT" },
      ghosts: { PINKY: { col: 20, row: 8, dir: "LEFT" } },
    });
    for (const x of [15, 16, 17, 19, 20]) e.maze.tiles[8][x] = "EMPTY";
    const result = agent.runUntil((v) => v.ghosts.PINKY.dir !== "LEFT", 60);
    expect(result.reached).toBe(true);
    expect(result.view.ghosts.PINKY).toMatchObject({ col: 18, row: 8, dir: "DOWN" });
  });

  it("Clyde loops around Pac-Man's 8-tile circle and never reaches a still Pac-Man", () => {
    // Pac-Man stays still against the wall in the top-left corner (not Clyde's lower-left one).
    const agent = playing();
    const e = agent.engine;
    e.settings.invincible = true;
    e.pacman.invincible = true;
    agent.scenario({
      waveIndex: 1,
      pacman: { col: 1, row: 4, dir: "LEFT" },
      ghosts: { CLYDE: { col: 21, row: 8, dir: "LEFT" } },
    });
    const near: boolean[] = [];
    let minDistSq = Infinity;
    for (let f = 0; f < 3000; f++) {
      e.timerController.waveIndex = 1; // hold chase
      e.timerController.waveTimer = 0;
      agent.advance(1);
      const c = e.ghosts.CLYDE.tileCoord;
      const d = (c.col - 1) ** 2 + (c.row - 4) ** 2;
      if (f >= 1000) {
        minDistSq = Math.min(minDistSq, d);
        near.push(d < 64);
      }
    }
    expect(e.pacman.tileCoord).toEqual({ col: 1, row: 4 }); // Pac-Man really stayed put
    expect(minDistSq).toBeGreaterThan(0); // never on Pac-Man's tile
    const crossings = near.filter((n, i) => i > 0 && n !== near[i - 1]).length;
    expect(crossings).toBeGreaterThanOrEqual(4); // in and out of the circle, again and again
  });
});

describe("Dossier · Home Sweet Home", () => {
  it("stuck-ghosts trick: if Clyde is out when the global counter passes 32, a ghost eaten later stays home while Pac-Man keeps eating", () => {
    const agent = playing();
    const e = agent.engine;
    const house = e.houseController;
    e.settings.invincible = true; // no ghost may end the round while we wait
    e.pacman.invincible = true;
    // After a life was lost: the global counter runs, and has passed 32 with Clyde outside
    house.state.globalCounterActive = true;
    house.state.globalCounter = 40;
    // Clyde back home (eaten earlier); Pinky and Inky out in the maze
    agent.scenario({
      ghosts: {
        CLYDE: { col: 13, row: 17, location: "HOUSE", dir: "UP" },
        PINKY: { col: 6, row: 8, dir: "LEFT" },
        INKY: { col: 21, row: 8, dir: "RIGHT" },
      },
    });
    // Pac-Man eats a dot every few frames along row 32, so the idle timer never fires
    agent.scenario({ pacman: { col: 1, row: 32, dir: "RIGHT" } });
    for (let c = 2; c <= 26; c++) e.maze.tiles[32][c] = "DOT";
    agent.runUntil((v) => v.pacman.col === 26, 400);
    expect(e.ghosts.CLYDE.location).toBe("HOUSE"); // the counter is past 32: nothing releases him
    expect(house.state.globalCounterActive).toBe(true);
    // Stop eating: the idle timer frees him
    agent.runUntil((v) => v.ghosts.CLYDE.location !== "HOUSE", 5 * 60);
    expect(e.ghosts.CLYDE.location).not.toBe("HOUSE");
  });
});

describe("Dossier · Home Sweet Home (after a death)", () => {
  it("a life lost disables the personal counters but does not reset them; the global one starts at 0", () => {
    const agent = playing();
    const e = agent.engine;
    const house = e.houseController;
    house.state.dotCounters = { PINKY: 0, INKY: 12, CLYDE: 5 };
    house.onLifeLost();
    expect(house.state.dotCounters).toEqual({ PINKY: 0, INKY: 12, CLYDE: 5 });
    expect(house.state).toMatchObject({ globalCounterActive: true, globalCounter: 0 });
    // Dots now count on the global counter only
    house.onDotEaten(e.ghosts);
    expect(house.state.globalCounter).toBe(1);
    expect(house.state.dotCounters).toEqual({ PINKY: 0, INKY: 12, CLYDE: 5 });
  });
});
