/** Seed the PRNG returns to at every level start and after every life lost (Dossier). */
export const PRNG_SEED = 0x2a3b;

/**
 * Deterministic 16-bit LFSR used for frightened-ghost decisions.
 *
 * Owned by the game engine (one instance per game), never global. It advances only when a
 * frightened ghost makes a decision, and is reset to the same seed at each level start and after
 * each life lost, so frightened paths repeat exactly. It is not the arcade's generator (that one
 * reads ROM bytes), only the same reset semantics.
 */
export class PRNG {
  private register: number;

  constructor(private readonly seed: number = PRNG_SEED) {
    this.register = seed;
  }

  /** Returns to the seed. */
  public reset(): void {
    this.register = this.seed;
  }

  /** Current register value, for snapshots. */
  public get state(): number {
    return this.register;
  }

  public set state(value: number) {
    this.register = value & 0xffff;
  }

  /**
   * Advances the register one step and returns a direction index 0..3
   * (0 = UP, 1 = LEFT, 2 = DOWN, 3 = RIGHT).
   */
  public next(): number {
    // Maximum-length 16-bit LFSR (taps 16, 14, 13, 11).
    const bit =
      ((this.register >> 0) ^ (this.register >> 2) ^ (this.register >> 3) ^ (this.register >> 5)) &
      1;
    this.register = ((this.register >> 1) | (bit << 15)) & 0xffff;
    return this.register & 0x03;
  }
}
