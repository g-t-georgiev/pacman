import type { GameMode, GhostType, MazeData } from "../types";
import { GHOST_COLORS } from "./constants";
import { getMazeData } from "./mazes";

/**
 * What differs between game modes (plan A4), as data instead of `mode ===` branches in the
 * engine and renderer. A new variant, or your own maze design, is a new entry here.
 */
export interface Ruleset {
  mode: GameMode;
  /** Shown in panels. */
  title: string;
  /** Shown in the header. */
  shortTitle: string;
  /** The maze for a level. */
  maze: (level: number) => MazeData;
  /** The bonus fruit bounces in place. */
  fruitBounces: boolean;
  /** How the player is drawn. */
  playerLook: "PACMAN" | "MS_PACMAN";
  /** A ghost's display name. */
  ghostName: (type: GhostType) => string;
}

export const RULESETS: Record<GameMode, Ruleset> = {
  PACMAN: {
    mode: "PACMAN",
    title: "Classic Pac-Man (1980)",
    shortTitle: "Classic 1980",
    maze: (level) => getMazeData("PACMAN", level),
    fruitBounces: false,
    playerLook: "PACMAN",
    ghostName: (type) => GHOST_COLORS[type].name,
  },
  MS_PACMAN: {
    mode: "MS_PACMAN",
    title: "Ms. Pac-Man",
    shortTitle: "Ms. Pac-Man",
    maze: (level) => getMazeData("MS_PACMAN", level),
    fruitBounces: true,
    playerLook: "MS_PACMAN",
    ghostName: (type) => GHOST_COLORS[type].msName ?? GHOST_COLORS[type].name,
  },
};
