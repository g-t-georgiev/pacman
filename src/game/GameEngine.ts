import { Timeline } from "./timeline";
import type {
  Direction,
  FruitItem,
  GameMode,
  GameSettings,
  RuleSettings,
  GhostType,
  MazeData,
  PlayState,
} from "../types";
import { getSpeedConfigForLevel } from "./levelTable";
import { EXTRA_LIFE_SCORE } from "./constants";
import type { Pacman } from "../core/Pacman";
import type { Ghost } from "../core/Ghost";
import { PRNG } from "../core/PRNG";
import { SimRandom } from "../core/SimRandom";
import {
  MAZE_FLASH_TOGGLE_FRAMES,
  PHASE_PLAY_STATE,
  READY_FRAMES_GAME_START,
  type RoundPhase,
  RoundSequencer,
} from "./RoundSequencer";
import { TimerController } from "../controllers/TimerController";
import { GhostAiController } from "../controllers/GhostAiController";
import { MovementController } from "../controllers/MovementController";
import { HouseController } from "../controllers/HouseController";
import { DiagnosticController } from "../diagnostics/DiagnosticController";
import { RULESETS, type Ruleset } from "./rulesets";
import type { SimEvent, SirenState } from "./simEvents";
import { sirenStateOf } from "./siren";
import { checkCollisions, triggerFrightenedMode } from "./sim/collisions";
import { spawnFruit, updateFruit } from "./sim/fruit";
import { spawnActors } from "./sim/spawn";
import { moveActiveGhost, moveGhosts, movePacman } from "./sim/movement";
import { defaultRules, defaultSettings } from "./settings";
import { type GameState, applyState, captureState } from "./gameState";
import { ReplayLog } from "./replay";

/**
 * The simulation. It only updates state and queues SimEvents; it never plays audio, touches the
 * UI event bus or reads the clock. GameRunner is the shell that drives it in real time.
 */
export default class GameEngine {
  public mode: GameMode = "PACMAN";

  /** What this mode does differently (maze, fruit, looks): plan A4. */
  public get ruleset(): Ruleset {
    return RULESETS[this.mode];
  }

  /** The timed round phases (READY, PLAYING, the eat pause, the death and level-clear steps). */
  public sequencer: RoundSequencer = new RoundSequencer();
  /** User pause (Practice panel, P key). Orthogonal to the round phase. */
  public paused: boolean = false;

  public get phase(): RoundPhase {
    return this.sequencer.phase;
  }

  /** The coarse state the UI shows, derived from the round phase and the pause flag. */
  public get playState(): PlayState {
    return this.paused ? "PAUSED" : PHASE_PLAY_STATE[this.sequencer.phase];
  }

  /** The rules a tick follows (plan P1); recorded in replays. */
  public readonly rules: RuleSettings = defaultRules();

  /** Display, sound, loop timing, input feel and views (plan P1); never recorded. */
  public readonly settings: GameSettings = defaultSettings();

  public maze!: MazeData;
  public score: number = 0;
  public highScore: number = 0;
  public level: number = 1;
  public lives: number = 3;
  public dotsRemaining: number = 0;
  public totalDots: number = 0;
  public dotsEatenThisLevel: number = 0;
  /** The one bonus life of a game has been given. */
  public extraLifeAwarded: boolean = false;

  public fruit: FruitItem | null = null;
  public eatenGhostsInEnergizer: number = 0;

  /** Frames since the level (or the current life) started. Indexes the 16-frame speed masks. */
  public lifeFrame: number = 0;
  /** Sim frames since the game started (never reset mid-game). Replays key inputs on it. */
  public tick: number = 0;

  /** Events queued during this tick, for the shell to dispatch (see GameRunner). */
  private outbox: SimEvent[] = [];

  /** The sim's only source of randomness. Reset at every level start and after every life lost. */
  public prng: PRNG = new PRNG();
  /** Randomness that isn't the ghosts' (fruit timer). Reset only when a game starts. */
  public simRandom: SimRandom = new SimRandom();
  /** Rolling input recording (keyframes, inputs, hashes) for replays and bug reports (T4). */
  public replayLog: ReplayLog = new ReplayLog();
  /** Rewinding and scrubbing through the recording (plan P4). */
  public readonly timeline: Timeline = new Timeline(this);

  // Modular Controllers
  public timerController: TimerController = new TimerController(1);
  public ghostAiController: GhostAiController = new GhostAiController(this.rules, this.prng);
  public movementController: MovementController = new MovementController();
  public houseController: HouseController = new HouseController();
  public diagnosticController: DiagnosticController = new DiagnosticController();

  // Actors
  public pacman!: Pacman;
  public ghosts!: Record<GhostType, Ghost>;

  public get waveIndex(): number {
    return this.timerController.waveIndex;
  }
  public set waveIndex(v: number) {
    this.timerController.waveIndex = v;
  }

  public get waveTimer(): number {
    return this.timerController.waveTimer;
  }
  public set waveTimer(v: number) {
    this.timerController.waveTimer = v;
  }

  public get frightenedGlobalTimer(): number {
    return this.timerController.frightenedGlobalTimer;
  }
  public set frightenedGlobalTimer(v: number) {
    this.timerController.frightenedGlobalTimer = v;
  }

  /** Frames left in the current round phase (READY countdown, eat pause, ...). */
  public get phaseFramesLeft(): number {
    return this.sequencer.state.framesLeft;
  }

  /** Ghosts vanish once the death animation starts (through game over) and while the maze flashes. */
  public get ghostsVisible(): boolean {
    const phase = this.sequencer.phase;
    return (
      phase !== "DEATH_ANIM" &&
      phase !== "DEATH_WAIT" &&
      phase !== "MAZE_FLASH" &&
      phase !== "GAME_OVER" // after the last death they stay gone
    );
  }

  /** Pac-Man is hidden while a ghost's score is shown, and after the death animation. */
  public get pacmanVisible(): boolean {
    const phase = this.sequencer.phase;
    return phase !== "GHOST_EATEN_PAUSE" && phase !== "DEATH_WAIT" && phase !== "GAME_OVER";
  }

  /** While the maze flashes after a level clear: whether the walls are white this frame. */
  public get isMazeFlashWhite(): boolean {
    const { phase, framesLeft } = this.sequencer.state;
    return phase === "MAZE_FLASH" && Math.floor(framesLeft / MAZE_FLASH_TOGGLE_FRAMES) % 2 === 1;
  }

  /**
   * While scrubbing: how many frames after the oldest rewindable one the shown frame is
   * (-1 = live play). The sim does not advance while scrubbing.
   */
  public rewindIndex: number = -1;
  /**
   * A replay is being watched (T12): player input is ignored and the renderer shows REPLAY.
   * Set by the shell's ReplayViewer; not part of GameState.
   */
  public watchingReplay: boolean = false;
  /** True while a rewind re-simulates frames (inputs are not logged, no events reach the shell). */
  private resimulating: boolean = false;

  constructor(mode: GameMode = "PACMAN", highScoresRecord: number = 0) {
    this.mode = mode;
    this.highScore = highScoresRecord;
    this.initGame(mode, 1);
  }

  /** Returns and clears the events queued since the last call. */
  public drainEvents(): SimEvent[] {
    const events = this.outbox;
    this.outbox = [];
    return events;
  }

  /** Queues an event for the shell. For the sim's own modules (`src/game/sim`), not the shell. */
  public emit(event: SimEvent): void {
    this.outbox.push(event);
  }

  public emitScore(): void {
    this.emit({ type: "SCORE_CHANGED", score: this.score, highScore: this.highScore });
  }

  /**
   * Starts a round phase, telling the UI when the coarse play state changes. For the sim's modules
   * and for setting up a game from outside (tests, scenarios); `playState` is read-only (N2).
   */
  public enterPhase(phase: RoundPhase, frames?: number): void {
    const before = this.playState;
    this.sequencer.enter(phase, frames);
    if (this.playState !== before) {
      this.emit({ type: "PLAY_STATE_CHANGED", playState: this.playState });
    }
  }

  /** Adds points, awards the one bonus life, and tracks the high score. For sim modules. */
  public addScore(points: number): void {
    this.score += points;
    if (!this.extraLifeAwarded && this.score >= EXTRA_LIFE_SCORE) {
      this.extraLifeAwarded = true;
      this.lives++;
      this.emit({ type: "LIVES_CHANGED", lives: this.lives });
      this.emit({ type: "EXTRA_LIFE", lives: this.lives });
    }
    if (this.score > this.highScore) this.highScore = this.score;
    this.emitScore();
  }

  /** The background siren for the current state (see `sirenStateOf`). */
  public getSirenState(): SirenState {
    return sirenStateOf(this);
  }

  /** A new game: score 0 and the bonus life available again, then a fresh start at `level`. */
  public initGame(mode: GameMode, level: number = 1) {
    this.mode = mode;
    this.score = 0;
    this.extraLifeAwarded = false;
    this.emitScore();
    this.startFresh(level);
  }

  /**
   * Restart a level: the same fresh start as a new game, at the given (or current) level, but
   * the score is kept. Everything a life loss or other event turned on (global house counter,
   * Elroy suspension, frightened time, fruit) is reset by `startFresh`. The bonus life stays
   * given if it was, since the kept score has already passed it.
   */
  public restartLevel(level: number = this.level) {
    this.startFresh(level);
  }

  /** Everything except the score: 3 lives, the level's first frame, a new recording. */
  private startFresh(level: number) {
    this.lives = 3;
    this.eatenGhostsInEnergizer = 0;
    this.rewindIndex = -1;
    this.paused = false;
    this.tick = 0;
    this.simRandom.reset();

    this.loadLevel(level); // maze, timers, house counters, PRNG, actors

    this.emit({ type: "LIVES_CHANGED", lives: this.lives });
    this.emit({ type: "LEVEL_CHANGED", level: this.level });
    this.emit({ type: "INTRO" });
    this.enterPhase("READY", READY_FRAMES_GAME_START);
    this.replayLog.reset(this);
  }

  public loadLevel(lvl: number) {
    this.level = lvl;
    this.timerController.level = lvl;
    this.maze = this.ruleset.maze(this.level);
    this.timerController.resetTimers();
    this.houseController.onLevelStart();
    this.lifeFrame = 0;
    this.prng.reset();
    this.dotsRemaining = 0;
    this.dotsEatenThisLevel = 0;
    this.fruit = null;

    // Count dots and energizers
    for (let r = 0; r < this.maze.height; r++) {
      for (let c = 0; c < this.maze.width; c++) {
        const t = this.maze.tiles[r][c];
        if (t === "DOT" || t === "ENERGIZER") {
          this.dotsRemaining++;
        }
      }
    }
    this.totalDots = this.dotsRemaining;

    this.resetActorPositions();
    this.emit({ type: "LEVEL_CHANGED", level: this.level });
  }

  /** New actors on their spawn points (a level start or a new life). */
  private resetActorPositions(): void {
    spawnActors(this);
  }

  /**
   * A joystick direction. While a replay is being watched (T12) only the replay's own inputs
   * (`fromReplay`) get through: the player, the gamepad and the agent are locked out.
   */
  public setInputDirection(dir: Direction, fromReplay: boolean = false) {
    if (this.watchingReplay && !fromReplay) return;
    if (!this.resimulating) this.replayLog.onInput(this, dir);
    if (this.pacman && !this.pacman.isDying) {
      this.pacman.setRequestedDirection(dir);
    }
  }

  /**
   * The player let go of `dir`. With `releaseClearsBuffer`, a turn queued with it and not taken
   * yet is forgotten (logged as a NONE input, so replays stay exact); Pac-Man keeps going.
   */
  public releaseInputDirection(dir: Direction) {
    if (!this.settings.releaseClearsBuffer || !this.pacman) return;
    if (this.pacman.nextDir === dir && this.pacman.dir !== dir) this.setInputDirection("NONE");
  }

  /** Advances the simulation by exactly one frame. */
  public update() {
    // A paused or scrubbing frame changes nothing, not even the frame counter: the speed masks
    // are indexed by it, so counting paused frames would shift every actor's speed pattern.
    if (this.paused || this.rewindIndex !== -1) {
      return;
    }
    this.lifeFrame++;
    this.tick++;
    this.runFrame();
    if (!this.resimulating) this.replayLog.afterTick(this);
  }

  /** One sim frame: normal play, or a step of the current timed phase. */
  private runFrame(): void {
    if (this.sequencer.phase === "PLAYING") {
      this.updatePlaying();
      return;
    }

    // Every other phase is a countdown. While a ghost's score is shown, eyes that were already
    // heading home keep moving; everything else (timers included) is frozen.
    if (this.sequencer.phase === "GHOST_EATEN_PAUSE") {
      const shown = this.sequencer.state.eatenGhost;
      const speedConfig = getSpeedConfigForLevel(this.level);
      for (const g of Object.values(this.ghosts)) {
        if (g.isEyes && g.type !== shown) moveActiveGhost(this, g, speedConfig);
      }
    }

    const ended = this.sequencer.tick();
    if (this.sequencer.phase === "DEATH_ANIM") {
      this.pacman.deathProgress = this.sequencer.progress;
    }
    if (ended) this.onPhaseEnd(ended);
  }

  /** What happens when a timed phase runs out. */
  private onPhaseEnd(phase: RoundPhase): void {
    switch (phase) {
      case "READY":
      case "GHOST_EATEN_PAUSE":
        this.enterPhase("PLAYING");
        break;
      case "DEATH_FREEZE":
        this.pacman.isDying = true;
        this.pacman.deathProgress = 0;
        this.enterPhase("DEATH_ANIM");
        this.emit({ type: "PACMAN_DIED" });
        break;
      case "DEATH_ANIM":
        this.enterPhase("DEATH_WAIT");
        break;
      case "DEATH_WAIT":
        this.loseLife();
        break;
      case "LEVEL_CLEAR_FREEZE":
        this.enterPhase("MAZE_FLASH");
        break;
      case "MAZE_FLASH":
        this.loadLevel(this.level + 1);
        this.enterPhase("READY");
        break;
    }
  }

  private loseLife(): void {
    this.lives--;
    this.emit({ type: "LIVES_CHANGED", lives: this.lives });

    if (this.lives <= 0) {
      this.enterPhase("GAME_OVER");
      this.emit({ type: "GAME_OVER", score: this.score });
      return;
    }

    this.timerController.resetTimers();
    this.houseController.onLifeLost();
    this.lifeFrame = 0;
    this.prng.reset();
    this.resetActorPositions();
    this.enterPhase("READY");
  }

  /** One frame of normal play. */
  private updatePlaying(): void {
    // Advance timers by one frame
    this.timerController.level = this.level;
    this.timerController.update(
      (newWave) => {
        // Scatter <-> chase switch: every ghost follows the new wave and latches a reversal.
        // Active ghosts reverse at their next tile center (Elroy Blinky included); ghosts in the
        // house keep the latch and leave to the right.
        (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
          const g = this.ghosts[type];
          g.wave = newWave === "SCATTER" ? "SCATTER" : "CHASE";
          g.primeReversal();
        });
      },
      () => {
        // Frightened mode ended: every ghost returns to the current wave
        (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
          const g = this.ghosts[type];
          g.frightened = false;
        });
      }
    );

    const speedConfig = getSpeedConfigForLevel(this.level);
    // Update Pac-Man physical movement via MovementController
    movePacman(this, speedConfig);
    // Update Ghosts physical movement via MovementController & GhostAiController
    moveGhosts(this, speedConfig);

    checkCollisions(this);
    updateFruit(this);
  }

  /** An energizer's effect, from outside a play frame too (scenarios, tests, the Practice tab). */
  public triggerFrightenedMode(): void {
    triggerFrightenedMode(this);
  }

  /** Puts this level's fruit on the board now (scenarios, tests, the Practice tab). */
  public spawnFruit(): void {
    spawnFruit(this);
  }

  // --- Saved state (the format and the copying live in gameState.ts) ---

  /** Captures the complete sim state (see GameState). Every object in it is a fresh copy. */
  public getState(): GameState {
    return captureState(this);
  }

  /**
   * Restores a state captured by getState() and starts a new recording from it. The state object
   * is not kept or mutated.
   */
  public setState(state: GameState): void {
    applyState(this, state);
    this.replayLog.reset(this); // a loaded state starts a new recording
  }

  // --- Rewind (T7): keyframes from the replay log plus re-simulation ---

  /** Plays on from the frame shown (scrubbing): everything recorded after it is forgotten. */
  public leaveScrub() {
    if (this.rewindIndex !== -1) {
      this.replayLog.truncate(this.tick);
      this.rewindIndex = -1;
      this.paused = false;
      this.emit({ type: "PLAY_STATE_CHANGED", playState: this.playState });
    }
  }

  /**
   * Shows recorded frame `tick` and holds there (scrubbing): loads the newest keyframe at or
   * before it and re-runs the recorded inputs up to it (at most a second of frames), silently.
   * The result is exact: the sim is deterministic. Which frame to show is `timeline`'s job.
   */
  public showRecordedFrame(tick: number): void {
    const { start, inputs } = this.replayLog.pathTo(tick);
    const outbox = this.outbox;

    applyState(this, start); // not setState: the recording stays
    this.rewindIndex = -1;
    this.paused = false;
    this.resimulating = true;
    let next = 0;
    while (this.tick < tick) {
      while (next < inputs.length && inputs[next][0] === this.tick + 1) {
        this.setInputDirection(inputs[next++][1], true);
      }
      this.update();
    }
    this.resimulating = false;
    this.outbox = outbox; // no sounds or UI events for the re-simulated frames

    // Exact, high score included: the shown high score follows the rewound game (the stored
    // high-score table is only written at game over).
    this.rewindIndex = tick - this.replayLog.oldestTick;
    this.emit({ type: "REWOUND", playState: PHASE_PLAY_STATE[this.sequencer.phase] });
  }
}
