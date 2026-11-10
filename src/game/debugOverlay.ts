import type GameEngine from "./GameEngine";
import type { Ghost } from "../core/Ghost";
import { Pacman } from "../core/Pacman";
import type { DebugLayers, Direction, GhostType, MazeData, TileCoord } from "../types";
import {
  CANVAS_WIDTH,
  CORNER_WINDOW_HIGH,
  CORNER_WINDOW_LOW,
  GHOST_COLORS,
  RENDER_SCALE,
  RENDER_TILE_SIZE as T,
  SIM_FPS,
  TILE_SIZE,
} from "./constants";
import { getDirectionVector, isTileNoUpZone } from "./ghostAiUtils";
import { getScatterChaseSchedule } from "../utils";
import { ghostSpeed, pacmanSpeed } from "./speedSource";
import {
  GLOBAL_COUNTER_END,
  GLOBAL_RELEASE_INKY,
  GLOBAL_RELEASE_PINKY,
  HOUSE_GHOSTS,
  getHouseDotLimit,
  getHouseIdleLimit,
} from "../controllers/HouseController";

/** Labels for the overlay's layer toggles (panel and docs), in display order. */
export const DEBUG_LAYER_LABELS: Record<keyof DebugLayers, string> = {
  grid: "Tile grid",
  occupiedTiles: "Occupied tiles",
  targets: "Ghost targets",
  decisions: "Ghost decisions",
  zones: "No-up & tunnel zones",
  intersections: "Intersections",
  cornerWindow: "Pac-Man turn window",
  readout: "Speed readout",
  timeline: "Timeline & house",
};

/** Sim pixels to canvas pixels. */
const px = (v: number) => v * RENDER_SCALE;
const tileCenter = (t: number) => t * T + T / 2;

/**
 * The debug overlay (plan T1-T3): independent layers drawn over the game, in canvas space.
 * Everything here only reads the engine.
 */
export function renderDebugOverlay(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const layers = engine.settings.debugLayers;
  ctx.save();
  if (layers.zones) drawZones(ctx, engine.maze);
  if (layers.intersections) drawIntersections(ctx, engine.maze);
  if (layers.grid) drawGrid(ctx, engine.maze);
  if (layers.occupiedTiles) drawOccupiedTiles(ctx, engine);
  if (layers.targets) drawTargets(ctx, engine);
  if (layers.decisions) drawDecisions(ctx, engine);
  if (layers.cornerWindow) drawCornerWindow(ctx, engine);
  if (layers.readout) drawReadout(ctx, engine);
  if (layers.timeline) {
    drawTimeline(ctx, engine);
    drawHousePanel(ctx, engine);
  }
  ctx.restore();
}

// --- Maze layers ---------------------------------------------------------------------------------

function drawGrid(ctx: CanvasRenderingContext2D, maze: MazeData): void {
  ctx.strokeStyle = "rgba(0, 220, 255, 0.18)";
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
}

function drawZones(ctx: CanvasRenderingContext2D, maze: MazeData): void {
  for (let r = 0; r < maze.height; r++) {
    for (let c = 0; c < maze.width; c++) {
      if (isTileNoUpZone(c, r, maze)) {
        ctx.fillStyle = "rgba(255, 230, 0, 0.35)";
        ctx.fillRect(c * T, r * T, T, T);
      }
    }
  }
  // Ghost tunnel slow zones: the tunnel rows, 6 tiles in from each edge
  ctx.fillStyle = "rgba(190, 80, 255, 0.3)";
  for (const t of maze.tunnels) {
    ctx.fillRect(0, t.y * T, 6 * T, T);
    ctx.fillRect((maze.width - 6) * T, t.y * T, 6 * T, T);
  }
}

const STEPS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

/**
 * The maze's corridors: every tile Pac-Man can reach from his spawn (tunnels wrap). Blank rows
 * above and below the maze and the empty areas outside its walls are not corridors.
 */
export function corridorTiles(maze: MazeData): Set<string> {
  const key = (c: number, r: number) => `${c},${r}`;
  const start = maze.pacmanSpawn.candidates[0];
  const seen = new Set<string>([key(start.col, start.row)]);
  const queue: Array<[number, number]> = [[start.col, start.row]];
  while (queue.length > 0) {
    const [col, row] = queue.shift()!;
    for (const [dc, dr] of STEPS) {
      const c = (col + dc + maze.width) % maze.width; // tunnel wrap
      const r = row + dr;
      if (r < 0 || r >= maze.height || seen.has(key(c, r)) || !Pacman.isOpen(c, r, maze)) continue;
      seen.add(key(c, r));
      queue.push([c, r]);
    }
  }
  return seen;
}

/** Intersections derived from the tiles: corridor tiles with three or more corridor exits (A4). */
export function deriveIntersections(maze: MazeData): TileCoord[] {
  const corridors = corridorTiles(maze);
  const out: TileCoord[] = [];
  for (let row = 0; row < maze.height; row++) {
    for (let col = 0; col < maze.width; col++) {
      if (!corridors.has(`${col},${row}`)) continue;
      const exits = STEPS.filter(([dc, dr]) =>
        corridors.has(`${(col + dc + maze.width) % maze.width},${row + dr}`)
      ).length;
      if (exits >= 3) out.push({ col, row });
    }
  }
  return out;
}

/**
 * Green: derived and in the maze's list. Orange: derived but missing from the list. Red: listed
 * but not an intersection by the tiles.
 */
function drawIntersections(ctx: CanvasRenderingContext2D, maze: MazeData): void {
  const key = (t: TileCoord) => `${t.col},${t.row}`;
  const derived = deriveIntersections(maze);
  const listed = new Set((maze.intersections ?? []).map(key));
  const derivedKeys = new Set(derived.map(key));
  for (const t of derived) {
    ctx.fillStyle = listed.has(key(t)) ? "rgba(40, 255, 80, 0.35)" : "rgba(255, 150, 0, 0.5)";
    ctx.fillRect(t.col * T, t.row * T, T, T);
  }
  for (const t of maze.intersections ?? []) {
    if (derivedKeys.has(key(t))) continue;
    ctx.fillStyle = "rgba(255, 40, 40, 0.5)";
    ctx.fillRect(t.col * T, t.row * T, T, T);
  }
}

// --- Actor layers --------------------------------------------------------------------------------

function ghostColor(type: GhostType): string {
  return GHOST_COLORS[type].body;
}

function visibleGhosts(engine: GameEngine): Ghost[] {
  return Object.values(engine.ghosts).filter((g) => !g.inHouse);
}

function drawOccupiedTiles(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const actors: Array<[string, { x: number; y: number; tileCoord: TileCoord }]> = [
    ["#ffff00", engine.pacman],
    ...Object.values(engine.ghosts).map((g): [string, Ghost] => [ghostColor(g.type), g]),
  ];
  ctx.lineWidth = 1.5;
  for (const [color, a] of actors) {
    const { col, row } = a.tileCoord;
    ctx.strokeStyle = color;
    ctx.strokeRect(col * T + 1, row * T + 1, T - 2, T - 2);
    // Exact sim position (the pixel the game uses for its tile)
    ctx.fillStyle = color;
    ctx.fillRect(px(a.x) - 1, px(a.y) - 1, 2, 2);
  }
}

function drawTargets(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  ctx.lineWidth = 1;
  for (const g of visibleGhosts(engine)) {
    if (!g.target) continue; // frightened: no target
    const tx = tileCenter(g.target.col);
    const ty = tileCenter(g.target.row);
    ctx.strokeStyle = ghostColor(g.type);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px(g.x), px(g.y));
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeRect(g.target.col * T + 2, g.target.row * T + 2, T - 4, T - 4);
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dir: Direction,
  color: string,
  solid: boolean
): void {
  const { dx, dy } = getDirectionVector(dir);
  if (dx === 0 && dy === 0) return;
  const len = T * 0.42;
  const tipX = cx + dx * len;
  const tipY = cy + dy * len;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = solid ? 1 : 0.55;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - dx * len * 0.6, cy - dy * len * 0.6);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - dx * 5 - dy * 4, tipY - dy * 5 - dx * 4);
  ctx.lineTo(tipX - dx * 5 + dy * 4, tipY - dy * 5 + dx * 4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Whether the ghost has yet to reach its current tile's center (moving toward it). */
function beforeCenter(g: Ghost): boolean {
  const { col, row } = g.tileCoord;
  const cx = col * TILE_SIZE + TILE_SIZE / 2;
  const cy = row * TILE_SIZE + TILE_SIZE / 2;
  const { dx, dy } = getDirectionVector(g.dir);
  return dx * (cx - g.x) + dy * (cy - g.y) > 0;
}

/**
 * Solid arrow: the turn the ghost takes at the next tile center it reaches (nextDir).
 * Faint arrow: the turn already decided for the tile after that (plannedDir, F14).
 */
function drawDecisions(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  for (const g of visibleGhosts(engine)) {
    if (g.location === "ENTERING" || g.nextDir === "NONE") continue;
    const color = ghostColor(g.type);
    const { col, row } = g.tileCoord;
    let at = { col, row };
    if (!beforeCenter(g)) {
      const v = getDirectionVector(g.dir);
      at = { col: col + v.dx, row: row + v.dy };
    }
    drawArrow(ctx, tileCenter(at.col), tileCenter(at.row), g.nextDir, color, true);
    if (g.plannedDir !== "NONE" && g.lastDecisionTile) {
      const p = g.lastDecisionTile;
      drawArrow(ctx, tileCenter(p.col), tileCenter(p.row), g.plannedDir, color, false);
    }
  }
}

/**
 * Pac-Man's turn window on his lane: the pixels (center -3 .. +4) that belong to the turn
 * center he is in. Green when his buffered direction is open at that center, grey otherwise.
 */
function drawCornerWindow(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const p = engine.pacman;
  if (p.dir === "NONE") return;
  const horizontal = p.dir === "LEFT" || p.dir === "RIGHT";
  const along = horizontal ? p.x : p.y;
  const lane = horizontal ? p.y : p.x;
  const center = Pacman.turnCenter(along);
  const from = center - CORNER_WINDOW_LOW;
  const to = center + CORNER_WINDOW_HIGH;

  const nextVertical = p.nextDir === "UP" || p.nextDir === "DOWN";
  const nextHorizontal = p.nextDir === "LEFT" || p.nextDir === "RIGHT";
  const perpendicular = horizontal ? nextVertical : nextHorizontal;
  let open = false;
  if (perpendicular) {
    const col = Math.floor((horizontal ? center : lane) / TILE_SIZE);
    const row = Math.floor((horizontal ? lane : center) / TILE_SIZE);
    const { dx, dy } = getDirectionVector(p.nextDir);
    open = Pacman.isOpen(col + dx, row + dy, engine.maze);
  }

  ctx.fillStyle = open ? "rgba(60, 255, 90, 0.45)" : "rgba(200, 200, 200, 0.25)";
  const band = 3;
  if (horizontal) ctx.fillRect(px(from), px(lane) - band, px(to - from + 1), band * 2);
  else ctx.fillRect(px(lane) - band, px(from), band * 2, px(to - from + 1));
  ctx.fillStyle = "#ffffff";
  if (horizontal) ctx.fillRect(px(center), px(lane) - band - 2, px(1), band * 2 + 4);
  else ctx.fillRect(px(lane) - band - 2, px(center), band * 2 + 4, px(1));
}

/** Per actor: "80% normal 1px" (speed %, its source, pixels moved this frame). */
function drawReadout(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const label = (pct: number, source: string, steps: number) =>
    `${pct}% ${source.replace(/^(pacman|ghost)-/, "")} ${steps}px`;

  const pac = pacmanSpeed(engine);
  ctx.fillStyle = "#ffff00";
  ctx.fillText(
    label(pac.pct, pac.source, engine.pacman.speed),
    px(engine.pacman.x),
    px(engine.pacman.y) - T * 0.7
  );
  for (const g of Object.values(engine.ghosts)) {
    const s = ghostSpeed(engine, g);
    ctx.fillStyle = ghostColor(g.type);
    ctx.fillText(label(s.pct, s.source, g.speed), px(g.x), px(g.y) - T * 0.7);
  }
}

// --- Timeline and house (T2) ---------------------------------------------------------------------

/**
 * The level's scatter/chase schedule in the bottom dead rows: one segment per wave (equal
 * widths; labels give the length), the current wave filling up, reversal ticks at every switch,
 * and frightened time while it pauses the wave timer.
 */
function drawTimeline(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const schedule = getScatterChaseSchedule(engine.level);
  const timers = engine.timerController;
  const top = 34 * T + 4;
  const height = T - 6;
  const margin = 4;
  const width = (CANVAS_WIDTH - margin * 2) / schedule.length;

  ctx.font = "bold 8px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  schedule.forEach((wave, i) => {
    const x = margin + i * width;
    const scatter = wave.mode === "SCATTER";
    ctx.fillStyle = scatter ? "rgba(80, 160, 255, 0.25)" : "rgba(255, 80, 80, 0.25)";
    ctx.fillRect(x + 1, top, width - 2, height);
    if (i < timers.waveIndex || (i === timers.waveIndex && wave.frames !== Infinity)) {
      const done = i < timers.waveIndex ? 1 : Math.min(1, timers.waveTimer / wave.frames);
      ctx.fillStyle = scatter ? "rgba(80, 160, 255, 0.75)" : "rgba(255, 80, 80, 0.75)";
      ctx.fillRect(x + 1, top, (width - 2) * done, height);
    }
    if (i === timers.waveIndex) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1, top, width - 2, height);
    }
    // Reversal tick at every switch
    if (i > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 0.5, top - 2, 1, height + 4);
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      `${scatter ? "S" : "C"} ${formatSeconds(wave.frames)}`,
      x + width / 2,
      top + height / 2
    );
  });

  const label =
    timers.frightenedGlobalTimer > 0
      ? `FRIGHT ${(timers.frightenedGlobalTimer / SIM_FPS).toFixed(1)}s (wave timer paused)`
      : `${timers.currentWave?.mode ?? "CHASE"} ${(timers.waveTimer / SIM_FPS).toFixed(1)}s`;
  ctx.textAlign = "left";
  ctx.fillStyle = timers.frightenedGlobalTimer > 0 ? "#6f8cff" : "#cccccc";
  ctx.fillText(`L${engine.level} ${label}`, margin, 35 * T + T / 2);
}

function formatSeconds(frames: number): string {
  if (frames === Infinity) return "∞";
  if (frames === 1) return "1f";
  const s = frames / SIM_FPS;
  return s >= 60 ? `${Math.round(s / 60)}m` : `${Math.round(s)}s`;
}

/** Ghost house counters in the top dead rows (Dossier "Home Sweet Home"; plan F6/F11/F13). */
function drawHousePanel(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const house = engine.houseController.state;
  const level = engine.level;
  ctx.font = "bold 9px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  let x = 6;
  const y1 = T / 2 + 2;
  for (const type of HOUSE_GHOSTS) {
    const g = engine.ghosts[type];
    const out = g.location !== "HOUSE";
    const text = out
      ? `${type} out`
      : `${type} ${house.dotCounters[type]}/${getHouseDotLimit(type, level)}`;
    ctx.fillStyle = ghostColor(type);
    ctx.fillText(text, x, y1);
    x += ctx.measureText(text).width + 14;
  }

  const idle = `${(house.idleFrames / SIM_FPS).toFixed(1)}/${(getHouseIdleLimit(level) / SIM_FPS).toFixed(0)}s`;
  const global = house.globalCounterActive
    ? `ON ${house.globalCounter} (${GLOBAL_RELEASE_PINKY}/${GLOBAL_RELEASE_INKY}/${GLOBAL_COUNTER_END})`
    : "off";
  const elroy = engine.ghosts.BLINKY.elroyStage;
  const line2 =
    `GLOBAL ${global}  IDLE ${idle}  ELROY ${elroy}` +
    (house.elroySuspended ? " (suspended)" : "") +
    `  DOTS ${engine.dotsRemaining}`;
  ctx.fillStyle = "#cccccc";
  ctx.fillText(line2, 6, T + T / 2 + 4);
}
