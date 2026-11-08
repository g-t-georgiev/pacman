import type { GhostType, PlayState } from "../types";

/**
 * Everything the simulation reports to the outside world. The engine never plays a sound or
 * touches the UI event bus itself: it queues these, and the shell (`GameRunner`) dispatches them
 * after each tick. Headless runs and tests can read them with `engine.drainEvents()`.
 */
export type SimEvent =
  | { type: "SCORE_CHANGED"; score: number; highScore: number }
  | { type: "LIVES_CHANGED"; lives: number }
  | { type: "LEVEL_CHANGED"; level: number }
  | { type: "PLAY_STATE_CHANGED"; playState: PlayState }
  | { type: "GAME_OVER"; score: number }
  | { type: "LEVEL_CLEARED"; level: number }
  | { type: "DOT_EATEN" }
  | { type: "ENERGIZER_EATEN"; level: number }
  | { type: "GHOST_EATEN"; ghost: GhostType; points: number }
  | { type: "FRUIT_EATEN"; points: number }
  | { type: "PACMAN_DIED" };

/** Background siren the sim wants this frame. Derived from state, never queued. */
export type SirenState =
  | { kind: "OFF" }
  | { kind: "EYES" }
  | { kind: "FRIGHTENED" }
  | { kind: "NORMAL"; dotsRatio: number };
