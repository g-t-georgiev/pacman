import type { GhostBehavior, ScatterChaseSchedule } from "../types";
import { getScatterChaseSchedule } from "../utils";

/**
 * Timer Controller responsible for managing global game timers:
 * - Scatter / Chase wave schedules (Level 1, Levels 2-4, Levels 5+)
 * - Frightened global countdown (strictly pauses the scatter/chase timer while active)
 * - Level clear and ready state countdowns
 * - Resetting timers to phase 0 on player death or level transitions
 */
export class TimerController {
  public level: number = 1;
  public waveIndex: number = 0;
  public waveTimer: number = 0;
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

  /**
   * Returns whether frightened mode is currently active.
   */
  public get isFrightened(): boolean {
    return this.frightenedGlobalTimer > 0;
  }

  /**
   * Triggers frightened mode. Pauses scatter/chase wave timer until frightened ends.
   */
  public triggerFrightened(duration: number): void {
    this.frightenedGlobalTimer = duration;
  }

  /**
   * Advances all active timers scaled by gameSpeed.
   */
  public update(
    gameSpeed: number = 1.0,
    onWaveChange?: (newMode: GhostBehavior) => void,
    onFrightenedEnd?: () => void
  ): void {
    const dt = (1 / 60) * gameSpeed;

    // Frightened mode countdown (eating an energizer pauses the scatter/chase wave progression)
    if (this.frightenedGlobalTimer > 0) {
      this.frightenedGlobalTimer -= dt;
      if (this.frightenedGlobalTimer <= 0) {
        this.frightenedGlobalTimer = 0;
        if (onFrightenedEnd) onFrightenedEnd();
      }
    } else {
      // Normal Scatter / Chase wave progression (resumes cleanly when frightened timer expires)
      const wave = this.currentWave;
      if (wave && wave.duration !== Infinity) {
        this.waveTimer += dt;
        if (this.waveTimer >= wave.duration - 0.0001) {
          this.waveTimer = 0;
          this.waveIndex++;
          const nextWave = this.currentWave;
          const newMode = (nextWave?.mode || "CHASE") as GhostBehavior;
          if (onWaveChange) onWaveChange(newMode);
        }
      }
    }
  }
}
