import { drawIntersectionTiles, drawTileGrid } from "./draw";
/**
 * The player overlay (plans M2, O3): the Learn cues (targets, Inky's vector, Clyde's circle), the
 * Practice ghost paths and target lines, and the tile grid with the decision tiles. One overlay,
 * its layers switched by the Learn and Practice settings.
 */
import type GameEngine from "../GameEngine";
import type { Direction, GhostType } from "../../types";
import {
  CANVAS_WIDTH,
  GHOST_COLORS,
  SPRITE_HALF,
  RENDER_SCALE,
  RENDER_TILE_SIZE as TILE_SIZE,
} from "../constants";
import { chooseNextGhostDirection, getDirectionVector } from "../ghostAiUtils";
import { clydeFlees, inkyPivot } from "../../controllers/GhostAiController";
import { ghostBodyColor } from "../accessibility";

/** Sim pixels to canvas pixels. All tile drawing below already uses canvas-sized tiles. */
const px = (simPx: number) => simPx * RENDER_SCALE;

export function renderLearnMode(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const activeVisuals = engine.settings.activeGhostVisuals || {
    BLINKY: true,
    PINKY: true,
    INKY: true,
    CLYDE: true,
  };
  const showCues = engine.settings.learnVisualsEnabled;

  (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
    // Check if visual cues are enabled for this specific ghost
    if (activeVisuals[type] === false) return;

    const g = engine.ghosts[type];
    const target = g.target;
    if (g.inHouse || !target) return; // frightened ghosts have no target

    const ghostColor = ghostBodyColor(type, engine.settings);
    const targetX = target.col * TILE_SIZE + TILE_SIZE / 2;
    const targetY = target.row * TILE_SIZE + TILE_SIZE / 2;

    // 1. Target Connecting Lines (dashed)
    if (showCues) {
      ctx.strokeStyle = ghostColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px(g.x), px(g.y));
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Target Reticle Crosshair & Target Tile Coordinates
    ctx.strokeStyle = ghostColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Reticle Box
    ctx.strokeRect(
      target.col * TILE_SIZE + 2,
      target.row * TILE_SIZE + 2,
      TILE_SIZE - 4,
      TILE_SIZE - 4
    );
    // Crosshairs
    ctx.moveTo(targetX - 5, targetY);
    ctx.lineTo(targetX + 5, targetY);
    ctx.moveTo(targetX, targetY - 5);
    ctx.lineTo(targetX, targetY + 5);
    ctx.stroke();

    // Target Coordinate Pill at Reticle
    ctx.save();
    const coordTag = `[${target.col},${target.row}]`;
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = ghostColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(coordTag, targetX, target.row * TILE_SIZE);
    ctx.restore();

    // Inky Pincer Vector Visualization
    // (only while he chases: that's when the pivot shapes his target)
    const pivot =
      type === "INKY" && g.mode === "CHASE"
        ? inkyPivot(engine.pacman, engine.rules.emulateRomQuirks)
        : null;
    if (pivot && showCues) {
      const pivotX = pivot.col * TILE_SIZE + TILE_SIZE / 2;
      const pivotY = pivot.row * TILE_SIZE + TILE_SIZE / 2;
      const blinky = engine.ghosts.BLINKY;

      // Draw line from Blinky to Intermediate Pivot
      ctx.strokeStyle = "rgba(0, 255, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(px(blinky.x), px(blinky.y));
      ctx.lineTo(pivotX, pivotY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Small circle at intermediate pivot
      ctx.fillStyle = "#00ffff";
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clyde 8-tile radius circle visualization
    if (type === "CLYDE" && showCues) {
      ctx.strokeStyle = "rgba(255, 184, 82, 0.45)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(px(g.x), px(g.y), 8 * TILE_SIZE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Overhead Ghost Status Badge (Name, Mode, Target Tile Coordinates)
    if (showCues) {
      const ghostName = engine.ruleset.ghostName(type).toUpperCase();

      let modeStr = g.mode as string;
      if (g.mode === "CHASE") {
        if (type === "CLYDE") {
          modeStr = clydeFlees(g, engine.pacman) ? "FLEE" : "CHASE";
        } else {
          modeStr = "CHASE";
        }
      } else if (g.mode === "SCATTER") {
        modeStr = "SCATTER";
      } else if (g.mode === "FRIGHTENED") {
        modeStr = "FRIGHT";
      } else if (g.mode === "EATEN") {
        modeStr = "EYES";
      }

      const targetTag = g.target ? `[${g.target.col},${g.target.row}]` : "[random]";
      const label = `${ghostName} · ${modeStr} ${targetTag}`;

      ctx.save();
      ctx.font = "bold 8.5px monospace";
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const badgeW = textWidth + 8;
      const badgeH = 13;

      // Position badge above ghost dome, flip below skirt if too close to top of canvas
      let badgeY = px(g.y) - SPRITE_HALF - 4;
      if (badgeY < 6) {
        badgeY = px(g.y) + 12;
      }

      // Clamp horizontally so badge never clips outside canvas edges
      const badgeX = Math.max(4, Math.min(CANVAS_WIDTH - badgeW - 4, px(g.x) - badgeW / 2));

      // Dark rounded pill background with ghost color border
      ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
      ctx.strokeStyle = ghostColor;
      ctx.lineWidth = 1;

      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 2.5);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
        ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
      }

      // Text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, badgeX + badgeW / 2, badgeY + badgeH / 2);
      ctx.restore();
    }
  });
}

/** Practice: the tile grid (player style; shared with the debug overlay, plan O3). */
export function renderGrid(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  drawTileGrid(ctx, engine.maze, "rgba(0, 220, 255, 0.12)");
}

/** Practice: the decision tiles, no-up ones in yellow (shared with the debug overlay, O3). */
export function renderIntersectionTiles(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  drawIntersectionTiles(ctx, engine.maze, {
    normal: "rgba(21, 255, 0, 0.45)",
    noUp: "rgba(238, 255, 0, 0.45)",
  });
}

/**
 * Practice Mode: Multi-Step Lookahead Corridor Trajectory
 * Simulates upcoming corridor path 6-8 tiles forward using ghost AI turn decisions!
 */
export function renderPracticeGhostPaths(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const maze = engine.maze;

  (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
    const g = engine.ghosts[type];
    const target = g.target;
    if (g.inHouse || !target) return; // a frightened ghost's path is random

    const ghostColor = ghostBodyColor(type, engine.settings);
    const startCol = Math.floor(px(g.x) / TILE_SIZE);
    const startRow = Math.floor(px(g.y) / TILE_SIZE);

    // Simulate forward corridor trajectory for next 7 steps
    const pathPoints: Array<{ col: number; row: number; dir: Direction }> = [];
    let curCol = startCol;
    let curRow = startRow;
    let curDir = g.dir;

    for (let step = 0; step < 7; step++) {
      const nextDir = chooseNextGhostDirection(g, target, maze, curCol, curRow, curDir);
      const { dx, dy } = getDirectionVector(nextDir);
      curCol += dx;
      curRow += dy;
      curDir = nextDir;

      // Boundary checks
      if (curCol < 0 || curCol >= maze.width || curRow < 0 || curRow >= maze.height) break;

      if (maze.tiles[curRow][curCol] === "WALL") break;

      pathPoints.push({ col: curCol, row: curRow, dir: nextDir });
    }

    if (pathPoints.length === 0) return;

    ctx.save();

    // Glowing corridor line connecting predicted tiles
    ctx.strokeStyle = ghostColor;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([3, 3]);
    ctx.globalAlpha = 0.85;

    ctx.beginPath();
    ctx.moveTo(px(g.x), px(g.y));
    for (const pt of pathPoints) {
      ctx.lineTo(pt.col * TILE_SIZE + TILE_SIZE / 2, pt.row * TILE_SIZE + TILE_SIZE / 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw breadcrumb steps with turn markers
    pathPoints.forEach((pt, idx) => {
      const px = pt.col * TILE_SIZE + TILE_SIZE / 2;
      const py = pt.row * TILE_SIZE + TILE_SIZE / 2;
      const radius = Math.max(1.8, 3.8 - idx * 0.35);

      // Breadcrumb circle
      ctx.fillStyle = ghostColor;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();

      // Direction chevron indicator at turns or end
      const isTurn = idx > 0 && pt.dir !== pathPoints[idx - 1].dir;
      if (isTurn || idx === pathPoints.length - 1) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.4;
        const { dx, dy } = getDirectionVector(pt.dir);
        ctx.beginPath();
        ctx.moveTo(px - dx * 2.5, py - dy * 2.5);
        ctx.lineTo(px + dx * 3.5, py + dy * 3.5);
        ctx.stroke();
      }
    });

    ctx.restore();
  });
}

/**
 * Practice Mode: Tactical Target Lines & Proximity Radar
 * High-tech vector line with real-time tile distance meters and danger warnings!
 */
export function renderPracticeTargetLines(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const pacman = engine.pacman;

  (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
    const g = engine.ghosts[type];
    const target = g.target;
    if (g.inHouse || !target) return;

    const ghostColor = ghostBodyColor(type, engine.settings);
    const targetX = target.col * TILE_SIZE + TILE_SIZE / 2;
    const targetY = target.row * TILE_SIZE + TILE_SIZE / 2;

    // Distance to target in tiles
    const targetDistTiles = (Math.hypot(px(g.x) - targetX, px(g.y) - targetY) / TILE_SIZE).toFixed(
      1
    );

    // Distance to Pac-Man in tiles
    const pacDistTiles = Math.hypot(px(g.x) - px(pacman.x), px(g.y) - px(pacman.y)) / TILE_SIZE;
    const isDangerous = pacDistTiles <= 5.0 && g.mode !== "FRIGHTENED" && g.mode !== "EATEN";

    ctx.save();

    // Vector ray to target
    ctx.strokeStyle = isDangerous ? "#ff3344" : ghostColor;
    ctx.lineWidth = isDangerous ? 2 : 1.2;
    ctx.setLineDash(isDangerous ? [6, 2] : [4, 4]);
    ctx.beginPath();
    ctx.moveTo(px(g.x), px(g.y));
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Floating tactical badge at midpoint
    const midX = (px(g.x) + targetX) / 2;
    const midY = (px(g.y) + targetY) / 2;

    const label = `${GHOST_COLORS[type].name.toUpperCase()}: ${targetDistTiles}t`;
    ctx.font = "bold 9px monospace";
    const textWidth = ctx.measureText(label).width;

    // Badge background
    ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
    ctx.strokeStyle = isDangerous ? "#ff3344" : ghostColor;
    ctx.lineWidth = 1;
    const bx = midX - textWidth / 2 - 4;
    const by = midY - 7;
    const bw = textWidth + 8;
    const bh = 14;

    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 3);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
    }

    // Badge text
    ctx.fillStyle = isDangerous ? "#ffdddd" : "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, midX, midY);

    // Proximity Danger Alert if ghost is within 5 tiles of Pac-Man
    if (isDangerous) {
      const alertLabel = `⚠️ ${pacDistTiles.toFixed(1)}t PROXIMITY`;
      ctx.font = "bold 9px monospace";
      const alertWidth = ctx.measureText(alertLabel).width;
      const abx = px(g.x) - alertWidth / 2 - 3;
      const aby = px(g.y) - SPRITE_HALF - 6;
      const abw = alertWidth + 6;
      const abh = 13;

      ctx.fillStyle = "rgba(255, 20, 50, 0.9)";
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(abx, aby, abw, abh, 2);
        ctx.fill();
      } else {
        ctx.fillRect(abx, aby, abw, abh);
      }
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(alertLabel, px(g.x), aby + abh / 2);
    }

    ctx.restore();
  });
}

/** The Learn and Practice layers that are switched on (drawn under the actors). */
export function renderPlayerOverlay(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const { showGhostPaths, showTargetLines, learnVisualsEnabled } = engine.settings;
  if (learnVisualsEnabled) renderLearnMode(ctx, engine);
  if (showGhostPaths) renderPracticeGhostPaths(ctx, engine);
  if (showTargetLines) renderPracticeTargetLines(ctx, engine);
}
