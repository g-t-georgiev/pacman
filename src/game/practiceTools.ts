import type GameEngine from "./GameEngine";
import type { SimEvent } from "./simEvents";
import { TILE_SIZE } from "./constants";
import { loadPreference, savePreference } from "../utils/preferences";

/**
 * Practice tools (Phase 5), outside the simulation (nothing here is in GameState):
 *
 * - Patterns: Pac-Man's route through the current life, one point per level frame, saved per
 *   mode and level. Shown as a faint trail with a marker where the route was at this frame, so a
 *   player can follow a pattern (arcade patterns work because the game is deterministic).
 * - First-death heatmap: where Pac-Man first died on each level, over many attempts.
 *
 * The route is keyed by `lifeFrame` (restarts with each level and each life), so a rewind
 * simply overwrites the frames it replays.
 */

/** A route: x, y per level frame (flat: [x0, y0, x1, y1, ...]; NaN = not recorded). */
type Route = number[];

const MAX_DEATHS_PER_LEVEL = 200;
const patternKey = (mode: string, level: number) => `pacman.pattern.${mode}.${level}`;
const deathsKey = (mode: string) => `pacman.deaths.${mode}`;

export class PracticeTools {
  /** The current life's route so far. */
  private route: Route = [];
  /** The route's level and mode (a new level or life starts a new one). */
  private routeOf = "";
  /** A death was already recorded since this level (or a fresh start) began. */
  private diedThisLevel = false;
  private patterns = new Map<string, Route | null>();
  private deaths: Record<string, Record<number, Array<[number, number]>>> = {};

  public showPattern = false;
  public showHeatmap = false;

  /** After every live tick: extends the route (not while watching a replay). */
  public afterTick(engine: GameEngine): void {
    if (engine.watchingReplay || engine.rewindIndex !== -1) return;
    const id = `${engine.mode}.${engine.level}`;
    if (id !== this.routeOf || engine.lifeFrame === 0) {
      this.route = [];
      this.routeOf = id;
    }
    const i = engine.lifeFrame * 2;
    while (this.route.length < i) this.route.push(NaN);
    this.route[i] = engine.pacman.x;
    this.route[i + 1] = engine.pacman.y;
    this.route.length = i + 2; // after a rewind: forget the frames that no longer happened
  }

  /** Sim events: the first death on each level goes into the heatmap. */
  public onEvents(engine: GameEngine, events: SimEvent[]): void {
    if (engine.watchingReplay) return;
    for (const event of events) {
      if (event.type === "LEVEL_CHANGED" || event.type === "INTRO") this.diedThisLevel = false;
      if (event.type === "PACMAN_DIED" && !this.diedThisLevel) {
        this.diedThisLevel = true;
        const col = Math.floor(engine.pacman.x / TILE_SIZE);
        const row = Math.floor(engine.pacman.y / TILE_SIZE);
        const all = this.loadDeaths(engine.mode);
        const list = (all[engine.level] ??= []);
        list.push([col, row]);
        if (list.length > MAX_DEATHS_PER_LEVEL) list.shift();
        savePreference(deathsKey(engine.mode), all);
      }
    }
  }

  /** Saves the current life's route as this level's pattern. Returns its length in frames. */
  public savePattern(engine: GameEngine): number {
    const frames = this.route.length / 2;
    if (frames === 0) return 0;
    const key = patternKey(engine.mode, engine.level);
    // NaN doesn't survive JSON: store gaps as null
    savePreference(
      key,
      this.route.map((v) => (Number.isNaN(v) ? null : v))
    );
    this.patterns.delete(key);
    return frames;
  }

  public clearPattern(engine: GameEngine): void {
    const key = patternKey(engine.mode, engine.level);
    savePreference(key, null);
    this.patterns.set(key, null);
  }

  /** The saved pattern for the engine's mode and level, or null. */
  public pattern(engine: GameEngine): Route | null {
    const key = patternKey(engine.mode, engine.level);
    if (!this.patterns.has(key)) {
      const saved = loadPreference<Array<number | null>>(key);
      this.patterns.set(key, saved ? saved.map((v) => (v === null ? NaN : v)) : null);
    }
    return this.patterns.get(key) ?? null;
  }

  /** First deaths recorded on the engine's current level ([col, row] each). */
  public deathsHere(engine: GameEngine): Array<[number, number]> {
    return this.loadDeaths(engine.mode)[engine.level] ?? [];
  }

  public clearDeaths(engine: GameEngine): void {
    this.deaths[engine.mode] = {};
    savePreference(deathsKey(engine.mode), {});
  }

  private loadDeaths(mode: string): Record<number, Array<[number, number]>> {
    if (!this.deaths[mode]) {
      this.deaths[mode] =
        loadPreference<Record<number, Array<[number, number]>>>(deathsKey(mode)) ?? {};
    }
    return this.deaths[mode];
  }

  /** Draws the pattern trail and marker, and the heatmap (in sim pixels, under the actors). */
  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    px: (v: number) => number
  ): void {
    if (this.showHeatmap) {
      const counts = new Map<string, number>();
      for (const [c, r] of this.deathsHere(engine)) {
        counts.set(`${c},${r}`, (counts.get(`${c},${r}`) ?? 0) + 1);
      }
      const most = Math.max(1, ...counts.values());
      for (const [key, n] of counts) {
        const [c, r] = key.split(",").map(Number);
        ctx.fillStyle = `rgba(255, 40, 40, ${0.25 + 0.55 * (n / most)})`;
        ctx.beginPath();
        ctx.arc(
          px(c * TILE_SIZE + 4),
          px(r * TILE_SIZE + 4),
          px(3 + 3 * (n / most)),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    const route = this.showPattern ? this.pattern(engine) : null;
    if (!route) return;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 0, 0.35)";
    ctx.lineWidth = px(1);
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i < route.length; i += 2) {
      const x = route[i];
      const y = route[i + 1];
      // Gaps, and the tunnel wrap (a jump across the screen), break the line
      const prevX = route[i - 2];
      if (Number.isNaN(x) || (drawing && Math.abs(x - prevX) > TILE_SIZE)) {
        drawing = false;
        if (Number.isNaN(x)) continue;
      }
      if (drawing) ctx.lineTo(px(x), px(y));
      else ctx.moveTo(px(x), px(y));
      drawing = true;
    }
    ctx.stroke();
    // Where the pattern was at this frame: follow the marker
    const i = engine.lifeFrame * 2;
    if (i + 1 < route.length && !Number.isNaN(route[i])) {
      ctx.fillStyle = "rgba(255, 255, 0, 0.45)";
      ctx.beginPath();
      ctx.arc(px(route[i]), px(route[i + 1]), px(5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
