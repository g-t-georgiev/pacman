import { describe, expect, it } from "vite-plus/test";
import { Pacman } from "../../src/core/Pacman";
import { MovementController } from "../../src/controllers/MovementController";
import { getMazeData } from "../../src/game/mazes";
import { TILE_SIZE } from "../../src/game/constants";
import type { Direction } from "../../src/types";

/**
 * Arcade cornering (Dossier, "Cornering"). Row 8 of the classic maze is an open corridor, and
 * column 6 is open both above and below it, so (6, 8) is a 4-way intersection.
 */
const maze = getMazeData("PACMAN", 1);
const movement = new MovementController();
const ROW = 8;
const COL = 6;
const cx = COL * TILE_SIZE + TILE_SIZE / 2; // turn center x
const cy = ROW * TILE_SIZE + TILE_SIZE / 2; // corridor centerline y

/** One frame at 80%, which is exactly 1 px per frame. */
const frame = (p: Pacman) => movement.updatePacmanMovement(p, 0, 80, 1.0, maze);

/** Starts on row 8 at x, moving horizontally, with `turn` already buffered. */
function approach(x: number, dir: Direction, turn: Direction): Pacman {
  const p = new Pacman(x, cy, dir);
  p.setRequestedDirection(turn);
  return p;
}

describe("Pac-Man cornering", () => {
  it("the turn window spans 8 px: 3 below and 4 above the center pixel", () => {
    for (let v = cx - 3; v <= cx + 4; v++) expect(Pacman.turnCenter(v)).toBe(cx);
    expect(Pacman.turnCenter(cx - 4)).toBe(cx - TILE_SIZE);
    expect(Pacman.turnCenter(cx + 5)).toBe(cx + TILE_SIZE);
  });

  it("entering from the left, the earliest pre-turn is 3 px before center", () => {
    const p = approach(cx - 6, "RIGHT", "UP");
    frame(p); // tries at cx-6: outside the window, moves to cx-5
    frame(p); // cx-4
    expect(p.dir).toBe("RIGHT");
    frame(p); // tries at cx-4: still outside, moves to cx-3
    frame(p); // tries at cx-3: turns, then moves 1 up and 1 toward the lane
    expect(p.dir).toBe("UP");
    expect(p.x).toBe(cx - 2);
    expect(p.y).toBe(cy - 1);
  });

  it("entering from the right, the earliest pre-turn is 4 px before center", () => {
    const p = approach(cx + 5, "LEFT", "UP");
    frame(p); // tries at cx+5: outside, moves to cx+4
    expect(p.dir).toBe("LEFT");
    frame(p); // tries at cx+4: turns
    expect(p.dir).toBe("UP");
    expect(p.x).toBe(cx + 3);
    expect(p.y).toBe(cy - 1);
  });

  it("moves diagonally, 1 px per px traveled, until it reaches the new lane", () => {
    const p = approach(cx - 3, "RIGHT", "DOWN");
    const path: Array<[number, number]> = [];
    for (let i = 0; i < 5; i++) {
      frame(p);
      path.push([p.x - cx, p.y - cy]);
    }
    expect(path).toEqual([
      [-2, 1],
      [-1, 2],
      [0, 3],
      [0, 4],
      [0, 5],
    ]);
    expect(p.cornerTarget).toBeNull();
  });

  it("allows post-turns up to 4 px past center entering from the left", () => {
    const late = approach(cx + 4, "RIGHT", "UP");
    frame(late);
    expect(late.dir).toBe("UP");
    expect(late.x).toBe(cx + 3); // easing back toward the lane

    const tooLate = approach(cx + 5, "RIGHT", "UP");
    frame(tooLate);
    expect(tooLate.dir).toBe("RIGHT"); // column 7 is a wall above row 8
  });

  it("each pixel of lateness costs one frame", () => {
    /** Frames from cx-6 until Pac-Man is 6 px up the column, pressing UP when x reaches turnAt. */
    const framesToClimb = (turnAt: number) => {
      const p = new Pacman(cx - 6, cy, "RIGHT");
      let n = 0;
      while (p.y > cy - 6 || p.x !== cx) {
        if (p.x === turnAt && p.dir === "RIGHT") p.setRequestedDirection("UP");
        frame(p);
        n++;
      }
      return n;
    };
    const earliest = framesToClimb(cx - 3);
    expect(framesToClimb(cx - 2)).toBe(earliest + 1);
    expect(framesToClimb(cx)).toBe(earliest + 3);
    expect(framesToClimb(cx + 2)).toBe(earliest + 5);
  });

  it("never turns into a wall, and stops on the lane center when blocked", () => {
    const p = approach(cx + 1, "RIGHT", "UP");
    p.x = (COL + 1) * TILE_SIZE + TILE_SIZE / 2 - 1; // window of column 7: wall above
    frame(p);
    expect(p.dir).toBe("RIGHT");
  });

  it("does not skip the earliest pre-turn pixel on 2-pixel frames", () => {
    // 100%: frames 3, 7, 11, 15 of the cycle move 2 px. Start so a 2-px frame crosses cx-4 -> cx-2.
    const p = new Pacman(cx - 5, cy, "RIGHT");
    p.setRequestedDirection("UP");
    movement.updatePacmanMovement(p, 2, 100, 1.0, maze); // 1 px: cx-4
    movement.updatePacmanMovement(p, 3, 100, 1.0, maze); // 2 px: turn checked at cx-4, then cx-3
    expect(p.dir).toBe("UP");
    expect(p.x).toBe(cx - 2);
    expect(p.y).toBe(cy - 1);
  });
});
