/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Direction, GameMode, GhostState, GhostType, MazeData } from '../types/game';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GHOST_COLORS, TILE_SIZE } from './constants';
import { GameEngine } from './gameEngine';
import { chooseNextGhostDirection, getDirectionVector } from './ghostAi';

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

    // 1b. Render Tile Grid & Decision Intersections if enabled (Practice Mode)
    if (engine.settings.showGrid) {
      this.renderGrid(engine);
    }

    // 2. Render Fruit / Treats
    this.renderFruit(engine);

    // 3. Render Learn Mode Overlays (Target reticles, Inky vector, Clyde 8-tile radius)
    if (engine.settings.learnMode || engine.settings.learnVisualsEnabled) {
      this.renderLearnMode(engine);
    }

    // 3b. Render Practice Ghost Paths (Multi-Step Lookahead Corridor Trajectories)
    if (engine.settings.showGhostPaths) {
      this.renderPracticeGhostPaths(engine);
    }

    // 3c. Render Practice Target Lines (Tactical Distance Meters & Proximity Radar)
    if (engine.settings.showTargetLines) {
      this.renderPracticeTargetLines(engine);
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
        } else if (tile === 'DOT') {
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
      if (showCues) {
        ctx.strokeStyle = ghostColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Target Reticle Crosshair & Target Tile Coordinates
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

      // Target Coordinate Pill at Reticle
      ctx.save();
      const coordTag = `[${g.target.col},${g.target.row}]`;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = ghostColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(coordTag, targetX, g.target.row * TILE_SIZE);
      ctx.restore();

      // Inky Pincer Vector Visualization
      if (type === 'INKY' && g.intermediateTarget && showCues) {
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

      // Clyde 8-tile radius circle visualization
      if (type === 'CLYDE' && showCues) {
        ctx.strokeStyle = 'rgba(255, 184, 82, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.arc(g.x, g.y, 8 * TILE_SIZE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3. Overhead Ghost Status Badge (Name, Mode, Target Tile Coordinates)
      if (showCues) {
        const ghostName =
          engine.mode === 'MS_PACMAN' && GHOST_COLORS[type].msName
            ? GHOST_COLORS[type].msName.toUpperCase()
            : GHOST_COLORS[type].name.toUpperCase();

        let modeStr = g.mode as string;
        if (g.mode === 'CHASE') {
          if (type === 'CLYDE') {
            modeStr = g.clydeWanderState === 'CHASE' ? 'CHASE' : 'FLEE';
          } else {
            modeStr = 'CHASE';
          }
        } else if (g.mode === 'SCATTER') {
          modeStr = 'SCATTER';
        } else if (g.mode === 'FRIGHTENED') {
          modeStr = 'FRIGHT';
        } else if (g.mode === 'EATEN') {
          modeStr = 'EYES';
        }

        const label = `${ghostName} · ${modeStr} [${g.target.col},${g.target.row}]`;

        ctx.save();
        ctx.font = 'bold 8.5px monospace';
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const badgeW = textWidth + 8;
        const badgeH = 13;

        // Position badge above ghost dome, flip below skirt if too close to top of canvas
        let badgeY = g.y - 18;
        if (badgeY < 6) {
          badgeY = g.y + 12;
        }

        // Clamp horizontally so badge never clips outside canvas edges
        const badgeX = Math.max(4, Math.min(CANVAS_WIDTH - badgeW - 4, g.x - badgeW / 2));

        // Dark rounded pill background with ghost color border
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.strokeStyle = ghostColor;
        ctx.lineWidth = 1;

        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 2.5);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
          ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
        }

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, badgeX + badgeW / 2, badgeY + badgeH / 2);
        ctx.restore();
      }
    });
  }

  /**
   * Practice Mode: Grid Overlay & Decision Intersections
   */
  private renderGrid(engine: GameEngine) {
    const ctx = this.ctx;
    const maze = engine.maze;
    ctx.save();

    // 1. Maze Tile Grid Lines
    ctx.strokeStyle = 'rgba(0, 220, 255, 0.12)';
    ctx.lineWidth = 0.5;

    for (let c = 0; c <= maze.width; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE_SIZE, 0);
      ctx.lineTo(c * TILE_SIZE, maze.height * TILE_SIZE);
      ctx.stroke();
    }
    for (let r = 0; r <= maze.height; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE_SIZE);
      ctx.lineTo(maze.width * TILE_SIZE, r * TILE_SIZE);
      ctx.stroke();
    }

    // 2. Highlight Decision Intersection Tiles (>= 3 walkable exits)
    ctx.fillStyle = 'rgba(0, 255, 180, 0.25)';
    for (let r = 1; r < maze.height - 1; r++) {
      for (let c = 1; c < maze.width - 1; c++) {
        if (maze.tiles[r][c] !== 'WALL') {
          let walkableExits = 0;
          if (maze.tiles[r - 1][c] !== 'WALL') walkableExits++;
          if (maze.tiles[r + 1][c] !== 'WALL') walkableExits++;
          if (maze.tiles[r][c - 1] !== 'WALL') walkableExits++;
          if (maze.tiles[r][c + 1] !== 'WALL') walkableExits++;
          if (walkableExits >= 3) {
            ctx.fillRect(c * TILE_SIZE + 1, r * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          }
        }
      }
    }

    ctx.restore();
  }

  /**
   * Practice Mode: Multi-Step Lookahead Corridor Trajectory
   * Simulates upcoming corridor path 6-8 tiles forward using ghost AI turn decisions!
   */
  private renderPracticeGhostPaths(engine: GameEngine) {
    const ctx = this.ctx;
    const maze = engine.maze;

    (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
      const g = engine.ghosts[type];
      if (g.inHouse) return;

      const ghostColor = GHOST_COLORS[type].body;
      const startCol = Math.floor(g.x / TILE_SIZE);
      const startRow = Math.floor(g.y / TILE_SIZE);

      // Simulate forward corridor trajectory for next 7 steps
      const pathPoints: Array<{ col: number; row: number; dir: Direction }> = [];
      let curCol = startCol;
      let curRow = startRow;
      let curDir = g.dir;

      for (let step = 0; step < 7; step++) {
        const nextDir = chooseNextGhostDirection(g, g.target, maze, curCol, curRow, curDir);
        const { dx, dy } = getDirectionVector(nextDir);
        curCol += dx;
        curRow += dy;
        curDir = nextDir;

        // Boundary checks
        if (curCol < 0 || curCol >= maze.width || curRow < 0 || curRow >= maze.height) break;
        if (maze.tiles[curRow][curCol] === 'WALL') break;

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
      ctx.moveTo(g.x, g.y);
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
          ctx.strokeStyle = '#ffffff';
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
  private renderPracticeTargetLines(engine: GameEngine) {
    const ctx = this.ctx;
    const pacman = engine.pacman;

    (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
      const g = engine.ghosts[type];
      if (g.inHouse) return;

      const ghostColor = GHOST_COLORS[type].body;
      const targetX = g.target.col * TILE_SIZE + TILE_SIZE / 2;
      const targetY = g.target.row * TILE_SIZE + TILE_SIZE / 2;

      // Distance to target in tiles
      const targetDistTiles = (Math.hypot(g.x - targetX, g.y - targetY) / TILE_SIZE).toFixed(1);

      // Distance to Pac-Man in tiles
      const pacDistTiles = Math.hypot(g.x - pacman.x, g.y - pacman.y) / TILE_SIZE;
      const isDangerous = pacDistTiles <= 5.0 && g.mode !== 'FRIGHTENED' && g.mode !== 'EATEN';

      ctx.save();

      // Vector ray to target
      ctx.strokeStyle = isDangerous ? '#ff3344' : ghostColor;
      ctx.lineWidth = isDangerous ? 2 : 1.2;
      ctx.setLineDash(isDangerous ? [6, 2] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Floating tactical badge at midpoint
      const midX = (g.x + targetX) / 2;
      const midY = (g.y + targetY) / 2;

      const label = `${GHOST_COLORS[type].name.toUpperCase()}: ${targetDistTiles}t`;
      ctx.font = 'bold 9px monospace';
      const textWidth = ctx.measureText(label).width;

      // Badge background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.strokeStyle = isDangerous ? '#ff3344' : ghostColor;
      ctx.lineWidth = 1;
      const bx = midX - textWidth / 2 - 4;
      const by = midY - 7;
      const bw = textWidth + 8;
      const bh = 14;

      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
      }

      // Badge text
      ctx.fillStyle = isDangerous ? '#ffdddd' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY);

      // Proximity Danger Alert if ghost is within 5 tiles of Pac-Man
      if (isDangerous) {
        const alertLabel = `⚠️ ${pacDistTiles.toFixed(1)}t PROXIMITY`;
        ctx.font = 'bold 9px monospace';
        const alertWidth = ctx.measureText(alertLabel).width;
        const abx = g.x - alertWidth / 2 - 3;
        const aby = g.y - 20;
        const abw = alertWidth + 6;
        const abh = 13;

        ctx.fillStyle = 'rgba(255, 20, 50, 0.9)';
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(abx, aby, abw, abh, 2);
          ctx.fill();
        } else {
          ctx.fillRect(abx, aby, abw, abh);
        }
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(alertLabel, g.x, aby + abh / 2);
      }

      ctx.restore();
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
