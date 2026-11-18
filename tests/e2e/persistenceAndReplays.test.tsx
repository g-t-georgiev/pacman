import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser/context";
import type { Replay } from "../../src/game/replay";
import { uiConfig } from "../../src/config/ui.config";
import { freshBrowser, mountApp, playingApp, unmountApp, wait } from "./app";
import l1ClearToL2 from "../golden/l1-clear-to-l2.json";
import l3FruitEaten from "../golden/l3-fruit-eaten.json";

beforeEach(freshBrowser);
afterEach(unmountApp);

/** Every golden replay, read by the bundler (the browser has no file system). */
const goldens = import.meta.glob<Replay>("../golden/*.json", { eager: true, import: "default" });

describe("e2e: options, presets and remapped keys", () => {
  it("a remapped key steers Pac-Man, and the mapping survives a reload", async () => {
    let agent = await playingApp();
    await page.getByRole("button", { name: /Options/ }).click();
    await page.getByRole("button", { name: /^Left key 1:/ }).click();
    await userEvent.keyboard("j");
    await expect.element(page.getByRole("button", { name: /^Left key 1: J/ })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect.poll(() => agent.view().pausedBy).toEqual([]);

    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => agent.view().pacman.dir).toBe("RIGHT");
    await userEvent.keyboard("j");
    await expect.poll(() => agent.view().pacman.dir).toBe("LEFT");
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowLeft}"); // no longer bound: Left key 1 is J now
    await wait(200);
    expect(agent.view().pacman.dir).toBe("RIGHT");

    // Reload: the binding is read back from storage
    unmountApp();
    agent = await playingApp();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => agent.view().pacman.dir).toBe("RIGHT");
    await userEvent.keyboard("j");
    await expect.poll(() => agent.view().pacman.dir).toBe("LEFT");
  });

  it("display options and the rules preset survive a reload", async () => {
    let agent = await mountApp();
    expect(agent.engine.settings.reducedFlash).toBe(false);
    expect(agent.engine.rules.emulateRomQuirks).toBe(true); // Arcade by default

    await page.getByRole("button", { name: /Options/ }).click();
    await page.getByRole("checkbox", { name: /Reduce flashing/ }).click();
    await page.getByRole("checkbox", { name: /Colorblind-safe colors/ }).click();
    await page.getByRole("button", { name: "Done" }).click();
    expect(agent.engine.settings.reducedFlash).toBe(true);
    expect(agent.engine.settings.colorblindPalette).toBe(true);

    await page.getByRole("button", { name: /Game Modes/ }).click();
    await page.getByRole("button", { name: /^Modern/ }).click();
    expect(agent.engine.rules.emulateRomQuirks).toBe(false);
    await userEvent.keyboard("{Escape}");

    unmountApp();
    agent = await mountApp();
    expect(agent.engine.settings.reducedFlash).toBe(true);
    expect(agent.engine.settings.colorblindPalette).toBe(true);
    expect(agent.engine.rules.emulateRomQuirks).toBe(false);
    await page.getByRole("button", { name: /Game Modes/ }).click();
    await expect
      .element(page.getByRole("button", { name: /^Modern/ }))
      .toHaveAttribute("aria-pressed", "true");
  });
});

describe("e2e: replays", () => {
  it("a replay link opens the viewer, which plays the clip to its end", async () => {
    let agent = await playingApp();
    await wait(1500); // record some live play
    const link = await agent.replayLink(1);
    unmountApp();

    history.replaceState(null, "", new URL(link).hash);
    agent = await mountApp();
    await expect.poll(() => agent.watching()?.active, { timeout: 5000 }).toBe(true);
    const state = agent.watching()!;
    expect(state.versionNote).toBeNull(); // made by this build
    await expect
      .poll(() => agent.watching()!.tick, { timeout: 8000, interval: 100 })
      .toBe(state.endTick);
    expect(agent.watching()!.divergedAt).toBeNull();
    // Escape leaves the viewer, back to the live game, and the link is used up
    await userEvent.keyboard("{Escape}");
    expect(agent.watching()!.active).toBe(false);
    expect(location.hash).toBe("");
  });

  it("every golden replay runs in the browser exactly as headless", async () => {
    const agent = await mountApp();
    const names = Object.keys(goldens);
    expect(names.length).toBeGreaterThanOrEqual(9);
    for (const name of names) {
      // On a separate engine, checking every recorded state hash
      expect(agent.verifyReplay(goldens[name]), name).toMatchObject({
        matched: true,
        divergedAt: null,
      });
    }
  });

  it.each([
    ["l1-clear-to-l2", l1ClearToL2],
    ["l3-fruit-eaten", l3FruitEaten],
  ])(
    "%s plays in the live game's viewer without diverging",
    async (_name, golden) => {
      const agent = await mountApp();
      const replay = golden as unknown as Replay;
      agent.setSpeed(12); // 60 s of play in seconds; the real-time loop still runs every tick
      agent.watchReplay(replay);
      await expect
        .poll(() => agent.watching()!.tick, { timeout: 40_000, interval: 100 })
        .toBe(replay.endTick);
      expect(agent.watching()!.divergedAt).toBeNull();
      // Bug fixed 2026-11-18: a game over inside the clip (l3-fruit-eaten ends in one) opened the
      // Restart panel, which held the game and froze the viewer 130 frames before the end
      await wait(uiConfig.timings.gameOverRestartDelayMs + 300);
      expect(document.body.innerText).not.toMatch(/START NEW GAME/);
    },
    45_000
  );
});
