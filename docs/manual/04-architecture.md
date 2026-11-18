# Architecture

The game is split in two: a **pure simulation** that knows nothing about time, screens or sound,
and a **real-time shell** around it that runs the clock, draws, plays sounds and talks to the
React UI. Everything else (rewind, replays, tests, the agent driver) works because of that split.

```text
            ┌──────────────────────── the shell (browser) ─────────────────────────┐
 keyboard   │  React UI (ArcadeCabinet, panels, HUD)   ◀── UI event bus ──┐         │
 touch  ───▶│        │ input                                              │         │
 gamepad    │        ▼                                                    │         │
            │  GameRunner ── GameLoopController (fixed 60.606 Hz steps)   │         │
            │    │  tick()                     render()                   │         │
            │    ▼                               ▼                        │         │
            │  ┌────────────────────┐    GameRenderer (canvas)           │         │
            │  │ GameEngine (sim)   │──── sim events ──▶ dispatch ────────┴─▶ SoundEngine
            │  │ pure, deterministic│                                               │
            │  └────────────────────┘                                               │
            └───────────────────────────────────────────────────────────────────────┘
```

## The simulation: GameEngine

[GameEngine.ts](../../src/game/GameEngine.ts) holds the whole game and advances it **one arcade
frame per `update()` call**. It has no clock, no `requestAnimationFrame`, no audio and no DOM.
Given the same state and the same inputs, `update()` always produces the same next state. That
property, determinism, is the foundation of everything below.

What keeps it deterministic:

- **Integer arcade pixels** and frame counters; no floating-point physics, no `Date.now()`.
- **Its own random streams**, stored in the state: the frightened-ghost PRNG
  ([PRNG.ts](../../src/core/PRNG.ts)) and `SimRandom` for the fruit timer. `Math.random` is never
  used in the simulation.
- **Input as data.** A key press becomes `engine.setInputDirection(dir)`, which buffers it for
  the next frame and logs it with the frame number for replays.
- **Rules vs settings.** `engine.rules` (`emulateRomQuirks`, `invincible`, `turbo`) change the
  game and are recorded in replays. `engine.settings` (debug overlay, colors, sound, practice
  speed) only change how it is shown or run, never what a frame does. Code:
  [settings.ts](../../src/game/settings.ts).

### One frame

```text
engine.update()
 ├─ paused or scrubbing?  → return (not even the frame counter moves)
 ├─ lifeFrame++, tick++
 ├─ phase PLAYING:
 │    ├─ timers: scatter/chase wave, frightened time  (reversals on a switch)
 │    ├─ movePacman   (speed mask → 0, 1 or 2 pixels, each a full step; eating stalls)
 │    ├─ moveGhosts   (house releases, Elroy stage, each ghost: house move or target + step)
 │    ├─ checkCollisions (dots, energizers, ghosts, fruit; level clear)
 │    └─ updateFruit
 ├─ any other phase: count it down (eyes still move in the ghost-eaten pause)
 │    └─ when it ends: the next phase (READY → PLAYING, death steps, level clear → next level)
 └─ replay recording: a keyframe every second, a state hash every second
```

The pieces of a frame live in [src/game/sim/](../../src/game/sim/) (movement, collisions,
fruit, spawning) and in the controllers:

| Controller                                                        | Owns                                                                |
| :---------------------------------------------------------------- | :------------------------------------------------------------------ |
| [TimerController](../../src/controllers/TimerController.ts)       | The scatter/chase schedule and frightened time                      |
| [MovementController](../../src/controllers/MovementController.ts) | Moving one actor: speed masks, cornering, tunnels, the house paths  |
| [GhostAiController](../../src/controllers/GhostAiController.ts)   | Targets per ghost, Elroy, the look-ahead decision                   |
| [HouseController](../../src/controllers/HouseController.ts)       | Who leaves the house when: dot counters, global counter, idle timer |
| [RoundSequencer](../../src/game/RoundSequencer.ts)                | The round's phases and their countdowns                             |

### Round phases

`playState` (READY, PLAYING, DYING, LEVEL_CLEAR, GAME_OVER, or PAUSED) is what the UI shows. The
finer **phase** drives the engine:

```text
READY ─▶ PLAYING ◀─▶ GHOST_EATEN_PAUSE
            ├─▶ DEATH_FREEZE ─▶ DEATH_ANIM ─▶ DEATH_WAIT ─▶ READY  (or GAME_OVER)
            └─▶ LEVEL_CLEAR_FREEZE ─▶ MAZE_FLASH ─▶ READY (next level)
```

Only PLAYING runs the game; every other phase is a countdown. `playState` is read-only; the
engine and scenarios change the phase with `enterPhase()`.

### Actors

[Actor](../../src/core/Actor.ts) is a position, a direction and a speed.
[Pacman](../../src/core/Pacman.ts) adds the buffered turn, eating stalls and the mouth.
[Ghost](../../src/core/Ghost.ts) is a small state machine whose comment draws it in full:

- **where it is**: HOUSE → LEAVING → ACTIVE → EYES → ENTERING → HOUSE;
- **what it does**: the global wave, a `frightened` flag, Elroy, and a derived `mode`;
- **how it moves**: its target, the planned turn and a reversal latch.

### Data, not branches

- **Mazes** are text maps with metadata (spawns, tunnels, no-up tiles, scatter corners):
  [mazes.ts](../../src/game/mazes.ts). [mazeAnalysis.ts](../../src/game/mazeAnalysis.ts)
  derives intersections and tunnel zones and validates a maze.
- **Modes** are [rulesets](../../src/game/rulesets.ts): what differs between Pac-Man and Ms.
  Pac-Man (maze, look, fruit) is an entry, not `if (mode === ...)` code.
- **Levels** are one table: [levelTable.ts](../../src/game/levelTable.ts).

### The saved state

[gameState.ts](../../src/game/gameState.ts) defines `GameState`: everything `update()` reads or
writes, as plain JSON. `captureState(engine)` and `applyState(engine, state)` round-trip it
exactly; static maze data isn't stored (it comes from the mode and level), only the dots left.

`hashGameState` is a 32-bit FNV-1a hash of it. Equal states hash equal, so two runs can be
compared frame by frame by their hashes. Rewind snapshots, replay keyframes, golden tests and
the agent's `hash()` all use it. `GAME_STATE_VERSION` changes whenever the shape does (see
[Replays, rewind and versions](./05-replays-and-versions.md)).

## The shell: GameRunner

[GameRunner.ts](../../src/game/GameRunner.ts) runs the engine in real time. On every tick it:

1. polls the gamepads (`onPreUpdate`), lets the replay viewer feed recorded input;
2. calls `engine.update()` and measures it (speed recorder, tick rate);
3. updates the practice tools, input latency and score pop-ups;
4. **flushes the sim events**: each one becomes sounds and UI bus notifications;
5. syncs the siren with the game's state;
6. in dev builds, checks the runtime invariants.

### The game loop

[GameLoopController.ts](../../src/controllers/GameLoopController.ts) is a **fixed-timestep**
loop. Every display frame (`requestAnimationFrame`) it adds the real time that passed to an
accumulator and runs one tick per 1/60 s it holds; then it draws once. So:

- **Ticks** are simulation frames, always exactly the same. **Frames** are what the display
  shows; on a 144 Hz screen several frames show the same tick.
- The rate is 60.606 ticks per second (Arcade) or 60 (Modern), times the **practice speed**.
  Slow motion runs fewer ticks per second, not different ticks.
- A long stall (a hidden tab) is capped at 100 ms, so the game slows down rather than racing to
  catch up.

### Pausing: who holds the game

The game can be held for several reasons at once: `user` (Space), `panel` (a panel is open),
`agent` (the agent driver), `replay` (the replay viewer) and `docs` (this manual). It runs only
when **nobody** holds it, so closing a panel doesn't resume a game you paused yourself.
`runner.setPaused(reason, on)` and `runner.pausedBy` manage it.

### Events: two buses

- **Sim events** ([simEvents.ts](../../src/game/simEvents.ts)) are what happened in a frame:
  `DOT_EATEN`, `GHOST_EATEN`, `PACMAN_DIED`, `LEVEL_CLEARED`, `EXTRA_LIFE`... The engine only
  queues them; it never calls out. The runner drains the queue after each tick.
- **The UI bus** ([EventBus.ts](../../src/core/EventBus.ts)) carries what the React UI needs
  (`SCORE_CHANGED`, `ROUND_STATE_CHANGED`, `GAME_OVER`, `UI_SYNC`...).

Because the engine never reaches out, a test can run a thousand frames without sound or React,
and a rewind can replay frames without playing their sounds again.

### Drawing

[GameRenderer.ts](../../src/game/GameRenderer.ts) draws the engine's state on a canvas, reading
it and never changing it: the maze, dots, the HUD rows, actors
([render/actors.ts](../../src/game/render/actors.ts)), the Learn and Practice overlays
([render/playerOverlay.ts](../../src/game/render/playerOverlay.ts)) and the debug overlay
([debugOverlay.ts](../../src/game/debugOverlay.ts)).

### Sound

[SoundEngine.ts](../../src/audio/SoundEngine.ts) makes every sound with the Web Audio API
(wavetables built in code, no audio files). The siren is one oscillator re-tuned as the game's
state changes, chosen by [siren.ts](../../src/game/siren.ts).

### The UI

React components in [src/components/](../../src/components/), with the behavior in hooks:
[usePanels](../../src/hooks/usePanels.ts) (which panel is open, what panels do to the game),
[useGameOver](../../src/hooks/useGameOver.ts), [useReplays](../../src/hooks/useReplays.ts),
[useGameInput](../../src/hooks/useGameInput.ts) (keyboard, touch, gamepad) and
[useEngineSettings](../../src/hooks/useEngineSettings.ts). The cabinet creates one engine and one
runner on mount and keeps them for the page's life.

## How the classic mechanics map to code

| Arcade                                              | Here                                                                 |
| :-------------------------------------------------- | :------------------------------------------------------------------- |
| A Z80 main loop, one pass per video frame           | `engine.update()`, one call per frame; the runner supplies the clock |
| Speeds as bit patterns read each frame              | 16-frame step masks indexed by `lifeFrame` (`speedMasks.ts`)         |
| Positions in pixels, tiles from the upper bits      | Integer pixels; `tileCoord` from the center point                    |
| Decisions taken one tile ahead                      | `plannedDir` decided on tile entry, taken at the tile center         |
| Reversal flag set on a mode change                  | `reversalPrimed` latch, obeyed on entering the next tile             |
| Frightened turns from ROM bytes at a stepping index | The same index sequence over a table with the ROM's direction mix    |
| The "up" overflow in the target code                | `emulateRomQuirks` (Arcade preset)                                   |
| House counters in RAM                               | `HouseController` state, saved with the game                         |
| Collision by sharing a tile                         | `checkCollisions`, once per frame, tile against tile                 |

The goal is the arcade's **behavior**, frame for frame where sources allow, written as readable
TypeScript rather than an emulation of the hardware.
