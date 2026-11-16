import { describe, expect, it } from "vite-plus/test";
import { LatencyMeter } from "../../src/game/latencyMeter";

describe("Input latency meter (Phase 5)", () => {
  it("measures from the input to the first render after a tick used it", () => {
    const m = new LatencyMeter();
    expect(m.stats).toBeNull();
    m.onInput(100);
    m.afterRender(105); // drawn before any tick ran: not yet on screen
    expect(m.stats).toBeNull();
    m.afterTick();
    m.afterRender(112);
    expect(m.stats).toEqual({ last: 12, avg: 12, max: 12, samples: 1 });
  });

  it("several inputs before a tick count once, from the first", () => {
    const m = new LatencyMeter();
    m.onInput(0);
    m.onInput(5);
    m.afterTick();
    m.afterRender(16);
    m.onInput(20);
    m.afterTick();
    m.afterRender(28);
    expect(m.stats).toMatchObject({ last: 8, max: 16, samples: 2, avg: 12 });
  });
});
