/// <reference types="node" />
// Play trace of every golden replay: what a player could see, every second (60 ticks): phase,
// score, lives, level, dots left, Pac-Man's and each ghost's position, direction, mode and place.
//
// It proves a change plays identically even when the saved state's format changes (and with it
// every checkpoint hash). Run it before and after, then compare:
//   vp run golden:trace -- before.json
//   ... make the change, vp run golden:update ...
//   vp run golden:trace -- after.json --compare before.json
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import GameEngine from "../src/game/GameEngine";
import { type Replay, playReplay } from "../src/game/replay";

const [outFile, flag, baseline] = process.argv.slice(2).filter((a) => a !== "--");
if (!outFile) {
  console.error("usage: vp run golden:trace -- <out.json> [--compare <baseline.json>]");
  process.exit(2);
}

const traces: Record<string, string[]> = {};
for (const file of readdirSync("tests/golden").filter((n) => n.endsWith(".json"))) {
  const replay = JSON.parse(readFileSync(`tests/golden/${file}`, "utf8")) as Replay;
  const e = new GameEngine(replay.start.mode, 0);
  const rows: string[] = [];
  playReplay(e, replay, () => {
    e.drainEvents();
    if (e.tick % 60 !== 0) return;
    const ghosts = Object.values(e.ghosts)
      .map((g) => `${g.type}:${g.x},${g.y},${g.dir},${g.mode},${g.location}`)
      .join(" ");
    rows.push(
      `${e.tick} ${e.phase} s${e.score} l${e.lives} L${e.level} d${e.dotsRemaining} ` +
        `p${e.pacman.x},${e.pacman.y},${e.pacman.dir} ${ghosts}`
    );
  });
  traces[file] = rows;
}
writeFileSync(outFile, JSON.stringify(traces));
const total = Object.values(traces).reduce((n, rows) => n + rows.length, 0);
console.log(`${Object.keys(traces).length} goldens, ${total} samples -> ${outFile}`);

if (flag === "--compare" && baseline) {
  const before = JSON.parse(readFileSync(baseline, "utf8")) as Record<string, string[]>;
  let differences = 0;
  for (const [file, rows] of Object.entries(before)) {
    const after = traces[file] ?? [];
    if (after.length !== rows.length) {
      console.error(`${file}: ${rows.length} samples before, ${after.length} now`);
      differences++;
      continue;
    }
    rows.forEach((row, i) => {
      if (row === after[i]) return;
      differences++;
      if (differences <= 3) console.error(`${file} #${i}\n  before ${row}\n  now    ${after[i]}`);
    });
  }
  console.log(differences === 0 ? "Identical play." : `${differences} samples differ.`);
  process.exit(differences === 0 ? 0 : 1);
}
