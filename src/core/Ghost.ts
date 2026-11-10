import { Actor } from "./Actor";
import type {
  Direction,
  GhostBehavior,
  GhostLocation,
  GhostState,
  GhostsToHousePhase,
  GhostType,
  LevelSpeedConfig,
  MazeData,
  TileCoord,
  WaveMode,
  ElroyStage,
} from "../types";
import { GHOST_EATEN_SPEED_PCT, GHOST_HOUSE_SPEED_PCT, TILE_SIZE } from "../game/constants";
import { getSpeedConfigForLevel } from "../utils";
import { isTunnelSlowZone } from "../game/mazeAnalysis";

/**
 * A ghost. Its state is split into independent parts (plan A1):
 *
 * - `location`: the life-cycle state machine (HOUSE -> LEAVING -> ACTIVE -> EYES -> ENTERING -> HOUSE).
 * - `frightened`: set for every non-eyes ghost when an energizer is eaten, cleared when the
 *   frightened timer ends or the ghost is eaten. Ghosts inside the house turn blue too.
 * - `wave`: the global scatter/chase wave, which is also the mode to return to after frightened.
 * - `reversalPrimed`: a latch set on every mode change. Active ghosts reverse on entering their next
 *   tile; a ghost that was inside during a mode change keeps it and turns around once outside.
 *
 * `mode` and `inHouse` are derived from these and are read-only.
 */
export class Ghost extends Actor {
  public type: GhostType;

  public location: GhostLocation = "ACTIVE";
  public frightened: boolean = false;
  public wave: WaveMode = "SCATTER";
  /** Cruise Elroy stage (Blinky only), set by the engine every frame. */
  public elroyStage: ElroyStage = 0;

  /** Target tile; null while frightened (turns come from the PRNG). */
  public target: TileCoord | null = { col: 0, row: 0 };
  /**
   * Decision timing (F14; Dossier "Looking Ahead"). On entering a tile the ghost decides the turn
   * for the tile after it (`plannedDir`); at a tile center it turns to `nextDir`, which then
   * takes `plannedDir`. "NONE" means "plan from where you are" (after spawning or leaving home).
   */
  public plannedDir: Direction = "NONE";
  public intermediateTarget?: TileCoord;

  // Frightened visuals
  public flashState: boolean = false;
  public feetAnimation: number = 0;

  /** Clyde's last targeting choice (set by calculateTarget), shown by the Learn overlay. */
  public clydeWanderState?: "CHASE" | "FLEE" = "CHASE";

  // Tile-to-tile lookahead and reversal latch
  public reversalPrimed: boolean = false;
  public lastDecisionTile?: TileCoord;
  public lastOccupiedTile?: TileCoord;

  /** Sub-phase while the eyes enter the house (EYES at the door, then ENTERING). */
  public enteringHousePhase: GhostsToHousePhase = "NONE";

  constructor(
    type: GhostType,
    x: number,
    y: number,
    dir: Direction = "UP",
    inHouse: boolean = false
  ) {
    super(x, y, dir);
    this.type = type;
    this.location = inHouse ? "HOUSE" : "ACTIVE";
    this.lastOccupiedTile = {
      col: Math.floor(x / TILE_SIZE),
      row: Math.floor(y / TILE_SIZE),
    };
  }

  /** What the ghost is doing, derived from location, frightened and the wave. */
  public get mode(): GhostBehavior {
    if (this.isEyes) return "EATEN";
    if (this.frightened) return "FRIGHTENED";
    return this.wave;
  }

  /** Inside the house: waiting or on the way out. */
  public get inHouse(): boolean {
    return this.location === "HOUSE" || this.location === "LEAVING";
  }

  /** Eaten and on the way home (or into its slot). */
  public get isEyes(): boolean {
    return this.location === "EYES" || this.location === "ENTERING";
  }

  /**
   * Latches a 180-degree reversal (any scatter/chase switch, or entering frightened mode).
   * Active ghosts obey it on entering their next tile; ghosts in the house keep it, leave to the
   * left and turn around at the first tile outside.
   */
  public primeReversal(): void {
    if (this.isEyes) return;
    this.reversalPrimed = true;
  }

  /**
   * Advances wavy scallop bottom skirt animation.
   */
  public updateFeetAnimation(): void {
    this.feetAnimation = (this.feetAnimation + 0.15) % 1;
  }

  /**
   * Converts actor to plain serializable state representation.
   */
  public toState(): GhostState {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      dir: this.dir,
      nextDir: this.nextDir,
      plannedDir: this.plannedDir,
      location: this.location,
      frightened: this.frightened,
      wave: this.wave,
      elroyStage: this.elroyStage,
      mode: this.mode,
      inHouse: this.inHouse,
      speed: this.speed,
      target: this.target,
      flashState: this.flashState,
      feetAnimation: this.feetAnimation,
      clydeWanderState: this.clydeWanderState,
      intermediateTarget: this.intermediateTarget,
      reversalPrimed: this.reversalPrimed,
      lastDecisionTile: this.lastDecisionTile,
      lastOccupiedTile: this.lastOccupiedTile,
      enteringHousePhase: this.enteringHousePhase,
    };
  }

  /**
   * Restores actor state from a snapshot. `mode` and `inHouse` are derived and ignored.
   */
  public restoreFromState(state: GhostState): void {
    this.x = state.x;
    this.y = state.y;
    this.dir = state.dir;
    this.nextDir = state.nextDir;
    this.plannedDir = state.plannedDir;
    this.location = state.location;
    this.frightened = state.frightened;
    this.wave = state.wave;
    this.elroyStage = state.elroyStage;
    this.speed = state.speed;
    this.target = state.target;
    this.flashState = state.flashState;
    this.feetAnimation = state.feetAnimation;
    this.clydeWanderState = state.clydeWanderState;
    this.intermediateTarget = state.intermediateTarget;
    this.reversalPrimed = state.reversalPrimed ?? false;
    this.lastDecisionTile = state.lastDecisionTile;
    this.lastOccupiedTile = state.lastOccupiedTile;
    this.enteringHousePhase = state.enteringHousePhase ?? "NONE";
  }

  /**
   * Calculates current speed of ghost based on location, state, level speed config and "Cruise Elroy".
   */
  getSpeedPercentage(maze: MazeData, levelOrConfig: number | LevelSpeedConfig): number {
    if (this.isEyes) {
      return GHOST_EATEN_SPEED_PCT;
    }

    if (this.inHouse) {
      return GHOST_HOUSE_SPEED_PCT;
    }

    const speedConfig =
      typeof levelOrConfig === "number" ? getSpeedConfigForLevel(levelOrConfig) : levelOrConfig;
    const { col, row } = this.tileCoord;
    // Speed reduction in warp tunnels
    const inTunnel = isTunnelSlowZone(maze, col, row);
    if (inTunnel) return speedConfig.ghostTunnel;

    if (this.frightened) {
      return speedConfig.ghostFrightened;
    }

    // Cruise Elroy (Blinky only)
    if (this.elroyStage === 2) return speedConfig.elroy2;
    if (this.elroyStage === 1) return speedConfig.elroy1;

    return speedConfig.ghostNormal;
  }
}
