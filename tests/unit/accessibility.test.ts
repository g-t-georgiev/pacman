import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import {
  frightenedColors,
  frightenedEnding,
  ghostBodyColor,
  mazeFlashWallColor,
} from "../../src/game/accessibility";
import { DEFAULT_BINDINGS, directionForKey, keyLabel, rebind } from "../../src/utils/keyBindings";

describe("Key bindings (Phase 5)", () => {
  it("defaults to arrows and WASD, letters in either case", () => {
    expect(directionForKey(DEFAULT_BINDINGS, "ArrowLeft")).toBe("LEFT");
    expect(directionForKey(DEFAULT_BINDINGS, "W")).toBe("UP");
    expect(directionForKey(DEFAULT_BINDINGS, "x")).toBeNull();
  });

  it("rebinding moves a key: it never means two directions", () => {
    const next = rebind(DEFAULT_BINDINGS, "UP", 1, "a")!; // A was Left's second key
    expect(directionForKey(next, "a")).toBe("UP");
    expect(next.LEFT).toEqual(["ArrowLeft", ""]);
    expect(keyLabel(next.LEFT[1])).toBe("—");
    expect(DEFAULT_BINDINGS.LEFT).toEqual(["ArrowLeft", "a"]); // the defaults are untouched
  });

  it("refuses the keys the game needs (Space, Escape, ...)", () => {
    expect(rebind(DEFAULT_BINDINGS, "UP", 0, " ")).toBeNull();
    expect(rebind(DEFAULT_BINDINGS, "UP", 0, "Escape")).toBeNull();
  });
});

describe("Display options (Phase 5)", () => {
  it("the colorblind palette changes ghost and frightened colors only when on", () => {
    const e = new GameEngine("PACMAN", 0);
    expect(ghostBodyColor("BLINKY", e.settings)).toBe("#FF0000");
    expect(frightenedColors(e.settings).body).toBe("#2121ff");
    e.settings.colorblindPalette = true;
    const colors = (["BLINKY", "PINKY", "INKY", "CLYDE"] as const).map((t) =>
      ghostBodyColor(t, e.settings)
    );
    expect(new Set(colors).size).toBe(4);
    expect(colors).not.toContain("#FF0000");
    expect(frightenedColors(e.settings).body).not.toBe(ghostBodyColor("INKY", e.settings));
  });

  it("reduced flashing: a steady maze color through the whole level-clear flash", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    const e = agent.engine;
    agent.scenario({ phase: "PLAYING", dotsRemaining: 1 });
    const last = e.maze.tiles.flatMap((row, r) =>
      row.flatMap((t, c) => (t === "DOT" || t === "ENERGIZER" ? [{ col: c, row: r }] : []))
    )[0];
    agent.scenario({ pacman: { col: last.col, row: last.row } });
    agent.runUntil((v) => v.phase === "MAZE_FLASH", 200);

    const strobe = new Set<string | null>();
    const steady = new Set<string | null>();
    while (e.phase === "MAZE_FLASH") {
      e.settings.reducedFlash = false;
      strobe.add(mazeFlashWallColor(e));
      e.settings.reducedFlash = true;
      steady.add(mazeFlashWallColor(e));
      e.update();
    }
    expect(strobe).toEqual(new Set(["#ffffff", null])); // white, then the maze's own color
    expect(steady.size).toBe(1);
  });

  it("knows when frightened is in its last stretch (for the steady outline)", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    agent.scenario({ phase: "PLAYING", frightened: true });
    const e = agent.engine;
    expect(frightenedEnding(e)).toBe(false);
    agent.runUntil(() => frightenedEnding(e), 1200);
    expect(e.frightenedGlobalTimer).toBeGreaterThan(0);
  });

  it("display options are not sim settings: replays don't depend on them", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    agent.scenario({ phase: "PLAYING" });
    agent.advance(60);
    const replay = agent.saveReplay();
    agent.engine.settings.reducedFlash = true;
    agent.engine.settings.colorblindPalette = true;
    expect(agent.verifyReplay(replay).matched).toBe(true);
    expect(Object.keys(replay.settings)).not.toContain("reducedFlash");
  });
});
