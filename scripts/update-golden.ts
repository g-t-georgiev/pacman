/// <reference types="node" />
// Re-records the golden replays (plan T5) after an intended change to what a tick does:
//   vp run golden:update
//
// It also keeps the replay versions honest, so nobody has to remember to:
// - the saved state's shape changed (a field added, removed, renamed) -> GAME_STATE_VERSION + 1
// - otherwise, the recorded play changed (any checkpoint hash)          -> RULES_VERSION + 1
// A golden that already carries other versions (bumped by hand) needs no further bump. Comments,
// formatting, renames and refactors never change a hash, so they never bump anything.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { GOLDEN_SCENARIOS } from "../tests/golden/scenarios";
import { type Replay, RULES_VERSION } from "../src/game/replay";
import { GAME_STATE_VERSION } from "../src/game/gameState";
import { GOLDEN_DIR, bumpConstant, sameShape } from "./goldenVersions";

mkdirSync(GOLDEN_DIR, { recursive: true });

const recorded = GOLDEN_SCENARIOS.map((scenario) => {
  const file = join(GOLDEN_DIR, `${scenario.name}.json`);
  const old = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Replay) : null;
  return { scenario, file, old, replay: scenario.record() };
});

// Decide the bumps across all goldens first: one bump per run, whatever the number of files
let shapeChanged = false;
let playChanged = false;
for (const { scenario, old, replay } of recorded) {
  if (!old?.made) continue; // new golden, or a format-1 file: nothing to compare with
  const sameVersions = old.made.rules === RULES_VERSION && old.made.state === GAME_STATE_VERSION;
  if (!sameVersions) continue;
  // As saved: JSON drops undefined fields, which the live state may still have
  if (!sameShape(old.start, JSON.parse(JSON.stringify(replay.start)))) {
    shapeChanged = true;
    console.log(`${scenario.name}: the saved state's shape changed`);
  } else if (JSON.stringify(old.checkpoints) !== JSON.stringify(replay.checkpoints)) {
    playChanged = true;
    const at = replay.checkpoints.find(([, h], i) => old.checkpoints[i]?.[1] !== h)?.[0];
    console.log(`${scenario.name}: play changed (first differing checkpoint: tick ${at})`);
  }
}

if (shapeChanged || playChanged) {
  if (shapeChanged) {
    const next = bumpConstant("src/game/gameState.ts", "GAME_STATE_VERSION");
    console.log(`GAME_STATE_VERSION ${GAME_STATE_VERSION} -> ${next} (src/game/gameState.ts)`);
  } else {
    const next = bumpConstant("src/game/replay.ts", "RULES_VERSION");
    console.log(`RULES_VERSION ${RULES_VERSION} -> ${next} (src/game/replay.ts)`);
  }
  // This process still has the old version loaded, and the state version is part of every state
  // (and so of every checkpoint hash): record in a fresh process that loads the new one. Its
  // goldens carry the old versions, so it sees nothing more to bump.
  console.log("Re-recording with the new version...");
  const run = spawnSync("vpx ./scripts/update-golden.ts", { stdio: "inherit", shell: true });
  if (run.status === 0)
    console.log("Commit the bumped version together with the re-recorded goldens.");
  process.exit(run.status ?? 1);
}

for (const { scenario, file, replay } of recorded) {
  writeFileSync(file, JSON.stringify(replay) + "\n");
  console.log(
    `${scenario.name}: ${replay.endTick} ticks, ${replay.inputs.length} inputs, ${replay.checkpoints.length} checkpoints -> ${file}`
  );
}
