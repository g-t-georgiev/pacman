import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { sirenStage } from "../../src/game/siren";
import { playing } from "../helpers";
import { faceBlinky } from "../helpers";

describe("Siren (S1)", () => {
  it("steps through five stages as the maze empties", () => {
    expect([0, 47, 48, 96, 144, 192, 239, 240].map((eaten) => sirenStage(eaten, 240))).toEqual([
      0, 0, 1, 2, 3, 4, 4, 4,
    ]);
  });

  it("follows the dots in play", () => {
    const agent = playing();
    const e = agent.engine;
    expect(e.getSirenState()).toEqual({ kind: "NORMAL", stage: 0 });
    agent.scenario({ dotsRemaining: Math.floor(e.totalDots * 0.3) });
    expect(e.getSirenState()).toEqual({ kind: "NORMAL", stage: 3 });
  });

  it("is off outside play: READY, paused, the ghost-eaten pause, deaths", () => {
    const fresh = new GameEngine("PACMAN", 0);
    expect(fresh.phase).toBe("READY");
    expect(fresh.getSirenState()).toEqual({ kind: "OFF" });

    const agent = playing();
    const e = agent.engine;
    agent.pause();
    // pause() holds the runner; with no runner the agent sets the engine flag
    if (!e.paused) e.paused = true;
    expect(e.getSirenState()).toEqual({ kind: "OFF" });
    e.paused = false;

    agent.scenario({
      frightened: true,
      pacman: { col: 6, row: 8, dir: "LEFT" },
      ghosts: { BLINKY: { col: 6, row: 8 } },
    });
    expect(e.getSirenState()).toEqual({ kind: "FRIGHTENED" });
    e.update(); // Blinky eaten: the pause starts, with the eat sound alone
    expect(e.phase).toBe("GHOST_EATEN_PAUSE");
    expect(e.getSirenState()).toEqual({ kind: "OFF" });
    agent.runUntil((v) => v.phase === "PLAYING", 120);
    expect(e.getSirenState()).toEqual({ kind: "EYES" }); // eyes win over frightened
  });

  it("frightened ends back on the normal siren once no eyes are travelling", () => {
    const agent = playing();
    const e = agent.engine;
    agent.scenario({ frightened: true });
    agent.runUntil((v) => !Object.values(v.ghosts).some((g) => g.mode === "FRIGHTENED"), 1200);
    expect(e.getSirenState().kind).toBe("NORMAL");
  });
});

describe("Start tune (S2)", () => {
  it("a new game and a restarted level ask for the tune; a death does not", () => {
    const e = new GameEngine("PACMAN", 0);
    e.drainEvents();
    e.initGame("PACMAN", 1);
    expect(e.drainEvents().map((ev) => ev.type)).toContain("INTRO");
    e.restartLevel();
    expect(e.drainEvents().map((ev) => ev.type)).toContain("INTRO");

    const agent = new AgentDriver(e);
    agent.scenario({ playState: "PLAYING" });
    faceBlinky(agent);
    const { events } = agent.runUntil((v) => v.phase === "READY", 600);
    expect(events.map((ev) => ev.type)).not.toContain("INTRO");
  });
});
