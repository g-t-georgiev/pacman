import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { TILE_SIZE } from "../../src/game/constants";
import { Ghost } from "../../src/core/Ghost";
import { MovementController } from "../../src/controllers/MovementController";
import { getMazeData } from "../../src/game/mazes";

describe("Arcade Faithful Physics, Integer Tile Collision & Eaten Descent", () => {
  it("should trigger collision only when Pac-Man and Ghost occupy the exact same integer tile", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "CHASE";

    // Place Pac-Man at tile (10, 11)
    engine.pacman.x = 10 * TILE_SIZE + TILE_SIZE / 2;
    engine.pacman.y = 11 * TILE_SIZE + TILE_SIZE / 2;

    // Place Blinky at adjacent tile (11, 11), very close near the border (only 2px away from Pac-Man!)
    blinky.x = 11 * TILE_SIZE + 1;
    blinky.y = 11 * TILE_SIZE + TILE_SIZE / 2;

    engine.update();

    // Since they occupy different integer tiles (10 vs 11), Pac-Man must NOT die!
    expect(engine.pacman.isDying).toBe(false);
    expect(engine.playState).toBe("PLAYING");

    // Now place Blinky in the exact same integer tile (10, 11)
    blinky.x = 10 * TILE_SIZE + 7;
    blinky.y = 11 * TILE_SIZE + TILE_SIZE / 2;

    engine.update();

    // Now occupying same integer tile: Pac-Man dies!
    expect(engine.pacman.isDying).toBe(true);
    expect(engine.playState).toBe("DYING");
  });

  it("should replicate the authentic arcade pass-through glitch when crossing boundaries on the same frame", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "CHASE";

    // Pac-Man at tile 10 moving RIGHT towards tile 11 (at right edge of tile 10: 10 * 16 + 15)
    engine.pacman.x = 10 * TILE_SIZE + 15;
    engine.pacman.y = 11 * TILE_SIZE + TILE_SIZE / 2;
    engine.pacman.dir = "RIGHT";
    engine.pacman.nextDir = "RIGHT";

    // Blinky at tile 11 moving LEFT towards tile 10 (at left edge of tile 11: 11 * 16 + 0)
    blinky.x = 11 * TILE_SIZE;
    blinky.y = 11 * TILE_SIZE + TILE_SIZE / 2;
    blinky.dir = "LEFT";
    blinky.nextDir = "LEFT";
    blinky.lastOccupiedTile = { col: 11, row: 11 };

    // Before update: tile 10 vs tile 11
    expect(engine.pacman.tileCoord.col).toBe(10);
    expect(blinky.tileCoord.col).toBe(11);

    // Update 1 frame: Pac-Man steps into tile 11, Blinky steps into tile 10
    // Because they cross each other across the tile boundary, neither occupies the same integer tile!
    engine.update();

    // Pac-Man is now in tile 11 (or beyond) and Blinky is in tile 10 (or before)
    expect(engine.pacman.isDying).toBe(false);
    expect(engine.playState).toBe("PLAYING");
  });

  it("should freeze Pac-Man movement for 1 frame when eating a normal dot", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    // Set dot at (10, 11)
    engine.maze.tiles[11][10] = "DOT";
    engine.pacman.x = 10 * TILE_SIZE + 8;
    engine.pacman.y = 11 * TILE_SIZE + 8;
    engine.pacman.dir = "LEFT";

    // Run collision check by updating
    engine.update();

    // Dot eaten: eatingFreezeFrames set to 1
    expect(engine.pacman.eatingFreezeFrames).toBe(1);

    const prevX = engine.pacman.x;
    // Next update: freeze consumes the frame without advancing Pac-Man
    engine.update();
    expect(engine.pacman.x).toBe(prevX);
    expect(engine.pacman.eatingFreezeFrames).toBe(0);
  });

  it("should freeze Pac-Man movement for 3 frames when eating an energizer", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    // Set energizer at (10, 11)
    engine.maze.tiles[11][10] = "ENERGIZER";
    engine.pacman.x = 10 * TILE_SIZE + 8;
    engine.pacman.y = 11 * TILE_SIZE + 8;
    engine.pacman.dir = "LEFT";

    // Run collision check
    engine.update();

    // Energizer eaten: eatingFreezeFrames set to 3
    expect(engine.pacman.eatingFreezeFrames).toBe(3);

    const prevX = engine.pacman.x;
    // 3 consecutive frames must freeze movement
    engine.update();
    expect(engine.pacman.x).toBe(prevX);
    expect(engine.pacman.eatingFreezeFrames).toBe(2);

    engine.update();
    expect(engine.pacman.x).toBe(prevX);
    expect(engine.pacman.eatingFreezeFrames).toBe(1);

    engine.update();
    expect(engine.pacman.x).toBe(prevX);
    expect(engine.pacman.eatingFreezeFrames).toBe(0);
  });

  it("should guide eaten Blinky eyes through the door seam (x=224) into Pinky's slot (224, 280) and revive", () => {
    const movement = new MovementController();

    // Blinky reaches doorstep at (13, 14) as EATEN eyes
    const blinky = new Ghost("BLINKY", 13 * TILE_SIZE + 8, 14 * TILE_SIZE + 8, "RIGHT", false);
    blinky.mode = "EATEN";

    // Advance descent step by step
    for (let i = 0; i < 150; i++) {
      if (blinky.inHouse) break;
      movement.handleEatenDescent(blinky, 1);
    }

    expect(blinky.inHouse).toBe(true);
    expect(blinky.mode).toBe("CHASE");
    expect(blinky.x).toBe(224); // Pinky's slot
    expect(blinky.y).toBe(280); // Row 17 centerline
  });

  it("should guide eaten Inky eyes through the door seam and horizontally to Inky's left slot (184, 280)", () => {
    const movement = new MovementController();

    // Inky reaches doorstep at (13, 14) as EATEN eyes
    const inky = new Ghost("INKY", 13 * TILE_SIZE + 8, 14 * TILE_SIZE + 8, "RIGHT", false);
    inky.mode = "EATEN";

    for (let i = 0; i < 200; i++) {
      if (inky.inHouse) break;
      movement.handleEatenDescent(inky, 1);
    }

    expect(inky.inHouse).toBe(true);
    expect(inky.mode).toBe("CHASE");
    expect(inky.x).toBe(184); // Inky's designated slot on left
    expect(inky.y).toBe(280);
  });

  it("should guide eaten Clyde eyes through the door seam and horizontally to Clyde's right slot (248, 280)", () => {
    const movement = new MovementController();

    // Clyde reaches doorstep at (14, 14) as EATEN eyes
    const clyde = new Ghost("CLYDE", 14 * TILE_SIZE + 8, 14 * TILE_SIZE + 8, "LEFT", false);
    clyde.mode = "EATEN";

    for (let i = 0; i < 200; i++) {
      if (clyde.inHouse) break;
      movement.handleEatenDescent(clyde, 1);
    }

    expect(clyde.inHouse).toBe(true);
    expect(clyde.mode).toBe("CHASE");
    expect(clyde.x).toBe(248); // Clyde's designated slot on right
    expect(clyde.y).toBe(280);
  });

  it("should define dual-candidate starting coordinates for all actors and bonus fruit in maze data", () => {
    const maze = getMazeData("PACMAN", 1);

    expect(maze.pacmanSpawn.candidates).toEqual([
      { col: 13, row: 26 },
      { col: 14, row: 26 },
    ]);

    expect(maze.ghostSpawns.BLINKY.candidates).toEqual([
      { col: 13, row: 14 },
      { col: 14, row: 14 },
    ]);
    expect(maze.ghostSpawns.BLINKY.respawnSlot).toEqual([
      { col: 13, row: 17 },
      { col: 14, row: 17 },
    ]);

    expect(maze.ghostSpawns.PINKY.candidates).toEqual([
      { col: 13, row: 17 },
      { col: 14, row: 17 },
    ]);

    expect(maze.ghostSpawns.INKY.candidates).toEqual([
      { col: 11, row: 17 },
      { col: 12, row: 17 },
    ]);

    expect(maze.ghostSpawns.CLYDE.candidates).toEqual([
      { col: 15, row: 17 },
      { col: 16, row: 17 },
    ]);

    expect(maze.fruitSpawn?.candidates).toEqual([
      { col: 13, row: 20 },
      { col: 14, row: 20 },
    ]);
  });

  it("should evaluate updated diagnostic rules and include tile coords and freeze frames in telemetry", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const diagData = engine.getActorsDiagnostics();
    expect(diagData.pacman.tileCol).toBe(13);
    expect(diagData.pacman.tileRow).toBe(26);
    expect(diagData.pacman.eatingFreezeFrames).toBe(0);
    expect(diagData.blinky.tileCol).toBe(13);
    expect(diagData.blinky.tileRow).toBe(14);
    expect(diagData.blinky.enteringHousePhase).toBe("NONE");

    // All active default rules evaluate cleanly without failures
    for (const rule of engine.diagnosticController.rules) {
      const res = rule.evaluate(engine);
      expect(res.pass).toBe(true);
    }
  });

  it("should validate that eaten Inky, Clyde, Pinky, and Blinky correctly target designated pen slots at doorstep and pass diagnostic routing rules", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    const doorstepRule = engine.diagnosticController.rules.find(
      (r) => r.id === "RULE_EATEN_EYES_DOORSTEP_ROUTING"
    );
    expect(doorstepRule).toBeDefined();

    // 1. INKY eaten eyes at doorstep (col 14, row 14)
    const inky = engine.ghosts.INKY;
    inky.inHouse = false;
    inky.mode = "EATEN";
    inky.x = 14 * TILE_SIZE + TILE_SIZE / 2;
    inky.y = 14 * TILE_SIZE + TILE_SIZE / 2;
    inky.enteringHousePhase = "NONE";

    // Target calculation should return Inky's designated slot (11, 17)
    inky.target = engine.ghostAiController.calculateTarget(
      inky,
      engine.pacman,
      engine.ghosts.BLINKY,
      engine.maze,
      engine.dotsRemaining
    );
    expect(inky.target).toEqual({ col: 11, row: 17 });

    // Doorstep diagnostic rule must recognize (11, 17) as valid designated pen slot
    const inkyRes = doorstepRule!.evaluate(engine);
    expect(inkyRes.pass).toBe(true);

    // 2. CLYDE eaten eyes at doorstep (col 13, row 14)
    const clyde = engine.ghosts.CLYDE;
    clyde.inHouse = false;
    clyde.mode = "EATEN";
    clyde.x = 13 * TILE_SIZE + TILE_SIZE / 2;
    clyde.y = 14 * TILE_SIZE + TILE_SIZE / 2;
    clyde.enteringHousePhase = "NONE";

    clyde.target = engine.ghostAiController.calculateTarget(
      clyde,
      engine.pacman,
      engine.ghosts.BLINKY,
      engine.maze,
      engine.dotsRemaining
    );
    expect(clyde.target).toEqual({ col: 15, row: 17 });

    const clydeRes = doorstepRule!.evaluate(engine);
    expect(clydeRes.pass).toBe(true);

    // 3. Inky executes full descent to slot at x = 184 (col 11.5)
    let finishedDescent = false;
    for (let frame = 0; frame < 200; frame++) {
      finishedDescent = engine.movementController.handleEatenDescent(inky, 2);
      if (finishedDescent) break;
    }
    expect(finishedDescent).toBe(true);
    expect(inky.inHouse).toBe(true);
    expect(inky.x).toBe(184); // Left slot inside house
  });
});
