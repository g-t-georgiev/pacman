import type { Ghost } from "../core/Ghost";
import type { Pacman } from "../core/Pacman";
import type { GhostAiController } from "./GhostAiController";
import type { MazeData } from "../types";
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

/**
 * Controller executing authentic discrete movement physics:
 * - 16-frame cyclical bitmask step evaluation
 * - Pac-Man cornering tolerance & subpixel axis alignment
 * - Ghost tile-to-tile movement, advance lookahead evaluation, and primed reversal execution
 */
export class MovementController {
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

  /**
   * Updates a ghost's physical movement for the current frame.
   */
  public updateGhostMovement(
    ghost: Ghost,
    blinky: Ghost,
    pacman: Pacman,
    currLevelFrame: number,
    speedPct: number,
    turboMultiplier: number,
    maze: MazeData,
    ghostAiController: GhostAiController
  ): void {
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

    // Initialize lookahead if game just started or reset
    if (!ghost.nextDir || ghost.nextDir === "NONE") {
      ghostAiController.evaluateTileEntryLookahead(
        ghost,
        pacman,
        blinky,
        maze,
        ghost.tileCoord.col,
        ghost.tileCoord.row
      );
    }

    const steps = getPixelStepsThisFrame(currLevelFrame, speedPct, turboMultiplier);
    ghost.speed = steps;

    if (steps <= 0) return;

    const halfTile = TILE_SIZE / 2;

    for (let step = 0; step < steps; step++) {
      const { dx, dy } = getDirectionVector(ghost.dir);
      const prevX = ghost.x;
      const prevY = ghost.y;

      ghost.x += dx;
      ghost.y += dy;
      ghost.handleTunnelWrap(maze);

      // Recalculate current tile coordinate relative to physical position
      const ghostCurrCol = ghost.tileCoord.col;
      const ghostCurrRow = ghost.tileCoord.row;

      // ARCADE SYNC: All critical pathing changes occur only when crossing the center pixel
      const centerX = ghost.tileCoord.col * TILE_SIZE + halfTile;
      const centerY = ghost.tileCoord.row * TILE_SIZE + halfTile;

      let crossedCenter = false;
      if (dx > 0 && prevX < centerX && ghost.x >= centerX) crossedCenter = true;
      else if (dx < 0 && prevX > centerX && ghost.x <= centerX) crossedCenter = true;
      else if (dy > 0 && prevY < centerY && ghost.y >= centerY) crossedCenter = true;
      else if (dy < 0 && prevY > centerY && ghost.y <= centerY) crossedCenter = true;

      if (crossedCenter) {
        // Snap alignment perfectly
        ghost.x = centerX;
        ghost.y = centerY;

        // 1. Execute mode switches (Forced 180-degree Reversals)
        if (ghost.reversalPrimed) {
          ghost.reversalPrimed = false;
          ghost.dir = getOppositeDirection(ghost.dir);

          // Re-evaluate lookahead immediately for the new reversed pathway
          ghostAiController.evaluateTileEntryLookahead(
            ghost,
            pacman,
            blinky,
            maze,
            ghostCurrCol,
            ghostCurrRow
          );
          continue;
        }

        // 2. Commit to the lookahead choice calculated during the previous tile center pass
        if (ghost.nextDir !== "NONE" && ghost.nextDir !== ghost.dir) {
          ghost.dir = ghost.nextDir;
        }

        // 3. Fallback Collision Check (Wall Collision Safety Guard)
        const ahead = getDirectionVector(ghost.dir);
        if (
          !isTileWalkableForGhost(
            ghostCurrCol + ahead.dx,
            ghostCurrRow + ahead.dy,
            ghost.toState(),
            maze
          )
        ) {
          ghost.dir = chooseNextGhostDirection(
            ghost.toState(),
            ghost.target,
            maze,
            ghostCurrCol,
            ghostCurrRow,
            ghost.dir
          );
        }

        // 4. Run next lookahead check immediately after completing the movement adjustments
        ghostAiController.evaluateTileEntryLookahead(
          ghost,
          pacman,
          blinky,
          maze,
          ghostCurrCol,
          ghostCurrRow
        );
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
    ghost.nextDir = ghost.dir;
  }

  private exitHouse(ghost: Ghost): void {
    ghost.y = HOUSE_EXIT_Y;
    ghost.location = "ACTIVE";
    // Always leave to the left. Any latched reversal is kept and obeyed at the next tile.
    ghost.dir = "LEFT";
    ghost.nextDir = "LEFT";
    ghost.lastDecisionTile = undefined;
    ghost.lastOccupiedTile = ghost.tileCoord;
  }

  /**
   * Dedicated arcade routing for disembodied ghost eyes descending into the ghost house:
   * 1. APPROACH_SEAM: Aligns on doorstep row 14 and glides horizontally to the seam between cols 13 and 14.
   * 2. DESCENDING_DOOR: Descents vertically DOWN through the door tiles (GATE row 15) down to row 17.
   * 3. MOVING_TO_SLOT: Navigates horizontally to the ghost's designated spawn slot inside the house.
   *    (Blinky routes to Pinky's slot on the seam; Inky to col 11's center; Clyde to col 15's center).
   */
  public handleEatenDescent(ghost: Ghost, steps: number): boolean {
    const seamX = 14 * TILE_SIZE; // Seam between columns 13 and 14
    const doorstepY = 14 * TILE_SIZE + TILE_SIZE / 2; // Centerline of doorstep row 14
    const houseLevelY = 17 * TILE_SIZE + TILE_SIZE / 2; // Centerline of house row 17

    let slotX = seamX; // Pinky & Blinky respawn slot
    if (ghost.type === "INKY") {
      slotX = 11 * TILE_SIZE + TILE_SIZE / 2; // Left slot
    } else if (ghost.type === "CLYDE") {
      slotX = 15 * TILE_SIZE + TILE_SIZE / 2; // Right slot
    }

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
