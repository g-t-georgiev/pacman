/**
 * The simulation's general-purpose random stream (xorshift32), kept apart from the frightened
 * ghost PRNG so that drawing, say, a fruit timer never shifts the ghosts' choices.
 * Its state is part of GameState, so replays and rewinds stay exact.
 */
export const SIM_RANDOM_SEED = 0x2f6b_1d35;

export class SimRandom {
  public state: number = SIM_RANDOM_SEED;

  public reset(seed: number = SIM_RANDOM_SEED): void {
    this.state = seed >>> 0 || SIM_RANDOM_SEED;
  }

  /** Next raw 32-bit value. */
  public nextUint32(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  /** An integer in [0, n). */
  public nextInt(n: number): number {
    return this.nextUint32() % n;
  }
}
