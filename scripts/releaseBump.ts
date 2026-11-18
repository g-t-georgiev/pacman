// How much the game's version goes up, from what changed since the last release. Pure: the
// release script gathers the commits and files (scripts/release.ts), this decides. See the
// manual, "Replays, rewind and versions" > "Releases".

export type Bump = "none" | "patch" | "minor" | "major";
const ORDER: Bump[] = ["none", "patch", "minor", "major"];
export const maxBump = (a: Bump, b: Bump): Bump => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);
export const atLeast = (a: Bump, b: Bump): boolean => ORDER.indexOf(a) >= ORDER.indexOf(b);

/** A commit since the last release: its message and the files it changed (git status letters). */
export interface CommitInfo {
  hash: string;
  subject: string;
  body: string;
  files: Array<{ status: string; path: string }>;
}

/** What the release reads besides commits: the game's own version numbers then and now. */
export interface VersionNumbers {
  rules: number;
  state: number;
  replayFormat: number;
}

/** A commit message's parts: `type(scope)!: description`. */
export interface ParsedMessage {
  type: string;
  scope: string | null;
  breaking: boolean;
  description: string;
}

/** Commit types and what they mean for the version on their own. */
export const COMMIT_TYPES: Record<string, Bump> = {
  feat: "minor",
  fix: "patch",
  perf: "patch",
  docs: "none", // the manual ships in the game: its files decide (below)
  refactor: "none",
  test: "none",
  ci: "none",
  chore: "none",
  build: "none",
  style: "none",
  revert: "patch",
};

const MESSAGE = /^(\w+)(?:\(([\w./ -]+)\))?(!)?: (.+)$/;

/** Parses a Conventional Commits subject (and body, for BREAKING CHANGE), or null. */
export function parseMessage(subject: string, body = ""): ParsedMessage | null {
  const m = MESSAGE.exec(subject.trim());
  if (!m || !(m[1] in COMMIT_TYPES)) return null;
  return {
    type: m[1],
    scope: m[2] ?? null,
    breaking: m[3] === "!" || /^BREAKING[ -]CHANGE: /m.test(body),
    description: m[4],
  };
}

/** Messages git or tools write, which the commit-msg check lets through. */
export function isAutomaticMessage(subject: string): boolean {
  return /^(Merge |Revert "|fixup! |squash! |amend! )/.test(subject);
}

/** Is this the release script's own commit? Those never count as changes. */
export const isReleaseCommit = (subject: string) => subject.startsWith("chore(release): ");

const MANUAL = /^docs\/manual\/[^/]+\.md$/;
/** Commit types that shouldn't touch the game's code without saying so. */
const QUIET_TYPES = new Set(["docs", "test", "ci", "chore", "build", "style"]);

export interface BumpDecision {
  bump: Bump;
  /** Why, one line per signal (shown by --dry-run and in the changelog's notes). */
  reasons: string[];
  /** Things that look wrong but don't block (a commit that may be mistyped). */
  warnings: string[];
  /** The commits that count, sorted for the changelog. */
  entries: { breaking: string[]; features: string[]; fixes: string[]; manual: string[] };
}

/**
 * The bump for a set of commits and the version numbers before and after:
 *
 * - From the messages: `feat` minor, `fix` / `perf` patch, `!` or `BREAKING CHANGE:` major;
 *   refactor, test, ci, chore and docs outside the manual on their own release nothing.
 * - From the files (a safety net when a message undersells the change): a manual chapter added
 *   or deleted, minor; edited, patch. The rules, saved state or replay format version went up
 *   (the game plays or saves differently; older clips still load, with a note): minor.
 */
export function decideBump(
  commits: CommitInfo[],
  before: VersionNumbers,
  after: VersionNumbers
): BumpDecision {
  let bump: Bump = "none";
  const reasons: string[] = [];
  const warnings: string[] = [];
  const entries: BumpDecision["entries"] = { breaking: [], features: [], fixes: [], manual: [] };
  const raise = (to: Bump, why: string) => {
    if (to === "none") return;
    bump = maxBump(bump, to);
    reasons.push(`${to}: ${why}`);
  };

  for (const c of commits) {
    if (isReleaseCommit(c.subject) || isAutomaticMessage(c.subject)) continue;
    const short = c.hash.slice(0, 7);
    const msg = parseMessage(c.subject, c.body);
    if (!msg) {
      warnings.push(
        `${short} doesn't follow the commit format, so it counts for nothing: "${c.subject}"`
      );
      continue;
    }
    const line = `${msg.description} (${short})`;
    if (msg.breaking) {
      raise("major", `${short} is marked breaking`);
      entries.breaking.push(line);
    }
    raise(COMMIT_TYPES[msg.type], `${short} is a ${msg.type}`);
    if (msg.type === "feat") entries.features.push(line);
    else if (msg.type === "fix" || msg.type === "perf" || msg.type === "revert")
      entries.fixes.push(line);

    const manualFiles = c.files.filter((f) => MANUAL.test(f.path));
    if (manualFiles.some((f) => /^[ADR]/.test(f.status))) {
      raise("minor", `${short} adds, deletes or renames a manual chapter`);
    } else if (manualFiles.length > 0) {
      raise("patch", `${short} edits the manual`);
    }
    if (manualFiles.length > 0 && msg.type === "docs") entries.manual.push(line);

    if (QUIET_TYPES.has(msg.type) && c.files.some((f) => f.path.startsWith("src/"))) {
      warnings.push(
        `${short} is a ${msg.type} but changes the game's code: should it be a fix or feat?`
      );
    }
  }

  if (after.rules > before.rules) {
    raise("minor", `rules version ${before.rules} → ${after.rules}: the game plays differently`);
  }
  if (after.state > before.state) {
    raise("minor", `saved state version ${before.state} → ${after.state}`);
  }
  if (after.replayFormat > before.replayFormat) {
    raise("minor", `replay format ${before.replayFormat} → ${after.replayFormat}`);
  }
  return { bump, reasons, warnings, entries };
}

/** Parses "1.2.3". */
export function parseVersion(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) throw new Error(`Not a version: "${v}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/**
 * The next version. Below 1.0.0 a breaking change bumps the minor number (semver's 0.x
 * convention): going to 1.0.0 is a decision, made with `--version 1.0.0`.
 */
export function nextVersion(current: string, bump: Bump): string {
  const [major, minor, patch] = parseVersion(current);
  const effective = major === 0 && bump === "major" ? "minor" : bump;
  if (effective === "major") return `${major + 1}.0.0`;
  if (effective === "minor") return `${major}.${minor + 1}.0`;
  if (effective === "patch") return `${major}.${minor}.${patch + 1}`;
  return current;
}

/** The bump between two versions (what a release actually did). */
export function bumpBetween(from: string, to: string): Bump {
  const [a, b] = [parseVersion(from), parseVersion(to)];
  if (to === from) return "none";
  if (b[0] > a[0]) return "major";
  if (b[1] > a[1]) return "minor";
  return "patch";
}

/**
 * Whether a release from `from` to `to` covers what the changes need. Below 1.0.0 a major need
 * is met by a minor bump.
 */
export function bumpCovers(from: string, to: string, needed: Bump): boolean {
  if (needed === "none") return true;
  if (compareVersions(to, from) <= 0) return false;
  const done = bumpBetween(from, to);
  const required = parseVersion(from)[0] === 0 && needed === "major" ? "minor" : needed;
  return atLeast(done, required);
}

/** The changelog section for a release. */
export function changelogSection(version: string, date: string, decision: BumpDecision): string {
  const lines = [`## ${version} (${date})`, ""];
  const group = (title: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push(`### ${title}`, "", ...items.map((i) => `- ${i}`), "");
  };
  group("Breaking changes", decision.entries.breaking);
  group("Features", decision.entries.features);
  group("Fixes", decision.entries.fixes);
  group("Manual", decision.entries.manual);
  if (decision.reasons.length > 0) {
    lines.push("<details><summary>Why this version</summary>", "");
    lines.push(...decision.reasons.map((r) => `- ${r}`), "", "</details>", "");
  }
  return lines.join("\n");
}
