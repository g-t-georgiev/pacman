import type GameEngine from "./GameEngine";
import type { SimEvent } from "./simEvents";
import { arcadeFont } from "./constants";

/**
 * The floating points shown when the fruit is eaten (plan P2: they used to live in the game state,
 * though nothing in the game depends on them). Owned by the runner and built from sim events.
 * A ghost's points are drawn by the renderer from the eat pause itself (`sequencer.state`).
 */
interface Popup {
  text: string;
  x: number;
  y: number;
  /** Frames left. */
  life: number;
  color: string;
}

const LIFE_FRAMES = 50;
const RISE_PER_FRAME = 0.15;

export class ScorePopups {
  private popups: Popup[] = [];

  /** Sim events: a fruit eaten adds its points; a respawn, a new level or a rewind clears them. */
  public onEvents(events: SimEvent[]): void {
    for (const event of events) {
      if (event.type === "FRUIT_EATEN") {
        this.popups.push({
          text: `${event.points}`,
          x: event.x,
          y: event.y,
          life: LIFE_FRAMES,
          color: "#ffcc00",
        });
      }
      const respawnOrLevel = event.type === "PLAY_STATE_CHANGED" && event.playState === "READY";
      if (respawnOrLevel || event.type === "REWOUND") this.clear();
    }
  }

  /** After a sim frame: during play the points rise and fade. */
  public afterTick(engine: GameEngine): void {
    if (engine.phase !== "PLAYING") return;
    for (const popup of this.popups) {
      popup.life--;
      popup.y -= RISE_PER_FRAME;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  public clear(): void {
    this.popups = [];
  }

  public get count(): number {
    return this.popups.length;
  }

  public render(ctx: CanvasRenderingContext2D, px: (v: number) => number): void {
    if (this.popups.length === 0) return;
    ctx.save();
    ctx.font = arcadeFont(12);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const popup of this.popups) {
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, px(popup.x), px(popup.y));
    }
    ctx.restore();
  }
}
