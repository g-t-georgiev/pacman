import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { SimRandom } from "../../src/core/SimRandom";
import type { Direction } from "../../src/types";

/**
 * Plays with random input (Pac-Man invincible), records every actor's movement with the agent
 * driver's speed recorder, and checks each speed source against the level's table: measured
 * px/frame must match pct / 80 (80% = 1 px every frame) within the 16-frame mask's rounding.
 */
function play(level: number, frames: number): AgentDriver {
  const engine = new GameEngine("PACMAN", 0);
  const agent = new AgentDriver(engine);
  engine.settings.invincible = true;
  agent.scenario({ level, playState: "PLAYING" });
  engine.pacman.invincible = true;
  agent.recordSpeeds();
  const rng = new SimRandom();
  const dirs: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  for (let f = 0; f < frames; f++) {
    if (f % 40 === 0) agent.input(dirs[rng.nextInt(4)]);
    agent.advance(1);
    if (engine.phase === "MAZE_FLASH" || engine.phase === "GAME_OVER") {
      agent.scenario({ level, playState: "PLAYING" });
      engine.pacman.invincible = true;
    }
  }
  return agent;
}

describe("Measured speeds match the Dossier speed tables", () => {
  it.each([1, 2, 5, 21])("level %i", (level) => {
    const report = play(level, 12_000).speedReport()!;
    // House and eyes have no Dossier speed (eyes also slow down while lining up at the door)
    const sampled = report.rows.filter(
      (r) => r.frames >= 160 && r.source !== "ghost-house" && r.source !== "ghost-eyes"
    );
    expect(sampled.length).toBeGreaterThan(4);
    for (const row of sampled) {
      expect(row.ratio, `${row.actor} ${row.source} ${row.pct}%`).toBeGreaterThan(0.97);
      expect(row.ratio, `${row.actor} ${row.source} ${row.pct}%`).toBeLessThan(1.03);
    }
    // Pac-Man outruns a normal ghost up to level 20; from 21 on the table has ghosts faster
    if (level > 20) return;
    const pac = report.rows.find((r) => r.actor === "PACMAN" && r.source === "pacman-normal")!;
    const ghost = report.rows.find((r) => r.source === "ghost-normal")!;
    expect(pac.measuredPxPerFrame).toBeGreaterThan(ghost.measuredPxPerFrame);
  });
});
