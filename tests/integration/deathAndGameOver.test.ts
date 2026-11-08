import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { TILE_SIZE } from "../../src/game/constants";

describe("Layer 2 Integration Tests: Death, Game Over & Free Ghost Movement", () => {
  it("should trigger DYING state, advance deathProgress to 1, decrement lives and trigger GAME_OVER when out of lives", () => {
    let gameOverFired = false;
    let finalScoreReported = -1;

    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.lives = 1; // 1 life left so death causes Game Over
    engine.score = 500;
    engine.playState = "PLAYING";

    const collectEvents = () => {
      for (const e of engine.drainEvents()) {
        if (e.type === "GAME_OVER") {
          gameOverFired = true;
          finalScoreReported = e.score;
        }
      }
    };

    const blinky = engine.ghosts.BLINKY;
    blinky.location = "ACTIVE";
    blinky.wave = "CHASE";

    // Collide with Pac-Man
    engine.pacman.x = blinky.x;
    engine.pacman.y = blinky.y;

    // Frame 1: Collision initiates death
    engine.update();
    expect(engine.playState).toBe("DYING");
    expect(engine.pacman.isDying).toBe(true);

    // Run frames until death animation finishes (0.015 per frame ~ 67 frames)
    for (let f = 0; f < 80; f++) {
      engine.update();
      collectEvents();
    }

    expect(engine.lives).toBe(0);
    expect(engine.playState).toBe("GAME_OVER");
    expect(gameOverFired).toBe(true);
    expect(finalScoreReported).toBe(500);
  });

  it("should ensure emerging ghosts continue moving along the corridor and do not freeze at tile (13, 14)", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    // Pinky emerges
    const pinky = engine.ghosts.PINKY;
    pinky.x = 13 * TILE_SIZE + TILE_SIZE / 2;
    pinky.y = 14 * TILE_SIZE + TILE_SIZE / 2;
    pinky.location = "ACTIVE";
    pinky.dir = "LEFT";
    pinky.nextDir = "LEFT";

    const initialX = pinky.x;

    // Run 30 logic frames
    for (let f = 0; f < 30; f++) {
      engine.update();
    }

    // Pinky must have moved LEFT away from (13, 14) and NOT be stuck at initialX!
    expect(pinky.x).toBeLessThan(initialX);
    expect(pinky.dir).toBeDefined();
  });
});
