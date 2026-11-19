# Agent driver and API

The **agent driver** ([AgentDriver.ts](../../src/agent/AgentDriver.ts)) plays and inspects the
game frame by frame, the way Playwright drives a web page. It is for AI agents, test code, other
tools and people at the browser console. Every call returns plain JSON.

> **Renamed (2026-11-18):** `scenario({ phase })` replaces `scenario({ playState })`, and
> `view().lifeFrame` replaces `view().frame`. The old names still work for one more version.

## Where it runs

- **In the browser (dev builds):** `window.pacmanAgent` wraps the live game. `pause()` holds it
  (the `agent` pause reason); then frames advance only through `step()`, `runUntil()` and
  `trace()`. Steps go through the real runner, so sounds, the HUD and the diagnostics react as in
  play, and the canvas is redrawn after every call. Steps also work while you or a panel hold
  the game; `view().pausedBy` says who does. `resume()` releases only the agent's hold.
- **Headless (tests, scripts, Node):** `new AgentDriver(new GameEngine("PACMAN", 0))` drives
  `engine.update()` directly; no browser, no clock. The browser-only calls (`watchReplay`,
  `latency`, `measureTickRate`) throw there.

```ts
import GameEngine from "./src/game/GameEngine";
import { AgentDriver } from "./src/agent/AgentDriver";

const agent = new AgentDriver(new GameEngine("PACMAN", 0));
agent.scenario({ level: 1, phase: "PLAYING" });
agent.input("UP");
const { events, view } = agent.step(60);
```

## Reference

### Running

| Call                        | Returns                             | What it does                                                                            |
| :-------------------------- | :---------------------------------- | :-------------------------------------------------------------------------------------- |
| `pause()`                   | view                                | Hold the game for the agent (browser). Other holds stay.                                |
| `resume()`                  | —                                   | Release the agent's hold.                                                               |
| `setSpeed(x)`               | —                                   | Practice speed of the real-time loop (0.25 = slow motion).                              |
| `input(dir)`                | view                                | Buffer a direction (`"UP"`, `"DOWN"`, `"LEFT"`, `"RIGHT"`, `"NONE"`), like a key press. |
| `step(n = 1)`               | `{ frames, events, view }`          | Run exactly `n` frames.                                                                 |
| `advance(n = 1)`            | —                                   | Run `n` frames without building a result (fast loops).                                  |
| `runUntil(pred, max = 600)` | `{ reached, frames, events, view }` | Run until `pred(view)` is true, checked after every frame, or `max` frames.             |
| `trace(n, pick?)`           | array                               | Run `n` frames, recording `pick(view)` (default: the whole view) after each.            |

### Setting up

`scenario(s)` arranges a situation. With `level`, it starts that level fresh first; the other
fields are applied on top. It starts a new recording (the edits aren't inputs).

| Field                    | Meaning                                                                                                |
| :----------------------- | :----------------------------------------------------------------------------------------------------- |
| `level`                  | Load this level (maze, timers, house, actors)                                                          |
| `phase`                  | Enter this round phase: `"PLAYING"` skips READY; also `"PLAYER_ONE"`, `"READY"`, `"DEATH_FREEZE"`, ... |
| `dotsRemaining`          | Remove dots (plain first, in reading order, then energizers) until this many remain                    |
| `waveIndex`, `waveTimer` | Position in the scatter/chase schedule (index 0 = first scatter)                                       |
| `frightened`             | Start frightened mode, as an energizer would                                                           |
| `prngIndex`              | The frightened PRNG's position (0-8191)                                                                |
| `randomSeed`             | Seed of the other random stream (fruit timer)                                                          |
| `pacman`                 | `{ col, row, dir? }`: placed on the tile's center                                                      |
| `ghosts`                 | `{ BLINKY: { col, row, dir?, location?, frightened? }, ... }`; `location` defaults to `"ACTIVE"`       |

| Call          | Returns     | What it does                                              |
| :------------ | :---------- | :-------------------------------------------------------- |
| `save()`      | `GameState` | The complete state, as JSON                               |
| `load(state)` | view        | Restore a saved state exactly                             |
| `hash()`      | number      | Hash of the complete state: equal hashes, identical games |

### Looking

| Call                  | Returns                                                                                                                                                                                                                                                                                                                                                                                               |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view()`              | `lifeFrame`, `playState`, `pausedBy`, `phase`, `phaseFramesLeft`, `level`, `score`, `lives`, `dotsRemaining`, `wave`, `waveIndex`, `waveTimer`, `frightenedFrames`, `pacman` (position, tile, `dir`, `nextDir`, `cornerTarget`), `ghosts` (each: position, tile, `dir`, `location`, `mode`, `frightened`, `target`, `elroyStage`, `reversalPrimed`), `house` (counters, idle frames, Elroy suspended) |
| `events()`            | The sim events since the last call: `DOT_EATEN`, `ENERGIZER_EATEN`, `GHOST_EATEN`, `FRUIT_EATEN`, `PACMAN_DIED`, `EXTRA_LIFE`, `LEVEL_CLEARED`, `GAME_OVER`, `SCORE_CHANGED`, ...                                                                                                                                                                                                                     |
| `diagnostics(n = 10)` | The invariant rules that have failed, and the last `n` log entries                                                                                                                                                                                                                                                                                                                                    |
| `debug(layers?)`      | Show (`true`) or hide (`false`) the debug overlay, or switch layers (`{ targets: true }`); returns the layers                                                                                                                                                                                                                                                                                         |

### Replays

| Call                     | Returns                                                                  | What it does                                                                    |
| :----------------------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| `saveReplay(s?)`         | `Replay`                                                                 | The last `s` seconds (default: all recorded, ~2 min)                            |
| `downloadReplay(s?)`     | `Replay`                                                                 | The same, saved as a `.json` file (browser)                                     |
| `replayLink(s?)`         | `Promise<string>`                                                        | A link that opens it in the viewer                                              |
| `verifyReplay(r)`        | `{ ticks, matched, divergedAt, lastMatchedAt }`                          | Play it on a separate engine and compare every hash; the live game is untouched |
| `loadReplay(r, stopAt?)` | the same, plus `view`                                                    | Fast-forward **this** game through it, to its end or `stopAt`, and hold there   |
| `watchReplay(r)`         | viewer state                                                             | Watch it in the game in real time (browser)                                     |
| `watching()`             | `{ active, playing, startTick, endTick, tick, divergedAt, versionNote }` | The viewer's state                                                              |
| `stopWatching()`         | —                                                                        | Back to the live game                                                           |

### Measuring

| Call                     | Returns                                                           | What it does                                             |
| :----------------------- | :---------------------------------------------------------------- | :------------------------------------------------------- |
| `recordSpeeds()`         | —                                                                 | Start recording every actor's movement per play frame    |
| `speedReport()`          | `{ rows, ticksPerSecond, ... }`                                   | Measured against table speed per actor and source        |
| `stopSpeeds()`           | the report                                                        | Stop recording                                           |
| `measureTickRate(s = 5)` | `Promise<{ ticksPerSecond, expected, animationFramesPerSecond }>` | Count real ticks over `s` seconds (browser, tab visible) |
| `latency()`              | `{ last, avg, max, ... }` or null                                 | Input latency over the last 30 inputs (browser)          |

## Examples

Set up Elroy, die, and check that he is suspended until Clyde leaves:

```js run
const a = pacmanAgent;
a.pause();
a.scenario({ level: 3, phase: "PLAYING", dotsRemaining: 15 });
a.step(1); // the stage is worked out each frame
a.view().ghosts.BLINKY.elroyStage; // 2: 15 dots left is under level 3's Elroy 2 threshold (20)

const b = a.view().ghosts.BLINKY;
a.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } }); // facing Blinky
a.runUntil((v) => v.phase === "DEATH_FREEZE", 60);
a.runUntil((v) => v.phase === "PLAYING", 600); // after the death and READY
a.view().ghosts.BLINKY.elroyStage; // 0: suspended
a.engine.pacman.invincible = true; // so he doesn't die again while we wait
a.runUntil((v) => v.ghosts.CLYDE.location !== "HOUSE", 3000); // ~720 frames: the idle timer, 3 times
a.step(1);
a.view().ghosts.BLINKY.elroyStage; // 2 again
a.diagnostics().failing; // []
a.resume();
```

Save and restore a moment:

```js run
const a = pacmanAgent;
a.scenario({ level: 1, phase: "PLAYING" });
const saved = a.save();
const before = a.hash();
a.step(120);
a.load(saved);
a.hash() === before; // true
```

## Integrating other tools

The game is meant to be driven and observed from outside:

- **The agent driver** is the main interface: in a page, `window.pacmanAgent` (dev builds); in
  Node or tests, construct it on an engine.
- **The engine** itself is plain TypeScript with no browser dependencies: `new GameEngine(mode)`,
  `setInputDirection(dir)`, `update()`, `getState()` / `setState()`, `drainEvents()`. A bot or a
  learning agent can run it headless far faster than real time.
- **Runner hooks** ([GameRunner.ts](../../src/game/GameRunner.ts)), in the browser: `onPreUpdate`
  (before each tick; the cabinet polls gamepads here), `onBeforeTick` / `onAfterTick` (around
  `update()`), `onEvents(events)` (the sim events of each tick; the agent driver records them
  here). Each is a single function: setting one replaces what was there, so wrap the old one if
  you need both.
- **Sim events** are a stable, typed list ([simEvents.ts](../../src/game/simEvents.ts)) to react
  to: sounds, scores, deaths, level clears.
- **Replays** are the exchange format: a JSON file with a start state, inputs and hashes. A tool
  can record one, send it, and anyone can play it back and check it on their build. See
  [Replays, rewind and versions](./05-replays-and-versions.md).
- **Share links** carry a replay in the URL: `#replay=...` opens the viewer.
- **Deep links into this manual**: `#docs/<chapter>/<section>`.

For step-by-step console recipes (speeds, timings, clips, finding a bug's first frame), see
[Measuring from the browser console](./09-console-recipes.md).
