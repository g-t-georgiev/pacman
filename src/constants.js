/** @typedef {{ x: number; y: number; }} Position */

export const GRID_COLS = 28;
export const GRID_ROWS = 36;

/** @enum {"up" | "down" | "left" | "right"} */
export const PATH_DIRECTIONS = {
  Up: "up",
  Down: "down",
  Left: "left",
  Right: "right",
};

/** @type {PATH_DIRECTIONS} */
export const PATH_DIRECTIONS_LIST = Object.values(PATH_DIRECTIONS);

/** 
 * @typedef {{
 *  name: string,
 *  position: Position;
 *  color: number | string;
 *  startTime?: number;
 * }} ActorData
 */

/** @enum {"Pacman"} */
export const PacmanAlias = "Pacman";

/**
 * @enum {"Blinky" | "Inky" | "Pinky" | "Clyde"}
 */
export const GhostAliases = {
  Red: "Blinky",
  Cyan: "Inky",
  Pink: "Pinky",
  Orange: "Clyde",
};

/** @type {Record<PacmanAlias | GhostAliases, ActorData>} */
export const ACTORS_DATA = {
  [PacmanAlias]: {
    name: PacmanAlias,
    position: {
      x: 14,
      y: 26,
    },
    color: 0xffff00, // "#ffff00"
    startTime: 1000, // 1000
    // startTime: 2147483647, // DEBUG FREEZE
  },
  [GhostAliases.Red]: {
    name: GhostAliases.Red, // "Blinky"
    position: {
      x: 13,
      y: 14,
    },
    color: 0xe90402, // "#e90402"
    startTime: 1200, // 1200
    // startTime: 2147483647, // DEBUG FREEZE
  },
  [GhostAliases.Cyan]: {
    name: GhostAliases.Cyan, // "Inky"
    position: {
      x: 11,
      y: 17,
    },
    color: 0x09b4df, // "#e90402"
    startTime: 2000, // 2000
    // startTime: 2147483647, // DEBUG FREEZE
  },
  [GhostAliases.Pink]: {
    name: GhostAliases.Pink, // "Pinky"
    position: {
      x: 13,
      y: 17,
    },
    color: 0xde91b8, // "#de91b8"
    startTime: 2300, // 2300
    // startTime: 2147483647, // DEBUG FREEZE
  },
  [GhostAliases.Orange]: {
    name: GhostAliases.Orange, // "Clyde"
    position: {
      x: 15,
      y: 17,
    },
    color: 0xe09101, // "#e09101"
    startTime: 5000, // 5000
    // startTime: 2147483647, // DEBUG FREEZE
  }
};