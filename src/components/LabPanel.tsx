import React from "react";
import type GameEngine from "../game/GameEngine";
import { LearnModeOverlay } from "./LearnModeOverlay";
import { PracticePanel } from "./PracticePanel";
import { DebugOverlayPanel } from "./DebugOverlayPanel";

export type LabTab = "LEARN" | "PRACTICE" | "DEBUG";

interface LabPanelProps {
  engine: GameEngine;
  tab: LabTab;
  onTab: (tab: LabTab) => void;
  onClose: () => void;
  /** Settings or state changed: refresh the HUD and redraw. */
  onUpdate: () => void;
  onVisualSettingsChange: () => void;
}

const TABS: Array<{ id: LabTab; label: string; devOnly?: boolean }> = [
  { id: "LEARN", label: "🎯 Learn" },
  { id: "PRACTICE", label: "🛠️ Practice" },
  { id: "DEBUG", label: "🔬 Debug", devOnly: true },
];

/**
 * The single dev/learning panel (plan T11): the Learn lab, the Practice sandbox and (dev builds)
 * the debug overlay switches, as tabs. The game is held while it is open.
 */
export const LabPanel: React.FC<LabPanelProps> = ({
  engine,
  tab,
  onTab,
  onClose,
  onUpdate,
  onVisualSettingsChange,
}) => {
  const tabs = TABS.filter((t) => !t.devOnly || import.meta.env.DEV);
  return (
    <div className="w-full max-w-[520px] max-h-[85vh] overflow-y-auto bg-neutral-950/95 border border-cyan-800/80 rounded-2xl p-4 text-xs font-mono text-neutral-300 shadow-2xl backdrop-blur-md flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-1">
          <span className="text-cyan-400 font-bold tracking-wider mr-2">🧪 LAB</span>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                tab === t.id
                  ? "bg-cyan-600 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] text-amber-400"
            title="The game is held while the Lab is open"
          >
            ⏸ paused
          </span>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white px-2 py-0.5 rounded hover:bg-neutral-800 font-bold"
            title="Close and play on (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {tab === "LEARN" && (
        <LearnModeOverlay
          engine={engine}
          onClose={onClose}
          onVisualSettingsChange={onVisualSettingsChange}
          embedded
        />
      )}
      {tab === "PRACTICE" && (
        <PracticePanel engine={engine} onUpdate={onUpdate} onClose={onClose} embedded />
      )}
      {tab === "DEBUG" && import.meta.env.DEV && (
        <DebugOverlayPanel engine={engine} onChange={onUpdate} />
      )}
    </div>
  );
};
