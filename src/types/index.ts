export type GameMode = "PACMAN" | "MS_PACMAN";

export type GhostType = "BLINKY" | "PINKY" | "INKY" | "CLYDE";

/** What a ghost is doing, as shown to players and tools. Derived from GhostLocation, frightened and the wave. */
export type GhostBehavior = "CHASE" | "SCATTER" | "FRIGHTENED" | "EATEN";
/** The global scatter/chase wave (owned by TimerController). */
export type WaveMode = "SCATTER" | "CHASE";
/** Blinky's Cruise Elroy stage: 0 normal, 1 and 2 faster (and chasing during scatter). */
export type ElroyStage = 0 | 1 | 2;
/**
 * Where a ghost is in its life cycle:
 * HOUSE (waiting inside) -> LEAVING (moving out through the door) -> ACTIVE (in the maze)
 * -> EYES (eaten, returning to the door) -> ENTERING (descending to its slot) -> HOUSE.
 */
export type GhostLocation = "HOUSE" | "LEAVING" | "ACTIVE" | "EYES" | "ENTERING";
export type GhostsToHousePhase = "NONE" | "APPROACH_SEAM" | "DESCENDING_DOOR" | "MOVING_TO_SLOT";

export interface ScatterChaseSchedule {
  /** Wave length in frames (Infinity = permanent). */
  frames: number;
  mode: WaveMode;
}

export interface LevelSpeedConfig {
  pacmanNormal: number;
  pacmanFright: number;
  ghostNormal: number;
  ghostTunnel: number;
  ghostFrightened: number;
  elroy1: number;
  elroy2: number;
}

export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT" | "NONE";

export interface Point {
  x: number;
  y: number;
}

export interface TileCoord {
  col: number;
  row: number;
}

export type DualTileCoord = readonly [TileCoord, TileCoord];

export type TileType =
  | "EMPTY"
  | "WALL"
  | "DOT"
  | "ENERGIZER"
  | "GATE"
  | "GHOST_HOUSE"
  | "TUNNEL"
  | "NO_UP_ZONE"; // Classic restriction: ghosts cannot turn UP here

export interface MazeData {
  width: number; // usually 28 tiles
  height: number; // usually 31 tiles for active maze
  tiles: TileType[][];
  pacmanSpawn: {
    x: number;
    y: number;
    dir: Direction;
    /** The two tiles Pac-Man starts between (he stands on their seam). */
    candidates: DualTileCoord;
  };
  ghostSpawns: Record<
    GhostType,
    {
      x: number;
      y: number;
      inHouse: boolean;
      initialDir: Direction;
      /** The two tiles the ghost starts between (it stands on their seam). */
      candidates: DualTileCoord;
      respawnSlot: DualTileCoord;
    }
  >;
  fruitSpawn?: {
    candidates?: DualTileCoord;
  };
  scatterTargets: Record<GhostType, TileCoord>;
  tunnels: Array<{ y: number; leftExit: number; rightExit: number }>;
  wallColor: string;
  dotColor: string;
  bgColor: string;
  gateColor: string;
  specialNoUpTiles?: TileCoord[];
  intersections?: TileCoord[];
}

export interface PacmanState {
  x: number; // in pixel / sub-tile coordinates
  y: number;
  dir: Direction;
  nextDir: Direction;
  speed: number;
  mouthAngle: number;
  mouthOpening: boolean;
  isDying: boolean;
  deathProgress: number; // 0 to 1
  invincible: boolean;
  eatingFreezeFrames?: number;
  /** Perpendicular coordinate Pac-Man is easing onto during a pre/post-turn, or null. */
  cornerTarget?: number | null;
}

export interface GhostState {
  type: GhostType;
  x: number;
  y: number;
  anchorX?: number;
  anchorY?: number;
  dir: Direction;
  /** The turn to take at the next tile center the ghost reaches. */
  nextDir: Direction;
  /** Decided on tile entry: the turn for the tile after the current one (see F14). */
  plannedDir: Direction;
  location: GhostLocation;
  frightened: boolean;
  /** This ghost's copy of the global wave, set by the engine at round start and on every switch. */
  wave: WaveMode;
  /** Cruise Elroy stage (Blinky only; always 0 for the others). Set by the engine every frame. */
  elroyStage: ElroyStage;
  /** Derived from location, frightened and wave (read-only; ignored by restore). */
  mode: GhostBehavior;
  /** Derived: location is HOUSE or LEAVING (read-only; ignored by restore). */
  inHouse: boolean;
  speed: number;
  /** Target tile; null while frightened (turns come from the PRNG). */
  target: TileCoord | null;
  flashState: boolean; // white or blue when frightened ending
  feetAnimation: number;
  clydeWanderState?: "CHASE" | "FLEE";
  intermediateTarget?: TileCoord;
  reversalPrimed?: boolean;
  lastDecisionTile?: TileCoord;
  lastOccupiedTile?: TileCoord;
  enteringHousePhase?: GhostsToHousePhase;
}

export interface RomQuirkSettings {
  emulateRomQuirks: boolean; // Master switch: when true, replicates authentic Z80 hardware bugs
  pinkyUpOverflow: boolean; // Pinky UP bug: targets 4 UP + 4 LEFT
  inkyUpOverflow: boolean; // Inky UP bug: pivot is 2 UP + 2 LEFT
}

export interface FruitItem {
  name: string;
  points: number;
  col: number;
  row: number;
  active: boolean;
  duration: number; // frames left
  color: string;
  symbol: string;
  bouncing?: boolean;
  bounceY?: number;
  bounceDir?: number;
}

export interface ScorePopup {
  id: string;
  text: string;
  x: number;
  y: number;
  life: number; // frames
  color: string;
}

export interface GameSettings {
  turbo: boolean;
  turboSpeedMultiplier: number; // e.g. 1.6
  learnMode: boolean; // show ghost targets & target lines
  learnVisualsEnabled: boolean; // persist visual cues on map even when Learn panel is closed
  activeGhostVisuals: Record<GhostType, boolean>; // individual ghost visual cue toggles
  practiceMode: boolean; // enables rewind, pause, slowmo, invincibility
  showGrid: boolean;
  showGhostPaths: boolean;
  showTargetLines: boolean;
  invincible: boolean;
  gameSpeed: number; // 0.1 to 2.0
  /** Run the real-time loop at the arcade's 60.606 Hz instead of 60 (F5). */
  arcadeRefreshRate: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0 to 1
  crtFilter: boolean;
  touchControls: boolean;
  emulateRomQuirks: boolean; // Toggle authentic 1980 ROM hardware targeting bugs
  showDiagnosticConsole: boolean; // In-game testing & diagnostics HUD console
  /** Debug overlay (F1, dev builds): the master switch and its layers (plan T1-T3). */
  debugOverlay: boolean;
  debugLayers: DebugLayers;
}

/** The debug overlay's layers, each toggled on its own (plan T1-T3). */
export interface DebugLayers {
  /** Tile grid lines. */
  grid: boolean;
  /** Each actor's occupied tile and exact sim position. */
  occupiedTiles: boolean;
  /** Ghost target tiles and the line to them. */
  targets: boolean;
  /** Ghost decisions: the turn at the next center (nextDir) and the planned one after (plannedDir). */
  decisions: boolean;
  /** No-up tiles and the tunnel slow zones. */
  zones: boolean;
  /** Intersections derived from the tiles, compared with the maze's hand-made list. */
  intersections: boolean;
  /** Pac-Man's turn window on his lane and whether his buffered turn is open. */
  cornerWindow: boolean;
  /** Per actor: speed %, its source, and pixels moved this frame. */
  readout: boolean;
  /** Scatter/chase timeline (bottom rows) and ghost house counters (top rows). */
  timeline: boolean;
}

export interface HighScoreRecord {
  id: string;
  name: string;
  score: number;
  mode: GameMode;
  level: number;
  date: string;
}

export type PlayState =
  | "MENU"
  | "READY"
  | "PLAYING"
  | "PAUSED"
  | "DYING"
  | "LEVEL_CLEAR"
  | "GAME_OVER";
