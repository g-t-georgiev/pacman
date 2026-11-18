import { expect } from "vite-plus/test";
import { createRoot, type Root } from "react-dom/client";
import "../../src/index.css";
import App from "../../src/App";
import type { AgentDriver } from "../../src/agent/AgentDriver";

/**
 * The whole app in the test page (plan T5): the real React UI, keyboard, panels, storage, audio
 * and the real-time loop. `window.pacmanAgent` (dev builds, and the tests) reads and drives it.
 */
let root: Root | null = null;
let host: HTMLElement | null = null;

/** Mounts the app (as a page load: storage and the URL are read now) and waits for the game. */
export async function mountApp(): Promise<AgentDriver> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(<App />);
  await expect.poll(() => window.pacmanAgent, { timeout: 5000 }).toBeDefined();
  return window.pacmanAgent!;
}

/** Unmounts the app, like closing the page (storage stays, as in the browser). */
export function unmountApp(): void {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

/** A fresh browser: no saved preferences, no replay link. */
export function freshBrowser(): void {
  unmountApp();
  localStorage.clear();
  history.replaceState(null, "", location.pathname + location.search);
}

/** The live game, skipped past READY (the real-time loop keeps running). */
export async function playingApp(): Promise<AgentDriver> {
  const agent = await mountApp();
  agent.scenario({ phase: "PLAYING" });
  return agent;
}

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Real frames the loop ran over `ms` of real time. */
export async function framesOver(agent: AgentDriver, ms: number): Promise<number> {
  const before = agent.engine.tick;
  await wait(ms);
  return agent.engine.tick - before;
}
