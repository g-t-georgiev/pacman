# Testing

Tests run with **Vitest**, through Vite+ (`vp test`), in two projects:

- **unit**: everything headless, in Node: the engine with no screen, clock or sound. Fast: the
  whole set takes a few seconds.
- **e2e**: the whole app in a real browser (headless Chromium, Vitest's browser mode).

Both are set up in `vite.config.ts` (`test.projects`).

## Commands

```bash
vp test                       # everything: unit, then e2e
vp run test:unit              # the headless tests only
vp run test:e2e               # the browser tests only (first time: vp exec playwright install chromium)
vp run test:regression        # core contracts and fixed bugs, under a second
vp test tests/unit/replay.test.ts          # one file
vp test -t "Elroy"                         # tests whose name matches
vp test --project unit --sequence.shuffle  # random order: catches tests that leak state
vp run golden:check           # do the golden replays still match this build?
vp run golden:update          # re-record them after an intended change (bumps versions)
```

**On every commit** the pre-commit hook (`.vite-hooks/pre-commit`) formats and lints the staged
files, runs the golden check, the versions check (the versions shown in the README and the
manual are current; `vp run docs:versions` updates them) and the regression suite. **On every push** CI
(`.github/workflows/ci.yml`) runs `vp check`, all tests, the golden check and the build.

## The suites

| Folder               | What it checks                                                                                                                                                                                                       |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/`        | One module at a time: speed masks, the level table, targeting, the house, the PRNG, replays, rewind, the replay viewer, presets, the agent driver, measurements...                                                   |
| `tests/integration/` | Several systems together over many frames: frightened mode, deaths and game over, Elroy, the game loop and events, and the **soak** tests                                                                            |
| `tests/fidelity/`    | `dossier.test.ts`: one test per Dossier claim the game implements                                                                                                                                                    |
| `tests/regression/`  | `coreContracts.test.ts`: the contracts everything stands on (determinism, the saved state, speeds, targets, house rules, round flow). `fixedBugs.test.ts`: one test per bug fixed, named by date and what went wrong |
| `tests/golden/`      | The golden replays and their scenarios; played by `tests/integration/goldenReplays.test.ts`                                                                                                                          |
| `tests/e2e/`         | The app in Chromium: loading, keys and remapped keys, pausing, panels, the game-over rewind, the siren, options surviving a reload, replay links, goldens in the browser, the manual                                 |

Shared set-up is in `tests/helpers.ts`: `playing(level)` (a game in play, READY skipped),
`playingInvincible`, `live` (with the real-time shell), `faceBlinky`, `randomInput(seed, every)`
and `playHashes`.

## Golden replays

A golden replay is a recorded game that must play back **hash for hash**. If any behavior
changes, the first checkpoint that differs fails the test, with its tick.

There are 9, each started from a set-up moment and then played with seeded random input so it
reliably reaches its subject:

| Golden                              | Covers                                             |
| :---------------------------------- | :------------------------------------------------- |
| `l1-random-play`                    | A level 1 game with deaths                         |
| `l5-invincible`                     | Level 5 speeds and timers, a long run              |
| `l2-eat-ghosts`, `ms-l2-eat-ghosts` | Energizers and eating ghosts, in both modes        |
| `l17-energizer-no-blue`             | Level 17: energizers that only reverse             |
| `l21-random-play`                   | Level 21+ values                                   |
| `l3-fruit-eaten`                    | Fruit, and a game over                             |
| `l1-clear-to-l2`                    | A level clear and the next level                   |
| `l5-elroy-collisions`               | Elroy 2, deaths, Elroy resuming after Clyde leaves |

Each scenario lists what it **covers** (`PACMAN_DIED`, `GHOST_EATEN`, `LEVEL_CLEARED`, `ELROY_2`,
...); the golden test plays it and checks the list ([coverage.ts](../../tests/golden/coverage.ts)),
so a golden can't quietly stop covering its subject.

**Adding one:** add a scenario to [scenarios.ts](../../tests/golden/scenarios.ts) (a set-up, an
input function, a length, its `covers` list), run `vp run golden:update`, and commit the new
JSON file.

**When one fails:** if you changed the game on purpose, run `vp run golden:update` (it bumps the
rules version) and commit the new files. If you didn't, the message names the first tick that
differs: load the golden with the agent driver (`loadReplay(replay, tick)`) to look at that
frame. See [Replays, rewind and versions](./05-replays-and-versions.md).

## Soak tests and invariants

The soak tests (`tests/integration/ghostSoak.test.ts`, `fruitSoak.test.ts`) play tens of
thousands of frames with random input and check, every frame, that ghosts never stand in a wall,
never get stuck, only reverse at tile boundaries, that eaten eyes head for the door and Elroy
chases during scatter, and that no runtime invariant fails.

**Runtime invariants** ([rules.ts](../../src/diagnostics/rules.ts)) are states that must never
happen: actors sharing a tile without a collision, Pac-Man outside the maze, eyes off the door's
line, an eating stall out of range. They run in the soak tests, and live in dev builds (see
[Debugging and tools](./07-debugging-tools.md)). Behavior is tested by tests, not by these.

## The regression workflow

Every bug fix comes with a test in `tests/regression/fixedBugs.test.ts` that fails without the
fix. Check it by undoing the fix once: exactly that test should fail. Bugs that need the UI get
an e2e test instead (for example, the Restart panel opening during a watched replay).

## Writing a test

Most tests drive the engine through the [agent driver](./08-agent-api.md) and a **scenario**:

```ts
import { describe, expect, it } from "vite-plus/test";
import { playing } from "../helpers";

describe("Pinky", () => {
  it("aims 4 tiles ahead of Pac-Man", () => {
    const agent = playing(1);
    agent.scenario({
      waveIndex: 1, // a chase wave
      pacman: { col: 6, row: 26, dir: "LEFT" },
      ghosts: { PINKY: { col: 21, row: 26, location: "ACTIVE" } },
    });
    agent.step(1);
    expect(agent.engine.ghosts.PINKY.target).toEqual({ col: 2, row: 26 });
  });
});
```

- `agent.step(n)` runs frames and returns what happened; `agent.runUntil(cond)` runs until a
  condition holds.
- A scenario can place actors, set the level, phase, dots left, wave and frightened time.
- Tests run in shared workers (`isolate: false`, for speed): a test that adds listeners to the
  shared event bus must remove them.

### An e2e test

Browser tests mount the real app and drive it with real input:

```tsx
import { page, userEvent } from "vite-plus/test/browser/context";
import { playingApp } from "./app";

it("Space pauses", async () => {
  const agent = await playingApp(); // the app in the page, READY skipped
  await userEvent.keyboard(" ");
  expect(agent.view().pausedBy).toEqual(["user"]);
  await page.getByRole("button", { name: /Options/ }).click();
});
```

The helpers are in `tests/e2e/app.tsx`: `mountApp`, `unmountApp` (a reload is an unmount and a
mount; storage stays), `freshBrowser`, `playingApp`, `framesOver`. The game runs in real time
there, so wait with `expect.poll(...)` rather than fixed sleeps.

## Keeping the manual true

`tests/unit/manual.test.ts` checks this manual like code: every link between chapters and every
section anchor exists, every repository file it links to exists, and every `src/` file appears
in the [files reference](./10-files-and-scripts.md).
