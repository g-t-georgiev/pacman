import type { Direction, GameSettings } from "../types";
import { type GameState, hashGameState } from "./gameState";
import type GameEngine from "./GameEngine";

/**
 * Input recording and replay (plan T4), also the basis of rewind (T7).
 *
 * The sim is deterministic: the same state plus the same inputs on the same ticks always gives
 * the same game. So a replay is a starting state (a keyframe), the joystick inputs after it keyed
 * on the tick they precede, and state hashes along the way to prove the replay reproduced the
 * original exactly, or to show where it stopped matching.
 */

/** Settings that change what a tick does (everything else is presentation). */
export interface SimSettings {
  emulateRomQuirks: boolean;
  invincible: boolean;
  turbo: boolean;
  turboSpeedMultiplier: number;
}

export interface Replay {
  format: "pacman-replay";
  version: 1;
  settings: SimSettings;
  start: GameState;
  /** [tick, direction]: applied right before the sim frame with that tick number runs. */
  inputs: Array<[number, Direction]>;
  /** [tick, hash of the state after that tick], every CHECKPOINT_TICKS and at the end. */
  checkpoints: Array<[number, number]>;
  /** The tick the replay ends on (the state after it is the last checkpoint). */
  endTick: number;
}

export interface ReplayResult {
  /** Sim frames run. */
  ticks: number;
  /** Every checkpoint hash matched. */
  matched: boolean;
  /** First checkpoint whose hash did not match, or null. */
  divergedAt: number | null;
  /** The last checkpoint that still matched before it (the divergence is in between). */
  lastMatchedAt: number | null;
}

/** A state hash every second. */
export const CHECKPOINT_TICKS = 60;
/** A full keyframe every second (rewind re-simulates at most this many frames)... */
export const KEYFRAME_TICKS = 60;
/** ...keeping the last two minutes. */
export const MAX_KEYFRAMES = 121;

export function simSettingsOf(settings: GameSettings): SimSettings {
  const { emulateRomQuirks, invincible, turbo, turboSpeedMultiplier } = settings;
  return { emulateRomQuirks, invincible, turbo, turboSpeedMultiplier };
}

function sameSettings(a: SimSettings, b: SimSettings): boolean {
  return (
    a.emulateRomQuirks === b.emulateRomQuirks &&
    a.invincible === b.invincible &&
    a.turbo === b.turbo &&
    a.turboSpeedMultiplier === b.turboSpeedMultiplier
  );
}

interface Keyframe {
  state: GameState;
  settings: SimSettings;
}

/**
 * The engine's rolling recording: keyframes, every input since the oldest one, and checkpoint
 * hashes. Anything that edits the state outside a tick (loading a state, a new game, a scenario)
 * or changes a sim setting starts it over from the current state.
 */
export class ReplayLog {
  private keyframes: Keyframe[] = [];
  private inputs: Array<[number, Direction]> = [];
  private checkpoints: Array<[number, number]> = [];
  /** The newest tick recorded. */
  private head = 0;

  /** Starts over from the engine's current state. */
  public reset(engine: GameEngine): void {
    this.keyframes = [{ state: engine.getState(), settings: simSettingsOf(engine.settings) }];
    this.inputs = [];
    this.checkpoints = [];
    this.head = engine.tick;
  }

  /** The oldest tick that can be rebuilt (the oldest keyframe). */
  public get oldestTick(): number {
    return this.keyframes[0]?.state.tick ?? this.head;
  }

  /** The newest tick recorded. */
  public get headTick(): number {
    return this.head;
  }

  /** The newest keyframe at or before `tick`, and the inputs from it up to `tick` (rewind). */
  public pathTo(tick: number): { start: GameState; inputs: Array<[number, Direction]> } {
    let start = this.keyframes[0];
    for (const k of this.keyframes) if (k.state.tick <= tick) start = k;
    const from = start.state.tick;
    return { start: start.state, inputs: this.inputs.filter(([t]) => t > from && t <= tick) };
  }

  /** Forgets everything after `tick` (play resumes from there after a rewind). */
  public truncate(tick: number): void {
    this.keyframes = this.keyframes.filter((k) => k.state.tick <= tick);
    this.inputs = this.inputs.filter(([t]) => t <= tick);
    this.checkpoints = this.checkpoints.filter(([t]) => t <= tick);
    this.head = tick;
  }

  /** Logs a joystick input, to be applied before the next sim frame (tick + 1). */
  public onInput(engine: GameEngine, dir: Direction): void {
    this.inputs.push([engine.tick + 1, dir]);
  }

  /** Call after every sim frame that ran. */
  public afterTick(engine: GameEngine): void {
    const latest = this.keyframes[this.keyframes.length - 1];
    if (!latest) return this.reset(engine);
    // A sim setting changed between keyframes: older inputs would no longer replay the same way
    if (!sameSettings(latest.settings, simSettingsOf(engine.settings))) return this.reset(engine);

    const tick = engine.tick;
    this.head = tick;
    if (tick % CHECKPOINT_TICKS === 0) {
      this.checkpoints.push([tick, hashGameState(engine.getState())]);
    }
    if (tick - latest.state.tick >= KEYFRAME_TICKS) {
      this.keyframes.push({ state: engine.getState(), settings: simSettingsOf(engine.settings) });
      if (this.keyframes.length > MAX_KEYFRAMES) {
        this.keyframes.shift();
        const from = this.keyframes[0].state.tick;
        this.inputs = this.inputs.filter(([t]) => t > from);
        this.checkpoints = this.checkpoints.filter(([t]) => t > from);
      }
    }
  }

  /**
   * A replay of (at least) the last `seconds` of play, up to now, starting from the newest
   * keyframe that far back (or the oldest one kept). Without `seconds`, everything kept.
   */
  public export(engine: GameEngine, seconds?: number): Replay {
    const now = engine.tick;
    const wanted = seconds === undefined ? -Infinity : now - Math.round(seconds * 60);
    let start = this.keyframes[0];
    for (const k of this.keyframes) if (k.state.tick <= wanted) start = k;
    const from = start.state.tick;
    const checkpoints = this.checkpoints.filter(([t]) => t > from);
    const endHash = hashGameState(engine.getState());
    if (checkpoints[checkpoints.length - 1]?.[0] !== now) checkpoints.push([now, endHash]);
    return {
      format: "pacman-replay",
      version: 1,
      settings: { ...start.settings },
      start: structuredClone(start.state),
      inputs: this.inputs.filter(([t]) => t > from),
      checkpoints: now > from ? checkpoints : [],
      endTick: now,
    };
  }
}

/**
 * Records a replay by driving `engine` for `ticks` frames, asking `chooseInput(tick)` for a
 * joystick direction (or null) before each one. Used to build golden replays.
 */
export function recordReplay(
  engine: GameEngine,
  ticks: number,
  chooseInput: (tick: number) => Direction | null
): Replay {
  engine.replayLog.reset(engine);
  const start = engine.getState();
  const settings = simSettingsOf(engine.settings);
  const inputs: Array<[number, Direction]> = [];
  const checkpoints: Array<[number, number]> = [];
  for (let i = 0; i < ticks; i++) {
    const next = engine.tick + 1;
    const dir = chooseInput(next);
    if (dir) {
      inputs.push([next, dir]);
      engine.setInputDirection(dir);
    }
    stepOrThrow(engine);
    if (engine.tick % CHECKPOINT_TICKS === 0 || i === ticks - 1) {
      checkpoints.push([engine.tick, hashGameState(engine.getState())]);
    }
  }
  engine.drainEvents();
  return {
    format: "pacman-replay",
    version: 1,
    settings,
    start,
    inputs,
    checkpoints,
    endTick: engine.tick,
  };
}

/**
 * Plays a replay on `engine` (its state is replaced) and checks every checkpoint. `onTick` runs
 * after each frame (rendering, events). Stops at the first checkpoint that does not match.
 */
export function playReplay(engine: GameEngine, replay: Replay, onTick?: () => void): ReplayResult {
  if (replay.format !== "pacman-replay" || replay.version !== 1) {
    throw new Error("Not a pacman-replay v1 file");
  }
  Object.assign(engine.settings, replay.settings);
  if (engine.pacman) engine.pacman.invincible = replay.settings.invincible;
  engine.setState(replay.start);
  engine.paused = false;
  engine.rewindIndex = -1;

  const inputsByTick = new Map<number, Direction[]>();
  for (const [t, dir] of replay.inputs) {
    const list = inputsByTick.get(t) ?? [];
    list.push(dir);
    inputsByTick.set(t, list);
  }
  const expected = new Map(replay.checkpoints);

  let ticks = 0;
  let lastMatchedAt: number | null = null;
  while (engine.tick < replay.endTick) {
    for (const dir of inputsByTick.get(engine.tick + 1) ?? []) engine.setInputDirection(dir);
    stepOrThrow(engine);
    ticks++;
    onTick?.();
    const hash = expected.get(engine.tick);
    if (hash === undefined) continue;
    if (hashGameState(engine.getState()) !== hash) {
      return { ticks, matched: false, divergedAt: engine.tick, lastMatchedAt };
    }
    lastMatchedAt = engine.tick;
  }
  return { ticks, matched: true, divergedAt: null, lastMatchedAt };
}

function stepOrThrow(engine: GameEngine): void {
  const before = engine.tick;
  engine.update();
  if (engine.tick !== before + 1) {
    throw new Error(`Replay stalled at tick ${before}: the engine is paused or rewinding`);
  }
}
