/// <reference types="node" />
import { describe, expect, it } from "vite-plus/test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseChapter } from "../../src/docs/manual";
import { collectVersions, outdatedFiles } from "../../scripts/versions";

/**
 * The README is checked like the manual: what it shows must match the project. Its versions
 * table is generated (`vp run docs:versions`), the rest is written by hand and checked here.
 */
const README = readFileSync("README.md", "utf8");
const MANUAL_DIR = "docs/manual";
const chapters = readdirSync(MANUAL_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => parseChapter(f, readFileSync(join(MANUAL_DIR, f), "utf8")));

/** Markdown links outside code: [text](target). */
const links = (md: string) =>
  [...md.replace(/```[\s\S]*?```/g, "").matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);

describe("The README", () => {
  it("shows this build's versions (the generated blocks are up to date)", () => {
    // Fails after a version bump, a dependency update or a rules change: run `vp run docs:versions`
    expect(outdatedFiles()).toEqual([]);
    const v = collectVersions();
    expect(README).toContain(`This README describes **Pac-Man Arcade Lab ${v.game}**`);
    expect(readFileSync(join(MANUAL_DIR, "01-introduction.md"), "utf8")).toContain(
      `This manual describes **Pac-Man Arcade Lab ${v.game}**`
    );
  });

  it("lists every chapter of the manual, in order, by its title", () => {
    const section = README.slice(README.indexOf("## The manual"), README.indexOf("## Running it"));
    const rows = [...section.matchAll(/^\| \[([^\]]+)\]\(docs\/manual\/([\w-]+\.md)\)/gm)].map(
      (m) => [m[1], m[2]]
    );
    expect(rows).toEqual(chapters.map((c) => [c.title, c.file]));
  });

  it("names only scripts that exist", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const named = [...README.matchAll(/vp run ([\w:-]+)/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(3);
    expect(named.filter((s) => !(s in pkg.scripts))).toEqual([]);
  });

  it("every link resolves, sections included", () => {
    const broken: string[] = [];
    for (const href of links(README)) {
      if (/^https?:\/\//.test(href)) continue;
      const [path, anchor] = href.split("#");
      if (!existsSync(path)) {
        broken.push(href);
        continue;
      }
      if (anchor) {
        const chapter = chapters.find((c) => path.endsWith(c.file));
        if (!chapter?.sections.some((s) => s.anchor === anchor)) broken.push(href);
      }
    }
    expect(broken).toEqual([]);
  });
});
