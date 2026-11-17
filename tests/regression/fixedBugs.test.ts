import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { HouseController } from "../../src/controllers/HouseController";
import { faceBlinky, playing, randomInput } from "../helpers";

/**
 * Regression suite (plan T6), part 2: one test per bug fixed so far, named after what went
 * wrong, so it can't come back unnoticed. Every new bug fix adds its test here.
 */

function live(): { engine: GameEngine; runner: GameRunner; agent: AgentDriver } {
  const engine = new GameEngine("PACMAN", 0);
  const runner = new GameRunner(engine);
  const agent = new AgentDriver(engine, runner);
  agent.scenario({ playState: "PLAYING" });
  return { engine, runner, agent };
}

/** Random play with one life until game over; returns the tick of the fatal collision. */
function playToGameOver(agent: AgentDriver): number {
  const e = agent.engine;
  e.lives = 1;
  const input = randomInput(7, 20);
  let deathTick = -1;
  for (let i = 0; i < 20000 && e.phase !== "GAME_OVER"; i++) {
    const dir = input(e.tick + 1);
    if (dir) e.setInputDirection(dir);
    e.update();
    if (deathTick < 0 && e.phase === "DEATH_FREEZE") deathTick = e.tick;
  }
  return deathTick;
}

describe("Fixed bugs (regression)", () => {
  it("2026-11-11: ghosts (and Pac-Man) reappeared at game over", () => {
    const agent = playing(1);
    agent.engine.lives = 1;
    faceBlinky(agent);
    agent.runUntil((v) => v.phase === "GAME_OVER", 600);
    agent.advance(120);
    expect(agent.engine.ghostsVisible).toBe(false);
    expect(agent.engine.pacmanVisible).toBe(false);
  });

  it("2026-11-12: setting playState or starting a game released the agent's hold", () => {
    const { engine, runner, agent } = live();
    agent.pause();
    agent.scenario({ playState: "PLAYING" });
    engine.initGame("PACMAN", 1);
    const tick = engine.tick;
    for (let i = 0; i < 30; i++) runner.tick();
    expect(engine.tick).toBe(tick);
  });

  it("2026-11-12: frame stepping stopped working once holds were re-applied every frame", () => {
    const { engine, runner } = live();
    runner.setPaused("panel", true);
    const tick = engine.tick;
    expect(runner.stepWhilePaused(10)).toBe(10);
    expect(engine.tick).toBe(tick + 10);
    expect(engine.paused).toBe(true);
  });

  it("2026-11-12: R after a game over landed inside the death animation", () => {
    const agent = playing(1);
    const deathTick = playToGameOver(agent);
    const e = agent.engine;
    e.rewindBeforeDeath(2);
    expect(e.phase).toBe("PLAYING");
    expect(e.tick).toBeLessThan(deathTick);
  });

  it("2026-11-11: the Restart panel stayed open after rewinding out of a game over", () => {
    const agent = playing(1);
    playToGameOver(agent);
    agent.events();
    agent.engine.rewindSeconds(6);
    const rewound = agent.engine.drainEvents().find((ev) => ev.type === "REWOUND");
    expect(rewound).toMatchObject({ type: "REWOUND" });
  });

  it("2026-11-12: Restart Level kept the global dot counter and Elroy suspension of a death", () => {
    const agent = playing(3);
    faceBlinky(agent);
    agent.runUntil((v) => v.phase === "READY", 600);
    expect(agent.engine.houseController.state.globalCounterActive).toBe(true);
    agent.engine.restartLevel();
    expect(agent.engine.houseController.state).toEqual(HouseController.initialState());
  });

  it("2026-11-12: house releases follow the Dossier: in order, one per frame, no door wait", () => {
    const e = new GameEngine("PACMAN", 0);
    e.initGame("PACMAN", 3); // every dot limit is 0
    const order: Array<[string, number]> = [];
    for (let i = 0; i < 400 && order.length < 3; i++) {
      e.update();
      for (const g of ["PINKY", "INKY", "CLYDE"] as const) {
        if (e.ghosts[g].location !== "HOUSE" && !order.some(([n]) => n === g)) {
          order.push([g, e.tick]);
        }
      }
    }
    expect(order.map(([g]) => g)).toEqual(["PINKY", "INKY", "CLYDE"]);
    expect(order[1][1] - order[0][1]).toBe(1);
    expect(order[2][1] - order[1][1]).toBe(1);
  });

  it("2026-11-12: the no-dot timer kept time from before a death", () => {
    const agent = playing(1);
    agent.advance(200);
    faceBlinky(agent);
    agent.runUntil((v) => v.phase === "READY", 600);
    expect(agent.engine.houseController.state.idleFrames).toBe(0);
  });

  it("2026-11-11: a paused flag in the saved state broke exact restores", () => {
    expect(Object.keys(new GameEngine("PACMAN", 0).getState())).not.toContain("paused");
  });

  it("2026-11-09: paused frames advanced the frame counter and shifted the speed masks", () => {
    const agent = playing(1);
    const e = agent.engine;
    const frame = e.currLevelFrame;
    e.paused = true;
    for (let i = 0; i < 10; i++) e.update();
    expect(e.currLevelFrame).toBe(frame);
  });

  it("2026-11-12: the eyes siren played over the eat-ghost sound during the eat pause", () => {
    const agent = playing(1);
    agent.scenario({
      frightened: true,
      pacman: { col: 6, row: 8, dir: "LEFT" },
      ghosts: { BLINKY: { col: 6, row: 8, dir: "RIGHT" } },
    });
    agent.engine.update();
    expect(agent.engine.phase).toBe("GHOST_EATEN_PAUSE");
    expect(agent.engine.getSirenState()).toEqual({ kind: "OFF" });
  });

  it("2026-11-12: Pac-Man started each life half open (he starts as a closed circle)", () => {
    const agent = playing(1);
    agent.advance(30);
    faceBlinky(agent);
    agent.runUntil((v) => v.phase === "READY", 600);
    expect(agent.engine.pacman.mouthFrame).toBe(0);
  });

  it("2026-11-12: the start tune is for fresh starts only, not after a death", () => {
    const agent = playing(1);
    faceBlinky(agent);
    const { events } = agent.runUntil((v) => v.phase === "READY", 600);
    expect(events.map((ev) => ev.type)).not.toContain("INTRO");
  });

  it("2026-11-11: ghosts inside the house didn't turn blue on an energizer (F8)", () => {
    const agent = playing(1);
    agent.scenario({ frightened: true });
    const inside = Object.values(agent.engine.ghosts).filter((g) => g.inHouse);
    expect(inside.length).toBeGreaterThan(0);
    for (const g of inside) expect(g.mode).toBe("FRIGHTENED");
  });
});
