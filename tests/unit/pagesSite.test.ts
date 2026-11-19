/// <reference types="node" />
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { basePath, publish, readManifest, remove, slugFor } from "../../scripts/pagesSite";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), "pages-"));
  dirs.push(d);
  return d;
};
/** A fake build: index.html naming the branch, and an assets folder. */
function build(name: string): string {
  const dist = temp();
  writeFileSync(join(dist, "index.html"), `<title>${name}</title>`);
  mkdirSync(join(dist, "assets"));
  writeFileSync(join(dist, "assets", `${name}.js`), name);
  return dist;
}
const at = (date: string, branch: string) => ({ branch, sha: `${branch}0000000`, date });

describe("Branch builds on GitHub Pages", () => {
  it("gives every branch a folder in its URL, main the root", () => {
    expect(basePath("main")).toBe("/pacman/");
    expect(basePath("dev")).toBe("/pacman/dev/");
    expect(basePath("refactor/pass-2")).toBe("/pacman/refactor-pass-2/");
    expect(slugFor("Feature/Ghost_House!!")).toBe("feature-ghost-house");
    // Names the root build uses can't be taken by a branch
    expect(slugFor("assets")).toBe("branch-assets");
    expect(slugFor("branches")).toBe("branch-branches");
  });

  it("main's build replaces only main's files; branch builds sit in their folders", () => {
    const site = temp();
    publish(site, build("main1"), at("2026-11-19 10:00", "main"));
    publish(site, build("dev"), at("2026-11-19 11:00", "dev"));
    publish(site, build("feature"), at("2026-11-19 12:00", "feature/x"));
    publish(site, build("main2"), at("2026-11-19 13:00", "main"));

    expect(readFileSync(join(site, "index.html"), "utf8")).toBe("<title>main2</title>");
    expect(readdirSync(join(site, "assets"))).toEqual(["main2.js"]); // the old root assets went
    expect(readFileSync(join(site, "dev", "index.html"), "utf8")).toBe("<title>dev</title>");
    expect(existsSync(join(site, "feature-x", "assets", "feature.js"))).toBe(true);
    expect(existsSync(join(site, ".nojekyll"))).toBe(true);

    const manifest = readManifest(site);
    expect(manifest.root?.sha).toBe("main0000000");
    expect(manifest.branches.map((b) => b.slug).sort()).toEqual(["dev", "feature-x"]);
  });

  it("a new push of a branch replaces its build; a deleted branch's build goes", () => {
    const site = temp();
    publish(site, build("main"), at("2026-11-19 10:00", "main"));
    publish(site, build("old"), at("2026-11-19 11:00", "dev"));
    publish(site, build("new"), at("2026-11-19 12:00", "dev"));
    expect(readdirSync(join(site, "dev", "assets"))).toEqual(["new.js"]);
    expect(readManifest(site).branches).toHaveLength(1);

    remove(site, "dev");
    expect(existsSync(join(site, "dev"))).toBe(false);
    expect(readManifest(site).branches).toEqual([]);
    remove(site, "main"); // never removes the released game
    expect(existsSync(join(site, "index.html"))).toBe(true);
  });

  it("lists every build on the /branches/ page, newest first", () => {
    const site = temp();
    publish(site, build("main"), at("2026-11-19 10:00", "main"));
    publish(site, build("dev"), at("2026-11-19 11:00", "dev"));
    publish(site, build("f"), at("2026-11-19 12:00", "feature/<b>"));
    const page = readFileSync(join(site, "branches", "index.html"), "utf8");
    expect(page).toContain('<a href="/pacman/">main</a>');
    expect(page.indexOf("feature/&lt;b&gt;")).toBeLessThan(page.indexOf(">dev<"));
    expect(page).toContain('href="/pacman/feature-b/"');
  });
});
