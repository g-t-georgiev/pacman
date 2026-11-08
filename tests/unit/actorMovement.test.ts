import { describe, expect, it } from "vite-plus/test";
import { Pacman } from "../../src/core/Pacman";
import { Ghost } from "../../src/core/Ghost";
import { GhostAiController } from "../../src/controllers/GhostAiController";
import { MovementController } from "../../src/controllers/MovementController";
import { getMazeData } from "../../src/game/mazes";
import { TILE_SIZE } from "../../src/game/constants";

describe("Layer 1 Unit Tests: Tile-Aligned Movement & Asymmetric Reversals", () => {
  const maze = getMazeData("PACMAN", 1);
  const movement = new MovementController();
  const ghostAi = new GhostAiController(false);

  it("should allow Pac-Man an immediate 180-degree reversal at any sub-pixel position", () => {
    // Pac-Man moving RIGHT at arbitrary coordinate (col 10, offset + 3px)
    const pacman = new Pacman(10 * TILE_SIZE + 3, 20 * TILE_SIZE + 4, "RIGHT");

    // Player inputs LEFT
    pacman.setRequestedDirection("LEFT");
    pacman.tryTurn(maze);

    // Should immediately face LEFT without waiting for tile center
    expect(pacman.dir).toBe("LEFT");
  });

  it("should NOT immediately reverse a ghost mid-tile; should prime reversal until reaching tile center", () => {
    // Blinky positioned 2 pixels before the tile boundary.
    // Speed 80% moves exactly 1 pixel every frame.
    const blinky = new Ghost(
      "BLINKY",
      10 * TILE_SIZE + 6,
      11 * TILE_SIZE + TILE_SIZE / 2,
      "RIGHT",
      false
    );
    blinky.lastOccupiedTile = { col: 10, row: 11 };
    const pacman = new Pacman(
      14 * TILE_SIZE + TILE_SIZE / 2,
      20 * TILE_SIZE + TILE_SIZE / 2,
      "LEFT"
    );

    // Wave switch primes reversal
    blinky.primeReversal();
    expect(blinky.reversalPrimed).toBe(true);
    expect(blinky.dir).toBe("RIGHT"); // Still moving RIGHT until center!

    // Step 1: Blinky moves 1 pixel -> still within col 10
    movement.updateGhostMovement(blinky, blinky, pacman, 0, 80, 1.0, maze, 200, ghostAi);
    expect(blinky.x).toBe(10 * TILE_SIZE + 7);
    expect(blinky.reversalPrimed).toBe(true);
    expect(blinky.dir).toBe("RIGHT");

    // Step 2: Blinky moves another pixel and crosses the boundary into col 11
    movement.updateGhostMovement(blinky, blinky, pacman, 1, 80, 1.0, maze, 200, ghostAi);
    expect(blinky.x).toBe(11 * TILE_SIZE);
    // Across boundary into col 11: reversal remains primed because the center is not reached yet
    expect(blinky.reversalPrimed).toBe(true);
    expect(blinky.dir).toBe("RIGHT");

    // Advance 4 more pixels (4 frames) to reach the center of col 11
    for (let f = 2; f < 6; f++) {
      movement.updateGhostMovement(blinky, blinky, pacman, f, 80, 1.0, maze, 200, ghostAi);
    }
    expect(blinky.x).toBe(11 * TILE_SIZE + TILE_SIZE / 2);
    // At tile center, reversal executes immediately
    expect(blinky.reversalPrimed).toBe(false);
    expect(blinky.dir).toBe("LEFT");
  });

  it("should evaluate straight corridor lookahead without querying AI target", () => {
    // Blinky at col 2, row 11 moving RIGHT towards col 3 (which continues straight to col 4)
    const blinky = new Ghost(
      "BLINKY",
      2 * TILE_SIZE + TILE_SIZE / 2,
      11 * TILE_SIZE + TILE_SIZE / 2,
      "RIGHT",
      false
    );
    const { col: blinkyCurrCol, row: blinkyCurrRow } = blinky.tileCoord;

    const pacman = new Pacman(
      20 * TILE_SIZE + TILE_SIZE / 2,
      20 * TILE_SIZE + TILE_SIZE / 2,
      "LEFT"
    );

    ghostAi.evaluateTileEntryLookahead(
      blinky,
      pacman,
      blinky,
      maze,
      200,
      blinkyCurrCol,
      blinkyCurrRow
    );

    // Straight path continuation sets nextDir without changing target
    expect(blinky.nextDir).toBe("RIGHT");
  });

  it("should detect corner tile lookahead and assign the single valid turn exit without querying target", () => {
    // Blinky at col 1, row 5 moving UP towards corner at col 1, row 4 (wall above, only exit is RIGHT)
    const blinky = new Ghost(
      "BLINKY",
      1 * TILE_SIZE + TILE_SIZE / 2,
      5 * TILE_SIZE + TILE_SIZE / 2,
      "UP",
      false
    );
    const { col: blinkyCurrCol, row: blinkyCurrRow } = blinky.tileCoord;

    const pacman = new Pacman(
      20 * TILE_SIZE + TILE_SIZE / 2,
      20 * TILE_SIZE + TILE_SIZE / 2,
      "LEFT"
    );

    ghostAi.evaluateTileEntryLookahead(
      blinky,
      pacman,
      blinky,
      maze,
      200,
      blinkyCurrCol,
      blinkyCurrRow
    );

    // Corner at (1, 4): path above is blocked, only valid exit is RIGHT
    expect(blinky.nextDir).toBe("RIGHT");
  });

  it("should detect intersection tile lookahead and query target in Chase mode", () => {
    // Inky at col 5, row 8 moving RIGHT towards intersection at col 6, row 8
    const inky = new Ghost(
      "INKY",
      5 * TILE_SIZE + TILE_SIZE / 2,
      8 * TILE_SIZE + TILE_SIZE / 2,
      "RIGHT",
      false
    );
    const { col: inkyCurrCol, row: inkyCurrRow } = inky.tileCoord;

    inky.mode = "CHASE";

    const pacman = new Pacman(6 * TILE_SIZE + TILE_SIZE / 2, 4 * TILE_SIZE + TILE_SIZE / 2, "UP");
    const blinky = new Ghost(
      "BLINKY",
      6 * TILE_SIZE + TILE_SIZE / 2,
      14 * TILE_SIZE + TILE_SIZE / 2,
      "UP",
      false
    );

    ghostAi.evaluateTileEntryLookahead(inky, pacman, blinky, maze, 200, inkyCurrCol, inkyCurrRow);

    // Next tile (6, 8) is an authentic intersection: pokes AI and records decision tile
    expect(inky.lastDecisionTile).toEqual({ col: 6, row: 8 });
    expect(["UP", "DOWN", "RIGHT"]).toContain(inky.nextDir);
  });

  it("should correctly compute tile coordinates with default anchor point (0.5, 0.5)", () => {
    const ghost = new Ghost("PINKY", 10 * TILE_SIZE + 4, 15 * TILE_SIZE + 4, "UP", false);
    expect(ghost.anchorX).toBe(0.5);
    expect(ghost.anchorY).toBe(0.5);
    expect(ghost.tileCoord).toEqual({ col: 10, row: 15 });
  });
});
