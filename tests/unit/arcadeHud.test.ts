import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import {
  HUD_LAYOUT,
  formatScore,
  fruitShown,
  livesShown,
  renderArcadeHud,
} from "../../src/game/arcadeHud";
import { FRUIT_CATALOG, RENDER_TILE_SIZE as T } from "../../src/game/constants";

/** A canvas context that records the text drawn and how many icons were filled. */
function recordingContext() {
  const texts: Array<{ text: string; col: number; row: number }> = [];
  let fills = 0;
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    arc() {},
    closePath() {},
    fill() {
      fills++;
    },
    fillText(text: string, x: number, y: number) {
      texts.push({ text, col: Math.floor(x / T), row: Math.floor(y / T) });
    },
    font: "",
    textAlign: "",
    textBaseline: "",
    fillStyle: "",
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    texts,
    fills: () => fills,
    /** The characters drawn on a row, as a string indexed by column ("." where empty). */
    row(r: number, width = 28) {
      const line = Array.from({ length: width }, () => ".");
      for (const t of texts) if (t.row === r && t.text.length === 1) line[t.col] = t.text;
      return line.join("");
    },
  };
}

describe("Arcade HUD in the maze's blank rows (T13)", () => {
  it("1UP and HIGH SCORE on row 0, the scores right-aligned under them on row 1", () => {
    const engine = new GameEngine("PACMAN", 10000);
    engine.score = 1230;
    const r = recordingContext();
    renderArcadeHud(r.ctx, engine);
    expect(r.row(0)).toBe("...1UP...HIGH SCORE.........");
    expect(r.row(1)).toBe("...1230.....10000...........");
  });

  it("a zero score shows as 00", () => {
    expect(formatScore(0)).toBe("00");
    expect(formatScore(70)).toBe("70");
    const engine = new GameEngine("PACMAN", 0);
    const r = recordingContext();
    renderArcadeHud(r.ctx, engine);
    expect(r.row(1)).toBe(".....00........00..........."); // both end at their column (6, 16)
  });

  it("1UP blinks while playing", () => {
    const engine = new GameEngine("PACMAN", 0);
    engine.playState = "PLAYING";
    const shown = [0, HUD_LAYOUT.oneUpBlinkFrames].map((tick) => {
      engine.tick = tick;
      const r = recordingContext();
      renderArcadeHud(r.ctx, engine);
      return r.row(0).startsWith("...1UP");
    });
    expect(shown).toEqual([true, false]);
  });

  it("spare lives: the lives beyond the one in play, up to 5", () => {
    expect([1, 2, 3, 4, 9].map(livesShown)).toEqual([0, 1, 2, 3, 5]);
    const engine = new GameEngine("PACMAN", 0);
    const r = recordingContext();
    renderArcadeHud(r.ctx, engine); // a new game: 3 lives, 2 icons
    expect(r.fills()).toBe(2);
  });

  it("fruit: the last 7 levels', newest at the right ending at column 24", () => {
    const sym = (name: keyof typeof FRUIT_CATALOG) => FRUIT_CATALOG[name].symbol;
    expect(fruitShown(1)).toEqual([sym("Cherry")]);
    expect(fruitShown(3)).toEqual([sym("Cherry"), sym("Strawberry"), sym("Peach")]);
    expect(fruitShown(9)).toHaveLength(7);
    expect(fruitShown(9).at(-1)).toBe(sym("Galaxian"));
    expect(fruitShown(9)[0]).toBe(sym("Peach")); // levels 3..9 shown, oldest (level 3) left

    const engine = new GameEngine("PACMAN", 0);
    engine.level = 3;
    const r = recordingContext();
    renderArcadeHud(r.ctx, engine);
    const fruit = r.texts.filter((t) => t.row === 35 || t.row === 34).filter((t) => t.text !== "");
    const cols = fruit.map((t) => t.col);
    expect(Math.max(...cols)).toBe(HUD_LAYOUT.fruitEndCol + 1); // centered on the 2-tile icon
    expect(cols).toEqual([21, 23, 25]);
  });
});
