/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Direction, GameMode, GhostState, GhostType, MazeData } from '../types/game';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GHOST_COLORS, TILE_SIZE } from './constants';
import { GameEngine } from './gameEngine';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public render(engine: GameEngine) {
    const ctx = this.ctx;
    ctx.save();

    // Clear background
    ctx.fillStyle = engine.maze.bgColor || '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Render Maze Walls, Dots, and Gates
    this.renderMaze(engine);

    // 2. Render Fruit / Treats
    this.renderFruit(engine);

    // 3. Render Learn Mode Overlays (Target lines, target reticles, Clyde radius)
    if (engine.settings.learnMode || engine.settings.learnVisualsEnabled || engine.settings.practiceMode) {
      this.renderLearnMode(engine);
    }

    // 4. Render Ghosts
    this.renderGhosts(engine);

    // 5. Render Pac-Man / Hero
    this.renderPlayer(engine);

    // 6. Render Floating Score Popups
    this.renderScorePopups(engine);

    // 7. Render State Messages ("READY!", "GAME OVER", "LEVEL CLEAR")
    this.renderStateBanners(engine);

    // 8. Render CRT Scanlines if enabled
    if (engine.settings.crtFilter) {
      this.renderCRTFilter();
    }

    ctx.restore();
  }

  private renderMaze(engine: GameEngine) {
    const ctx = this.ctx;
    const maze = engine.maze;
    const isLevelClearFlash = engine.playState === 'LEVEL_CLEAR' && Math.floor(engine.levelClearTimer / 10) % 2 === 0;

    const wallColor = isLevelClearFlash ? '#ffffff' : maze.wallColor;

    for (let r = 0; r < maze.height; r++) {
      for (let c = 0; c < maze.width; c++) {
        const tile = maze.tiles[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (tile === 'WALL') {
          ctx.fillStyle = wallColor;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          // Subtle inset to simulate classic double-bezel arcade walls
          ctx.fillStyle = engine.maze.bgColor || '#000000';
          // Check neighbors to create hollow arcade corridors
          const hasTop = r > 0 && maze.tiles[r - 1][c] === 'WALL';
          const hasBot = r < maze.height - 1 && maze.tiles[r + 1][c] === 'WALL';
          const hasLeft = c > 0 && maze.tiles[r][c - 1] === 'WALL';
          const hasRight = c < maze.width - 1 && maze.tiles[r][c + 1] === 'WALL';

          if (hasTop && hasBot && hasLeft && hasRight) {
            ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          }
        } else if (tile === 'GATE') {
          ctx.fillStyle = maze.gateColor || '#ffb8ff';
          ctx.fillRect(x, y + TILE_SIZE / 2 - 2, TILE_SIZE, 4);
        } else if (tile === 'DOT' || tile === 'NO_UP_ZONE') {
          if (engine.mode === 'COOKIE_MAN') {
            // Chocolate chip dot
            ctx.fillStyle = '#d2a679';
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Tiny chocolate morsel
            ctx.fillStyle = '#5c3317';
            ctx.fillRect(x + TILE_SIZE / 2 - 1, y + TILE_SIZE / 2 - 1, 1.5, 1.5);
          } else {
            // Classic arcade square/round pellet
            ctx.fillStyle = maze.dotColor;
            ctx.fillRect(x + TILE_SIZE / 2 - 2, y + TILE_SIZE / 2 - 2, 4, 4);
          }
        } else if (tile === 'ENERGIZER') {
          // Flashing energizer
          const pulse = (Math.sin(Date.now() / 120) + 1) * 0.5; // 0 to 1
          const radius = 5 + pulse * 2.5;

          if (engine.mode === 'COOKIE_MAN') {
            // Giant frosted cookie
            ctx.fillStyle = '#e0a96d';
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff69b4';
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, radius - 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = maze.dotColor;
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Grid toggle for Learn/Practice mode
    if (engine.settings.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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

  private renderPlayer(engine: GameEngine) {
    const ctx = this.ctx;
    const p = engine.pacman;
    if (!p) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Death animation
    if (p.isDying) {
      const angle = p.deathProgress * Math.PI;
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(0, 0, TILE_SIZE / 2 + 1, angle, Math.PI * 2 - angle);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Invincibility shield effect
    if (engine.settings.invincible) {
      ctx.strokeStyle = `hsl(${(Date.now() / 5) % 360}, 100%, 70%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, TILE_SIZE / 2 + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rotation based on direction
    let rot = 0;
    switch (p.dir) {
      case 'UP':
        rot = -Math.PI / 2;
        break;
      case 'DOWN':
        rot = Math.PI / 2;
        break;
      case 'LEFT':
        rot = Math.PI;
        break;
      case 'RIGHT':
        rot = 0;
        break;
    }
    ctx.rotate(rot);

    const radius = TILE_SIZE / 2 + 1;
    const mouth = p.mouthAngle;

    if (engine.mode === 'PACMAN') {
      // Classic Pac-Man
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(0, 0, radius, mouth * Math.PI, (2 - mouth) * Math.PI);
      ctx.lineTo(0, 0);
      ctx.fill();
    } else if (engine.mode === 'MS_PACMAN') {
      // Ms. Pac-Man: Yellow body + Pink Bow + Eye with lashes + Red Lipstick
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(0, 0, radius, mouth * Math.PI, (2 - mouth) * Math.PI);
      ctx.lineTo(0, 0);
      ctx.fill();

      // Red Lipstick
      ctx.fillStyle = '#ff0044';
      ctx.beginPath();
      ctx.arc(radius * 0.85, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(radius * 0.2, -radius * 0.45, 2, 0, Math.PI * 2);
      ctx.fill();

      // Pink Bow on head
      ctx.fillStyle = '#ff3366';
      ctx.beginPath();
      ctx.arc(-radius * 0.4, -radius * 0.7, 3.5, 0, Math.PI * 2);
      ctx.arc(-radius * 0.8, -radius * 0.7, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-radius * 0.6, -radius * 0.7, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Beauty mark
      ctx.fillStyle = '#222222';
      ctx.fillRect(radius * 0.1, radius * 0.3, 1.5, 1.5);
    } else if (engine.mode === 'CRAZY_OTTO') {
      // Crazy Otto: Yellow body, cartoon legs/shoes, red antenna cap, big eyes
      // Cartoon stick legs running
      const legCycle = Math.sin(Date.now() / 60);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, radius * 0.6);
      ctx.lineTo(-4 + legCycle * 4, radius + 5);
      ctx.moveTo(3, radius * 0.6);
      ctx.lineTo(4 - legCycle * 4, radius + 5);
      ctx.stroke();

      // Red shoes
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(-6 + legCycle * 4, radius + 4, 6, 3);
      ctx.fillRect(2 - legCycle * 4, radius + 4, 6, 3);

      // Body
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(0, 0, radius, mouth * Math.PI, (2 - mouth) * Math.PI);
      ctx.lineTo(0, 0);
      ctx.fill();

      // Big cartoon eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(radius * 0.25, -radius * 0.4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(radius * 0.35, -radius * 0.4, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Red antenna hat on top
      ctx.fillStyle = '#ff1111';
      ctx.fillRect(-2, -radius - 4, 4, 5);
      ctx.beginPath();
      ctx.arc(0, -radius - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (engine.mode === 'COOKIE_MAN') {
      // Cookie Man: Gingerbread baker with frosted edge and chef hat
      ctx.fillStyle = '#c68a4c';
      ctx.beginPath();
      ctx.arc(0, 0, radius, mouth * Math.PI, (2 - mouth) * Math.PI);
      ctx.lineTo(0, 0);
      ctx.fill();

      // White icing border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 1, mouth * Math.PI, (2 - mouth) * Math.PI);
      ctx.stroke();

      // Chocolate drop eye
      ctx.fillStyle = '#4a2511';
      ctx.beginPath();
      ctx.arc(radius * 0.25, -radius * 0.4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Tiny chef hat
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -radius * 0.85, 4, 0, Math.PI * 2);
      ctx.arc(-3, -radius * 0.7, 3, 0, Math.PI * 2);
      ctx.arc(3, -radius * 0.7, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderGhosts(engine: GameEngine) {
    const ctx = this.ctx;

    (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
      const g = engine.ghosts[type];
      ctx.save();
      ctx.translate(g.x, g.y);

      const radius = TILE_SIZE / 2;

      // 1. EATEN (Eyes only)
      if (g.mode === 'EATEN') {
        this.renderGhostEyes(ctx, g.dir);
        ctx.restore();
        return;
      }

      // 2. Body Color
      let bodyColor = GHOST_COLORS[type].body;
      if (g.mode === 'FRIGHTENED') {
        bodyColor = g.flashState ? '#ffffff' : '#2121ff';
      }

      // Crazy Otto mode: draw little walking feet
      if (engine.mode === 'CRAZY_OTTO') {
        const step = Math.sin(Date.now() / 80) * 3;
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(-5 + step, radius, 4, 4);
        ctx.fillRect(2 - step, radius, 4, 4);
      }

      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      // Dome head
      ctx.arc(0, -2, radius, Math.PI, 0, false);
      // Sides down
      ctx.lineTo(radius, radius);

      // Wavy bottom skirt (3 scallops)
      const wave = Math.sin(g.feetAnimation * Math.PI * 2) * 2;
      ctx.lineTo(radius * 0.5, radius - 2 + wave);
      ctx.lineTo(0, radius);
      ctx.lineTo(-radius * 0.5, radius - 2 - wave);
      ctx.lineTo(-radius, radius);
      ctx.closePath();
      ctx.fill();

      // 3. Frightened Face vs Regular Eyes
      if (g.mode === 'FRIGHTENED') {
        // Frightened squiggly mouth & eyes
        const mouthColor = g.flashState ? '#ff0000' : '#ffb8ff';
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
        this.renderGhostEyes(ctx, g.dir);
      }

      ctx.restore();
    });
  }

  private renderGhostEyes(ctx: CanvasRenderingContext2D, dir: Direction) {
    const eyeOffsetX = dir === 'LEFT' ? -2 : dir === 'RIGHT' ? 2 : 0;
    const eyeOffsetY = dir === 'UP' ? -2 : dir === 'DOWN' ? 2 : 0;

    // Sclera (white)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-3.5, -3, 3, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(3.5, -3, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (blue)
    ctx.fillStyle = '#0000bb';
    ctx.beginPath();
    ctx.arc(-3.5 + eyeOffsetX, -3 + eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.arc(3.5 + eyeOffsetX, -3 + eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderFruit(engine: GameEngine) {
    const ctx = this.ctx;
    const f = engine.fruit;
    if (!f || !f.active) return;

    const x = f.col * TILE_SIZE + TILE_SIZE / 2;
    const y = f.row * TILE_SIZE + TILE_SIZE / 2 + (f.bounceY || 0);

    ctx.save();
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.symbol, x, y);
    ctx.restore();
  }

  private renderLearnMode(engine: GameEngine) {
    const ctx = this.ctx;
    const activeVisuals = engine.settings.activeGhostVisuals || {
      BLINKY: true,
      PINKY: true,
      INKY: true,
      CLYDE: true,
    };
    const showCues = engine.settings.learnMode || engine.settings.learnVisualsEnabled;

    (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
      // Check if visual cues are enabled for this specific ghost
      if (activeVisuals[type] === false) return;

      const g = engine.ghosts[type];
      if (g.inHouse) return;

      const ghostColor = GHOST_COLORS[type].body;
      const targetX = g.target.col * TILE_SIZE + TILE_SIZE / 2;
      const targetY = g.target.row * TILE_SIZE + TILE_SIZE / 2;

      // 1. Target Connecting Lines (dashed)
      if (engine.settings.showTargetLines || showCues) {
        ctx.strokeStyle = ghostColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Target Reticle Crosshair
      ctx.strokeStyle = ghostColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Reticle Box
      ctx.strokeRect(g.target.col * TILE_SIZE + 2, g.target.row * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      // Crosshairs
      ctx.moveTo(targetX - 5, targetY);
      ctx.lineTo(targetX + 5, targetY);
      ctx.moveTo(targetX, targetY - 5);
      ctx.lineTo(targetX, targetY + 5);
      ctx.stroke();

      // Inky Pincer Vector Visualization
      if (type === 'INKY' && g.intermediateTarget && (showCues || engine.settings.practiceMode)) {
        const pivotX = g.intermediateTarget.col * TILE_SIZE + TILE_SIZE / 2;
        const pivotY = g.intermediateTarget.row * TILE_SIZE + TILE_SIZE / 2;
        const blinky = engine.ghosts.BLINKY;

        // Draw line from Blinky to Intermediate Pivot
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(blinky.x, blinky.y);
        ctx.lineTo(pivotX, pivotY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small circle at intermediate pivot
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(pivotX, pivotY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Clyde 8-tile radius circle and state label visualization
      if (type === 'CLYDE' && (showCues || engine.settings.practiceMode)) {
        ctx.strokeStyle = 'rgba(255, 184, 82, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.arc(g.x, g.y, 8 * TILE_SIZE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Current Clyde mode tag
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = g.clydeWanderState === 'CHASE' ? '#55ff55' : '#ffaa33';
        ctx.textAlign = 'center';
        ctx.fillText(
          g.clydeWanderState === 'CHASE' ? 'CLYDE: CHASE' : 'CLYDE: FLEE',
          g.x,
          g.y - 12
        );
      }

      // 3. Predicted next path step
      if (engine.settings.showGhostPaths || showCues) {
        ctx.fillStyle = ghostColor;
        const arrowX = g.x + (dirToX(g.dir) * TILE_SIZE) / 2;
        const arrowY = g.y + (dirToY(g.dir) * TILE_SIZE) / 2;
        ctx.beginPath();
        ctx.arc(arrowX, arrowY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private renderScorePopups(engine: GameEngine) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    engine.scorePopups.forEach((popup) => {
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, popup.x, popup.y);
    });

    ctx.restore();
  }

  private renderStateBanners(engine: GameEngine) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = CANVAS_WIDTH / 2;
    const centerY = 20 * TILE_SIZE;

    if (engine.playState === 'READY') {
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = '#ffff00';
      ctx.fillText('READY!', centerX, centerY);
    } else if (engine.playState === 'GAME_OVER') {
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = '#ff0000';
      ctx.fillText('GAME OVER', centerX, centerY);
    } else if (engine.playState === 'PAUSED') {
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = '#00ffff';
      ctx.fillText('PAUSED', centerX, centerY);
    } else if (engine.playState === 'LEVEL_CLEAR') {
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = '#00ff88';
      ctx.fillText('LEVEL CLEARED!', centerX, centerY);
    }

    ctx.restore();
  }

  private renderCRTFilter() {
    const ctx = this.ctx;
    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
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
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}

function dirToX(dir: Direction): number {
  if (dir === 'LEFT') return -1;
  if (dir === 'RIGHT') return 1;
  return 0;
}

function dirToY(dir: Direction): number {
  if (dir === 'UP') return -1;
  if (dir === 'DOWN') return 1;
  return 0;
}
