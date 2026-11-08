import { Actor } from "./Actor";
import type { Direction, LevelSpeedConfig, MazeData, PacmanState } from "../types";
import { PACMAN_CORNERING_TOLERANCE, TILE_SIZE } from "../game/constants";
import { getOppositeDirection } from "../game/ghostAiUtils";
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
  public eatDotCooldown: number = 0;
  public eatingFreezeFrames: number = 0;

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
   * Tries to execute a buffered turn into nextDir using authentic arcade cornering.
   * If Pac-Man is within `tolerance` pixels of the target corridor axis, he snaps and initiates the turn.
   */
  public tryTurn(maze: MazeData, tolerance: number = PACMAN_CORNERING_TOLERANCE): boolean {
    if (this.nextDir === this.dir || this.nextDir === "NONE") {
      return false;
    }

    if (!this.canMoveInDirection(this.nextDir, maze)) {
      return false;
    }

    const halfTile = TILE_SIZE / 2;
    if (this.nextDir === "UP" || this.nextDir === "DOWN") {
      const targetX = Math.floor(this.x / TILE_SIZE) * TILE_SIZE + halfTile;
      if (Math.abs(this.x - targetX) <= tolerance) {
        this.x = targetX;
        this.dir = this.nextDir;
        return true;
      }
    } else if (this.nextDir === "LEFT" || this.nextDir === "RIGHT") {
      const targetY = Math.floor(this.y / TILE_SIZE) * TILE_SIZE + halfTile;
      if (Math.abs(this.y - targetY) <= tolerance) {
        this.y = targetY;
        this.dir = this.nextDir;
        return true;
      }
    }

    return false;
  }

  /**
   * Advances mouth chomp animation based on gameSpeed.
   */
  public updateMouthAnimation(gameSpeed: number = 1.0): void {
    if (this.mouthOpening) {
      this.mouthAngle += 0.05 * gameSpeed;
      if (this.mouthAngle >= 0.45) this.mouthOpening = false;
    } else {
      this.mouthAngle -= 0.05 * gameSpeed;
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
      eatDotCooldown: this.eatDotCooldown,
      eatingFreezeFrames: this.eatingFreezeFrames,
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
    this.eatDotCooldown = state.eatDotCooldown;
    this.eatingFreezeFrames = state.eatingFreezeFrames ?? 0;
  }

  /**
   * Computes the authentic speed percentage for Pac-Man based on state and level.
   */
  public getSpeedPercentage(
    level: number,
    isFrightened: boolean,
    levelOrConfig: number | LevelSpeedConfig
  ): number {
    const isEating = this.eatDotCooldown > 0;
    const config =
      typeof levelOrConfig === "number" ? getSpeedConfigForLevel(level) : levelOrConfig;
    const { pacmanFrightEating, pacmanFright, pacmanEating, pacmanNormal } = config;

    if (isFrightened) return isEating ? pacmanFrightEating : pacmanFright;

    return isEating ? pacmanEating : pacmanNormal;
  }
}
