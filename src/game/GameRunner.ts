import soundEngine from "../audio/SoundEngine";
import GameEvents from "../core/EventBus";
import { GameLoopController } from "../controllers/GameLoopController";
import type GameEngine from "./GameEngine";
import type GameRenderer from "./GameRenderer";
import type { SimEvent } from "./simEvents";
import { ARCADE_REFRESH_HZ, SIM_FPS } from "./constants";

/**
 * The shell around the pure simulation. It owns everything with side effects: the real-time
 * loop, the renderer, audio, the UI event bus and the diagnostics pass. `GameEngine` only
 * updates state and queues `SimEvent`s; this class runs a tick, then dispatches what it queued.
 */
export class GameRunner {
  public readonly loop: GameLoopController;
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

  /** Ticks the real-time loop runs per real second: 60.606 (arcade) or 60, × practice speed. */
  public get ticksPerSecond(): number {
    const { gameSpeed, arcadeRefreshRate } = this.engine.settings;
    return (arcadeRefreshRate ? ARCADE_REFRESH_HZ : SIM_FPS) * gameSpeed;
  }

  constructor(public readonly engine: GameEngine) {
    this.loop = new GameLoopController(
      () => this.tick(),
      () => this.renderer?.render(this.engine),
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
  public stepWhilePaused(maxFrames: number, until?: () => boolean): number {
    const engine = this.engine;
    if (!engine.paused || engine.rewindIndex !== -1) return 0;
    engine.paused = false;
    let frames = 0;
    try {
      while (frames < maxFrames) {
        this.tick();
        frames++;
        if (until?.()) break;
      }
    } finally {
      engine.paused = true;
    }
    this.renderer?.render(engine);
    return frames;
  }

  /** Runs one simulation tick and everything that follows it. */
  public tick(): void {
    this.onPreUpdate?.();
    this.onBeforeTick?.();
    this.engine.update();
    this.onAfterTick?.();
    this.flush();

    if (this.engine.phase === "PLAYING") {
      this.engine.diagnosticController.evaluateRules(this.engine, this.engine.currLevelFrame);
      if (this.engine.currLevelFrame % 4 === 0) {
        GameEvents.emit("DIAGNOSTICS_TICK", this.engine.getActorsDiagnostics());
      }
    }
  }

  /** Dispatches queued sim events and syncs the siren. Also call after engine calls made between ticks. */
  public flush(): void {
    const events = this.engine.drainEvents();
    for (const event of events) dispatchSimEvent(event);
    if (events.length > 0) this.onEvents?.(events);
    this.syncSiren();
  }

  /**
   * Pushes the current score, lives, level and play state to the UI, even when nothing changed
   * through an event (state loaded or edited between ticks). Panels that read the engine directly
   * re-render on `UI_SYNC`.
   */
  public syncUi(): void {
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
      soundEngine.updateSiren("NORMAL", siren.dotsRatio);
    } else {
      soundEngine.updateSiren(siren.kind);
    }
  }
}

/** Maps one sim event to its sounds and UI bus notifications. */
export function dispatchSimEvent(event: SimEvent): void {
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
    case "EXTRA_LIFE":
      soundEngine.playExtraLife();
      break;
    case "PACMAN_DIED":
      soundEngine.playDeath().catch(() => {
        /* audio may be blocked until the first user gesture */
      });
      break;
  }
}
