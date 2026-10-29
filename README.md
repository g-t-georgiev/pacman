# 🟡 Pac-Man Arcade Lab (HTML5 + TypeScript + React)

A faithful, modern arcade-accurate Pac-Man engine and AI intelligence lab built using TypeScript, HTML5 Canvas API, and React. Navigate the authentic mazes, study original ghost behavior algorithms, experiment with developer sandbox tools, and switch between historical arcade editions!

---

## 🎮 Gameplay Features

- **Pixel-Accurate 28×36 Arcade Grid**: Double-bezel corridor borders, authentic tile centering, wrap-around warp tunnels, and speed-ratio regulation.
- **4 Playable Game Editions**:
  - 🟡 **Classic Pac-Man (1980)**: The legendary arcade original with Blinky, Pinky, Inky, and Clyde.
  - 🎀 **Ms. Pac-Man (1982)**: Distinctive salmon/cyan maze, dual wrap-around tunnels (rows 10 & 20), lipstick, pink bow, Sue replacing Clyde, and bouncing fruit mechanics.
  - 👟 **Crazy Otto (1981)**: The historical GCC prototype precursor to Ms. Pac-Man featuring animated running legs, red shoes, antenna cap, and open emerald corridors.
  - 🍪 **Cookie Man**: Procedural symmetric solvable maze generator with chocolate chip pellets, giant frosted cookie energizers, baker chef hat, and bakery treats.
- **⚡ Turbo Speed Chip (1.6x)**: Arcade speed mod toggle boosting player and ghost velocity for fast-paced gameplay.
- **🧠 Interactive AI Intelligence Lab (Learn Mode)**:
  - Live ghost status badges above each ghost showing Name, Mode (`CHASE`, `SCATTER`, `FRIGHT`, `EYES`, `CHASE/FLEE`), and Target Tile Coordinates `[col, row]`.
  - Visual target reticles and vector rays projected directly onto the maze canvas.
  - Inky's double-vector pivot visualization off Blinky's position.
  - Clyde's 8-tile proximity radar circle.
  - Per-ghost visual cue filter toggles (all, individual ghost toggle buttons with ghost portraits, or none) that persist during live gameplay even when the Learn panel is closed.
- **🧪 Practice Mode & Developer Sandbox**:
  - **Multi-Step Ghost Path Lookahead**: Real-time corridor trajectories predicting ghost paths 6–8 tiles forward using genuine AI turn decisions.
  - **Tactical Target Lines & Proximity Radar**: Vector distance lines displaying real-time tile distance meters and danger warnings.
  - **Tile Grid & Decision Intersections**: Highlighting complex decision points (>= 3 walkable exits).
  - **Time Travel Rewind Buffer**: Scrub through recent seconds of gameplay or trigger quick 2-second rewinds to practice tricky evasions.
  - **Sandbox Tools**: Invincibility toggle, ghost pen reset, ghost freeze, and variable game speed (0.25x to 2.0x).
- **🔄 Modular Restart & Modal Transition System**:
  - Configurable Game Over comprehension delay timer (set via `ui.config.ts`) before displaying the Restart modal.
  - Centralized CSS + TypeScript transition controller (`PanelTransitionWrapper`) with customizable open/close animations per panel ID.
  - Viewport-centered normalized dialog placement.
- **🔊 Procedural Web Audio Synthesizer**:
  - Authentic multi-pitch background sirens that scale in tempo as dots are consumed.
  - Dual-frequency waka-waka sound synthesis, energizer hum, ghost siren, and jingles with zero external sound file latency.
- **📱 Responsive & Multi-Input**: Keyboard, touch swipe gestures, on-screen virtual D-pad, and gamepad controller support.
- **🏆 Persistent High Scores & CRT Arcade Filter**: LocalStorage leaderboard and optional CRT scanline phosphor shader.

---

## 🛠️ Technologies Used

- **TypeScript** – Strict type safety, engine state models, and AI vector arithmetic
- **HTML5 Canvas 2D API** – High-performance 60 FPS rendering with sub-pixel interpolation
- **React 19** – Modular arcade HUD, modal overlays, and reactive practice controls
- **Web Audio API** – Pure algorithmic synthesizer producing authentic arcade sound effects
- **Tailwind CSS** – Sleek arcade cabinet styling and retro HUD controls

---

## 📁 Project Structure

```
root/
├── public/                         # Static icons and assets
├── src/
│   ├── audio/
│   │   └── soundEngine.ts          # Procedural Web Audio synthesizer (waka, sirens, eat, death)
│   ├── components/
│   │   ├── ArcadeCabinet.tsx       # Main cabinet container, game loop, input listeners
│   │   ├── HighScoresModal.tsx     # LocalStorage arcade high scores leaderboard
│   │   ├── HUD.tsx                 # Top arcade status bar (1UP, HIGH SCORE, mode toggles)
│   │   ├── LearnModeOverlay.tsx    # AI intelligence lab modal with ghost selector checkboxes
│   │   ├── ModeSelector.tsx        # Game edition selector (Pac-Man, Ms. Pac, Crazy Otto, Cookie Man)
│   │   ├── PanelTransitionWrapper.tsx # Modular transition engine for all modals
│   │   ├── PracticePanel.tsx       # Developer sandbox panel (rewind scrubber, lookahead paths, radar)
│   │   ├── RestartPanel.tsx        # Viewport-centered Restart Round / New Game modal
│   │   └── VirtualDpad.tsx         # Mobile touch D-pad control
│   ├── config/
│   │   └── ui.config.ts            # Centralized UI timings, delay configs, and transition definitions
│   ├── game/
│   │   ├── constants.ts            # Speeds, tile dimensions (16px), scatter schedules, fruit tables
│   │   ├── gameEngine.ts           # Authoritative game loop, collision detection, ghost housing, rewind buffer
│   │   ├── ghostAi.ts              # Authentic Pac-Man Dossier AI logic, targeting & intersection lookahead
│   │   ├── mazes.ts                # 28x36 maze definitions for Classic, Ms. Pac-Man, and Crazy Otto
│   │   ├── proceduralMaze.ts       # Algorithmic symmetric solvable maze generator for Cookie Man
│   │   └── renderer.ts             # Canvas 2D rendering pipeline (maze, actors, vectors, CRT filter)
│   ├── styles/
│   │   └── transitions.css         # CSS transition keyframes (fade, slide-up, zoom, pop)
│   ├── types/
│   │   └── index.ts                # TypeScript type interfaces for engine, actors, tiles, and configs
│   ├── utils/
│   │   └── index.ts                # Shared helper functions (fruit metadata resolution, etc.)
│   ├── App.tsx                     # Top-level application shell
│   ├── index.css                   # Global styling and Tailwind directives
│   └── main.tsx                    # React application entry point
├── index.html                      # HTML5 canvas container and viewport meta
├── metadata.json                   # Applet configuration and permissions
├── package.json                    # Project dependencies and npm scripts
├── tsconfig.json                   # TypeScript compiler configuration
├── vite.config.ts                  # Vite development and bundle configuration
└── README.md                       # Documentation
```

---

## 🎮 Controls

| Action | Keyboard | Touch / Gamepad |
| :--- | :--- | :--- |
| **Move Pac-Man** | <kbd>Arrow Keys</kbd> or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Swipe Gestures / Virtual D-Pad / Controller D-Pad & Stick |
| **Restart Game** | <kbd>R</kbd> or Click Header 🔄 | Tap Restart in Menu |
| **Pause / Resume** | <kbd>P</kbd> or <kbd>Space</kbd> | Tap Pause in HUD |
| **Turbo Speed Mode** | <kbd>T</kbd> or HUD Toggle | HUD ⚡ Button |
| **Learn Mode AI Lab**| <kbd>L</kbd> or HUD Toggle | HUD 🧠 Button |
| **Practice Sandbox** | Click 🛠️ Practice in HUD | HUD 🛠️ Button |
| **Quick Rewind (2s)**| <kbd>[</kbd> or <kbd>]</kbd> | Practice Panel Slider |
| **Mute / Unmute Sound** | Click 🔊 in HUD | HUD Sound Button |

---

## 🧠 AI Overview (Ghost Personalities)

The ghost pathfinding faithfully replicates the logic documented in the *Pac-Man Dossier*. Ghosts evaluate their target with a 1-tile lookahead and choose the direction with the shortest Euclidean distance to their target tile (with the strict tie-breaker order: **UP > LEFT > DOWN > RIGHT**). Ghosts cannot reverse direction unless switching behavioral modes.

### 🔴 Blinky ("Shadow")
- **Target**: Pac-Man's exact current tile.
- **Behavior**: Relentless direct pursuer.
- **Cruise Elroy**: As dot count falls below 20 and 10 pellets, Blinky gains a permanent speed boost and continues chasing even during Scatter waves!

### 🌸 Pinky ("Speedy")
- **Target**: 4 tiles directly ahead of Pac-Man.
- **Arcade Quirk**: Recreates the classic 1980 overflow bug: when Pac-Man faces UP, Pinky targets 4 tiles UP and 4 tiles LEFT.
- **Role**: Ambushes Pac-Man by cutting off escape routes.

### 🔷 Inky ("Bashful")
- **Target**: Calculated by taking the tile 2 tiles ahead of Pac-Man, drawing a vector from Blinky to that tile, and doubling the vector length!
- **Role**: Flanker. Inky's target varies wildly based on where Blinky is located relative to Pac-Man.

### 🟠 Clyde / 🎀 Sue ("Pokey")
- **Target (Classic)**: If Clyde is **>= 8 tiles away** from Pac-Man, he targets Pac-Man directly (Chase). If Clyde gets **closer than 8 tiles**, he immediately retreats to his bottom-left scatter corner!
- **Enhanced Wandering**: At long distances, Clyde alternates between pursuit and exploration before tightening his perimeter.

### 👻 Eaten Eyes State
- When Pac-Man consumes an energized ghost, the eyes travel back to the doorstep tile `[col 13, row 14]` along open corridors (navigating around outer boundaries rather than penetrating walls).
- Once directly above the gate, the eyes descend into the ghost house pen `[col 13, row 17]` to revive and emerge back into the maze!

---

## 🎨 Design & Architecture

- **Sub-Pixel Centering**: Actors stay locked to tile axes while smoothly interpolating sub-pixel steps at 60 FPS, eliminating corner clipping.
- **Input Direction Buffering**: Supports instant 180° turn reversals and buffers orthogonal turns so players can turn into corridors cleanly before reaching tile centers.
- **Config-Driven UI Framework**:
  - `ui.config.ts` controls all delay intervals (such as the 1000ms delay between death and the Game Over Restart dialog) and registers open/close CSS animation styles.
  - Dialogs remain centered on the visible viewport regardless of window size or scroll position.
- **Modular Game Modes**: Independent maze maps, tunnel positions, fruit item sets, actor sprites, and color schemes configured cleanly through `getMazeData()`.
