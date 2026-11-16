import { describe, expect, it } from "vite-plus/test";
import { DIRECTION_CODE_COUNTS, PRNG, PRNG_DIRECTIONS, PRNG_PERIOD } from "../../src/core/PRNG";
import { pickFrightenedDirection } from "../../src/game/ghostAiUtils";
import { GhostAiController } from "../../src/controllers/GhostAiController";
import { Ghost } from "../../src/core/Ghost";
import { Pacman } from "../../src/core/Pacman";
import { getMazeData } from "../../src/game/mazes";
import { TILE_SIZE } from "../../src/game/constants";
import type { Direction } from "../../src/types";
import GameEngine from "../../src/game/GameEngine";

/** A PRNG whose next() returns the given direction code. */
function prngThatRolls(code: number): PRNG {
  const prng = new PRNG();
  for (let s = 0; s < PRNG_PERIOD; s++) {
    prng.state = s;
    if (prng.next() === code) {
      prng.state = s;
      return prng;
    }
  }
  throw new Error(`no index yields ${code}`);
}

describe("Frightened PRNG (arcade shape)", () => {
  it("steps its index as index * 5 + 1 over 13 bits: 0, 1, 6, 31, ..., 7544, 4953", () => {
    const prng = new PRNG();
    const indices = [prng.state];
    for (let i = 0; i < 9; i++) {
      prng.next();
      indices.push(prng.state);
    }
    expect(indices).toEqual([0, 1, 6, 31, 156, 781, 3906, 3147, 7544, 4953]);
  });

  it("visits all 8192 indices before repeating, ending on 4915", () => {
    const prng = new PRNG();
    const seen = new Set<number>();
    for (let i = 0; i < PRNG_PERIOD - 1; i++) {
      prng.next();
      seen.add(prng.state);
    }
    expect(prng.state).toBe(4915);
    prng.next();
    expect(prng.state).toBe(0);
    seen.add(0);
    expect(seen.size).toBe(PRNG_PERIOD);
  });

  it("reproduces the measured direction distribution over one full period", () => {
    const counts = [0, 0, 0, 0];
    const prng = new PRNG();
    for (let i = 0; i < PRNG_PERIOD; i++) counts[prng.next()]++;
    expect(counts).toEqual([...DIRECTION_CODE_COUNTS]);
    expect(counts[3] / PRNG_PERIOD).toBeCloseTo(0.163, 2); // up
    expect(counts[2] / PRNG_PERIOD).toBeCloseTo(0.299, 2); // left
    expect((counts[0] + counts[1]) / PRNG_PERIOD).toBeCloseTo(0.537, 2); // right + down
  });

  it("maps codes clockwise from right: 0 right, 1 down, 2 left, 3 up", () => {
    expect([...PRNG_DIRECTIONS]).toEqual(["RIGHT", "DOWN", "LEFT", "UP"]);
  });
});

describe("Frightened direction choice", () => {
  const open =
    (...dirs: Direction[]) =>
    (d: Direction) =>
      dirs.includes(d);

  it("takes the rolled direction when it is open", () => {
    expect(pickFrightenedDirection(2, "LEFT", open("LEFT", "DOWN"))).toBe("LEFT");
  });

  it("falls back clockwise, skipping walls and the reverse (the RGME example)", () => {
    // Moving left into a tile open left and down. Up is a wall, right is the reverse.
    const moving = "LEFT";
    const exits = open("LEFT", "DOWN");
    expect(pickFrightenedDirection(3, moving, exits)).toBe("DOWN"); // up -> right -> down
    expect(pickFrightenedDirection(0, moving, exits)).toBe("DOWN"); // right -> down
    expect(pickFrightenedDirection(1, moving, exits)).toBe("DOWN");
    expect(pickFrightenedDirection(2, moving, exits)).toBe("LEFT");
  });

  it("never reverses", () => {
    for (let code = 0; code < 4; code++) {
      expect(pickFrightenedDirection(code, "UP", open("DOWN", "LEFT"))).toBe("LEFT");
    }
  });

  it("ignores no-up zones while frightened (F16)", () => {
    // (12, 14) is a no-up tile above the ghost house. A frightened ghost entering it from the
    // right and rolling UP goes up; a chasing ghost could not.
    const maze = getMazeData("PACMAN", 1);
    const ai = new GhostAiController(false, prngThatRolls(3));
    const ghost = new Ghost(
      "BLINKY",
      13 * TILE_SIZE + TILE_SIZE / 2,
      14 * TILE_SIZE + TILE_SIZE / 2,
      "LEFT"
    );
    ghost.frightened = true;
    const pacman = new Pacman(1 * TILE_SIZE + 4, 4 * TILE_SIZE + 4, "LEFT");

    const planned = ai.planNextTile(ghost, pacman, ghost, maze, 13, 14, ghost.dir);
    expect(planned).toBe("UP");
  });

  it("advances the PRNG on corridor tiles too", () => {
    const maze = getMazeData("PACMAN", 1);
    const prng = new PRNG();
    const ai = new GhostAiController(false, prng);
    // Row 8, moving right from col 2 to col 3: a plain corridor tile
    const ghost = new Ghost("BLINKY", 2 * TILE_SIZE + 4, 8 * TILE_SIZE + 4, "RIGHT");
    ghost.frightened = true;
    const pacman = new Pacman(1 * TILE_SIZE + 4, 4 * TILE_SIZE + 4, "LEFT");

    const planned = ai.planNextTile(ghost, pacman, ghost, maze, 2, 8, ghost.dir);
    expect(prng.state).toBe(1);
    expect(planned).toBe("RIGHT"); // the only way on
  });
});

describe("Frightened ghosts have no target (F18)", () => {
  it("calculateTarget returns null, and the engine's ghosts drop their target on the next tile", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.playState = "PLAYING";
    const blinky = engine.ghosts.BLINKY;
    engine.triggerFrightenedMode();
    const pacman = engine.pacman;
    expect(
      engine.ghostAiController.calculateTarget(blinky, pacman, blinky, engine.maze)
    ).toBeNull();
    for (let f = 0; f < 30; f++) engine.update();
    expect(blinky.target).toBeNull();
  });
});

describe("ROM quirks (F15)", () => {
  it("are on by default, as in the arcade", () => {
    const engine = new GameEngine("PACMAN", 0);
    expect(engine.settings.emulateRomQuirks).toBe(true);
    expect(engine.ghostAiController.emulateRomQuirks).toBe(true);
  });
});
