/**
 * Drawing the actors (plan M2: this lived in GameRenderer): Pac-Man, the ghosts (with their eyes)
 * and the fruit. Purely visual: reads the engine, never changes it.
 */
import type GameEngine from "../GameEngine";
import type { Direction, GhostType } from "../../types";
import {
  FRUIT_FONT_PX,
  GHOST_DRAW_SCALE,
  PACMAN_DRAW_SCALE,
  arcadeFont,
  RENDER_SCALE,
  RENDER_TILE_SIZE as TILE_SIZE,
} from "../constants";
import { feetPhase, frightenedFlashWhite } from "../ghostLooks";
import { frightenedColors, frightenedEnding, ghostBodyColor } from "../accessibility";

/** Sim pixels to canvas pixels. All tile drawing below already uses canvas-sized tiles. */
const px = (simPx: number) => simPx * RENDER_SCALE;
/** The invincibility shield's hue turns 200 degrees a second. */
const SHIELD_HUE_PER_FRAME = 200 / 60;

export function renderPlayer(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const p = engine.pacman;
  if (!p || !engine.pacmanVisible) return;

  ctx.save();
  ctx.translate(px(p.x), px(p.y));
  ctx.scale(PACMAN_DRAW_SCALE, PACMAN_DRAW_SCALE); // arcade-size sprite (F27)

  // Death animation
  if (p.isDying) {
    const angle = p.deathProgress * Math.PI;
    ctx.fillStyle = "#ffff00";
    ctx.beginPath();
    ctx.arc(0, 0, TILE_SIZE / 2 + 1, angle, Math.PI * 2 - angle);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Invincibility shield effect
  if (engine.rules.invincible) {
    ctx.strokeStyle = `hsl(${(engine.tick * SHIELD_HUE_PER_FRAME) % 360}, 100%, 70%)`; // game frames (P3)
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, TILE_SIZE / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rotation based on direction
  let rot = 0;
  switch (p.dir) {
    case "UP":
      rot = -Math.PI / 2;
      break;
    case "DOWN":
      rot = Math.PI / 2;
      break;
    case "LEFT":
      rot = Math.PI;
      break;
    case "RIGHT":
      rot = 0;
      break;
  }
  ctx.rotate(rot);

  const radius = TILE_SIZE / 2 + 1;
  // Mouth half-angle (as a fraction of pi) per frame: closed circle, half open, wide open
  const mouth = [0, 0.13, 0.27][mouthFrameShown(engine)];

  if (engine.ruleset.playerLook === "PACMAN") {
    // Classic Pac-Man
    ctx.fillStyle = "#ffff00";
    ctx.beginPath();
    ctx.arc(0, 0, radius, mouth * Math.PI, (2 - mouth) * Math.PI);
    ctx.lineTo(0, 0);
    ctx.fill();
  } else {
    // Ms. Pac-Man: Yellow body + Pink Bow + Eye with lashes + Red Lipstick
    ctx.fillStyle = "#ffff00";
    ctx.beginPath();
    ctx.arc(0, 0, radius, mouth * Math.PI, (2 - mouth) * Math.PI);
    ctx.lineTo(0, 0);
    ctx.fill();

    // Red Lipstick
    ctx.fillStyle = "#ff0044";
    ctx.beginPath();
    ctx.arc(radius * 0.85, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(radius * 0.2, -radius * 0.45, 2, 0, Math.PI * 2);
    ctx.fill();

    // Pink Bow on head
    ctx.fillStyle = "#ff3366";
    ctx.beginPath();
    ctx.arc(-radius * 0.4, -radius * 0.7, 3.5, 0, Math.PI * 2);
    ctx.arc(-radius * 0.8, -radius * 0.7, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-radius * 0.6, -radius * 0.7, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Beauty mark
    ctx.fillStyle = "#222222";
    ctx.fillRect(radius * 0.1, radius * 0.3, 1.5, 1.5);
  }

  ctx.restore();
}

export function renderGhosts(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  if (!engine.ghostsVisible) return;
  const { eatenGhost, eatenPoints } = engine.sequencer.state;

  (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
    const g = engine.ghosts[type];

    // While the action is paused after eating a ghost, its score shows in its place.
    if (type === eatenGhost) {
      ctx.save();
      ctx.font = arcadeFont(12);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#00ffff";
      ctx.fillText(`${eatenPoints}`, px(g.x), px(g.y));
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(px(g.x), px(g.y));
    ctx.scale(GHOST_DRAW_SCALE, GHOST_DRAW_SCALE); // arcade-size sprite (F27)

    const radius = TILE_SIZE / 2;

    // 1. EATEN (Eyes only)
    if (g.mode === "EATEN") {
      renderGhostEyes(ctx, g.dir);
      ctx.restore();
      return;
    }

    // 2. Body Color
    // Frightened: blue, flashing white near the end; with reduced flashing it stays blue and
    // gets a steady white outline for the last stretch instead
    const fright = frightenedColors(engine.settings);
    const flashWhite = frightenedFlashWhite(engine) && !engine.settings.reducedFlash;
    let bodyColor = ghostBodyColor(type, engine.settings);
    if (g.mode === "FRIGHTENED") bodyColor = flashWhite ? fright.flashBody : fright.body;

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    // Dome head
    ctx.arc(0, -2, radius, Math.PI, 0, false);
    // Sides down
    ctx.lineTo(radius, radius);

    // Wavy bottom skirt (3 scallops)
    const wave = Math.sin(feetPhase(engine) * Math.PI * 2) * 2;
    ctx.lineTo(radius * 0.5, radius - 2 + wave);
    ctx.lineTo(0, radius);
    ctx.lineTo(-radius * 0.5, radius - 2 - wave);
    ctx.lineTo(-radius, radius);
    ctx.closePath();
    ctx.fill();
    if (g.mode === "FRIGHTENED" && engine.settings.reducedFlash && frightenedEnding(engine)) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 3. Frightened Face vs Regular Eyes
    if (g.mode === "FRIGHTENED") {
      // Frightened squiggly mouth & eyes
      const mouthColor = flashWhite ? fright.flashFace : fright.face;
      ctx.fillStyle = mouthColor;
      ctx.fillRect(-3, -3, 2, 2);
      ctx.fillRect(1, -3, 2, 2);

      ctx.strokeStyle = mouthColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, 3);
      ctx.lineTo(-3, 1);
      ctx.lineTo(-1, 3);
      ctx.lineTo(1, 1);
      ctx.lineTo(3, 3);
      ctx.lineTo(5, 1);
      ctx.stroke();
    } else {
      // Regular eyes
      renderGhostEyes(ctx, g.dir);
    }

    ctx.restore();
  });
}

export function renderGhostEyes(ctx: CanvasRenderingContext2D, dir: Direction) {
  const eyeOffsetX = dir === "LEFT" ? -2 : dir === "RIGHT" ? 2 : 0;
  const eyeOffsetY = dir === "UP" ? -2 : dir === "DOWN" ? 2 : 0;

  // Sclera (white)
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-3.5, -3, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(3.5, -3, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils (blue)
  ctx.fillStyle = "#0000bb";
  ctx.beginPath();
  ctx.arc(-3.5 + eyeOffsetX, -3 + eyeOffsetY, 1.8, 0, Math.PI * 2);
  ctx.arc(3.5 + eyeOffsetX, -3 + eyeOffsetY, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The mouth frame drawn: Pac-Man's own, except through a level clear (the freeze and the
 * flashes), where he is a closed circle, as on footage of the original.
 */
export function mouthFrameShown(engine: GameEngine): 0 | 1 | 2 {
  const clearing = engine.phase === "LEVEL_CLEAR_FREEZE" || engine.phase === "MAZE_FLASH";
  return clearing ? 0 : engine.pacman.mouthFrame;
}

export function renderFruit(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const f = engine.fruit;
  if (!f || !f.active) return;

  // Centered on the seam between its two tiles (13/14), like the spawn points, at sprite size
  const x = (f.col + 1) * TILE_SIZE;
  const y = f.row * TILE_SIZE + TILE_SIZE / 2 + px(f.bounceY || 0);

  ctx.save();
  ctx.font = `${FRUIT_FONT_PX}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(f.symbol, x, y);
  ctx.restore();
}
