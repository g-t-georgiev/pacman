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

  it("the chapter list follows the section being read", async () => {
    await page.viewport(1280, 800); // the chapter list shows on wide screens
    history.replaceState(null, "", "#docs/arcade-rules");
    await mountApp();
    const active = () =>
      document.querySelector('nav [aria-current="location"]')?.textContent ?? null;
    // A chapter opens on its first section
    await expect.poll(active).toBe("Units: tiles, pixels and frames");

    // Scrolling down moves the mark to the section under the top of the page
    const box = document.querySelector(".docs-article")!.parentElement!;
    const heading = document.getElementById("docs-scatter-and-chase")!;
    box.scrollTop += heading.getBoundingClientRect().top - box.getBoundingClientRect().top - 40;
    await expect.poll(active).toBe("Scatter and chase");

    // A section near the end, too short to reach the top, stays marked when clicked...
    await page.getByRole("link", { name: "Ms. Pac-Man", exact: true }).click();
    await expect.poll(active).toBe("Ms. Pac-Man");
    // ...and the very bottom marks the last section
    box.scrollTop = 0;
    await expect.poll(active).toBe("Units: tiles, pixels and frames");
    box.scrollTop = box.scrollHeight;
    await expect.poll(active).toBe("Estimates and open questions");
  });

  it("a code block's copy button copies its exact text and says so", async () => {
    await page.viewport(1280, 800);
    history.replaceState(null, "", "#docs/console-recipes/the-length-of-a-death");
    await mountApp();
    const copied: string[] = [];
    const clipboard = navigator.clipboard;
    const original = clipboard.writeText.bind(clipboard);
    clipboard.writeText = (text: string) => {
      copied.push(text);
      return Promise.resolve();
    };
    try {
      await expect
        .element(page.getByRole("heading", { name: /The length of a death/ }))
        .toBeVisible();
      const block = document.getElementById("docs-the-length-of-a-death")!.nextElementSibling!
        .nextElementSibling as HTMLElement; // the heading, its paragraph, then the code
      const button = block.querySelector<HTMLButtonElement>(".docs-copy")!;
      await page.elementLocator(button).click();
      expect(copied).toEqual([block.querySelector("pre code")!.textContent]);
      expect(copied[0]).toMatch(/^const a = pacmanAgent;\n/);
      const label = () => button.getAttribute("aria-label");
      await expect.poll(label).toBe("Copied");
      // Fully opaque while it shows the check mark (it fades in over 0.15 s)
      await expect.poll(() => getComputedStyle(button).opacity).toBe("1");
      // ...then back to the copy icon
      await expect.poll(label, { timeout: 3000 }).toBe("Copy code");
    } finally {
      clipboard.writeText = original;
    }
  });

  it("on a phone, the copy button stays in its corner while the code scrolls under it", async () => {
    await page.viewport(375, 812);
    history.replaceState(null, "", "#docs/console-recipes");
    await mountApp();
    await expect.poll(() => document.querySelectorAll(".docs-code").length).toBeGreaterThan(5);
    const blocks = [...document.querySelectorAll<HTMLElement>(".docs-code")];
    expect(blocks.length).toBeGreaterThan(5);
    for (const block of blocks) {
      block.scrollIntoView({ block: "center" });
      const pre = block.querySelector("pre")!;
      const button = block.querySelector<HTMLElement>(".docs-copy")!;
      pre.scrollLeft = pre.scrollWidth; // scrolled all the way sideways
      const b = button.getBoundingClientRect();
      const p = block.getBoundingClientRect();
      expect(p.right - b.right).toBeLessThan(12); // top right corner
      expect(b.top - p.top).toBeLessThan(12);
      expect(b.right).toBeLessThanOrEqual(innerWidth); // on screen
      // Nothing covers it: the button is what a tap there hits
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      expect(button.contains(hit)).toBe(true);
    }
  });

  describe("on a narrow screen: the ☰ drawer", () => {
    const drawer = () => document.getElementById("docs-drawer")!;
    const menu = () => page.getByRole("button", { name: "Chapters" });
    const marked = () => drawer().querySelector('[aria-current="location"]')?.textContent ?? null;

    it("opens where you are, and picking a section marks it, closes, and shows it", async () => {
      await page.viewport(375, 812);
      history.replaceState(null, "", "#docs/arcade-rules/frightened-mode");
      await mountApp();
      await expect.element(menu()).toHaveAttribute("aria-expanded", "false");

      await menu().click();
      await expect.element(menu()).toHaveAttribute("aria-expanded", "true");
      // The current chapter and section, in view and focused
      expect(drawer().querySelector('[aria-current="page"]')?.textContent).toBe("The arcade rules");
      expect(marked()).toBe("Frightened mode");
      await expect.poll(() => document.activeElement?.textContent).toBe("Frightened mode");

      const link = [...drawer().querySelectorAll("a")].find(
        (a) => a.textContent === "Cruise Elroy"
      )!;
      link.click();
      await expect.poll(marked, { timeout: 100 }).toBe("Cruise Elroy"); // right away
      await expect.element(menu()).toHaveAttribute("aria-expanded", "false");
      expect(location.hash).toBe("#docs/arcade-rules/cruise-elroy");
      await expect.element(page.getByRole("heading", { name: /Cruise Elroy/ })).toBeInViewport();

      // Scrolled on, the drawer opens on the new place
      const box = document.querySelector(".docs-article")!.parentElement!;
      const heading = document.getElementById("docs-the-level-table")!;
      box.scrollTop += heading.getBoundingClientRect().top - box.getBoundingClientRect().top - 40;
      await expect.poll(marked).toBe("The level table");
    });

    it("closes with Escape (the manual stays) and with a tap beside it", async () => {
      await page.viewport(375, 812);
      history.replaceState(null, "", "#docs/playing");
      await mountApp();
      await menu().click();
      await userEvent.keyboard("{Escape}");
      await expect.element(menu()).toHaveAttribute("aria-expanded", "false");
      await expect.element(page.getByRole("dialog", { name: "Manual" })).toBeVisible();

      await menu().click();
      (document.querySelector("#docs-drawer")!.previousElementSibling as HTMLElement).click();
      await expect.element(menu()).toHaveAttribute("aria-expanded", "false");

      // A chapter from the drawer
      await menu().click();
      [...drawer().querySelectorAll("a")].find((a) => a.textContent === "Testing")!.click();
      await expect.poll(() => location.hash).toBe("#docs/testing");
      await expect.element(menu()).toHaveAttribute("aria-expanded", "false");
      await expect.poll(marked).toBe("Commands");
    });
  });
});
