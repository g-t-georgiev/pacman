import React, { useState } from "react";
import type GameEngine from "../game/GameEngine";
import type { DebugLayers } from "../types";
import { DEBUG_LAYER_LABELS } from "../game/debugOverlay";

interface DebugOverlayPanelProps {
  engine: GameEngine;
  /** Redraw after a change (the game may be paused). */
  onChange: () => void;
}

/**
 * The Lab panel's Debug tab (dev builds; plan T1, T11): the overlay's master switch (also F1)
 * and its layers. While paused, "." steps one frame and ">" steps to the next mode change.
 */
export const DebugOverlayPanel: React.FC<DebugOverlayPanelProps> = ({ engine, onChange }) => {
  // Read from the engine on every render, so changes from the agent driver show up too
  const layers = engine.settings.debugLayers;
  const [, rerender] = useState(0);
  const update = () => {
    rerender((n) => n + 1);
    onChange();
  };

  const toggle = (key: keyof DebugLayers) => {
    engine.settings.debugLayers = { ...layers, [key]: !layers[key] };
    update();
  };

  return (
    <div className="w-full text-[11px] font-mono text-neutral-300 flex flex-col gap-1">
      <label className="flex items-center gap-2 py-1 cursor-pointer select-none text-cyan-300 font-bold">
        <input
          type="checkbox"
          checked={engine.settings.debugOverlay}
          onChange={() => {
            engine.settings.debugOverlay = !engine.settings.debugOverlay;
            update();
          }}
          className="accent-cyan-500"
        />
        Show debug overlay (F1)
      </label>
      <div className="grid grid-cols-2 gap-x-3 pl-1">
        {(Object.keys(DEBUG_LAYER_LABELS) as Array<keyof DebugLayers>).map((key) => (
          <label key={key} className="flex items-center gap-2 py-0.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => toggle(key)}
              className="accent-cyan-500"
            />
            {DEBUG_LAYER_LABELS[key]}
          </label>
        ))}
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-neutral-800 text-[10px] text-neutral-500 leading-relaxed">
        F1 overlay on/off · Space pause · while paused: <span className="text-neutral-300">.</span>{" "}
        1 frame, <span className="text-neutral-300">&gt;</span> next mode change
      </div>
    </div>
  );
};
