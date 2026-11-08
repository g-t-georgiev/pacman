import type { Ghost } from "../core/Ghost";
import type { Pacman } from "../core/Pacman";
import type { GhostAiController } from "./GhostAiController";
import type { MazeData } from "../types";
import { TILE_SIZE } from "../game/constants";
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
    gameSpeed: number,
    maze: MazeData
  ): void {
    if (pacman.isDying) return;

    if (pacman.eatingFreezeFrames && pacman.eatingFreezeFrames > 0) {
      pacman.eatingFreezeFrames--;
      return;
    }

    // Calculate discrete pixel steps for this frame via 16-frame bitmask, scaled by gameSpeed
    const baseSteps = getPixelStepsThisFrame(currLevelFrame, speedPct, turboMultiplier);
    pacman.stepAccumulator = (pacman.stepAccumulator || 0) + baseSteps * gameSpeed;
    const steps = Math.floor(pacman.stepAccumulator);
    pacman.stepAccumulator -= steps;
    pacman.speed = steps;

    if (steps <= 0) return;

    // Try buffered next direction turn (with cornering tolerance)
    pacman.tryTurn(maze);

    // Execute integer pixel steps
    for (let step = 0; step < steps; step++) {
      if (pacman.canMoveInDirection(pacman.dir, maze)) {
        const { dx, dy } = getDirectionVector(pacman.dir);
        pacman.x += dx;
        pacman.y += dy;
        pacman.handleTunnelWrap(maze);
      } else {
        // Wall hit: snap onto center of tile axis
        pacman.snapToAxis(pacman.dir);
        break;
      }
    }

    if (pacman.eatDotCooldown > 0) {
      pacman.eatDotCooldown--;
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
    arg7: MazeData | number,
    arg8: number | MazeData,
    arg9: GhostAiController | number,
    arg10?: GhostAiController
  ): void {
    let gameSpeed = 1.0;
    let maze: MazeData;
    let dotsRemaining: number;
    let ghostAiController: GhostAiController;

    if (typeof arg7 === "number") {
      gameSpeed = arg7;
      maze = arg8 as MazeData;
      dotsRemaining = arg9 as number;
      ghostAiController = arg10 as GhostAiController;
    } else {
      maze = arg7;
      dotsRemaining = arg8 as number;
      ghostAiController = arg9 as GhostAiController;
    }

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

      const baseSteps = getPixelStepsThisFrame(currLevelFrame, speedPct, turboMultiplier);
      ghost.stepAccumulator = (ghost.stepAccumulator || 0) + baseSteps * gameSpeed;
      const steps = Math.floor(ghost.stepAccumulator);
      ghost.stepAccumulator -= steps;
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
        dotsRemaining,
        ghost.tileCoord.col,
        ghost.tileCoord.row
      );
    }

    const baseSteps = getPixelStepsThisFrame(currLevelFrame, speedPct, turboMultiplier);
    ghost.stepAccumulator = (ghost.stepAccumulator || 0) + baseSteps * gameSpeed;
    const steps = Math.floor(ghost.stepAccumulator);
    ghost.stepAccumulator -= steps;
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
            dotsRemaining,
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
          dotsRemaining,
          ghostCurrCol,
          ghostCurrRow
        );
      }
    }
  }

  /**
   * Dedicated arcade routing for disembodied ghost eyes descending into the ghost house:
   * 1. APPROACH_SEAM: Aligns on doorstep row 14 and glides horizontally to the middle seam (x = 224).
   * 2. DESCENDING_DOOR: Descents vertically DOWN through the door tiles (GATE row 15) down to row 17.
   * 3. MOVING_TO_SLOT: Navigates horizontally to the ghost's designated spawn slot inside the house.
   *    (Blinky routes to Pinky's slot at x = 224; Inky to x = 184; Clyde to x = 248).
   */
  public handleEatenDescent(ghost: Ghost, steps: number): boolean {
    const seamX = 224; // Boundary seam between columns 13 and 14 (13.5 * TILE_SIZE = 216 + 8 = 224)
    const doorstepY = 14 * TILE_SIZE + TILE_SIZE / 2; // 232: centerline of doorstep row 14
    const houseLevelY = 17 * TILE_SIZE + TILE_SIZE / 2; // 280: centerline of house row 17

    let slotX = 224; // Pinky & Blinky respawn slot: centered at 13.5 (x = 224)
    if (ghost.type === "INKY") {
      slotX = 184; // Left slot (col 11.5: 11 * 16 + 8 = 184)
    } else if (ghost.type === "CLYDE") {
      slotX = 248; // Right slot (col 15.5: 15 * 16 + 8 = 248)
    }

    for (let step = 0; step < steps; step++) {
      if (!ghost.enteringHousePhase || ghost.enteringHousePhase === "NONE") {
        ghost.enteringHousePhase = "APPROACH_SEAM";
      }

      if (ghost.enteringHousePhase === "APPROACH_SEAM") {
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
    ghost.inHouse = true;
    ghost.mode = "CHASE";
    ghost.prevMode = "CHASE";
    ghost.enteringHousePhase = "NONE";
    ghost.houseTimer = 60;
    ghost.dir = "UP";
    ghost.nextDir = "UP";
    ghost.flashState = false;
    ghost.reversalPrimed = false;
    ghost.lastOccupiedTile = { col: Math.floor(ghost.x / TILE_SIZE), row: 17 };
  }
}
