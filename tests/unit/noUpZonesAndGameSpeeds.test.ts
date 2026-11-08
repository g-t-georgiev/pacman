import { describe, expect, it } from "vite-plus/test";
import { TILE_SIZE } from "../../src/game/constants";
import { getMazeData } from "../../src/game/mazes";
import { MovementController } from "../../src/controllers/MovementController";
import { GameLoopController } from "../../src/controllers/GameLoopController";
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
    const ghost = new Ghost(
      "BLINKY",
      12 * TILE_SIZE + TILE_SIZE / 2,
      14 * TILE_SIZE + TILE_SIZE / 2,
      "LEFT",
      false
    );
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

    const ghost = new Ghost(
      "PINKY",
      12 * TILE_SIZE + TILE_SIZE / 2,
      26 * TILE_SIZE + TILE_SIZE / 2,
      "LEFT",
      false
    );
    ghost.mode = "CHASE";
    const target = { col: 12, row: 20 }; // Target directly above

    const nextDir = chooseNextGhostDirection(ghost.toState(), target, maze, 12, 26, "LEFT");

    // Ghost must NOT turn UP at (12, 26)
    expect(nextDir).not.toBe("UP");
  });

  it("allows EATEN ghosts (eyes) to travel UP through No-Up zones toward house", () => {
    const ghost = new Ghost(
      "BLINKY",
      12 * TILE_SIZE + TILE_SIZE / 2,
      14 * TILE_SIZE + TILE_SIZE / 2,
      "LEFT",
      false
    );

    ghost.mode = "EATEN";

    const target = { col: 12, row: 5 };

    const nextDir = chooseNextGhostDirection(ghost.toState(), target, maze, 12, 14, "LEFT");

    // Eaten eyes ignore No-Up zone restriction
    expect(nextDir).toBe("UP");
  });

  it("game speed changes how many ticks run per real second, not what a tick does", () => {
    const run = (gameSpeed: number) => {
      let ticks = 0;
      const loop = new GameLoopController(
        () => ticks++,
        () => {},
        () => gameSpeed
      );
      // One real second, fed in 60 display frames
      for (let i = 0; i < 60; i++) loop.advance(1000 / 60);
      return ticks;
    };

    expect(run(1.0)).toBe(60);
    expect(run(0.5)).toBe(30);
    expect(run(2.0)).toBe(120);
  });

  it("moves Pac-Man the same distance per tick at any game speed", () => {
    const pacman = new Pacman(
      10 * TILE_SIZE + TILE_SIZE / 2,
      26 * TILE_SIZE + TILE_SIZE / 2,
      "RIGHT"
    );
    // 16 ticks at 100% = 20 px
    for (let f = 0; f < 16; f++) movement.updatePacmanMovement(pacman, f, 100, 1.0, maze);
    expect(pacman.x - (10 * TILE_SIZE + TILE_SIZE / 2)).toBe(20);
  });
});
