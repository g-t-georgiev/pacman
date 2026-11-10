import type GameEngine from "../game/GameEngine";
import type { Actor } from "../core/Actor";
import type { Ghost } from "../core/Ghost";
import { getSpeedConfigForLevel } from "../utils";
import { SIM_FPS, TILE_SIZE } from "../game/constants";
import { SPEED_MASKS, arcadeStepsOnFrame } from "../game/speedMasks";

/** 100% speed in arcade pixels per second (Dossier, Table A.1). */
export const ARCADE_PX_PER_SEC_AT_100 = 75.7576;
/** 80% is one pixel every frame (16 of 16 mask bits), so 1% = 1/80 px per frame. */
const PCT_PER_PX_PER_FRAME = 80;

/** Why an actor moves at the speed it does this frame. */
export type SpeedSource =
  | "pacman-normal"
  | "pacman-fright"
  | "pacman-stall" // the 1- or 3-frame stop after eating a dot or an energizer
  | "ghost-normal"
  | "ghost-tunnel"
  | "ghost-fright"
  | "ghost-elroy1"
  | "ghost-elroy2"
  | "ghost-eyes"
  | "ghost-house";

export interface SpeedRow {
  actor: string;
  source: SpeedSource;
  /** Speed percentage from the level's table (0 for a stall; for eyes, the mask key). */
  pct: number;
  /** Frames sampled (play frames only; frames blocked by a wall are counted separately). */
  frames: number;
  movedPx: number;
  /** Measured px per frame vs what the percentage means (pct / 80). */
  measuredPxPerFrame: number;
  expectedPxPerFrame: number;
  /** measured / expected. 1.00 means exactly on table speed. */
  ratio: number;
  /** Frames where the actor should have moved but did not (Pac-Man against a wall). */
  blockedFrames: number;
}

export interface SpeedReport {
  /** Play frames sampled. */
  frames: number;
  /** Real seconds recorded (live play only), including time the loop was not running. */
  realSeconds: number;
  /** Real seconds while ticks were flowing (gaps over 250 ms, e.g. a hidden tab, are left out). */
  activeSeconds: number;
  /**
   * Sim frames per real second while the loop was running (live play): 60.606 with arcade timing
   * (60 without), × the practice speed. Several ticks run per animation frame, so this is an
   * average over the active time, not a per-frame value.
   */
  ticksPerSecond: number;
  rows: SpeedRow[];
}

interface Pending {
  x: number;
  y: number;
  source: SpeedSource;
  pct: number;
}

interface Bucket {
  actor: string;
  source: SpeedSource;
  pct: number;
  frames: number;
  movedPx: number;
  blockedFrames: number;
}

/**
 * Records how far every actor actually moves each play frame, grouped by the reason for its speed
 * (normal, tunnel, frightened, Elroy, ...), and compares it with the level's speed table.
 * Call `before()` right before a sim tick and `after()` right after it.
 */
export class SpeedRecorder {
  private pending = new Map<string, Pending>();
  private buckets = new Map<string, Bucket>();
  private playFrames = 0;
  private ticks = 0;
  private startedAt = now();
  private lastTickAt = this.startedAt;
  private activeMs = 0;

  constructor(private readonly engine: GameEngine) {}

  public before(): void {
    this.pending.clear();
    const e = this.engine;
    if (e.phase !== "PLAYING" || e.paused) return;

    const cfg = getSpeedConfigForLevel(e.level);
    const p = e.pacman;
    const frightened = e.frightenedGlobalTimer > 0;
    const pacSource: SpeedSource =
      p.eatingFreezeFrames > 0 ? "pacman-stall" : frightened ? "pacman-fright" : "pacman-normal";
    const pacPct =
      pacSource === "pacman-stall" ? 0 : frightened ? cfg.pacmanFright : cfg.pacmanNormal;
    this.pending.set("PACMAN", { x: p.x, y: p.y, source: pacSource, pct: pacPct });

    for (const g of Object.values(e.ghosts)) {
      this.pending.set(g.type, {
        x: g.x,
        y: g.y,
        source: this.ghostSource(g),
        pct: g.getSpeedPercentage(e.maze, cfg),
      });
    }
  }

  public after(): void {
    this.ticks++;
    const t = now();
    const gap = t - this.lastTickAt;
    if (gap < MAX_TICK_GAP_MS) this.activeMs += gap;
    this.lastTickAt = t;
    if (this.pending.size === 0) return;
    this.playFrames++;
    const e = this.engine;
    const actors: Array<[string, Actor]> = [["PACMAN", e.pacman], ...Object.entries(e.ghosts)];

    for (const [name, actor] of actors) {
      const before = this.pending.get(name);
      if (!before) continue;
      const dx = Math.abs(actor.x - before.x);
      const dy = Math.abs(actor.y - before.y);
      if (dx > 2 * TILE_SIZE || dy > 2 * TILE_SIZE) continue; // tunnel wrap or respawn
      // Cornering moves one pixel on both axes per step: count steps, not path length.
      const moved = Math.max(dx, dy);

      const key = `${name}|${before.source}|${before.pct}`;
      const bucket = this.buckets.get(key) ?? {
        actor: name,
        source: before.source,
        pct: before.pct,
        frames: 0,
        movedPx: 0,
        blockedFrames: 0,
      };
      // Pac-Man pressed against a wall: not a speed sample
      if (name === "PACMAN" && moved === 0 && before.pct > 0 && actor.speed > 0) {
        bucket.blockedFrames++;
      } else {
        bucket.frames++;
        bucket.movedPx += moved;
      }
      this.buckets.set(key, bucket);
    }
  }

  public report(): SpeedReport {
    const realSeconds = (now() - this.startedAt) / 1000;
    const activeSeconds = this.activeMs / 1000;
    const rows = [...this.buckets.values()]
      .filter((b) => b.frames > 0)
      .map((b): SpeedRow => {
        const measured = b.movedPx / b.frames;
        // Eyes have no Dossier percentage: their mask key is not a real one, so use the mask.
        const expected =
          b.source === "ghost-eyes" ? maskPxPerFrame(b.pct) : b.pct / PCT_PER_PX_PER_FRAME;
        return {
          actor: b.actor,
          source: b.source,
          pct: b.pct,
          frames: b.frames,
          movedPx: b.movedPx,
          measuredPxPerFrame: round(measured),
          expectedPxPerFrame: round(expected),
          ratio: expected > 0 ? round(measured / expected) : measured === 0 ? 1 : Infinity,
          blockedFrames: b.blockedFrames,
        };
      })
      .sort((a, b) => a.actor.localeCompare(b.actor) || b.frames - a.frames);
    return {
      frames: this.playFrames,
      realSeconds: round(realSeconds),
      activeSeconds: round(activeSeconds),
      ticksPerSecond: activeSeconds > 0 ? round(this.ticks / activeSeconds) : SIM_FPS,
      rows,
    };
  }

  private ghostSource(g: Ghost): SpeedSource {
    if (g.isEyes) return "ghost-eyes";
    if (g.inHouse) return "ghost-house";
    const { col, row } = g.tileCoord;
    const maze = this.engine.maze;
    if (maze.tunnels.some((t) => t.y === row && (col <= 5 || col >= maze.width - 6))) {
      return "ghost-tunnel";
    }
    if (g.frightened) return "ghost-fright";
    if (g.elroyStage === 2) return "ghost-elroy2";
    if (g.elroyStage === 1) return "ghost-elroy1";
    return "ghost-normal";
  }
}

/** Average px per frame a speed mask gives over its 16-frame cycle. */
function maskPxPerFrame(pct: number): number {
  let steps = 0;
  for (let f = 0; f < 16; f++) steps += arcadeStepsOnFrame(SPEED_MASKS[pct], f);
  return steps / 16;
}

/** Longer than any normal animation frame: a gap this long means the loop was not running. */
const MAX_TICK_GAP_MS = 250;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
