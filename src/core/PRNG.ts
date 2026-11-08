export class PRNG {
  // The original Z80 register initializes with a non-zero value at boot.
  // 0x0001 or any non-zero value works perfectly as a seed.
  private register: number = 0x2a3b;

  /**
   * Advances the 16-bit shift register by one step.
   * Call this once per frame in your main game loop, AND
   * call it whenever a ghost needs a random direction.
   */
  public next(): number {
    // 1. Isolate the incoming bit using the arcade's exact tap structure.
    // The Z80 code checks specific bits (taps at bit 11, 13, 14, 15) to calculate the feedback.
    // A standard maximum-length 16-bit LFSR tap sequence (bits 16, 14, 13, 11) achieves the same behavior.
    const bit =
      ((this.register >> 0) ^ (this.register >> 2) ^ (this.register >> 3) ^ (this.register >> 5)) &
      1;

    // 2. Shift the register left by 1 and push the feedback bit into the lowest position
    this.register = ((this.register >> 1) | (bit << 15)) & 0xffff;

    // 3. The arcade isolates the lowest 2 bits to yield a direction value between 0 and 3
    // 00 = UP, 01 = LEFT, 10 = DOWN, 11 = RIGHT
    return this.register & 0x03;
  }
}

const GlobalPRNG = new PRNG();

export default GlobalPRNG;
