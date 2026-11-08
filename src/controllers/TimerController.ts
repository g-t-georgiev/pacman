import type { GhostBehavior, ScatterChaseSchedule } from "../types";
import { getScatterChaseSchedule } from "../utils";

/**
 * Timer Controller responsible for managing global game timers, all counted in whole frames:
 * - Scatter / Chase wave schedules (Level 1, Levels 2-4, Levels 5+)
 * - Frightened global countdown (pauses the scatter/chase timer while active)
 * - Level clear and ready state countdowns
 * - Resetting timers to phase 0 on player death or level transitions
 */
export class TimerController {
  public level: number = 1;
  public waveIndex: number = 0;
  /** Frames elapsed in the current scatter/chase wave. */
  public waveTimer: number = 0;
  /** Frames of frightened mode left. */
  public frightenedGlobalTimer: number = 0;
  public readyTimer: number = 120; // 2 seconds at 60 FPS
  public levelClearTimer: number = 0;

  constructor(level: number = 1) {
    this.level = level;
    this.resetTimers();
  }

  /**
   * Resets wave index and timers to the beginning (Phase 0).
   * Called on round initialization, level load, and whenever Pac-Man loses a life.
   */
  public resetTimers(): void {
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.frightenedGlobalTimer = 0;
  }

  /**
   * Retrieves the current active schedule phase based on level.
   */
  public get currentWave(): ScatterChaseSchedule | undefined {
    const schedule = getScatterChaseSchedule(this.level);
    return schedule[this.waveIndex];
  }

  public get isFrightened(): boolean {
    return this.frightenedGlobalTimer > 0;
  }

  /**
   * Triggers frightened mode. Pauses scatter/chase wave timer until frightened ends.
   *
   * @param frames Frightened duration in frames.
   */
  public triggerFrightened(frames: number): void {
    this.frightenedGlobalTimer = frames;
  }

  /**
   * Advances all active timers by exactly one frame.
   */
  public update(
    onWaveChange?: (newMode: GhostBehavior) => void,
    onFrightenedEnd?: () => void
  ): void {
    // Frightened mode countdown (eating an energizer pauses the scatter/chase wave progression)
    if (this.frightenedGlobalTimer > 0) {
      this.frightenedGlobalTimer--;
      if (this.frightenedGlobalTimer === 0 && onFrightenedEnd) onFrightenedEnd();
      return;
    }

    // Normal Scatter / Chase wave progression (resumes when the frightened timer expires)
    const wave = this.currentWave;
    if (!wave || wave.frames === Infinity) return;

    this.waveTimer++;
    if (this.waveTimer >= wave.frames) {
      this.waveTimer = 0;
      this.waveIndex++;
      const newMode: GhostBehavior = this.currentWave?.mode ?? "CHASE";
      if (onWaveChange) onWaveChange(newMode);
    }
  }
}
