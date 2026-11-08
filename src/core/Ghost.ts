import { Actor } from "./Actor";
import type {
  Direction,
  GhostBehavior,
  GhostState,
  GhostsToHousePhase,
  GhostType,
  LevelSpeedConfig,
  MazeData,
  TileCoord,
} from "../types";
import {
  ELROY_1_DOTS_LEFT,
  ELROY_2_DOTS_LEFT,
  GHOST_EATEN_SPEED_PCT,
  GHOST_HOUSE_SPEED_PCT,
  TILE_SIZE,
} from "../game/constants";
import { getSpeedConfigForLevel } from "../utils";

/**
 * Ghost Actor representing an AI-driven enemy with authentic arcade states:
 * Scatter, Chase, Frightened, Eaten (Eyes returning to house), and House confinement.
 *
 * Implements strict tile-to-tile movement, 1-tile advance intersection decision caching,
 * and primed wave reversals that execute cleanly upon reaching tile centers.
 */
export class Ghost extends Actor {
  public type: GhostType;

  public anchorX: number = 0.5;
  public anchorY: number = 0.5;

  public mode: GhostBehavior = "SCATTER";
  public prevMode: GhostBehavior = "SCATTER";
  public target: TileCoord = { col: 0, row: 0 };
  public intermediateTarget?: TileCoord;

  // House state
  public inHouse: boolean = false;
  public houseTimer: number = 0;
  public dotCounter: number = 0;
  public bouncedInHouse: boolean = false;

  // Frightened visuals
  public flashState: boolean = false;
  public frightenedTimer: number = 0;
  public feetAnimation: number = 0;

  // Clyde personality
  public clydeWanderState?: "CHASE" | "FLEE" = "CHASE";
  public clydeSwitchTimer?: number = 3.0;

  // Authentic tile-to-tile advance lookahead & reversal priming
  public reversalPrimed: boolean = false;
  public lastDecisionTile?: TileCoord;
  public lastOccupiedTile?: TileCoord;

  public enteringHousePhase: GhostsToHousePhase = "NONE";

  constructor(
    type: GhostType,
    x: number,
    y: number,
    dir: Direction = "UP",
    inHouse: boolean = false,
    anchorX: number = 0.5,
    anchorY: number = 0.5
  ) {
    super(x, y, dir, anchorX, anchorY);
    this.type = type;
    this.inHouse = inHouse;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.lastOccupiedTile = {
      col: Math.floor(x / TILE_SIZE),
      row: Math.floor(y / TILE_SIZE),
    };
  }

  /** Primes a 180-degree reversal to be executed upon crossing into the next tile boundary. */
  public primeReversal(): void {
    if (this.mode === "EATEN" || this.inHouse) return;
    this.reversalPrimed = true;
  }

  /**
   * Advances wavy scallop bottom skirt animation.
   */
  public updateFeetAnimation(gameSpeed: number = 1.0): void {
    this.feetAnimation = (this.feetAnimation + 0.15 * gameSpeed) % 1;
  }

  /**
   * Converts actor to plain serializable state representation.
   */
  public toState(): GhostState {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      anchorX: this.anchorX,
      anchorY: this.anchorY,
      dir: this.dir,
      nextDir: this.nextDir,
      mode: this.mode,
      prevMode: this.prevMode,
      speed: this.speed,
      target: this.target,
      inHouse: this.inHouse,
      houseTimer: this.houseTimer,
      dotCounter: this.dotCounter,
      flashState: this.flashState,
      frightenedTimer: this.frightenedTimer,
      feetAnimation: this.feetAnimation,
      bouncedInHouse: this.bouncedInHouse,
      clydeWanderState: this.clydeWanderState,
      clydeSwitchTimer: this.clydeSwitchTimer,
      intermediateTarget: this.intermediateTarget,
      reversalPrimed: this.reversalPrimed,
      lastDecisionTile: this.lastDecisionTile,
      lastOccupiedTile: this.lastOccupiedTile,
      enteringHousePhase: this.enteringHousePhase,
    };
  }

  /**
   * Restores actor state from a snapshot.
   */
  public restoreFromState(state: GhostState): void {
    this.x = state.x;
    this.y = state.y;
    this.anchorX = state.anchorX ?? 0.5;
    this.anchorY = state.anchorY ?? 0.5;
    this.dir = state.dir;
    this.nextDir = state.nextDir;
    this.mode = state.mode;
    this.prevMode = state.prevMode;
    this.speed = state.speed;
    this.target = state.target;
    this.inHouse = state.inHouse;
    this.houseTimer = state.houseTimer;
    this.dotCounter = state.dotCounter;
    this.flashState = state.flashState;
    this.frightenedTimer = state.frightenedTimer;
    this.feetAnimation = state.feetAnimation;
    this.bouncedInHouse = state.bouncedInHouse;
    this.clydeWanderState = state.clydeWanderState;
    this.clydeSwitchTimer = state.clydeSwitchTimer;
    this.intermediateTarget = state.intermediateTarget;
    this.reversalPrimed = state.reversalPrimed ?? false;
    this.lastDecisionTile = state.lastDecisionTile;
    this.lastOccupiedTile = state.lastOccupiedTile;
    this.enteringHousePhase = state.enteringHousePhase ?? "NONE";
  }

  /**
   * Calculates current speed of ghost based on location, state, level speed config and "Cruise Elroy".
   */
  getSpeedPercentage(
    maze: MazeData,
    dotsRemaining: number,
    levelOrConfig: number | LevelSpeedConfig
  ): number {
    if (this.mode === "EATEN") {
      return GHOST_EATEN_SPEED_PCT;
    }

    if (this.inHouse) {
      return GHOST_HOUSE_SPEED_PCT;
    }

    const speedConfig =
      typeof levelOrConfig === "number" ? getSpeedConfigForLevel(levelOrConfig) : levelOrConfig;
    const { col, row } = this.tileCoord;
    // Speed reduction in warp tunnels
    const inTunnel = maze.tunnels.some((t) => t.y === row && (col <= 5 || col >= maze.width - 6));
    if (inTunnel) return speedConfig.ghostTunnel;

    if (this.mode === "FRIGHTENED") {
      return speedConfig.ghostFrightened;
    }

    // Cruise Elroy for Blinky
    if (this.type === "BLINKY") {
      if (dotsRemaining <= ELROY_2_DOTS_LEFT) {
        return speedConfig.elroy2;
      }
      if (dotsRemaining <= ELROY_1_DOTS_LEFT) {
        return speedConfig.elroy1;
      }
    }

    return speedConfig.ghostNormal;
  }
}
