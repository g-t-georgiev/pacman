import { renderFruit, renderGhosts, renderPlayer } from "./render/actors";
import { renderGrid, renderIntersectionTiles, renderPlayerOverlay } from "./render/playerOverlay";
import type { ScorePopups } from "./scorePopups";
import type { LatencyMeter } from "./latencyMeter";
import type { PracticeTools } from "./practiceTools";
import { mazeFlashWallColor } from "./accessibility";
import type { MazeData } from "../types";
import type GameEngine from "./GameEngine";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  arcadeFont,
  RENDER_SCALE,
  RENDER_TILE_SIZE as TILE_SIZE,
} from "./constants";
import { renderDebugOverlay } from "./debugOverlay";
import { renderArcadeHud } from "./arcadeHud";

/** Sim pixels to canvas pixels. All tile drawing below already uses canvas-sized tiles. */
const px = (simPx: number) => simPx * RENDER_SCALE;

/**
 * One energizer pulse every 45 frames (0.75 s, as the old wall-clock pulse). Placeholder: the
 * energizer's look waits on footage (docs/OPEN_ITEMS.md).
 */
const ENERGIZER_PULSE_FRAMES = 45;

export default class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  /** Cached wall layers (A6): the current maze in its normal and flash colors. */
  private wallCache: Array<{ maze: MazeData; wallColor: string; canvas: HTMLCanvasElement }> = [];

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Practice overlays (pattern trail, first-death heatmap), owned by the runner. */
  public practice: PracticeTools | null = null;
  /** The floating fruit points (plan P2), owned by the runner. */
  public popups: ScorePopups | null = null;
  /** Input latency readout for the debug overlay (Phase 5), owned by the runner. */
  public latency: LatencyMeter | null = null;

  public render(engine: GameEngine) {
    const ctx = this.ctx;
    ctx.save();

    // Clear background
    ctx.fillStyle = engine.maze.bgColor || "#000000";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const { showGrid, crtFilter } = engine.settings;

    if (showGrid) renderIntersectionTiles(ctx, engine);

    // Render Maze Walls, Dots, and Gates
    this.renderMaze(engine);

    // Render Tile Grid & Decision Intersections if enabled (Practice Mode)
    if (showGrid) renderGrid(ctx, engine);

    // Practice overlays: the saved pattern and the first-death heatmap (Phase 5)
    this.practice?.render(ctx, engine, px);

    // Render Fruit / Treats
    renderFruit(ctx, engine);

    // The player overlay: Learn cues, Practice ghost paths and target lines
    renderPlayerOverlay(ctx, engine);

    // Render Ghosts
    renderGhosts(ctx, engine);

    // Render Pac-Man / Hero
    renderPlayer(ctx, engine);

    // Arcade score and status texts in the maze's blank rows (T13)
    renderArcadeHud(ctx, engine);

    // Debug overlay layers (F1, dev builds; plan T1-T3)
    if (engine.settings.debugOverlay) renderDebugOverlay(ctx, engine, this.latency?.stats ?? null);

    // Render Floating Score Popups
    this.popups?.render(ctx, px);

    // Render State Messages ("READY!", "GAME OVER", "LEVEL CLEAR")
    this.renderStateBanners(engine);

    // Render CRT Scanlines if enabled
    if (crtFilter) {
      this.renderCRTFilter();
    }

    ctx.restore();
  }

  /**
   * The static walls and gate, drawn once per maze and wall color into an offscreen canvas
   * (plan A6). Walls never change within a maze; only dots do, and those are drawn per frame.
   */
  private wallLayer(maze: MazeData, wallColor: string): HTMLCanvasElement {
    const cached = this.wallCache.find((c) => c.maze === maze && c.wallColor === wallColor);
    if (cached) return cached.canvas;

    // Match the main canvas's pixel ratio so the cached walls stay sharp
    const scale = this.ctx.getTransform().a || 1;
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH * scale;
    canvas.height = CANVAS_HEIGHT * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    for (let r = 0; r < maze.height; r++) {
      for (let c = 0; c < maze.width; c++) {
        const tile = maze.tiles[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        if (tile === "WALL") {
          ctx.fillStyle = wallColor;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // Hollow the inside of thick walls for the double-line look
          const hasTop = r > 0 && maze.tiles[r - 1][c] === "WALL";
          const hasBot = r < maze.height - 1 && maze.tiles[r + 1][c] === "WALL";
          const hasLeft = c > 0 && maze.tiles[r][c - 1] === "WALL";
          const hasRight = c < maze.width - 1 && maze.tiles[r][c + 1] === "WALL";
          if (hasTop && hasBot && hasLeft && hasRight) {
            ctx.fillStyle = maze.bgColor || "#000000";
            ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          }
        } else if (tile === "GATE") {
          ctx.fillStyle = maze.gateColor || "#ffb8ff";
          ctx.fillRect(x, y + TILE_SIZE / 2 - 2, TILE_SIZE, 4);
        }
      }
    }

    // Keep the normal and the flash-white layer of the current maze only
    this.wallCache = this.wallCache.filter((c) => c.maze === maze);
    this.wallCache.push({ maze, wallColor, canvas });
    return canvas;
  }

  private renderMaze(engine: GameEngine) {
    const ctx = this.ctx;
    const maze = engine.maze;
    const wallColor = mazeFlashWallColor(engine) ?? maze.wallColor;
    ctx.drawImage(this.wallLayer(maze, wallColor), 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let r = 0; r < maze.height; r++) {
      for (let c = 0; c < maze.width; c++) {
        const tile = maze.tiles[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (tile === "DOT") {
          ctx.fillStyle = maze.dotColor;
          ctx.fillRect(x + TILE_SIZE / 2 - 2, y + TILE_SIZE / 2 - 2, 4, 4);
        } else if (tile === "ENERGIZER") {
          // Pulsing energizer on game frames (P3: it holds still while paused and slows with the
          // practice speed); steady with reduced flashing. Its final look waits on footage.
          const pulse = engine.settings.reducedFlash
            ? 0.5
            : (Math.sin((engine.tick * 2 * Math.PI) / ENERGIZER_PULSE_FRAMES) + 1) * 0.5;
          const radius = 5 + pulse * 2.5;

          ctx.fillStyle = maze.dotColor;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Grid toggle for Learn/Practice mode
    if (engine.settings.showGrid) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let c = 0; c <= maze.width; c++) {
        ctx.beginPath();
        ctx.moveTo(c * TILE_SIZE, 0);
        ctx.lineTo(c * TILE_SIZE, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let r = 0; r <= maze.height; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * TILE_SIZE);
        ctx.lineTo(CANVAS_WIDTH, r * TILE_SIZE);
        ctx.stroke();
      }
    }
  }

  private renderStateBanners(engine: GameEngine) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = CANVAS_WIDTH / 2;
    const centerY = 20 * TILE_SIZE;

    // Watching a replay (T12): a marker between the lives and the fruit in the bottom rows
    if (engine.watchingReplay) {
      ctx.font = arcadeFont(12);
      ctx.fillStyle = "#ff3b3b";
      ctx.fillText("● REPLAY", CANVAS_WIDTH / 2, 35 * TILE_SIZE);
    }

    if (engine.playState === "READY") {
      ctx.font = arcadeFont(16);
      ctx.fillStyle = "#ffff00";
      ctx.fillText("READY!", centerX, centerY);
    } else if (engine.playState === "GAME_OVER") {
      ctx.font = arcadeFont(16);
      ctx.fillStyle = "#ff0000";
      ctx.fillText("GAME OVER", centerX, centerY);
    } else if (engine.playState === "LEVEL_CLEAR") {
      ctx.font = arcadeFont(16);
      ctx.fillStyle = "#00ff88";
      ctx.fillText("LEVEL CLEARED!", centerX, centerY);
    }

    ctx.restore();
  }

  private renderCRTFilter() {
    const ctx = this.ctx;
    // Scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    for (let y = 0; y < CANVAS_HEIGHT; y += 3) {
      ctx.fillRect(0, y, CANVAS_WIDTH, 1.2);
    }

    // Subtle CRT vignette
    const grad = ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH * 0.4,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH * 0.75
    );
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}
