# Pac-Man Arcade Lab

A Pac-Man game that follows the original arcade mechanics as documented in _The Pac-Man
Dossier_ and in published analyses, built with TypeScript, React and the Canvas 2D API, with a
deterministic simulation and tooling to study and test it.

Two modes: **Pac-Man** and **Ms. Pac-Man**.

## Running and checking

This project uses [Vite+](https://viteplus.dev/guide/) (`vp`).

```bash
vp install           # after pulling
vp dev --port=3000   # dev server (debug overlay, agent driver and diagnostics enabled)
vp check             # format, lint, type check
vp test              # unit, integration, fidelity and golden replay tests
vp run golden:update # re-record golden replays after an intended mechanics change
```

## Controls

| Action                            | Keys                         |
| :-------------------------------- | :--------------------------- |
| Move                              | Arrow keys or W A S D        |
| Pause / resume (closes panels)    | Space, or ⏸ in the HUD (dev) |
| Close panel, else pause           | Escape                       |
| Turbo (1.6×)                      | T                            |
| Lab: Learn tab (ghost AI lab)     | L                            |
| Lab: Practice tab (rewind, speed) | P                            |
| Rewind 2 s (Lab open)             | R                            |
| Debug overlay (dev builds)        | F1                           |
| Step 1 frame / to next mode (dev) | `.` / `>` while paused       |

Touch swipes, an on-screen D-pad and gamepads work too.

## Mechanics

The simulation runs in the arcade's own units: 8-px tiles, integer pixel positions, one tick per
arcade frame, with the real-time loop at 60.606 Hz. The canvas draws it at 2×. Per-level values
(speeds, Elroy, frightened time, flashes, fruit, house limits, schedule) are one table,
`src/game/levelTable.ts`, checked row by row against the Dossier's Table A.1.

- **Speed.** Percentages of 1.25 px/frame (75.76 px/s). Each speed is a 16-frame step mask, so
  80% moves exactly 1 px every frame. Pac-Man stops 1 frame per dot and 3 per energizer.
- **Cornering.** Pac-Man may turn up to 3 px before or 4 px after a turn's center (mirrored on
  the other side) and moves diagonally while he does. Input is buffered.
- **Ghost decisions.** On entering a tile, a ghost decides which way to turn at the next one,
  choosing the exit closest to its target (ties: up, left, down, right). It turns at tile
  centers, never reverses on its own, and cannot turn up in the four no-up tiles.
- **Reversals.** Every scatter/chase switch and the start of frightened mode make ghosts reverse,
  obeyed on entering their next tile. Leaving frightened mode does not.
- **Targets.** Blinky: Pac-Man's tile. Pinky: 4 tiles ahead of Pac-Man. Inky: the vector from
  Blinky to 2 tiles ahead of Pac-Man, doubled. Clyde: Pac-Man while 8 or more tiles away, his
  corner when closer. The arcade's overflow when Pac-Man faces up (Pinky and Inky also shift
  left) is on by default and can be turned off.
- **Cruise Elroy.** Blinky speeds up at a level-dependent number of dots left (20 on level 1, up
  to 120), and again at half that; he keeps chasing during scatter. Suspended after a death until
  Clyde leaves the house.
- **Frightened.** No target: an arcade-shaped PRNG picks a direction at every tile, trying the
  next one clockwise when blocked. From level 17, energizers only reverse the ghosts.
- **Ghost house.** Personal dot counters, a global counter after a death (7/17/32), and an idle
  timer (4 s, 3 s from level 5). Ghosts leave to the left; a reversal latched inside is obeyed
  outside.
- **Round flow.** READY, a 1 s pause when a ghost is eaten (score shown, eyes keep moving), a
  freeze before the death animation, maze flashes on a level clear, an extra life at 10,000,
  fruit after 70 and 170 dots for 9-10 s.

Not every value has a source: phase lengths other than the eat pause and death freeze, the eyes'
speed and the house speed are estimates, marked as such in the code. The speed bit patterns are
evenly spaced placeholders on the Dossier's scale. See `docs/REFACTOR_PLAN.md` for the open
questions.

## Debugging and testing tools

- **Agent driver** (`window.pacmanAgent` in dev builds; `docs/AGENT_DRIVER.md`): pause, step,
  run until a condition, set up scenarios, inspect state, record speeds, save and verify
  replays. Works headless in tests too.
- **Replays.** The game keeps a rolling recording (a keyframe every second, inputs, state
  hashes). The last 2 minutes can be rewound exactly from the Lab's Practice tab, saved as a file,
  and verified on another build.
- **Replay viewer.** Watch a clip of the last 20 s inside the game (Lab, Practice tab), with
  play/pause, speed and scrub, or share it as a link (`#replay=...` opens the viewer).
- **Golden replays.** `tests/golden/*.json` must replay hash for hash; a mechanics change fails
  at the first second that differs.
- **Debug overlay (F1).** Layers for the grid, occupied tiles, ghost targets and decisions,
  no-up and tunnel zones, intersections, Pac-Man's turn window, a speed readout, the
  scatter/chase timeline and the ghost house counters.
- **Fidelity suite.** `tests/fidelity/dossier.test.ts`, one test per Dossier claim.
- **Diagnostics console.** Runtime invariants, checked in dev builds or while the console is open.

## Project structure

```
src/
├── agent/          AgentDriver (runtime test driver), SpeedRecorder
├── audio/          SoundEngine (procedural Web Audio)
├── components/     React UI: cabinet, HUD, Learn/Practice/Restart panels, debug overlay panel
├── config/         ui.config.ts (UI timings and panel transitions)
├── controllers/    Game loop, timers, ghost AI, movement, ghost house, animation
├── core/           Actor, Pacman, Ghost, PRNG, SimRandom, EventBus
├── diagnostics/    Runtime invariant rules and the diagnostics console
├── game/
│   ├── GameEngine.ts      The pure simulation (no audio, UI or clock)
│   ├── GameRunner.ts      Real-time shell: loop, renderer, audio, events
│   ├── RoundSequencer.ts  READY, play, eat pause, death and level-clear phases
│   ├── levelTable.ts      Per-level values (Table A.1)
│   ├── speedMasks.ts      16-frame speed step masks
│   ├── replay.ts          Recording, replay, rewind keyframes
│   ├── gameState.ts       Serializable state and its hash
│   ├── debugOverlay.ts    Debug overlay layers
│   ├── mazes.ts           Maze data and spawn points
│   └── ...                Renderer, constants, events, AI helpers
├── hooks/          useGameEvent
├── types/          Shared types
└── utils/          Per-level helpers and speed steps
tests/              unit, integration, fidelity and golden replay tests
scripts/            update-golden.ts
docs/               REFACTOR_PLAN.md, AGENT_DRIVER.md
```
