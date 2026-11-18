import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { ensureFont, fontLoaded } from "../../src/utils/fontLoader";
import { freshBrowser, mountApp, unmountApp } from "./app";

beforeEach(freshBrowser);
afterEach(unmountApp);

/** Lit pixels of "HIGH SCORE" in the top row: 1004 in Emulogic, far fewer in a fallback font. */
function highScoreLabelPixels(): number {
  const ctx = document.querySelector("canvas")!.getContext("2d")!;
  const data = ctx.getImageData(9 * 16, 0, 10 * 16, 16).data;
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 128 && data[i + 1] > 128) lit++;
  return lit;
}

describe("e2e: the canvas pixel font", () => {
  it("the game draws its texts in Emulogic", async () => {
    await mountApp();
    await expect.poll(() => fontLoaded("Emulogic")).toBe(true);
    await expect.poll(highScoreLabelPixels).toBe(1004);
  });

  it("a font that failed to load is loaded again once its file is reachable", async () => {
    // Bug seen 2026-11-18: the font request failed once (the dev server was restarting) and the
    // browser never retried it, so every canvas text stayed in a thin fallback font
    expect(await ensureFont("PacTestFont", "fonts/missing.ttf", [])).toBe(false);
    expect(fontLoaded("PacTestFont")).toBe(false);
    expect(await ensureFont("PacTestFont", "fonts/Emulogic.ttf", [])).toBe(true);
    expect(fontLoaded("PacTestFont")).toBe(true);
  });
});
