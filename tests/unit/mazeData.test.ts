import { describe, expect, it } from "vite-plus/test";
import { getMazeData } from "../../src/game/mazes";
import type { GameMode, TileType } from "../../src/types";

/**
 * Data validation for the predefined mazes. The game code indexes maze tiles without guards, so
 * any malformed maze must fail here instead of at runtime.
 */
const MODES: GameMode[] = ["PACMAN", "MS_PACMAN"];
const TILE_TYPES: readonly TileType[] = [
  "EMPTY",
  "WALL",
  "DOT",
  "ENERGIZER",
  "GATE",
  "GHOST_HOUSE",
  "TUNNEL",
  "NO_UP_ZONE",
];

const count = (tiles: TileType[][], type: TileType) =>
  tiles.reduce((n, row) => n + row.filter((t) => t === type).length, 0);

describe.each(MODES)("Maze data: %s", (mode) => {
  const maze = getMazeData(mode, 1);

  it("is a full 28 x 36 grid", () => {
    expect(maze.width).toBe(28);
    expect(maze.height).toBe(36);
    expect(maze.tiles).toHaveLength(maze.height);
    for (const row of maze.tiles) expect(row).toHaveLength(maze.width);
  });

  it("uses only known tile types", () => {
    for (const row of maze.tiles) {
      for (const tile of row) expect(TILE_TYPES).toContain(tile);
    }
  });

  it("has 4 energizers and a ghost-house gate", () => {
    expect(count(maze.tiles, "ENERGIZER")).toBe(4);
    expect(count(maze.tiles, "GATE")).toBeGreaterThan(0);
  });

  it("has tunnels that open on both edges of their row", () => {
    expect(maze.tunnels.length).toBeGreaterThan(0);
    for (const t of maze.tunnels) {
      const row = maze.tiles[t.y];
      expect(row[0], `row ${t.y} left edge`).not.toBe("WALL");
      expect(row[maze.width - 1], `row ${t.y} right edge`).not.toBe("WALL");
    }
  });
});

describe("Maze data: PACMAN", () => {
  it("has the arcade's 240 dots", () => {
    expect(count(getMazeData("PACMAN", 1).tiles, "DOT")).toBe(240);
  });
});
