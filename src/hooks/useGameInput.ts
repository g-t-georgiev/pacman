import { type MutableRefObject, useEffect, useRef } from "react";
import type React from "react";
import type GameEngine from "../game/GameEngine";
import type { GameRunner } from "../game/GameRunner";
import type { Direction } from "../types";
import type { LabTab } from "../components/LabPanel";
import { type KeyBindings, directionForKey } from "../utils/keyBindings";

/** What the keys do besides moving; read through a ref so the handler is registered once. */
export interface InputActions {
  anyPanelOpen: () => boolean;
  labOpen: () => boolean;
  togglePause: () => void;
  closeAllPanels: () => void;
  toggleLab: (tab: LabTab) => void;
  toggleTurbo: () => void;
  exitReplay: () => void;
  refresh: () => void;
}

/**
 * All player input (plan M3): the keyboard (remappable movement keys first, then the shortcuts,
 * and the dev keys), touch swipes, and the gamepad (polled before every tick). Inputs are stamped
 * for the latency readout.
 */
export function useGameInput(
  engineRef: MutableRefObject<GameEngine | null>,
  runnerRef: MutableRefObject<GameRunner | null>,
  bindingsRef: MutableRefObject<KeyBindings>,
  actions: InputActions
) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const act = actionsRef.current;

      // No page scrolling on the arrow keys or Space
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }

      // Watching a replay: Space plays/pauses it, Escape leaves (or closes an open panel first)
      const viewer = runnerRef.current?.viewer;
      if (viewer?.state.active && !act.anyPanelOpen() && (e.key === " " || e.key === "Escape")) {
        if (e.key === " ") {
          if (viewer.state.playing) viewer.pause();
          else viewer.play();
        } else {
          act.exitReplay();
        }
        act.refresh();
        return;
      }

      // Dev builds: debug overlay (F1) and frame stepping while paused (plan T1, T3)
      if (import.meta.env.DEV) {
        const runner = runnerRef.current;
        if (e.key === "F1") {
          e.preventDefault(); // not the browser's help page
          engine.settings.debugOverlay = !engine.settings.debugOverlay;
          runner?.renderer?.render(engine);
          act.refresh();
          return;
        }
        if (runner && (e.key === "." || e.key === ">")) {
          if (e.key === ".") {
            runner.stepWhilePaused(1);
          } else {
            // Next mode change: a scatter/chase switch, or frightened starting or ending
            const wave = engine.timerController.waveIndex;
            const fright = engine.frightenedGlobalTimer > 0;
            runner.stepWhilePaused(
              20 * 60 * 60,
              () =>
                engine.timerController.waveIndex !== wave ||
                engine.frightenedGlobalTimer > 0 !== fright
            );
          }
          act.refresh();
          return;
        }
      }

      // Movement keys (remappable, Options panel) come before the letter shortcuts
      const moveDir = directionForKey(bindingsRef.current, e.key);
      if (moveDir) {
        e.preventDefault();
        runnerRef.current?.latency.onInput(e.timeStamp);
        engine.setInputDirection(moveDir);
        return;
      }

      switch (e.key) {
        case " ":
          act.togglePause();
          break;
        case "Escape":
          // Close what is open; with nothing open, pause or resume
          if (act.anyPanelOpen()) act.closeAllPanels();
          else act.togglePause();
          break;
        case "t":
        case "T":
          act.toggleTurbo();
          break;
        case "l":
        case "L":
          act.toggleLab("LEARN");
          break;
        case "p":
        case "P":
          act.toggleLab("PRACTICE");
          break;
        case "r":
        case "R":
          if (act.labOpen()) {
            // In the Lab: scrub back 2 s; "Resume from Here" (or closing the Lab) plays on
            engine.timeline.rewindSeconds(2);
            act.refresh();
          } else if (act.anyPanelOpen()) {
            // E.g. the Restart panel after a game over: back to 2 s before the fatal collision,
            // then hold there (your pause) with the board in view; press Space when ready.
            // The round phase, not playState: an open panel makes playState read "PAUSED"
            if (engine.phase === "GAME_OVER" || engine.phase.startsWith("DEATH_")) {
              engine.timeline.rewindBeforeDeath(2);
            } else {
              engine.timeline.rewindSeconds(2);
            }
            engine.timeline.resume();
            runnerRef.current?.setPaused("user", true);
            act.refresh();
          }
          break;
      }
    };

    // Letting go of a direction (only matters with "release clears the turn")
    const handleKeyUp = (e: KeyboardEvent) => {
      const dir = directionForKey(bindingsRef.current, e.key);
      if (dir) engineRef.current?.releaseInputDirection(dir);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [engineRef, runnerRef, bindingsRef]);

  // Touch swipes
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) {
      if (Math.abs(dx) > Math.abs(dy)) {
        engineRef.current?.setInputDirection(dx > 0 ? "RIGHT" : "LEFT");
      } else {
        engineRef.current?.setInputDirection(dy > 0 ? "DOWN" : "UP");
      }
    }
    touchStartRef.current = null;
  };

  // Gamepads: polled before every tick (the runner's onPreUpdate)
  const lastGamepadDirRef = useRef<Direction>("NONE");
  const pollGamepads = (engine: GameEngine) => {
    if (typeof navigator.getGamepads !== "function") return;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;
    for (const gp of gamepads) {
      if (!gp) continue;
      let dir: Direction = "NONE";
      // D-pad buttons: 12 (up), 13 (down), 14 (left), 15 (right)
      if (gp.buttons[12]?.pressed || gp.axes[1] < -0.4) dir = "UP";
      else if (gp.buttons[13]?.pressed || gp.axes[1] > 0.4) dir = "DOWN";
      else if (gp.buttons[14]?.pressed || gp.axes[0] < -0.4) dir = "LEFT";
      else if (gp.buttons[15]?.pressed || gp.axes[0] > 0.4) dir = "RIGHT";

      if (dir !== "NONE" && dir !== lastGamepadDirRef.current) {
        lastGamepadDirRef.current = dir;
        runnerRef.current?.latency.onInput(performance.now());
        engine.setInputDirection(dir);
      } else if (dir === "NONE" && lastGamepadDirRef.current !== "NONE") {
        engine.releaseInputDirection(lastGamepadDirRef.current);
        lastGamepadDirRef.current = "NONE";
      }
    }
  };

  return { onTouchStart, onTouchEnd, pollGamepads };
}
