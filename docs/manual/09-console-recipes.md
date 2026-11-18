# Measuring from the browser console

In a dev build (`vp dev`), open the browser's developer tools and use `pacmanAgent` in the
console. It is the [agent driver](./08-agent-api.md) on the live game: the same calls work in
tests, where the game runs headless.

Recipes marked "runs headless" are also run by the test suite, so they stay correct.

## Before you start

- **Hold the game** with `pacmanAgent.pause()` when you want exact frames: then nothing moves
  except through `step()`, `runUntil()` and `trace()`. `resume()` lets it run again.
- **A held game doesn't tick.** If the player, a panel or the manual holds the game, real-time
  measurements (`measureTickRate`, live speed recording) see no frames. `view().pausedBy` says who
  holds it. Steps still work.
- **A hidden tab is throttled.** Browsers slow down timers and animation in background tabs.
  Keep the game's tab visible while measuring anything in real time.
- **Scenarios start fresh recordings**, and `level` in a scenario starts that level over.

## Pac-Man's speed on level 1

Is Pac-Man moving at 80% through the dots, and how much do the dots slow him down? (Runs
headless.)

```js run
const a = pacmanAgent;
a.pause();
a.scenario({ level: 1, phase: "PLAYING" }); // he starts moving left along a row of dots
a.recordSpeeds();
a.step(90);
const rows = a.stopSpeeds().rows.filter((r) => r.actor === "PACMAN");
console.table(rows.map((r) => ({ source: r.source, frames: r.frames, ratio: r.ratio })));
// pacman-normal: ratio 1.00 (exactly 80%: one pixel every frame)
// pacman-stall: the frames he stopped to eat (one per dot)
```

In live play, start `recordSpeeds()`, play normally, then read `speedReport()`. Each row is an
actor and a speed source; `ratio` 1.00 means exactly the table speed.

## Watch a speed pattern frame by frame

The speed masks decide how far an actor moves on each frame. Trace Blinky's x for 16 frames on
level 5 (95%: one pixel per frame, two on three frames of the sixteen). (Runs headless.)

```js run
const a = pacmanAgent;
a.scenario({ level: 5, phase: "PLAYING" });
const xs = a.trace(16, (v) => v.ghosts.BLINKY.x);
const moved = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
console.log(moved.join(" ")); // 1s and a few 2s
```

## The length of a death

Count the frames from the collision to the next READY. (Runs headless.)

```js run
const a = pacmanAgent;
a.pause();
a.scenario({ level: 1, phase: "PLAYING" });
const b = a.view().ghosts.BLINKY;
a.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } }); // facing Blinky
a.runUntil((v) => v.phase === "DEATH_FREEZE", 30);
const death = a.runUntil((v) => v.phase === "READY", 600);
console.log(death.frames); // 210: freeze 60 + animation 90 + wait 60
```

## A ghost leaving the house

How long until Pinky is out in the maze, and when do Inky and Clyde follow on level 1? (Runs
headless.)

```js run
const a = pacmanAgent;
a.pause();
a.scenario({ level: 1, phase: "PLAYING" });
const pinky = a.runUntil((v) => v.ghosts.PINKY.location === "ACTIVE", 600);
console.log("Pinky out after", pinky.frames, "frames");
const inky = a.runUntil((v) => v.ghosts.INKY.location !== "HOUSE", 3000);
console.log("Inky released after", inky.frames, "more frames; house:", inky.view.house);
```

`view().house` shows the dot counters, the global counter and the idle timer at any moment.

## Real tick rate and input latency

In the browser, with the game running and the tab visible:

```js
await pacmanAgent.measureTickRate(5);
// { ticksPerSecond: 60.6, expected: 60.606, animationFramesPerSecond: 60 (or your display's rate) }

// Play a little with the arrow keys, then:
pacmanAgent.latency(); // { last, avg, max, samples } in milliseconds
```

## Record a clip and share it

```js
pacmanAgent.downloadReplay(10); // the last 10 seconds as a .json file
await pacmanAgent.replayLink(10); // a link that opens them in the viewer
```

## Check a replay, and find where it goes wrong

`verifyReplay` plays a replay on a separate engine and compares every hash; on another build it
tells you the first second that differs. (Runs headless.)

```js run
const a = pacmanAgent;
a.scenario({ level: 2, phase: "PLAYING" });
a.input("UP");
a.step(300);
const clip = a.saveReplay();
const result = a.verifyReplay(clip);
console.log(result.matched, result.divergedAt); // true null on the same build
```

To find **the first frame where something is true** (a score passed, a ghost eaten, a death), if
it stays true once it happens, halve the range with `loadReplay(clip, tick)`, which plays the
clip up to `tick` and holds there. (Runs headless.)

```js run
const a = pacmanAgent;
a.scenario({ level: 1, phase: "PLAYING" });
a.step(400);
const clip = a.saveReplay();
const happened = (v) => v.score >= 50;
let lo = clip.start.tick,
  hi = clip.endTick;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  if (happened(a.loadReplay(clip, mid).view)) hi = mid;
  else lo = mid + 1;
}
console.log("first frame with 50 points:", lo);
a.loadReplay(clip, lo - 1); // the frame before: now step through it with the overlay on
a.debug({ targets: true, decisions: true });
```

## Set up any moment

Scenarios put the game in a state to study. (Runs headless.)

```js run
const a = pacmanAgent;
a.pause();
a.scenario({
  level: 5,
  phase: "PLAYING",
  waveIndex: 1, // the first chase wave
  pacman: { col: 6, row: 26, dir: "UP" },
  ghosts: { PINKY: { col: 21, row: 14 }, INKY: { col: 6, row: 14 } },
});
a.debug({ targets: true });
a.step(1);
a.view().ghosts.PINKY.target; // 4 up and 4 left of Pac-Man: the overflow quirk (Arcade rules)
```

## Events and diagnostics

```js
pacmanAgent.events(); // what happened since the last call: dots, ghosts eaten, deaths...
pacmanAgent.diagnostics(); // failed invariant rules and the latest log entries
```
