export type GameMode =
  | "PACMAN"
  | "MS_PACMAN"
  | "CRAZY_OTTO"
  | "COOKIE_MAN";

export type GhostType =
  | "BLINKY"
  | "PINKY"
  | "INKY"
  | "CLYDE";

export type GhostBehavior =
  | "CHASE"
  | "SCATTER"
  | "FRIGHTENED"
  | "EATEN"
  | "IN_HOUSE";

export interface ScatterChaseSchedule {
  duration: number;
  mode: Extract<GhostBehavior, "SCATTER" | "CHASE">;
}

export interface LevelSpeedConfig {
  pacmanNormal: number;
  pacmanEating: number;
  pacmanFright: number;
  pacmanFrightEating: number;
  ghostNormal: number;
  ghostTunnel: number;
  ghostFrightened: number;
  elroy1: number;
  elroy2: number;
}

export type Direction =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT"
  | "NONE";

export interface Point {
  x: number;
  y: number;
}

export interface TileCoord {
  col: number;
  row: number;
}

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
  pacmanSpawn: { x: number; y: number; dir: Direction };
  ghostSpawns: Record<GhostType, { x: number; y: number; inHouse: boolean; initialDir: Direction }>;
  scatterTargets: Record<GhostType, TileCoord>;
  tunnels: Array<{ y: number; leftExit: number; rightExit: number }>;
  wallColor: string;
  dotColor: string;
  bgColor: string;
  gateColor: string;
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
  eatDotCooldown: number;
}

export interface GhostState {
  type: GhostType;
  x: number;
  y: number;
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

export interface SnapshotState {
  pacman: PacmanState;
  ghosts: Record<GhostType, GhostState>;
  score: number;
  level: number;
  lives: number;
  dotsRemaining: number;
  fruit: FruitItem | null;
  eatenGhostsInEnergizer: number;
  globalWaveIndex: number;
  globalWaveTimer: number;
  frightenedGlobalTimer: number;
  playState: PlayState;
  tiles: TileType[][]; // snapshot of eaten dots
}
