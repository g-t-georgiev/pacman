# Changelog

Every release of Pac-Man Arcade Lab, newest first. Written by `vp run release` from
the commit messages; see the manual, "Replays, rewind and versions" > "Releases".

## 0.3.0 (2026-11-20)

### Features

- the original's start and end of a round, as measured on footage (9c63c37)

### Fixes

- the siren's five stages at the original's pitches and switch points (15cb669)
- energizers blink on and off like the original's, steady during READY (2592885)
- a fruit stays through a death, its time running, as on the original (ec58501)
- waiting ghosts start the original's way, and bob at its speed (9ae621f)

### Manual

- what three recordings of the original showed, and the plan to apply it (b7105e3)
- the ghost house's 32-dot rule and its trapped ghosts, precisely (b88a06c)

<details><summary>Why this version</summary>

- patch: 15cb669 is a fix
- patch: 15cb669 edits the manual
- patch: 2592885 is a fix
- patch: 2592885 edits the manual
- patch: ec58501 is a fix
- patch: ec58501 edits the manual
- minor: 9c63c37 is a feat
- patch: 9c63c37 edits the manual
- patch: 9ae621f is a fix
- patch: 9ae621f edits the manual
- patch: b7105e3 edits the manual
- patch: b88a06c edits the manual
- minor: rules version 2 → 5: the game plays differently

</details>

## 0.2.1 (2026-11-19)

<details><summary>Why this version</summary>

- patch: 0394b3a edits the manual

</details>

## 0.2.0 (2026-11-19)

### Fixes

- the release script compares with the newest version tag, not the newest one dev contains (e5acdd6)
- the ghosts waiting in the house no longer bob in step (8ee897f)
- the pause button shows in every build, not only in dev builds (137cdfa)

<details><summary>Why this version</summary>

- patch: e5acdd6 is a fix
- patch: 8ee897f is a fix
- patch: 8ee897f edits the manual
- patch: 137cdfa is a fix
- patch: 137cdfa edits the manual
- patch: 62868d0 edits the manual
- minor: rules version 1 → 2: the game plays differently

</details>

## 0.1.1 (2026-11-18)

<details><summary>Why this version</summary>

- patch: 52428c3 edits the manual

</details>

## 0.1.0 (2026-11-18)

The first versioned release: everything before it is the starting point.

- Pac-Man and Ms. Pac-Man on a deterministic simulation that follows the arcade's published
  mechanics (The Pac-Man Dossier): speed patterns, cornering, look-ahead ghost decisions, the four
  personalities and the overflow quirk, scatter/chase waves, frightened mode, Cruise Elroy, the
  ghost house counters, the per-level table.
- Arcade and Modern rules presets, remappable keys, touch, gamepads, reduced flashing,
  colorblind-safe colors.
- The Lab (Learn, Practice, Debug), rewind, replays with share links, the agent driver.
- The in-game manual, and versions shown in the game, the manual and the README.
