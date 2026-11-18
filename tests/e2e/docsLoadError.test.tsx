import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser/context";
import { createRoot, type Root } from "react-dom/client";
import { Suspense, lazy } from "react";
import "../../src/index.css";
import { DocsErrorBoundary } from "../../src/components/DocsErrorBoundary";

/**
 * The manual's code is loaded when it is first opened. When that load fails (server down, a new
 * deploy), a page explains it instead of the whole app going blank. Checked by hand against a
 * real failed load of the production build (2026-11-18): the fallback shows, and "Try again"
 * opens the manual once its file is back.
 */
let root: Root | null = null;
afterEach(() => {
  root?.unmount();
  root = null;
  vi.restoreAllMocks();
});

/** A lazy component whose code can't be loaded, like the manual's chunk with the server down. */
const Unloadable = lazy(() =>
  Promise.reject(new TypeError("Failed to fetch dynamically imported module"))
);

function show(attempt: number, onRetry: () => void, onClose: () => void): void {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    <DocsErrorBoundary attempt={attempt} onRetry={onRetry} onClose={onClose}>
      <Suspense fallback={<p>Opening the manual…</p>}>
        <Unloadable />
      </Suspense>
    </DocsErrorBoundary>
  );
}

describe("e2e: the manual fails to load", () => {
  it("says so, and offers to try again or go back to the game", async () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    show(0, onRetry, onClose);

    await expect
      .element(page.getByRole("alertdialog", { name: /Couldn't open the manual/ }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Reload the page" }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    await page.getByRole("button", { name: /Back to the game/ }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("after a failed retry, also offers a full reload", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    show(
      1,
      () => {},
      () => {}
    );
    await expect.element(page.getByRole("button", { name: "Reload the page" })).toBeVisible();
  });
});
