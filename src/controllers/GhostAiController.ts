import type { Ghost } from "../core/Ghost";
import type { Pacman } from "../core/Pacman";
import type { MazeData, TileCoord } from "../types";
import { TILE_SIZE } from "../game/constants";
import {
  chooseNextGhostDirection,
  getDirectionVector,
  isTileWalkableForGhost,
  pickFrightenedDirection,
} from "../game/ghostAiUtils";
import { PRNG } from "../core/PRNG";

/**
 * Controller encapsulating all Ghost AI personality routines, Cruise Elroy states,
 * house emergence, and 1-tile advance intersection lookahead.
 */
export class GhostAiController {
  public emulateRomQuirks: boolean = false;
  /** The sim's PRNG, shared with (and reset by) the engine. Advanced only by frightened decisions. */
  public prng: PRNG;

  constructor(emulateRomQuirks: boolean = false, prng: PRNG = new PRNG()) {
    this.emulateRomQuirks = emulateRomQuirks;
    this.prng = prng;
  }

  /**
   * Calculates the authentic target tile for a ghost, with optional 1980 ROM quirk emulation.
   */
  public calculateTarget(ghost: Ghost, pacman: Pacman, blinky: Ghost, maze: MazeData): TileCoord {
    const pacCol = Math.floor(pacman.x / TILE_SIZE);
    const pacRow = Math.floor(pacman.y / TILE_SIZE);
    const ghostCol = Math.floor(ghost.x / TILE_SIZE);
    const ghostRow = Math.floor(ghost.y / TILE_SIZE);

    // 1. EATEN Mode: Route to house doorstep (col 13, row 14), then inside pen to designated respawn slot
    if (ghost.mode === "EATEN") {
      if ((ghostCol === 13 || ghostCol === 14) && ghostRow >= 14 && ghostRow <= 17) {
        if (ghost.type === "INKY") return { col: 11, row: 17 };
        if (ghost.type === "CLYDE") return { col: 15, row: 17 };
        return { col: 13, row: 17 };
      }
      return { col: 13, row: 14 };
    }

    // 2. SCATTER Mode: Home corner (unless Blinky is in Cruise Elroy)
    if (ghost.mode === "SCATTER") {
      // Cruise Elroy Blinky keeps targeting Pac-Man during scatter (he still reverses)
      if (ghost.elroyStage === 0) return maze.scatterTargets[ghost.type];
    }

    // 3. FRIGHTENED Mode: Pseudo-random wander target
    if (ghost.mode === "FRIGHTENED") {
      return {
        col: Math.floor(Math.sin(ghost.x * 0.1) * 10) + 14,
        row: Math.floor(Math.cos(ghost.y * 0.1) * 10) + 17,
      };
    }

    // 4. CHASE Mode: Individual Ghost Personalities
    switch (ghost.type) {
      case "BLINKY": {
        // Shadow: Direct pursuer. Targets Pac-Man's exact tile
        return { col: pacCol, row: pacRow };
      }

      case "PINKY": {
        // Speedy: Ambush pursuer. Targets 4 tiles ahead of Pac-Man.
        let targetCol = pacCol;
        let targetRow = pacRow;
        switch (pacman.dir) {
          case "UP":
            targetRow -= 4;
            // 1980 Z80 register overflow bug: facing UP also shifted 4 tiles LEFT
            if (this.emulateRomQuirks) {
              targetCol -= 4;
            }
            break;
          case "DOWN":
            targetRow += 4;
            break;
          case "LEFT":
            targetCol -= 4;
            break;
          case "RIGHT":
            targetCol += 4;
            break;
        }
        return { col: targetCol, row: targetRow };
      }

      case "INKY": {
        // Bashful: Pincer flanker using Pac-Man & Blinky's coordinates.
        let pivotCol = pacCol;
        let pivotRow = pacRow;
        switch (pacman.dir) {
          case "UP":
            pivotRow -= 2;
            // 1980 Z80 register overflow bug: facing UP also shifted 2 tiles LEFT
            if (this.emulateRomQuirks) {
              pivotCol -= 2;
            }
            break;
          case "DOWN":
            pivotRow += 2;
            break;
          case "LEFT":
            pivotCol -= 2;
            break;
          case "RIGHT":
            pivotCol += 2;
            break;
        }

        ghost.intermediateTarget = { col: pivotCol, row: pivotRow };

        const blinkyCol = Math.floor(blinky.x / TILE_SIZE);
        const blinkyRow = Math.floor(blinky.y / TILE_SIZE);

        // Vector doubling: Target = Pivot + (Pivot - Blinky) = 2 * Pivot - Blinky
        const targetCol = pivotCol + (pivotCol - blinkyCol);
        const targetRow = pivotRow + (pivotRow - blinkyRow);
        return { col: targetCol, row: targetRow };
      }

      case "CLYDE": {
        // Pokey: Chases when distance >= 8 tiles; flees to scatter corner when < 8 tiles.
        const distSq = (pacCol - ghostCol) ** 2 + (pacRow - ghostRow) ** 2;
        const isClose = distSq < 64; // Closer than 8 tiles (8 * 8 = 64)

        if (isClose) {
          return maze.scatterTargets.CLYDE;
        }

        const wanderState = ghost.clydeWanderState || "CHASE";
        return wanderState === "CHASE" ? { col: pacCol, row: pacRow } : maze.scatterTargets.CLYDE;
      }
    }
  }

  /**
   * Evaluates lookahead upon crossing into a new tile boundary.
   * If next tile in path is an intersection, pokes AI for target (or random if frightened).
   * If next tile is straight, assigns current dir (no AI poke).
   * If next tile is a corner, assigns the only valid turn exit (no AI poke).
   *
   * **Refactored for Arcade Accuracy**
   *
   * Evaluates the tile *ahead* of the target tile (lookahead + 1) to determine the next turn direction.
   * This is executed only when the ghost is centered on the current tile.
   */
  public evaluateTileEntryLookahead(
    ghost: Ghost,
    pacman: Pacman,
    blinky: Ghost,
    maze: MazeData,
    evalCol: number, // The tile the ghost is currently on (already centered)
    evalRow: number // The tile the ghost is currently on (already centered)
  ): void {
    const { dx, dy } = getDirectionVector(ghost.dir);
    // The tile the ghost is physically moving into next frame
    const lookaheadCol = evalCol + dx;
    const lookaheadRow = evalRow + dy;

    ghost.lastDecisionTile = { col: lookaheadCol, row: lookaheadRow };

    // 1. Frightened: a PRNG direction with a clockwise fallback, on every tile (corridors too, which
    // advances the PRNG exactly as often as the arcade's). No-up zones are ignored.
    if (ghost.mode === "FRIGHTENED") {
      const state = ghost.toState();
      ghost.nextDir = pickFrightenedDirection(this.prng.next(), ghost.dir, (candidate) => {
        const v = getDirectionVector(candidate);
        return isTileWalkableForGhost(lookaheadCol + v.dx, lookaheadRow + v.dy, state, maze);
      });
      return;
    }

    // 2. Unified Target Evaluation Loop (Chase / Scatter / Eaten)
    // The arcade uses this exact block for corridors, corners, and intersections alike.
    ghost.target = this.calculateTarget(ghost, pacman, blinky, maze);

    ghost.nextDir = chooseNextGhostDirection(
      ghost.toState(),
      ghost.target,
      maze,
      lookaheadCol,
      lookaheadRow,
      ghost.dir
    );
  }
}
