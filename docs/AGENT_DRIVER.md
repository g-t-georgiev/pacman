# Agent driver

`src/agent/AgentDriver.ts` lets an agent (or you, at the browser console) play and inspect the
game frame by frame, the way Playwright drives a web page. Every call returns plain JSON.

## Where it runs

- **Browser, dev builds:** `window.pacmanAgent` wraps the live game. `pause()` stops the
  real-time loop; after that, frames only advance through `step()` / `runUntil()` / `trace()`.
  They go through the normal runner, so sounds, the HUD and the diagnostics console react as in
  real play, and the canvas is redrawn after every call. `resume()` hands control back.
- **Headless (tests, scripts):** `new AgentDriver(new GameEngine("PACMAN", 0))` drives
  `engine.update()` directly. See `tests/unit/agentDriver.test.ts`.

## API

| Call                     | What it does                                                                     |
| ------------------------ | -------------------------------------------------------------------------------- |
| `pause()` / `resume()`   | Stop / restart the real-time loop (browser only).                                |
| `setSpeed(x)`            | Practice time scale for the real-time loop (0.25 = slow motion).                 |
| `input(dir)`             | Buffer a direction, like a key press.                                            |
| `step(n)`                | Advance exactly `n` frames. Returns `{ frames, events, view }`.                  |
| `runUntil(pred, max)`    | Step until `pred(view)` is true. Returns `{ reached, frames, events, view }`.    |
| `trace(n, pick)`         | Step `n` frames, sampling `pick(view)` after each one.                           |
| `scenario({...})`        | Set up a situation: level, play state, dots left, wave, frightened, positions.   |
| `save()` / `load(state)` | Capture / restore the complete `GameState`.                                      |
| `hash()`                 | Hash of the complete state. Equal hashes mean identical games.                   |
| `view()`                 | Frame, play state, round phase, score, lives, wave, timers, actors, house state. |
| `events()`               | Sim events since the last call (dots, ghosts eaten, deaths, state changes).      |
| `diagnostics()`          | Diagnostics rules that have failed, with messages, plus the latest log entries.  |

`scenario()` with a `level` loads that level first (fresh maze, timers, house); the other fields
are applied on top. Ghost placements default to `location: "ACTIVE"`. `dotsRemaining` removes
dots from the maze (plain dots first, then energizers) so the board matches the count.

In the browser, every call redraws the canvas and pushes score, lives, level and play state to
the HUD and panels, so they stay correct while the loop is paused. The Practice panel's pause
button does not follow `pause()` yet: the two are separate pauses (see T11 in the plan).

## Example (browser console or a browser tool)

```js
const a = window.pacmanAgent;
a.pause();
a.scenario({ level: 3, playState: "PLAYING", dotsRemaining: 15 });

// Kill Pac-Man on Blinky, then check Cruise Elroy is suspended until Clyde leaves
const b = a.view().ghosts.BLINKY;
a.scenario({ pacman: { col: b.col, row: b.row } });
a.runUntil((v) => v.playState === "PLAYING", 600);
a.view().ghosts.BLINKY.elroyStage; // 0
a.runUntil((v) => v.ghosts.CLYDE.location !== "HOUSE", 2000).view.ghosts.BLINKY.elroyStage; // 2

a.diagnostics().failing; // []
a.resume();
```
