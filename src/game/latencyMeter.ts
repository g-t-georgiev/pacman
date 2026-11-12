/**
 * Input latency readout (Phase 5). The loop already samples input at the start of each tick
 * (keyboard events reach the engine as they arrive; the gamepad is polled before every tick)
 * and renders right after the frame's ticks. This measures what is left: from the input event's
 * timestamp to the end of the first render that includes a tick run after it. The display and
 * the browser's compositor add their own frame or two on top, which a page can't measure.
 */
export interface LatencyStats {
  /** Most recent sample, ms. */
  last: number;
  avg: number;
  max: number;
  samples: number;
}

const WINDOW = 30;

export class LatencyMeter {
  private pendingSince: number | null = null;
  private consumed = false;
  private recent: number[] = [];

  /** An input arrived (`timeStamp`: the event's, on the performance.now() clock). */
  public onInput(timeStamp: number): void {
    if (this.pendingSince === null) this.pendingSince = timeStamp;
  }

  /** A sim tick ran: a pending input has now been used. */
  public afterTick(): void {
    if (this.pendingSince !== null) this.consumed = true;
  }

  /** A frame was drawn at `now`: the pending input is on screen. */
  public afterRender(now: number): void {
    if (this.pendingSince === null || !this.consumed) return;
    this.recent.push(Math.max(0, now - this.pendingSince));
    if (this.recent.length > WINDOW) this.recent.shift();
    this.pendingSince = null;
    this.consumed = false;
  }

  public get stats(): LatencyStats | null {
    const n = this.recent.length;
    if (n === 0) return null;
    return {
      last: this.recent[n - 1],
      avg: this.recent.reduce((s, v) => s + v, 0) / n,
      max: Math.max(...this.recent),
      samples: n,
    };
  }
}
