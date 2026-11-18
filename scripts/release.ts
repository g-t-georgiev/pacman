/// <reference types="node" />
// Releases (see the manual, "Replays, rewind and versions" > "Releases"):
//
//   vp run release -- --dry-run         what the next release would be, and why
//   vp run release                      make it: package.json, versions, CHANGELOG.md, a commit
//   vp run release -- --version 1.0.0   choose the number yourself (it must cover the changes)
//   vp run release:check                CI, on a pull request into main: was the version bumped
//                                       as far as the changes need?
//   vp run release:tag                  CI, after a merge into main: tag the version (once)
//
// The bump comes from the commit messages since the last tag, raised by what the files say
// (scripts/releaseBump.ts). Releases are made on dev; tags only on main, by CI.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  type CommitInfo,
  type VersionNumbers,
  bumpBetween,
  bumpCovers,
  changelogSection,
  compareVersions,
  decideBump,
  nextVersion,
} from "./releaseBump";
import { TARGETS, withBlock } from "./versions";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

/** The newest version tag reachable from HEAD. */
function lastTag(): string {
  try {
    return git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*.[0-9]*.[0-9]*");
  } catch {
    console.error("No version tag yet (v1.2.3). Tag the first version: git tag -a v0.1.0 -m 0.1.0");
    process.exit(2);
  }
}

/** The game's version numbers in a commit (or the working tree). */
function versionNumbers(ref: string | null): VersionNumbers {
  const file = (path: string) => (ref ? git("show", `${ref}:${path}`) : readFileSync(path, "utf8"));
  const num = (text: string, name: string, fallback: number) =>
    Number(new RegExp(`export const ${name} = (\\d+)`).exec(text)?.[1] ?? fallback);
  const replay = file("src/game/replay.ts");
  return {
    rules: num(replay, "RULES_VERSION", 0),
    replayFormat: num(replay, "REPLAY_FORMAT_VERSION", 2),
    state: num(file("src/game/gameState.ts"), "GAME_STATE_VERSION", 0),
  };
}

/** Commits since `tag` (merges left out), with their files. */
function commitsSince(tag: string): CommitInfo[] {
  const out = git(
    "log",
    `${tag}..HEAD`,
    "--no-merges",
    "--format=%x1e%H%x1f%s%x1f%b%x1f",
    "--name-status"
  );
  return out
    .split("\x1e")
    .filter((r) => r.trim() !== "")
    .map((record) => {
      const [hash, subject, body, rest = ""] = record.split("\x1f");
      const files = rest
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const parts = l.split("\t");
          return { status: parts[0], path: parts[parts.length - 1] };
        });
      return { hash: hash.trim(), subject: subject.trim(), body: body.trim(), files };
    });
}

const packageVersion = () =>
  (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;

function decide() {
  const tag = lastTag();
  const decision = decideBump(commitsSince(tag), versionNumbers(tag), versionNumbers(null));
  return { tag, tagVersion: tag.slice(1), decision };
}

function printDecision(d: ReturnType<typeof decide>["decision"]): void {
  for (const r of d.reasons) console.log(`  ${r}`);
  for (const w of d.warnings) console.log(`  warning: ${w}`);
}

/** CHANGELOG.md with the section for `version` added at the top (or replaced). */
function updateChangelog(version: string, section: string): void {
  const header =
    '# Changelog\n\nEvery release of Pac-Man Arcade Lab, newest first. Written by `vp run release` from\nthe commit messages; see the manual, "Replays, rewind and versions" > "Releases".\n';
  const text = existsSync("CHANGELOG.md") ? readFileSync("CHANGELOG.md", "utf8") : header;
  const start = text.indexOf(`## ${version} `);
  let out: string;
  if (start >= 0) {
    const next = text.indexOf("\n## ", start + 1);
    out = text.slice(0, start) + section + (next >= 0 ? text.slice(next + 1) : "");
  } else {
    const first = text.indexOf("\n## ");
    out =
      first >= 0
        ? `${text.slice(0, first + 1)}${section}\n${text.slice(first + 1)}`
        : `${text}\n${section}`;
  }
  writeFileSync("CHANGELOG.md", out);
}

/** The changelog section of `version` (for a GitHub Release's notes). */
function changelogNotes(version: string): string {
  const text = readFileSync("CHANGELOG.md", "utf8");
  const start = text.indexOf(`## ${version} `);
  if (start < 0) return `Pac-Man Arcade Lab ${version}`;
  const next = text.indexOf("\n## ", start + 1);
  return text.slice(text.indexOf("\n", start) + 1, next >= 0 ? next : undefined).trim();
}

function release(): void {
  const { tag, tagVersion, decision } = decide();
  const current = packageVersion();
  const chosen = option("--version");
  const next = chosen ?? nextVersion(tagVersion, decision.bump);
  console.log(`Last release: ${tag}. Changes since then need: ${decision.bump}.`);
  printDecision(decision);

  if (decision.bump === "none" && !chosen) {
    console.log("Nothing to release: no fix, feature or manual change since the last tag.");
    return;
  }
  if (!bumpCovers(tagVersion, next, decision.bump)) {
    console.error(`${next} doesn't cover a ${decision.bump} change from ${tagVersion}.`);
    process.exit(1);
  }
  console.log(
    `Next version: ${next}${current !== tagVersion ? ` (package.json says ${current})` : ""}.`
  );
  if (flag("--dry-run")) return;

  if (git("status", "--porcelain") !== "") {
    console.error("Commit or stash your changes first: the release is a commit of its own.");
    process.exit(1);
  }
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== "dev") console.log(`Note: releases are usually made on dev (this is ${branch}).`);

  const pkg = readFileSync("package.json", "utf8");
  writeFileSync("package.json", pkg.replace(/"version": "[^"]+"/, `"version": "${next}"`));
  for (const { file, block } of TARGETS)
    writeFileSync(file, withBlock(readFileSync(file, "utf8"), block(), file));
  updateChangelog(next, changelogSection(next, new Date().toISOString().slice(0, 10), decision));
  git("add", "package.json", "CHANGELOG.md", ...TARGETS.map((t) => t.file));
  git("commit", "-m", `chore(release): ${next}`);
  console.log(
    `Released ${next} on ${branch}: package.json, the versions, CHANGELOG.md, one commit.`
  );
  console.log("Push it, and open the pull request into main: merging it tags the release.");
}

function check(): void {
  const { tag, tagVersion, decision } = decide();
  const current = packageVersion();
  console.log(`Last release: ${tag}; package.json: ${current}; changes need: ${decision.bump}.`);
  printDecision(decision);
  if (!bumpCovers(tagVersion, current, decision.bump)) {
    console.error(
      `The changes since ${tag} need a ${decision.bump} release, and the version is ${current}. Run \`vp run release\` on dev and push.`
    );
    process.exit(1);
  }
  if (
    compareVersions(current, tagVersion) > 0 &&
    !readFileSync("CHANGELOG.md", "utf8").includes(`## ${current} `)
  ) {
    console.error(`CHANGELOG.md has no section for ${current}. Run \`vp run release\` on dev.`);
    process.exit(1);
  }
  console.log("The version covers the changes.");
}

function tagRelease(): void {
  const version = packageVersion();
  const tag = `v${version}`;
  const exists = git("tag", "--list", tag) !== "";
  const previous = lastTag();
  const output = (line: string) => {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
  };
  if (exists) {
    console.log(`${tag} is already tagged: nothing to do.`);
    output("tagged=false");
    return;
  }
  if (compareVersions(version, previous.slice(1)) <= 0) {
    console.error(`package.json says ${version}, not newer than ${previous}.`);
    process.exit(1);
  }
  const kind = bumpBetween(previous.slice(1), version);
  git("tag", "-a", tag, "-m", `Pac-Man Arcade Lab ${version}`);
  writeFileSync(".release-notes.md", `${changelogNotes(version)}\n`);
  console.log(`Tagged ${tag} (${kind} release after ${previous}).`);
  output("tagged=true");
  output(`tag=${tag}`);
  output(`kind=${kind}`);
  output("notes=.release-notes.md");
}

if (flag("--check")) check();
else if (flag("--tag")) tagRelease();
else release();
