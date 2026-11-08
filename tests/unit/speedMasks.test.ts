import { describe, expect, it } from "vite-plus/test";
import { getPixelStepsThisFrame } from "../../src/utils";

describe("Layer 1 Unit Tests: 16-Frame Bitmask Speed System", () => {
  it("should match exact authentic active bit counts across a 16-frame cycle for all speed percentages", () => {
    // 71% -> 0x5555 has 8 bits, 71% is scaled to round(16 * 0.71) = 11 steps
    const testCases: Array<{ pct: number; expectedStepsIn16Frames: number }> = [
      { pct: 40, expectedStepsIn16Frames: 6 },
      { pct: 45, expectedStepsIn16Frames: 7 },
      { pct: 50, expectedStepsIn16Frames: 8 },
      { pct: 55, expectedStepsIn16Frames: 9 },
      { pct: 60, expectedStepsIn16Frames: 10 },
      { pct: 71, expectedStepsIn16Frames: 11 },
      { pct: 75, expectedStepsIn16Frames: 12 },
      { pct: 80, expectedStepsIn16Frames: 13 },
      { pct: 85, expectedStepsIn16Frames: 13 },
      { pct: 90, expectedStepsIn16Frames: 14 },
      { pct: 95, expectedStepsIn16Frames: 15 },
      { pct: 100, expectedStepsIn16Frames: 16 },
    ];

    testCases.forEach(({ pct, expectedStepsIn16Frames }) => {
      let totalSteps = 0;
      for (let frame = 0; frame < 16; frame++) {
        totalSteps += getPixelStepsThisFrame(frame, pct, 1.0);
      }
      expect(totalSteps).toBe(expectedStepsIn16Frames);
    });
  });

  it("should execute authentic Cruise Elroy 2 (105% speed) with an extra pixel on frame 7", () => {
    let totalSteps = 0;
    const stepsPerFrame: number[] = [];

    for (let frame = 0; frame < 16; frame++) {
      const step = getPixelStepsThisFrame(frame, 105, 1.0);
      stepsPerFrame.push(step);
      totalSteps += step;
    }

    // 16 frames: 15 frames move 1px, frame 7 moves 2px -> 17 total steps (105% of 16 ~ 16.8)
    expect(totalSteps).toBe(17);
    expect(stepsPerFrame[7]).toBe(2);
    expect(stepsPerFrame[0]).toBe(1);
    expect(stepsPerFrame[6]).toBe(1);
    expect(stepsPerFrame[8]).toBe(1);
  });

  it("should execute eaten eyes at 200% speed (2 pixels every single frame)", () => {
    for (let frame = 0; frame < 32; frame++) {
      const step = getPixelStepsThisFrame(frame, 200, 1.0);
      expect(step).toBe(2);
    }
  });

  it("should double steps when turbo multiplier is active (2.0x)", () => {
    for (let frame = 0; frame < 16; frame++) {
      const normalStep = getPixelStepsThisFrame(frame, 100, 1.0);
      const turboStep = getPixelStepsThisFrame(frame, 100, 2.0);
      expect(turboStep).toBe(normalStep * 2);
    }
  });
});
