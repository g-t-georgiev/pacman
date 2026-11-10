import type { Direction, MazeData, Point, TileCoord } from "../types";
import { TILE_SIZE } from "../game/constants";
import { getDirectionVector } from "../game/ghostAiUtils";

/**
 * Base Actor class for all moving entities in the game (Pac-Man & Ghosts).
 * Positions are sim pixels of the actor's center; its tile is the one that pixel is in.
 */
export class Actor {
  public x: number = 0;
  public y: number = 0;
  public dir: Direction = "NONE";
  public nextDir: Direction = "NONE";
  /** Pixels moved this frame (set by the movement code). */
  public speed: number = 0;

  constructor(x: number, y: number, dir: Direction = "NONE") {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.nextDir = dir;
  }

  /** The tile the actor is in: the one its center pixel is in. */
  public get tileCoord(): TileCoord {
    return {
      col: Math.floor(this.x / TILE_SIZE),
      row: Math.floor(this.y / TILE_SIZE),
    };
  }

  /**
   * Calculates center pixel coordinates for a given tile.
   */
  public static getTileCenter(col: number, row: number): Point {
    return {
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: row * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  /**
   * Snaps the actor to the perpendicular axis of its current tile center.
   * Ensures clean turns into perpendicular corridors without drifting off-track.
   */
  public snapToAxis(dir: Direction): void {
    const { col, row } = this.tileCoord;
    const center = Actor.getTileCenter(col, row);
    if (dir === "UP" || dir === "DOWN") {
      this.x = center.x;
    } else if (dir === "LEFT" || dir === "RIGHT") {
      this.y = center.y;
    }
  }

  /**
   * Wraps around the maze tunnels horizontally.
   */
  public handleTunnelWrap(maze: MazeData): void {
    const half = TILE_SIZE / 2;
    const curRow = Math.floor(this.y / TILE_SIZE);
    const inTunnel = maze.tunnels.some((t) => t.y === curRow);
    if (!inTunnel) return;

    if (this.x < -half) {
      this.x = maze.width * TILE_SIZE + half - 1;
    } else if (this.x > maze.width * TILE_SIZE + half) {
      this.x = -half + 1;
    }
  }

  /**
   * Verifies if a prospective step is walkable on the maze grid.
   */
  public canMoveInDirection(
    dir: Direction,
    maze: MazeData,
    checkDist: number = TILE_SIZE / 2 + 1
  ): boolean {
    const { dx, dy } = getDirectionVector(dir);
    const probeX = this.x + dx * checkDist;
    const probeY = this.y + dy * checkDist;

    const col = Math.floor(probeX / TILE_SIZE);
    const row = Math.floor(probeY / TILE_SIZE);

    if (row < 0 || row >= maze.height) return false;

    // Tunnel bounds
    if (col < 0 || col >= maze.width) {
      return maze.tunnels.some((t) => t.y === row);
    }

    const tile = maze.tiles[row][col];
    return tile !== "WALL" && tile !== "GATE" && tile !== "GHOST_HOUSE";
  }
}
