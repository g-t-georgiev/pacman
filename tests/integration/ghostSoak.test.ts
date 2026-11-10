import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { SimRandom } from "../../src/core/SimRandom";
import type { Direction, GhostType } from "../../src/types";

/**
 * Long runs with random joystick input and an invincible Pac-Man: every ghost keeps moving, never
 * stands inside a wall, and no diagnostics rule fails. Guards the tile-entry/tile-center decision
 * timing (F14) against stuck or wall-walking ghosts over many reversals and frightened periods.
 */
describe("Ghost movement soak", () => {
  it.each([1, 5])("level %i: 20k frames of random play", (level) => {
    const engine = new GameEngine("PACMAN", 0);
    const agent = new AgentDriver(engine);
    engine.settings.invincible = true;
    agent.scenario({ level, playState: "PLAYING" });
    engine.pacman.invincible = true;

    const rng = new SimRandom();
    const dirs: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
    const lastMove: Record<GhostType, number> = { BLINKY: 0, PINKY: 0, INKY: 0, CLYDE: 0 };
    const lastPos: Record<GhostType, string> = { BLINKY: "", PINKY: "", INKY: "", CLYDE: "" };

    let f = 0; // play frames only (pauses and freezes don't count as being stuck)
    for (let frame = 0; frame < 20_000; frame++) {
      if (frame % 45 === 0) agent.input(dirs[rng.nextInt(4)]);
      // Keep the round going: refill nothing, just restart the level when it is cleared
      if (engine.playState === "LEVEL_CLEAR" && engine.phase === "MAZE_FLASH") {
        agent.scenario({ level, playState: "PLAYING" });
        engine.pacman.invincible = true;
      }
      agent.step(1);
      if (engine.phase !== "PLAYING") continue;
      f++;

      for (const g of Object.values(engine.ghosts)) {
        const pos = `${g.x},${g.y}`;
        if (pos !== lastPos[g.type]) {
          lastPos[g.type] = pos;
          lastMove[g.type] = f;
        }
        if (g.location !== "ACTIVE") {
          lastMove[g.type] = f; // waiting in the house is fine
          continue;
        }
        const { col, row } = g.tileCoord;
        const tile = engine.maze.tiles[row]?.[col];
        expect(tile, `${g.type} inside a wall at (${col}, ${row}) on frame ${f}`).not.toBe("WALL");
        expect(f - lastMove[g.type], `${g.type} stuck at (${col}, ${row})`).toBeLessThan(60);
      }
    }
    expect(agent.diagnostics().failing).toEqual([]);
    // Every turn came from a plan; the wall safety net never had to step in
    expect(engine.movementController.fallbackTurns).toBe(0);
  });
});
