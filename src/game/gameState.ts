import type {
  FruitItem,
  GameMode,
  GhostState,
  GhostType,
  PacmanState,
  ScorePopup,
  TileType,
} from "../types";
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
export interface GameState {
  version: 3;
  mode: GameMode;
  /** Round phase and its countdown (READY, PLAYING, eat pause, death and level-clear steps). */
  sequence: SequenceState;
  /** User pause, separate from the round phase. */
  paused: boolean;
  level: number;
  score: number;
  highScore: number;
  lives: number;
  dotsRemaining: number;
  totalDots: number;
  dotsEatenThisRound: number;
  eatenGhostsInEnergizer: number;
  currLevelFrame: number;
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
  scorePopups: ScorePopup[];
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
