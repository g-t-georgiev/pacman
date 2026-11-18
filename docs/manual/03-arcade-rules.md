# The arcade rules

This chapter is our own "Pac-Man Dossier": how the arcade game works, rule by rule, as this game
plays it. Each rule names its **source**, or says it is an **estimate**, and points to the code
that implements it.

The main source is _The Pac-Man Dossier_ by Jamey Pittman ("Dossier" below; "Table A.1" is its
per-level table). The frightened ghosts' random numbers follow _Retro Game Mechanics Explained_.
No code or data from the original ROMs is used.

## Units: tiles, pixels and frames

- **The maze** is 28 × 36 tiles of 8 × 8 pixels (the screen is 224 × 288). The playfield is rows
  3 to 33; the rows above and below hold the scores, lives and fruit.
- **Positions** are whole arcade pixels. The canvas draws each one as 2 × 2 screen pixels.
- **One simulation step is one arcade frame.** The real machine runs at 60.606 frames per second
  (Dossier, Appendix C); so does this game with the Arcade preset (60 even with Modern).
- **Timers count frames.** The Dossier's seconds are treated as 60 frames each, so "1/60 s" is
  one frame. (That the arcade's timers are frame counters is our reading of the Dossier: see
  [Estimates](#estimates-and-open-questions).)
- **Which tile an actor is in** depends only on its center point (Dossier, "What Tile Am I In?").
  Sprites are 16 × 16 pixels, two tiles across, so they overlap the walls beside a corridor; that
  is only drawing.

Code: `TILE_SIZE`, `ARCADE_REFRESH_HZ` and `SIM_FPS` in
[constants.ts](../../src/game/constants.ts).

## Speed

All speeds are percentages of the top speed, **100% = 1.25 pixels per frame** (75.76 px/s at
60.606 Hz; Dossier, Table A.1).

An actor can only move whole pixels, so each speed is a **16-frame step pattern**: a 16-bit mask
of which frames move one pixel, and a second mask for frames that move two. 5% is exactly one
pixel per 16 frames, so 80% is one pixel on every frame, 100% adds a second pixel on four frames
of the sixteen, and 40% moves on every other frame. Every pixel of a two-pixel frame runs the
full movement logic (tile entry, decisions, tunnels, collisions), so nothing can skip a tile.

The masks are indexed by the frame count of the current life (`lifeFrame`), which restarts at
every life and level.

> The **totals** (pixels per 16 frames) follow from the Dossier's scale. The **bit layouts**
> (which frames move) are placeholders, evenly spread, until a verified source gives the real
> ones. Code: [speedMasks.ts](../../src/game/speedMasks.ts).

### Speeds per level (Dossier, Table A.1)

| Levels | Pac-Man | Pac-Man frightened | Ghost | Ghost in tunnel | Ghost frightened | Elroy 1 | Elroy 2 |
| :----- | ------: | -----------------: | ----: | --------------: | ---------------: | ------: | ------: |
| 1      |     80% |                90% |   75% |             40% |              50% |     80% |     85% |
| 2-4    |     90% |                95% |   85% |             45% |              55% |     90% |     95% |
| 5-20   |    100% |               100% |   95% |             50% |              60% |    100% |    105% |
| 21+    |     90% |               100% |   95% |             50% |              60% |    100% |    105% |

- **Eating slows Pac-Man down**: he stops for 1 frame after each dot and 3 frames after an
  energizer (Dossier). That is why a corridor full of dots takes longer than an empty one.
- **Tunnels.** Ghosts slow to the tunnel speed in a tunnel row within 6 tiles of either edge;
  Pac-Man doesn't.
- **Eyes** (an eaten ghost going home) move 2 pixels every frame. _Estimate._
- **Inside the ghost house** ghosts move at 50%. _Estimate._
- **Turbo** (an option, not an arcade rule) multiplies everyone's steps by 1.6.

## Cornering

Pac-Man can **cut corners**; ghosts can't (Dossier, "Cornering").

When you ask for a turn, Pac-Man may start it while he is still up to 3 pixels before the turn's
center, or up to 4 pixels past it (for an approach from the right or from below: 4 before, 3
past). While he cuts the corner he moves diagonally: one step along his old direction and one
along the new, so a turn taken early gains ground on a ghost that has to reach the center first.

A direction you press is **buffered**: Pac-Man takes it at the next point where it is possible.
With the **joystick feel** option, letting go of the key forgets a buffered turn he hasn't
reached yet.

Code: `CORNER_WINDOW_LOW` / `CORNER_WINDOW_HIGH` in [constants.ts](../../src/game/constants.ts),
[MovementController.ts](../../src/controllers/MovementController.ts).

## How a ghost chooses its way

Ghosts don't search for paths. They look **one tile ahead** (Dossier, "Looking Ahead"):

1. When a ghost **enters a tile**, it decides which way it will turn at the **next** tile.
2. Of the exits there, except going back, it picks the one whose tile is **closest to its
   target**, measured in a straight line.
3. **Ties** go in the order **up, left, down, right**.
4. It makes that turn when it reaches the next tile's center.

So a ghost never turns around by itself; only a **reversal** (below) does that.

- **No-up tiles.** In four tiles a ghost may not choose to turn up: the two tiles left and right
  of the ghost house door above it (12,14 and 15,14) and the two above Pac-Man's start (12,26
  and 15,26). Frightened ghosts ignore this. Code: `specialNoUpTiles` in
  [mazes.ts](../../src/game/mazes.ts).
- **Tunnels.** Moving off one side brings an actor in on the other side, on the same row.

Code: [ghostAiUtils.ts](../../src/game/ghostAiUtils.ts),
[GhostAiController.ts](../../src/controllers/GhostAiController.ts).

## Targets: the four personalities

Every ghost has a **target tile**; how it picks that tile is its personality (Dossier, "Meet
the Ghosts").

| Ghost  | Chase target                                                                  | Scatter corner |
| :----- | :---------------------------------------------------------------------------- | :------------- |
| Blinky | Pac-Man's tile                                                                | top right      |
| Pinky  | 4 tiles ahead of Pac-Man                                                      | top left       |
| Inky   | Take the tile 2 ahead of Pac-Man; draw a line from Blinky to it and double it | bottom right   |
| Clyde  | Pac-Man's tile while 8 or more tiles away; closer than that, his corner       | bottom left    |

The scatter corners are tiles outside the maze (25,0), (2,0), (27,35) and (0,35), so a
scattering ghost circles the block near its corner.

### The overflow quirk

When Pac-Man faces **up**, the arcade's code also shifts the "ahead" point by the same number of
tiles to the **left**: Pinky aims 4 up and 4 left, and Inky's pivot is 2 up and 2 left (Dossier;
caused by an overflow in the original code). The **Arcade** preset keeps this; **Modern**
doesn't. Code: `emulateRomQuirks` in [settings.ts](../../src/game/settings.ts).

## Scatter and chase

Ghosts alternate between **scatter** (go to their corners) and **chase** (use their targets) on
a fixed schedule per level (Dossier, "Scatter, Chase, Repeat"):

| Wave      | Level 1 | Levels 2-4 | Levels 5+ |
| :-------- | ------: | ---------: | --------: |
| Scatter 1 |     7 s |        7 s |       5 s |
| Chase 1   |    20 s |       20 s |      20 s |
| Scatter 2 |     7 s |        7 s |       5 s |
| Chase 2   |    20 s |       20 s |      20 s |
| Scatter 3 |     5 s |        5 s |       5 s |
| Chase 3   |    20 s |     1033 s |    1037 s |
| Scatter 4 |     5 s |    1 frame |   1 frame |
| Chase 4   | forever |    forever |   forever |

- The schedule restarts at every life and level.
- The schedule's clock **pauses during frightened time**.
- **Reversals.** Every switch between scatter and chase, and the start of frightened mode, makes
  every ghost outside the house reverse. A ghost obeys it when it enters its next tile. Leaving
  frightened mode does **not** reverse them. A ghost inside the house when a reversal comes keeps
  it and turns around once it is out.

Code: the schedules in [constants.ts](../../src/game/constants.ts),
[TimerController.ts](../../src/controllers/TimerController.ts).

## Frightened mode

An energizer turns the ghosts blue (Dossier, "Frightened Mode"):

- Every ghost that isn't already eyes becomes frightened (inside the house too) and reverses.
- Frightened ghosts have **no target**. At each tile they pick a direction from a random-number
  generator; if that way is blocked, they try the next one clockwise (up, right, down, left).
- They move at the frightened speed, and Pac-Man at his frightened speed.
- The time (Table A.1) runs from 6 s on level 1 down to 1 s, and is 0 on level 17 and from 19
  on: there an energizer only reverses the ghosts. Near the end the ghosts flash white a number
  of times (5 or 3 by level).
- **Points** for eating ghosts double within one energizer: 200, 400, 800, 1,600. The next
  energizer starts again at 200. The game pauses for 1 second with the points shown where the
  ghost was; other eyes keep moving during that pause.

### The random numbers

The arcade picks frightened turns from a 13-bit counter that steps as `index × 5 + 1` (all 8,192
values before it repeats) and reads a byte of its own program at that address. That counter is
reset at every level start and after every death, so the same play gives the same frightened
turns. This game reproduces the counter exactly; since it has no ROM to read, it uses a table of
direction codes with the arcade's measured share of each direction (up 16.3%, left 29.9%, right
and down the rest), so frightened ghosts have the arcade's tendencies, not its exact sequences.

Code: [PRNG.ts](../../src/core/PRNG.ts).

## Cruise Elroy

Blinky speeds up as the maze empties (Dossier, "Cruise Elroy"):

- **Elroy 1** when the dots left reach a level's number (20 on level 1, then 30, 40, 50, 60, 80,
  100 and 120 by level 19), **Elroy 2** at half that.
- In both stages he **keeps chasing Pac-Man during scatter waves** (he still reverses).
- After Pac-Man dies, Elroy is **suspended** until Clyde starts to leave the house.

Code: `getElroyStage` in [GhostAiController.ts](../../src/controllers/GhostAiController.ts).

## The ghost house

Blinky starts outside; Pinky, Inky and Clyde wait inside and leave by these rules (Dossier,
"Home Sweet Home"):

1. **Personal dot counters.** Only the first ghost waiting in the order **Pinky, Inky, Clyde**
   counts the dots Pac-Man eats. When its count reaches its limit it leaves, and the next one's
   count takes over. Limits: level 1 Pinky 0, Inky 30, Clyde 60; level 2 0, 0, 50; from level 3
   all 0. They reset only at a new level.
2. **The global dot counter.** After a death, the personal counters stop (they aren't reset) and
   one shared counter starts: Pinky leaves at 7 dots, Inky at 17. At 32, if Clyde is still
   inside, the shared counter switches off and the personal counters take over again.
3. **The no-dot timer.** If Pac-Man eats no dot for 4 seconds (3 from level 5), the first ghost
   waiting is sent out. The timer restarts with every dot, and after a death.

- A ghost whose limit is met leaves at once, even while another one is still on its way out. With
  limits of 0, several ghosts are released on consecutive frames and walk out overlapping (see
  the open question below).
- **Moving in the house.** Waiting ghosts bob up and down. To leave, a ghost lines up with the
  door's center, then goes up and out, to the left. Eyes come back to the door, go down to the
  middle of the house, and move to their slot (Inky left, Clyde right, the others in the middle);
  then the ghost leaves again as soon as the house rules let it (normally at once).

Code: [HouseController.ts](../../src/controllers/HouseController.ts),
[MovementController.ts](../../src/controllers/MovementController.ts).

## Collisions

Pac-Man and a ghost collide when they are **in the same tile** (by their center points),
checked once per frame after everyone has moved.

That gives the arcade's famous **pass-through**: when Pac-Man and a ghost move towards each
other, they can swap tiles between two checks and pass through each other unharmed. It happens
here as in the arcade.

## A round, start to finish

| Phase                   | Length    | What happens                                                                                  |
| :---------------------- | :-------- | :-------------------------------------------------------------------------------------------- |
| READY                   | 4 s / 2 s | Everyone in place. 4 s with the start tune on a new game; 2 s after a death or a level clear. |
| Play                    | —         |                                                                                               |
| Ghost eaten             | 1 s       | Everything stops but other eyes; the points are shown.                                        |
| Death: freeze           | 1 s       | Pac-Man and the ghosts stop where they are.                                                   |
| Death: animation        | 1.5 s     | The ghosts are gone; Pac-Man folds up.                                                        |
| Death: wait             | 1 s       | Then READY, or GAME OVER with no lives left.                                                  |
| Level clear: freeze     | 1 s       |                                                                                               |
| Level clear: maze flash | 4 flashes | Then READY on the next level.                                                                 |

The ghost-eaten pause and the death freeze come from the Dossier; the other lengths are
estimates. Code: [RoundSequencer.ts](../../src/game/RoundSequencer.ts).

**Pac-Man's mouth.** He starts each life as a full circle and only opens his mouth once he
moves. While moving, his mouth follows his position: one chomp per 8 pixels. When a wall stops
him he freezes half open.

## Scoring, lives and fruit

| Item                  | Points               |
| :-------------------- | :------------------- |
| Dot                   | 10                   |
| Energizer             | 50                   |
| Ghosts, per energizer | 200, 400, 800, 1,600 |
| Fruit                 | by level, below      |

- **Lives.** 3 per game; one extra at 10,000 points.
- **Fruit** appears below the ghost house after the 70th and the 170th dot of a level, and stays
  9 to 10 seconds (the exact time comes from the game's random stream; Dossier, "The Basics").
  A fruit still showing when Pac-Man dies is gone.

| Level | Fruit      | Points | Level | Fruit    | Points |
| ----: | :--------- | -----: | ----: | :------- | -----: |
|     1 | Cherry     |    100 |   7-8 | Melon    |  1,000 |
|     2 | Strawberry |    300 |  9-10 | Galaxian |  2,000 |
|   3-4 | Peach      |    500 | 11-12 | Bell     |  3,000 |
|   5-6 | Apple      |    700 |   13+ | Key      |  5,000 |

## The level table

Everything that changes per level is one table, a copy of the Dossier's Table A.1:
[levelTable.ts](../../src/game/levelTable.ts). Level 21 applies to every level after it.

| Level | Elroy 1 dots | Frightened | Flashes | Level | Elroy 1 dots | Frightened | Flashes |
| ----: | -----------: | ---------: | ------: | ----: | -----------: | ---------: | ------: |
|     1 |           20 |        6 s |       5 |    11 |           60 |        2 s |       5 |
|     2 |           30 |        5 s |       5 |    12 |           80 |        1 s |       3 |
|     3 |           40 |        4 s |       5 |    13 |           80 |        1 s |       3 |
|     4 |           40 |        3 s |       5 |    14 |           80 |        3 s |       5 |
|     5 |           40 |        2 s |       5 |    15 |          100 |        1 s |       3 |
|     6 |           50 |        5 s |       5 |    16 |          100 |        1 s |       3 |
|     7 |           50 |        2 s |       5 |    17 |          100 |          0 |       0 |
|     8 |           50 |        2 s |       5 |    18 |          100 |        1 s |       3 |
|     9 |           60 |        1 s |       3 |    19 |          120 |          0 |       0 |
|    10 |           60 |        5 s |       5 |   20+ |          120 |          0 |       0 |

The tests check this table row by row against Table A.1 (`tests/unit/levelTable.test.ts`), and
the fidelity suite has one test per Dossier claim (`tests/fidelity/dossier.test.ts`).

## Ms. Pac-Man

Ms. Pac-Man uses the same rules engine with her own look and **one maze of her own** (two tunnels,
rows 10 and 20), whose colors change from level to level; her fruit bounces. The original Ms.
Pac-Man has four mazes and differences in the ghosts' behavior; this build doesn't reproduce
those. Code: [rulesets.ts](../../src/game/rulesets.ts), [mazes.ts](../../src/game/mazes.ts).

## Estimates and open questions

These values have no published source. Each is marked "estimate" in the code and is on the
**footage checklist** in `docs/REFACTOR_PLAN.md`, to check against the original game:

- **Round phases:** READY lengths (4 s at a game's start, 2 s otherwise), the death animation
  (1.5 s) and wait (1 s), the level-clear freeze (1 s) and maze flashes (4, 12 frames each).
- **When the start tune plays:** on a new game and on Restart Level only, now. Whether the
  original also plays it at each level start is open.
- **The energizer's look:** a pulse in size now; the original's blink or color cycle is to be
  checked.
- **Speeds:** the eyes (2 px per frame), inside the house (50%), and the speed masks' bit
  layouts (their totals are sourced).
- **Timing details:** the frightened flash rhythm (14 frames per half-cycle), the 1UP blink (16
  frames), the house bobbing (half a tile).
- **The siren:** where it steps up (now at 20/40/60/80% of the dots eaten) and its pitches.
- **Pac-Man's mouth:** the frame he stops on against a wall, and 8 pixels per chomp.
- **House release overlap:** from level 2, Inky (and from level 3, Clyde) can be released a
  frame or two after Pinky and walk out overlapping her. That follows the Dossier's rules; it
  felt early in play, and is to be checked on the original.
- **Timer units:** whether the arcade's "seconds" are 60 frames (our reading) at 60.606 Hz.
