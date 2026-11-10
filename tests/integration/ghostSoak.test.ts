import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { SimRandom } from "../../src/core/SimRandom";
import type { Direction, GhostType } from "../../src/types";
import { getOppositeDirection } from "../../src/game/ghostAiUtils";
import { TILE_SIZE } from "../../src/game/constants";

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
    // Previous play frame per ghost, for the reversal check
    const prev = new Map<GhostType, { dir: Direction; tile: string }>();
    let reversals = 0;

    let f = 0; // play frames only (pauses and freezes don't count as being stuck)
    for (let frame = 0; frame < 20_000; frame++) {
      if (frame % 45 === 0) agent.input(dirs[rng.nextInt(4)]);
      // Keep the round going: refill nothing, just restart the level when it is cleared
      if (engine.playState === "LEVEL_CLEAR" && engine.phase === "MAZE_FLASH") {
        agent.scenario({ level, playState: "PLAYING" });
        engine.pacman.invincible = true;
        prev.clear();
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
          prev.delete(g.type);
          continue;
        }
        const { col, row } = g.tileCoord;
        // Dossier: a ghost obeys a reversal on entering a new tile, never in the middle of one.
        // So it turns around at a tile boundary: at most 2 px past it (the most a ghost moves
        // in one frame, e.g. entering, reversing and stepping back on a 2-px frame).
        const before = prev.get(g.type);
        // (Off-grid tunnel tiles excepted: the wrap places a ghost a few pixels into them.)
        const offGrid = col < 0 || col >= engine.maze.width;
        if (before && !offGrid && g.dir === getOppositeDirection(before.dir)) {
          reversals++;
          const along = g.dir === "LEFT" || g.dir === "RIGHT" ? g.x : g.y;
          const offset = ((along % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
          const fromBoundary = Math.min(offset, TILE_SIZE - offset);
          expect(
            fromBoundary,
            `${g.type} reversed mid-tile at (${col}, ${row}), frame ${f}`
          ).toBeLessThanOrEqual(2);
        }
        prev.set(g.type, { dir: g.dir, tile: `${col},${row}` });
        const tile = engine.maze.tiles[row]?.[col];
        expect(tile, `${g.type} inside a wall at (${col}, ${row}) on frame ${f}`).not.toBe("WALL");
        expect(f - lastMove[g.type], `${g.type} stuck at (${col}, ${row})`).toBeLessThan(60);
      }
    }
    expect(reversals).toBeGreaterThan(20); // the reversal check really ran
    expect(agent.diagnostics().failing).toEqual([]);
    // Every turn came from a plan; the wall safety net never had to step in
    expect(engine.movementController.fallbackTurns).toBe(0);
  });
});
