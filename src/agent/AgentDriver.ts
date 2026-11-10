import GameEngine from "../game/GameEngine";
import { type Replay, type ReplayResult, playReplay } from "../game/replay";
import type { GameRunner } from "../game/GameRunner";
import type { SimEvent } from "../game/simEvents";
import { type GameState, hashGameState } from "../game/gameState";
import type { HouseState } from "../controllers/HouseController";
import { TILE_SIZE } from "../game/constants";
import type { RoundPhase } from "../game/RoundSequencer";
import { SpeedRecorder, type SpeedReport } from "./SpeedRecorder";
import type {
  DebugLayers,
  Direction,
  ElroyStage,
  GhostBehavior,
  GhostLocation,
  GhostType,
  PlayState,
  TileCoord,
  WaveMode,
} from "../types";

/** Everything an agent usually needs to know about one frame, as plain JSON. */
export interface AgentView {
  frame: number;
  playState: PlayState;
  /** Round phase (READY, PLAYING, GHOST_EATEN_PAUSE, DEATH_FREEZE, ...). */
  phase: RoundPhase;
  /** Frames left in the phase (-1 when untimed). */
  phaseFramesLeft: number;
  level: number;
  score: number;
  lives: number;
  dotsRemaining: number;
  wave: WaveMode;
  waveIndex: number;
  waveTimer: number;
  frightenedFrames: number;
  pacman: {
    x: number;
    y: number;
    col: number;
    row: number;
    dir: Direction;
    nextDir: Direction;
    cornerTarget: number | null;
  };
  ghosts: Record<
    GhostType,
    {
      x: number;
      y: number;
      col: number;
      row: number;
      dir: Direction;
      location: GhostLocation;
      mode: GhostBehavior;
      frightened: boolean;
      /** null while frightened */
      target: TileCoord | null;
      elroyStage: ElroyStage;
      reversalPrimed: boolean;
    }
  >;
  house: HouseState;
}

export interface StepResult {
  frames: number;
  events: SimEvent[];
  view: AgentView;
}

export interface RunUntilResult extends StepResult {
  reached: boolean;
}

/** Where to put an actor: a tile (placed on its center) and a direction. */
export interface Placement {
  col: number;
  row: number;
  dir?: Direction;
}

export interface Scenario {
  level?: number;
  playState?: PlayState;
  /**
   * Removes dots from the maze (plain dots first, in reading order, then energizers) until this
   * many remain. They count as eaten for the fruit counter. It can only remove dots, never add.
   */
  dotsRemaining?: number;
  waveIndex?: number;
  waveTimer?: number;
  /** Starts frightened mode for this level's duration (ghosts reverse, as on an energizer). */
  frightened?: boolean;
  pacman?: Placement;
  ghosts?: Partial<
    Record<GhostType, Placement & { location?: GhostLocation; frightened?: boolean }>
  >;
}

const GHOSTS: GhostType[] = ["BLINKY", "PINKY", "INKY", "CLYDE"];
const center = (tile: number) => tile * TILE_SIZE + TILE_SIZE / 2;

/**
 * A test and debugging driver for agents (and people at the console), in the spirit of a
 * Playwright page object, but for this game's simulation.
 *
 * - Headless: `new AgentDriver(engine)` steps `engine.update()` directly. Use it in tests and
 *   scripts.
 * - In the browser (dev builds): `window.pacmanAgent` wraps the live game. `pause()` stops the
 *   real-time loop, then `step()` / `runUntil()` advance it frame by frame through the runner, so
 *   sounds, the UI and the diagnostics console react exactly as in normal play, and the canvas
 *   is redrawn after every call.
 *
 * All results are plain JSON, so they can be logged, diffed or returned from a browser tool.
 */
export class AgentDriver {
  private recorded: SimEvent[] = [];
  private speedRecorder: SpeedRecorder | null = null;
  private tickCounter: (() => void) | null = null;

  constructor(
    public readonly engine: GameEngine,
    private readonly runner?: GameRunner
  ) {
    if (runner) {
      runner.onEvents = (events) => this.recorded.push(...events);
      runner.onBeforeTick = () => this.speedRecorder?.before();
      runner.onAfterTick = () => {
        this.speedRecorder?.after();
        this.tickCounter?.();
      };
    }
  }

  // --- Real-time loop ---------------------------------------------------------------------------

  /** Stops the real-time loop (browser). Frames then only advance through step()/runUntil(). */
  public pause(): AgentView {
    this.runner?.stop();
    return this.view();
  }

  /** Restarts the real-time loop (browser). */
  public resume(): void {
    this.runner?.start();
  }

  /** Practice time scale (0.25 = slow motion). Only affects the real-time loop. */
  public setSpeed(gameSpeed: number): void {
    this.engine.settings.gameSpeed = gameSpeed;
  }

  // --- Driving ------------------------------------------------------------------------------------

  /** Buffers a joystick direction, like a key press. */
  public input(dir: Direction): AgentView {
    this.engine.setInputDirection(dir);
    return this.view();
  }

  /** Advances exactly `frames` frames. */
  public step(frames: number = 1): StepResult {
    for (let i = 0; i < frames; i++) this.tick();
    return this.result(frames);
  }

  /**
   * Steps until `predicate(view)` is true (checked after every frame) or `maxFrames` pass.
   * In the browser console: `pacmanAgent.runUntil((v) => v.ghosts.PINKY.location === "ACTIVE")`.
   */
  public runUntil(
    predicate: (view: AgentView) => boolean,
    maxFrames: number = 600
  ): RunUntilResult {
    for (let i = 1; i <= maxFrames; i++) {
      this.tick();
      const view = this.view();
      if (predicate(view)) return { ...this.result(i, view), reached: true };
    }
    return { ...this.result(maxFrames), reached: false };
  }

  /** Steps `frames` frames and samples `pick(view)` after each one (default: the whole view). */
  public trace<T = AgentView>(
    frames: number,
    pick: (view: AgentView) => T = (v) => v as unknown as T
  ): T[] {
    const samples: T[] = [];
    for (let i = 0; i < frames; i++) {
      this.tick();
      samples.push(pick(this.view()));
    }
    this.render();
    return samples;
  }

  // --- Setup --------------------------------------------------------------------------------------

  /**
   * Arranges a situation to test. Loads the level first when `level` is given (fresh maze,
   * timers, house), then applies the other fields on top.
   */
  public scenario(s: Scenario): AgentView {
    const e = this.engine;
    if (s.level !== undefined) e.initGame(e.mode, s.level);
    if (s.dotsRemaining !== undefined) this.clearDotsDownTo(s.dotsRemaining);
    if (s.waveIndex !== undefined) e.timerController.waveIndex = s.waveIndex;
    if (s.waveTimer !== undefined) e.timerController.waveTimer = s.waveTimer;
    if (s.waveIndex !== undefined || s.waveTimer !== undefined) {
      const wave = e.timerController.currentWave?.mode ?? "CHASE";
      for (const type of GHOSTS) e.ghosts[type].wave = wave;
    }
    if (s.pacman) {
      const p = e.pacman;
      p.x = center(s.pacman.col);
      p.y = center(s.pacman.row);
      p.cornerTarget = null;
      if (s.pacman.dir) {
        p.dir = s.pacman.dir;
        p.nextDir = s.pacman.dir;
      }
    }
    for (const type of GHOSTS) {
      const g = s.ghosts?.[type];
      if (!g) continue;
      const ghost = e.ghosts[type];
      ghost.x = center(g.col);
      ghost.y = center(g.row);
      ghost.location = g.location ?? "ACTIVE";
      ghost.lastOccupiedTile = { col: g.col, row: g.row };
      ghost.lastDecisionTile = undefined;
      ghost.reversalPrimed = false;
      if (g.dir) {
        ghost.dir = g.dir;
        ghost.nextDir = g.dir;
      }
      if (g.frightened !== undefined) ghost.frightened = g.frightened;
    }
    if (s.frightened) e.triggerFrightenedMode();
    if (s.playState) e.playState = s.playState;
    e.replayLog.reset(e); // the edits above are not inputs: recordings start from here
    this.render();
    return this.view();
  }

  /** The complete state, for later load(). */
  public save(): GameState {
    return this.engine.getState();
  }

  public load(state: GameState): AgentView {
    this.engine.setState(state);
    this.render();
    return this.view();
  }

  /** Hash of the complete state: equal hashes mean identical games. */
  public hash(): number {
    return hashGameState(this.engine.getState());
  }

  // --- Debug overlay (T1-T3) -----------------------------------------------------------------

  /**
   * Shows the debug overlay (`true`), hides it (`false`), or switches layers on and off
   * (`{ readout: true, grid: false }`, which also shows it). Returns the current layers.
   */
  public debug(layers: boolean | Partial<DebugLayers> = true): DebugLayers {
    const settings = this.engine.settings;
    if (typeof layers === "boolean") settings.debugOverlay = layers;
    else {
      settings.debugOverlay = true;
      settings.debugLayers = { ...settings.debugLayers, ...layers };
    }
    this.render();
    return { ...settings.debugLayers };
  }

  // --- Replays (T4) ---------------------------------------------------------------------------

  /**
   * The engine's rolling recording as a replay: (at least) the last `seconds` of play up to now,
   * or everything kept (about two minutes) without `seconds`.
   */
  public saveReplay(seconds?: number): Replay {
    return this.engine.replayLog.export(this.engine, seconds);
  }

  /** Browser: saves `saveReplay(seconds)` as a .json file (attach it to a bug report). */
  public downloadReplay(seconds?: number): Replay {
    const replay = this.saveReplay(seconds);
    const blob = new Blob([JSON.stringify(replay)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pacman-replay-L${replay.start.level}-t${replay.endTick}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    return replay;
  }

  /**
   * Re-runs a replay headless on a separate engine (the live game is untouched) and checks every
   * state hash. `divergedAt` is the first tick that no longer matches.
   */
  public verifyReplay(replay: Replay): ReplayResult {
    return playReplay(new GameEngine(replay.start.mode, 0), replay);
  }

  /**
   * Fast-forwards this engine (the live game, in the browser) through a replay, to its end or to
   * tick `stopAt`, and leaves it paused there: inspect it, step it, or `resume()`.
   */
  public loadReplay(replay: Replay, stopAt?: number): ReplayResult & { view: AgentView } {
    this.runner?.stop();
    const end = stopAt === undefined ? replay.endTick : Math.min(stopAt, replay.endTick);
    const result = playReplay(this.engine, {
      ...replay,
      endTick: end,
      checkpoints: replay.checkpoints.filter(([t]) => t <= end),
    });
    this.engine.drainEvents(); // no burst of sounds for the frames skipped
    this.render();
    return { ...result, view: this.view() };
  }

  // --- Speed recording -------------------------------------------------------------------------

  /**
   * Starts (or restarts) recording how far every actor moves per play frame, by speed source.
   * Works in live play too: call it, play normally, then read `speedReport()`.
   */
  public recordSpeeds(): void {
    this.speedRecorder = new SpeedRecorder(this.engine);
  }

  /** Measured vs table speed per actor and source, plus real ticks per second (live play). */
  public speedReport(): SpeedReport | null {
    return this.speedRecorder?.report() ?? null;
  }

  /**
   * Counts real-time ticks over the next `seconds` (browser, loop running). Keep the tab visible
   * while it runs. Expect 60.606 × practice speed with arcade timing (60 × without).
   */
  public async measureTickRate(seconds: number = 5): Promise<{
    ticksPerSecond: number;
    expected: number;
    animationFramesPerSecond: number;
  }> {
    if (!this.runner) throw new Error("measureTickRate needs the live game (window.pacmanAgent)");
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
      expected: round(this.runner.ticksPerSecond),
      animationFramesPerSecond: round(frames / elapsed),
    };
  }

  /** Stops recording and returns the final report. */
  public stopSpeeds(): SpeedReport | null {
    const report = this.speedReport();
    this.speedRecorder = null;
    return report;
  }

  // --- Observation --------------------------------------------------------------------------------

  public view(): AgentView {
    const e = this.engine;
    const p = e.pacman;
    const ghosts = {} as AgentView["ghosts"];
    for (const type of GHOSTS) {
      const g = e.ghosts[type];
      const tile = g.tileCoord;
      ghosts[type] = {
        x: g.x,
        y: g.y,
        col: tile.col,
        row: tile.row,
        dir: g.dir,
        location: g.location,
        mode: g.mode,
        frightened: g.frightened,
        target: g.target && { ...g.target },
        elroyStage: g.elroyStage,
        reversalPrimed: g.reversalPrimed,
      };
    }
    const pacTile = p.tileCoord;
    return {
      frame: e.currLevelFrame,
      playState: e.playState,
      phase: e.phase,
      phaseFramesLeft: e.phaseFramesLeft,
      level: e.level,
      score: e.score,
      lives: e.lives,
      dotsRemaining: e.dotsRemaining,
      wave: e.timerController.currentWave?.mode ?? "CHASE",
      waveIndex: e.timerController.waveIndex,
      waveTimer: e.timerController.waveTimer,
      frightenedFrames: e.timerController.frightenedGlobalTimer,
      pacman: {
        x: p.x,
        y: p.y,
        col: pacTile.col,
        row: pacTile.row,
        dir: p.dir,
        nextDir: p.nextDir,
        cornerTarget: p.cornerTarget,
      },
      ghosts,
      house: {
        ...e.houseController.state,
        dotCounters: { ...e.houseController.state.dotCounters },
      },
    };
  }

  /** Sim events since the last call (sounds, score, lives, ghost eaten, ...). */
  public events(): SimEvent[] {
    this.collectHeadless();
    const events = this.recorded;
    this.recorded = [];
    return events;
  }

  /** Diagnostics rules that have failed at least once, plus the latest log entries. */
  public diagnostics(logCount: number = 10) {
    const d = this.engine.diagnosticController;
    return {
      failing: d.rules
        .filter((r) => r.failures > 0)
        .map((r) => ({ id: r.id, failures: r.failures, lastMessage: r.lastFailureMessage })),
      logs: d.logs.slice(0, logCount),
    };
  }

  // --- Internals ----------------------------------------------------------------------------------

  private tick(): void {
    if (this.runner) {
      this.runner.tick();
    } else {
      this.speedRecorder?.before();
      this.engine.update();
      this.speedRecorder?.after();
      this.engine.diagnosticController.evaluateRules(this.engine, this.engine.currLevelFrame);
      this.collectHeadless();
    }
  }

  /** Without a runner nobody drains the engine's events, so the driver keeps them itself. */
  private collectHeadless(): void {
    if (!this.runner) this.recorded.push(...this.engine.drainEvents());
  }

  private clearDotsDownTo(target: number): void {
    const e = this.engine;
    if (target > e.dotsRemaining) {
      throw new Error(`dotsRemaining: only ${e.dotsRemaining} dots are left, cannot set ${target}`);
    }
    for (const kind of ["DOT", "ENERGIZER"] as const) {
      for (const row of e.maze.tiles) {
        for (let col = 0; col < row.length && e.dotsRemaining > target; col++) {
          if (row[col] !== kind) continue;
          row[col] = "EMPTY";
          e.dotsRemaining--;
          e.dotsEatenThisRound++;
        }
      }
    }
  }

  /** Redraws the canvas and pushes the HUD values to the UI (browser). */
  private render(): void {
    this.runner?.renderer?.render(this.engine);
    this.runner?.syncUi();
  }

  private result(frames: number, view: AgentView = this.view()): StepResult {
    this.render();
    return { frames, events: this.events(), view };
  }
}

declare global {
  interface Window {
    /** Dev builds only: the agent driver for the running game (see docs/AGENT_DRIVER.md). */
    pacmanAgent?: AgentDriver;
  }
}
