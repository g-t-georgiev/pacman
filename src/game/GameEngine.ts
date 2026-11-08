import type GameRenderer from "./GameRenderer";
import soundEngine from "../audio/SoundEngine";
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
  SnapshotState,
  TileType,
} from "../types";
import {
  getFrightenedDuration,
  getFruitDataPerLevel,
  getScatterChaseSchedule,
  getSpeedConfigForLevel,
} from "../utils";
import { CLASSIC_FRUITS, ELROY_1_DOTS_LEFT, TILE_SIZE } from "./constants";
import GameEvents from "../core/EventBus";
import { Pacman } from "../core/Pacman";
import { Ghost } from "../core/Ghost";
import { GameLoopController } from "../controllers/GameLoopController";
import { TimerController } from "../controllers/TimerController";
import { AnimationController } from "../controllers/AnimationController";
import { GhostAiController } from "../controllers/GhostAiController";
import { MovementController } from "../controllers/MovementController";
import { DiagnosticController, type DiagnosticData } from "../diagnostics/DiagnosticController";
import { getMazeData } from "./mazes";
import { uiConfig } from "../config/ui.config";

export default class GameEngine {
  public mode: GameMode = "PACMAN";
  public playState: PlayState = "MENU";
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
    soundEnabled: true,
    soundVolume: 0.5,
    crtFilter: false,
    touchControls: false,
    emulateRomQuirks: false, // Authentic 1980 Z80 hardware quirks toggle
    showDiagnosticConsole: false, // In-game testing & diagnostics console
  };

  public maze!: MazeData;
  public score: number = 0;
  public highScore: number = 0;
  public level: number = 1;
  public lives: number = 3;
  public dotsRemaining: number = 0;
  public totalDots: number = 0;
  public dotsEatenThisRound: number = 0;

  public fruit: FruitItem | null = null;
  public scorePopups: ScorePopup[] = [];
  public eatenGhostsInEnergizer: number = 0;

  /** Level frame counter for 16-frame bitmask speed tables */
  public currLevelFrame: number = 0;

  // Modular Controllers
  public timerController: TimerController = new TimerController(1);
  public animationController: AnimationController = new AnimationController();
  public ghostAiController: GhostAiController = new GhostAiController(false);
  public movementController: MovementController = new MovementController();
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

  public get readyTimer(): number {
    return this.timerController.readyTimer;
  }

  public set readyTimer(v: number) {
    this.timerController.readyTimer = v;
  }

  public get levelClearTimer(): number {
    return this.timerController.levelClearTimer;
  }

  public set levelClearTimer(v: number) {
    this.timerController.levelClearTimer = v;
  }

  // Rewind ring buffer (up to 900 frames ~ 15 seconds)
  private rewindBuffer: SnapshotState[] = [];
  private readonly maxRewindFrames: number = 900;
  public rewindIndex: number = -1; // when scrubbing (-1 means live play)

  // Game loop & Render linkage
  public gameLoopController!: GameLoopController;
  public renderer: GameRenderer | null = null;
  public onPreUpdate?: () => void;

  constructor(mode: GameMode = "PACMAN", highScoresRecord: number = 0) {
    this.mode = mode;
    this.highScore = highScoresRecord;

    this.gameLoopController = new GameLoopController(
      (currLevelFrame) => {
        this.currLevelFrame = currLevelFrame;
        if (this.onPreUpdate) this.onPreUpdate();
        this.update();
      },
      () => {
        if (this.renderer) {
          this.renderer.render(this);
        }
      }
    );

    this.initGame(mode, 1);
  }

  public start(): void {
    this.gameLoopController.start();
    GameEvents.emit("PLAY_STATE_CHANGED", this.playState);
  }

  public stop(): void {
    this.gameLoopController.stop();
    soundEngine.stopSiren();
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
    soundEngine.stopSiren();
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
    this.rewindBuffer = [];
    this.rewindIndex = -1;

    this.loadLevel(this.level);
    this.playState = "READY";
    this.readyTimer = uiConfig.timings.readyBannerFrames;

    GameEvents.emit("SCORE_CHANGED", { score: this.score, highScore: this.highScore });
    GameEvents.emit("LIVES_CHANGED", this.lives);
    GameEvents.emit("LEVEL_CHANGED", this.level);
    GameEvents.emit("PLAY_STATE_CHANGED", this.playState);
  }

  public restartLevel(level?: number) {
    soundEngine.stopSiren();
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
    this.rewindBuffer = [];
    this.rewindIndex = -1;

    this.loadLevel(this.level);
    this.playState = "READY";
    this.readyTimer = uiConfig.timings.readyBannerFrames;

    GameEvents.emit("LIVES_CHANGED", this.lives);
    GameEvents.emit("LEVEL_CHANGED", this.level);
    GameEvents.emit("PLAY_STATE_CHANGED", this.playState);
  }

  public loadLevel(lvl: number) {
    soundEngine.stopSiren();
    this.level = lvl;
    this.timerController.level = lvl;
    this.maze = getMazeData(this.mode, this.level);
    this.timerController.resetTimers();
    this.gameLoopController.resetLevelFrame();
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
    GameEvents.emit("LEVEL_CHANGED", this.level);
  }

  public resetActorPositions() {
    // In arcade Pac-Man: if a bonus fruit was currently active when Pac-Man died,
    // it immediately disappears and does NOT reappear after respawning (treated as already consummated).
    if (this.fruit) {
      this.fruit.active = false;
      this.fruit = null;
    }

    const speedConfig = getSpeedConfigForLevel(this.level);

    // Pac-Man actor: spawn on candidate integer tile center
    const pacCol = this.maze.pacmanSpawn.candidates
      ? this.maze.pacmanSpawn.candidates[0].col
      : this.maze.pacmanSpawn.x;
    const pacRow = this.maze.pacmanSpawn.candidates
      ? this.maze.pacmanSpawn.candidates[0].row
      : this.maze.pacmanSpawn.y;

    this.pacman = new Pacman(
      pacCol * TILE_SIZE + TILE_SIZE / 2,
      pacRow * TILE_SIZE + TILE_SIZE / 2,
      this.maze.pacmanSpawn.dir
    );
    this.pacman.speed = speedConfig.pacmanNormal;
    this.pacman.invincible = this.settings.invincible;

    // Ghosts initial spawn on designated candidate integer tiles
    const gSpawns = this.maze.ghostSpawns;
    const getSpawnPos = (type: GhostType) => {
      const sp = gSpawns[type];
      const c = sp.candidates ? sp.candidates[0].col : sp.x;
      const r = sp.candidates ? sp.candidates[0].row : sp.y;
      return { x: c * TILE_SIZE + TILE_SIZE / 2, y: r * TILE_SIZE + TILE_SIZE / 2 };
    };

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

    const isElroyBlinky = this.dotsRemaining <= ELROY_1_DOTS_LEFT;
    const pacmanTilePos = {
      col: Math.floor(this.pacman.x / TILE_SIZE),
      row: Math.floor(this.pacman.y / TILE_SIZE),
    };
    this.ghosts.BLINKY.mode = isElroyBlinky ? "CHASE" : "SCATTER";
    this.ghosts.BLINKY.prevMode = isElroyBlinky ? "CHASE" : "SCATTER";
    this.ghosts.BLINKY.target = isElroyBlinky ? pacmanTilePos : this.maze.scatterTargets.BLINKY;

    this.ghosts.PINKY.target = this.maze.scatterTargets.PINKY;
    this.ghosts.PINKY.houseTimer = 60;
    this.ghosts.INKY.target = this.maze.scatterTargets.INKY;
    this.ghosts.INKY.houseTimer = 180;
    this.ghosts.CLYDE.target = this.maze.scatterTargets.CLYDE;
    this.ghosts.CLYDE.houseTimer = 300;

    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      this.ghosts[type].speed = speedConfig.ghostNormal;
    });
  }

  public setInputDirection(dir: Direction) {
    if (this.pacman && !this.pacman.isDying) {
      this.pacman.setRequestedDirection(dir);
    }
  }

  public update() {
    if (this.playState === "PAUSED" || this.rewindIndex !== -1) {
      soundEngine.stopSiren();
      return;
    }

    if (this.playState === "READY") {
      soundEngine.stopSiren();
      this.readyTimer--;
      if (this.readyTimer <= 0) {
        this.playState = "PLAYING";
        GameEvents.emit("PLAY_STATE_CHANGED", this.playState);
      }
      return;
    }

    if (this.playState === "LEVEL_CLEAR") {
      this.levelClearTimer--;
      if (this.levelClearTimer <= 0) {
        this.loadLevel(this.level + 1);
        this.playState = "READY";
        this.readyTimer = uiConfig.timings.readyBannerFrames;
        GameEvents.emit("PLAY_STATE_CHANGED", this.playState);
      }
      return;
    }

    if (this.playState === "DYING") {
      this.pacman.deathProgress += 0.015;
      if (this.pacman.deathProgress >= 1) {
        this.lives--;
        GameEvents.emit("LIVES_CHANGED", this.lives);

        // Discard bonus fruit immediately upon losing a life.
        if (this.fruit) {
          this.fruit.active = false;
          this.fruit = null;
        }

        if (this.lives <= 0) {
          this.playState = "GAME_OVER";
          soundEngine.stopSiren();
          GameEvents.emit("PLAY_STATE_CHANGED", this.playState);
          GameEvents.emit("GAME_OVER", this.score);

          if (this.score > this.highScore) {
            this.highScore = this.score;
            GameEvents.emit("SCORE_CHANGED", { score: this.score, highScore: this.highScore });
          }
        } else {
          this.timerController.resetTimers();
          this.gameLoopController.resetLevelFrame();
          this.resetActorPositions();
          this.playState = "READY";
          this.readyTimer = uiConfig.timings.readyBannerFrames;
          GameEvents.emit("PLAY_STATE_CHANGED", this.playState);
        }
      }
      return;
    }

    if (this.playState !== "PLAYING") {
      return;
    }

    // Advance Timers via TimerController (scaled by gameSpeed)
    this.timerController.level = this.level;
    this.timerController.update(
      this.settings.gameSpeed,
      (newMode) => {
        // Scatter <-> Chase wave switch: prime 180° reversal upon reaching next tile center!
        (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
          const g = this.ghosts[type];
          if (g.mode === "EATEN" || g.mode === "FRIGHTENED" || g.inHouse) return;
          // Cruise Elroy Blinky ignores scatter mode and remains in CHASE
          if (
            type === "BLINKY" &&
            this.dotsRemaining <= ELROY_1_DOTS_LEFT &&
            newMode === "SCATTER"
          ) {
            g.mode = "CHASE";
            g.prevMode = "CHASE";
            return;
          }
          g.prevMode = g.mode;
          g.mode = newMode;
          g.primeReversal(); // Tile-aligned primed reversal!
        });
      },
      () => {
        // Frightened mode ended: revert ghosts safely
        const currentWave = this.timerController.currentWave;
        const defaultMode = currentWave?.mode || "CHASE";
        (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
          const g = this.ghosts[type];
          if (g.mode === "FRIGHTENED") {
            let nextMode = g.prevMode && g.prevMode !== "FRIGHTENED" ? g.prevMode : defaultMode;
            if (
              type === "BLINKY" &&
              this.dotsRemaining <= ELROY_1_DOTS_LEFT &&
              nextMode === "SCATTER"
            ) {
              nextMode = "CHASE";
            }
            g.mode = nextMode;
            g.prevMode = g.mode;
          }
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
    this.animationController.updatePacmanAnimation(this.pacman, this.settings.gameSpeed);
    this.animationController.updateGhostVisuals(
      this.ghosts,
      this.level,
      this.frightenedGlobalTimer,
      this.settings.gameSpeed
    );

    // Check Collisions
    this.checkCollisions();

    // Update Fruit
    this.updateFruit();

    // Update Score Popups
    this.updateScorePopups();

    // Manage Background Siren
    this.updateAudioSiren();

    // Evaluate in-game diagnostic invariants
    this.diagnosticController.evaluateRules(this, this.currLevelFrame);

    // Record snapshot for Rewind Buffer
    this.recordSnapshot();

    // Emit live diagnostics event for decoupled subscribers
    if (this.currLevelFrame % 4 === 0) {
      GameEvents.emit("DIAGNOSTICS_TICK", this.getActorsDiagnostics());
    }
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
      this.settings.gameSpeed,
      this.maze
    );
  }

  private updateGhostsMovement(speedConfig: LevelSpeedConfig) {
    const blinky = this.ghosts.BLINKY;
    const doorX = 13 * TILE_SIZE + TILE_SIZE / 2;

    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];

      // Cruise Elroy Blinky immunity: Blinky must NEVER be in SCATTER when dotsRemaining <= ELROY_1_DOTS_LEFT
      if (type === "BLINKY" && this.dotsRemaining <= ELROY_1_DOTS_LEFT && g.mode === "SCATTER") {
        g.mode = "CHASE";
        g.prevMode = "CHASE";
      }

      // 1. House emergence management
      if (g.inHouse) {
        this.ghostAiController.updateHouseEmergence(g, doorX, this.settings.gameSpeed);
        return;
      }

      // 2. Clyde's Proximity Targeting Update (Arcade-Accurate 8-Tile Circle Rule)
      // Clyde does not use custom sub-state clocks or Math.random inside this tick loop.
      if (type === "CLYDE") {
        const pacTile = this.pacman.tileCoord;
        const clydeTile = g.tileCoord;

        // Calculate true Euclidean squared tile distance
        const dx = clydeTile.col - pacTile.col;
        const dy = clydeTile.row - pacTile.row;
        const distanceSquared = dx * dx + dy * dy;

        // If closer than 8 tiles (64 squared), Clyde panics and flees to his home corner.
        // Otherwise, he targets Pac-Man directly using normal Chase target parameters.
        g.clydeWanderState = distanceSquared < 64 ? "FLEE" : "CHASE";
      }

      // 3. Update Target Tile with configurable 1980 ROM quirks flag
      this.ghostAiController.emulateRomQuirks = this.settings.emulateRomQuirks;
      g.target = this.ghostAiController.calculateTarget(
        g,
        this.pacman,
        blinky,
        this.maze,
        this.dotsRemaining
      );

      // 4. Discrete 16-frame bitmask speed & tile-to-tile movement
      const turboMult = this.settings.turbo ? this.settings.turboSpeedMultiplier : 1.0;
      const speedPct = g.getSpeedPercentage(this.maze, this.dotsRemaining, speedConfig);

      this.movementController.updateGhostMovement(
        g,
        blinky,
        this.pacman,
        this.currLevelFrame,
        speedPct,
        turboMult,
        this.settings.gameSpeed,
        this.maze,
        this.dotsRemaining,
        this.ghostAiController
      );
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
        this.score += 10;
        this.dotsRemaining--;
        this.dotsEatenThisRound++;
        this.pacman.eatingFreezeFrames = 1; // Authentic 1-frame eating freeze
        soundEngine.playWaka();
        this.checkFruitSpawn();
        this.checkLevelClear();
        GameEvents.emit("SCORE_CHANGED", { score: this.score, highScore: this.highScore });
      } else if (tile === "ENERGIZER") {
        this.maze.tiles[pacRow][pacCol] = "EMPTY";
        this.score += 50;
        this.dotsRemaining--;
        this.dotsEatenThisRound++;
        this.pacman.eatingFreezeFrames = 3; // Authentic 3-frame energizer freeze
        this.eatenGhostsInEnergizer = 0;
        soundEngine.playWaka();
        this.triggerFrightenedMode();
        this.checkFruitSpawn();
        this.checkLevelClear();
        GameEvents.emit("SCORE_CHANGED", { score: this.score, highScore: this.highScore });
        GameEvents.emit("ENERGIZER_EATEN", { level: this.level });
      }
    }

    // 2. Check Ghost Collision (Strict Single-Point Anchor Integer Tile Occupancy)
    const pacTile = this.pacman.tileCoord;

    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];
      if (g.inHouse) return;

      const ghostTile = g.tileCoord;
      const isColliding = pacTile.col === ghostTile.col && pacTile.row === ghostTile.row;

      if (isColliding) {
        if (g.mode === "FRIGHTENED") {
          // Eat Ghost!
          g.mode = "EATEN";
          g.flashState = false;
          g.reversalPrimed = false; // Getting eaten does not trigger reversal or preserve primed reversals
          g.lastDecisionTile = undefined; // Re-evaluate targeting towards house doorstep immediately
          g.target = this.ghostAiController.calculateTarget(
            g,
            this.pacman,
            this.ghosts.BLINKY,
            this.maze,
            this.dotsRemaining
          );
          this.eatenGhostsInEnergizer++;
          const points = 200 * Math.pow(2, Math.min(3, this.eatenGhostsInEnergizer - 1));
          this.score += points;

          soundEngine.playEatGhost();

          // Add Score Popup
          this.scorePopups.push({
            id: `ghost_${Date.now()}_${type}`,
            text: `${points}`,
            x: g.x,
            y: g.y,
            life: 45,
            color: "#00ffff",
          });

          GameEvents.emit("SCORE_CHANGED", { score: this.score, highScore: this.highScore });
          GameEvents.emit("GHOST_EATEN", { type, points });
        } else if (g.mode === "CHASE" || g.mode === "SCATTER") {
          if (!this.settings.invincible && !this.pacman.invincible) {
            // Pac-Man Dies!
            this.pacman.isDying = true;
            this.pacman.deathProgress = 0;
            this.playState = "DYING";

            // Discard bonus fruit immediately upon losing a life.
            if (this.fruit) {
              this.fruit.active = false;
              this.fruit = null;
            }

            soundEngine.playDeath().catch(() => {
              /* GG */
            });
          }
        }
      }
    });

    // 3. Check Fruit Collision (Pac-Man's center anchor occupies fruit candidate tiles)
    if (this.fruit && this.fruit.active) {
      const fruitRow = this.fruit.row;
      const fruitCol = this.fruit.col;
      const isFruitTile =
        pacTile.row === fruitRow &&
        (pacTile.col === fruitCol || pacTile.col === 13 || pacTile.col === 14);

      if (isFruitTile) {
        this.score += this.fruit.points;
        this.fruit.active = false;
        soundEngine.playEatFruit();

        const fruitX = fruitCol * TILE_SIZE + halfTile;
        const fruitY = fruitRow * TILE_SIZE + halfTile;

        this.scorePopups.push({
          id: `fruit_${Date.now()}`,
          text: `${this.fruit.points}`,
          x: fruitX,
          y: fruitY,
          life: 50,
          color: "#ffcc00",
        });

        GameEvents.emit("SCORE_CHANGED", { score: this.score, highScore: this.highScore });
        GameEvents.emit("FRUIT_EATEN", this.fruit.points);
      }
    }

    // High Score tracking
    if (this.score > this.highScore) {
      this.highScore = this.score;
      GameEvents.emit("SCORE_CHANGED", { score: this.score, highScore: this.highScore });
    }
  }

  public triggerFrightenedMode() {
    const duration = getFrightenedDuration(this.level);

    this.timerController.triggerFrightened(duration);

    const currentWave = getScatterChaseSchedule(this.level)[this.waveIndex];
    const defaultMode = currentWave?.mode || "CHASE";

    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];

      // Eaten ghosts (eyes returning to house) and ghosts already in the house are immune to frightened mode
      if (g.mode === "EATEN" || g.inHouse) return;

      // Frightened mode primes a 180° direction reversal upon crossing into the next tile boundary
      g.primeReversal();

      if (duration <= 0) return;

      g.prevMode =
        g.mode !== "FRIGHTENED"
          ? g.mode
          : !g.prevMode || g.prevMode === "FRIGHTENED"
            ? defaultMode
            : g.prevMode;

      g.mode = "FRIGHTENED";
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
    const fruitMeta = getFruitDataPerLevel(CLASSIC_FRUITS, this.level);

    this.fruit = {
      name: fruitMeta.name,
      points: fruitMeta.points,
      col: 13, // Standardized to absolute integer coordinate to keep pathing calculations clean
      row: 20,
      active: true,
      duration: 600, // ~10 seconds at 60Hz
      color: fruitMeta.color,
      symbol: fruitMeta.symbol,
      bouncing: this.mode === "MS_PACMAN",
      bounceY: 0,
      bounceDir: 1,
    };
  }

  private updateFruit() {
    if (this.fruit && this.fruit.active) {
      this.fruit.duration--;
      if (this.fruit.bouncing) {
        this.fruit.bounceY = Math.sin(Date.now() / 150) * 4;
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
      popup.y -= 0.3; // float upward

      if (popup.life <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }
  }

  private checkLevelClear() {
    if (this.dotsRemaining <= 0) {
      this.playState = "LEVEL_CLEAR";
      this.levelClearTimer = 120; // 2 seconds flash
      soundEngine.stopSiren();
      GameEvents.emit("PLAY_STATE_CHANGED", this.playState);
      GameEvents.emit("LEVEL_CLEARED", this.level);
    }
  }

  private updateAudioSiren() {
    if (!this.settings.soundEnabled || this.playState !== "PLAYING") {
      soundEngine.stopSiren();
      return;
    }

    const anyFrightened = Object.values(this.ghostStates).some((g) => g.mode === "FRIGHTENED");
    const anyEaten = Object.values(this.ghostStates).some((g) => g.mode === "EATEN");

    if (anyEaten) {
      soundEngine.updateSiren("EYES");
    } else if (anyFrightened) {
      soundEngine.updateSiren("FRIGHTENED");
    } else {
      const dotsRatio = this.totalDots > 0 ? this.dotsRemaining / this.totalDots : 1;
      soundEngine.updateSiren("NORMAL", dotsRatio);
    }
  }

  // --- Rewind Buffer & Practice Sandbox ---

  private recordSnapshot() {
    // Deep clone tiles array state to preserve dot consumption history
    const clonedTiles: TileType[][] = this.maze.tiles.map((row) => [...row]);
    const clonedGhosts = JSON.parse(JSON.stringify(this.ghostStates)) as Record<
      GhostType,
      GhostState
    >;
    const clonedPacman: PacmanState = { ...this.pacmanState };

    const snapshot: SnapshotState = {
      pacman: clonedPacman,
      ghosts: clonedGhosts,
      score: this.score,
      level: this.level,
      lives: this.lives,
      dotsRemaining: this.dotsRemaining,
      fruit: this.fruit ? { ...this.fruit } : null,
      eatenGhostsInEnergizer: this.eatenGhostsInEnergizer,
      globalWaveIndex: this.waveIndex,
      globalWaveTimer: this.waveTimer,
      frightenedGlobalTimer: this.frightenedGlobalTimer,
      playState: this.playState,
      tiles: clonedTiles,
    };

    this.rewindBuffer.push(snapshot);
    if (this.rewindBuffer.length > this.maxRewindFrames) {
      this.rewindBuffer.shift();
    }
  }

  public getRewindBufferLength(): number {
    return this.rewindBuffer.length;
  }

  public scrubToFrame(frameIndex: number) {
    if (frameIndex < 0 || frameIndex >= this.rewindBuffer.length) return;

    this.rewindIndex = frameIndex;
    const snap = this.rewindBuffer[frameIndex];
    this.restoreSnapshot(snap);
  }

  public rewindSeconds(seconds: number) {
    const frames = Math.round(seconds * 60);
    const targetIdx = Math.max(0, this.rewindBuffer.length - 1 - frames);
    this.scrubToFrame(targetIdx);
  }

  public resumeFromScrub() {
    if (this.rewindIndex !== -1) {
      // Truncate buffer to current frame and resume live play
      this.rewindBuffer = this.rewindBuffer.slice(0, this.rewindIndex + 1);
      this.rewindIndex = -1;
      this.playState = "PLAYING";
    }
  }

  public restoreSnapshot(snap: SnapshotState) {
    this.pacmanState = { ...snap.pacman };
    this.ghostStates = JSON.parse(JSON.stringify(snap.ghosts)) as Record<GhostType, GhostState>;
    this.score = snap.score;
    this.level = snap.level;
    this.lives = snap.lives;
    this.dotsRemaining = snap.dotsRemaining;
    this.fruit = snap.fruit ? { ...snap.fruit } : null;
    this.eatenGhostsInEnergizer = snap.eatenGhostsInEnergizer;
    this.waveIndex = snap.globalWaveIndex;
    this.waveTimer = snap.globalWaveTimer;
    this.frightenedGlobalTimer = snap.frightenedGlobalTimer;
    this.maze.tiles = snap.tiles.map((row) => [...row]);
  }

  public resetGhostsToHouse() {
    const gSpawns = this.maze.ghostSpawns;
    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];
      const isElroyBlinky = type === "BLINKY" && this.dotsRemaining <= ELROY_1_DOTS_LEFT;

      g.x = gSpawns[type].x * TILE_SIZE + TILE_SIZE / 2;
      g.y = gSpawns[type].y * TILE_SIZE + TILE_SIZE / 2;
      g.dir = gSpawns[type].initialDir;
      g.nextDir = gSpawns[type].initialDir;
      g.inHouse = gSpawns[type].inHouse;
      g.houseTimer = 30;
      g.mode = isElroyBlinky ? "CHASE" : "SCATTER";
      g.prevMode = isElroyBlinky ? "CHASE" : "SCATTER";
      g.flashState = false;
      g.reversalPrimed = false;
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
