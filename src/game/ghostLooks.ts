import type GameEngine from "./GameEngine";
import { FRIGHTENED_FLASH_TOGGLE_FRAMES } from "./constants";
import { getFrightenedFlashCount } from "./levelTable";

/**
 * How the ghosts look this frame, worked out when drawing (plan P2: these used to be stored per
 * ghost in the game state, though nothing in the game depends on them).
 */

/**
 * Frightened ghosts are in the white phase of their end-of-fright warning: the last
 * `flashes` white/blue cycles, 14 frames per half (Dossier, Table A.1 flashes).
 */
export function frightenedFlashWhite(engine: GameEngine): boolean {
  const left = engine.frightenedGlobalTimer;
  const flashes = getFrightenedFlashCount(engine.level);
  if (left <= 0 || flashes <= 0) return false;
  const halfCyclesLeft = Math.floor(left / FRIGHTENED_FLASH_TOGGLE_FRAMES);
  // Odd half-cycles are white, even ones blue
  return halfCyclesLeft < 2 * flashes && halfCyclesLeft % 2 === 1;
}

/** Where the ghosts' wavy feet are in their cycle (0 to 1), from the life's frame count. */
export function feetPhase(engine: GameEngine): number {
  return (engine.lifeFrame * 0.15) % 1;
}
