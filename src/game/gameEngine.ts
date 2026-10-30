import { soundEngine } from "../audio/soundEngine";
import type {
  Direction,
  FruitItem,
  GameMode,
  GameSettings,
  GhostBehavior,
  GhostState,
  GhostType,
  MazeData,
  PacmanState,
  PlayState,
  ScorePopup,
  SnapshotState,
  TileType,
} from "../types";
import {
  getFrightenedDuration,
  getFrightenedFlashCount,
  getFruitDataPerLevel,
  getScatterChaseSchedule,
  getSpeedConfigForLevel,
} from "../utils";
import {
  CLASSIC_FRUITS,
  COOKIE_MAN_TREATS,
  CRAZY_OTTO_TREATS,
  ELROY_1_DOTS_LEFT,
  FRIGHTENED_FLASH_TOGGLE_DURATION,
  TILE_SIZE,
} from "./constants";
import {
  calculateGhostTarget,
  chooseNextGhostDirection,
  getDirectionVector,
  getGhostSpeed,
  getOppositeDirection,
  isTileWalkableForGhost,
} from "./ghostAi";
import { getMazeData } from "./mazes";

export class GameEngine {
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
    showGrid: true,
    showGhostPaths: false,
    showTargetLines: false,
    invincible: false,
    gameSpeed: 1.0,
    soundEnabled: true,
    soundVolume: 0.5,
    crtFilter: false,
    touchControls: false,
  };

  public maze!: MazeData;
  public pacman!: PacmanState;
  public ghosts!: Record<GhostType, GhostState>;
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

  // Wave timing
  public waveIndex: number = 0;
  public waveTimer: number = 0; // seconds
  public frightenedGlobalTimer: number = 0; // seconds

  // Rewind ring buffer (up to 900 frames ~ 15 seconds)
  private rewindBuffer: SnapshotState[] = [];
  private readonly maxRewindFrames: number = 900;
  public rewindIndex: number = -1; // when scrubbing (-1 means live play)

  // Level Clear Animation
  public levelClearTimer: number = 0;
  public readyTimer: number = 0;

  // Callbacks for UI sync
  public onStateChange?: () => void;
  public onGameOver?: (finalScore: number) => void;
  public onNewHighScore?: (score: number) => void;

  constructor(mode: GameMode = "PACMAN", highScoresRecord: number = 0) {
    this.mode = mode;
    this.highScore = highScoresRecord;
    this.initGame(mode, 1);
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
    this.rewindBuffer = [];
    this.rewindIndex = -1;

    this.loadLevel(this.level);
    this.playState = "READY";
    this.readyTimer = 120; // 2 seconds ready screen
  }

  public loadLevel(lvl: number) {
    this.level = lvl;
    this.maze = getMazeData(this.mode, this.level);
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.dotsRemaining = 0;
    this.dotsEatenThisRound = 0;
    this.frightenedGlobalTimer = 0;

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
  }

  public resetActorPositions() {
    // Scatter/chase timer resets to the beginning whenever Pac-Man loses a life or round starts
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.frightenedGlobalTimer = 0;

    const speedConfig = getSpeedConfigForLevel(this.level);

    // Pac-Man initial spawn
    this.pacman = {
      x: this.maze.pacmanSpawn.x * TILE_SIZE + TILE_SIZE / 2,
      y: this.maze.pacmanSpawn.y * TILE_SIZE + TILE_SIZE / 2,
      dir: this.maze.pacmanSpawn.dir,
      nextDir: this.maze.pacmanSpawn.dir,
      speed: speedConfig.pacmanNormal,
      mouthAngle: 0.2,
      mouthOpening: true,
      isDying: false,
      deathProgress: 0,
      invincible: this.settings.invincible,
      eatDotCooldown: 0,
    };

    // Ghosts initial spawn
    const gSpawns = this.maze.ghostSpawns;
    this.ghosts = {
      BLINKY: {
        type: "BLINKY",
        x: gSpawns.BLINKY.x * TILE_SIZE + TILE_SIZE / 2,
        y: gSpawns.BLINKY.y * TILE_SIZE + TILE_SIZE / 2,
        dir: gSpawns.BLINKY.initialDir,
        nextDir: gSpawns.BLINKY.initialDir,
        mode: "SCATTER",
        prevMode: "SCATTER",
        speed: speedConfig.ghostNormal,
        target: this.maze.scatterTargets.BLINKY,
        inHouse: gSpawns.BLINKY.inHouse,
        houseTimer: 0,
        dotCounter: 0,
        flashState: false,
        frightenedTimer: 0,
        feetAnimation: 0,
        bouncedInHouse: false,
      },
      PINKY: {
        type: "PINKY",
        x: gSpawns.PINKY.x * TILE_SIZE + TILE_SIZE / 2,
        y: gSpawns.PINKY.y * TILE_SIZE + TILE_SIZE / 2,
        dir: gSpawns.PINKY.initialDir,
        nextDir: gSpawns.PINKY.initialDir,
        mode: "SCATTER",
        prevMode: "SCATTER",
        speed: speedConfig.ghostNormal,
        target: this.maze.scatterTargets.PINKY,
        inHouse: gSpawns.PINKY.inHouse,
        houseTimer: 60, // leaves soon after start
        dotCounter: 0,
        flashState: false,
        frightenedTimer: 0,
        feetAnimation: 0,
        bouncedInHouse: false,
      },
      INKY: {
        type: "INKY",
        x: gSpawns.INKY.x * TILE_SIZE + TILE_SIZE / 2,
        y: gSpawns.INKY.y * TILE_SIZE + TILE_SIZE / 2,
        dir: gSpawns.INKY.initialDir,
        nextDir: gSpawns.INKY.initialDir,
        mode: "SCATTER",
        prevMode: "SCATTER",
        speed: speedConfig.ghostNormal,
        target: this.maze.scatterTargets.INKY,
        inHouse: gSpawns.INKY.inHouse,
        houseTimer: 180, // leaves after 30 dots or ~3 seconds
        dotCounter: 0,
        flashState: false,
        frightenedTimer: 0,
        feetAnimation: 0,
        bouncedInHouse: false,
      },
      CLYDE: {
        type: "CLYDE",
        x: gSpawns.CLYDE.x * TILE_SIZE + TILE_SIZE / 2,
        y: gSpawns.CLYDE.y * TILE_SIZE + TILE_SIZE / 2,
        dir: gSpawns.CLYDE.initialDir,
        nextDir: gSpawns.CLYDE.initialDir,
        mode: "SCATTER",
        prevMode: "SCATTER",
        speed: speedConfig.ghostNormal,
        target: this.maze.scatterTargets.CLYDE,
        inHouse: gSpawns.CLYDE.inHouse,
        houseTimer: 300, // leaves after 60 dots or ~5 seconds
        dotCounter: 0,
        flashState: false,
        frightenedTimer: 0,
        feetAnimation: 0,
        bouncedInHouse: false,
        clydeWanderState: "CHASE",
        clydeSwitchTimer: 3.0,
      },
    };
  }

  public setInputDirection(dir: Direction) {
    if (this.playState === "READY") {
      this.playState = "PLAYING";
    }
    if (this.pacman && !this.pacman.isDying) {
      this.pacman.nextDir = dir;
      // Immediate 180 turn without waiting for intersection
      if (getOppositeDirection(this.pacman.dir) === dir) {
        this.pacman.dir = dir;
      }
    }
  }

  public update() {
    if (this.playState === "PAUSED" || this.rewindIndex !== -1) {
      return;
    }

    if (this.playState === "READY") {
      this.readyTimer--;
      if (this.readyTimer <= 0) {
        this.playState = "PLAYING";
      }
      return;
    }

    if (this.playState === "LEVEL_CLEAR") {
      this.levelClearTimer--;
      if (this.levelClearTimer <= 0) {
        this.loadLevel(this.level + 1);
        this.playState = "READY";
        this.readyTimer = 90;
      }
      return;
    }

    if (this.playState === "DYING") {
      this.pacman.deathProgress += 0.015;
      if (this.pacman.deathProgress >= 1) {
        this.lives--;
        if (this.lives <= 0) {
          this.playState = "GAME_OVER";
          soundEngine.stopSiren();
          if (this.onGameOver) this.onGameOver(this.score);
          if (this.score > this.highScore && this.onNewHighScore) {
            this.onNewHighScore(this.score);
          }
        } else {
          this.resetActorPositions();
          this.playState = "READY";
          this.readyTimer = 90;
        }
      }
      return;
    }

    if (this.playState !== "PLAYING") {
      return;
    }

    // Advance Timers (scaled by gameSpeed)
    this.updateTimers();

    // Update Pac-Man
    this.updatePacman();

    // Update Ghosts
    this.updateGhosts();

    // Check Collisions
    this.checkCollisions();

    // Update Fruit
    this.updateFruit();

    // Update Score Popups
    this.updateScorePopups();

    // Manage Background Siren
    this.updateAudioSiren();

    // Record snapshot for Rewind Buffer
    this.recordSnapshot();

    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  private updateTimers() {
    const dt = (1 / 60) * this.settings.gameSpeed;

    // Frightened mode global countdown (eating a Power Pellet pauses the scatter/chase wave timer)
    if (this.frightenedGlobalTimer > 0) {
      this.frightenedGlobalTimer -= dt;
      if (this.frightenedGlobalTimer <= 0) {
        this.frightenedGlobalTimer = 0;

        // Revert frightened ghosts to their previous mode (or current scheduled wave mode)
        const currentWave = getScatterChaseSchedule(this.level)[this.waveIndex];
        const defaultMode = currentWave?.mode || "CHASE";

        (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
          const g = this.ghosts[type];
          if (g.mode === "FRIGHTENED") {
            // Revert safely, preventing cyclic FRIGHTENED state
            g.mode = g.prevMode && g.prevMode !== "FRIGHTENED" ? g.prevMode : defaultMode;
            g.prevMode = g.mode;
          }

          g.flashState = false;
        });
      }
    } else {
      // Normal Scatter / Chase wave progression (resumes cleanly when frightened timer expires)
      const currentWave = getScatterChaseSchedule(this.level)[this.waveIndex];
      if (currentWave && currentWave.duration !== Infinity) {
        this.waveTimer += dt;
        if (this.waveTimer >= currentWave.duration) {
          this.waveTimer = 0;
          this.waveIndex++;
          const nextWave = getScatterChaseSchedule(this.level)[this.waveIndex];
          const newMode = (nextWave?.mode || "CHASE") as GhostBehavior;

          // Reversing direction when switching between scatter and chase
          (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
            const g = this.ghosts[type];
            if (g.mode !== "EATEN" && g.mode !== "FRIGHTENED" && !g.inHouse) {
              // Cruise Elroy Blinky ignores scatter mode and remains in CHASE
              if (
                type === "BLINKY" &&
                this.dotsRemaining <= ELROY_1_DOTS_LEFT &&
                newMode === "SCATTER"
              ) {
                return;
              }

              g.prevMode = g.mode;
              g.mode = newMode;
              g.dir = getOppositeDirection(g.dir);
            }
          });
        }
      }
    }
  }

  private updatePacman() {
    // Effective speed derived from speed tables
    const speedConfig = getSpeedConfigForLevel(this.level);
    const isTurbo = this.settings.turbo;
    const isFrightened = this.frightenedGlobalTimer > 0;

    let baseSpeed: number;
    if (isFrightened) {
      baseSpeed =
        this.pacman.eatDotCooldown > 0 ? speedConfig.pacmanFrightEating : speedConfig.pacmanFright;
    } else {
      baseSpeed =
        this.pacman.eatDotCooldown > 0 ? speedConfig.pacmanEating : speedConfig.pacmanNormal;
    }

    if (isTurbo) {
      baseSpeed *= this.settings.turboSpeedMultiplier;
    }

    const speed = baseSpeed * this.settings.gameSpeed;
    this.pacman.speed = speed;

    if (this.pacman.eatDotCooldown > 0) {
      this.pacman.eatDotCooldown--;
    }

    // Try buffered next direction turn
    if (this.pacman.nextDir !== this.pacman.dir && this.pacman.nextDir !== "NONE") {
      if (this.canPacmanMove(this.pacman.x, this.pacman.y, this.pacman.nextDir)) {
        // Snap to center of tile axis for clean corner rounding
        const halfTile = TILE_SIZE / 2;
        if (this.pacman.nextDir === "UP" || this.pacman.nextDir === "DOWN") {
          const targetX = Math.floor(this.pacman.x / TILE_SIZE) * TILE_SIZE + halfTile;
          if (Math.abs(this.pacman.x - targetX) < 4) {
            this.pacman.x = targetX;
            this.pacman.dir = this.pacman.nextDir;
          }
        } else {
          const targetY = Math.floor(this.pacman.y / TILE_SIZE) * TILE_SIZE + halfTile;
          if (Math.abs(this.pacman.y - targetY) < 4) {
            this.pacman.y = targetY;
            this.pacman.dir = this.pacman.nextDir;
          }
        }
      }
    }

    // Move in current direction if possible
    if (this.canPacmanMove(this.pacman.x, this.pacman.y, this.pacman.dir)) {
      const { dx, dy } = getDirectionVector(this.pacman.dir);
      this.pacman.x += dx * speed;
      this.pacman.y += dy * speed;

      // Wrap around tunnel
      this.handleTunnelWrap(this.pacman);

      // Mouth chomp animation
      if (this.pacman.mouthOpening) {
        this.pacman.mouthAngle += 0.05 * this.settings.gameSpeed;
        if (this.pacman.mouthAngle >= 0.45) this.pacman.mouthOpening = false;
      } else {
        this.pacman.mouthAngle -= 0.05 * this.settings.gameSpeed;
        if (this.pacman.mouthAngle <= 0.05) this.pacman.mouthOpening = true;
      }
    }
  }

  private canPacmanMove(x: number, y: number, dir: Direction): boolean {
    const { dx, dy } = getDirectionVector(dir);
    // Probe ahead
    const checkDist = TILE_SIZE / 2 + 1;
    const probeX = x + dx * checkDist;
    const probeY = y + dy * checkDist;

    const col = Math.floor(probeX / TILE_SIZE);
    const row = Math.floor(probeY / TILE_SIZE);

    if (row < 0 || row >= this.maze.height) return false;

    // Check tunnel wrap
    if (col < 0 || col >= this.maze.width) {
      return this.maze.tunnels.some((t) => t.y === row);
    }

    const tile = this.maze.tiles[row][col];
    // Pac-Man cannot enter walls, gate, or ghost house
    return tile !== "WALL" && tile !== "GATE" && tile !== "GHOST_HOUSE";
  }

  private handleTunnelWrap(entity: { x: number; y: number }) {
    const row = Math.floor(entity.y / TILE_SIZE);
    const isTunnel = this.maze.tunnels.some((t) => t.y === row);
    if (isTunnel) {
      if (entity.x < -TILE_SIZE / 2) {
        entity.x = this.maze.width * TILE_SIZE + TILE_SIZE / 2 - 2;
      } else if (entity.x > this.maze.width * TILE_SIZE + TILE_SIZE / 2) {
        entity.x = -TILE_SIZE / 2 + 2;
      }
    }
  }

  private updateGhosts() {
    const blinky = this.ghosts.BLINKY;
    const speedConfig = getSpeedConfigForLevel(this.level);

    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];
      g.feetAnimation = (g.feetAnimation + 0.15 * this.settings.gameSpeed) % 1;

      // House exit management
      if (g.inHouse) {
        this.updateGhostInHouse(g);
        return;
      }

      // Check if eaten eyes have returned through the gate into the pen interior to revive
      if (g.mode === "EATEN") {
        const doorX = 13 * TILE_SIZE + TILE_SIZE / 2; // 216
        const ghostRow = Math.floor(g.y / TILE_SIZE);
        const ghostCol = Math.floor(g.x / TILE_SIZE);

        // Eyes must have entered through the front door (cols 13-14), moving DOWN and reached the pen interior (row 17)
        if (
          (ghostCol === 13 || ghostCol === 14) &&
          ghostRow >= 17 &&
          g.dir === "DOWN" &&
          Math.abs(g.x - doorX) <= 16
        ) {
          // Successfully arrived inside the pen! Revive!
          g.x = doorX;
          g.y = 17 * TILE_SIZE + TILE_SIZE / 2;
          g.inHouse = true;
          g.mode = "CHASE";
          g.prevMode = "CHASE";
          g.flashState = false;
          g.houseTimer = 60; // brief recovery before exiting
          g.dir = "UP";
          g.nextDir = "UP";
          return;
        }
      }

      // Warning flash state calculation based on authentic arcade flash counts and 14-frame toggle periods
      if (g.mode === "FRIGHTENED" && this.frightenedGlobalTimer > 0) {
        const flashCount = getFrightenedFlashCount(this.level);
        if (flashCount > 0) {
          const halfCyclesLeft = Math.floor(
            this.frightenedGlobalTimer / FRIGHTENED_FLASH_TOGGLE_DURATION
          );
          // In arcade Pac-Man, each flash cycle is 28 frames (14 frames white, 14 frames blue).
          // Odd half-cycles (1, 3, 5, 7, 9...) display WHITE, while even half-cycles display BLUE.
          g.flashState = halfCyclesLeft < 2 * flashCount && halfCyclesLeft % 2 === 1;
        } else {
          g.flashState = false;
        }
      } else {
        g.flashState = false;
      }

      // Clyde's far-distance random behavior switching
      if (type === "CLYDE") {
        const pacCol = Math.floor(this.pacman.x / TILE_SIZE);
        const pacRow = Math.floor(this.pacman.y / TILE_SIZE);
        const ghostCol = Math.floor(g.x / TILE_SIZE);
        const ghostRow = Math.floor(g.y / TILE_SIZE);
        const distSq = (pacCol - ghostCol) ** 2 + (pacRow - ghostRow) ** 2;

        if (distSq >= 64) {
          // Far away from Pac-Man (>= 8 tiles): decrement timer and randomly switch between CHASE and FLEE
          g.clydeSwitchTimer = (g.clydeSwitchTimer || 0) - (1 / 60) * this.settings.gameSpeed;
          if (g.clydeSwitchTimer <= 0) {
            // Randomly switch state: 60% chance to chase, 40% chance to flee
            g.clydeWanderState = Math.random() < 0.6 ? "CHASE" : "FLEE";
            // Random duration between 2.5 and 5.0 seconds
            g.clydeSwitchTimer = 2.5 + Math.random() * 2.5;
          }
        } else {
          // Closer than 8 tiles: Clyde immediately flees
          g.clydeWanderState = "FLEE";
        }
      }

      // Update Target Tile
      g.target = calculateGhostTarget(g, this.pacman, blinky, this.maze, this.dotsRemaining);

      // Speed calculation
      const turboMult = this.settings.turbo ? this.settings.turboSpeedMultiplier : 1.0;
      g.speed =
        getGhostSpeed(g, this.maze, this.dotsRemaining, turboMult, speedConfig) *
        this.settings.gameSpeed;

      // Airtight movement: never penetrates walls, stays centered on tile axis
      this.moveGhost(g, g.speed);

      // Check if eaten eyes reached the inside of the pen following movement
      if (g.mode === "EATEN") {
        const doorX = 13 * TILE_SIZE + TILE_SIZE / 2;
        const ghostRow = Math.floor(g.y / TILE_SIZE);
        const ghostCol = Math.floor(g.x / TILE_SIZE);

        if (
          (ghostCol === 13 || ghostCol === 14) &&
          ghostRow >= 17 &&
          g.dir === "DOWN" &&
          Math.abs(g.x - doorX) <= 16
        ) {
          g.x = doorX;
          g.y = 17 * TILE_SIZE + TILE_SIZE / 2;
          g.inHouse = true;
          g.mode = "CHASE";
          g.prevMode = "CHASE";
          g.flashState = false;
          g.houseTimer = 60;
          g.dir = "UP";
          g.nextDir = "UP";
        }
      }
    });
  }

  /**
   * Evaluates ghost direction at tile centers with 1-tile lookahead
   */
  private updateGhostTileArrival(g: GhostState, col: number, row: number) {
    // Determine the next valid direction from current tile center
    g.dir = chooseNextGhostDirection(g, g.target, this.maze, col, row, g.dir);

    // Pre-calculate decision for next tile ahead (1-tile lookahead)
    const { dx, dy } = getDirectionVector(g.dir);
    const lookCol = col + dx;
    const lookRow = row + dy;
    const blinky = this.ghosts.BLINKY;
    g.target = calculateGhostTarget(g, this.pacman, blinky, this.maze, this.dotsRemaining);
    g.nextDir = chooseNextGhostDirection(g, g.target, this.maze, lookCol, lookRow, g.dir);
  }

  private moveGhost(g: GhostState, speed: number) {
    if (g.dir === "NONE" || speed <= 0) return;

    const half = TILE_SIZE / 2;
    let remaining = speed;

    // Check tunnel wrap-around before moving
    const curRow = Math.floor(g.y / TILE_SIZE);
    const inTunnel = this.maze.tunnels.some((t) => t.y === curRow);
    if (inTunnel) {
      if (g.x < -half) {
        g.x = this.maze.width * TILE_SIZE + half - 2;
        return;
      } else if (g.x > this.maze.width * TILE_SIZE + half) {
        g.x = -half + 2;
        return;
      }
    }

    const { dx, dy } = getDirectionVector(g.dir);

    if (dx !== 0) {
      // Horizontal movement: lock Y strictly to center of current row
      const row = Math.floor(g.y / TILE_SIZE);
      g.y = row * TILE_SIZE + half;

      const col = Math.floor(g.x / TILE_SIZE);
      const tileCenterX = col * TILE_SIZE + half;

      if (dx > 0) {
        // Moving RIGHT
        const nextCol = col + 1;
        const nextCenterX = nextCol * TILE_SIZE + half;

        if (g.x >= tileCenterX && !isTileWalkableForGhost(nextCol, row, g, this.maze)) {
          g.x = tileCenterX;
          this.updateGhostTileArrival(g, col, row);
          return;
        }

        const targetCenter = g.x < tileCenterX ? tileCenterX : nextCenterX;
        const dist = targetCenter - g.x;

        if (remaining < dist) {
          g.x += remaining;
        } else {
          g.x = targetCenter;
          remaining -= dist;
          const reachedCol = Math.floor(targetCenter / TILE_SIZE);
          this.updateGhostTileArrival(g, reachedCol, row);
          if (remaining > 0) {
            this.moveGhost(g, remaining);
          }
        }
      } else {
        // Moving LEFT
        const nextCol = col - 1;
        const nextCenterX = nextCol * TILE_SIZE + half;

        if (g.x <= tileCenterX && !isTileWalkableForGhost(nextCol, row, g, this.maze)) {
          g.x = tileCenterX;
          this.updateGhostTileArrival(g, col, row);
          return;
        }

        const targetCenter = g.x > tileCenterX ? tileCenterX : nextCenterX;
        const dist = g.x - targetCenter;

        if (remaining < dist) {
          g.x -= remaining;
        } else {
          g.x = targetCenter;
          remaining -= dist;
          const reachedCol = Math.floor(targetCenter / TILE_SIZE);
          this.updateGhostTileArrival(g, reachedCol, row);
          if (remaining > 0) {
            this.moveGhost(g, remaining);
          }
        }
      }
    } else if (dy !== 0) {
      // Vertical movement: lock X strictly to center of current column
      const col = Math.floor(g.x / TILE_SIZE);
      g.x = col * TILE_SIZE + half;

      const row = Math.floor(g.y / TILE_SIZE);
      const tileCenterY = row * TILE_SIZE + half;

      if (dy > 0) {
        // Moving DOWN
        const nextRow = row + 1;
        const nextCenterY = nextRow * TILE_SIZE + half;

        if (g.y >= tileCenterY && !isTileWalkableForGhost(col, nextRow, g, this.maze)) {
          g.y = tileCenterY;
          this.updateGhostTileArrival(g, col, row);
          return;
        }

        const targetCenter = g.y < tileCenterY ? tileCenterY : nextCenterY;
        const dist = targetCenter - g.y;

        if (remaining < dist) {
          g.y += remaining;
        } else {
          g.y = targetCenter;
          remaining -= dist;
          const reachedRow = Math.floor(targetCenter / TILE_SIZE);
          this.updateGhostTileArrival(g, col, reachedRow);
          if (remaining > 0) {
            this.moveGhost(g, remaining);
          }
        }
      } else {
        // Moving UP
        const nextRow = row - 1;
        const nextCenterY = nextRow * TILE_SIZE + half;

        if (g.y <= tileCenterY && !isTileWalkableForGhost(col, nextRow, g, this.maze)) {
          g.y = tileCenterY;
          this.updateGhostTileArrival(g, col, row);
          return;
        }

        const targetCenter = g.y > tileCenterY ? tileCenterY : nextCenterY;
        const dist = g.y - targetCenter;

        if (remaining < dist) {
          g.y -= remaining;
        } else {
          g.y = targetCenter;
          remaining -= dist;
          const reachedRow = Math.floor(targetCenter / TILE_SIZE);
          this.updateGhostTileArrival(g, col, reachedRow);
          if (remaining > 0) {
            this.moveGhost(g, remaining);
          }
        }
      }
    }
  }

  private updateGhostInHouse(g: GhostState) {
    if (g.houseTimer > 0) {
      g.houseTimer -= 1 * this.settings.gameSpeed;
      // Bounce up and down in house
      const topY = 16 * TILE_SIZE;
      const botY = 17.5 * TILE_SIZE;
      if (g.y <= topY) g.bouncedInHouse = true;
      if (g.y >= botY) g.bouncedInHouse = false;
      g.y += (g.bouncedInHouse ? 0.6 : -0.6) * this.settings.gameSpeed;
      g.dir = g.bouncedInHouse ? "DOWN" : "UP";
    } else {
      // Move toward center door and exit
      const targetDoorX = 13 * TILE_SIZE + TILE_SIZE / 2; // Exact center of col 13 (216)
      const targetDoorY = 14 * TILE_SIZE + TILE_SIZE / 2; // Exact center of row 14 (232)

      if (Math.abs(g.x - targetDoorX) > 2) {
        g.x += Math.sign(targetDoorX - g.x) * 0.8 * this.settings.gameSpeed;
        g.dir = targetDoorX > g.x ? "RIGHT" : "LEFT";
      } else {
        g.x = targetDoorX;
        g.y -= 0.8 * this.settings.gameSpeed;
        g.dir = "UP";
        if (g.y <= targetDoorY) {
          g.x = targetDoorX;
          g.y = targetDoorY;
          g.inHouse = false;
          g.dir = "LEFT";
          g.nextDir = "LEFT";
        }
      }
    }
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
        this.pacman.eatDotCooldown = 2;
        soundEngine.playWaka();
        this.checkFruitSpawn();
        this.checkLevelClear();
      } else if (tile === "ENERGIZER") {
        this.maze.tiles[pacRow][pacCol] = "EMPTY";
        this.score += 50;
        this.dotsRemaining--;
        this.dotsEatenThisRound++;
        this.eatenGhostsInEnergizer = 0;
        soundEngine.playWaka();
        this.triggerFrightenedMode();
        this.checkFruitSpawn();
        this.checkLevelClear();
      }
    }

    // 2. Check Ghost Collision
    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];
      if (g.inHouse) return;

      const dist = Math.hypot(this.pacman.x - g.x, this.pacman.y - g.y);
      if (dist < TILE_SIZE * 0.75) {
        if (g.mode === "FRIGHTENED") {
          // Eat Ghost!
          g.mode = "EATEN";
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
        } else if (g.mode === "CHASE" || g.mode === "SCATTER") {
          if (!this.settings.invincible && !this.pacman.invincible) {
            // Pac-Man Dies!
            this.pacman.isDying = true;
            this.playState = "DYING";
            soundEngine.playDeath().catch(() => {
              /* GG */
            });
          }
        }
      }
    });

    // 3. Check Fruit Collision
    if (this.fruit && this.fruit.active) {
      const fruitX = this.fruit.col * TILE_SIZE + halfTile;
      const fruitY = this.fruit.row * TILE_SIZE + halfTile;
      const dist = Math.hypot(this.pacman.x - fruitX, this.pacman.y - fruitY);
      if (dist < TILE_SIZE * 0.9) {
        this.score += this.fruit.points;
        this.fruit.active = false;
        soundEngine.playEatFruit();

        this.scorePopups.push({
          id: `fruit_${Date.now()}`,
          text: `${this.fruit.points}`,
          x: fruitX,
          y: fruitY,
          life: 50,
          color: "#ffcc00",
        });
      }
    }

    // High Score tracking
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
  }

  public triggerFrightenedMode() {
    const duration = getFrightenedDuration(this.level);

    this.frightenedGlobalTimer = duration;

    const currentWave = getScatterChaseSchedule(this.level)[this.waveIndex];
    const defaultMode = currentWave?.mode || "CHASE";

    (Object.keys(this.ghosts) as GhostType[]).forEach((type) => {
      const g = this.ghosts[type];

      if (g.mode === "EATEN" || g.inHouse) return;

      g.dir = getOppositeDirection(g.dir);

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
    const fruitMeta =
      this.mode === "COOKIE_MAN"
        ? getFruitDataPerLevel(COOKIE_MAN_TREATS, this.level)
        : this.mode === "CRAZY_OTTO"
          ? getFruitDataPerLevel(CRAZY_OTTO_TREATS, this.level)
          : getFruitDataPerLevel(CLASSIC_FRUITS, this.level);

    this.fruit = {
      name: fruitMeta.name,
      points: fruitMeta.points,
      col: 13.5,
      row: 20,
      active: true,
      duration: 600, // ~10 seconds
      color: fruitMeta.color,
      symbol: fruitMeta.symbol,
      bouncing: this.mode === "MS_PACMAN" || this.mode === "CRAZY_OTTO",
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
    }
  }

  private updateAudioSiren() {
    if (!this.settings.soundEnabled || this.playState !== "PLAYING") {
      soundEngine.stopSiren();
      return;
    }

    const anyFrightened = Object.values(this.ghosts).some((g) => g.mode === "FRIGHTENED");
    const anyEaten = Object.values(this.ghosts).some((g) => g.mode === "EATEN");

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
    const clonedGhosts = JSON.parse(JSON.stringify(this.ghosts)) as Record<GhostType, GhostState>;
    const clonedPacman: PacmanState = { ...this.pacman };

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
    if (this.onStateChange) this.onStateChange();
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
      if (this.onStateChange) this.onStateChange();
    }
  }

  public restoreSnapshot(snap: SnapshotState) {
    this.pacman = { ...snap.pacman };
    this.ghosts = JSON.parse(JSON.stringify(snap.ghosts)) as Record<GhostType, GhostState>;
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
      g.x = gSpawns[type].x * TILE_SIZE + TILE_SIZE / 2;
      g.y = gSpawns[type].y * TILE_SIZE + TILE_SIZE / 2;
      g.dir = gSpawns[type].initialDir;
      g.inHouse = gSpawns[type].inHouse;
      g.houseTimer = 30;
      g.mode = "SCATTER";
    });
  }

  public toggleInvincible() {
    this.settings.invincible = !this.settings.invincible;
    if (this.pacman) {
      this.pacman.invincible = this.settings.invincible;
    }
  }
}
