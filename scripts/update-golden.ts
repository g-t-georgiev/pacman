/// <reference types="node" />
// Re-records the golden replays (plan T5). Run after an intentional mechanics change:
//   vp run golden:update
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GOLDEN_SCENARIOS } from "../tests/golden/scenarios";
import { type Replay, RULES_VERSION } from "../src/game/replay";
import { GAME_STATE_VERSION } from "../src/game/gameState";

const dir = join(import.meta.dirname, "..", "tests", "golden");
mkdirSync(dir, { recursive: true });

let refused = 0;
for (const scenario of GOLDEN_SCENARIOS) {
  const replay = scenario.record();
  const file = join(dir, `${scenario.name}.json`);
  // The play changed but the versions did not: replays made before this change would be
  // reported as matching. Bump RULES_VERSION (or GAME_STATE_VERSION for a new state shape).
  if (existsSync(file)) {
    const old = JSON.parse(readFileSync(file, "utf8")) as Replay;
    const sameVersions =
      old.made?.rules === RULES_VERSION && old.made?.state === GAME_STATE_VERSION;
    if (sameVersions && JSON.stringify(old.checkpoints) !== JSON.stringify(replay.checkpoints)) {
      console.error(
        `${scenario.name}: play changed but RULES_VERSION (${RULES_VERSION}) and GAME_STATE_VERSION (${GAME_STATE_VERSION}) did not. Bump one, then re-run.`
      );
      refused++;
      continue;
    }
  }
  writeFileSync(file, JSON.stringify(replay) + "\n");
  console.log(
    `${scenario.name}: ${replay.endTick} ticks, ${replay.inputs.length} inputs, ${replay.checkpoints.length} checkpoints -> ${file}`
  );
}
if (refused > 0) process.exit(1);
