# Implementation Plan: Modular UI Transition System, Restart Panel, and Persistent Ghost AI Cues

This plan outlines the architecture and execution steps for adding a centralized UI configuration module, flexible modal transition engine, restart game panel with configurable game-over delay, and persistent selective ghost AI visualizers.

---

## 1. Objectives & Requirements

1. **Centralized UI Configuration (`src/config/ui.config.ts`)**:
   - Define all UI timings (game over restart delay, ready banner durations, notification timeouts).
   - Define panel configurations by unique ID (`RESTART_PANEL`, `LEARN_PANEL`, `PRACTICE_PANEL`, `MODE_SELECTOR`, `HIGH_SCORES`).
   - Define configurable entrance/exit transition effects per panel (e.g. `fade-slide-up`, `scale-fade`, `fade-drop`, `slide-in-right`) with customizable duration, easing, and backdrop blur.
   - Standardize viewport positioning (`fixed inset-0 flex items-center justify-center`) to keep modals centered in the visible viewport regardless of scroll position.

2. **Transition Effects Stylesheet (`src/styles/transitions.css`)**:
   - Provide hardware-accelerated CSS keyframes and utility classes for panel transitions.
   - Import directly in `src/main.tsx` (avoiding `@import` in CSS files).

3. **Modular Panel Controller / Wrapper (`src/components/PanelTransitionWrapper.tsx`)**:
   - Wrap modals with dynamic transition classes based on panel ID looked up from `ui.config.ts`.
   - Handles animated entry, exit unmounting delays, and escape key / backdrop click dismissing.

4. **Dedicated Restart Game Panel (`src/components/RestartPanel.tsx`)**:
   - Appears automatically after player depletes lives and "GAME OVER" is displayed, delayed by `gameOverRestartDelayMs` (default 1200ms) defined in `ui.config.ts`.
   - Accessible on-demand anytime via a "🔄 Restart" button in the HUD controls bar.
   - Offers "Restart Round" (same mode/level), "Start Fresh Game", and "Change Game Mode", and shows final score breakdown.

5. **Persistent Learn Mode Visual Cues & Ghost Filtering**:
   - Move ghost visual cues state into persistent engine settings:
     - `activeGhostVisuals: Record<GhostType, boolean>` (Blinky, Pinky, Inky, Clyde).
     - `learnVisualsEnabled: boolean` (canvas visuals persist independently of whether the Learn modal is open).
   - In the Learn Panel:
     - Add visual ghost toggles styled with each ghost's iconic sprite icon and colored tags.
     - "All Ghosts" / "Clear All" toggle button.
     - Explanatory panel can be closed while the chosen ghost lines, reticles, path arrows, and 8-tile radius circles remain actively drawn on the playing field.

---

## 2. File Changes & Technical Architecture

| File | Status | Description |
|------|--------|-------------|
| `src/config/ui.config.ts` | **Completed** | Central configuration for UI timings (`gameOverRestartDelayMs: 1200`, `readyBannerFrames: 120`, etc.), modal transition types, positioning, and panel effect registry. |
| `src/styles/transitions.css` | **Completed** | Modular CSS animations (`fade-slide-up`, `scale-fade`, `fade-drop`, `subtle-fade`) using compositor-only transforms. |
| `src/main.tsx` | **Completed** | Imported `src/styles/transitions.css` directly into bundle. |
| `src/types/game.ts` | **Completed** | Added `activeGhostVisuals: Record<GhostType, boolean>` and `learnVisualsEnabled: boolean` to `GameSettings`. |
| `src/components/PanelTransitionWrapper.tsx` | **Completed** | Reusable transition controller component that applies configured animations for each panel by ID and normalizes viewport centering. |
| `src/components/RestartPanel.tsx` | **Completed** | Restart dialog with score summary, restart game button, new game button, and mode switch button. |
| `src/components/LearnModeOverlay.tsx` | **Completed** | Updated with persistent visual toggle, ghost avatar buttons with custom SVG drawings, and individual ghost mute/active checkboxes. |
| `src/game/renderer.ts` | **Completed** | Updated to respect `settings.activeGhostVisuals[ghostType]` and `settings.learnVisualsEnabled` so lines and reticles render even when Learn modal is closed. |
| `src/components/HUD.tsx` | **Completed** | Added "🔄 RESTART" button in controls header; updated Learn button to indicate when persistent visual cues are active. |
| `src/components/ArcadeCabinet.tsx` | **Completed** | Integrated `RestartPanel` with timer trigger on GAME_OVER, integrated `PanelTransitionWrapper` for all modals, and connected persistent ghost visual state. |

---

## 4. Practice Mode Toggle Reactivity & Complementary Architecture

### Why Toggles Previously Appeared Delayed
- `PracticePanel.tsx` previously did not maintain local React state for `invincible`, `showGhostPaths`, `showTargetLines`, or `showGrid`.
- Clicking a button updated `engine.settings`, but the parent callback `onUpdate()` only called `setScore(engine.score)`. When score hadn't changed, React skipped re-rendering `PracticePanel`, causing toggles to only update visually when the panel was closed.
- **Fix**: Added local `useState` hooks for all toggles inside `PracticePanel` (`invincible`, `showGhostPaths`, `showTargetLines`, `showGrid`, `isPaused`) and wired them to immediate toggle handlers with instant visual state feedback and parent re-render triggering.

### Clarification: Practice Mode vs. Learn Mode (Complementary Roles)
- **Learn Mode ("AI Intelligence Lab - Conceptual Breakdown")**:
  - Focuses on **AI Rules & Targeting Mechanics**: Reticle crosshairs on the target tiles, Inky's pivot line and vector calculation, Clyde's 8-tile radius threshold circle, and personality dossier breakdowns with per-ghost toggles (Blinky, Pinky, Inky, Clyde).
- **Practice Mode ("Tactical Sandbox - Real-Time Trajectories & Radar")**:
  - **Tile Grid (`showGrid`)**: Renders the complete spatial tile grid and highlights decision intersection tiles (tiles with 3+ walkable exits where ghosts make turn choices).
  - **Ghost Paths (`showGhostPaths`)**: Replaces the former invisible 2.5px dot with a genuine **multi-step lookahead corridor trajectory (6-8 steps forward)**. Simulates future tiles and turn chevrons through upcoming intersections using `chooseNextGhostDirection`, letting players see exactly where ghosts will turn before they reach corners.
  - **Target Lines / Radar (`showTargetLines`)**: Transforms target lines into a **Tactical Distance & Proximity HUD**. Draws a high-tech vector laser with real-time Euclidean tile distance badges (`BLINKY: 5.2t`) and displays an emergency pulsing proximity alert (`⚠️ 3.4t PROXIMITY`) when any ghost gets within 5 tiles of Pac-Man.
  - Both modes can run independently or concurrently without conflict.

- **Game-Over Delay**: When Pac-Man loses all lives, "GAME OVER" text displays and after `uiConfig.timings.gameOverRestartDelayMs` (1.2s), the Restart Panel smoothly slides up.
- **Ghost Visualization Persistence**: Players can close the Learn panel, and target lines, reticles, Clyde's 8-tile radius, and Inky's pincer vector remain actively drawn on the game screen for any selected ghost(s).

---

## 5. Learn Mode Ghost Status Badges & Target Coordinates

- **Overhead Status Badges for All Active Ghosts**:
  - Each ghost (Blinky, Pinky, Inky, Clyde) now displays a crisp overhead pill badge:
    `[NAME] · [MODE] [targetCol, targetRow]`
    (e.g., `BLINKY · CHASE [14, 23]`, `PINKY · CHASE [18, 19]`, `INKY · SCATTER [27, 34]`, `CLYDE · FLEE [0, 34]`).
  - Adapts name in Ms. Pac-Man mode (e.g. `SUE`).
  - Dynamically flips below the ghost if near the top edge of the maze, and clamps horizontally so it never clips off-screen.
- **Reticle Coordinate Tag**:
  - The target reticle on the maze now additionally renders the target coordinates `[col, row]` directly above the crosshair in that ghost's color.
- **Separate from Practice Mode**:
  - Learn Mode displays the AI mechanics (identity, behavioral mode, and exact tile target).
  - Practice Mode displays tactical proximity radar (Euclidean distance meters and proximity warnings).

---

## 6. Eaten Eyes Pen Return & Back Wall Penetration Fix

### Root Cause
1. **Unbounded Lower-Half Revival Check in `gameEngine.ts`**:
   - The pen arrival check previously evaluated `if (Math.abs(g.x - doorX) <= 12 && g.y >= houseInsideY)`.
   - Because `houseInsideY` was `15.5 * TILE_SIZE`, whenever eaten eyes were in the lower half of the maze (rows 16–34) and crossed column 13 (`doorX`), `g.y >= houseInsideY` evaluated as `true` (e.g. `320px >= 248px` at row 20).
   - This caused the engine to instantly teleport the eyes upwards from the lower corridor into row 17, appearing to penetrate straight through the back wall.
2. **Targeting Coordinate Mismatch in `ghostAi.ts`**:
   - `calculateGhostTarget` for `mode === 'EATEN'` was previously hardcoded to `{ col: 13, row: 17 }` (inside the pen).
   - For eyes in the lower half, the shortest Euclidean distance to row 17 pulled them towards the back wall instead of routing them around the perimeter to the front door at row 14.

### Solution Implemented
1. **Two-Stage Doorstep & Pen Targeting (`src/game/ghostAi.ts`)**:
   - When outside the house entrance, the eyes now strictly target the **doorstep tile right above the door (`col: 13, row: 14`)**.
   - Because this tile is on the upper corridor, the shortest walkable path from the lower half forces the eyes to route around the side avenues (col 6 or 21) and enter from the front.
   - Only when the eyes arrive at the doorstep (row 14, cols 13–14) or pass through the gate (rows 15–16) does the target switch to `{ col: 13, row: 17 }` to descend into the pen.
2. **Directional Entry & Row Constraint (`src/game/gameEngine.ts`)**:
   - The revival trigger now strictly verifies that the eyes are aligned with the door columns (`cols 13–14`), are moving **`DOWN`**, and have descended into the pen interior (`row 17`).
   - Eyes moving in the lower half can never trigger revival and must travel around and enter through the front gate as intended in the classic arcade game.


