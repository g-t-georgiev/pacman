import type { Direction } from "../types";
import { loadPreference, savePreference } from "./preferences";

/** Remappable movement keys (Phase 5): two slots per direction, defaults arrows and WASD. */
export type MoveDirection = Exclude<Direction, "NONE">;
export type KeyBindings = Record<MoveDirection, [string, string]>;

export const DEFAULT_BINDINGS: KeyBindings = {
  UP: ["ArrowUp", "w"],
  DOWN: ["ArrowDown", "s"],
  LEFT: ["ArrowLeft", "a"],
  RIGHT: ["ArrowRight", "d"],
};

/** Keys the game needs for itself: they can't be bound to a direction. */
export const RESERVED_KEYS = new Set([" ", "Escape", "F1", ".", ">", "Tab", "Enter"]);

const PREF_BINDINGS = "pacman.keyBindings";

/** Single characters compare case-insensitively (W = w); named keys as they are. */
function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function directionForKey(bindings: KeyBindings, key: string): MoveDirection | null {
  const k = normalizeKey(key);
  for (const dir of Object.keys(bindings) as MoveDirection[]) {
    if (bindings[dir].some((b) => b === k)) return dir;
  }
  return null;
}

/**
 * Binds `key` to slot `slot` of `dir`. A key bound elsewhere moves here (the other slot is
 * cleared to ""), so one key never means two directions. Reserved keys are refused (returns null).
 */
export function rebind(
  bindings: KeyBindings,
  dir: MoveDirection,
  slot: 0 | 1,
  key: string
): KeyBindings | null {
  if (RESERVED_KEYS.has(key)) return null;
  const k = normalizeKey(key);
  const next = structuredClone(bindings);
  for (const d of Object.keys(next) as MoveDirection[]) {
    next[d] = next[d].map((b) => (b === k ? "" : b)) as [string, string];
  }
  next[dir][slot] = k;
  return next;
}

export function loadBindings(): KeyBindings {
  const saved = loadPreference<KeyBindings>(PREF_BINDINGS);
  if (!saved) return structuredClone(DEFAULT_BINDINGS);
  const ok = (Object.keys(DEFAULT_BINDINGS) as MoveDirection[]).every(
    (d) => Array.isArray(saved[d]) && saved[d].length === 2
  );
  return ok ? saved : structuredClone(DEFAULT_BINDINGS);
}

export function saveBindings(bindings: KeyBindings): void {
  savePreference(PREF_BINDINGS, bindings);
}

/** How a key is shown in the options ("" = unbound). */
export function keyLabel(key: string): string {
  if (key === "") return "—";
  const names: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  return names[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}
