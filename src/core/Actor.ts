import type { Direction, MazeData, Point, TileCoord } from "../types";
import { TILE_SIZE } from "../game/constants";
import { getDirectionVector } from "../game/ghostAiUtils";

/**
 * Base Actor class for all moving entities in the game (Pac-Man & Ghosts).
 * Encapsulates spatial coordinates, anchor points, tile coordinates, and tunnel wrap mechanics.
 */
export class Actor {
  public x: number = 0;
  public y: number = 0;
  public dir: Direction = "NONE";
  public nextDir: Direction = "NONE";
  public speed: number = 0;

  /**
   * Spatial anchor point inside the actor's footprint [0, 1].
   * Defaults to 0.5 on both axes (center of tile).
   */
  public anchorX: number = 0.5;
  public anchorY: number = 0.5;

  constructor(
    x: number,
    y: number,
    dir: Direction = "NONE",
    anchorX: number = 0.5,
    anchorY: number = 0.5
  ) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.nextDir = dir;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
  }

  /**
   * Returns current anchor point in absolute world pixel coordinates.
   */
  public get anchorPixel(): Point {
    return {
      x: this.x + (this.anchorX - 0.5) * TILE_SIZE,
      y: this.y + (this.anchorY - 0.5) * TILE_SIZE,
    };
  }

  /**
   * Returns current tile coordinate calculated from the anchor point.
   */
  public get tileCoord(): TileCoord {
    const { x, y } = this.anchorPixel;
    return {
      col: Math.floor(x / TILE_SIZE),
      row: Math.floor(y / TILE_SIZE),
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
   * Checks whether the actor's anchor point is aligned with the center of its current tile.
   */
  public isAtTileCenter(tolerance: number = 0.5): boolean {
    const { col, row } = this.tileCoord;
    const center = Actor.getTileCenter(col, row);
    return Math.abs(this.x - center.x) <= tolerance && Math.abs(this.y - center.y) <= tolerance;
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
