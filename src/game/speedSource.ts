import type GameEngine from "./GameEngine";
import type { Ghost } from "../core/Ghost";
import { getSpeedConfigForLevel } from "../utils";
import { isTunnelSlowZone } from "./mazeAnalysis";

/** Why an actor moves at the speed it does this frame. */
export type SpeedSource =
  | "pacman-normal"
  | "pacman-fright"
  | "pacman-stall" // the 1- or 3-frame stop after eating a dot or an energizer
  | "ghost-normal"
  | "ghost-tunnel"
  | "ghost-fright"
  | "ghost-elroy1"
  | "ghost-elroy2"
  | "ghost-eyes"
  | "ghost-house";

export interface ActorSpeed {
  source: SpeedSource;
  /** Speed percentage from the level's table (0 for a stall; for eyes, the mask key). */
  pct: number;
}

/** Pac-Man's speed for the coming frame. */
export function pacmanSpeed(engine: GameEngine): ActorSpeed {
  const cfg = getSpeedConfigForLevel(engine.level);
  if (engine.pacman.eatingFreezeFrames > 0) return { source: "pacman-stall", pct: 0 };
  return engine.frightenedGlobalTimer > 0
    ? { source: "pacman-fright", pct: cfg.pacmanFright }
    : { source: "pacman-normal", pct: cfg.pacmanNormal };
}

/** A ghost's speed for the coming frame, and the rule that sets it. */
export function ghostSpeed(engine: GameEngine, g: Ghost): ActorSpeed {
  const cfg = getSpeedConfigForLevel(engine.level);
  return { source: ghostSource(engine, g), pct: g.getSpeedPercentage(engine.maze, cfg) };
}

function ghostSource(engine: GameEngine, g: Ghost): SpeedSource {
  if (g.isEyes) return "ghost-eyes";
  if (g.inHouse) return "ghost-house";
  const { col, row } = g.tileCoord;
  const maze = engine.maze;
  if (isTunnelSlowZone(maze, col, row)) {
    return "ghost-tunnel";
  }
  if (g.frightened) return "ghost-fright";
  if (g.elroyStage === 2) return "ghost-elroy2";
  if (g.elroyStage === 1) return "ghost-elroy1";
  return "ghost-normal";
}
