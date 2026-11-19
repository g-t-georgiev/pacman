import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser/context";
import soundEngine from "../../src/audio/SoundEngine";
import type { Scenario } from "../../src/agent/AgentDriver";
import { framesOver, freshBrowser, mountApp, playingApp, unmountApp, wait } from "./app";

/**
 * Pac-Man waits against the wall above his start; Blinky, chasing, comes along the row and catches
 * him in about 40 frames. (Two actors heading at each other can swap tiles in one frame and pass
 * through each other, as in the arcade, so the collision needs one of them standing still.)
 */
const blinkyCatchesPacman: Scenario = {
  phase: "PLAYING",
  waveIndex: 1,
  pacman: { col: 14, row: 26, dir: "UP" },
  ghosts: { BLINKY: { col: 9, row: 26, dir: "RIGHT" } },
};

beforeEach(freshBrowser);
afterEach(unmountApp);

describe("e2e: the game loads and plays", () => {
  it("loads, shows READY, then plays in real time", async () => {
    const agent = await mountApp();
    expect(document.querySelector("canvas")).not.toBeNull();
    expect(agent.view().phase).toBe("READY");
    // READY lasts a few seconds on a new game, then play starts on its own
    await expect.poll(() => agent.view().phase, { timeout: 8000, interval: 100 }).toBe("PLAYING");
    const frames = await framesOver(agent, 500);
    expect(frames).toBeGreaterThan(20); // about 30 at 60 Hz
    expect(agent.view().pausedBy).toEqual([]);
  });

  it("arrow keys and WASD steer Pac-Man", async () => {
    const agent = await playingApp();
    expect(agent.view().pacman.dir).toBe("LEFT"); // he starts moving left
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => agent.view().pacman.dir).toBe("RIGHT");
    await userEvent.keyboard("a");
    await expect.poll(() => agent.view().pacman.dir).toBe("LEFT");
    const x = agent.view().pacman.x;
    await wait(300);
    expect(agent.view().pacman.x).toBeLessThan(x); // and he really moves
  });

  it("Space pauses and resumes; Escape does too with nothing open", async () => {
    const agent = await playingApp();
    await userEvent.keyboard(" ");
    expect(agent.view().pausedBy).toEqual(["user"]);
    expect(await framesOver(agent, 300)).toBe(0);
    await userEvent.keyboard(" ");
    expect(agent.view().pausedBy).toEqual([]);
    expect(await framesOver(agent, 300)).toBeGreaterThan(5);
    await userEvent.keyboard("{Escape}");
    expect(agent.view().pausedBy).toEqual(["user"]);
    await userEvent.keyboard("{Escape}");
    expect(agent.view().pausedBy).toEqual([]);
  });

  it("the ⏸ button pauses and resumes, and says who holds the game", async () => {
    // Bug seen 2026-11-19: the button was dev-only, so the published game had no pause button
    const agent = await playingApp();
    await page.getByRole("button", { name: "Pause" }).click();
    expect(agent.view().pausedBy).toEqual(["user"]);
    expect(await framesOver(agent, 300)).toBe(0);
    const resume = page.getByRole("button", { name: "Resume" });
    await expect.element(resume).toBeVisible();
    expect(resume.element().getAttribute("title")).toMatch(/^Paused by: user/);
    await resume.click();
    expect(agent.view().pausedBy).toEqual([]);
    expect(await framesOver(agent, 300)).toBeGreaterThan(5);
  });

  it("a panel holds the game until it closes", async () => {
    const agent = await playingApp();
    await userEvent.keyboard("l"); // the Lab
    await expect.poll(() => agent.view().pausedBy).toContain("panel");
    expect(await framesOver(agent, 300)).toBe(0);
    await userEvent.keyboard("{Escape}"); // closes it
    await expect.poll(() => agent.view().pausedBy).toEqual([]);
    expect(await framesOver(agent, 300)).toBeGreaterThan(5);

    await page.getByRole("button", { name: /Options/ }).click();
    await expect.poll(() => agent.view().pausedBy).toContain("panel");
    await page.getByRole("button", { name: "Done" }).click();
    await expect.poll(() => agent.view().pausedBy).toEqual([]);
  });

  it("an open panel closes when Pac-Man dies", async () => {
    const agent = await playingApp();
    await userEvent.keyboard("l");
    await expect.poll(() => agent.view().pausedBy).toContain("panel");
    // Step the held game into the collision
    agent.pause();
    agent.scenario(blinkyCatchesPacman);
    const result = agent.step(60);
    expect(result.view.phase.startsWith("DEATH")).toBe(true);
    await expect.poll(() => agent.view().pausedBy).not.toContain("panel");
  });

  it("R after a game over goes back to just before the fatal collision", async () => {
    const agent = await playingApp();
    agent.engine.lives = 1;
    agent.scenario(blinkyCatchesPacman);
    // Death, then GAME OVER, then the Restart panel (all in real time)
    await expect.poll(() => agent.view().phase, { timeout: 8000, interval: 100 }).toBe("GAME_OVER");
    await expect
      .poll(() => document.body.innerText, { timeout: 8000, interval: 100 })
      .toMatch(/GAME OVER/);
    await userEvent.keyboard("r");
    const v = agent.view();
    expect(v.phase).toBe("PLAYING");
    expect(v.lives).toBe(1);
    expect(v.pausedBy).toContain("user"); // held there until Space
    // Blinky is still a few tiles away: about 2 s before he caught Pac-Man
    expect(Math.abs(v.ghosts.BLINKY.col - v.pacman.col)).toBeGreaterThan(1);
  });

  it("the siren follows the game", async () => {
    const agent = await mountApp();
    soundEngine.setEnabled(true);
    expect(soundEngine.sirenStatus.kind).toBe("NONE"); // READY: the start tune, no siren
    agent.scenario({ phase: "PLAYING" });
    await expect.poll(() => soundEngine.sirenStatus.kind).toBe("NORMAL");
    agent.scenario({ phase: "PLAYING", frightened: true });
    await expect.poll(() => soundEngine.sirenStatus.kind).toBe("FRIGHTENED");
    await userEvent.keyboard(" ");
    await expect.poll(() => soundEngine.sirenStatus.kind).toBe("NONE"); // paused
    await userEvent.keyboard(" ");
    await expect.poll(() => soundEngine.sirenStatus.kind).toBe("FRIGHTENED");
  });
});
