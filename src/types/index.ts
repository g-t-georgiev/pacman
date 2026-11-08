export type GameMode = "PACMAN" | "MS_PACMAN";

export type GhostType = "BLINKY" | "PINKY" | "INKY" | "CLYDE";

export type GhostBehavior = "CHASE" | "SCATTER" | "FRIGHTENED" | "EATEN" | "IN_HOUSE";
export type GhostsToHousePhase = "NONE" | "APPROACH_SEAM" | "DESCENDING_DOOR" | "MOVING_TO_SLOT";

export interface ScatterChaseSchedule {
  /** Wave length in frames (Infinity = permanent). */
  frames: number;
  mode: Extract<GhostBehavior, "SCATTER" | "CHASE">;
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
    candidates?: DualTileCoord;
  };
  ghostSpawns: Record<
    GhostType,
    {
      x: number;
      y: number;
      inHouse: boolean;
      initialDir: Direction;
      candidates?: DualTileCoord;
      respawnSlot?: DualTileCoord;
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
  nextDir: Direction;
  mode: GhostBehavior;
  prevMode: GhostBehavior;
  speed: number;
  target: TileCoord;
  inHouse: boolean;
  houseTimer: number;
  dotCounter: number;
  flashState: boolean; // white or blue when frightened ending
  frightenedTimer: number;
  feetAnimation: number;
  bouncedInHouse: boolean;
  clydeWanderState?: "CHASE" | "FLEE";
  clydeSwitchTimer?: number;
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
  soundEnabled: boolean;
  soundVolume: number; // 0 to 1
  crtFilter: boolean;
  touchControls: boolean;
  emulateRomQuirks: boolean; // Toggle authentic 1980 ROM hardware targeting bugs
  showDiagnosticConsole: boolean; // In-game testing & diagnostics HUD console
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
