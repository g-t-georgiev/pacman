import GlobalPRNG from "../core/PRNG";

/**
 * Fixed-timestep Game Loop Controller.
 * Ensures consistent 60 FPS deterministic physics independent of display refresh rate,
 * and maintains the monotonically increasing currLevelFrame counter required by 16-frame speed bitmasks.
 */
export class GameLoopController {
  public static readonly LOGIC_FPS = 60;
  public static readonly LOGIC_STEP = 1000 / GameLoopController.LOGIC_FPS; // ~16.666ms

  public currLevelFrame: number = 0;
  private accumulator: number = 0;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;

  private onTick: (currLevelFrame: number) => void;
  private onRender: () => void;

  constructor(onTick: typeof this.onTick, onRender: typeof this.onRender) {
    this.onTick = onTick;
    this.onRender = onRender;
  }

  /**
   * Resets the level frame counter back to 0 (upon level start or death reset).
   */
  public resetLevelFrame(): void {
    this.currLevelFrame = 0;
    this.accumulator = 0;
  }

  /**
   * Starts the fixed-step game loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  /**
   * Stops the game loop.
   */
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
   * Performs a single manual step (useful for testing or frame-by-frame practice stepping).
   */
  public stepOnce(): void {
    this.currLevelFrame++;
    this.onTick(this.currLevelFrame);
    this.onRender();
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    let deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Prevent spiral of death when window is unfocused (cap at 100ms)
    if (deltaTime > 100) {
      deltaTime = 100;
    }

    this.accumulator += deltaTime;

    while (this.accumulator >= GameLoopController.LOGIC_STEP) {
      this.currLevelFrame++;
      GlobalPRNG.next();
      this.onTick(this.currLevelFrame);
      this.accumulator -= GameLoopController.LOGIC_STEP;
    }

    this.onRender();
    if (typeof requestAnimationFrame !== "undefined") {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  };
}
