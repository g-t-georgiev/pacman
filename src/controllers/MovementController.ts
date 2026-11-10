import type { Ghost } from "../core/Ghost";
import type { Pacman } from "../core/Pacman";
import type { GhostAiController } from "./GhostAiController";
import type { Direction, MazeData } from "../types";
import { TILE_SIZE } from "../game/constants";

/** The house door: the seam between columns 13 and 14. */
export const HOUSE_DOOR_X = 14 * TILE_SIZE;
/** Centerline of the house interior (row 17). */
export const HOUSE_CENTER_Y = 17 * TILE_SIZE + TILE_SIZE / 2;
/** Centerline of the row just outside the door (row 14), where ghosts appear when leaving. */
export const HOUSE_EXIT_Y = 14 * TILE_SIZE + TILE_SIZE / 2;
/** How far waiting ghosts bob above and below the house centerline. */
const HOUSE_BOB = TILE_SIZE / 2;
import {
  chooseNextGhostDirection,
  getDirectionVector,
  getOppositeDirection,
  isTileWalkableForGhost,
} from "../game/ghostAiUtils";
import { getPixelStepsThisFrame } from "../utils";
import { houseSlotX } from "../game/mazes";

/** Everything a ghost's move needs besides the ghost itself. */
export interface GhostMoveContext {
  /** Blinky (Inky's targeting uses his position). */
  blinky: Ghost;
  pacman: Pacman;
  /** Indexes the 16-frame speed masks. */
  currLevelFrame: number;
  speedPct: number;
  turboMultiplier: number;
  maze: MazeData;
  ghostAi: GhostAiController;
}

/**
 * Controller executing authentic discrete movement physics:
 * - 16-frame cyclical bitmask step evaluation
 * - Pac-Man cornering tolerance & subpixel axis alignment
 * - Ghost movement: look-ahead decisions and pending reversals on tile entry, turns at tile centers
 */
export class MovementController {
  /** Times a ghost's planned turn pointed into a wall and the safety net picked another way. */
  public fallbackTurns: number = 0;

  /**
   * Updates Pac-Man's physical movement for the current frame.
   */
  public updatePacmanMovement(
    pacman: Pacman,
    currLevelFrame: number,
    speedPct: number,
    turboMultiplier: number,
    maze: MazeData
  ): void {
    if (pacman.isDying) return;

    if (pacman.eatingFreezeFrames && pacman.eatingFreezeFrames > 0) {
      pacman.eatingFreezeFrames--;
      return;
    }

    const steps = getPixelStepsThisFrame(currLevelFrame, speedPct, turboMultiplier);
    pacman.speed = steps;

    if (steps <= 0) return;

    // One pixel at a time: a buffered turn is checked before every pixel, so the earliest
    // pre-turn pixel is never skipped on a 2-pixel frame.
    for (let step = 0; step < steps; step++) {
      pacman.tryTurn(maze);
      if (!pacman.stepOnePixel(maze)) break;
    }
  }

  /** Moves a ghost outside the house for one frame. */
  public updateGhostMovement(ghost: Ghost, ctx: GhostMoveContext): void {
    const { blinky, pacman, currLevelFrame, speedPct, turboMultiplier, maze, ghostAi } = ctx;
    if (ghost.inHouse || ghost.dir === "NONE") return;

    // Eaten house descent logic
    const isDescendingHouse = ghost.enteringHousePhase && ghost.enteringHousePhase !== "NONE";
    const atDoorstep =
      ghost.mode === "EATEN" &&
      ghost.tileCoord.row === 14 &&
      (ghost.tileCoord.col === 13 || ghost.tileCoord.col === 14);

    if (isDescendingHouse || atDoorstep) {
      if (!ghost.enteringHousePhase || ghost.enteringHousePhase === "NONE") {
        ghost.enteringHousePhase = "APPROACH_SEAM";
      }

      const steps = getPixelStepsThisFrame(currLevelFrame, speedPct, turboMultiplier);
      ghost.speed = steps;

      if (steps > 0) {
        this.handleEatenDescent(ghost, steps);
      }
      return;
    }

    const steps = getPixelStepsThisFrame(currLevelFrame, speedPct, turboMultiplier);
    ghost.speed = steps;
    if (steps <= 0) return;

    const plan = (col: number, row: number, heading: Direction) =>
      ghostAi.planNextTile(ghost, pacman, blinky, maze, col, row, heading);

    // Just spawned, placed, or out of the house: we are past this tile's center, so plan the turn
    // for the next tile from here.
    if (ghost.nextDir === "NONE") {
      const { col, row } = ghost.tileCoord;
      ghost.nextDir = plan(col, row, ghost.dir);
      ghost.plannedDir = "NONE";
      ghost.lastOccupiedTile = { col, row };
    }

    for (let step = 0; step < steps; step++) {
      const { dx, dy } = getDirectionVector(ghost.dir);
      ghost.x += dx;
      ghost.y += dy;
      ghost.handleTunnelWrap(maze);

      const tile = ghost.tileCoord;
      const last = ghost.lastOccupiedTile;

      if (!last || last.col !== tile.col || last.row !== tile.row) {
        // Entered a new tile (Dossier: reversals and look-ahead both happen here)
        ghost.lastOccupiedTile = { col: tile.col, row: tile.row };

        if (ghost.reversalPrimed) {
          // Turn around now, and decide the turn for the tile it is heading back into (this is
          // its look-ahead for this tile entry). It never reaches this tile's center.
          ghost.reversalPrimed = false;
          ghost.dir = getOppositeDirection(ghost.dir);
          ghost.nextDir = plan(tile.col, tile.row, ghost.dir);
          ghost.plannedDir = "NONE";
          continue;
        }

        // Decide the turn for the tile after this one, leaving this tile by its planned exit.
        ghost.plannedDir = plan(tile.col, tile.row, ghost.nextDir);
        continue;
      }

      // Reached this tile's center: take the turn decided earlier.
      const centerX = tile.col * TILE_SIZE + TILE_SIZE / 2;
      const centerY = tile.row * TILE_SIZE + TILE_SIZE / 2;
      if (ghost.x !== centerX || ghost.y !== centerY) continue;

      ghost.dir = ghost.nextDir;
      ghost.nextDir =
        ghost.plannedDir !== "NONE" ? ghost.plannedDir : plan(tile.col, tile.row, ghost.dir);
      ghost.plannedDir = "NONE";

      // Safety net: never walk into a wall. Should never trigger; counted so tests can tell.
      const ahead = getDirectionVector(ghost.dir);
      if (
        !isTileWalkableForGhost(tile.col + ahead.dx, tile.row + ahead.dy, ghost.toState(), maze)
      ) {
        this.fallbackTurns++;
        ghost.dir = chooseNextGhostDirection(
          ghost.toState(),
          ghost.target ?? { col: tile.col, row: tile.row },
          maze,
          tile.col,
          tile.row,
          ghost.dir
        );
        ghost.nextDir = plan(tile.col, tile.row, ghost.dir);
      }
    }
  }

  /**
   * Moves a ghost that is inside the house: bobbing up and down while waiting (HOUSE), or
   * heading out once released (LEAVING): to the center row, across to the door, then up.
   * Outside, it always starts moving left. A reversal latched while it was inside (a mode change)
   * stays pending, so it reverses at its next tile and heads right (Birch; Dossier "Home Sweet Home").
   */
  public updateHouseGhost(
    ghost: Ghost,
    currLevelFrame: number,
    speedPct: number,
    turboMultiplier: number
  ): void {
    const steps = getPixelStepsThisFrame(currLevelFrame, speedPct, turboMultiplier);
    ghost.speed = steps;

    for (let step = 0; step < steps && ghost.inHouse; step++) {
      if (ghost.location === "HOUSE") {
        if (ghost.dir !== "UP" && ghost.dir !== "DOWN") ghost.dir = "UP";
        if (ghost.y <= HOUSE_CENTER_Y - HOUSE_BOB) ghost.dir = "DOWN";
        else if (ghost.y >= HOUSE_CENTER_Y + HOUSE_BOB) ghost.dir = "UP";
        ghost.y += ghost.dir === "UP" ? -1 : 1;
        continue;
      }

      // LEAVING
      if (ghost.y !== HOUSE_CENTER_Y && ghost.x !== HOUSE_DOOR_X) {
        ghost.dir = ghost.y < HOUSE_CENTER_Y ? "DOWN" : "UP";
        ghost.y += Math.sign(HOUSE_CENTER_Y - ghost.y);
      } else if (ghost.x !== HOUSE_DOOR_X) {
        ghost.dir = ghost.x < HOUSE_DOOR_X ? "RIGHT" : "LEFT";
        ghost.x += Math.sign(HOUSE_DOOR_X - ghost.x);
      } else {
        ghost.dir = "UP";
        ghost.y--;
        if (ghost.y <= HOUSE_EXIT_Y) this.exitHouse(ghost);
      }
    }
    if (ghost.inHouse) ghost.nextDir = ghost.dir;
  }

  private exitHouse(ghost: Ghost): void {
    ghost.y = HOUSE_EXIT_Y;
    ghost.location = "ACTIVE";
    // Always leave to the left. Any latched reversal is kept and obeyed at the next tile.
    ghost.dir = "LEFT";
    ghost.nextDir = "NONE"; // plan from the first tile outside (see updateGhostMovement)
    ghost.plannedDir = "NONE";
    ghost.lastDecisionTile = undefined;
    ghost.lastOccupiedTile = ghost.tileCoord;
  }

  /**
   * Dedicated arcade routing for disembodied ghost eyes descending into the ghost house:
   * 1. APPROACH_SEAM: Aligns on doorstep row 14 and glides horizontally to the seam between cols 13 and 14.
   * 2. DESCENDING_DOOR: Descents vertically DOWN through the door tiles (GATE row 15) down to row 17.
   * 3. MOVING_TO_SLOT: Navigates horizontally to the ghost's seat inside the house, the same seam
   *    point it starts on (Blinky takes Pinky's on the 13/14 seam; Inky 11/12; Clyde 15/16).
   */
  public handleEatenDescent(ghost: Ghost, steps: number): boolean {
    const seamX = 14 * TILE_SIZE; // Seam between columns 13 and 14
    const doorstepY = 14 * TILE_SIZE + TILE_SIZE / 2; // Centerline of doorstep row 14
    const houseLevelY = 17 * TILE_SIZE + TILE_SIZE / 2; // Centerline of house row 17

    // The ghost's seat in the house: the same seam point it starts on (Blinky takes Pinky's)
    const slotX = houseSlotX(ghost.type);

    for (let step = 0; step < steps; step++) {
      if (!ghost.enteringHousePhase || ghost.enteringHousePhase === "NONE") {
        ghost.enteringHousePhase = "APPROACH_SEAM";
      }

      if (ghost.enteringHousePhase === "APPROACH_SEAM") {
        ghost.location = "ENTERING";
        // Align Y with doorstep corridor axis
        if (ghost.y < doorstepY) ghost.y += 1;
        else if (ghost.y > doorstepY) ghost.y -= 1;

        // Move horizontally toward door seam
        if (ghost.x < seamX) {
          ghost.x += 1;
          ghost.dir = "RIGHT";
          ghost.nextDir = "RIGHT";
        } else if (ghost.x > seamX) {
          ghost.x -= 1;
          ghost.dir = "LEFT";
          ghost.nextDir = "LEFT";
        }

        if (ghost.x === seamX && ghost.y === doorstepY) {
          ghost.enteringHousePhase = "DESCENDING_DOOR";
          ghost.dir = "DOWN";
          ghost.nextDir = "DOWN";
        }
      } else if (ghost.enteringHousePhase === "DESCENDING_DOOR") {
        ghost.x = seamX;
        ghost.y += 1;
        ghost.dir = "DOWN";
        ghost.nextDir = "DOWN";

        if (ghost.y >= houseLevelY) {
          ghost.y = houseLevelY;
          if (slotX === seamX) {
            this.reviveGhostInHouse(ghost);
            return true;
          } else {
            ghost.enteringHousePhase = "MOVING_TO_SLOT";
            ghost.dir = slotX < ghost.x ? "LEFT" : "RIGHT";
            ghost.nextDir = ghost.dir;
          }
        }
      } else if (ghost.enteringHousePhase === "MOVING_TO_SLOT") {
        ghost.y = houseLevelY;
        if (ghost.x < slotX) {
          ghost.x += 1;
          ghost.dir = "RIGHT";
          ghost.nextDir = "RIGHT";
        } else if (ghost.x > slotX) {
          ghost.x -= 1;
          ghost.dir = "LEFT";
          ghost.nextDir = "LEFT";
        }

        if (ghost.x === slotX) {
          this.reviveGhostInHouse(ghost);
          return true;
        }
      }
    }
    return ghost.inHouse;
  }

  private reviveGhostInHouse(ghost: Ghost): void {
    ghost.location = "HOUSE";
    ghost.frightened = false;
    ghost.enteringHousePhase = "NONE";
    ghost.dir = "UP";
    ghost.nextDir = "UP";
    ghost.flashState = false;
    ghost.reversalPrimed = false;
    ghost.lastOccupiedTile = { col: Math.floor(ghost.x / TILE_SIZE), row: 17 };
  }
}
