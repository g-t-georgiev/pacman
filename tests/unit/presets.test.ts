import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { RULES_PRESETS, applyRulesPreset } from "../../src/game/presets";

describe("Rules presets (Phase 5)", () => {
  it("Arcade is the default; Modern drops the quirk and runs at 60 Hz", () => {
    const e = new GameEngine("PACMAN", 0);
    expect(e.rules.emulateRomQuirks).toBe(RULES_PRESETS.ARCADE.settings.rules.emulateRomQuirks);
    expect(e.settings.arcadeRefreshRate).toBe(
      RULES_PRESETS.ARCADE.settings.settings.arcadeRefreshRate
    );
    applyRulesPreset(e, "MODERN");
    expect(e.rules.emulateRomQuirks).toBe(false);
    expect(e.ghostAiController.emulateRomQuirks).toBe(false);
    expect(new GameRunner(e).ticksPerSecond).toBe(60);
    applyRulesPreset(e, "ARCADE");
    expect(e.ghostAiController.emulateRomQuirks).toBe(true);
    expect(new GameRunner(e).ticksPerSecond).toBeCloseTo(60.606, 2);
  });
});

describe("Release clears the turn (joystick feel)", () => {
  /** Pac-Man heading left on row 26 from col 10, a turn up queued ~30 frames before the junction. */
  function queuedTurn(releaseClears: boolean) {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    const e = agent.engine;
    e.settings.releaseClearsBuffer = releaseClears;
    agent.scenario({ playState: "PLAYING", pacman: { col: 10, row: 26, dir: "LEFT" } });
    e.setInputDirection("UP");
    agent.step(1);
    e.releaseInputDirection("UP");
    return { agent, e };
  }

  it("off (default): the queued turn waits for the next junction", () => {
    const { e } = queuedTurn(false);
    expect(e.pacman.nextDir).toBe("UP");
  });

  it("on: letting go forgets the turn, Pac-Man keeps going, and the replay stays exact", () => {
    const { agent, e } = queuedTurn(true);
    expect(e.pacman.nextDir).toBe("NONE");
    expect(e.pacman.dir).toBe("LEFT");
    agent.step(120);
    const replay = agent.saveReplay();
    expect(replay.inputs.map(([, d]) => d)).toContain("NONE");
    expect(agent.verifyReplay(replay).matched).toBe(true);
  });

  it("letting go of a direction he is already moving in changes nothing", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    const e = agent.engine;
    e.settings.releaseClearsBuffer = true;
    agent.scenario({ playState: "PLAYING", pacman: { col: 21, row: 26, dir: "LEFT" } });
    e.setInputDirection("LEFT");
    agent.step(1);
    const inputs = agent.saveReplay().inputs.length;
    e.releaseInputDirection("LEFT");
    expect(agent.saveReplay().inputs.length).toBe(inputs);
  });
});
