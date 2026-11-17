import { useSyncExternalStore } from "react";
import GameEvents from "../core/EventBus";
import type GameEngine from "../game/GameEngine";
import type { GameSettings } from "../types";

/**
 * Panels read `engine.settings` directly (plan O2): no React copy that could drift from the
 * engine. `useEngineSettings` re-renders the component when a setting changes through
 * `setSetting` / `settingsChanged`, and on `UI_SYNC` (state loaded or changed from outside).
 */

let version = 0;

function subscribe(onChange: () => void): () => void {
  const listener = () => {
    version++;
    onChange();
  };
  GameEvents.on("SETTINGS_CHANGED", listener);
  GameEvents.on("UI_SYNC", listener);
  return () => {
    GameEvents.off("SETTINGS_CHANGED", listener);
    GameEvents.off("UI_SYNC", listener);
  };
}

/** The engine's settings, kept current in the component. */
export function useEngineSettings(engine: GameEngine): GameSettings {
  useSyncExternalStore(subscribe, () => version);
  return engine.settings;
}

/** Tells the panels a setting changed (after writing one some other way). */
export function settingsChanged(): void {
  GameEvents.emit("SETTINGS_CHANGED");
}

/** Writes one setting and tells the panels. */
export function setSetting<K extends keyof GameSettings>(
  engine: GameEngine,
  key: K,
  value: GameSettings[K]
): void {
  engine.settings[key] = value;
  settingsChanged();
}
