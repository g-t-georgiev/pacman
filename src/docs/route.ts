/**
 * The manual's address in the URL fragment: `#docs`, `#docs/<chapter>` or
 * `#docs/<chapter>/<section>`. Kept apart from the manual itself (`manual.ts`, its Markdown and
 * renderer), so the game's bundle only carries this; the page loads the rest when it opens.
 */
export interface DocsRoute {
  /** A chapter's slug; "" (or an unknown one) shows the first chapter. */
  chapter: string;
  anchor: string | null;
}

/** The docs route in a URL fragment, or null when the fragment is not a docs link. */
export function parseDocsHash(hash: string): DocsRoute | null {
  const m = /^#docs(?:\/([^/]*))?(?:\/(.*))?$/.exec(hash);
  if (!m) return null;
  return { chapter: m[1] ?? "", anchor: m[2] ? decodeURIComponent(m[2]) : null };
}

export function docsHash(route: DocsRoute): string {
  if (!route.chapter) return "#docs";
  return `#docs/${route.chapter}${route.anchor ? `/${encodeURIComponent(route.anchor)}` : ""}`;
}

/** Goes to a docs route (a new history entry: the browser's Back button walks back through it). */
export function openDocs(route: DocsRoute): void {
  location.hash = docsHash(route);
}
