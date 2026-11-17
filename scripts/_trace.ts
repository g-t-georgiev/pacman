/// <reference types="node" />
// Play trace of every golden: what a player could see, every 60 ticks (for P2's proof).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import GameEngine from "../src/game/GameEngine";
import { type Replay, playReplay } from "../src/game/replay";
const out: Record<string, string[]> = {};
for (const f of readdirSync("tests/golden").filter((n) => n.endsWith(".json"))) {
  const replay = JSON.parse(readFileSync(`tests/golden/${f}`, "utf8")) as Replay;
  const e = new GameEngine(replay.start.mode, 0);
  const rows: string[] = [];
  playReplay(e, replay, () => {
    e.drainEvents();
    if (e.tick % 60 !== 0) return;
    const g = Object.values(e.ghosts)
      .map((x) => `${x.type}:${x.x},${x.y},${x.dir},${x.mode},${x.location}`)
      .join(" ");
    rows.push(
      `${e.tick} ${e.phase} s${e.score} l${e.lives} L${e.level} d${e.dotsRemaining} p${e.pacman.x},${e.pacman.y},${e.pacman.dir} ${g}`
    );
  });
  out[f] = rows;
}
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(
  Object.entries(out)
    .map(([k, v]) => `${k}:${v.length}`)
    .join(" ")
);
