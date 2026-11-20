# Playing

## The screen

Like the arcade, the scores live inside the maze's blank rows: `1UP` (blinking through a game)
and `HIGH SCORE` above the maze, your spare lives and the fruit of the recent levels below it.

Above the screen is the button bar:

| Button  | What it does                                                                        |
| :------ | :---------------------------------------------------------------------------------- |
| RESTART | Opens the Restart panel: restart this level (score kept), a new game, or a new mode |
| TURBO   | Turbo speed (T)                                                                     |
| LAB     | The Lab panel: Learn, Practice and Debug tabs (L, P)                                |
| CRT     | A scanline and glow filter over the screen                                          |
| ⏸ / ▶   | Pause and resume (Space); the tooltip says what holds the game                      |
| 🔊 / 🔇 | Sound on and off                                                                    |

The top bar has **📖 Manual** (this page), **🎮 Game Modes** (mode and rules), **⚙️ Options**
(keys and display) and **🏆 Scores** (the high score table, kept in this browser).

Every panel holds the game while it is open, and so does this manual: close it and the game
goes on from the exact frame it stopped on. A death, a new READY, a level clear or a game over
closes any open panel, so a panel never hides the board when something happens.

## Keyboard

| Action                               | Keys                                |
| :----------------------------------- | :---------------------------------- |
| Move                                 | Arrow keys or W A S D (remappable)  |
| Pause / resume (closes open panels)  | Space                               |
| Close a panel; with none open, pause | Escape                              |
| Turbo on/off                         | T                                   |
| Lab, Learn tab / Practice tab        | L / P                               |
| Rewind 2 seconds (Lab open)          | R                                   |
| After a game over: back before death | R (on the Restart panel)            |
| Debug overlay (dev builds)           | F1                                  |
| Step one frame / to the next mode    | `.` / `>` while paused (dev builds) |

Movement keys come first: if you bind a letter such as T to a direction, it steers and no longer
toggles turbo. Space, Escape, F1, `.`, `>`, Tab and Enter are reserved and can't be bound.

A direction is **buffered**: press it a little before a turn and Pac-Man takes the turn when he
gets there. You don't need to hold the key.

## Remapping the keys

**⚙️ Options → Movement keys.** Each direction has two keys. Click one and press the new key
(Escape cancels). A key that was bound elsewhere moves here, so one key never means two
directions. **Reset** restores the arrows and W A S D. The mapping is saved in this browser.

## Touch, D-pad and gamepads

- **Swipes.** Swipe on the screen in a direction (at least 18 px) to steer.
- **On-screen D-pad.** Shown on touch devices; **Show D-Pad** below the screen toggles it
  anywhere.
- **Gamepads.** Any standard gamepad: the D-pad (buttons 12-15) or the left stick (past 40%
  of its travel). Letting go counts as releasing the direction (see joystick feel below).

## Game modes and rules presets

**🎮 Game Modes** picks the game and its rules:

- **Pac-Man** or **Ms. Pac-Man.**
- **Rules: Arcade** (default) or **Modern.**
  - **Arcade** keeps the original's targeting overflow (when Pac-Man faces up, Pinky and Inky
    aim further left as well, a bug in the 1980 code) and runs at the arcade's 60.606 Hz.
  - **Modern** aims where the rules say, without the overflow, and runs at an even 60 Hz to
    match most displays.
- **Joystick feel.** With it on, letting go of a direction cancels a turn you queued and haven't
  reached yet, like centering an arcade stick. Pac-Man keeps going straight. This is how the
  original plays: it has no turn buffer, so you hold the stick in the new direction until the
  turn (seen when playing it). Off (default), a queued turn stays queued, the way keyboard
  players expect.

The preset and joystick feel are saved in this browser.

## Speed: turbo and practice speed

- **Turbo** (T) moves every actor 1.6 times as far per frame. The rules don't change, only
  everyone's speed. Replays record it.
- **Practice speed** (Lab → Practice) slows the whole game down or speeds it up, from 0.1× to
  2× (quick buttons 0.25×, 0.5×, 1×, 2×). It changes how many frames run per second, never what
  a frame does, so the game plays exactly the same, only slower or faster.

## Display options

**⚙️ Options → Display:**

- **Reduce flashing.** No strobing: the maze stays a steady pale color on a level clear,
  energizers stop blinking, and frightened ghosts get a steady white outline instead of blinking
  when their time runs out.
- **Colorblind-safe colors.** Ghost colors that stay apart with red-green or blue-yellow color
  blindness, and a darker frightened blue.

Both are saved in this browser. **CRT** (button bar) adds scanlines and glow; it isn't saved.

## Sound

The sounds are made live with the Web Audio API, modeled on the arcade's: the start tune, the
chomp, the siren (five stages that rise as you clear the maze, plus the frightened and eyes
sounds), eating a ghost or fruit, the extra life and death. 🔊 turns them off. Browsers start
audio only after you have pressed a key or clicked, so the first sound may wait for that.

## Lives, scores and fruit

- You start with 3 lives (the one in play and 2 spares) and get one extra life at 10,000 points.
- Dot 10, energizer 50, ghosts 200 / 400 / 800 / 1,600 per energizer, fruit 100 to 5,000 by level.
- A fruit appears below the ghost house after 70 and after 170 dots, for 9 to 10 seconds.
- The high score table keeps the top 10 per browser; a score good enough is offered to it after a
  game over.

## When the game is over

The board stays in view, then the Restart panel opens: **Restart Level** (same level, score
kept, everything else as on a fresh start), **Start New Game**, or **Change Game Mode**. Press
**R** first to go back to about 2 seconds before the fatal collision and play it again from
there; the game holds until you press Space.

## Supported devices and browsers

- **Desktop browsers.** Developed and tested in Chromium-based browsers (Chrome, Edge); the
  automated browser tests run in Chromium. Firefox and Safari should work (only standard web
  APIs are used) but are not tested by us.
- **Phones and tablets.** Swipes and the on-screen D-pad; the layout fits narrow screens. Tested
  in mobile emulation, not on a range of real devices.
- **Displays.** The game's clock is separate from the display's: it runs 60.606 (or 60) steps
  per second on a 60, 120 or 144 Hz screen alike, and draws the latest state on every display
  frame.
- **A hidden or background tab** is slowed down by the browser; the game simply runs slower
  there. Pause before switching away.
- **Storage.** Preferences and scores use the browser's local storage. In a private window, or
  with storage blocked, the game still runs and forgets them when closed.
