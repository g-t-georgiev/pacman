import type GameEngine from "./GameEngine";
import type { GhostType } from "../types";
import { seamPx } from "./mazes";

/**
 * Practice-tab actions that change the game from outside a tick (plan D3: they used to be engine
 * methods). Each one restarts the replay recording, so rewinds and clips never mix the frames
 * before the edit with the ones after it.
 */

/** Pac-Man can't be caught (a rule setting: recorded in replays). */
export function setInvincible(engine: GameEngine, on: boolean): void {
  engine.settings.invincible = on;
  engine.pacman.invincible = on;
  engine.replayLog.reset(engine);
}

/** Every ghost back on its spawn point (Blinky outside, the others in the house), not blue. */
export function sendGhostsHome(engine: GameEngine): void {
  const spawns = engine.maze.ghostSpawns;
  (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
    const g = engine.ghosts[type];
    const pos = seamPx(spawns[type].candidates);
    g.x = pos.x;
    g.y = pos.y;
    g.dir = spawns[type].initialDir;
    g.nextDir = spawns[type].initialDir;
    g.location = spawns[type].inHouse ? "HOUSE" : "ACTIVE";
    g.frightened = false;
    g.flashState = false;
    g.reversalPrimed = false;
    g.enteringHousePhase = "NONE";
    g.lastDecisionTile = undefined;
  });
  engine.replayLog.reset(engine);
}
