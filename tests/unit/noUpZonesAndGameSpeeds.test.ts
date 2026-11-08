import { describe, expect, it } from "vite-plus/test";
import { TILE_SIZE } from "../../src/game/constants";
import { getMazeData } from "../../src/game/mazes";
import { MovementController } from "../../src/controllers/MovementController";
import { chooseNextGhostDirection, isTileNoUpZone } from "../../src/game/ghostAiUtils";
import { Ghost } from "../../src/core/Ghost";
import { Pacman } from "../../src/core/Pacman";

describe("Authentic Special No-Up Intersection Tiles and Practice GameSpeed", () => {
  const maze = getMazeData("PACMAN", 1);
  const movement = new MovementController();

  it("identifies the 4 authentic No-Up zones in classic arcade Pac-Man", () => {
    // Upper two: above ghost house
    expect(isTileNoUpZone(12, 14, maze)).toBe(true);
    expect(isTileNoUpZone(15, 14, maze)).toBe(true);

    // Lower two: to the left and right of Pac-Man spawn
    expect(isTileNoUpZone(12, 26, maze)).toBe(true);
    expect(isTileNoUpZone(15, 26, maze)).toBe(true);

    // Regular intersection should not be a No-Up zone
    expect(isTileNoUpZone(6, 8, maze)).toBe(false);
    expect(isTileNoUpZone(12, 8, maze)).toBe(false);
  });

  it("forbids ghosts from turning UP at No-Up zones in CHASE mode even when target is directly above", () => {
    const ghost = new Ghost("BLINKY", 12 * TILE_SIZE + 8, 14 * TILE_SIZE + 8, "LEFT", false);
    ghost.mode = "CHASE";
    // Target is directly above at col 12, row 5
    const target = { col: 12, row: 5 };

    // At tile (12, 14), facing LEFT. Possible directions: UP (forbidden), LEFT, DOWN (wall), RIGHT (opposite)
    const nextDir = chooseNextGhostDirection(ghost.toState(), target, maze, 12, 14, "LEFT");

    // Must NOT choose UP!
    expect(nextDir).not.toBe("UP");
    expect(nextDir).toBe("LEFT");
  });

  it("forbids ghosts from turning UP at lower No-Up zones (12, 26) and (15, 26) which contain dots", () => {
    // Check that (12, 26) and (15, 26) have normal dots for Pac-Man to eat
    expect(maze.tiles[26][12]).toBe("DOT");
    expect(maze.tiles[26][15]).toBe("DOT");

    const ghost = new Ghost("PINKY", 12 * TILE_SIZE + 8, 26 * TILE_SIZE + 8, "LEFT", false);
    ghost.mode = "CHASE";
    const target = { col: 12, row: 20 }; // Target directly above

    const nextDir = chooseNextGhostDirection(ghost.toState(), target, maze, 12, 26, "LEFT");

    // Ghost must NOT turn UP at (12, 26)
    expect(nextDir).not.toBe("UP");
  });

  it("allows EATEN ghosts (eyes) to travel UP through No-Up zones toward house", () => {
    const ghost = new Ghost("BLINKY", 12 * TILE_SIZE + 8, 14 * TILE_SIZE + 8, "LEFT", false);

    ghost.mode = "EATEN";

    const target = { col: 12, row: 5 };

    const nextDir = chooseNextGhostDirection(ghost.toState(), target, maze, 12, 14, "LEFT");

    // Eaten eyes ignore No-Up zone restriction
    expect(nextDir).toBe("UP");
  });

  it("scales actor movement accurately using gameSpeed in practice mode", () => {
    // Moving RIGHT along row 26 leaves 5+ open tiles ahead
    const pacmanHalf = new Pacman(10 * TILE_SIZE + 8, 26 * TILE_SIZE + 8, "RIGHT");
    const pacmanFull = new Pacman(10 * TILE_SIZE + 8, 26 * TILE_SIZE + 8, "RIGHT");
    const pacmanDouble = new Pacman(10 * TILE_SIZE + 8, 26 * TILE_SIZE + 8, "RIGHT");

    // Run 16 frames (one full speed cycle) at different game speeds
    for (let f = 0; f < 16; f++) {
      movement.updatePacmanMovement(pacmanHalf, f, 100, 1.0, 0.5, maze);
      movement.updatePacmanMovement(pacmanFull, f, 100, 1.0, 1.0, maze);
      movement.updatePacmanMovement(pacmanDouble, f, 100, 1.0, 2.0, maze);
    }

    const distHalf = Math.abs(pacmanHalf.x - (10 * TILE_SIZE + 8));
    const distFull = Math.abs(pacmanFull.x - (10 * TILE_SIZE + 8));
    const distDouble = Math.abs(pacmanDouble.x - (10 * TILE_SIZE + 8));

    // At 100% speed, 16 frames give 20 arcade px = 40 sim px
    expect(distFull).toBe(40);
    // At 0.5x speed, exactly half
    expect(distHalf).toBe(20);
    // At 2.0x speed, exactly double
    expect(distDouble).toBe(80);
  });
});
