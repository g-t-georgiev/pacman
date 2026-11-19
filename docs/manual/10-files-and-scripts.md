# Files and scripts

Every file in the repository that you might open, with what it owns. The test suite checks
that every file under `src/` is listed here, so this page can't fall behind silently.

## Top level

| File                                       | What it is                                                                                                            |
| :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `index.html`                               | The page: the root element, fonts preload, meta tags                                                                  |
| `package.json`                             | Dependencies and the scripts below; the package manager is bun, through Vite+                                         |
| `vite.config.ts`                           | Vite+ config: formatter, linter rules, the two test projects (unit, e2e), plugins, the dev server                     |
| `tsconfig.json`                            | TypeScript settings for `src`, `tests` and the config                                                                 |
| `lanQrPlugin.ts`                           | A dev-server plugin that prints a QR code of the LAN address, to open the game on a phone                             |
| `AGENTS.md`                                | Notes for AI coding agents about the Vite+ toolchain                                                                  |
| `README.md`                                | The landing page: what it is, the manual's chapters, commands, versions                                               |
| `CHANGELOG.md`                             | Every release's notes, newest first (written by `vp run release`)                                                     |
| `.vite-hooks/pre-commit`                   | The pre-commit hook: format and lint staged files, the golden check, the versions check, the regression suite         |
| `.vite-hooks/commit-msg`                   | The commit-msg hook: the message must start with its type (`feat`, `fix`, ...)                                        |
| `.github/workflows/ci.yml`                 | CI: check, all tests (Chromium installed for e2e), golden check, build; the release check on pull requests into main  |
| `.github/workflows/release.yml`            | After a merge into main: tag the version, and a GitHub Release for a minor or major one                               |
| `.github/workflows/pages.yml`              | On every push: build the branch for its own path and publish the site (main at /pacman/, others at /pacman/<branch>/) |
| `.github/workflows/sync-dev.yml`           | After a push to main: bring dev up to main (fast-forward, or a merge)                                                 |
| `.claude/launch.json`                      | Dev server entries for the Claude desktop app's preview                                                               |
| `public/fonts/Emulogic.ttf`                | The pixel font used on the canvas (© ck!, freakyfonts.de; check the author's terms before publishing)                 |
| `public/favicon.svg`, `public/favicon.ico` | The tab icon                                                                                                          |

## Scripts

| Script             | Runs                                      | What it does                                                                           |
| :----------------- | :---------------------------------------- | :------------------------------------------------------------------------------------- |
| `start`            | `vp dev --port=3000 --host=0.0.0.0`       | The dev server, reachable from other devices on the network                            |
| `build`            | `vp build`                                | The production build in `dist/`                                                        |
| `clean`            | `rm -rf dist`                             | Delete the build                                                                       |
| `lint`, `lint:fix` | `vp lint`                                 | Lint (and fix)                                                                         |
| `fmt`, `fmt:check` | `vp fmt`                                  | Format (or check formatting)                                                           |
| `test`             | `vp test`                                 | Every test: unit, then e2e                                                             |
| `test:unit`        | `vp test --project unit`                  | The headless tests                                                                     |
| `test:e2e`         | `vp test --project e2e`                   | The browser tests                                                                      |
| `test:regression`  | `vp test --project unit tests/regression` | Core contracts and fixed bugs (pre-commit)                                             |
| `golden:update`    | `scripts/update-golden.ts`                | Re-record the golden replays, bumping versions as needed                               |
| `golden:check`     | `scripts/check-golden.ts`                 | Do the goldens still match this build? (pre-commit, CI)                                |
| `golden:trace`     | `scripts/play-trace.ts`                   | A per-second play trace of every golden, and a comparison of two                       |
| `docs:versions`    | `scripts/versions.ts`                     | Rewrite the versions in the README and the manual's introduction                       |
| `docs:check`       | `scripts/versions.ts --check`             | Are those versions up to date? (pre-commit, and a test)                                |
| `release`          | `scripts/release.ts`                      | Make a release on dev (`-- --dry-run` to see it first, `-- --version x.y.z` to choose) |
| `release:check`    | `scripts/release.ts --check`              | Does the version cover the changes since the last tag? (CI, pull requests into main)   |
| `release:tag`      | `scripts/release.ts --tag`                | Tag the version, once (CI, after a merge into main)                                    |
| `prepare`          | `vp config`                               | Installs the git hooks after `vp install`                                              |

Run them with `vp run <script>` (`vp test`, `vp build` and `vp dev` are also Vite+ built-ins).

The files in `scripts/`:

- `update-golden.ts`: records every scenario in `tests/golden/scenarios.ts`, decides version
  bumps, writes the JSON files.
- `check-golden.ts`: replays every golden and checks its versions.
- `play-trace.ts`: the play trace (see [Replays, rewind and versions](./05-replays-and-versions.md)).
- `goldenVersions.ts`: shared by the two above: where the goldens live, comparing state shapes,
  bumping a version constant in its source file.
- `versions.ts`: the versions shown in the README and the manual (the game, the rules,
  the saved state, the replay format, the tools), generated from their sources.
- `release.ts`: releases: works out the next version, writes it, the changelog and a commit;
  checks a pull request; tags after a merge.
- `releaseBump.ts`: how much a release bumps the version, from the commits and files (pure,
  unit-tested).
- `check-commit-msg.ts`: the commit-msg hook's check.
- `pagesSite.ts`: the GitHub Pages site with one build per branch: where each is served, putting
  a build on the site or taking it off, the list page.

## src/

### Entry and app

| File                     | Owns                                                             |
| :----------------------- | :--------------------------------------------------------------- |
| `main.tsx`               | Mounts the app                                                   |
| `version.ts`             | The game's versions, shown in the footer and the manual's header |
| `App.tsx`                | The root component (the cabinet)                                 |
| `index.css`              | Tailwind, the Emulogic font face, base styles                    |
| `styles/transitions.css` | Panel open and close animations                                  |
| `styles/docs.css`        | The manual's page styles and code colors                         |

### agent/

| File                     | Owns                                                                                          |
| :----------------------- | :-------------------------------------------------------------------------------------------- |
| `agent/AgentDriver.ts`   | The agent driver: `window.pacmanAgent` and the headless driver ([chapter](./08-agent-api.md)) |
| `agent/SpeedRecorder.ts` | Records how far each actor moves per frame, by speed source                                   |

### audio/

| File                   | Owns                                                             |
| :--------------------- | :--------------------------------------------------------------- |
| `audio/SoundEngine.ts` | Every sound, made with Web Audio: wavetables, the siren, effects |

### components/

| File                                    | Owns                                                                                    |
| :-------------------------------------- | :-------------------------------------------------------------------------------------- |
| `components/ArcadeCabinet.tsx`          | The page: header, button bar, canvas, panels, the manual; creates the engine and runner |
| `components/HUD.tsx`                    | The button bar above the screen                                                         |
| `components/LabPanel.tsx`               | The Lab panel and its tabs                                                              |
| `components/LearnModeOverlay.tsx`       | The Learn tab: the ghost AI explained                                                   |
| `components/PracticePanel.tsx`          | The Practice tab: rewind, speed, toggles, patterns, clips                               |
| `components/DebugPanel.tsx`             | The Debug tab: overlay, stepping, measurements, diagnostics, bug report                 |
| `components/ReplayBar.tsx`              | The replay viewer's controls                                                            |
| `components/RestartPanel.tsx`           | Restart Level, New Game, Change Mode; game over                                         |
| `components/ModeSelector.tsx`           | Game Modes: Pac-Man / Ms. Pac-Man, rules preset, joystick feel                          |
| `components/OptionsPanel.tsx`           | Options: key remapping, reduce flashing, colorblind colors                              |
| `components/HighScoresModal.tsx`        | The high score table (local storage)                                                    |
| `components/DocsPage.tsx`               | This manual's page                                                                      |
| `components/DocsErrorBoundary.tsx`      | What shows if the manual fails to load: try again, back to the game, reload             |
| `components/PanelTransitionWrapper.tsx` | A panel's backdrop and open/close transition                                            |
| `components/VirtualDpad.tsx`            | The on-screen D-pad                                                                     |
| `components/learn/GhostCard.tsx`        | One ghost's card in the Learn tab                                                       |
| `components/ui/ToggleCard.tsx`          | The toggle cards of the Practice tab                                                    |

### config/

| File                  | Owns                                                                  |
| :-------------------- | :-------------------------------------------------------------------- |
| `config/ui.config.ts` | UI timings (the game-over panel delay, pop-ups) and panel transitions |

### controllers/

| File                                | Owns                                                            |
| :---------------------------------- | :-------------------------------------------------------------- |
| `controllers/GameLoopController.ts` | The fixed-timestep real-time loop                               |
| `controllers/TimerController.ts`    | Scatter/chase waves and frightened time                         |
| `controllers/MovementController.ts` | Moving actors: speed masks, cornering, tunnels, the house paths |
| `controllers/GhostAiController.ts`  | Targets, Elroy, ghost decisions                                 |
| `controllers/HouseController.ts`    | Ghost house releases                                            |

### core/

| File                | Owns                                                                   |
| :------------------ | :--------------------------------------------------------------------- |
| `core/Actor.ts`     | Position, direction, speed; the tile from the center point             |
| `core/Pacman.ts`    | Buffered turns, eating stalls, the mouth, death                        |
| `core/Ghost.ts`     | The ghost's state machine (documented in full in its comment)          |
| `core/PRNG.ts`      | The frightened ghosts' random numbers                                  |
| `core/SimRandom.ts` | The simulation's other random stream (xorshift32), saved with the game |
| `core/EventBus.ts`  | The UI event bus                                                       |

### diagnostics/

| File                                           | Owns                                  |
| :--------------------------------------------- | :------------------------------------ |
| `diagnostics/rules.ts`                         | The runtime invariants                |
| `diagnostics/DiagnosticController.ts`          | Runs the rules, keeps the log         |
| `diagnostics/actorData.ts`                     | Every actor's readout for the console |
| `diagnostics/components/DiagnosticConsole.tsx` | The floating live console             |

### docs/

| File             | Owns                                                                                     |
| :--------------- | :--------------------------------------------------------------------------------------- |
| `docs/manual.ts` | Loads `docs/manual/*.md`, renders it, the search index (loaded with the page, on demand) |
| `docs/route.ts`  | The manual's `#docs/...` links, kept small for the game's bundle                         |

### game/

| File                           | Owns                                                                                            |
| :----------------------------- | :---------------------------------------------------------------------------------------------- |
| `game/GameEngine.ts`           | The simulation: one frame per `update()`, the round flow ([Architecture](./04-architecture.md)) |
| `game/sim/movement.ts`         | Moving Pac-Man and the ghosts in a frame                                                        |
| `game/sim/collisions.ts`       | Eating dots, energizers, ghosts and fruit; deaths; level clear                                  |
| `game/sim/fruit.ts`            | When fruit appears and goes                                                                     |
| `game/sim/spawn.ts`            | New actors on their spawn points                                                                |
| `game/RoundSequencer.ts`       | Round phases and their lengths                                                                  |
| `game/GameRunner.ts`           | The real-time shell: loop, events, sound, measurements, pausing                                 |
| `game/GameRenderer.ts`         | Draws a frame                                                                                   |
| `game/render/actors.ts`        | Draws Pac-Man, ghosts, eyes, fruit                                                              |
| `game/render/playerOverlay.ts` | The Learn and Practice drawings on the maze                                                     |
| `game/render/draw.ts`          | Drawing pieces shared with the debug overlay                                                    |
| `game/debugOverlay.ts`         | The debug overlay's layers                                                                      |
| `game/arcadeHud.ts`            | Scores, lives and fruit in the maze's blank rows                                                |
| `game/ghostLooks.ts`           | How each ghost looks this frame (colors, flashing, eyes)                                        |
| `game/scorePopups.ts`          | The floating points when fruit is eaten                                                         |
| `game/accessibility.ts`        | The colorblind-safe palette and reduced flashing                                                |
| `game/constants.ts`            | Tile size, rates, schedules, fruit, spawn points, colors                                        |
| `game/levelTable.ts`           | The per-level table (Table A.1)                                                                 |
| `game/speedMasks.ts`           | The 16-frame speed patterns                                                                     |
| `game/speedSource.ts`          | Which speed applies to an actor this frame, and why                                             |
| `game/ghostAiUtils.ts`         | Ghost decisions: closest exit, tie order, no-up tiles, frightened turns                         |
| `game/mazes.ts`                | The mazes, as text maps with metadata                                                           |
| `game/mazeAnalysis.ts`         | Intersections, tunnel zones, the maze validator                                                 |
| `game/rulesets.ts`             | What differs per mode                                                                           |
| `game/presets.ts`              | The Arcade and Modern rules presets                                                             |
| `game/settings.ts`             | The default rules and settings                                                                  |
| `game/gameState.ts`            | The saved state: shape, version, hash, capture and restore                                      |
| `game/simEvents.ts`            | The sim event types                                                                             |
| `game/siren.ts`                | Which siren plays                                                                               |
| `game/replay.ts`               | Recording, replays, `RULES_VERSION`                                                             |
| `game/timeline.ts`             | Rewind and scrubbing                                                                            |
| `game/ReplayViewer.ts`         | Watching a replay in the game                                                                   |
| `game/replayShare.ts`          | Replay links                                                                                    |
| `game/measurements.ts`         | Speed recording and tick rate                                                                   |
| `game/latencyMeter.ts`         | Input latency                                                                                   |
| `game/practiceTools.ts`        | Patterns and the first-death heatmap                                                            |
| `game/practiceActions.ts`      | Practice actions that change the game (invincibility, fruit, ghosts home)                       |

### hooks/

| File                         | Owns                                                                |
| :--------------------------- | :------------------------------------------------------------------ |
| `hooks/usePanels.ts`         | Which panel is open; panels hold the game and close on round events |
| `hooks/useGameOver.ts`       | Game over: the Restart panel's delay, the high score offer          |
| `hooks/useReplays.ts`        | Watching clips, links and downloads                                 |
| `hooks/useGameInput.ts`      | Keyboard, touch and gamepad                                         |
| `hooks/useEngineSettings.ts` | Changing settings and re-rendering on them                          |
| `hooks/useGameEvent.ts`      | Subscribing a component to one UI event                             |

### types/ and utils/

| File                   | Owns                                                           |
| :--------------------- | :------------------------------------------------------------- |
| `types/index.ts`       | Shared types: directions, tiles, modes, settings, debug layers |
| `utils/keyBindings.ts` | Key bindings: defaults, remapping, saving                      |
| `utils/preferences.ts` | Reading and writing preferences in local storage, safely       |
| `utils/fontLoader.ts`  | Loads the canvas pixel font, and retries if that request fails |

## tests/

See [Testing](./06-testing.md): `unit/`, `integration/`, `fidelity/`, `regression/`,
`golden/` (the replays, `scenarios.ts`, `coverage.ts`), `e2e/` (`app.tsx` and the browser
tests), and `helpers.ts`.

## docs/

| File                            | What it is                                                                         |
| :------------------------------ | :--------------------------------------------------------------------------------- |
| `docs/manual/`                  | This manual, one file per chapter                                                  |
| `docs/OPEN_ITEMS.md`            | What is still open: footage questions, decisions, missing sources                  |
| `docs/history/REFACTOR_PLAN.md` | The finished project plan: phases, decisions, the key to plan IDs in code comments |
| `docs/history/CLEANUP_PLAN.md`  | The finished clean-up pass: what was found and done                                |
| `docs/AGENT_DRIVER.md`          | A pointer to [Agent driver and API](./08-agent-api.md)                             |
