# Replays, rewind and versions

Because the simulation is deterministic (see [Architecture](./04-architecture.md)), a game can be
stored as **where it started and what the player pressed**. Play those inputs from that start
and the game happens again, frame for frame. Rewind, replays, share links and the golden tests
are all built on that.

## The rolling recording

While you play, the engine records continuously ([replay.ts](../../src/game/replay.ts),
`ReplayLog`):

- a **keyframe** (the full saved state) every second, the last 121 of them: about two minutes;
- every **input**, with the frame it applies to;
- a **state hash** every second.

It costs little: one small JSON state per second, and an entry per key press. A new game or a
Restart Level starts a new recording.

## Rewind and scrubbing

The Lab's **Practice** tab can go back in time:

- **⏪ 2 s / 5 s / 10 s** buttons, or **R** while the Lab is open, step back from the frame shown.
- The **scrub bar** shows any recorded frame.
- **Resume from here** (or closing the Lab) plays on from the frame shown. What came after it is
  dropped, and the recording continues from there.

How it rebuilds a frame exactly ([timeline.ts](../../src/game/timeline.ts) and
`showRecordedFrame` in the engine): load the keyframe at or before it, then re-run the recorded
inputs up to that frame, silently (no sounds, no events).

**After a game over**, R on the Restart panel goes to about 2 seconds before the death, past the
death animation, and holds there until you press Space.

## Replays

A **replay** is a JSON file:

```json
{
  "format": "pacman-replay",
  "version": 2,
  "made": { "rules": 1, "state": 6 },
  "settings": {
    "emulateRomQuirks": true,
    "invincible": false,
    "turbo": false,
    "turboSpeedMultiplier": 1.6
  },
  "start": { "...": "the full saved state of the first frame" },
  "inputs": [
    [132, "UP"],
    [190, "LEFT"]
  ],
  "checkpoints": [
    [60, 2832641934],
    [120, 1650928170]
  ],
  "endTick": 1200
}
```

| Field         | Meaning                                                                            |
| :------------ | :--------------------------------------------------------------------------------- |
| `made`        | The rules and state versions of the build that recorded it (see below)             |
| `settings`    | The rules it was played with (the engine's `rules`; the name stays for the format) |
| `start`       | The saved state it starts from (`GameState`)                                       |
| `inputs`      | `[tick, direction]`: the direction is applied just before that frame runs          |
| `checkpoints` | `[tick, hash]`: the state hash after that frame, every second and at the end       |
| `endTick`     | The last frame                                                                     |

**Playing one back** (`playReplay`) loads `start`, applies the inputs on their frames, and
compares every checkpoint. The result says whether every hash matched, and if not, the first
checkpoint that didn't (`divergedAt`) and the last that did. The divergence is somewhere in
between.

### In the game: watching, sharing, downloading

Lab → Practice → **Clip: last 20 s**:

- **🎬 Watch** plays the clip inside the game, like a video: play/pause (Space), speed, a scrub
  bar, and Escape to leave. The live game is put back exactly as it was when you leave. If a
  frame's hash doesn't match the recording (a clip from another build), the bar says from which
  frame on.
- **🔗 Copy link** copies a link with the clip in it (`#replay=...`): the replay compressed and
  encoded in the URL's fragment, which never reaches a server. Opening the link opens the viewer.
  Code: [replayShare.ts](../../src/game/replayShare.ts).
- **💾 Download** saves it as a `.json` file, to attach to a bug report.

The agent driver does the same from the console or tests, and can verify a replay or load it
into the live game: see [Agent driver and API](./08-agent-api.md).

## Versions

Two numbers say which build a replay or saved state belongs to:

- **`RULES_VERSION`** ([replay.ts](../../src/game/replay.ts)): what a frame **does**. Any change
  to the game's behavior (a speed, a timer, a targeting rule, a bug fix in play) bumps it.
- **`GAME_STATE_VERSION`** ([gameState.ts](../../src/game/gameState.ts)): the **shape** of the
  saved state. Adding, removing or renaming a field bumps it.

A replay records both (`made`). Opened on a build with other versions, the viewer warns up front
("recorded with rules version 1, this build 2; it may play differently") rather than only showing
a divergence later. Older files without `made` still load, with a note.

### Bumping them: automatic

You don't bump the versions by hand. `vp run golden:update` re-records the golden replays and
decides:

- the saved state's **shape** changed → `GAME_STATE_VERSION + 1`;
- otherwise, the **recorded play** changed (any checkpoint hash) → `RULES_VERSION + 1`;
- nothing changed → no bump.

Comments, formatting, renames and refactors don't change a single hash, so they never bump
anything. After a bump the script runs itself again in a fresh process, so the new goldens are
recorded with the new version. Code: [update-golden.ts](../../scripts/update-golden.ts),
[goldenVersions.ts](../../scripts/goldenVersions.ts).

### The pre-commit check

Every commit runs `vp run golden:check` ([check-golden.ts](../../scripts/check-golden.ts)) from
the pre-commit hook (`.vite-hooks/pre-commit`). It replays every golden on this build and stops
the commit if one diverges or was recorded with other versions:

- If the change to the game was **intended**: run `vp run golden:update`, review which goldens
  changed, and commit them with the change.
- If it **wasn't**: it's a bug. The message names the first tick that differs.

### Proving a refactor changes nothing

When the saved state's format changes, every hash changes too, even if the game plays the same.
`vp run golden:trace` records what a player would see every second (phase, score, lives, dots,
every actor's tile, direction and mode) for every golden, and compares two runs:

```bash
vp run golden:trace -- before.json
# ...make the change, then: vp run golden:update
vp run golden:trace -- after.json --compare before.json
```

Identical traces mean the change didn't alter the game.

## Releases

The game itself has a version too: `0.1.0` and up, in `package.json`. The game shows it in the
footer and this manual in its header; the README lists it with every tool's version.

**Dependency updates** come from Dependabot ([dependabot.yml](../../.github/dependabot.yml)): once a
week, one pull request per package into `dev` (Vite+ and its parts, React and its types, and
Tailwind and its plugin go together), so a breaking change points at its package. Their commits
are `chore(deps): ...`, so they don't bump the version; CI checks each one, and they get no Pages
preview.

### How much it goes up

The bump is worked out from what changed since the last release (the last `v1.2.3` tag):

| Change                                                                                                                             | Bump                                                    |
| :--------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| A commit marked breaking: `feat!: ...`, or `BREAKING CHANGE:` in its body                                                          | major                                                   |
| `feat: ...`                                                                                                                        | minor                                                   |
| A manual chapter added, deleted or renamed                                                                                         | minor                                                   |
| The rules, saved state or replay format version went up (the game plays or saves differently; older clips still load, with a note) | minor                                                   |
| `fix: ...`, `perf: ...`, `revert: ...`                                                                                             | patch                                                   |
| A manual chapter edited                                                                                                            | patch                                                   |
| `refactor`, `test`, `ci`, `chore`, `build`, `style`, and docs outside the manual                                                   | nothing on their own: they go out with the next release |

The biggest one wins. The files are a safety net: a `fix` that changes play still makes a
minor release, because the rules version went up. While the version is below 1.0.0, a breaking
change bumps the minor number; 1.0.0 is a decision (`vp run release -- --version 1.0.0`).

That is why every commit message starts with its type (`feat`, `fix`, `docs(manual)`, ...): the
`commit-msg` hook refuses one that doesn't, and `vp run release -- --dry-run` warns about
doubtful ones, such as a `docs` commit that changes the game's code.

### Making a release

On `dev`, when you want to release:

```bash
vp run release -- --dry-run   # the next version, and why
vp run release                # make it: package.json, the versions, CHANGELOG.md, one commit
```

Or without your machine: **Actions → Release on dev → Run workflow** (on `dev`). Leave "dry run"
ticked to see the next version and why in the run's summary; untick it to make the release, which
is committed and pushed to `dev` for you. You can also type a version to choose it yourself.

Then push (if you released locally) and open the pull request from `dev` into `main`:

- **On the pull request**, CI checks that the version covers the changes (`vp run release:check`).
  If you forgot, the check fails and says to run `vp run release`.
- **After the merge**, CI tags the version (`v1.2.3`) on `main`, and publishes a GitHub Release
  with its changelog notes for a minor or major version. A patch version gets the tag only.
- **And `dev` catches up:** the merge leaves a merge commit on `main` that `dev` doesn't have.
  The Sync dev workflow brings `dev` up to `main` right after (a fast-forward, or a merge if
  `dev` moved on meanwhile), so the next pull request starts with nothing on `main` that `dev`
  lacks. It runs by hand too (Actions → Sync dev → Run workflow).

**The token.** Sync dev and the release button push to `dev`. While `dev` is unprotected they
use the workflow's own token. Once `dev` is protected (a ruleset), they need a token allowed past
it, like a release bot at work:

1. Create a fine-grained personal access token: this repository only, "Contents: Read and write".
2. Settings → Secrets and variables → Actions → New repository secret `SYNC_TOKEN`: the token.
3. In the ruleset protecting `dev` (and `main`), put **Repository admin** on the bypass list.

Nothing ever pushes to `main` except your own pull-request merges.

Every release is tagged, so a replay or a bug report that names a version can be played on
exactly that build: `git checkout v1.2.3`. The notes of every release are in `CHANGELOG.md`.
Code: [release.ts](../../scripts/release.ts), [releaseBump.ts](../../scripts/releaseBump.ts),
[release.yml](../../.github/workflows/release.yml).

## The live site and branch previews

Every branch is built and published on GitHub Pages, each at its own address, on every push:

| Address                                                                                   | Build                                                  |
| :---------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| [g-t-georgiev.github.io/pacman](https://g-t-georgiev.github.io/pacman/)                   | `main`: the released game                              |
| `g-t-georgiev.github.io/pacman/<branch>/`                                                 | any other branch: `/pacman/dev/`, `/pacman/feature-x/` |
| [g-t-georgiev.github.io/pacman/branches](https://g-t-georgiev.github.io/pacman/branches/) | the list of every build, with its commit and time      |

- A branch's name becomes its folder: lowercase, with anything but letters, digits, dots and
  dashes turned into a dash (`refactor/pass-2` → `/pacman/refactor-pass-2/`).
- A preview shows its branch in the footer ("preview: dev"); the released game doesn't.
- Deleting a branch takes its build off the site.
- The whole site is kept in the `gh-pages` branch, as one commit that each run replaces, and
  published with GitHub's Pages actions. Don't push to it by hand.

The workflow is [pages.yml](../../.github/workflows/pages.yml); the site's layout and its list
page come from [pagesSite.ts](../../scripts/pagesSite.ts). It needs Settings → Pages → Source
"GitHub Actions", and Settings → Environments → github-pages → Deployment branches "No
restriction", so that any branch may publish its build.
