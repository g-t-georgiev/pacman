import type { Ghost } from "../core/Ghost";
import type { Pacman } from "../core/Pacman";
import type { Direction, MazeData, TileCoord } from "../types";
import { ELROY_1_DOTS_LEFT, TILE_SIZE } from "../game/constants";
import {
  chooseNextGhostDirection,
  getDirectionVector,
  getOppositeDirection,
  isTileNoUpZone,
  isTileWalkableForGhost,
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
  public calculateTarget(
    ghost: Ghost,
    pacman: Pacman,
    blinky: Ghost,
    maze: MazeData,
    dotsRemaining: number
  ): TileCoord {
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
      if (ghost.type === "BLINKY" && dotsRemaining <= ELROY_1_DOTS_LEFT) {
        // Cruise Elroy Blinky ignores scatter mode and remains in pursuit!
      } else {
        return maze.scatterTargets[ghost.type];
      }
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
    dotsRemaining: number,
    evalCol: number, // The tile the ghost is currently on (already centered)
    evalRow: number // The tile the ghost is currently on (already centered)
  ): void {
    const { dx, dy } = getDirectionVector(ghost.dir);
    // The tile the ghost is physically moving into next frame
    const lookaheadCol = evalCol + dx;
    const lookaheadRow = evalRow + dy;

    ghost.lastDecisionTile = { col: lookaheadCol, row: lookaheadRow };

    // 1. Handle Arcade-Accurate PRNG Frightened Mode
    if (ghost.mode === "FRIGHTENED") {
      // In the arcade, instead of generating an array of candidates and using Math.random(),
      // a 16-bit shift register yields a direction (0=UP, 1=LEFT, 2=DOWN, 3=RIGHT).
      // If blocked/invalid, it loops sequentially by incrementing the direction value (+1).
      const dirOrder: Direction[] = ["UP", "LEFT", "DOWN", "RIGHT"];
      const opposite = getOppositeDirection(ghost.dir);

      // Simulate the arcade hardware PRNG index selection [0..3]
      const prngIndex = this.prng.next();
      let chosenDir: Direction = "NONE";

      for (let i = 0; i < 4; i++) {
        const testDir = dirOrder[(prngIndex + i) % 4];

        if (testDir === opposite) continue;
        if (testDir === "UP" && isTileNoUpZone(lookaheadCol, lookaheadRow, maze)) continue;

        const v = getDirectionVector(testDir);
        if (
          isTileWalkableForGhost(lookaheadCol + v.dx, lookaheadRow + v.dy, ghost.toState(), maze)
        ) {
          chosenDir = testDir;
          break;
        }
      }

      ghost.nextDir = chosenDir !== "NONE" ? chosenDir : ghost.dir;
      return;
    }

    // 2. Unified Target Evaluation Loop (Chase / Scatter / Eaten)
    // The arcade uses this exact block for corridors, corners, and intersections alike.
    ghost.target = this.calculateTarget(ghost, pacman, blinky, maze, dotsRemaining);

    ghost.nextDir = chooseNextGhostDirection(
      ghost.toState(),
      ghost.target,
      maze,
      lookaheadCol,
      lookaheadRow,
      ghost.dir
    );
  }

  /**
   * Manages ghost house exit timers and recovery emergence.
   */
  public updateHouseEmergence(ghost: Ghost, doorX: number): void {
    if (!ghost.inHouse) return;

    if (ghost.houseTimer > 0) {
      ghost.houseTimer--;
      // Bounce up and down inside pen
      if (ghost.y <= 16.5 * TILE_SIZE) ghost.dir = "DOWN";
      if (ghost.y >= 17.5 * TILE_SIZE) ghost.dir = "UP";
      const { dy } = getDirectionVector(ghost.dir);
      ghost.y += dy * 0.25;
      return;
    }

    // Move toward center door axis
    if (Math.abs(ghost.x - doorX) > 0.5) {
      ghost.x += (ghost.x < doorX ? 1 : -1) * 0.4;
      ghost.dir = ghost.x < doorX ? "RIGHT" : "LEFT";
      return;
    }

    // Move up through the door
    ghost.x = doorX;
    ghost.dir = "UP";
    ghost.y -= 0.4;

    // Fully exited through the door (row 14)
    if (ghost.y <= 14 * TILE_SIZE + TILE_SIZE / 2) {
      ghost.y = 14 * TILE_SIZE + TILE_SIZE / 2;
      ghost.x = doorX;
      ghost.inHouse = false;
      ghost.dir = "LEFT";
      ghost.nextDir = "LEFT";
      ghost.lastDecisionTile = undefined;
    }
  }
}
