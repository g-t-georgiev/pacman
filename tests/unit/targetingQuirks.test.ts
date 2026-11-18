import { describe, expect, it } from "vite-plus/test";
import { TILE_SIZE } from "../../src/game/constants";
import { getMazeData } from "../../src/game/mazes";
import { GhostAiController } from "../../src/controllers/GhostAiController";
import { Ghost } from "../../src/core/Ghost";
import { Pacman } from "../../src/core/Pacman";

describe("Layer 1 Unit Tests: Ghost Targeting & 1980 Z80 ROM Quirks", () => {
  const maze = getMazeData("PACMAN", 1);

  it("should calculate Pinky target 4 tiles forward when ROM quirks are disabled", () => {
    const ai = new GhostAiController(false);
    const pacman = new Pacman(14 * TILE_SIZE + 4, 20 * TILE_SIZE + 4, "UP");
    const pinky = new Ghost("PINKY", 14 * TILE_SIZE + 4, 14 * TILE_SIZE + 4, "UP", false);
    const blinky = new Ghost("BLINKY", 14 * TILE_SIZE + 4, 11 * TILE_SIZE + 4, "LEFT", false);
    pinky.wave = "CHASE";

    const target = ai.calculateTarget(pinky, pacman, blinky, maze)!;

    // Facing UP: col 14, row 16 (exactly 4 tiles UP, 0 tiles LEFT)
    expect(target.col).toBe(14);
    expect(target.row).toBe(16);
  });

  it("should emulate authentic 1980 Z80 bug for Pinky facing UP (4 tiles UP + 4 tiles LEFT)", () => {
    const ai = new GhostAiController(true); // emulateRomQuirks = true
    const pacman = new Pacman(14 * TILE_SIZE + 4, 20 * TILE_SIZE + 4, "UP");
    const pinky = new Ghost("PINKY", 14 * TILE_SIZE + 4, 14 * TILE_SIZE + 4, "UP", false);
    const blinky = new Ghost("BLINKY", 14 * TILE_SIZE + 4, 11 * TILE_SIZE + 4, "LEFT", false);
    pinky.wave = "CHASE";

    const target = ai.calculateTarget(pinky, pacman, blinky, maze)!;

    // Facing UP with 1980 ROM quirk: col 14 - 4 = 10, row 20 - 4 = 16
    expect(target.col).toBe(10);
    expect(target.row).toBe(16);
  });

  it("should emulate authentic 1980 Z80 bug for Inky facing UP (pivot shifted 2 UP + 2 LEFT)", () => {
    const aiNorm = new GhostAiController(false);
    const aiQuirk = new GhostAiController(true);

    const pacman = new Pacman(14 * TILE_SIZE + 4, 20 * TILE_SIZE + 4, "UP");
    const blinky = new Ghost("BLINKY", 14 * TILE_SIZE + 4, 24 * TILE_SIZE + 4, "UP", false);
    const inky = new Ghost("INKY", 12 * TILE_SIZE + 4, 14 * TILE_SIZE + 4, "UP", false);
    inky.wave = "CHASE";

    // Normalized: Pivot = (14, 18). Target = 2*(14, 18) - (14, 24) = (14, 12)
    const normTarget = aiNorm.calculateTarget(inky, pacman, blinky, maze)!;
    expect(normTarget.col).toBe(14);
    expect(normTarget.row).toBe(12);

    // Quirk: Pivot = (12, 18). Target = 2*(12, 18) - (14, 24) = (10, 12)
    const quirkTarget = aiQuirk.calculateTarget(inky, pacman, blinky, maze)!;
    expect(quirkTarget.col).toBe(10);
    expect(quirkTarget.row).toBe(12);
  });

  it("should make Clyde flee to bottom-left scatter corner when within 8 tiles of Pac-Man", () => {
    const ai = new GhostAiController(false);
    const pacman = new Pacman(5 * TILE_SIZE + 4, 26 * TILE_SIZE + 4, "LEFT");
    const clyde = new Ghost("CLYDE", 7 * TILE_SIZE + 4, 26 * TILE_SIZE + 4, "LEFT", false);
    const blinky = new Ghost("BLINKY", 20 * TILE_SIZE + 4, 5 * TILE_SIZE + 4, "LEFT", false);
    clyde.wave = "CHASE";

    // Distance is 2 tiles (< 8 tiles)
    const target = ai.calculateTarget(clyde, pacman, blinky, maze)!;

    // Should retreat to Clyde's scatter target (bottom-left corner)
    expect(target).toEqual(maze.scatterTargets.CLYDE);
  });
});
