import { describe, expect, it } from "vite-plus/test";
import { getPixelStepsThisFrame } from "../../src/utils";
import { SIM_PX_PER_ARCADE_PX, SPEED_MASKS, arcadeStepsOnFrame } from "../../src/game/speedMasks";
import {
  GHOST_EATEN_SPEED_PCT,
  GHOST_HOUSE_SPEED_PCT,
  SPEED_PCT_PER_LEVEL_1,
  SPEED_PCT_PER_LEVELS_2_TO_4,
  SPEED_PCT_PER_LEVELS_5_TO_20,
  SPEED_PCT_PER_LEVELS_21_PLUS,
} from "../../src/game/constants";

const popcount16 = (v: number) => {
  let n = 0;
  for (let i = 0; i < 16; i++) n += (v >> i) & 1;
  return n;
};

const arcadePxPerCycle = (pct: number) => {
  const mask = SPEED_MASKS[pct];
  return popcount16(mask.step1) + popcount16(mask.step2);
};

describe("Speed masks (data validation)", () => {
  it("every mask fits in 16 bits", () => {
    for (const mask of Object.values(SPEED_MASKS)) {
      expect(mask.step1 >>> 16).toBe(0);
      expect(mask.step2 >>> 16).toBe(0);
    }
  });

  it("every Dossier speed moves pct/5 arcade px per 16 frames (100% = 1.25 px/frame)", () => {
    for (const key of Object.keys(SPEED_MASKS)) {
      const pct = Number(key);
      if (pct === GHOST_EATEN_SPEED_PCT) continue;
      expect(arcadePxPerCycle(pct), `${pct}%`).toBe(pct / 5);
    }
  });

  it("returning eyes move 2 arcade px every frame", () => {
    expect(arcadePxPerCycle(GHOST_EATEN_SPEED_PCT)).toBe(32);
  });

  it("every speed used by the level tables and the ghost house has a mask", () => {
    const tables = [
      SPEED_PCT_PER_LEVEL_1,
      SPEED_PCT_PER_LEVELS_2_TO_4,
      SPEED_PCT_PER_LEVELS_5_TO_20,
      SPEED_PCT_PER_LEVELS_21_PLUS,
    ];
    const used = new Set<number>([GHOST_EATEN_SPEED_PCT, GHOST_HOUSE_SPEED_PCT]);
    for (const t of tables) {
      for (const pct of Object.values(t) as number[]) used.add(pct);
    }
    for (const pct of used) {
      expect(SPEED_MASKS[pct], `${pct}%`).toBeDefined();
    }
  });
});

describe("Speed mask stepping", () => {
  it("reads frame 0 from the most significant bit", () => {
    const mask = { step1: 0b1000_0000_0000_0000, step2: 0b0000_0000_0000_0001 };
    expect(arcadeStepsOnFrame(mask, 0)).toBe(1);
    expect(arcadeStepsOnFrame(mask, 1)).toBe(0);
    expect(arcadeStepsOnFrame(mask, 15)).toBe(1);
    expect(arcadeStepsOnFrame(mask, 16)).toBe(1); // cycle wraps
  });

  it("level 1 Pac-Man (80%) moves exactly 1 arcade px every frame", () => {
    for (let frame = 0; frame < 64; frame++) {
      expect(getPixelStepsThisFrame(frame, 80)).toBe(SIM_PX_PER_ARCADE_PX);
    }
  });

  it("100% averages 1.25 arcade px/frame, with 2-px frames from step2", () => {
    let total = 0;
    let twoPxFrames = 0;
    for (let frame = 0; frame < 16; frame++) {
      const px = getPixelStepsThisFrame(frame, 100) / SIM_PX_PER_ARCADE_PX;
      total += px;
      if (px === 2) twoPxFrames++;
    }
    expect(total / 16).toBe(1.25);
    expect(twoPxFrames).toBe(4);
  });

  it("Elroy 2 is faster than Elroy 1, and L1 Pac-Man is faster than L1 ghosts", () => {
    expect(arcadePxPerCycle(SPEED_PCT_PER_LEVEL_1.elroy2)).toBeGreaterThan(
      arcadePxPerCycle(SPEED_PCT_PER_LEVEL_1.elroy1)
    );
    expect(arcadePxPerCycle(SPEED_PCT_PER_LEVEL_1.pacmanNormal)).toBeGreaterThan(
      arcadePxPerCycle(SPEED_PCT_PER_LEVEL_1.ghostNormal)
    );
  });

  it("turbo scales the per-frame steps", () => {
    for (let frame = 0; frame < 16; frame++) {
      expect(getPixelStepsThisFrame(frame, 100, 2.0)).toBe(getPixelStepsThisFrame(frame, 100) * 2);
    }
  });
});
