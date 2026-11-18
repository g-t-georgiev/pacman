import type GameEngine from "./GameEngine";
import { RULESETS } from "./rulesets";
import type { FruitItem, GameMode, GhostState, GhostType, PacmanState, TileType } from "../types";
import type { SequenceState } from "./RoundSequencer";
import type { HouseState } from "../controllers/HouseController";

/**
 * The complete, serializable state of a running game: everything `GameEngine.update()` reads
 * or writes. `engine.getState()` / `engine.setState()` round-trip it exactly, so it serves as the
 * rewind snapshot, the basis for state hashing, and (later) the replay keyframe.
 *
 * Static maze data (walls, tunnels, spawns) is not stored: it is rebuilt from `mode` + `level`.
 * Only the tiles that change (dots and energizers) are, as one character per tile.
 */
/** The shape of GameState. Bump it when fields are added, removed or change meaning. */
export const GAME_STATE_VERSION = 6;

export interface GameState {
  version: typeof GAME_STATE_VERSION;
  mode: GameMode;
  /** Round phase and its countdown (READY, PLAYING, eat pause, death and level-clear steps). */
  sequence: SequenceState;
  level: number;
  score: number;
  highScore: number;
  lives: number;
  dotsRemaining: number;
  totalDots: number;
  dotsEatenThisLevel: number;
  eatenGhostsInEnergizer: number;
  lifeFrame: number;
  /** Sim frames since the game started; replays key their inputs on it. */
  tick: number;
  timers: {
    waveIndex: number;
    waveTimer: number;
    frightened: number;
  };
  /** Frightened-ghost PRNG index. */
  prng: number;
  /** General sim random stream (fruit timer). */
  simRandom: number;
  extraLifeAwarded: boolean;
  /** Row-major maze tiles, one character per tile (see TILE_CODES). */
  tiles: string;
  pacman: PacmanState;
  ghosts: Record<GhostType, GhostState>;
  house: HouseState;
  fruit: FruitItem | null;
}

const TILE_CODES: Record<TileType, string> = {
  EMPTY: " ",
  WALL: "#",
  DOT: ".",
  ENERGIZER: "o",
  GATE: "-",
  GHOST_HOUSE: "H",
  TUNNEL: "T",
  NO_UP_ZONE: "^",
};

const TILE_FROM_CODE = Object.fromEntries(
  Object.entries(TILE_CODES).map(([type, code]) => [code, type as TileType])
) as Record<string, TileType>;

export function encodeTiles(tiles: TileType[][]): string {
  let out = "";
  for (const row of tiles) for (const tile of row) out += TILE_CODES[tile];
  return out;
}

/** Writes encoded tiles back into an existing grid of the same size. */
export function decodeTilesInto(encoded: string, tiles: TileType[][]): void {
  let i = 0;
  for (const row of tiles) {
    for (let c = 0; c < row.length; c++) row[c] = TILE_FROM_CODE[encoded[i++]];
  }
}

/**
 * 32-bit FNV-1a hash of a state. Equal states always hash equal, so comparing hashes frame by
 * frame shows exactly where two runs diverge (golden replays, plan T5).
 */
export function hashGameState(state: GameState): number {
  const text = JSON.stringify(state);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// --- Capture and restore (plan M1: these lived in GameEngine) ------------------------------------

/** Copies a ghost state, including its nested tile objects. */
function copyGhostState(g: GhostState): GhostState {
  return {
    ...g,
    target: g.target && { ...g.target },
    lastDecisionTile: g.lastDecisionTile && { ...g.lastDecisionTile },
    lastOccupiedTile: g.lastOccupiedTile && { ...g.lastOccupiedTile },
  };
}

/** The complete sim state of `engine`. Every object in it is a fresh copy. */
export function captureState(engine: GameEngine): GameState {
  const ghosts = {} as Record<GhostType, GhostState>;
  (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
    ghosts[type] = copyGhostState(engine.ghosts[type].toState());
  });
  return {
    version: GAME_STATE_VERSION,
    mode: engine.mode,
    sequence: { ...engine.sequencer.state },
    level: engine.level,
    score: engine.score,
    highScore: engine.highScore,
    lives: engine.lives,
    dotsRemaining: engine.dotsRemaining,
    totalDots: engine.totalDots,
    dotsEatenThisLevel: engine.dotsEatenThisLevel,
    eatenGhostsInEnergizer: engine.eatenGhostsInEnergizer,
    lifeFrame: engine.lifeFrame,
    tick: engine.tick,
    timers: {
      waveIndex: engine.timerController.waveIndex,
      waveTimer: engine.timerController.waveTimer,
      frightened: engine.timerController.frightenedGlobalTimer,
    },
    prng: engine.prng.state,
    simRandom: engine.simRandom.state,
    extraLifeAwarded: engine.extraLifeAwarded,
    tiles: encodeTiles(engine.maze.tiles),
    pacman: engine.pacman.toState(),
    ghosts,
    house: {
      ...engine.houseController.state,
      dotCounters: { ...engine.houseController.state.dotCounters },
    },
    fruit: engine.fruit ? { ...engine.fruit } : null,
  };
}

/** Puts `state` into `engine` exactly (not the recording: see `engine.setState`). */
export function applyState(engine: GameEngine, state: GameState): void {
  if (state.mode !== engine.mode || state.level !== engine.level) {
    engine.maze = RULESETS[state.mode].maze(state.level);
  }
  engine.mode = state.mode;
  engine.sequencer.state = { ...state.sequence };
  engine.level = state.level;
  engine.timerController.level = state.level;
  engine.score = state.score;
  engine.highScore = state.highScore;
  engine.lives = state.lives;
  engine.dotsRemaining = state.dotsRemaining;
  engine.totalDots = state.totalDots;
  engine.dotsEatenThisLevel = state.dotsEatenThisLevel;
  engine.eatenGhostsInEnergizer = state.eatenGhostsInEnergizer;
  engine.lifeFrame = state.lifeFrame;
  engine.tick = state.tick;
  engine.timerController.waveIndex = state.timers.waveIndex;
  engine.timerController.waveTimer = state.timers.waveTimer;
  engine.timerController.frightenedGlobalTimer = state.timers.frightened;
  engine.prng.state = state.prng;
  engine.simRandom.state = state.simRandom;
  engine.extraLifeAwarded = state.extraLifeAwarded;
  decodeTilesInto(state.tiles, engine.maze.tiles);
  engine.pacman.restoreFromState({ ...state.pacman });
  (Object.keys(state.ghosts) as GhostType[]).forEach((type) => {
    engine.ghosts[type].restoreFromState(copyGhostState(state.ghosts[type]));
  });
  engine.houseController.state = { ...state.house, dotCounters: { ...state.house.dotCounters } };
  engine.fruit = state.fruit ? { ...state.fruit } : null;
}
