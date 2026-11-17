import soundEngine from "../audio/SoundEngine";
import GameEvents from "../core/EventBus";
import { GameLoopController } from "../controllers/GameLoopController";
import type GameEngine from "./GameEngine";
import type GameRenderer from "./GameRenderer";
import type { SimEvent } from "./simEvents";
import { ReplayViewer } from "./ReplayViewer";
import { PracticeTools } from "./practiceTools";
import { LatencyMeter } from "./latencyMeter";
import { ScorePopups } from "./scorePopups";
import { ARCADE_REFRESH_HZ, SIM_FPS } from "./constants";

/** Why the game is held: the player (pause key or button), an open panel, or the agent driver. */
export type PauseReason = "user" | "panel" | "agent" | "replay";

/**
 * The shell around the pure simulation. It owns everything with side effects: the real-time
 * loop, the renderer, audio, the UI event bus and the diagnostics pass. `GameEngine` only
 * updates state and queues `SimEvent`s; this class runs a tick, then dispatches what it queued.
 */
export class GameRunner {
  public readonly loop: GameLoopController;
  /** Watches replays inside the game (T12). */
  public readonly viewer: ReplayViewer = new ReplayViewer(this);
  /** Pattern recorder and first-death heatmap (Phase 5). */
  public readonly practice = new PracticeTools();
  /** Input-to-screen latency readout (Phase 5). */
  public readonly latency = new LatencyMeter();
  /** The floating fruit points (plan P2). */
  public readonly popups = new ScorePopups();
  public renderer: GameRenderer | null = null;
  /** Called before every tick (gamepad polling). */
  public onPreUpdate?: () => void;
  /** Observers around every tick, in live play too (the agent driver's speed recorder). */
  public onBeforeTick?: () => void;
  public onAfterTick?: () => void;
  /** Receives every batch of sim events after it is dispatched (used by the agent driver). */
  public onEvents?: (events: SimEvent[]) => void;
  /** Whether the real-time loop is running (false while an agent drives frames by hand). */
  public get running(): boolean {
    return this.loop.isRunning;
  }

  /**
   * Who is holding the game (plan T11). The game runs only when nobody is: closing a panel
   * never resumes a game the player or the agent paused.
   */
  private pauses = new Set<PauseReason>();
  /** Inside stepWhilePaused: the hold is lifted on purpose for the stepped frames. */
  private stepping = false;

  public get pausedBy(): PauseReason[] {
    return [...this.pauses];
  }

  /** Adds or removes one reason to hold the game. */
  public setPaused(reason: PauseReason, paused: boolean): void {
    const before = this.pauses.size > 0;
    if (paused) this.pauses.add(reason);
    else this.pauses.delete(reason);
    this.engine.paused = this.pauses.size > 0;
    if (this.engine.paused !== before) {
      GameEvents.emit("PLAY_STATE_CHANGED", this.engine.playState);
    }
    this.syncSiren();
  }

  /** Ticks the real-time loop runs per real second: 60.606 (arcade) or 60, × practice speed. */
  public get ticksPerSecond(): number {
    const { gameSpeed, arcadeRefreshRate } = this.engine.settings;
    return (arcadeRefreshRate ? ARCADE_REFRESH_HZ : SIM_FPS) * gameSpeed;
  }

  constructor(public readonly engine: GameEngine) {
    this.loop = new GameLoopController(
      () => this.tick(),
      () => {
        this.renderer?.render(this.engine);
        this.latency.afterRender(performance.now());
      },
      // Practice speed and the arcade refresh rate change how many ticks run per real second,
      // never what a tick does.
      () => this.ticksPerSecond / GameLoopController.LOGIC_FPS
    );
  }

  public start(): void {
    this.loop.start();
    this.flush();
    GameEvents.emit("PLAY_STATE_CHANGED", this.engine.playState);
  }

  public stop(): void {
    this.loop.stop();
    soundEngine.stopSiren();
  }

  /**
   * Frame stepping while the game is paused (plan T3): runs up to `maxFrames` frames, stopping
   * early once `until()` is true, then holds again. Returns the frames run (0 when not paused, or
   * while rewinding).
   */
  public stepWhilePaused(maxFrames: number, until?: () => boolean, render = true): number {
    const engine = this.engine;
    if (!engine.paused || engine.rewindIndex !== -1) return 0;
    engine.paused = false;
    this.stepping = true;
    let frames = 0;
    try {
      while (frames < maxFrames) {
        this.tick();
        frames++;
        if (until?.()) break;
      }
    } finally {
      this.stepping = false;
      engine.paused = true;
    }
    if (render) this.renderer?.render(engine);
    return frames;
  }

  /** Runs one simulation tick and everything that follows it. */
  public tick(): void {
    // The runner owns pausing (T11): engine calls such as setting playState or starting a new
    // game clear the engine's flag, so re-apply who holds the game before every frame.
    if (!this.stepping) this.engine.paused = this.pauses.size > 0;
    this.onPreUpdate?.();
    this.viewer.beforeTick();
    this.onBeforeTick?.();
    const before = this.engine.tick;
    this.engine.update();
    if (this.engine.tick !== before) {
      this.practice.afterTick(this.engine);
      this.latency.afterTick();
      this.popups.afterTick(this.engine);
    }
    this.onAfterTick?.();
    this.viewer.afterTick();
    this.flush();

    // Runtime invariants cost time every frame: dev builds, or with the console open (T8).
    // In CI the same rules run in the soak tests, which require zero failures.
    const consoleOpen = this.engine.settings.showDiagnosticConsole;
    if (this.engine.phase === "PLAYING" && (import.meta.env.DEV || consoleOpen)) {
      this.engine.diagnosticController.evaluateRules(this.engine, this.engine.lifeFrame);
      if (consoleOpen && this.engine.lifeFrame % 4 === 0) {
        GameEvents.emit("DIAGNOSTICS_TICK", this.engine.getActorsDiagnostics());
      }
    }
  }

  /** Dispatches queued sim events and syncs the siren. Also call after engine calls made between ticks. */
  public flush(): void {
    const events = this.engine.drainEvents();
    for (const event of events) dispatchSimEvent(event);
    if (events.length > 0) {
      this.practice.onEvents(this.engine, events);
      this.popups.onEvents(events);
      this.onEvents?.(events);
    }
    this.syncSiren();
  }

  /**
   * Pushes the current score, lives, level and play state to the UI, even when nothing changed
   * through an event (state loaded or edited between ticks). Panels that read the engine directly
   * re-render on `UI_SYNC`.
   */
  public syncUi(): void {
    this.popups.clear(); // the state changed from outside: no points float over it
    this.flush();
    const e = this.engine;
    GameEvents.emit("SCORE_CHANGED", { score: e.score, highScore: e.highScore });
    GameEvents.emit("LIVES_CHANGED", e.lives);
    GameEvents.emit("LEVEL_CHANGED", e.level);
    GameEvents.emit("PLAY_STATE_CHANGED", e.playState);
    GameEvents.emit("UI_SYNC");
  }

  private syncSiren(): void {
    const siren = this.engine.getSirenState();
    if (!this.engine.settings.soundEnabled || siren.kind === "OFF") {
      soundEngine.stopSiren();
    } else if (siren.kind === "NORMAL") {
      soundEngine.updateSiren("NORMAL", siren.stage);
    } else {
      soundEngine.updateSiren(siren.kind);
    }
  }
}

/** Maps one sim event to its sounds and UI bus notifications. */
function dispatchSimEvent(event: SimEvent): void {
  switch (event.type) {
    case "SCORE_CHANGED":
      GameEvents.emit("SCORE_CHANGED", { score: event.score, highScore: event.highScore });
      break;
    case "LIVES_CHANGED":
      GameEvents.emit("LIVES_CHANGED", event.lives);
      break;
    case "LEVEL_CHANGED":
      GameEvents.emit("LEVEL_CHANGED", event.level);
      break;
    case "PLAY_STATE_CHANGED":
      GameEvents.emit("PLAY_STATE_CHANGED", event.playState);
      GameEvents.emit("ROUND_STATE_CHANGED", event.playState);
      break;
    case "GAME_OVER":
      GameEvents.emit("GAME_OVER", event.score);
      break;
    case "LEVEL_CLEARED":
      GameEvents.emit("LEVEL_CLEARED", event.level);
      break;
    case "DOT_EATEN":
      soundEngine.playWaka();
      break;
    case "ENERGIZER_EATEN":
      soundEngine.playWaka();
      GameEvents.emit("ENERGIZER_EATEN", { level: event.level });
      break;
    case "GHOST_EATEN":
      soundEngine.playEatGhost();
      GameEvents.emit("GHOST_EATEN", { type: event.ghost, points: event.points });
      break;
    case "FRUIT_EATEN":
      soundEngine.playEatFruit();
      GameEvents.emit("FRUIT_EATEN", event.points);
      break;
    case "REWOUND":
      GameEvents.emit("REWOUND", event.playState);
      break;
    case "EXTRA_LIFE":
      soundEngine.playExtraLife();
      break;
    case "INTRO":
      soundEngine.playIntro().catch(() => {
        /* audio may be blocked until the first user gesture */
      });
      break;
    case "PACMAN_DIED":
      soundEngine.playDeath().catch(() => {
        /* audio may be blocked until the first user gesture */
      });
      break;
  }
}
