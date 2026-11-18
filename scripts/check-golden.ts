/// <reference types="node" />
// Pre-commit check (.vite-hooks/pre-commit): the golden replays still play back exactly, and
// were recorded with this build's versions. A failure means the rules changed: if that was
// intended, `vp run golden:update` re-records them and bumps the version; if not, it's a bug.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import GameEngine from "../src/game/GameEngine";
import { type Replay, RULES_VERSION, playReplay } from "../src/game/replay";
import { GAME_STATE_VERSION } from "../src/game/gameState";
import { GOLDEN_DIR } from "./goldenVersions";

const problems: string[] = [];
for (const name of readdirSync(GOLDEN_DIR).filter((f) => f.endsWith(".json"))) {
  const replay = JSON.parse(readFileSync(join(GOLDEN_DIR, name), "utf8")) as Replay;
  if (replay.made?.rules !== RULES_VERSION || replay.made?.state !== GAME_STATE_VERSION) {
    problems.push(
      `${name}: recorded with rules ${replay.made?.rules} / state ${replay.made?.state}, this build is rules ${RULES_VERSION} / state ${GAME_STATE_VERSION}`
    );
    continue;
  }
  let result;
  try {
    result = playReplay(new GameEngine(replay.start.mode, 0), replay);
  } catch (error) {
    problems.push(`${name}: could not be played (${String(error)})`);
    continue;
  }
  if (!result.matched) {
    problems.push(
      `${name}: plays differently between tick ${result.lastMatchedAt ?? replay.start.tick} and ${result.divergedAt}`
    );
  }
}

if (problems.length > 0) {
  console.error("Golden replays don't match this build:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "If the rules change is intended: vp run golden:update (re-records and bumps the version), then commit.\n" +
      "If not, it's a regression: see the tick above (pacmanAgent.loadReplay can stop there)."
  );
  process.exit(1);
}
console.log("Golden replays match.");
