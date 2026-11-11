import type GameEngine from "./GameEngine";
import { FRUIT_CATALOG, RENDER_TILE_SIZE as T, arcadeFont } from "./constants";
import { levelRow } from "./levelTable";

/**
 * The arcade's score and status texts, drawn in the maze's blank rows like the original screen
 * (plan T13): 1UP and HIGH SCORE with their scores in the top two rows, spare lives and the
 * recent levels' fruit in the bottom two. Text sits on the tile grid, one character per tile.
 *
 * Placement follows the arcade screen as commonly reproduced (lives at the bottom left, fruit at
 * the bottom right drawn leftward two tiles at a time); the exact columns are constants here so
 * they are easy to adjust against footage.
 */
export const HUD_LAYOUT = {
  /** Row 0: labels. */
  labelRow: 0,
  oneUpCol: 3,
  highScoreLabelCol: 9,
  /** Row 1: scores, right-aligned to these columns (inclusive). */
  scoreRow: 1,
  oneUpScoreEndCol: 6,
  highScoreEndCol: 16,
  /** Rows 34-35: 2x2-tile icons. */
  iconRow: 34,
  livesStartCol: 2,
  maxLivesShown: 5,
  /** The newest fruit's left column; older ones go leftward, two tiles each. */
  fruitEndCol: 24,
  maxFruitShown: 7,
  /** 1UP blinks while playing, toggling this often (frames). Estimate. */
  oneUpBlinkFrames: 16,
} as const;

const TEXT = "#ffffff";
/** Emulogic at one tile (16 px): the arcade's one character per tile. */
const FONT = arcadeFont(T);

/** Draws `text` one character per tile, starting at tile `col` of `row`. */
function drawTiles(ctx: CanvasRenderingContext2D, text: string, col: number, row: number): void {
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], (col + i) * T + T / 2, row * T + T / 2 + 1);
  }
}

/** A score as the arcade shows it: at least "00". */
export function formatScore(score: number): string {
  return score === 0 ? "00" : String(score);
}

/** Spare lives shown: lives beyond the one being played, up to the display limit. */
export function livesShown(lives: number): number {
  return Math.max(0, Math.min(HUD_LAYOUT.maxLivesShown, lives - 1));
}

/** The fruit icons for a level, oldest first: the last up to 7 levels' fruit. */
export function fruitShown(level: number): string[] {
  const first = Math.max(1, level - HUD_LAYOUT.maxFruitShown + 1);
  const out: string[] = [];
  for (let l = first; l <= level; l++) out.push(FRUIT_CATALOG[levelRow(l).fruit].symbol);
  return out;
}

export function renderArcadeHud(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const L = HUD_LAYOUT;
  ctx.save();
  ctx.font = FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = TEXT;

  // Top: 1UP (blinking while playing) and HIGH SCORE, scores right-aligned underneath
  const blinkOff =
    engine.phase === "PLAYING" &&
    !engine.paused &&
    Math.floor(engine.tick / L.oneUpBlinkFrames) % 2 === 1;
  if (!blinkOff) drawTiles(ctx, "1UP", L.oneUpCol, L.labelRow);
  drawTiles(ctx, "HIGH SCORE", L.highScoreLabelCol, L.labelRow);
  const score = formatScore(engine.score);
  drawTiles(ctx, score, L.oneUpScoreEndCol - score.length + 1, L.scoreRow);
  const high = formatScore(engine.highScore);
  drawTiles(ctx, high, L.highScoreEndCol - high.length + 1, L.scoreRow);

  // Bottom left: spare lives as 2x2-tile Pac-Man icons facing left
  const iconY = (L.iconRow + 1) * T;
  ctx.fillStyle = "#ffff00";
  for (let i = 0; i < livesShown(engine.lives); i++) {
    const cx = (L.livesStartCol + i * 2 + 1) * T;
    ctx.beginPath();
    ctx.moveTo(cx, iconY);
    ctx.arc(cx, iconY, T * 0.8, Math.PI + 0.6, Math.PI - 0.6);
    ctx.closePath();
    ctx.fill();
  }

  // Bottom right: the recent levels' fruit, newest at the right
  ctx.font = `${Math.round(T * 1.4)}px monospace`;
  const fruit = fruitShown(engine.level);
  fruit.forEach((symbol, i) => {
    const col = L.fruitEndCol - (fruit.length - 1 - i) * 2;
    ctx.fillText(symbol, (col + 1) * T, iconY);
  });
  ctx.restore();
}
