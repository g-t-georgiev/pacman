/**
 * Frightened-ghost random number generator, shaped like the arcade's (Retro Game Mechanics
 * Explained, "Pac-Man's Frightened Ghosts"; reset rules from the Dossier).
 *
 * - A 13-bit index steps as `index = (index * 5 + 1) & 0x1FFF`: 0, 1, 6, 31, ... It visits all
 *   8192 values before repeating.
 * - The index resets to 0 at every level start and after every life lost.
 * - The arcade returns the ROM byte at that index and uses its two low bits as a direction
 *   code: 0 = RIGHT, 1 = DOWN, 2 = LEFT, 3 = UP.
 *
 * The ROM is not shipped, so the byte lookup is replaced by a synthetic table of two-bit codes
 * with the arcade's measured distribution (see DIRECTION_CODE_COUNTS). Frightened ghosts get the
 * arcade's biases (turning left, drifting to the bottom left), not its exact sequences.
 */

export const PRNG_INDEX_MASK = 0x1fff;
export const PRNG_PERIOD = PRNG_INDEX_MASK + 1; // 8192

/** Direction code meanings (two low bits of the arcade's output byte). */
export const PRNG_DIRECTIONS = ["RIGHT", "DOWN", "LEFT", "UP"] as const;

/**
 * How often each direction code appears among the 8192 outputs.
 * Measured (RGME): up 16.3%, left 29.9%, right + down 53.7%. The right/down split is not given;
 * both "adjacent direction" cases are described as about 3 to 1, so it is split evenly.
 */
export const DIRECTION_CODE_COUNTS: readonly [
  right: number,
  down: number,
  left: number,
  up: number,
] = [2203, 2202, 2449, 1338];

/** Builds the synthetic output table: the counts above, spread in a fixed pseudo-random order. */
function buildOutputTable(): Uint8Array {
  const table = new Uint8Array(PRNG_PERIOD);
  let i = 0;
  DIRECTION_CODE_COUNTS.forEach((count, code) => {
    table.fill(code, i, i + count);
    i += count;
  });
  // Fisher-Yates shuffle with a fixed xorshift32 seed, so the table is identical on every run.
  let x = 0x9e3779b9;
  for (let j = PRNG_PERIOD - 1; j > 0; j--) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const k = (x >>> 0) % (j + 1);
    const tmp = table[j];
    table[j] = table[k];
    table[k] = tmp;
  }
  return table;
}

const OUTPUT_TABLE = buildOutputTable();

/**
 * Owned by the game engine (one per game). It advances only when a frightened ghost enters a
 * tile, corridors included, never per frame.
 */
export class PRNG {
  private index = 0;

  /** Back to index 0 (level start, life lost). */
  public reset(): void {
    this.index = 0;
  }

  /** Current index, for snapshots. */
  public get state(): number {
    return this.index;
  }

  public set state(value: number) {
    this.index = value & PRNG_INDEX_MASK;
  }

  /** Advances the index and returns a direction code 0..3 (see PRNG_DIRECTIONS). */
  public next(): number {
    this.index = (this.index * 5 + 1) & PRNG_INDEX_MASK;
    return OUTPUT_TABLE[this.index];
  }
}
