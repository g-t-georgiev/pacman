# Debugging and tools

Everything here is in the game itself. The **Lab** panel (LAB in the button bar, or L / P) has
three tabs: **Learn**, **Practice** and **Debug**. Dev builds (`vp dev`) add F1, frame stepping,
the live invariant checks and the agent driver.

## Learn: the ghost AI explained

The Learn tab draws each ghost's thinking on the maze: its target tile, the line to it, and the
rule behind it (Blinky's direct chase, Pinky's ambush ahead, Inky's pincer vector through
Blinky, Clyde's 8-tile switch). You can show or hide each ghost, and see the current scatter/
chase wave and the dots left. The drawings stay on the maze when you close the panel.

## Practice

- **Rewind**: ⏪ 2 / 5 / 10 seconds, a scrub bar over the last two minutes, and **Resume from
  here**. See [Replays, rewind and versions](./05-replays-and-versions.md).
- **Speed**: 0.1× to 2×. Slow motion shows every frame of a close call; the game stays exact.
- **Toggles**: Invincibility, Ghost paths (each ghost's planned turns several tiles ahead),
  Target radar (the target line, distance and a proximity warning), Tile grid (tiles and
  decision points).
- **Actions**: ⚡ Frighten ghosts, 🍒 Spawn fruit, 🏠 Reset ghosts (send them home).
- **Patterns**: record Pac-Man's route through a life as the level's pattern, then show it as a
  faint trail with a marker where you should be on this frame. Arcade patterns work because the
  game is deterministic; the trail shows when you've left yours.
- **First-death heatmap**: where you first died on each level, over all your attempts.
- **Clip: last 20 s**: watch, copy a link, or download.

Invincibility, Spawn fruit and the like change the game: a replay records invincibility, and
using an action starts a new recording.

## Debug

| Section                      | What it has                                              |
| :--------------------------- | :------------------------------------------------------- |
| **Debug overlay**            | Every overlay layer, on and off (also F1 in dev builds)  |
| **Pause and frame stepping** | Step 1 frame, step 1 s, step to the next mode change     |
| **Measurements**             | Record speeds; tick rate; input latency                  |
| **Diagnostics**              | The invariant rules and their failures; the live console |
| **Bug report**               | Download, or copy a link to, the last 20 seconds         |

### The debug overlay

Drawn over the maze, from the game's state ([debugOverlay.ts](../../src/game/debugOverlay.ts)):

| Layer           | Shows                                                                             |
| :-------------- | :-------------------------------------------------------------------------------- |
| `grid`          | The tile grid                                                                     |
| `occupiedTiles` | The tile each actor is in, and its exact position                                 |
| `targets`       | Each ghost's target tile and the line to it                                       |
| `decisions`     | Each ghost's next turn (`nextDir`) and the one it planned after it (`plannedDir`) |
| `zones`         | The no-up tiles and the tunnel slow zones                                         |
| `intersections` | Intersections worked out from the maze, against the maze's own list               |
| `cornerWindow`  | Pac-Man's turn window on his lane, and whether his buffered turn is open          |
| `readout`       | Each actor's speed %, where that speed comes from, and pixels moved this frame    |
| `timeline`      | The scatter/chase timeline (bottom rows) and the ghost house counters (top rows)  |

### Frame stepping

Pause (Space), then step: **`.`** runs one frame, **`>`** runs to the next mode change (a
scatter/chase switch, or frightened starting or ending). The Debug tab has the same as buttons,
plus "step 1 s". Stepping runs the real tick, sounds and all, then holds again.

### Measurements

- **Record speeds**: start it, close the Lab and play, come back. For each actor and speed source
  (Pac-Man normal, frightened or stalled after eating; ghost normal, tunnel, frightened, Elroy
  1 and 2, eyes, in the house) it shows the pixels moved per frame against
  the level table's value; a ratio of 1.00 means the speed is right.
- **Tick rate**: how many simulation frames ran per second while playing, against the target
  (60.61 or 60, times the practice speed). A low number means the browser couldn't keep up, or
  the tab was hidden.
- **Input latency**: from a key press to the first frame drawn after the frame that used it.
  Last, average and worst.

Code: [measurements.ts](../../src/game/measurements.ts), [latencyMeter.ts](../../src/game/latencyMeter.ts).

### Diagnostics and the live console

The runtime invariants ([rules.ts](../../src/diagnostics/rules.ts)) are checked during play in
dev builds, or whenever the console is on: actors sharing a tile without a collision, Pac-Man
outside the maze, eyes off the door's line on the way down, an eating stall out of range. A
failure is logged with its frame and turns the console's badge red.

**Live console while playing** opens a floating window with the rules' pass and fail counts, the
log, and every actor's tile, direction, speed, mode and target, updated as you play.

## Hunting a bug

1. **Catch it.** When something odd happens, pause (Space) at once. The last two minutes are
   recorded.
2. **Find the frame.** Lab → Practice: rewind and scrub to just before it. Step frame by frame
   (`.`) with the overlay on (F1): targets, decisions and the readout usually show what went
   wrong.
3. **Keep it.** Debug → Bug report → **Download last 20 s** (or copy the link). That file plays
   the bug again on any build.
4. **Turn it into a test.** Load the file in a test, run it to the frame, and assert what should
   have happened:

   ```ts
   import replay from "./bug-replay.json";
   const agent = new AgentDriver(new GameEngine());
   agent.loadReplay(replay as Replay, 1234); // the frame before it goes wrong
   agent.step(1);
   expect(agent.view().ghosts.INKY.dir).toBe("LEFT");
   ```

   Then fix it, and add the test to `tests/regression/fixedBugs.test.ts`.

The agent driver does all of this from the browser console too: see
[Measuring from the browser console](./09-console-recipes.md).
