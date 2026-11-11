import type {
  Direction,
  FruitItem,
  GameMode,
  GameSettings,
  GhostState,
  GhostType,
  LevelSpeedConfig,
  MazeData,
  PacmanState,
  PlayState,
  ScorePopup,
} from "../types";
import {
  getElroyStage,
  getFrightenedDuration,
  getFruitDataPerLevel,
  getSpeedConfigForLevel,
} from "../utils";
import { EXTRA_LIFE_SCORE, FRUIT_EXTRA_FRAMES, FRUIT_MIN_FRAMES, TILE_SIZE } from "./constants";
import { Pacman } from "../core/Pacman";
import { Ghost } from "../core/Ghost";
import { PRNG } from "../core/PRNG";
import { SimRandom } from "../core/SimRandom";
import {
  MAZE_FLASH_TOGGLE_FRAMES,
  PHASE_PLAY_STATE,
  PLAY_STATE_ENTRY_PHASE,
  READY_FRAMES_GAME_START,
  type RoundPhase,
  RoundSequencer,
} from "./RoundSequencer";
import { TimerController } from "../controllers/TimerController";
import { AnimationController } from "../controllers/AnimationController";
import { GhostAiController } from "../controllers/GhostAiController";
import { MovementController } from "../controllers/MovementController";
import { HouseController } from "../controllers/HouseController";
import { DiagnosticController, type DiagnosticData } from "../diagnostics/DiagnosticController";
import { seamPx } from "./mazes";
import { RULESETS, type Ruleset } from "./rulesets";
import type { SimEvent, SirenState } from "./simEvents";
import { type GameState, decodeTilesInto, encodeTiles } from "./gameState";
import { ReplayLog } from "./replay";

/** Copies a ghost state, including its nested tile objects. */
function copyGhostState(g: GhostState): GhostState {
  return {
    ...g,
    target: g.target && { ...g.target },
    intermediateTarget: g.intermediateTarget && { ...g.intermediateTarget },
    lastDecisionTile: g.lastDecisionTile && { ...g.lastDecisionTile },
    lastOccupiedTile: g.lastOccupiedTile && { ...g.lastOccupiedTile },
  };
}

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

  /**
   * Setting a coarse state from outside (UI, tests, the agent driver): "PAUSED" pauses, anything
   * else unpauses and, if the coarse state differs, starts that state's first phase.
   */
  public set playState(playState: PlayState) {
    if (playState === "PAUSED") {
      this.paused = true;
      return;
    }
    this.paused = false;
    if (PHASE_PLAY_STATE[this.sequencer.phase] !== playState) {
      this.sequencer.enter(PLAY_STATE_ENTRY_PHASE[playState]);
    }
  }

  public settings: GameSettings = {
    turbo: false,
    turboSpeedMultiplier: 1.6,
    learnMode: false,
    learnVisualsEnabled: false,
    activeGhostVisuals: {
      BLINKY: true,
      PINKY: true,
      INKY: true,
      CLYDE: true,
    },
    practiceMode: false,
    showGrid: false,
    showGhostPaths: false,
    showTargetLines: false,
    invincible: false,
    gameSpeed: 1.0,
    arcadeRefreshRate: true,
    soundEnabled: true,
    soundVolume: 0.5,
    crtFilter: false,
    touchControls: false,
    /** The arcade's targeting overflow for Pinky and Inky when Pac-Man faces up (F15). Off = "fixed AI". */
    emulateRomQuirks: true,
    showDiagnosticConsole: false, // In-game testing & diagnostics console
    debugOverlay: false,
    debugLayers: {
      grid: true,
      occupiedTiles: true,
      targets: true,
      decisions: true,
      zones: false,
      intersections: false,
      cornerWindow: true,
      readout: false,
      timeline: true,
    },
  };

  public maze!: MazeData;
  public score: number = 0;
  public highScore: number = 0;
  public level: number = 1;
  public lives: number = 3;
  public dotsRemaining: number = 0;
  public totalDots: number = 0;
  public dotsEatenThisRound: number = 0;
  /** The one bonus life of a game has been given. */
  public extraLifeAwarded: boolean = false;

  public fruit: FruitItem | null = null;
  public scorePopups: ScorePopup[] = [];
  public eatenGhostsInEnergizer: number = 0;

  /** Frames since the level (or the current life) started. Indexes the 16-frame speed masks. */
  public currLevelFrame: number = 0;
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

  // Modular Controllers
  public timerController: TimerController = new TimerController(1);
  public animationController: AnimationController = new AnimationController();
  public ghostAiController: GhostAiController = new GhostAiController(true, this.prng);
  public movementController: MovementController = new MovementController();
  public houseController: HouseController = new HouseController();
  public diagnosticController: DiagnosticController = new DiagnosticController();

  // Actors
  public pacman!: Pacman;
  public ghosts!: Record<GhostType, Ghost>;

  // Legacy/Adapter Getters and Setters for complete backward compatibility
  public get pacmanState(): PacmanState {
    return this.pacman.toState();
  }
  public set pacmanState(val: PacmanState) {
    if (this.pacman && val) {
      this.pacman.restoreFromState(val);
    }
  }

  public get ghostStates(): Record<GhostType, GhostState> {
    return {
      BLINKY: this.ghosts.BLINKY.toState(),
      PINKY: this.ghosts.PINKY.toState(),
      INKY: this.ghosts.INKY.toState(),
      CLYDE: this.ghosts.CLYDE.toState(),
    };
  }
  public set ghostStates(val: Record<GhostType, GhostState>) {
    if (this.ghosts && val) {
      (Object.keys(val) as GhostType[]).forEach((type) => {
        if (this.ghosts[type] && val[type]) {
          this.ghosts[type].restoreFromState(val[type]);
        }
      });
    }
  }

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

  /** Ghosts vanish once the death animation starts and while the maze flashes. */
  public get ghostsVisible(): boolean {
    const phase = this.sequencer.phase;
    return phase !== "DEATH_ANIM" && phase !== "DEATH_WAIT" && phase !== "MAZE_FLASH";
  }

  /** Pac-Man is hidden while a ghost's score is shown, and after the death animation. */
  public get pacmanVisible(): boolean {
    const phase = this.sequencer.phase;
    return phase !== "GHOST_EATEN_PAUSE" && phase !== "DEATH_WAIT";
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

  private emit(event: SimEvent): void {
    this.outbox.push(event);
  }

  private emitScore(): void {
    this.emit({ type: "SCORE_CHANGED", score: this.score, highScore: this.highScore });
  }

  /** Starts a round phase, telling the UI when the coarse play state changes. */
  private enterPhase(phase: RoundPhase, frames?: number): void {
    const before = this.playState;
    this.sequencer.enter(phase, frames);
    if (this.playState !== before) {
      this.emit({ type: "PLAY_STATE_CHANGED", playState: this.playState });
    }
  }

  /** Adds points, awards the one bonus life, and tracks the high score. */
  private addScore(points: number): void {
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

  /** The background siren for the current state (the shell plays it). */
  public getSirenState(): SirenState {
    if (this.playState !== "PLAYING") return { kind: "OFF" };
    const ghosts = Object.values(this.ghosts);
    if (ghosts.some((g) => g.mode === "EATEN")) return { kind: "EYES" };
    if (ghosts.some((g) => g.mode === "FRIGHTENED")) return { kind: "FRIGHTENED" };
    return {
      kind: "NORMAL",
      dotsRatio: this.totalDots > 0 ? this.dotsRemaining / this.totalDots : 1,
    };
  }

  public buildGhostDiagnosticsData(type: GhostType) {
    const g = this.ghosts?.[type];
    const gx = g ? g.x : 0;
    const gy = g ? g.y : 0;

    return {
      aiMode: g ? g.mode : "SCATTER",
      targetTile: g ? g.target : { col: 0, row: 0 },
      x: gx,
      y: gy,
      tileCol: Math.floor(gx / TILE_SIZE),
      tileRow: Math.floor(gy / TILE_SIZE),
      dir: g ? g.dir : "NONE",
      speed: g ? g.speed : 0,
      inHouse: g ? g.inHouse : false,
      enteringHousePhase: g?.enteringHousePhase ?? "NONE",
    };
  }

  public getActorsDiagnostics(): DiagnosticData {
    const currentWave = this.timerController.currentWave;
    const currentMode = currentWave?.mode ?? "CHASE";

    const px = this.pacman ? this.pacman.x : 0;
    const py = this.pacman ? this.pacman.y : 0;

    return {
      blinky: this.buildGhostDiagnosticsData("BLINKY"),
      pinky: this.buildGhostDiagnosticsData("PINKY"),
      inky: this.buildGhostDiagnosticsData("INKY"),
      clyde: this.buildGhostDiagnosticsData("CLYDE"),
      pacman: {
        x: px,
        y: py,
        tileCol: Math.floor(px / TILE_SIZE),
        tileRow: Math.floor(py / TILE_SIZE),
        dir: this.pacman ? this.pacman.dir : "NONE",
        speed: this.pacman ? this.pacman.speed : 0,
        eatingFreezeFrames: this.pacman ? this.pacman.eatingFreezeFrames : 0,
      },
      level: this.level,
      frame: this.currLevelFrame,
      wave: currentMode,
      waveTimer: this.waveTimer,
      frightenedTimer: this.frightenedGlobalTimer,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
    };
  }

  public initGame(mode: GameMode, level: number = 1) {
    this.mode = mode;
    this.level = level;
    this.score = 0;
    this.lives = 3;
    this.dotsEatenThisRound = 0;
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.frightenedGlobalTimer = 0;
    this.eatenGhostsInEnergizer = 0;
    this.fruit = null;
    this.scorePopups = [];
    this.rewindIndex = -1;
    this.extraLifeAwarded = false;
    this.paused = false;
    this.tick = 0;
    this.simRandom.reset();

    this.loadLevel(this.level);

    this.emitScore();
    this.emit({ type: "LIVES_CHANGED", lives: this.lives });
    this.emit({ type: "LEVEL_CHANGED", level: this.level });
    this.enterPhase("READY", READY_FRAMES_GAME_START);
    this.replayLog.reset(this);
  }

  public restartLevel(level?: number) {
    if (level !== undefined) {
      this.level = level;
    }
    this.lives = 3;
    this.dotsEatenThisRound = 0;
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.frightenedGlobalTimer = 0;
    this.eatenGhostsInEnergizer = 0;
    this.fruit = null;
    this.scorePopups = [];
    this.rewindIndex = -1;
    this.paused = false;
    this.tick = 0;
    this.simRandom.reset();

    this.loadLevel(this.level);

    this.emit({ type: "LIVES_CHANGED", lives: this.lives });
    this.emit({ type: "LEVEL_CHANGED", level: this.level });
    this.enterPhase("READY", READY_FRAMES_GAME_START);
    this.replayLog.reset(this);
  }

  public loadLevel(lvl: number) {
    this.level = lvl;
    this.timerController.level = lvl;
    this.maze = this.ruleset.maze(this.level);
    this.timerController.resetTimers();
    this.houseController.onLevelStart();
    this.currLevelFrame = 0;
    this.prng.reset();
    this.scorePopups = [];
    this.dotsRemaining = 0;
    this.dotsEatenThisRound = 0;
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

  public resetActorPositions() {
    // In arcade Pac-Man: if a bonus fruit was currently active when Pac-Man died,
    // it immediately disappears and does NOT reappear after respawning (treated as already consummated).
    if (this.fruit) {
      this.fruit.active = false;
      this.fruit = null;
    }

    const speedConfig = getSpeedConfigForLevel(this.level);

    // Every actor starts on the seam between its two spawn tiles (F9)
    const pacPos = seamPx(this.maze.pacmanSpawn.candidates);
    this.pacman = new Pacman(pacPos.x, pacPos.y, this.maze.pacmanSpawn.dir);
    this.pacman.speed = speedConfig.pacmanNormal;
    this.pacman.invincible = this.settings.invincible;

    // Ghosts initial spawn on designated candidate integer tiles
    const gSpawns = this.maze.ghostSpawns;
    const getSpawnPos = (type: GhostType) => seamPx(gSpawns[type].candidates);

    const blinkyPos = getSpawnPos("BLINKY");
    const pinkyPos = getSpawnPos("PINKY");
    const inkyPos = getSpawnPos("INKY");
    const clydePos = getSpawnPos("CLYDE");

    this.ghosts = {
      BLINKY: new Ghost(
        "BLINKY",
        blinkyPos.x,
        blinkyPos.y,
        gSpawns.BLINKY.initialDir,
        gSpawns.BLINKY.inHouse
      ),
      PINKY: new Ghost(
        "PINKY",
        pinkyPos.x,
        pinkyPos.y,
        gSpawns.PINKY.initialDir,
        gSpawns.PINKY.inHouse
      ),
      INKY: new Ghost("INKY", inkyPos.x, inkyPos.y, gSpawns.INKY.initialDir, gSpawns.INKY.inHouse),
      CLYDE: new Ghost(
        "CLYDE",
        clydePos.x,
        clydePos.y,
        gSpawns.CLYDE.initialDir,
        gSpawns.CLYDE.inHouse
      ),
    };

    const wave = this.timerController.currentWave?.mode ?? "CHASE";
    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];
      g.wave = wave;
      g.target = this.maze.scatterTargets[type];
      g.speed = speedConfig.ghostNormal;
    });
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

  /** Advances the simulation by exactly one frame. */
  public update() {
    // A paused or scrubbing frame changes nothing, not even the frame counter: the speed masks
    // are indexed by it, so counting paused frames would shift every actor's speed pattern.
    if (this.paused || this.rewindIndex !== -1) {
      return;
    }
    this.currLevelFrame++;
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
        if (g.isEyes && g.type !== shown) this.updateActiveGhost(g, speedConfig);
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
    this.currLevelFrame = 0;
    this.prng.reset();
    this.resetActorPositions();
    this.scorePopups = []; // a score still floating when Pac-Man died does not carry over (F26)
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
          g.flashState = false;
        });
      }
    );

    const speedConfig = getSpeedConfigForLevel(this.level);
    // Update Pac-Man physical movement via MovementController
    this.updatePacmanMovement(speedConfig);
    // Update Ghosts physical movement via MovementController & GhostAiController
    this.updateGhostsMovement(speedConfig);

    // Update Visual Animations via AnimationController
    this.animationController.updatePacmanAnimation(this.pacman);
    this.animationController.updateGhostVisuals(
      this.ghosts,
      this.level,
      this.frightenedGlobalTimer
    );

    // Check Collisions
    this.checkCollisions();

    // Update Fruit
    this.updateFruit();

    // Update Score Popups
    this.updateScorePopups();
  }

  private updatePacmanMovement(speedConfig: LevelSpeedConfig) {
    const isFrightened = this.frightenedGlobalTimer > 0;
    const speedPct = this.pacman.getSpeedPercentage(this.level, isFrightened, speedConfig);
    const turboMult = this.settings.turbo ? this.settings.turboSpeedMultiplier : 1.0;

    this.movementController.updatePacmanMovement(
      this.pacman,
      this.currLevelFrame,
      speedPct,
      turboMult,
      this.maze
    );
  }

  private updateGhostsMovement(speedConfig: LevelSpeedConfig) {
    const blinky = this.ghosts.BLINKY;
    const turboMult = this.settings.turbo ? this.settings.turboSpeedMultiplier : 1.0;

    // Release ghosts from the house (dot counters, global counter, idle timer)
    this.houseController.update(this.ghosts, this.level);
    blinky.elroyStage = getElroyStage(
      this.level,
      this.dotsRemaining,
      this.houseController.state.elroySuspended
    );

    for (const g of Object.values(this.ghosts)) {
      // Waiting in the house, or on the way out
      if (g.inHouse) {
        const pct = g.getSpeedPercentage(this.maze, speedConfig);
        this.movementController.updateHouseGhost(g, this.currLevelFrame, pct, turboMult);
      } else {
        this.updateActiveGhost(g, speedConfig);
      }
    }
  }

  /** Targeting and movement for a ghost outside the house (eyes included). */
  private updateActiveGhost(g: Ghost, speedConfig: LevelSpeedConfig): void {
    const blinky = this.ghosts.BLINKY;
    const turboMult = this.settings.turbo ? this.settings.turboSpeedMultiplier : 1.0;

    // Target tile (with the optional 1980 ROM quirks)
    this.ghostAiController.emulateRomQuirks = this.settings.emulateRomQuirks;
    g.target = this.ghostAiController.calculateTarget(g, this.pacman, blinky, this.maze);

    // Discrete 16-frame bitmask speed & tile-to-tile movement
    const speedPct = g.getSpeedPercentage(this.maze, speedConfig);

    this.movementController.updateGhostMovement(g, {
      blinky,
      pacman: this.pacman,
      currLevelFrame: this.currLevelFrame,
      speedPct,
      turboMultiplier: turboMult,
      maze: this.maze,
      ghostAi: this.ghostAiController,
    });
  }

  private checkCollisions() {
    const halfTile = TILE_SIZE / 2;
    const pacCol = Math.floor(this.pacman.x / TILE_SIZE);
    const pacRow = Math.floor(this.pacman.y / TILE_SIZE);

    // 1. Check Dot & Energizer Eating
    if (pacRow >= 0 && pacRow < this.maze.height && pacCol >= 0 && pacCol < this.maze.width) {
      const tile = this.maze.tiles[pacRow][pacCol];

      if (tile === "DOT") {
        this.maze.tiles[pacRow][pacCol] = "EMPTY";
        this.addScore(10);
        this.dotsRemaining--;
        this.dotsEatenThisRound++;
        this.pacman.eatingFreezeFrames = 1; // Authentic 1-frame eating freeze
        this.houseController.onDotEaten(this.ghosts);
        this.emit({ type: "DOT_EATEN" });
        this.checkFruitSpawn();
        this.checkLevelClear();
      } else if (tile === "ENERGIZER") {
        this.maze.tiles[pacRow][pacCol] = "EMPTY";
        this.addScore(50);
        this.dotsRemaining--;
        this.dotsEatenThisRound++;
        this.pacman.eatingFreezeFrames = 3; // Authentic 3-frame energizer freeze
        this.houseController.onDotEaten(this.ghosts);
        this.eatenGhostsInEnergizer = 0;
        this.triggerFrightenedMode();
        this.checkFruitSpawn();
        this.checkLevelClear();
        this.emit({ type: "ENERGIZER_EATEN", level: this.level });
      }
    }

    // 2. Ghost collisions (same tile). A cleared level ends the frame first. Only one ghost is
    // eaten per frame: the pause starts, and a second ghost on the tile is caught after it.
    const pacTile = this.pacman.tileCoord;

    for (const g of Object.values(this.ghosts)) {
      if (this.sequencer.phase !== "PLAYING") break;
      if (g.location !== "ACTIVE") continue;

      const ghostTile = g.tileCoord;
      if (pacTile.col !== ghostTile.col || pacTile.row !== ghostTile.row) continue;

      if (g.frightened) {
        g.location = "EYES";
        g.frightened = false;
        g.flashState = false;
        g.reversalPrimed = false; // Getting eaten does not trigger reversal or preserve primed reversals
        g.lastDecisionTile = undefined; // Re-evaluate targeting towards house doorstep immediately
        g.target = this.ghostAiController.calculateTarget(
          g,
          this.pacman,
          this.ghosts.BLINKY,
          this.maze
        );
        this.eatenGhostsInEnergizer++;
        const points = 200 * Math.pow(2, Math.min(3, this.eatenGhostsInEnergizer - 1));
        this.addScore(points);
        // The action stops while the score is shown where the ghost was (F20).
        this.enterPhase("GHOST_EATEN_PAUSE");
        this.sequencer.state.eatenGhost = g.type;
        this.sequencer.state.eatenPoints = points;
        this.emit({ type: "GHOST_EATEN", ghost: g.type, points });
      } else if (!this.settings.invincible && !this.pacman.invincible) {
        // Everything freezes with the ghosts visible, then the death animation starts (F21).
        this.enterPhase("DEATH_FREEZE");
        if (this.fruit) {
          this.fruit.active = false;
          this.fruit = null;
        }
      }
    }

    // 3. Check Fruit Collision (Pac-Man's center anchor occupies fruit candidate tiles)
    if (this.fruit && this.fruit.active) {
      const fruitRow = this.fruit.row;
      const fruitCol = this.fruit.col;
      const isFruitTile =
        pacTile.row === fruitRow &&
        (pacTile.col === fruitCol || pacTile.col === 13 || pacTile.col === 14);

      if (isFruitTile) {
        this.addScore(this.fruit.points);
        this.fruit.active = false;

        const fruitX = fruitCol * TILE_SIZE + halfTile;
        const fruitY = fruitRow * TILE_SIZE + halfTile;

        this.scorePopups.push({
          id: `fruit_${this.currLevelFrame}`,
          text: `${this.fruit.points}`,
          x: fruitX,
          y: fruitY,
          life: 50,
          color: "#ffcc00",
        });

        this.emit({ type: "FRUIT_EATEN", points: this.fruit.points });
      }
    }
  }

  public triggerFrightenedMode() {
    const duration = getFrightenedDuration(this.level);

    this.timerController.triggerFrightened(duration);

    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];

      // Eyes on their way home are immune. Every other ghost, inside the house too, latches a
      // reversal and (unless this level has no frightened time) turns blue.
      if (g.isEyes) return;
      g.primeReversal();

      if (duration <= 0) return;
      g.frightened = true;
      g.flashState = false;
    });
  }

  private checkFruitSpawn() {
    // Spawns fruit at 70 and 170 dots eaten
    if (this.dotsEatenThisRound === 70 || this.dotsEatenThisRound === 170) {
      this.spawnFruit();
    }
  }

  public spawnFruit() {
    const fruitMeta = getFruitDataPerLevel(this.level);

    this.fruit = {
      name: fruitMeta.name,
      points: fruitMeta.points,
      col: 13, // Standardized to absolute integer coordinate to keep pathing calculations clean
      row: 20,
      active: true,
      duration: FRUIT_MIN_FRAMES + this.simRandom.nextInt(FRUIT_EXTRA_FRAMES),
      color: fruitMeta.color,
      symbol: fruitMeta.symbol,
      bouncing: this.ruleset.fruitBounces,
      bounceY: 0,
      bounceDir: 1,
    };
  }

  private updateFruit() {
    if (this.fruit && this.fruit.active) {
      this.fruit.duration--;
      if (this.fruit.bouncing) {
        this.fruit.bounceY = Math.sin(this.fruit.duration / 9) * 2;
      }
      if (this.fruit.duration <= 0) {
        this.fruit.active = false;
      }
    }
  }

  private updateScorePopups() {
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const popup = this.scorePopups[i];
      popup.life--;
      popup.y -= 0.15; // float upward

      if (popup.life <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }
  }

  private checkLevelClear() {
    if (this.dotsRemaining <= 0) {
      this.fruit = null;
      this.enterPhase("LEVEL_CLEAR_FREEZE");
      this.emit({ type: "LEVEL_CLEARED", level: this.level });
    }
  }

  // --- Rewind Buffer & Practice Sandbox ---

  /** Captures the complete sim state (see GameState). Every object in it is a fresh copy. */
  public getState(): GameState {
    const ghosts = {} as Record<GhostType, GhostState>;
    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      ghosts[type] = copyGhostState(this.ghosts[type].toState());
    });

    return {
      version: 4,
      mode: this.mode,
      sequence: { ...this.sequencer.state },
      level: this.level,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      dotsRemaining: this.dotsRemaining,
      totalDots: this.totalDots,
      dotsEatenThisRound: this.dotsEatenThisRound,
      eatenGhostsInEnergizer: this.eatenGhostsInEnergizer,
      currLevelFrame: this.currLevelFrame,
      tick: this.tick,
      timers: {
        waveIndex: this.timerController.waveIndex,
        waveTimer: this.timerController.waveTimer,
        frightened: this.timerController.frightenedGlobalTimer,
      },
      prng: this.prng.state,
      simRandom: this.simRandom.state,
      extraLifeAwarded: this.extraLifeAwarded,
      tiles: encodeTiles(this.maze.tiles),
      pacman: this.pacman.toState(),
      ghosts,
      house: {
        ...this.houseController.state,
        dotCounters: { ...this.houseController.state.dotCounters },
      },
      fruit: this.fruit ? { ...this.fruit } : null,
      scorePopups: this.scorePopups.map((p) => ({ ...p })),
    };
  }

  /**
   * Restores a state captured by getState() and starts a new recording from it. The state object
   * is not kept or mutated.
   */
  public setState(state: GameState): void {
    this.restoreState(state);
    this.replayLog.reset(this); // a loaded state starts a new recording
  }

  /** Restores a state without touching the recording (rewind). */
  private restoreState(state: GameState): void {
    if (state.mode !== this.mode || state.level !== this.level) {
      this.maze = RULESETS[state.mode].maze(state.level);
    }
    this.mode = state.mode;
    this.sequencer.state = { ...state.sequence };
    this.level = state.level;
    this.timerController.level = state.level;
    this.score = state.score;
    this.highScore = state.highScore;
    this.lives = state.lives;
    this.dotsRemaining = state.dotsRemaining;
    this.totalDots = state.totalDots;
    this.dotsEatenThisRound = state.dotsEatenThisRound;
    this.eatenGhostsInEnergizer = state.eatenGhostsInEnergizer;
    this.currLevelFrame = state.currLevelFrame;
    this.tick = state.tick;
    this.timerController.waveIndex = state.timers.waveIndex;
    this.timerController.waveTimer = state.timers.waveTimer;
    this.timerController.frightenedGlobalTimer = state.timers.frightened;
    this.prng.state = state.prng;
    this.simRandom.state = state.simRandom;
    this.extraLifeAwarded = state.extraLifeAwarded;
    decodeTilesInto(state.tiles, this.maze.tiles);
    this.pacman.restoreFromState({ ...state.pacman });
    (Object.keys(state.ghosts) as GhostType[]).forEach((type) => {
      this.ghosts[type].restoreFromState(copyGhostState(state.ghosts[type]));
    });
    this.houseController.state = { ...state.house, dotCounters: { ...state.house.dotCounters } };
    this.fruit = state.fruit ? { ...state.fruit } : null;
    this.scorePopups = state.scorePopups.map((p) => ({ ...p }));
  }

  // --- Rewind (T7): keyframes from the replay log plus re-simulation ---

  /** How many frames rewind can reach: the oldest keyframe up to the newest recorded frame. */
  public getRewindBufferLength(): number {
    return this.replayLog.headTick - this.replayLog.oldestTick + 1;
  }

  /** Shows frame `frameIndex` of the rewindable range (0 = oldest) and holds there. */
  public scrubToFrame(frameIndex: number) {
    const length = this.getRewindBufferLength();
    if (frameIndex < 0 || frameIndex >= length) return;
    this.seekTick(this.replayLog.oldestTick + frameIndex);
  }

  /** Steps back `seconds` from the frame shown now (the live frame, or the scrubbed one). */
  public rewindSeconds(seconds: number) {
    const from = this.rewindIndex !== -1 ? this.tick : this.replayLog.headTick;
    const target = Math.max(this.replayLog.oldestTick, from - Math.round(seconds * 60));
    this.seekTick(target);
  }

  /** Plays on from the scrubbed frame. Everything recorded after it is forgotten. */
  public resumeFromScrub() {
    if (this.rewindIndex !== -1) {
      this.replayLog.truncate(this.tick);
      this.rewindIndex = -1;
      this.paused = false;
      this.emit({ type: "PLAY_STATE_CHANGED", playState: this.playState });
    }
  }

  /**
   * Rebuilds frame `tick`: loads the newest keyframe at or before it and re-runs the recorded
   * inputs up to it (at most a second of frames). The result is exact: the sim is deterministic.
   */
  private seekTick(tick: number): void {
    const { start, inputs } = this.replayLog.pathTo(tick);
    const outbox = this.outbox;

    this.restoreState(start);
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

  public resetGhostsToHouse() {
    const gSpawns = this.maze.ghostSpawns;
    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];
      const pos = seamPx(gSpawns[type].candidates);
      g.x = pos.x;
      g.y = pos.y;
      g.dir = gSpawns[type].initialDir;
      g.nextDir = gSpawns[type].initialDir;
      g.location = gSpawns[type].inHouse ? "HOUSE" : "ACTIVE";
      g.frightened = false;
      g.flashState = false;
      g.reversalPrimed = false;
      g.enteringHousePhase = "NONE";
      g.lastDecisionTile = undefined;
    });
  }

  public toggleInvincible() {
    this.settings.invincible = !this.settings.invincible;
    if (this.pacman) {
      this.pacman.invincible = this.settings.invincible;
    }
  }
}
