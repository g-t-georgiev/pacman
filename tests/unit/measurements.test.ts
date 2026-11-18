import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Measurements } from "../../src/game/measurements";
import { live } from "../helpers";

describe("Measurements (M6)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("the rolling tick rate counts real-time ticks only, not frames stepped by hand", () => {
    const { engine } = live(1);
    const m = new Measurements(engine);
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    for (let i = 0; i < 120; i++) {
      now += 1000 / 60;
      m.after(true); // real time, 60 a second
    }
    expect(m.recentTickRate).toBeCloseTo(60, 0);
    for (let i = 0; i < 200; i++) m.after(false); // stepped: no time passes, not counted
    expect(m.recentTickRate).toBeCloseTo(60, 0);
  });

  it("the runner's ticks feed the speed recorder the Debug panel reads", () => {
    const { runner, agent } = live(1);
    runner.measure.startSpeeds();
    agent.pause();
    agent.step(300); // stepped through the runner's own tick
    const report = runner.measure.stopSpeeds()!;
    expect(report.rows.length).toBeGreaterThan(0);
    expect(agent.speedReport()).toBeNull(); // the agent reads the same, now stopped
  });
});
