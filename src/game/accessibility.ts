import type { GameSettings, GhostType } from "../types";
import type GameEngine from "./GameEngine";
import { GHOST_COLORS, FRIGHTENED_FLASH_TOGGLE_FRAMES } from "./constants";
import { getFrightenedFlashCount } from "../utils";

/**
 * Accessibility (Phase 5): a colorblind-safe palette and reduced flashing. Purely visual: the
 * sim and its state are untouched, so replays and hashes don't depend on these options.
 */

/**
 * Ghost colors from the Okabe-Ito palette, chosen to stay apart under the common color vision
 * deficiencies (red-orange-pink are the arcade colors most often confused).
 */
const SAFE_GHOST_COLORS: Record<GhostType, string> = {
  BLINKY: "#D55E00", // vermilion
  PINKY: "#CC79A7", // reddish purple
  INKY: "#56B4E9", // sky blue
  CLYDE: "#F0E442", // yellow
};

export function ghostBodyColor(type: GhostType, settings: GameSettings): string {
  return settings.colorblindPalette ? SAFE_GHOST_COLORS[type] : GHOST_COLORS[type].body;
}

/** Frightened body and face colors (normal, and the warning flash's white phase). */
export function frightenedColors(settings: GameSettings): {
  body: string;
  face: string;
  flashBody: string;
  flashFace: string;
} {
  return settings.colorblindPalette
    ? // a darker blue than Inky's sky blue (luminance, not just hue), the flash face in vermilion
      { body: "#0033AA", face: "#FFFFFF", flashBody: "#FFFFFF", flashFace: "#D55E00" }
    : { body: "#2121ff", face: "#ffb8ff", flashBody: "#ffffff", flashFace: "#ff0000" };
}

/** Frightened is in its last stretch (the arcade flashes the ghosts then). */
export function frightenedEnding(engine: GameEngine): boolean {
  const left = engine.frightenedGlobalTimer;
  const flashes = getFrightenedFlashCount(engine.level);
  return left > 0 && flashes > 0 && left <= flashes * 2 * FRIGHTENED_FLASH_TOGGLE_FRAMES;
}

/** The walls during the level-clear flash: white/blue strobing, or one steady pale color. */
export function mazeFlashWallColor(engine: GameEngine): string | null {
  if (engine.phase !== "MAZE_FLASH") return null;
  if (engine.settings.reducedFlash) return "#a0a0ff";
  return engine.isMazeFlashWhite ? "#ffffff" : null;
}
