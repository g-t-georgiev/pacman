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

| Call                     | What it does                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- |
| `pause()` / `resume()`   | Stop / restart the real-time loop (browser only).                                 |
| `setSpeed(x)`            | Practice time scale for the real-time loop (0.25 = slow motion).                  |
| `input(dir)`             | Buffer a direction, like a key press.                                             |
| `step(n)`                | Advance exactly `n` frames. Returns `{ frames, events, view }`.                   |
| `runUntil(pred, max)`    | Step until `pred(view)` is true. Returns `{ reached, frames, events, view }`.     |
| `trace(n, pick)`         | Step `n` frames, sampling `pick(view)` after each one.                            |
| `scenario({...})`        | Set up a situation: level, play state, dots left, wave, frightened, positions.    |
| `save()` / `load(state)` | Capture / restore the complete `GameState`.                                       |
| `hash()`                 | Hash of the complete state. Equal hashes mean identical games.                    |
| `view()`                 | Frame, play state, round phase, score, lives, wave, timers, actors, house state.  |
| `events()`               | Sim events since the last call (dots, ghosts eaten, deaths, state changes).       |
| `saveReplay(s?)`         | The last `s` seconds (or ~2 min) of play as a replay: keyframe + inputs + hashes. |
| `downloadReplay(s?)`     | Browser: the same, saved as a `.json` file to attach to a bug report.             |
| `verifyReplay(r)`        | Re-run a replay headless and report whether it matched, or where it diverged.     |
| `loadReplay(r, stopAt?)` | Fast-forward this game through a replay (to its end or `stopAt`), left paused.    |
| `recordSpeeds()`         | Start recording every actor's movement per play frame (live play or stepping).    |
| `speedReport()`          | Measured vs table px/frame per actor and speed source, and real ticks per second. |
| `stopSpeeds()`           | Stop recording and return the final report.                                       |
| `measureTickRate(s)`     | Count real-time ticks over the next `s` seconds (browser). Returns a promise.     |
| `diagnostics()`          | Diagnostics rules that have failed, with messages, plus the latest log entries.   |

`scenario()` with a `level` loads that level first (fresh maze, timers, house); the other fields
are applied on top. Ghost placements default to `location: "ACTIVE"`. `dotsRemaining` removes
dots from the maze (plain dots first, then energizers) so the board matches the count.

In the browser, every call redraws the canvas and pushes score, lives, level and play state to
the HUD and panels, so they stay correct while the loop is paused. The Practice panel's pause
button does not follow `pause()` yet: the two are separate pauses (see T11 in the plan).

## Replays and bug reports

The game always keeps a rolling recording: a full keyframe every second (the last 2 minutes),
every joystick input keyed on the sim tick it precedes, and a state hash every second. The sim
is deterministic, so a keyframe plus the inputs after it reproduce the game exactly. The
Practice panel's rewind uses the same log: it rebuilds any of those frames from the nearest
keyframe.

```js
// Something odd just happened: save the last 20 seconds
pacmanAgent.downloadReplay(20);

// Later (paste the file's JSON), reproduce it and stop just before the odd moment
const replay = JSON.parse(/* file contents */);
pacmanAgent.verifyReplay(replay); // { matched: true, ... } on the same build
pacmanAgent.loadReplay(replay, replay.endTick - 120); // two seconds before the end, paused
pacmanAgent.trace(120, (v) => v.ghosts.BLINKY); // then step through it
```

The recording starts over whenever the state is edited outside a tick (new game, level restart,
rewind, `load()`, `scenario()`) or a sim setting changes (ROM quirks, invincibility, turbo).
On a build with different mechanics, `verifyReplay` reports `divergedAt`, the first second
that no longer matches.

**Golden replays (CI).** `tests/golden/*.json` are replays of fixed scenarios
(`tests/golden/scenarios.ts`); `goldenReplays.test.ts` replays them and fails at the first
second that differs. After an intentional mechanics change, re-record them with
`vp run golden:update` and commit the files with the change.

## Checking speeds

Speeds are percentages of 1.25 px/frame (Dossier), so 80% is 1 px every frame and the expected
px/frame is `pct / 80`. To check a session that feels off, record it while you play:

```js
pacmanAgent.recordSpeeds();
// ... play normally for a while ...
console.table(pacmanAgent.speedReport().rows);
pacmanAgent.speedReport().ticksPerSecond; // 60.606 with arcade timing (60 without), × practice speed
```

`ticksPerSecond` in the report only counts time while ticks were running: time with the tab hidden
or the loop stopped is left out (`realSeconds` vs `activeSeconds`). For a direct check, keep the
game running and visible and run `await pacmanAgent.measureTickRate(5)`: it returns the tick rate,
the expected rate, and the browser's animation frame rate over those 5 seconds.

Each row is one actor and speed source (`pacman-normal`, `pacman-fright`, `pacman-stall`,
`ghost-normal`, `ghost-tunnel`, `ghost-fright`, `ghost-elroy1/2`, `ghost-eyes`, `ghost-house`).
`ratio` is measured / expected: 1.00 is exactly the table speed. Frames where Pac-Man pushes
into a wall are counted in `blockedFrames`, not as speed samples.

## Example (browser console or a browser tool)

```js
const a = window.pacmanAgent;
a.pause();
a.scenario({ level: 3, playState: "PLAYING", dotsRemaining: 15 });

// Kill Pac-Man on Blinky, then check Cruise Elroy is suspended until Clyde leaves
const b = a.view().ghosts.BLINKY;
a.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } }); // facing Blinky
a.runUntil((v) => v.playState === "PLAYING", 600);
a.view().ghosts.BLINKY.elroyStage; // 0
a.runUntil((v) => v.ghosts.CLYDE.location !== "HOUSE", 2000).view.ghosts.BLINKY.elroyStage; // 2

a.diagnostics().failing; // []
a.resume();
```
