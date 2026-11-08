import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { uiConfig } from "../../src/config/ui.config";

describe("Ready Banner Delay, Level Restart & Fruit Despawn Lifecycle", () => {
  it("should initialize READY state with full countdown timer upon initGame and Start New Game", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 1);

    expect(engine.playState).toBe("READY");
    expect(engine.readyTimer).toBe(uiConfig.timings.readyBannerFrames); // 120 frames (2 seconds)
    expect(engine.lives).toBe(3);
    expect(engine.level).toBe(1);

    // During READY state, actors must remain frozen in starting positions
    const initialPacX = engine.pacman.x;
    const initialPacY = engine.pacman.y;
    const initialBlinkyX = engine.ghosts.BLINKY.x;

    engine.update();

    expect(engine.readyTimer).toBe(uiConfig.timings.readyBannerFrames - 1);
    expect(engine.playState).toBe("READY");
    expect(engine.pacman.x).toBe(initialPacX);
    expect(engine.pacman.y).toBe(initialPacY);
    expect(engine.ghosts.BLINKY.x).toBe(initialBlinkyX);
  });

  it("should buffer input direction during READY state without canceling the ready countdown prematurely", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 1);
    expect(engine.playState).toBe("READY");

    // Player inputs direction before round starts
    engine.setInputDirection("UP");

    // Direction must be buffered on actor, but playState must REMAIN 'READY'
    expect(engine.playState).toBe("READY");
    expect(engine.pacman.nextDir).toBe("UP");

    // Next update still decrements readyTimer without jumping straight into PLAYING
    engine.update();
    expect(engine.playState).toBe("READY");
  });

  it("should emit LEVEL_CHANGED whenever loadLevel is called and track current level", () => {
    const engine = new GameEngine("PACMAN", 0);
    const lastLevelEvent = () =>
      engine
        .drainEvents()
        .filter((e) => e.type === "LEVEL_CHANGED")
        .map((e) => e.level)
        .pop();

    engine.loadLevel(5);
    expect(engine.level).toBe(5);
    expect(lastLevelEvent()).toBe(5);

    engine.loadLevel(8);
    expect(engine.level).toBe(8);
    expect(lastLevelEvent()).toBe(8);
  });

  it("should properly restart at the current level with READY text, delay, and 3 lives upon restartLevel", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 5); // Level 5
    expect(engine.level).toBe(5);

    // Simulate play and life lost
    engine.playState = "PLAYING";
    engine.lives = 1;
    engine.dotsRemaining = 100;

    // Call restartLevel for level 5
    engine.drainEvents();
    engine.restartLevel(5);

    expect(engine.level).toBe(5);
    expect(engine.lives).toBe(3);
    expect(engine.playState).toBe("READY");
    expect(engine.readyTimer).toBe(uiConfig.timings.readyBannerFrames);
    expect(engine.drainEvents().some((e) => e.type === "LEVEL_CHANGED" && e.level === 5)).toBe(
      true
    );

    // Verify staggered actor emergence timings
    expect(engine.ghosts.BLINKY.inHouse).toBe(false); // Blinky starts outside
    expect(engine.ghosts.PINKY.inHouse).toBe(true);
    expect(engine.ghosts.PINKY.houseTimer).toBe(60); // 1 sec delay
    expect(engine.ghosts.INKY.inHouse).toBe(true);
    expect(engine.ghosts.INKY.houseTimer).toBe(180); // 3 sec delay
    expect(engine.ghosts.CLYDE.inHouse).toBe(true);
    expect(engine.ghosts.CLYDE.houseTimer).toBe(300); // 5 sec delay
  });

  it("should immediately discard active bonus fruit when Pac-Man dies and ensure it does not reappear after respawn", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 1);
    engine.playState = "PLAYING";

    // Spawn bonus fruit (as would happen at 70 dots)
    engine.spawnFruit();
    expect(engine.fruit).not.toBeNull();
    expect(engine.fruit?.active).toBe(true);

    // Place a non-frightened ghost on Pac-Man to trigger death
    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "CHASE";
    blinky.x = engine.pacman.x;
    blinky.y = engine.pacman.y;

    engine.update();

    // Pac-Man is dying
    expect(engine.playState).toBe("DYING");
    expect(engine.pacman.isDying).toBe(true);

    // In authentic arcade rules: the bonus fruit immediately vanishes upon death
    expect(engine.fruit).toBeNull();

    // Fast-forward death animation to trigger actor respawn (lives 3 -> 2)
    engine.pacman.deathProgress = 1.0;
    engine.update();

    // Now respawned into READY state
    expect(engine.playState).toBe("READY");
    expect(engine.lives).toBe(2);

    // Bonus fruit MUST NOT reappear after respawn
    expect(engine.fruit).toBeNull();

    // Advance through READY delay into PLAYING
    engine.readyTimer = 1;
    engine.update();
    expect(engine.playState).toBe("PLAYING");

    // Fruit is still null and treated as already consummated
    expect(engine.fruit).toBeNull();
  });

  it("should ensure fruit is not available when clicking Restart Level or Start New Game after fruit was active", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", 3);
    engine.playState = "PLAYING";

    // Fruit active in Level 3
    engine.spawnFruit();
    expect(engine.fruit?.active).toBe(true);

    // Player clicks "Restart Level"
    engine.restartLevel(3);
    expect(engine.fruit).toBeNull();
    expect(engine.level).toBe(3);
    expect(engine.playState).toBe("READY");

    // Player plays, fruit active again
    engine.playState = "PLAYING";
    engine.spawnFruit();
    expect(engine.fruit?.active).toBe(true);

    // Player loses all lives -> Game Over
    engine.lives = 1;
    const blinky = engine.ghosts.BLINKY;
    blinky.inHouse = false;
    blinky.mode = "CHASE";
    blinky.x = engine.pacman.x;
    blinky.y = engine.pacman.y;
    engine.update();
    engine.pacman.deathProgress = 1.0;
    engine.update();

    expect(engine.playState).toBe("GAME_OVER");
    expect(engine.fruit).toBeNull();

    // Player clicks "Start New Game"
    engine.initGame("PACMAN", 1);
    expect(engine.fruit).toBeNull();
    expect(engine.playState).toBe("READY");
    expect(engine.readyTimer).toBe(uiConfig.timings.readyBannerFrames);
  });
});
