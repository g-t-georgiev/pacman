import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";
import { AgentDriver } from "../../src/agent/AgentDriver";
import GameEvents from "../../src/core/EventBus";
import type { PlayState } from "../../src/types";

function live(): { runner: GameRunner; agent: AgentDriver; engine: GameEngine } {
  const engine = new GameEngine("PACMAN", 0);
  engine.playState = "PLAYING";
  const runner = new GameRunner(engine);
  const agent = new AgentDriver(engine, runner);
  return { runner, agent, engine };
}

describe("One pause owner (T11)", () => {
  it("the game runs only when nobody holds it", () => {
    const { runner, engine } = live();
    runner.setPaused("user", true);
    runner.setPaused("panel", true);
    expect(engine.playState).toBe("PAUSED");

    runner.setPaused("panel", false); // closing a panel...
    expect(engine.playState).toBe("PAUSED"); // ...does not resume a game the player paused
    expect(runner.pausedBy).toEqual(["user"]);

    runner.setPaused("user", false);
    expect(engine.playState).toBe("PLAYING");
    expect(runner.pausedBy).toEqual([]);
  });

  it("the agent's pause is its own: resume() leaves the player's pause alone", () => {
    const { runner, agent, engine } = live();
    runner.setPaused("user", true);
    agent.pause();
    expect(agent.view().pausedBy.sort()).toEqual(["agent", "user"]);
    agent.resume();
    expect(engine.paused).toBe(true);
    expect(agent.view().pausedBy).toEqual(["user"]);
  });

  it("the agent steps a held game frame by frame, and it stays held", () => {
    const { runner, agent, engine } = live();
    runner.setPaused("panel", true);
    const tick = engine.tick;
    agent.step(10);
    expect(engine.tick).toBe(tick + 10);
    expect(engine.paused).toBe(true);
    runner.tick(); // the real-time loop still sees a held game
    expect(engine.tick).toBe(tick + 10);
  });

  it("round changes reach the UI as ROUND_STATE_CHANGED; pauses do not", () => {
    const { runner, agent } = live();
    const seen: PlayState[] = [];
    const listener = (e: CustomEvent<PlayState>) => seen.push(e.detail);
    GameEvents.on("ROUND_STATE_CHANGED", listener);
    try {
      runner.setPaused("user", true);
      runner.setPaused("user", false);
      expect(seen).toEqual([]);

      // Walk Pac-Man into Blinky: a death is a round change
      const b = agent.view().ghosts.BLINKY;
      agent.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } });
      agent.runUntil((v) => v.playState === "DYING", 30);
      expect(seen).toContain("DYING");
    } finally {
      GameEvents.off("ROUND_STATE_CHANGED", listener);
    }
  });
});
