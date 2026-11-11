import type { Direction, GameSettings } from "../types";
import { type GameState, hashGameState } from "./gameState";
import { type Replay, type ReplayLog, playReplay } from "./replay";
import type { GameRunner } from "./GameRunner";

export interface ReplayViewState {
  /** A replay is being watched. */
  active: boolean;
  /** Playing (false: paused, or at the end). */
  playing: boolean;
  startTick: number;
  endTick: number;
  /** The frame shown now. */
  tick: number;
  /** First tick whose state hash did not match the recording (another build), or null. */
  divergedAt: number | null;
}

/**
 * Watches a replay inside the game, like a video clip (plan T12). The live game is saved first
 * (state, recording, settings) and put back exactly on exit. While watching, the recorded inputs
 * drive Pac-Man and the player's input is locked out; the runner plays the frames in real time,
 * with sound. The state is checked against the replay's hashes as it plays.
 */
export class ReplayViewer {
  private replay: Replay | null = null;
  private inputsByTick = new Map<number, Direction[]>();
  private expected = new Map<number, number>();
  private saved: {
    state: GameState;
    log: ReplayLog;
    settings: GameSettings;
  } | null = null;
  private divergedAt: number | null = null;

  constructor(private readonly runner: GameRunner) {}

  public get state(): ReplayViewState {
    const engine = this.runner.engine;
    const r = this.replay;
    return {
      active: r !== null,
      playing: r !== null && !this.runner.pausedBy.includes("replay"),
      startTick: r?.start.tick ?? 0,
      endTick: r?.endTick ?? 0,
      tick: engine.tick,
      divergedAt: this.divergedAt,
    };
  }

  /** Starts watching `replay` from its beginning (playing). */
  public start(replay: Replay): void {
    if (replay.format !== "pacman-replay" || replay.version !== 1) {
      throw new Error("Not a pacman-replay v1 file");
    }
    const engine = this.runner.engine;
    if (!this.saved) {
      this.saved = {
        state: engine.getState(),
        log: engine.replayLog,
        settings: { ...engine.settings },
      };
    }
    this.replay = replay;
    this.inputsByTick.clear();
    for (const [t, dir] of replay.inputs) {
      this.inputsByTick.set(t, [...(this.inputsByTick.get(t) ?? []), dir]);
    }
    this.expected = new Map(replay.checkpoints);
    this.divergedAt = null;
    engine.watchingReplay = true;
    this.seek(replay.start.tick);
    this.play();
  }

  /** Called by the runner before each real-time frame: feeds that frame's recorded inputs. */
  public beforeTick(): void {
    if (!this.replay) return;
    for (const dir of this.inputsByTick.get(this.runner.engine.tick + 1) ?? []) {
      this.runner.engine.setInputDirection(dir, true);
    }
  }

  /** Called after each frame: checks the recorded hash, and stops at the end of the clip. */
  public afterTick(): void {
    if (!this.replay) return;
    const engine = this.runner.engine;
    const hash = this.expected.get(engine.tick);
    if (hash !== undefined && this.divergedAt === null) {
      if (hashGameState(engine.getState()) !== hash) this.divergedAt = engine.tick;
    }
    if (engine.tick >= this.replay.endTick) this.pause();
  }

  public play(): void {
    if (!this.replay) return;
    if (this.runner.engine.tick >= this.replay.endTick) this.seek(this.replay.start.tick);
    this.runner.setPaused("replay", false);
  }

  public pause(): void {
    if (this.replay) this.runner.setPaused("replay", true);
  }

  /** Shows frame `tick` of the replay (rebuilt from its start, silently). Keeps play/pause. */
  public seek(tick: number): void {
    const replay = this.replay;
    if (!replay) return;
    const engine = this.runner.engine;
    const target = Math.max(replay.start.tick, Math.min(tick, replay.endTick));
    playReplay(engine, {
      ...replay,
      endTick: target,
      checkpoints: replay.checkpoints.filter(([t]) => t <= target),
    });
    engine.drainEvents(); // no burst of sounds for the frames skipped
    engine.paused = this.runner.pausedBy.length > 0; // playReplay cleared it
    this.runner.renderer?.render(engine);
    this.runner.syncUi();
  }

  /** Stops watching and puts the live game back exactly as it was, held by the player's pause. */
  public stop(): void {
    const saved = this.saved;
    if (!this.replay || !saved) return;
    const engine = this.runner.engine;
    this.replay = null;
    this.saved = null;
    engine.watchingReplay = false;
    Object.assign(engine.settings, saved.settings);
    engine.setState(saved.state);
    engine.replayLog = saved.log; // setState started a new recording: keep the old one
    engine.pacman.invincible = saved.settings.invincible;
    this.runner.setPaused("replay", false);
    this.runner.setPaused("user", true); // nothing hits the player the moment they return
    engine.drainEvents();
    this.runner.renderer?.render(engine);
    this.runner.syncUi();
  }
}
