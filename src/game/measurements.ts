import type GameEngine from "./GameEngine";
import { SpeedRecorder, type SpeedReport } from "../agent/SpeedRecorder";

/** A real-time tick-rate measurement. */
export interface TickRate {
  ticksPerSecond: number;
  expected: number;
  animationFramesPerSecond: number;
}

/**
 * Measurement tools of live play (plan M6: they lived in the agent driver, so only the console
 * could use them): the speed recorder (how far every actor moves per frame, by speed source,
 * against the level's table) and the real tick rate. Owned by the runner, which calls
 * `before` / `after` around every tick; the Debug panel and the agent driver share it.
 */
export class Measurements {
  private speeds: SpeedRecorder | null = null;
  private tickCounter: (() => void) | null = null;
  /** When the recent ticks ran (ms), for the rolling tick rate. */
  private recentTicks: number[] = [];

  constructor(private readonly engine: GameEngine) {}

  /** Right before a sim tick. */
  public before(): void {
    this.speeds?.before();
  }

  /** Right after a sim tick; `live` when it ran in real time (not stepped by hand). */
  public after(live: boolean = true): void {
    this.speeds?.after();
    this.tickCounter?.();
    if (!live) return;
    this.recentTicks.push(performance.now());
    if (this.recentTicks.length > 300) this.recentTicks.shift();
  }

  /**
   * Ticks per real second over the last ~5 s of play, read at any time (the Debug panel holds
   * the game while open, so it shows what was measured while playing). Null without enough data.
   */
  public get recentTickRate(): number | null {
    const t = this.recentTicks;
    if (t.length < 30) return null;
    const span = (t[t.length - 1] - t[0]) / 1000;
    return span > 0 ? Math.round(((t.length - 1) / span) * 10) / 10 : null;
  }

  /** Starts (or restarts) recording speeds. */
  public startSpeeds(): void {
    this.speeds = new SpeedRecorder(this.engine);
  }

  /** Measured vs table speeds so far, or null when not recording. */
  public speedReport(): SpeedReport | null {
    return this.speeds?.report() ?? null;
  }

  /** Stops recording and returns the final report. */
  public stopSpeeds(): SpeedReport | null {
    const report = this.speedReport();
    this.speeds = null;
    return report;
  }

  public get recordingSpeeds(): boolean {
    return this.speeds !== null;
  }

  /**
   * Counts real-time ticks over the next `seconds` (the loop running, the tab visible).
   * `expected` is the loop's target: 60.606 (arcade timing) or 60, times the practice speed.
   */
  public async measureTickRate(seconds: number, expected: number): Promise<TickRate> {
    let ticks = 0;
    let frames = 0;
    this.tickCounter = () => ticks++;
    const countFrame = () => {
      frames++;
      rafId = requestAnimationFrame(countFrame);
    };
    let rafId = requestAnimationFrame(countFrame);
    const start = performance.now();
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    const elapsed = (performance.now() - start) / 1000;
    cancelAnimationFrame(rafId);
    this.tickCounter = null;
    const round = (v: number) => Math.round(v * 1000) / 1000;
    return {
      ticksPerSecond: round(ticks / elapsed),
      expected: round(expected),
      animationFramesPerSecond: round(frames / elapsed),
    };
  }
}
