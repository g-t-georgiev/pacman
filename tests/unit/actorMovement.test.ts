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

  it("a ghost obeys a pending reversal when it enters its next tile, not before (Dossier)", () => {
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
    expect(blinky.dir).toBe("RIGHT"); // keeps going until the next tile

    // Step 1: Blinky moves 1 pixel -> still within col 10
    movement.updateGhostMovement(blinky, {
      blinky: blinky,
      pacman,
      currLevelFrame: 0,
      speedPct: 80,
      turboMultiplier: 1,
      maze,
      ghostAi,
    });
    expect(blinky.x).toBe(10 * TILE_SIZE + 7);
    expect(blinky.reversalPrimed).toBe(true);
    expect(blinky.dir).toBe("RIGHT");

    // Step 2: Blinky crosses the boundary into col 11 and turns around right there
    movement.updateGhostMovement(blinky, {
      blinky: blinky,
      pacman,
      currLevelFrame: 1,
      speedPct: 80,
      turboMultiplier: 1,
      maze,
      ghostAi,
    });
    expect(blinky.x).toBe(11 * TILE_SIZE);
    expect(blinky.reversalPrimed).toBe(false);
    expect(blinky.dir).toBe("LEFT");

    // It heads back through col 10 (re-entering it plans from there, heading left)
    movement.updateGhostMovement(blinky, {
      blinky: blinky,
      pacman,
      currLevelFrame: 2,
      speedPct: 80,
      turboMultiplier: 1,
      maze,
      ghostAi,
    });
    expect(blinky.tileCoord.col).toBe(10);
    expect(blinky.dir).toBe("LEFT");
    expect(blinky.lastDecisionTile).toEqual({ col: 9, row: 11 });
  });

  it("decides on tile entry and turns at the tile center (F14)", () => {
    // Moving right along row 8 toward the intersection at (6, 8), with Pac-Man straight above it.
    const inky = new Ghost(
      "INKY",
      4 * TILE_SIZE + TILE_SIZE / 2,
      8 * TILE_SIZE + TILE_SIZE / 2,
      "RIGHT"
    );
    inky.wave = "CHASE";
    inky.nextDir = "NONE";
    const pacman = new Pacman(6 * TILE_SIZE + 4, 4 * TILE_SIZE + 4, "LEFT");
    const blinky = new Ghost("BLINKY", 1 * TILE_SIZE + 4, 4 * TILE_SIZE + 4, "LEFT");
    const step = (f: number) =>
      movement.updateGhostMovement(inky, {
        blinky: blinky,
        pacman,
        currLevelFrame: f,
        speedPct: 80,
        turboMultiplier: 1,
        maze,
        ghostAi,
      });

    // From (4, 8) the first plan is for (5, 8): straight on
    step(0);
    expect(inky.nextDir).toBe("RIGHT");

    // Entering (5, 8): the decision for (6, 8) is made now, half a tile before (5, 8)'s center
    let f = 1;
    while (inky.tileCoord.col < 5) step(f++);
    expect(inky.x).toBe(5 * TILE_SIZE);
    expect(inky.plannedDir).toBe("UP");
    expect(inky.lastDecisionTile).toEqual({ col: 6, row: 8 });

    // At (6, 8)'s center it turns up
    while (inky.x < 6 * TILE_SIZE + TILE_SIZE / 2) step(f++);
    expect(inky.dir).toBe("UP");
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

    const planned = ghostAi.planNextTile(
      blinky,
      pacman,
      blinky,
      maze,
      blinkyCurrCol,
      blinkyCurrRow,
      blinky.dir
    );

    // Straight path continuation sets nextDir without changing target
    expect(planned).toBe("RIGHT");
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

    const planned = ghostAi.planNextTile(
      blinky,
      pacman,
      blinky,
      maze,
      blinkyCurrCol,
      blinkyCurrRow,
      blinky.dir
    );

    // Corner at (1, 4): path above is blocked, only valid exit is RIGHT
    expect(planned).toBe("RIGHT");
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

    inky.wave = "CHASE";

    const pacman = new Pacman(6 * TILE_SIZE + TILE_SIZE / 2, 4 * TILE_SIZE + TILE_SIZE / 2, "UP");
    const blinky = new Ghost(
      "BLINKY",
      6 * TILE_SIZE + TILE_SIZE / 2,
      14 * TILE_SIZE + TILE_SIZE / 2,
      "UP",
      false
    );

    const planned = ghostAi.planNextTile(
      inky,
      pacman,
      blinky,
      maze,
      inkyCurrCol,
      inkyCurrRow,
      inky.dir
    );

    // Next tile (6, 8) is an authentic intersection: pokes AI and records decision tile
    expect(inky.lastDecisionTile).toEqual({ col: 6, row: 8 });
    expect(["UP", "DOWN", "RIGHT"]).toContain(planned);
  });

  it("an actor's tile is the one its center pixel is in", () => {
    const ghost = new Ghost("PINKY", 10 * TILE_SIZE + 4, 15 * TILE_SIZE + 4, "UP", false);
    expect(ghost.tileCoord).toEqual({ col: 10, row: 15 });
  });
});
