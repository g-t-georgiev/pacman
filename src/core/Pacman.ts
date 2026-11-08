import { Actor } from "./Actor";
import type { Direction, LevelSpeedConfig, MazeData, PacmanState } from "../types";
import { CORNER_WINDOW_LOW, TILE_SIZE } from "../game/constants";
import { getDirectionVector, getOppositeDirection } from "../game/ghostAiUtils";
import { getSpeedConfigForLevel } from "../utils";

/**
 * Pac-Man Actor specialized with player input buffering, responsive cornering,
 * immediate 180-degree directional reversal, and chomp animation properties.
 */
export class Pacman extends Actor {
  public mouthAngle: number = 0.2;
  public mouthOpening: boolean = true;
  public isDying: boolean = false;
  public deathProgress: number = 0;
  public invincible: boolean = false;
  public eatingFreezeFrames: number = 0;
  /**
   * During a pre- or post-turn, the coordinate on the old axis (x for a vertical turn, y for a
   * horizontal one) that Pac-Man is easing onto, 1 px per px traveled. Null when on-axis.
   */
  public cornerTarget: number | null = null;

  constructor(x: number, y: number, dir: Direction = "LEFT") {
    super(x, y, dir, 0.5, 0.5);
  }

  /**
   * Sets player input direction.
   * If input is exactly 180° opposite to current movement, Pac-Man reverses immediately mid-tile!
   */
  public setRequestedDirection(dir: Direction): void {
    this.nextDir = dir;
    if (getOppositeDirection(this.dir) === dir) {
      this.dir = dir;
    }
  }

  /**
   * Tries to turn into the buffered direction (arcade cornering, Dossier "Cornering").
   *
   * The turn is allowed anywhere inside the turn window around the center of the tile
   * Pac-Man is passing (see CORNER_WINDOW_LOW / CORNER_WINDOW_HIGH), as long as that tile is open
   * in the new direction. Pac-Man does not snap: he keeps his position and eases onto the new
   * lane diagonally while moving (see stepOnePixel).
   */
  public tryTurn(maze: MazeData): boolean {
    if (this.nextDir === this.dir || this.nextDir === "NONE") return false;

    const vertical = this.nextDir === "UP" || this.nextDir === "DOWN";
    // Coordinate on the axis being left, and the turn center whose window contains it.
    const along = vertical ? this.x : this.y;
    const center = Pacman.turnCenter(along);
    // Lane Pac-Man currently travels on (his target lane if he is still finishing a turn).
    const across = this.cornerTarget ?? (vertical ? this.y : this.x);

    const turnCol = Math.floor((vertical ? center : across) / TILE_SIZE);
    const turnRow = Math.floor((vertical ? across : center) / TILE_SIZE);
    const { dx, dy } = getDirectionVector(this.nextDir);
    if (!Pacman.isOpen(turnCol + dx, turnRow + dy, maze)) return false;

    // Finish any turn in progress on the other axis first, then start this one.
    if (this.cornerTarget !== null) {
      if (vertical) this.y = this.cornerTarget;
      else this.x = this.cornerTarget;
    }
    this.dir = this.nextDir;
    this.cornerTarget = along === center ? null : center;
    return true;
  }

  /** Center pixel of the turn whose window contains coordinate `v`. */
  public static turnCenter(v: number): number {
    const half = TILE_SIZE / 2;
    const col = Math.floor((v - half + CORNER_WINDOW_LOW) / TILE_SIZE);
    return col * TILE_SIZE + half;
  }

  /** Whether Pac-Man may occupy a tile. Off-grid columns are open only on tunnel rows. */
  public static isOpen(col: number, row: number, maze: MazeData): boolean {
    if (row < 0 || row >= maze.height) return false;
    if (col < 0 || col >= maze.width) return maze.tunnels.some((t) => t.y === row);
    const tile = maze.tiles[row][col];
    return tile !== "WALL" && tile !== "GATE" && tile !== "GHOST_HOUSE";
  }

  /**
   * Moves one pixel in the current direction, plus one pixel toward the lane while cornering.
   *
   * @returns false (without moving) when a wall blocks the way.
   */
  public stepOnePixel(maze: MazeData): boolean {
    const { dx, dy } = getDirectionVector(this.dir);
    const vertical = dy !== 0;
    // Probe from the lane Pac-Man is heading onto, half a tile + 1 px ahead.
    const laneX = vertical ? (this.cornerTarget ?? this.x) : this.x;
    const laneY = vertical ? this.y : (this.cornerTarget ?? this.y);
    const reach = TILE_SIZE / 2 + 1;
    const probeCol = Math.floor((laneX + dx * reach) / TILE_SIZE);
    const probeRow = Math.floor((laneY + dy * reach) / TILE_SIZE);

    if (!Pacman.isOpen(probeCol, probeRow, maze)) {
      // Blocked: settle onto the lane center and stop.
      if (this.cornerTarget !== null) {
        if (vertical) this.x = this.cornerTarget;
        else this.y = this.cornerTarget;
        this.cornerTarget = null;
      }
      this.snapToAxis(this.dir);
      return false;
    }

    this.x += dx;
    this.y += dy;

    if (this.cornerTarget !== null) {
      if (vertical) this.x += Math.sign(this.cornerTarget - this.x);
      else this.y += Math.sign(this.cornerTarget - this.y);
      if ((vertical ? this.x : this.y) === this.cornerTarget) this.cornerTarget = null;
    }

    this.handleTunnelWrap(maze);
    return true;
  }

  /**
   * Advances mouth chomp animation by one frame.
   */
  public updateMouthAnimation(): void {
    if (this.mouthOpening) {
      this.mouthAngle += 0.05;
      if (this.mouthAngle >= 0.45) this.mouthOpening = false;
    } else {
      this.mouthAngle -= 0.05;
      if (this.mouthAngle <= 0.05) this.mouthOpening = true;
    }
  }

  /**
   * Exports plain state representation for snapshots and renderers.
   */
  public toState(): PacmanState {
    return {
      x: this.x,
      y: this.y,
      dir: this.dir,
      nextDir: this.nextDir,
      speed: this.speed,
      mouthAngle: this.mouthAngle,
      mouthOpening: this.mouthOpening,
      isDying: this.isDying,
      deathProgress: this.deathProgress,
      invincible: this.invincible,
      eatingFreezeFrames: this.eatingFreezeFrames,
      cornerTarget: this.cornerTarget,
    };
  }

  /**
   * Restores state from a snapshot.
   */
  public restoreFromState(state: PacmanState): void {
    this.x = state.x;
    this.y = state.y;
    this.dir = state.dir;
    this.nextDir = state.nextDir;
    this.speed = state.speed;
    this.mouthAngle = state.mouthAngle;
    this.mouthOpening = state.mouthOpening;
    this.isDying = state.isDying;
    this.deathProgress = state.deathProgress;
    this.invincible = state.invincible;
    this.eatingFreezeFrames = state.eatingFreezeFrames ?? 0;
    this.cornerTarget = state.cornerTarget ?? null;
  }

  /**
   * Computes the authentic speed percentage for Pac-Man based on state and level.
   */
  public getSpeedPercentage(
    level: number,
    isFrightened: boolean,
    levelOrConfig: number | LevelSpeedConfig
  ): number {
    const config =
      typeof levelOrConfig === "number" ? getSpeedConfigForLevel(level) : levelOrConfig;

    return isFrightened ? config.pacmanFright : config.pacmanNormal;
  }
}
