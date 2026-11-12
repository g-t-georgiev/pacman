/**
 * Which background siren plays (S1). The arcade has a normal siren and four faster, higher
 * "spurt" sirens ("Normal Move", "Spurt Move #1-#4" on Namco's sound effects album), stepping up
 * as the maze empties. No published source gives the switch points: these are estimates, evenly
 * spaced by the share of the maze's dots eaten (so Ms. Pac-Man's mazes work the same way).
 */
export const SIREN_STAGE_SHARE_EATEN = [0.2, 0.4, 0.6, 0.8] as const; // estimate

/** Siren stage 0-4 for the dots eaten so far out of the maze's total. */
export function sirenStage(dotsEaten: number, totalDots: number): number {
  if (totalDots <= 0) return 0;
  const share = dotsEaten / totalDots;
  return SIREN_STAGE_SHARE_EATEN.filter((t) => share >= t).length;
}
