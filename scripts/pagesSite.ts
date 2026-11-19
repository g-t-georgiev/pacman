/// <reference types="node" />
// The GitHub Pages site, one build per branch (see the manual, "Replays, rewind and versions" >
// "The live site and branch previews"). The site lives in the gh-pages branch:
//
//   /pacman/                 main (the released game)
//   /pacman/<branch>/        every other branch, e.g. /pacman/dev/, /pacman/feature-x/
//   /pacman/branches/        a page listing them
//
// CI (.github/workflows/pages.yml) builds a branch and calls:
//   vpx ./scripts/pagesSite.ts base <branch> [--root /pacman/]     the build's base path
//   vpx ./scripts/pagesSite.ts publish --site <dir> --dist dist --branch <b> --sha <sha>
//   vpx ./scripts/pagesSite.ts remove --site <dir> --branch <b>    (a deleted branch)
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The branch published at the site's root. */
export const MAIN_BRANCH = "main";
/** Folder names the root build uses, or the site's own pages: a branch can't take them. */
const RESERVED = new Set(["assets", "fonts", "branches"]);

/** A branch's folder: lowercase, anything but letters, digits, dots and dashes becomes a dash. */
export function slugFor(branch: string): string {
  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const safe = slug || "branch";
  return RESERVED.has(safe) ? `branch-${safe}` : safe;
}

/** The path a branch's build is served from: `/pacman/` for main, `/pacman/<slug>/` otherwise. */
export function basePath(branch: string, root = "/pacman/"): string {
  return branch === MAIN_BRANCH ? root : `${root}${slugFor(branch)}/`;
}

export interface PreviewEntry {
  branch: string;
  slug: string;
  sha: string;
  date: string;
}

/** What the site holds, kept in its previews.json. */
export interface SiteManifest {
  /** The root build (main), and the top-level files and folders it owns. */
  root: (Omit<PreviewEntry, "slug"> & { files: string[] }) | null;
  branches: PreviewEntry[];
}

const MANIFEST = "previews.json";
const emptyManifest = (): SiteManifest => ({ root: null, branches: [] });

export function readManifest(site: string): SiteManifest {
  const path = join(site, MANIFEST);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as SiteManifest)
    : emptyManifest();
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The /branches/ page: every build on the site, newest first. */
export function renderIndex(manifest: SiteManifest, root = "/pacman/"): string {
  const rows: string[] = [];
  if (manifest.root) {
    const r = manifest.root;
    rows.push(
      `<tr><td><a href="${root}">${escape(r.branch)}</a> <small>(the released game)</small></td><td><code>${escape(r.sha.slice(0, 7))}</code></td><td>${escape(r.date)}</td></tr>`
    );
  }
  for (const b of [...manifest.branches].sort((x, y) => y.date.localeCompare(x.date))) {
    rows.push(
      `<tr><td><a href="${root}${b.slug}/">${escape(b.branch)}</a></td><td><code>${escape(b.sha.slice(0, 7))}</code></td><td>${escape(b.date)}</td></tr>`
    );
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pac-Man Arcade Lab: builds per branch</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 24px 16px; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { color: #fde047; font-size: 1.3rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #262626; }
  a { color: #67e8f9; }
  small, th { color: #a3a3a3; font-weight: normal; }
  code { color: #fde68a; }
</style>
</head>
<body>
<main>
<h1>Pac-Man Arcade Lab: builds per branch</h1>
<p>Every branch is built and published here on each push; a deleted branch's build goes away.</p>
<table>
<thead><tr><th>Branch</th><th>Commit</th><th>Built</th></tr></thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</main>
</body>
</html>
`;
}

function writeSiteFiles(site: string, manifest: SiteManifest, root: string): void {
  writeFileSync(join(site, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  mkdirSync(join(site, "branches"), { recursive: true });
  writeFileSync(join(site, "branches", "index.html"), renderIndex(manifest, root));
  writeFileSync(join(site, ".nojekyll"), ""); // serve the files as they are
}

/** Puts a branch's build on the site: main at the root, others in their folder. */
export function publish(
  site: string,
  dist: string,
  entry: { branch: string; sha: string; date: string },
  root = "/pacman/"
): SiteManifest {
  mkdirSync(site, { recursive: true });
  const manifest = readManifest(site);
  if (entry.branch === MAIN_BRANCH) {
    // Replace the old root build's files, and only those: the branch folders stay
    for (const f of manifest.root?.files ?? [])
      rmSync(join(site, f), { recursive: true, force: true });
    const files = readdirSync(dist);
    for (const f of files) cpSync(join(dist, f), join(site, f), { recursive: true });
    manifest.root = { ...entry, files };
  } else {
    const slug = slugFor(entry.branch);
    rmSync(join(site, slug), { recursive: true, force: true });
    cpSync(dist, join(site, slug), { recursive: true });
    manifest.branches = [...manifest.branches.filter((b) => b.slug !== slug), { ...entry, slug }];
  }
  writeSiteFiles(site, manifest, root);
  return manifest;
}

/** Takes a deleted branch's build off the site (main's is never removed this way). */
export function remove(site: string, branch: string, root = "/pacman/"): SiteManifest {
  const manifest = readManifest(site);
  if (branch === MAIN_BRANCH) return manifest;
  const slug = slugFor(branch);
  rmSync(join(site, slug), { recursive: true, force: true });
  manifest.branches = manifest.branches.filter((b) => b.slug !== slug);
  writeSiteFiles(site, manifest, root);
  return manifest;
}

// Run as a script
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, ...rest] = process.argv.slice(2).filter((a) => a !== "--");
  const opt = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const root = opt("--root") ?? "/pacman/";
  const need = (name: string) => {
    const v = opt(name);
    if (!v) {
      console.error(`missing ${name}`);
      process.exit(2);
    }
    return v;
  };
  if (command === "base") {
    const base = basePath(rest[0], root);
    console.log(base);
    // In GitHub Actions, also as the step's output
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `base=${base}\n`);
  } else if (command === "publish") {
    const m = publish(
      need("--site"),
      need("--dist"),
      {
        branch: need("--branch"),
        sha: need("--sha"),
        date: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
      },
      root
    );
    console.log(
      `Published ${opt("--branch")} at ${basePath(need("--branch"), root)} (${m.branches.length} branch builds besides main).`
    );
  } else if (command === "remove") {
    remove(need("--site"), need("--branch"), root);
    console.log(`Removed the build of ${opt("--branch")}.`);
  } else {
    console.error("usage: pagesSite.ts base <branch> | publish ... | remove ...");
    process.exit(2);
  }
}
