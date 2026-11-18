import { describe, expect, it } from "vite-plus/test";
import {
  type CommitInfo,
  bumpCovers,
  changelogSection,
  decideBump,
  nextVersion,
  parseMessage,
} from "../../scripts/releaseBump";

const SAME = { rules: 1, state: 6, replayFormat: 2 };
let n = 0;
const commit = (
  subject: string,
  files: Array<[string, string]> = [["M", "src/game/GameEngine.ts"]],
  body = ""
): CommitInfo => ({
  hash: `${(++n).toString(16).padStart(7, "0")}abcdef`,
  subject,
  body,
  files: files.map(([status, path]) => ({ status, path })),
});
const bumpOf = (commits: CommitInfo[], after = SAME) => decideBump(commits, SAME, after).bump;

describe("Release: commit messages", () => {
  it("parses type, scope, breaking mark and description", () => {
    expect(parseMessage("feat(manual): copy buttons")).toEqual({
      type: "feat",
      scope: "manual",
      breaking: false,
      description: "copy buttons",
    });
    expect(parseMessage("fix!: drop format 1 replays")?.breaking).toBe(true);
    expect(
      parseMessage("refactor: x", "text\n\nBREAKING CHANGE: the agent's frame is gone")?.breaking
    ).toBe(true);
    expect(parseMessage("Updated stuff")).toBeNull();
    expect(parseMessage("feature: not a known type")).toBeNull();
  });
});

describe("Release: how much the version goes up", () => {
  it("from the messages: feat minor, fix patch, breaking major, the rest nothing", () => {
    expect(bumpOf([commit("feat: drawer")])).toBe("minor");
    expect(bumpOf([commit("fix: font retry")])).toBe("patch");
    expect(bumpOf([commit("perf: faster hash")])).toBe("patch");
    expect(bumpOf([commit("feat!: new default preset")])).toBe("major");
    expect(bumpOf([commit("refactor: split", [["M", "src/a.ts"]])])).toBe("none");
    expect(bumpOf([commit("test: more", [["M", "tests/a.test.ts"]])])).toBe("none");
    expect(bumpOf([commit("docs: readme", [["M", "README.md"]])])).toBe("none");
    // The biggest wins
    expect(bumpOf([commit("fix: a"), commit("feat: b"), commit("chore: c", [])])).toBe("minor");
  });

  it("from the manual's files: an edit is a patch, a new or deleted chapter a minor", () => {
    expect(bumpOf([commit("docs: typo", [["M", "docs/manual/03-arcade-rules.md"]])])).toBe("patch");
    expect(bumpOf([commit("docs: new chapter", [["A", "docs/manual/11-modding.md"]])])).toBe(
      "minor"
    );
    expect(
      bumpOf([commit("docs: drop a chapter", [["D", "docs/manual/09-console-recipes.md"]])])
    ).toBe("minor");
    expect(bumpOf([commit("docs: rename", [["R100", "docs/manual/10-files.md"]])])).toBe("minor");
  });

  it("from the game's version numbers: a rules, state or format change is at least minor", () => {
    expect(bumpOf([commit("fix: Inky's pivot")], { ...SAME, rules: 2 })).toBe("minor");
    expect(bumpOf([commit("refactor: state")], { ...SAME, state: 7 })).toBe("minor");
    expect(bumpOf([commit("feat: replay v3")], { ...SAME, replayFormat: 3 })).toBe("minor");
  });

  it("ignores release and merge commits, and warns about the doubtful ones", () => {
    const d = decideBump(
      [
        commit("chore(release): 0.2.0"),
        commit("Merge branch 'dev'"),
        commit("updated the ghosts"),
        commit("docs: tidy", [["M", "src/game/GameEngine.ts"]]),
      ],
      SAME,
      SAME
    );
    expect(d.bump).toBe("none");
    expect(d.warnings).toHaveLength(2);
    expect(d.warnings[0]).toMatch(/doesn't follow the commit format/);
    expect(d.warnings[1]).toMatch(/docs but changes the game's code/);
  });
});

describe("Release: version numbers", () => {
  it("bumps, with breaking changes as minor while below 1.0.0", () => {
    expect(nextVersion("0.1.0", "patch")).toBe("0.1.1");
    expect(nextVersion("0.1.3", "minor")).toBe("0.2.0");
    expect(nextVersion("0.1.3", "major")).toBe("0.2.0");
    expect(nextVersion("1.4.2", "major")).toBe("2.0.0");
    expect(nextVersion("1.4.2", "none")).toBe("1.4.2");
  });

  it("checks that a release covers what the changes need", () => {
    expect(bumpCovers("0.1.0", "0.1.1", "patch")).toBe(true);
    expect(bumpCovers("0.1.0", "0.1.1", "minor")).toBe(false);
    expect(bumpCovers("0.1.0", "0.2.0", "major")).toBe(true); // 0.x
    expect(bumpCovers("1.1.0", "1.2.0", "major")).toBe(false);
    expect(bumpCovers("0.1.0", "0.1.0", "patch")).toBe(false);
    expect(bumpCovers("0.1.0", "0.1.0", "none")).toBe(true);
  });

  it("writes a changelog section grouped by kind, with the reasons", () => {
    const d = decideBump(
      [
        commit("feat: drawer"),
        commit("fix: font retry"),
        commit("docs: new chapter", [["A", "docs/manual/11-modding.md"]]),
      ],
      SAME,
      SAME
    );
    const text = changelogSection("0.2.0", "2026-11-19", d);
    expect(text).toMatch(/^## 0\.2\.0 \(2026-11-19\)/);
    expect(text).toContain("### Features\n\n- drawer (");
    expect(text).toContain("### Fixes\n\n- font retry (");
    expect(text).toContain("### Manual\n\n- new chapter (");
    expect(text).toContain("Why this version");
  });
});
