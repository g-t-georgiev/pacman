import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { TILE_SIZE } from "../../src/game/constants";

describe("Layer 2 Integration Tests: Frightened Mode Mechanics", () => {
  it("should turn ghosts into FRIGHTENED mode with positive duration on Level 1", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    // Set Blinky and Pinky outside pen in CHASE
    engine.ghosts.BLINKY.inHouse = false;
    engine.ghosts.BLINKY.mode = "CHASE";
    engine.ghosts.PINKY.inHouse = false;
    engine.ghosts.PINKY.mode = "CHASE";

    engine.triggerFrightenedMode();

    expect(engine.frightenedGlobalTimer).toBeGreaterThan(0);
    expect(engine.ghosts.BLINKY.mode).toBe("FRIGHTENED");
    expect(engine.ghosts.BLINKY.prevMode).toBe("CHASE");
    expect(engine.ghosts.PINKY.mode).toBe("FRIGHTENED");
  });

  it("should only reverse direction without becoming frightened on Level 17 (0 duration)", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 17);
    engine.playState = "PLAYING";

    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "CHASE";
    blinky.dir = "LEFT";
    blinky.x = 10 * TILE_SIZE + 1; // 1 pixel from boundary of col 9
    blinky.y = 11 * TILE_SIZE + TILE_SIZE / 2;
    blinky.lastOccupiedTile = { col: 10, row: 11 };

    engine.triggerFrightenedMode();

    // Duration is 0 in arcade Pac-Man for level 17
    expect(engine.frightenedGlobalTimer).toBe(0);
    // Mode should stay CHASE
    expect(blinky.mode).toBe("CHASE");
    // Reversal should be primed
    expect(blinky.reversalPrimed).toBe(true);

    // Advance frames so Blinky reaches the center of col 9
    for (let f = 0; f < 12; f++) {
      engine.update();
      if (!blinky.reversalPrimed) break;
    }
    // Reversal executes at the tile center: Blinky now moves RIGHT!
    expect(blinky.dir).toBe("RIGHT");
    expect(blinky.reversalPrimed).toBe(false);
  });

  it("should cleanly revert ghosts to previous wave mode when frightened timer expires", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";
    engine.timerController.waveIndex = 1; // CHASE wave

    engine.ghosts.BLINKY.inHouse = false;
    engine.ghosts.BLINKY.mode = "CHASE";
    engine.ghosts.BLINKY.prevMode = "CHASE";

    engine.triggerFrightenedMode();
    expect(engine.ghosts.BLINKY.mode).toBe("FRIGHTENED");

    // Fast-forward frightened timer to expiry
    engine.frightenedGlobalTimer = 3; // frames
    for (let f = 0; f < 10; f++) {
      engine.update();
    }

    expect(engine.frightenedGlobalTimer).toBe(0);
    expect(engine.ghosts.BLINKY.mode).toBe("CHASE");
  });

  it("should put ghost into EATEN mode (eyes only) when colliding with Pac-Man during frightened mode", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "CHASE";

    engine.triggerFrightenedMode();
    expect(blinky.mode).toBe("FRIGHTENED");

    // Position Pac-Man right on top of Blinky
    engine.pacman.x = blinky.x;
    engine.pacman.y = blinky.y;

    // Run one update frame to trigger checkCollisions()
    engine.update();

    // Blinky should transition to EATEN (eyes only)
    expect(blinky.mode).toBe("EATEN");
    expect(engine.eatenGhostsInEnergizer).toBe(1);
    expect(engine.score).toBe(200); // 200 pts for first ghost
    expect(engine.scorePopups.length).toBeGreaterThan(0);
  });

  it("should prime reversal upon entering fright mode and reverse when crossing tile boundary", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "CHASE";
    // Place Blinky in horizontal corridor (row 11), moving RIGHT towards boundary
    blinky.x = 10 * TILE_SIZE + 6; // 2 px before the col 11 boundary
    blinky.y = 11 * TILE_SIZE + TILE_SIZE / 2;
    blinky.dir = "RIGHT";
    blinky.nextDir = "RIGHT";
    blinky.lastOccupiedTile = { col: 10, row: 11 };

    // Trigger frightened mode: Blinky should prime reversal
    engine.triggerFrightenedMode();
    expect(blinky.mode).toBe("FRIGHTENED");
    expect(blinky.reversalPrimed).toBe(true);
    expect(blinky.dir).toBe("RIGHT"); // Still RIGHT until boundary

    // Advance frames until Blinky reaches the center of col 11
    // Note: Frightened ghosts move at ~50% speed, so 10px takes ~20 frames
    for (let f = 0; f < 30; f++) {
      engine.update();
      if (!blinky.reversalPrimed) break;
    }

    // Blinky must have reversed to LEFT at tile center and remain moving LEFT!
    expect(blinky.dir).toBe("LEFT");
    expect(blinky.reversalPrimed).toBe(false);
  });

  it("should evaluate Eaten Eyes Front Doorstep Routing rule cleanly without false failures", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const inky = engine.ghosts.INKY;
    inky.inHouse = false;
    inky.mode = "FRIGHTENED";
    // Place Inky in lower maze (row 29)
    inky.x = 9 * TILE_SIZE + TILE_SIZE / 2;
    inky.y = 29 * TILE_SIZE + TILE_SIZE / 2;

    // Simulate Pac-Man eating Inky
    engine.pacman.x = inky.x;
    engine.pacman.y = inky.y;
    engine.update();

    expect(inky.mode).toBe("EATEN");
    // Target must immediately be doorstep row 14
    expect(inky.target.row).toBe(14);

    // Diagnostic rules should have 0 unread discrepancies for doorstep routing
    const doorstepRule = engine.diagnosticController.rules.find(
      (r) => r.id === "RULE_EATEN_EYES_DOORSTEP_ROUTING"
    );
    expect(doorstepRule).toBeDefined();
    expect(doorstepRule?.failures).toBe(0);
  });

  it("should NOT transition eaten ghosts back to frightened when another energizer is eaten", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const inky = engine.ghosts.INKY;
    inky.inHouse = false;
    inky.mode = "EATEN";
    inky.x = 10 * TILE_SIZE + TILE_SIZE / 2;
    inky.y = 14 * TILE_SIZE + TILE_SIZE / 2;

    // Trigger another energizer while Inky is eyes returning to house
    engine.triggerFrightenedMode();

    // Inky must remain in EATEN mode, not reverted to FRIGHTENED
    expect(inky.mode).toBe("EATEN");
    expect(inky.reversalPrimed).toBe(false);
  });

  it("should guide eaten eyes down through the doorstep gate into the ghost house to respawn", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "EATEN";
    // Position Blinky eyes approaching doorstep from the left in row 14 moving RIGHT
    blinky.x = 11 * TILE_SIZE + TILE_SIZE / 2;
    blinky.y = 14 * TILE_SIZE + TILE_SIZE / 2;
    blinky.dir = "RIGHT";
    blinky.nextDir = "RIGHT";
    blinky.lastOccupiedTile = { col: 11, row: 14 };

    // Advance frames: eyes should route to doorstep (col 13, row 14), turn DOWN through gate, and enter pen
    for (let f = 0; f < 60; f++) {
      engine.update();
      if (blinky.inHouse) break;
    }

    // Blinky must have entered the house and respawned into CHASE mode
    expect(blinky.inHouse).toBe(true);
    expect(blinky.mode).toBe("CHASE");
  });
});
