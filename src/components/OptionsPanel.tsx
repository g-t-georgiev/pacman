import React, { useEffect, useState } from "react";
import {
  DEFAULT_BINDINGS,
  type KeyBindings,
  type MoveDirection,
  RESERVED_KEYS,
  keyLabel,
  rebind,
} from "../utils/keyBindings";

interface OptionsPanelProps {
  bindings: KeyBindings;
  onChangeBindings: (bindings: KeyBindings) => void;
  reducedFlash: boolean;
  onToggleReducedFlash: () => void;
  colorblindPalette: boolean;
  onToggleColorblindPalette: () => void;
  onClose: () => void;
}

const DIRECTIONS: Array<{ dir: MoveDirection; label: string }> = [
  { dir: "UP", label: "Up" },
  { dir: "DOWN", label: "Down" },
  { dir: "LEFT", label: "Left" },
  { dir: "RIGHT", label: "Right" },
];

/**
 * Player options (Phase 5, accessibility): movement keys, reduced flashing, colorblind-safe
 * colors. Remembered in this browser. Like every panel, it holds the game while open.
 */
export const OptionsPanel: React.FC<OptionsPanelProps> = ({
  bindings,
  onChangeBindings,
  reducedFlash,
  onToggleReducedFlash,
  colorblindPalette,
  onToggleColorblindPalette,
  onClose,
}) => {
  /** The slot waiting for a key press, if any. */
  const [capturing, setCapturing] = useState<{ dir: MoveDirection; slot: 0 | 1 } | null>(null);
  const [message, setMessage] = useState<string>("");

  // While capturing, the next key press is the new binding (and nothing else sees it)
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        setMessage("");
        return;
      }
      const next = rebind(bindings, capturing.dir, capturing.slot, e.key);
      if (!next) {
        setMessage(`"${keyLabel(e.key)}" is used by the game itself; pick another key.`);
        return;
      }
      onChangeBindings(next);
      setCapturing(null);
      setMessage("");
    };
    window.addEventListener("keydown", onKey, true); // capture: before the game's own handler
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, bindings, onChangeBindings]);

  const toggle = (on: boolean, onClick: () => void, label: string, hint: string) => (
    <label className="flex items-start gap-2 text-xs text-neutral-200 cursor-pointer">
      <input type="checkbox" checked={on} onChange={onClick} className="mt-0.5 accent-cyan-400" />
      <span>
        <span className="font-bold">{label}</span>
        <span className="block text-[11px] text-neutral-400 leading-snug">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="relative w-full max-w-[480px] bg-neutral-950 border border-neutral-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-white font-mono">
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-widest text-cyan-300">OPTIONS</h2>
        <p className="text-xs text-neutral-400">Controls and display, saved in this browser</p>
      </div>

      <section className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
        <span className="font-bold text-xs text-cyan-300">MOVEMENT KEYS</span>
        <div className="grid grid-cols-[4rem_1fr_1fr] gap-1.5 items-center text-xs">
          {DIRECTIONS.map(({ dir, label }) => (
            <React.Fragment key={dir}>
              <span className="text-neutral-300">{label}</span>
              {([0, 1] as const).map((slot) => {
                const waiting = capturing?.dir === dir && capturing.slot === slot;
                return (
                  <button
                    key={slot}
                    onClick={() => {
                      setCapturing({ dir, slot });
                      setMessage("");
                    }}
                    aria-label={`${label} key ${slot + 1}: ${keyLabel(bindings[dir][slot])}. Press to change.`}
                    className={`py-1 rounded border font-bold transition-colors ${
                      waiting
                        ? "bg-cyan-900 border-cyan-400 text-cyan-100 animate-pulse"
                        : "bg-neutral-950 border-neutral-700 hover:border-neutral-500"
                    }`}
                  >
                    {waiting ? "press a key…" : keyLabel(bindings[dir][slot])}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
          <span>
            {message ||
              (capturing
                ? "Press the new key (Escape cancels)."
                : "Click a key to change it. A key moved here leaves its old slot.")}
          </span>
          <button
            onClick={() => {
              onChangeBindings(structuredClone(DEFAULT_BINDINGS));
              setCapturing(null);
              setMessage("");
            }}
            className="shrink-0 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
          >
            Reset
          </button>
        </div>
        <p className="text-[10px] text-neutral-500 leading-snug">
          Reserved: {[...RESERVED_KEYS].map((k) => (k === " " ? "Space" : k)).join(", ")}. Movement
          keys take priority over the letter shortcuts (T, L, P, R).
        </p>
      </section>

      <section className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3">
        <span className="font-bold text-xs text-cyan-300">DISPLAY</span>
        {toggle(
          reducedFlash,
          onToggleReducedFlash,
          "Reduce flashing",
          "No strobing: the maze stays a steady pale color when a level is cleared, energizers stop pulsing, and frightened ghosts get a steady white outline instead of blinking near the end."
        )}
        {toggle(
          colorblindPalette,
          onToggleColorblindPalette,
          "Colorblind-safe colors",
          "Ghost colors that stay distinct with red-green or blue-yellow color blindness, and a darker frightened blue."
        )}
      </section>

      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold tracking-widest uppercase"
      >
        Done
      </button>
    </div>
  );
};
