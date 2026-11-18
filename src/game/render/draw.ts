import type { MazeData, TileCoord } from "../../types";
import { RENDER_TILE_SIZE as T } from "../constants";
import { isTileNoUpZone } from "../ghostAiUtils";
import { deriveIntersections } from "../mazeAnalysis";

/**
 * Drawing pieces shared by the player overlay (Learn/Practice) and the debug overlay (plan O3):
 * the same geometry, each overlay with its own style.
 */

/** The tile grid over the whole maze. */
export function drawTileGrid(ctx: CanvasRenderingContext2D, maze: MazeData, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let c = 0; c <= maze.width; c++) {
    ctx.moveTo(c * T, 0);
    ctx.lineTo(c * T, maze.height * T);
  }
  for (let r = 0; r <= maze.height; r++) {
    ctx.moveTo(0, r * T);
    ctx.lineTo(maze.width * T, r * T);
  }
  ctx.stroke();
  ctx.restore();
}

/** The tiles where ghosts decide (intersections), the no-up ones in their own color. */
export function drawIntersectionTiles(
  ctx: CanvasRenderingContext2D,
  maze: MazeData,
  colors: { normal: string; noUp: string }
): void {
  const tiles: readonly TileCoord[] = maze.intersections ?? deriveIntersections(maze);
  for (const t of tiles) {
    ctx.fillStyle = isTileNoUpZone(t.col, t.row, maze) ? colors.noUp : colors.normal;
    ctx.fillRect(t.col * T, t.row * T, T, T);
  }
}
