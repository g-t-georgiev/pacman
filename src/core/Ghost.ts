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
import { getSpeedConfigForLevel } from "../game/levelTable";
import { isTunnelSlowZone } from "../game/mazeAnalysis";

/**
 * A ghost (plan N3: its whole state machine in one place). The state is split into independent
 * parts; everything else is derived from them.
 *
 * Where it is, `location` (the life cycle):
 *
 *     HOUSE --release--> LEAVING --past the door--> ACTIVE --eaten--> EYES --at the door--> ENTERING
 *       ^                                                                                       |
 *       +---------------------------------------- in its slot ----------------------------------+
 *
 *   Blinky starts ACTIVE; the others start in the HOUSE and are released by HouseController.
 *   ENTERING goes through `enteringHousePhase`: APPROACH_SEAM (to the door's column),
 *   DESCENDING_DOOR, MOVING_TO_SLOT, then back to NONE in the HOUSE.
 *
 * What it does:
 *
 * - `wave`: the global scatter/chase wave, also the mode to return to after frightened.
 * - `frightened`: set on every non-eyes ghost by an energizer (in the house too: F8), cleared
 *   when the frightened time ends or the ghost is eaten.
 * - `mode` (derived, read-only): EATEN while eyes, else FRIGHTENED, else the wave.
 * - `elroyStage` (Blinky only): Cruise Elroy 0/1/2, set by the engine every frame.
 *
 * How it moves (Dossier "Looking Ahead"; F14):
 *
 * - `target`: the tile it heads for (null while frightened: turns come from the PRNG).
 * - `plannedDir` / `nextDir`: on entering a tile it decides the turn for the next tile
 *   (`plannedDir`); at a tile center it turns to `nextDir`, which then takes `plannedDir`.
 * - `lastDecisionTile`: the tile that decision was made for (debug overlay, no double decisions).
 * - `lastOccupiedTile`: the tile it was last in, to notice entering a new one.
 * - `reversalPrimed`: a latch set on every mode change. Active ghosts reverse on entering their
 *   next tile; a ghost inside during a change keeps it and turns around once outside (F7).
 *
 * `inHouse` and `isEyes` are derived from `location`.
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

  /** A reversal to obey on entering the next tile (set by every mode change). */
  public reversalPrimed: boolean = false;
  /** The tile the last turn decision was made for. */
  public lastDecisionTile?: TileCoord;
  /** The tile the ghost was last in (entering a new one triggers the next decision). */
  public lastOccupiedTile?: TileCoord;

  /** Sub-phase while the eyes enter the house: APPROACH_SEAM, DESCENDING_DOOR, MOVING_TO_SLOT. */
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
