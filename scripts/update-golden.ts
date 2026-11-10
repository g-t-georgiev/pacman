/// <reference types="node" />
// Re-records the golden replays (plan T5). Run after an intentional mechanics change:
//   vp run golden:update
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GOLDEN_SCENARIOS } from "../tests/golden/scenarios";

const dir = join(import.meta.dirname, "..", "tests", "golden");
mkdirSync(dir, { recursive: true });

for (const scenario of GOLDEN_SCENARIOS) {
  const replay = scenario.record();
  const file = join(dir, `${scenario.name}.json`);
  writeFileSync(file, JSON.stringify(replay) + "\n");
  console.log(
    `${scenario.name}: ${replay.endTick} ticks, ${replay.inputs.length} inputs, ${replay.checkpoints.length} checkpoints -> ${file}`
  );
}
