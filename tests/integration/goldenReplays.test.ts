/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { type Replay, playReplay } from "../../src/game/replay";
import { GOLDEN_SCENARIOS } from "../golden/scenarios";

/**
 * Every stored golden replay, by file name without the extension. Read from disk at run time,
 * not with import.meta.glob: Vitest's module cache would keep the old file list after a golden
 * is added.
 */
const dir = join(import.meta.dirname, "..", "golden");
const goldens = new Map(
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [
      f.replace(/\.json$/, ""),
      JSON.parse(readFileSync(join(dir, f), "utf8")) as Replay,
    ])
);

/**
 * Golden replays (plan T5): each stored replay must reproduce its recorded game exactly. A
 * failure names the first second (60-tick checkpoint) whose full-state hash changed. If the
 * change was intended, re-record with `vp run golden:update` and commit the files.
 */
describe("Golden replays", () => {
  it("every scenario has a recorded replay, and every replay a scenario", () => {
    expect([...goldens.keys()].sort()).toEqual(GOLDEN_SCENARIOS.map((s) => s.name).sort());
  });

  it.each(GOLDEN_SCENARIOS.map((s) => [s.name, s.description]))("%s: %s", (name) => {
    const replay = goldens.get(name)!;
    const result = playReplay(new GameEngine(replay.start.mode, 0), replay);
    expect(
      result.divergedAt,
      `diverged between tick ${result.lastMatchedAt ?? replay.start.tick} and ${result.divergedAt}` +
        " (if intended: vp run golden:update)"
    ).toBeNull();
    expect(result.ticks).toBe(replay.endTick - replay.start.tick);
  });
});
