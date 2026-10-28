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

## 3. Verification & Results

- **`compile_applet`**: Build succeeded cleanly with Vite and TypeScript.
- **`lint_applet`**: Passed with 0 errors (`tsc --noEmit`).
- **Timing & Transitions**: Modals appear centered in the visible viewport with smooth fade-slide-up transitions, and can be customized per panel ID in `ui.config.ts`.
- **Game-Over Delay**: When Pac-Man loses all lives, "GAME OVER" text displays and after `uiConfig.timings.gameOverRestartDelayMs` (1.2s), the Restart Panel smoothly slides up.
- **Ghost Visualization Persistence**: Players can close the Learn panel, and target lines, reticles, Clyde's 8-tile radius, and Inky's pincer vector remain actively drawn on the game screen for any selected ghost(s).
