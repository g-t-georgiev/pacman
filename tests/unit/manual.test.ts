/// <reference types="node" />
import { describe, expect, it } from "vite-plus/test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { anchorId, parseChapter, renderChapter, slugOfFile } from "../../src/docs/manual";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";

/**
 * The manual is checked like code (plan DOC10): its links and anchors resolve, the repository
 * files it points to exist, every source file is in the files reference, and the console
 * recipes marked `js run` really run (on a headless game).
 */
const MANUAL_DIR = "docs/manual";

// Read from disk, not through the bundled glob (a test run's module cache can miss a new chapter)
const CHAPTERS = readdirSync(MANUAL_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => parseChapter(f, readFileSync(join(MANUAL_DIR, f), "utf8")));
const chapterBySlug = (slug: string) => CHAPTERS.find((c) => c.slug === slug);

/** Markdown links outside code blocks: [text](target). */
function linksOf(markdown: string): string[] {
  const prose = markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  return [...prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
}

/** Every file under a folder, as repository paths with forward slashes. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path.split("\\").join("/")];
  });
}

describe("The manual (DOC10)", () => {
  it("has its chapters, each with a title", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(10);
    for (const c of CHAPTERS) expect(c.title, c.file).not.toBe(c.slug);
  });

  it("every link between chapters and to a section resolves", () => {
    const broken: string[] = [];
    for (const chapter of CHAPTERS) {
      for (const href of linksOf(chapter.markdown)) {
        if (/^https?:\/\//.test(href)) continue;
        const m = /^(?:\.\/)?(?:([\w-]+)\.md)?(?:#(.*))?$/.exec(href);
        if (!m || (!m[1] && !m[2])) continue; // a repository file: checked below
        const target = m[1] ? chapterBySlug(slugOfFile(m[1])) : chapter;
        if (!target) {
          broken.push(`${chapter.file}: ${href} (no such chapter)`);
          continue;
        }
        if (m[1] && !existsSync(join(MANUAL_DIR, `${m[1]}.md`))) {
          broken.push(`${chapter.file}: ${href} (file name differs)`);
        }
        if (m[2] && !target.sections.some((s) => s.anchor === m[2])) {
          broken.push(`${chapter.file}: ${href} (no such section)`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("the page gives every section the anchor its links use", () => {
    for (const chapter of CHAPTERS) {
      const html = renderChapter(chapter);
      const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      const anchors = chapter.sections.filter((x) => x.depth > 1).map((x) => anchorId(x.anchor));
      expect(ids, chapter.file).toEqual(anchors);
    }
  });

  it("every code block gets a copy button", () => {
    for (const chapter of CHAPTERS) {
      const html = renderChapter(chapter);
      const blocks = (html.match(/<pre>/g) ?? []).length;
      const buttons = (html.match(/class="docs-copy"/g) ?? []).length;
      expect(buttons, chapter.file).toBe(blocks);
    }
  });

  it("every repository file it links to exists", () => {
    const missing: string[] = [];
    for (const chapter of CHAPTERS) {
      for (const href of linksOf(chapter.markdown)) {
        if (/^https?:\/\//.test(href) || /^(?:\.\/)?(?:[\w-]+\.md)?(?:#.*)?$/.test(href)) continue;
        const path = posix.normalize(posix.join(MANUAL_DIR, href.replace(/#.*$/, "")));
        if (!existsSync(path)) missing.push(`${chapter.file}: ${href}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("names every source file in the files reference", () => {
    const reference = chapterBySlug("files-and-scripts")?.markdown ?? "";
    const missing = filesUnder("src")
      .filter((f) => /\.(ts|tsx|css)$/.test(f))
      .map((f) => relative(".", f).split("\\").join("/"))
      .filter((f) => !reference.includes(f.replace(/^src\//, "")));
    expect(missing).toEqual([]);
  });

  it("names every package.json script and every scripts/ file", async () => {
    const reference = chapterBySlug("files-and-scripts")?.markdown ?? "";
    const pkg = (await import("../../package.json")).default as { scripts: Record<string, string> };
    const missing = [
      ...Object.keys(pkg.scripts).filter((s) => !reference.includes(`\`${s}\``)),
      ...readdirSync("scripts").filter((f) => !reference.includes(f)),
    ];
    expect(missing).toEqual([]);
  });

  // Each `js run` block, with a fresh headless game as `pacmanAgent`
  const runnable = CHAPTERS.flatMap((c) =>
    [...c.markdown.matchAll(/```js run\n([\s\S]*?)```/g)].map((m, i) => ({
      name: `${c.file} #${i + 1}`,
      code: m[1],
    }))
  );

  it("has runnable examples", () => {
    expect(runnable.length).toBeGreaterThanOrEqual(5);
  });

  it.each(runnable)("example $name runs", async ({ code }) => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    const quiet = { ...console, log: () => {}, table: () => {} };
    // An async function, so examples may use await; `console` is silenced
    type AsyncFunctionCtor = new (...args: string[]) => (...values: unknown[]) => Promise<unknown>;
    const asyncProto = Object.getPrototypeOf(async () => {}) as { constructor: AsyncFunctionCtor };
    const AsyncFunction = asyncProto.constructor;
    await new AsyncFunction("pacmanAgent", "console", code)(agent, quiet);
    expect(agent.diagnostics().failing).toEqual([]);
  });
});
