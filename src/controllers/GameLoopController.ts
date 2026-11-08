/**
 * Fixed-timestep Game Loop Controller.
 *
 * The simulation always advances in whole 60 Hz ticks. Practice slow-motion and fast-forward
 * change how many ticks run per real second (the time scale), never what a tick does, so the sim
 * behaves identically at any speed.
 */
export class GameLoopController {
  public static readonly LOGIC_FPS = 60;
  public static readonly LOGIC_STEP = 1000 / GameLoopController.LOGIC_FPS; // ~16.666ms
  /** Longest real-time gap accepted per animation frame (avoids a burst after the tab was hidden). */
  public static readonly MAX_FRAME_MS = 100;

  private accumulator: number = 0;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;

  private onTick: () => void;
  private onRender: () => void;
  private getTimeScale: () => number;

  constructor(onTick: () => void, onRender: () => void, getTimeScale: () => number = () => 1) {
    this.onTick = onTick;
    this.onRender = onRender;
    this.getTimeScale = getTimeScale;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.animationFrameId = null;
    }
  }

  /**
   * Performs a single manual step (frame-by-frame practice stepping and tests).
   */
  public stepOnce(): void {
    this.tick();
    this.onRender();
  }

  /**
   * Feeds real elapsed time into the loop and runs every whole tick it covers.
   *
   * @returns The number of ticks that ran.
   */
  public advance(deltaMs: number): number {
    const clamped = Math.min(deltaMs, GameLoopController.MAX_FRAME_MS);
    this.accumulator += clamped * this.getTimeScale();

    let ticks = 0;
    // The epsilon absorbs float error, so 60 frames of 1000/60 ms always make exactly 60 ticks.
    while (this.accumulator >= GameLoopController.LOGIC_STEP - 1e-9) {
      this.accumulator -= GameLoopController.LOGIC_STEP;
      this.tick();
      ticks++;
    }
    return ticks;
  }

  private tick(): void {
    this.onTick();
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    this.advance(currentTime - this.lastTime);
    this.lastTime = currentTime;

    this.onRender();
    if (typeof requestAnimationFrame !== "undefined") {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  };
}
