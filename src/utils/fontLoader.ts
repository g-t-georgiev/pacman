/**
 * The canvas pixel font (Emulogic, declared in `index.css`), made reliable.
 *
 * Canvas text doesn't load fonts by itself, so the game asks for it. And a font request that
 * failed once (the page loaded while the dev server was restarting, a flaky connection) is never
 * retried by the browser: every canvas text would stay in the thin fallback font until a reload.
 * So when the face failed, a fresh one is loaded: right away, after 1, 3 and 10 s, and again
 * whenever the tab comes back into view or the connection comes back. The canvas is redrawn
 * every frame, so its texts switch to the font as soon as it arrives.
 */
const ARCADE_FAMILY = "Emulogic";
const ARCADE_FILE = "fonts/Emulogic.ttf";

/** Whether a working face of `family` is in the document (one that loaded, not one that failed). */
export function fontLoaded(family: string = ARCADE_FAMILY): boolean {
  if (typeof document === "undefined" || !document.fonts) return false;
  return [...document.fonts].some(
    (face) => face.family.replace(/["']/g, "") === family && face.status === "loaded"
  );
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Loads `family` (from its @font-face, else a fresh face from `file`, under the app's base URL),
 * trying again after each delay. Returns whether it is available.
 */
export async function ensureFont(
  family: string,
  file: string,
  retryDelays: number[] = [1000, 3000, 10000]
): Promise<boolean> {
  if (typeof document === "undefined" || !document.fonts) return false;
  for (const delay of [0, ...retryDelays]) {
    if (delay > 0) await wait(delay);
    if (fontLoaded(family)) return true;
    try {
      await document.fonts.load(`16px "${family}"`); // its @font-face, if there is one
    } catch {
      // failed: try a fresh face below
    }
    if (fontLoaded(family)) return true;
    try {
      const face = new FontFace(family, `url(${import.meta.env.BASE_URL}${file})`);
      document.fonts.add(await face.load());
    } catch {
      // still unreachable: wait and try again
    }
    if (fontLoaded(family)) return true;
  }
  return false;
}

/**
 * Loads the arcade font now, with retries, and again when the tab is shown or the connection
 * returns while it is still missing. Returns a function that stops listening.
 */
export function keepArcadeFont(): () => void {
  if (typeof document === "undefined" || !document.fonts) return () => {};
  void ensureFont(ARCADE_FAMILY, ARCADE_FILE);
  const retry = () => {
    if (!fontLoaded(ARCADE_FAMILY) && document.visibilityState === "visible") {
      void ensureFont(ARCADE_FAMILY, ARCADE_FILE, []);
    }
  };
  document.addEventListener("visibilitychange", retry);
  window.addEventListener("online", retry);
  return () => {
    document.removeEventListener("visibilitychange", retry);
    window.removeEventListener("online", retry);
  };
}
