import type GameEngine from "./GameEngine";

/**
 * Rewinding and scrubbing through the recorded game (plan P4: this lived inside GameEngine). The
 * engine keeps the mechanism (`showRecordedFrame` rebuilds any recorded frame exactly and
 * silently; `leaveScrub` plays on from it); this class decides which frame to show.
 */
export class Timeline {
  constructor(private readonly engine: GameEngine) {}

  /** How many frames can be shown: the oldest recorded one up to the newest. */
  public get length(): number {
    const log = this.engine.replayLog;
    return log.headTick - log.oldestTick + 1;
  }

  /** Shows frame `frameIndex` of the rewindable range (0 = oldest) and holds there. */
  public scrubTo(frameIndex: number): void {
    if (frameIndex < 0 || frameIndex >= this.length) return;
    this.engine.showRecordedFrame(this.engine.replayLog.oldestTick + frameIndex);
  }

  /** Steps back `seconds` from the frame shown now (the live frame, or the scrubbed one). */
  public rewindSeconds(seconds: number): void {
    const target = Math.max(
      this.engine.replayLog.oldestTick,
      this.shownTick() - Math.round(seconds * 60)
    );
    this.engine.showRecordedFrame(target);
  }

  /**
   * Steps back to `seconds` before Pac-Man last died: past the death sequence (freeze, animation,
   * game over) to the last frame he was alive, then `seconds` more. For a quick retry after a
   * death or a game over, where a plain 2 s rewind would land inside the death animation.
   */
  public rewindBeforeDeath(seconds: number): void {
    const engine = this.engine;
    const oldest = engine.replayLog.oldestTick;
    let target = this.shownTick();
    engine.showRecordedFrame(target);
    const alive = () => {
      const phase = engine.sequencer.phase;
      return phase === "PLAYING" || phase === "GHOST_EATEN_PAUSE" || phase === "READY";
    };
    while (!alive() && target > oldest) {
      target = Math.max(oldest, target - 30);
      engine.showRecordedFrame(target);
    }
    engine.showRecordedFrame(Math.max(oldest, target - Math.round(seconds * 60)));
  }

  /** Plays on from the scrubbed frame. Everything recorded after it is forgotten. */
  public resume(): void {
    this.engine.leaveScrub();
  }

  /** The frame shown now: the scrubbed one, or the newest recorded. */
  private shownTick(): number {
    return this.engine.rewindIndex !== -1 ? this.engine.tick : this.engine.replayLog.headTick;
  }
}
