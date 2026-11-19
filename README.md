# Pac-Man Arcade Lab

A Pac-Man that plays like the 1980 arcade machine, and a workbench for studying how it does that.
The mechanics follow _The Pac-Man Dossier_ and other published analyses, rule by rule, in the
arcade's own units (8-pixel tiles, whole pixels, one step per arcade frame at 60.606 Hz). Built with
TypeScript, React and the Canvas 2D API on a deterministic simulation.

Two modes: **Pac-Man** and **Ms. Pac-Man**.

**Play it:** [g-t-georgiev.github.io/pacman](https://g-t-georgiev.github.io/pacman/) (the latest release on
`main`). Every branch has its own build too, at `/pacman/<branch>/`: see the
[list of builds](https://g-t-georgiev.github.io/pacman/branches/).

## The manual

Everything is documented in the **manual**: in the game (**📖 Manual** in the top bar, or a link
such as `#docs/arcade-rules`), and as Markdown in [`docs/manual/`](docs/manual/).

| Chapter                                                                 | For                                                                           |
| :---------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| [Introduction](docs/manual/01-introduction.md)                          | What the game is, quick start                                                 |
| [Playing](docs/manual/02-playing.md)                                    | Controls, remapping, touch and gamepads, options, devices                     |
| [The arcade rules](docs/manual/03-arcade-rules.md)                      | How the arcade game works, each rule with its source or marked as an estimate |
| [Architecture](docs/manual/04-architecture.md)                          | The deterministic engine, the real-time shell, the game loop, events          |
| [Replays, rewind and versions](docs/manual/05-replays-and-versions.md)  | Recording, rewind, replay files and links, version bumps                      |
| [Testing](docs/manual/06-testing.md)                                    | The suites, golden replays, writing tests                                     |
| [Debugging and tools](docs/manual/07-debugging-tools.md)                | The Lab, the debug overlay, measurements, hunting a bug                       |
| [Agent driver and API](docs/manual/08-agent-api.md)                     | `window.pacmanAgent`, headless use, integrating other tools                   |
| [Measuring from the browser console](docs/manual/09-console-recipes.md) | Copy-paste recipes                                                            |
| [Files and scripts](docs/manual/10-files-and-scripts.md)                | Every file and script, checked by a test                                      |

## Running it

The project uses [Vite+](https://viteplus.dev/guide/) (the `vp` command; it brings Node and the
package manager).

```bash
vp install           # dependencies (after every pull)
vp dev --port=3000   # the dev server: debug overlay, agent driver and diagnostics are on
vp build             # the production build in dist/
```

## Checking it

```bash
vp check               # format, lint, type check
vp test                # every test: the headless suites, then the browser tests
vp run test:unit       # the headless suites only (a few seconds)
vp run test:e2e        # the app in Chromium (first time: vp exec playwright install chromium)
vp run test:regression # core contracts and fixed bugs (under a second)
vp run golden:check    # do the golden replays still play back exactly?
vp run golden:update   # re-record them after an intended change (bumps the versions itself)
vp run docs:versions   # update the versions shown in this README and the manual
vp run release -- --dry-run # the next version and why; `vp run release` makes it (on dev)
```

Every commit runs the format and lint, the golden check, the versions check and the regression
suite (the pre-commit hook). Every push runs all checks, every test and the build
([CI](.github/workflows/ci.yml)).

## Features

- **Arcade-accurate play:** speed patterns, cornering, look-ahead ghost decisions, the four
  personalities and the "up" overflow quirk, scatter/chase waves, frightened mode with the
  arcade's random-number scheme, Cruise Elroy, the ghost house counters, the per-level table.
  See [The arcade rules](docs/manual/03-arcade-rules.md).
- **Rules presets:** Arcade (the original, quirks included) or Modern (no overflow, 60 Hz), and
  an optional joystick feel.
- **Options:** remappable keys, touch swipes, an on-screen D-pad, gamepads, reduced flashing,
  colorblind-safe colors.
- **The Lab:** a ghost AI explainer (Learn), rewind, slow motion, routes and a death heatmap
  (Practice), and every debugging and measuring tool (Debug).
- **Replays:** a rolling recording of the last two minutes, exact rewind, clips to watch in the
  game, download or share as a link.
- **The agent driver:** script, inspect and test the game frame by frame, in the browser console
  or headless.

## Project layout

```
src/            the game: engine (game/), controllers, actors (core/), UI (components/, hooks/),
                sound, the agent driver, diagnostics, the manual page (docs/)
tests/          unit, integration, fidelity, regression, golden replay and e2e (browser) tests
scripts/        golden replays: update, check, trace
docs/manual/    the manual, one Markdown file per chapter
docs/           OPEN_ITEMS.md (what is still open); history/ (the finished plans)
public/         the canvas font and the icon
```

Every file is described in [Files and scripts](docs/manual/10-files-and-scripts.md).

## Open questions

Some values have no published source and are estimates until checked against the original game
(round phase lengths, the energizer's look, when the start tune plays, the ghost house release
overlap, sounds). They are tracked, with the constant that sets each one, in
[`docs/OPEN_ITEMS.md`](docs/OPEN_ITEMS.md), along with two rule decisions still to make. The
finished project plans are kept in [`docs/history/`](docs/history/).

## Versions

<!-- versions:start (generated by `vp run docs:versions`; checked by a test) -->

This README describes **Pac-Man Arcade Lab 0.1.1**.

| What                                         | Version                               |
| :------------------------------------------- | :------------------------------------ |
| Game                                         | 0.1.1                                 |
| Manual (in the game and in `docs/manual/`)   | 0.1.1: it describes this game version |
| Rules: what a frame does (replays record it) | 1                                     |
| Saved state: its shape (replays record it)   | 6                                     |
| Replay files: their format                   | 2                                     |
| Vite+: dev server, build, lint, format       | 1.4.0                                 |
| Vitest: the tests                            | 5.0.5                                 |
| Playwright: the browser tests (Chromium)     | 1.65.1                                |
| TypeScript                                   | 7.0.2                                 |
| React                                        | 19.3.1                                |
| Tailwind CSS                                 | 4.3.3                                 |
| marked and highlight.js: the manual's page   | 18.2.1 and 11.12.0                    |
| Node.js: CI                                  | 26                                    |
| bun: package manager                         | 1.4.4                                 |

<!-- versions:end -->

The game's version is in `package.json`; the rules and saved-state versions are bumped by
`vp run golden:update` when play changes (see
[Replays, rewind and versions](docs/manual/05-replays-and-versions.md#versions)). The table is
regenerated by `vp run docs:versions`; the pre-commit hook and a test fail when it is out of
date. Releases bump the game's version from the commit messages, tag it on `main` and keep
[`CHANGELOG.md`](CHANGELOG.md): see [Releases](docs/manual/05-replays-and-versions.md#releases).

## Credits

- Pac-Man and Ms. Pac-Man are trademarks of Bandai Namco. This is a fan-made study of the
  game's published mechanics; it contains no code or data from the original ROMs.
- The main source is _The Pac-Man Dossier_ by Jamey Pittman; frightened-ghost randomness after
  _Retro Game Mechanics Explained_.
- **Emulogic** font (canvas texts), © 2004 ck! / [freakyfonts.de](http://www.freakyfonts.de), in
  `public/fonts/`. Check the author's terms before publishing the game.
