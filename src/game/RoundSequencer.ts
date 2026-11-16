import type { GhostType, PlayState } from "../types";
import { SIM_FPS } from "./constants";

/**
 * The timed phases of a round (plan A2). The engine runs the simulation only in `PLAYING`;
 * every other phase is a countdown that the engine reacts to when it ends.
 *
 *   READY → PLAYING ⇄ GHOST_EATEN_PAUSE
 *   PLAYING → DEATH_FREEZE → DEATH_ANIM → DEATH_WAIT → READY (or GAME_OVER)
 *   PLAYING → LEVEL_CLEAR_FREEZE → MAZE_FLASH → READY (next level)
 */
export type RoundPhase =
  | "MENU"
  | "READY"
  | "PLAYING"
  | "GHOST_EATEN_PAUSE"
  | "DEATH_FREEZE"
  | "DEATH_ANIM"
  | "DEATH_WAIT"
  | "LEVEL_CLEAR_FREEZE"
  | "MAZE_FLASH"
  | "GAME_OVER";

/** Length of a phase that has no timer (JSON-safe, unlike Infinity). */
export const UNTIMED = -1;

/** The maze toggles between white and its color this often while flashing. Estimate. */
export const MAZE_FLASH_TOGGLE_FRAMES = 12;

/**
 * Phase lengths in frames. Untimed phases (UNTIMED) only end through an explicit transition.
 * Sources: the Dossier gives "about one second" for the ghost-eaten pause; the death freeze is
 * the same length. The other lengths are estimates until checked against footage.
 */
export const PHASE_FRAMES: Record<RoundPhase, number> = {
  MENU: UNTIMED,
  /** Respawn and next level. The first READY of a game uses READY_FRAMES_GAME_START. */
  READY: 2 * SIM_FPS, // estimate
  PLAYING: UNTIMED,
  GHOST_EATEN_PAUSE: SIM_FPS,
  DEATH_FREEZE: SIM_FPS,
  DEATH_ANIM: 1.5 * SIM_FPS, // estimate
  DEATH_WAIT: SIM_FPS, // estimate
  LEVEL_CLEAR_FREEZE: SIM_FPS, // estimate
  MAZE_FLASH: 8 * MAZE_FLASH_TOGGLE_FRAMES, // estimate: four white flashes
  GAME_OVER: UNTIMED,
};

/** The first READY of a game is longer (the intro tune plays). Estimate. */
export const READY_FRAMES_GAME_START = 4 * SIM_FPS;

/** The coarse state the UI sees for each phase. */
export const PHASE_PLAY_STATE: Record<RoundPhase, PlayState> = {
  MENU: "MENU",
  READY: "READY",
  PLAYING: "PLAYING",
  GHOST_EATEN_PAUSE: "PLAYING",
  DEATH_FREEZE: "DYING",
  DEATH_ANIM: "DYING",
  DEATH_WAIT: "DYING",
  LEVEL_CLEAR_FREEZE: "LEVEL_CLEAR",
  MAZE_FLASH: "LEVEL_CLEAR",
  GAME_OVER: "GAME_OVER",
};

/** The phase that starts each coarse state, for code that sets `playState` directly. */
export const PLAY_STATE_ENTRY_PHASE: Record<Exclude<PlayState, "PAUSED">, RoundPhase> = {
  MENU: "MENU",
  READY: "READY",
  PLAYING: "PLAYING",
  DYING: "DEATH_FREEZE",
  LEVEL_CLEAR: "LEVEL_CLEAR_FREEZE",
  GAME_OVER: "GAME_OVER",
};

export interface SequenceState {
  phase: RoundPhase;
  /** Frames left in this phase. */
  framesLeft: number;
  /** Length this phase started with (for progress, e.g. the death animation). */
  framesTotal: number;
  /** During GHOST_EATEN_PAUSE: the ghost whose score is shown, and the points. */
  eatenGhost: GhostType | null;
  eatenPoints: number;
}

export class RoundSequencer {
  public state: SequenceState = {
    phase: "MENU",
    framesLeft: UNTIMED,
    framesTotal: UNTIMED,
    eatenGhost: null,
    eatenPoints: 0,
  };

  public get phase(): RoundPhase {
    return this.state.phase;
  }

  /** 0 at the start of the phase, 1 at its end. */
  public get progress(): number {
    const { framesLeft, framesTotal } = this.state;
    return framesTotal === UNTIMED ? 0 : 1 - framesLeft / framesTotal;
  }

  public enter(phase: RoundPhase, frames: number = PHASE_FRAMES[phase]): void {
    this.state = {
      phase,
      framesLeft: frames,
      framesTotal: frames,
      eatenGhost: null,
      eatenPoints: 0,
    };
  }

  /** Counts one frame down. Returns the phase that just ran out, or null. */
  public tick(): RoundPhase | null {
    if (this.state.framesLeft === UNTIMED) return null;
    this.state.framesLeft--;
    return this.state.framesLeft <= 0 ? this.state.phase : null;
  }
}
