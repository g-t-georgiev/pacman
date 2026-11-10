import type { Ghost } from "../core/Ghost";
import type { Pacman } from "../core/Pacman";
import type { Direction, MazeData, TileCoord } from "../types";
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
  public emulateRomQuirks: boolean = true;
  /** The sim's PRNG, shared with (and reset by) the engine. Advanced only by frightened decisions. */
  public prng: PRNG;

  constructor(emulateRomQuirks: boolean = true, prng: PRNG = new PRNG()) {
    this.emulateRomQuirks = emulateRomQuirks;
    this.prng = prng;
  }

  /**
   * Calculates the authentic target tile for a ghost, with optional 1980 ROM quirk emulation.
   */
  public calculateTarget(
    ghost: Ghost,
    pacman: Pacman,
    blinky: Ghost,
    maze: MazeData
  ): TileCoord | null {
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

    // 3. FRIGHTENED: no target at all. Turns come from the PRNG (see planNextTile).
    if (ghost.mode === "FRIGHTENED") return null;

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
        const flee = distSq < 64; // closer than 8 tiles (8 * 8 = 64)
        ghost.clydeWanderState = flee ? "FLEE" : "CHASE"; // shown by the Learn overlay
        return flee ? maze.scatterTargets.CLYDE : { col: pacCol, row: pacRow };
      }
    }
  }

  /**
   * Looks one tile ahead (Dossier "Looking Ahead"; RGME: on every tile entry). The ghost is in
   * tile (col, row) and will leave it heading `heading`; this decides which way it will turn when
   * it reaches the center of the next tile along that heading.
   *
   * It runs for corridors and corners too, as the arcade does, so the frightened PRNG advances
   * exactly once per tile. The target is refreshed here (null while frightened).
   */
  public planNextTile(
    ghost: Ghost,
    pacman: Pacman,
    blinky: Ghost,
    maze: MazeData,
    col: number,
    row: number,
    heading: Direction
  ): Direction {
    const { dx, dy } = getDirectionVector(heading);
    const nextCol = col + dx;
    const nextRow = row + dy;
    ghost.lastDecisionTile = { col: nextCol, row: nextRow };

    ghost.target = this.calculateTarget(ghost, pacman, blinky, maze);

    // Frightened: a PRNG direction with a clockwise fallback. No-up zones are ignored.
    if (ghost.target === null) {
      const state = ghost.toState();
      return pickFrightenedDirection(this.prng.next(), heading, (candidate) => {
        const v = getDirectionVector(candidate);
        return isTileWalkableForGhost(nextCol + v.dx, nextRow + v.dy, state, maze);
      });
    }

    return chooseNextGhostDirection(ghost.toState(), ghost.target, maze, nextCol, nextRow, heading);
  }
}
