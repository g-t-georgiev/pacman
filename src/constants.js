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
    startTime: 2147483647, // 1000
  },
  [GhostAliases.Red]: {
    name: GhostAliases.Red, // "Blinky"
    position: {
      x: 13,
      y: 14,
    },
    color: 0xe90402, // "#e90402"
    startTime: 2147483647, // 1200
  },
  [GhostAliases.Cyan]: {
    name: GhostAliases.Cyan, // "Inky"
    position: {
      x: 11,
      y: 17,
    },
    color: 0x09b4df, // "#e90402"
    startTime: 2147483647, // 2000
  },
  [GhostAliases.Pink]: {
    name: GhostAliases.Pink, // "Pinky"
    position: {
      x: 13,
      y: 17,
    },
    color: 0xde91b8, // "#de91b8"
    startTime: 2147483647, // 2300
  },
  [GhostAliases.Orange]: {
    name: GhostAliases.Orange, // "Clyde"
    position: {
      x: 15,
      y: 17,
    },
    color: 0xe09101, // "#e09101"
    startTime: 2147483647, // 5000
  }
};