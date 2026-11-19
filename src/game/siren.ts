import type GameEngine from "./GameEngine";
import type { SirenState } from "./simEvents";
/**
 * Which background siren plays (S1). The arcade has a normal siren and four faster, higher
 * "spurt" sirens ("Normal Move", "Spurt Move #1-#4" on Namco's sound effects album), stepping up
 * as the maze empties. No published source gives the switch points: these were measured on
 * footage of Pac-Man's level 1 (docs/footage/2026-11-19.md), as shares of the maze's dots eaten
 * so Ms. Pac-Man's mazes work the same way. Each is the middle of what the footage allows:
 * 34-48%, 70-73%, 79-84% and about 92%.
 */
export const SIREN_STAGE_SHARE_EATEN = [0.41, 0.71, 0.82, 0.92] as const;

/** Siren stage 0-4 for the dots eaten so far out of the maze's total. */
export function sirenStage(dotsEaten: number, totalDots: number): number {
  if (totalDots <= 0) return 0;
  const share = dotsEaten / totalDots;
  return SIREN_STAGE_SHARE_EATEN.filter((t) => share >= t).length;
}

/**
 * The background siren for the game's state (the shell plays it). Only during play: silent
 * through READY, the ghost-eaten pause, deaths, level clears and while paused. Eyes going home
 * win over frightened, which wins over the normal siren (the arcade's "Return to Home",
 * "Turn to Blue" and "Normal Move" / "Spurt Move" sounds).
 */
export function sirenStateOf(engine: GameEngine): SirenState {
  if (engine.paused || engine.sequencer.phase !== "PLAYING") return { kind: "OFF" };
  const ghosts = Object.values(engine.ghosts);
  if (ghosts.some((g) => g.mode === "EATEN")) return { kind: "EYES" };
  if (ghosts.some((g) => g.mode === "FRIGHTENED")) return { kind: "FRIGHTENED" };
  return {
    kind: "NORMAL",
    stage: sirenStage(engine.totalDots - engine.dotsRemaining, engine.totalDots),
  };
}
