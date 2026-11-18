import { describe, expect, it } from "vite-plus/test";
import { getMazeData } from "../../src/game/mazes";
import {
  corridorTiles,
  deriveIntersections,
  isTunnelSlowZone,
  validateMaze,
} from "../../src/game/mazeAnalysis";
import type { GameMode, MazeData } from "../../src/types";

const key = (t: { col: number; row: number }) => `${t.col},${t.row}`;
const MODES: GameMode[] = ["PACMAN", "MS_PACMAN"];

/**
 * The classic Pac-Man intersections, as hand-listed before A4 (col,row). These are the arcade
 * maze's decision tiles; the derived set must equal them exactly.
 */
// prettier-ignore
const CLASSIC_PACMAN_INTERSECTIONS = [
  "6,4", "21,4",
  "1,8", "6,8", "9,8", "12,8", "15,8", "18,8", "21,8", "26,8",
  "6,11", "21,11",
  "12,14", "15,14",
  "6,17", "9,17", "18,17", "21,17",
  "9,20", "18,20",
  "6,23", "9,23", "18,23", "21,23",
  "6,26", "9,26", "12,26", "15,26", "18,26", "21,26",
  "3,29", "24,29",
  "12,32", "15,32",
];

/** A fresh copy of a maze to break on purpose. */
function copy(mode: GameMode): MazeData {
  const maze = getMazeData(mode, 1);
  return { ...maze, tiles: maze.tiles.map((row) => [...row]) };
}

describe("Maze analysis (A4)", () => {
  it.each(MODES)("%s: the maze is valid", (mode) => {
    expect(validateMaze(getMazeData(mode, 1))).toEqual([]);
  });

  it("corridors are only what Pac-Man can reach (no dead rows, no outside areas)", () => {
    const corridors = corridorTiles(getMazeData("PACMAN", 1));
    expect(corridors.has("13,0")).toBe(false); // blank row above the maze
    expect(corridors.has("1,14")).toBe(false); // outside the walls beside the tunnel
    expect(corridors.has("0,17")).toBe(true); // the tunnel itself
    expect(corridors.has("1,4")).toBe(true);
  });

  it("Pac-Man's derived intersections are exactly the classic arcade ones", () => {
    const derived = deriveIntersections(getMazeData("PACMAN", 1)).map(key).sort();
    expect(derived).toEqual([...CLASSIC_PACMAN_INTERSECTIONS].sort());
  });

  it("Ms. Pac-Man's include the two junctions her old list missed", () => {
    const derived = deriveIntersections(getMazeData("MS_PACMAN", 1)).map(key);
    expect(derived).toHaveLength(42);
    expect(derived).toEqual(expect.arrayContaining(["1,20", "26,20"]));
  });

  it("every maze carries its derived intersections", () => {
    for (const mode of MODES) {
      const maze = getMazeData(mode, 1);
      expect(maze.intersections).toEqual(deriveIntersections(maze));
    }
  });

  it("the tunnel slow zone is the 6 tiles at each end of a tunnel row", () => {
    const maze = getMazeData("PACMAN", 1);
    expect(isTunnelSlowZone(maze, 0, 17)).toBe(true);
    expect(isTunnelSlowZone(maze, 5, 17)).toBe(true);
    expect(isTunnelSlowZone(maze, 6, 17)).toBe(false);
    expect(isTunnelSlowZone(maze, 22, 17)).toBe(true);
    expect(isTunnelSlowZone(maze, 21, 17)).toBe(false);
    expect(isTunnelSlowZone(maze, 2, 8)).toBe(false); // not a tunnel row
  });
});

describe("Maze validator catches broken mazes", () => {
  it("a dot walled in", () => {
    const maze = copy("PACMAN");
    // Wall off (1,4): the top-left corner dot's two neighbors
    maze.tiles[4][2] = "WALL";
    maze.tiles[5][1] = "WALL";
    expect(validateMaze(maze)).toEqual(expect.arrayContaining(["unreachable dot at (1, 4)"]));
  });

  it("a dead end", () => {
    const maze = copy("PACMAN");
    maze.tiles[4][3] = "WALL"; // cuts the top-left corridor: (1..2, 4) becomes a dead end
    expect(validateMaze(maze).some((p) => p.startsWith("dead end"))).toBe(true);
  });

  it("a tunnel closed at one end", () => {
    const maze = copy("PACMAN");
    maze.tiles[17][0] = "WALL";
    expect(validateMaze(maze)).toEqual(
      expect.arrayContaining(["tunnel row 17 is not open at both edges"])
    );
  });

  it("a no-up tile inside a wall", () => {
    const maze = copy("PACMAN");
    maze.specialNoUpTiles = [{ col: 0, row: 0 }];
    expect(validateMaze(maze)).toEqual(
      expect.arrayContaining(["no-up tile (0, 0) is not a corridor"])
    );
  });
});
