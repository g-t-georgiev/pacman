import { describe, expect, it } from "vite-plus/test";
import { Ghost } from "../../src/core/Ghost";
import GameEngine from "../../src/game/GameEngine";
import {
  HouseController,
  getHouseDotLimit,
  getHouseIdleLimit,
} from "../../src/controllers/HouseController";
import { HOUSE_EXIT_Y } from "../../src/controllers/MovementController";
import type { GhostType } from "../../src/types";

/** Blinky outside, the other three waiting inside. */
function houseGhosts(): Record<GhostType, Ghost> {
  return {
    BLINKY: new Ghost("BLINKY", 0, 0, "LEFT", false),
    PINKY: new Ghost("PINKY", 0, 0, "UP", true),
    INKY: new Ghost("INKY", 0, 0, "UP", true),
    CLYDE: new Ghost("CLYDE", 0, 0, "UP", true),
  };
}

/** Eats one dot and runs one frame. */
function eatDot(house: HouseController, ghosts: Record<GhostType, Ghost>, level: number) {
  house.onDotEaten(ghosts);
  house.update(ghosts, level);
}

const waiting = (ghosts: Record<GhostType, Ghost>) =>
  (["PINKY", "INKY", "CLYDE"] as const).filter((t) => ghosts[t].location === "HOUSE");

describe("House release: personal dot counters (Dossier, Home Sweet Home)", () => {
  it("has the Dossier's dot limits and idle limits", () => {
    expect([1, 2, 3, 9].map((l) => getHouseDotLimit("PINKY", l))).toEqual([0, 0, 0, 0]);
    expect([1, 2, 3, 9].map((l) => getHouseDotLimit("INKY", l))).toEqual([30, 0, 0, 0]);
    expect([1, 2, 3, 9].map((l) => getHouseDotLimit("CLYDE", l))).toEqual([60, 50, 0, 0]);
    expect(getHouseIdleLimit(4)).toBe(240);
    expect(getHouseIdleLimit(5)).toBe(180);
  });

  it("level 1: Pinky leaves at once, Inky after 30 dots, then Clyde after 60 more", () => {
    const house = new HouseController();
    const ghosts = houseGhosts();

    house.update(ghosts, 1);
    expect(ghosts.PINKY.location).toBe("LEAVING");
    expect(waiting(ghosts)).toEqual(["INKY", "CLYDE"]);

    for (let i = 0; i < 29; i++) eatDot(house, ghosts, 1);
    expect(ghosts.INKY.location).toBe("HOUSE");
    eatDot(house, ghosts, 1);
    expect(ghosts.INKY.location).toBe("LEAVING");

    // Only the preferred ghost counts: Clyde's counter started from zero when Inky left
    expect(house.state.dotCounters.CLYDE).toBe(0);
    for (let i = 0; i < 59; i++) eatDot(house, ghosts, 1);
    expect(ghosts.CLYDE.location).toBe("HOUSE");
    eatDot(house, ghosts, 1);
    expect(ghosts.CLYDE.location).toBe("LEAVING");
  });

  it("level 2: Pinky and Inky leave at once, Clyde after 50 dots", () => {
    const house = new HouseController();
    const ghosts = houseGhosts();
    house.update(ghosts, 2);
    house.update(ghosts, 2);
    expect(waiting(ghosts)).toEqual(["CLYDE"]);
    for (let i = 0; i < 50; i++) eatDot(house, ghosts, 2);
    expect(waiting(ghosts)).toEqual([]);
  });

  it("Blinky never waits: revived in the house, he leaves at once", () => {
    const house = new HouseController();
    const ghosts = houseGhosts();
    ghosts.BLINKY.location = "HOUSE";
    house.update(ghosts, 1);
    expect(ghosts.BLINKY.location).toBe("LEAVING");
  });
});

describe("House release: global dot counter after a life is lost", () => {
  it("releases Pinky at 7 and Inky at 17, then hands back to personal counters at 32", () => {
    const house = new HouseController();
    const ghosts = houseGhosts();
    house.state.dotCounters.CLYDE = 40; // kept from before the death (not reset)
    house.onLifeLost();

    for (let i = 0; i < 6; i++) eatDot(house, ghosts, 1);
    expect(ghosts.PINKY.location).toBe("HOUSE");
    eatDot(house, ghosts, 1); // 7
    expect(ghosts.PINKY.location).toBe("LEAVING");

    for (let i = 7; i < 16; i++) eatDot(house, ghosts, 1);
    expect(ghosts.INKY.location).toBe("HOUSE");
    eatDot(house, ghosts, 1); // 17
    expect(ghosts.INKY.location).toBe("LEAVING");

    for (let i = 17; i < 32; i++) eatDot(house, ghosts, 1); // 32 with Clyde inside
    expect(house.state.globalCounterActive).toBe(false);
    expect(ghosts.CLYDE.location).toBe("HOUSE");

    // Back on Clyde's personal counter, which kept its 40: 20 more dots release him
    for (let i = 0; i < 19; i++) eatDot(house, ghosts, 1);
    expect(ghosts.CLYDE.location).toBe("HOUSE");
    eatDot(house, ghosts, 1);
    expect(ghosts.CLYDE.location).toBe("LEAVING");
  });

  it("reproduces the ghost-house trick: with Clyde out at 32, the counter never hands back", () => {
    const house = new HouseController();
    const ghosts = houseGhosts();
    house.onLifeLost();
    ghosts.CLYDE.location = "ACTIVE"; // forced out early by the idle timer

    for (let i = 0; i < 40; i++) eatDot(house, ghosts, 1);
    expect(house.state.globalCounterActive).toBe(true);
    expect(house.state.globalCounter).toBe(40);

    // Ghosts eaten later come home and stay: the counter is past 7, 17 and 32
    ghosts.PINKY.location = "HOUSE";
    ghosts.INKY.location = "HOUSE";
    for (let i = 0; i < 20; i++) eatDot(house, ghosts, 1);
    expect(waiting(ghosts)).toEqual(["PINKY", "INKY"]);
  });
});

describe("House release: idle timer", () => {
  it("forces the preferred ghost out after 4 s without a dot, and a dot resets the timer", () => {
    const house = new HouseController();
    const ghosts = houseGhosts();
    ghosts.PINKY.location = "ACTIVE";

    for (let f = 0; f < 239; f++) house.update(ghosts, 1);
    eatDot(house, ghosts, 1); // timer back to 0 (after this frame: 1)
    for (let f = 0; f < 238; f++) house.update(ghosts, 1);
    expect(ghosts.INKY.location).toBe("HOUSE");
    house.update(ghosts, 1);
    expect(ghosts.INKY.location).toBe("LEAVING");
    expect(ghosts.CLYDE.location).toBe("HOUSE");
  });

  it("uses 3 s from level 5", () => {
    const house = new HouseController();
    const ghosts = houseGhosts();
    house.onLifeLost(); // global counter: nobody leaves on dot limits until 7 dots
    for (let f = 0; f < 179; f++) house.update(ghosts, 5);
    expect(ghosts.PINKY.location).toBe("HOUSE");
    house.update(ghosts, 5);
    expect(ghosts.PINKY.location).toBe("LEAVING");
  });
});

/** Releases Inky by hand (kept out of line so TypeScript does not narrow `location`). */
function releaseInky(engine: GameEngine): void {
  engine.ghosts.INKY.location = "LEAVING";
}
const pinky0 = (engine: GameEngine) => engine.ghosts.PINKY;

describe("Ghost state machine in the engine", () => {
  function playing(level = 1): GameEngine {
    const engine = new GameEngine("PACMAN", 0);
    engine.initGame("PACMAN", level);
    engine.playState = "PLAYING";
    return engine;
  }

  it("a released ghost walks out of the door and turns left", () => {
    const engine = playing();
    const pinky = engine.ghosts.PINKY;
    for (let f = 0; f < 200 && pinky.location !== "ACTIVE"; f++) engine.update();
    expect(pinky.location).toBe("ACTIVE");
    expect(pinky.y).toBe(HOUSE_EXIT_Y);
    expect(pinky.dir).toBe("LEFT");
  });

  it("a ghost inside during a mode change leaves left, then reverses at its next tile (F7)", () => {
    const engine = playing();
    const pinky = engine.ghosts.PINKY;
    // Switch scatter -> chase on the very next frame, while Pinky is still inside
    engine.timerController.waveTimer = engine.timerController.currentWave!.frames - 1;
    for (let f = 0; f < 200 && pinky.location !== "ACTIVE"; f++) engine.update();
    expect(pinky.wave).toBe("CHASE");
    expect(pinky.dir).toBe("LEFT");
    expect(pinky.reversalPrimed).toBe(true);

    // The door is on the col 13/14 seam: the col 13 center is 4 px to the left
    const exitX = pinky.x;
    for (let f = 0; f < 30 && pinky.reversalPrimed; f++) engine.update();
    expect(pinky.reversalPrimed).toBe(false);
    expect(pinky.dir).toBe("RIGHT");
    expect(exitX - Math.min(pinky.x, exitX)).toBeLessThanOrEqual(4);
  });

  it("without a mode change, a ghost leaves left and keeps going", () => {
    const engine = playing();
    const pinky = engine.ghosts.PINKY;
    for (let f = 0; f < 200 && pinky.location !== "ACTIVE"; f++) engine.update();
    expect(pinky.reversalPrimed).toBe(false);
    for (let f = 0; f < 10; f++) engine.update();
    expect(pinky.dir).not.toBe("RIGHT"); // no reversal (it may turn at a junction)
  });

  it("ghosts in the house turn blue too, and stay blue after leaving (F8)", () => {
    const engine = playing();
    const inky = engine.ghosts.INKY;
    engine.triggerFrightenedMode();
    expect(inky.location).toBe("HOUSE");
    expect(inky.mode).toBe("FRIGHTENED");

    engine.houseController.update(engine.ghosts, 1); // Pinky out
    pinky0(engine).location = "ACTIVE";
    releaseInky(engine);
    for (let f = 0; f < 200 && inky.location !== "ACTIVE"; f++) engine.update();
    expect(inky.location).toBe("ACTIVE");
    expect(inky.frightened).toBe(true);
  });

  it("frightened ends for every ghost at once, back to the global wave", () => {
    const engine = playing();
    engine.triggerFrightenedMode();
    engine.frightenedGlobalTimer = 1;
    engine.update();
    for (const g of Object.values(engine.ghosts)) {
      expect(g.frightened).toBe(false);
      expect(g.mode).toBe(engine.timerController.currentWave!.mode);
    }
  });

  it("Elroy Blinky still reverses on a scatter/chase switch (F12)", () => {
    const engine = playing();
    engine.dotsRemaining = 10;
    const blinky = engine.ghosts.BLINKY;
    // 3 px right of a tile center, moving left: no center is crossed this frame
    blinky.x = 13 * 8 + 4 + 3;
    blinky.dir = "LEFT";
    blinky.nextDir = "LEFT";
    engine.timerController.waveTimer = engine.timerController.currentWave!.frames - 1;
    engine.update();
    expect(blinky.wave).toBe("CHASE");
    expect(blinky.reversalPrimed).toBe(true);
  });

  it("only active ghosts can catch Pac-Man", () => {
    const engine = playing();
    const pinky = engine.ghosts.PINKY;
    engine.pacman.x = pinky.x;
    engine.pacman.y = pinky.y;
    engine.update();
    expect(engine.playState).toBe("PLAYING");
  });

  it("losing a life switches the house to the global counter", () => {
    const engine = playing();
    const blinky = engine.ghosts.BLINKY;
    engine.pacman.x = blinky.x;
    engine.pacman.y = blinky.y;
    engine.update();
    expect(engine.playState).toBe("DYING");
    for (let f = 0; f < 400 && engine.playState === "DYING"; f++) engine.update();
    expect(engine.houseController.state.globalCounterActive).toBe(true);
    expect(engine.houseController.state.globalCounter).toBe(0);
  });
});
