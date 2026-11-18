import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser/context";
import { framesOver, freshBrowser, mountApp, playingApp, unmountApp } from "./app";

beforeEach(freshBrowser);
afterEach(() => {
  unmountApp();
  history.replaceState(null, "", location.pathname + location.search);
});

describe("e2e: the manual (DOC1)", () => {
  it("opens over the game, holds it, and gives it back exactly where it was", async () => {
    const agent = await playingApp();
    await page.getByRole("button", { name: /Manual$/ }).click();
    await expect.element(page.getByRole("dialog", { name: "Manual" })).toBeVisible();
    await expect.poll(() => agent.view().pausedBy).toContain("docs");
    const held = agent.hash();
    expect(await framesOver(agent, 300)).toBe(0);

    // Game keys are the page's now: typing in the search box doesn't steer Pac-Man
    await page.getByRole("searchbox", { name: "Search the manual" }).click();
    await userEvent.keyboard("swap");
    expect(agent.view().pacman.nextDir).toBe("LEFT");
    expect(agent.hash()).toBe(held);

    await userEvent.keyboard("{Escape}"); // clears the search
    await expect.element(page.getByRole("dialog", { name: "Manual" })).toBeVisible();
    await userEvent.keyboard("{Escape}"); // back to the game
    await expect.poll(() => agent.view().pausedBy).toEqual([]);
    expect(location.hash).toBe("");
    expect(await framesOver(agent, 300)).toBeGreaterThan(5);
  });

  it("search finds a section and opens it", async () => {
    await mountApp();
    await page.getByRole("button", { name: /Manual$/ }).click();
    await page.getByRole("searchbox", { name: "Search the manual" }).fill("joystick feel");
    await page.getByRole("option", { name: /Game modes and rules presets/ }).click();
    expect(location.hash).toBe("#docs/playing/game-modes-and-rules-presets");
    await expect
      .element(page.getByRole("heading", { name: /Game modes and rules presets/ }))
      .toBeVisible();
  });

  it("a deep link opens the manual on load, with the game held from the start", async () => {
    history.replaceState(null, "", "#docs/playing/keyboard");
    const agent = await mountApp();
    await expect.element(page.getByRole("heading", { name: /Keyboard/ })).toBeVisible();
    expect(agent.view().pausedBy).toContain("docs");
    expect(agent.view().lifeFrame).toBe(0);
    await page.getByRole("button", { name: /Back to the game/ }).click();
    await expect.poll(() => agent.view().pausedBy).toEqual([]);
  });
});
