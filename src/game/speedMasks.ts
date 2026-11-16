import { GHOST_EATEN_SPEED_PCT } from "./constants";

/**
 * Movement step masks for one 16-frame cycle.
 *
 * - Bit order: the most significant bit is frame 0 of the cycle, the least significant is frame 15.
 * - Each set bit is one arcade-pixel step. `step1` is the first step of a frame, `step2` an extra
 *   step in the same frame, so an actor moves 0, 1 or 2 arcade pixels per frame.
 * - Every step is executed as a full single-pixel update (tile entry, decisions, wrap, collision),
 *   so a 2-pixel frame can never skip a tile or an intersection.
 */
export interface SpeedMask {
  step1: number;
  step2: number;
}

/**
 * Hand-authored speed masks, keyed by speed percentage.
 *
 * These are placeholders until a verified ROM disassembly turns up: swap the bit layouts freely.
 * Only the totals are fixed, by the Dossier's scale (100% = 1.25 arcade px/frame), which makes
 * every 5% exactly one set bit per 16 frames. `tests/unit/speedMasks.test.ts` checks the totals.
 */
export const SPEED_MASKS: Record<number, SpeedMask> = {
  40: { step1: 0b1010_1010_1010_1010, step2: 0 }, //  8 px / 16 frames
  45: { step1: 0b1101_0101_0101_0101, step2: 0 }, //  9
  50: { step1: 0b1101_0101_1101_0101, step2: 0 }, // 10
  55: { step1: 0b1101_1011_0101_1011, step2: 0 }, // 11
  60: { step1: 0b1110_1110_1110_1110, step2: 0 }, // 12
  75: { step1: 0b1111_1110_1111_1111, step2: 0 }, // 15
  80: { step1: 0b1111_1111_1111_1111, step2: 0 }, // 16 (exactly 1 px every frame)
  85: { step1: 0b1111_1111_1111_1111, step2: 0b0000_0001_0000_0000 }, // 17
  90: { step1: 0b1111_1111_1111_1111, step2: 0b0000_0001_0000_0001 }, // 18
  95: { step1: 0b1111_1111_1111_1111, step2: 0b0000_1000_0100_0010 }, // 19
  100: { step1: 0b1111_1111_1111_1111, step2: 0b0001_0001_0001_0001 }, // 20
  105: { step1: 0b1111_1111_1111_1111, step2: 0b0100_1001_0010_0100 }, // 21
  // Returning eyes. The Dossier gives no figure; 2 px every frame until a source says otherwise.
  [GHOST_EATEN_SPEED_PCT]: { step1: 0b1111_1111_1111_1111, step2: 0b1111_1111_1111_1111 }, // 32
};

/** Arcade-pixel steps (0, 1 or 2) a mask grants on the given frame. */
export function arcadeStepsOnFrame(mask: SpeedMask, frame: number): number {
  const shift = 15 - (frame % 16);
  return ((mask.step1 >> shift) & 1) + ((mask.step2 >> shift) & 1);
}
