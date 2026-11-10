import React, { useState } from "react";
import type GameEngine from "../game/GameEngine";
import type { DebugLayers } from "../types";
import { DEBUG_LAYER_LABELS } from "../game/debugOverlay";

interface DebugOverlayPanelProps {
  engine: GameEngine;
  onClose: () => void;
}

/**
 * Dev builds: the debug overlay's layer switches (plan T1). F1 shows and hides the overlay;
 * while paused, "." steps one frame and ">" steps to the next mode change (T3).
 * T11 folds this into the single dev panel.
 */
export const DebugOverlayPanel: React.FC<DebugOverlayPanelProps> = ({ engine, onClose }) => {
  // Read from the engine on every render, so changes from the agent driver show up too
  const layers = engine.settings.debugLayers;
  const [, rerender] = useState(0);

  const toggle = (key: keyof DebugLayers) => {
    engine.settings.debugLayers = { ...layers, [key]: !layers[key] };
    rerender((n) => n + 1);
  };

  return (
    <div className="fixed top-20 right-3 z-40 w-[210px] bg-neutral-950/95 border border-cyan-800/80 rounded-lg p-2.5 text-[11px] font-mono text-neutral-300 shadow-2xl">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-cyan-400 font-bold tracking-wider">DEBUG OVERLAY</span>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-white px-1"
          title="Hide overlay (F1)"
        >
          ✕
        </button>
      </div>
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
      <div className="mt-1.5 pt-1.5 border-t border-neutral-800 text-[10px] text-neutral-500 leading-relaxed">
        F1 hide · Space pause
        <br />
        paused: <span className="text-neutral-300">.</span> 1 frame ·{" "}
        <span className="text-neutral-300">&gt;</span> next mode change
      </div>
    </div>
  );
};
