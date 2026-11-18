import React, { useState } from "react";
import type GameEngine from "../game/GameEngine";
import { sendGhostsHome, setInvincible as applyInvincible } from "../game/practiceActions";
import { setSetting, settingsChanged, useEngineSettings } from "../hooks/useEngineSettings";
import type { PracticeTools } from "../game/practiceTools";
import { ToggleCard } from "./ui/ToggleCard";

interface PracticePanelProps {
  engine: GameEngine;
  onUpdate: () => void;
  onClose: () => void;
  /** Inside the Lab panel: no frame or header of its own. */
  embedded?: boolean;
  /** Clips of the last seconds (T12): watch in the game, copy a link, download a file. */
  clips?: {
    watch: (seconds: number) => void;
    copyLink: (seconds: number) => Promise<string>;
    download: (seconds: number) => void;
  };
  /** Pattern recorder and first-death heatmap (Phase 5). */
  practice?: PracticeTools;
}

export const PracticePanel: React.FC<PracticePanelProps> = ({
  engine,
  onUpdate,
  onClose,
  embedded = false,
  clips,
  practice,
}) => {
  const [, refreshPractice] = useState(0);
  const [patternStatus, setPatternStatus] = useState<string>("");
  const [clipStatus, setClipStatus] = useState<string>("");
  // Read from the engine on every render (O2): no copies to keep in sync
  const settings = useEngineSettings(engine);
  const { gameSpeed: speed, showGhostPaths, showTargetLines, showGrid } = settings;
  const invincible = engine.rules.invincible;
  // Read from the engine on every render, so it is right however the state changed (R key...)
  const isScrubbing = engine.rewindIndex !== -1;

  const bufferLen = engine.timeline.length;
  const currentScrubIdx = engine.rewindIndex !== -1 ? engine.rewindIndex : bufferLen - 1;

  const handleSpeedChange = (val: number) => {
    setSetting(engine, "gameSpeed", val);
    onUpdate();
  };

  const handleToggleInvincible = () => {
    applyInvincible(engine, !engine.rules.invincible);
    settingsChanged();
    onUpdate();
  };

  const handleToggleGhostPaths = () => {
    setSetting(engine, "showGhostPaths", !showGhostPaths);
    onUpdate();
  };

  const handleToggleTargetLines = () => {
    setSetting(engine, "showTargetLines", !showTargetLines);
    onUpdate();
  };

  const handleToggleGrid = () => {
    setSetting(engine, "showGrid", !showGrid);
    onUpdate();
  };

  const handleRewindSeconds = (secs: number) => {
    engine.timeline.rewindSeconds(secs);
    onUpdate();
  };

  const handleScrub = (idx: number) => {
    engine.timeline.scrubTo(idx);
    onUpdate();
  };

  const handleResume = () => {
    engine.timeline.resume();
    onUpdate();
  };

  return (
    <div
      className={
        embedded
          ? "w-full text-xs font-mono text-neutral-300 flex flex-col gap-3"
          : "w-full max-w-[480px] bg-neutral-950/95 border border-emerald-800/80 rounded-xl p-4 text-xs font-mono text-neutral-300 shadow-2xl backdrop-blur-md flex flex-col gap-3"
      }
    >
      {/* Header */}
      {!embedded && (
        <div className="flex items-center justify-between border-b border-emerald-800/50 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-sm tracking-wider">
              🛠️ PRACTICE & REWIND SANDBOX
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">
              PRACTICE
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white px-2 py-0.5 rounded hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Playback & Speed Controls */}
      <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-neutral-300 font-semibold">GAME SPEED & SLOW-MO</span>
          <span className="text-emerald-400 font-bold tabular-nums">{speed.toFixed(2)}x</span>
        </div>

        <input
          type="range"
          min="0.1"
          max="2.0"
          step="0.05"
          value={speed}
          onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer"
        />

        <div className="flex items-center justify-between gap-1 text-[10px]">
          <button
            onClick={() => handleSpeedChange(0.25)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 0.25 ? "bg-emerald-600 text-white" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            0.25x Slow
          </button>
          <button
            onClick={() => handleSpeedChange(0.5)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 0.5 ? "bg-emerald-600 text-white" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            0.50x
          </button>
          <button
            onClick={() => handleSpeedChange(1.0)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 1.0 ? "bg-emerald-600 text-white" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            1.0x Normal
          </button>
          <button
            onClick={() => handleSpeedChange(1.5)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 1.5 ? "bg-emerald-600 text-white" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            1.5x Fast
          </button>
        </div>
      </div>

      {/* Rewind Scrubber */}
      <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-neutral-300 font-semibold">REWIND BUFFER</span>
            <span className="text-[10px] text-neutral-400">
              ({(bufferLen / 60).toFixed(1)}s recorded)
            </span>
          </div>
          {isScrubbing && (
            <button
              onClick={handleResume}
              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow"
            >
              ▶ Resume from Here
            </button>
          )}
        </div>

        {/* Scrub Slider */}
        <input
          type="range"
          min="0"
          max={Math.max(0, bufferLen - 1)}
          value={currentScrubIdx}
          disabled={bufferLen <= 1}
          onChange={(e) => handleScrub(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-500 cursor-pointer disabled:opacity-50"
        />

        <div className="flex items-center justify-between gap-1 text-[10px]">
          <span className="text-neutral-500">Pause: Space or ⏸ in the HUD</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleRewindSeconds(2)}
              disabled={bufferLen < 120}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40"
              title="Rewind 2 seconds"
            >
              ⏪ -2s
            </button>
            <button
              onClick={() => handleRewindSeconds(5)}
              disabled={bufferLen < 300}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40"
              title="Rewind 5 seconds"
            >
              ⏪ -5s
            </button>
            <button
              onClick={() => handleRewindSeconds(10)}
              disabled={bufferLen < 600}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40"
              title="Rewind 10 seconds"
            >
              ⏪ -10s
            </button>
          </div>
        </div>
      </div>

      {/* Patterns and the first-death heatmap (Phase 5) */}
      {practice && (
        <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
          <span className="font-bold text-yellow-300">
            🧭 Patterns &amp; heatmap · level {engine.level}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                const frames = practice.savePattern(engine);
                setPatternStatus(
                  frames > 0
                    ? `Saved this life's route (${(frames / 60).toFixed(1)} s) as the level ${engine.level} pattern.`
                    : "Nothing recorded yet in this life."
                );
                refreshPractice((n) => n + 1);
              }}
              className="py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
            >
              Save route as pattern
            </button>
            <button
              onClick={() => {
                practice.showPattern = !practice.showPattern;
                refreshPractice((n) => n + 1);
                onUpdate();
              }}
              aria-pressed={practice.showPattern}
              className={`py-1.5 rounded ${practice.showPattern ? "bg-yellow-500 text-black font-bold" : "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"}`}
            >
              {practice.pattern(engine) ? "Show pattern" : "Show pattern (none saved)"}
            </button>
            <button
              onClick={() => {
                practice.showHeatmap = !practice.showHeatmap;
                refreshPractice((n) => n + 1);
                onUpdate();
              }}
              aria-pressed={practice.showHeatmap}
              className={`py-1.5 rounded ${practice.showHeatmap ? "bg-red-600 text-white font-bold" : "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"}`}
            >
              First-death heatmap ({practice.deathsHere(engine).length})
            </button>
            <button
              onClick={() => {
                practice.clearPattern(engine);
                practice.clearDeaths(engine);
                setPatternStatus("Cleared this level's pattern and this mode's heatmap.");
                refreshPractice((n) => n + 1);
                onUpdate();
              }}
              className="py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
            >
              Clear
            </button>
          </div>
          <span className="text-[10px] text-neutral-400 leading-snug">
            {patternStatus ||
              "The game is deterministic: replay a saved route frame for frame and the ghosts do the same. The yellow dot shows where the pattern was at this moment of the life."}
          </span>
        </div>
      )}

      {/* Clips of the last 20 seconds (T12) */}
      {clips && (
        <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-semibold">CLIP: LAST 20 S</span>
            {clipStatus && <span className="text-[10px] text-emerald-400">{clipStatus}</span>}
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <button
              onClick={() => clips.watch(20)}
              className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white font-bold"
            >
              🎬 Watch
            </button>
            <button
              onClick={() => {
                clips
                  .copyLink(20)
                  .then((status) => setClipStatus(status))
                  .catch(() => setClipStatus("could not copy"));
              }}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
            >
              🔗 Copy link
            </button>
            <button
              onClick={() => {
                clips.download(20);
                setClipStatus("saved as a .json file");
              }}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
            >
              💾 Download
            </button>
          </div>
        </div>
      )}

      {/* Visualizers & Cheats Toggles */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <ToggleCard
          icon="🛡️"
          label="Invincibility"
          hint="Pac-Man impervious to ghost contact"
          on={invincible}
          onClick={handleToggleInvincible}
          tone="amber"
        />
        <ToggleCard
          icon="🧭"
          label="Ghost Paths"
          hint="Multi-step corridor lookahead & turn arrows"
          on={showGhostPaths}
          onClick={handleToggleGhostPaths}
          tone="cyan"
        />
        <ToggleCard
          icon="📏"
          label="Target Radar"
          hint="Laser vector, tile distance & proximity alert"
          on={showTargetLines}
          onClick={handleToggleTargetLines}
          tone="purple"
        />
        <ToggleCard
          icon="📐"
          label="Tile Grid"
          hint="Maze tile grid & decision intersections"
          on={showGrid}
          onClick={handleToggleGrid}
          tone="blue"
        />
      </div>

      {/* Instant Action Triggers */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-neutral-800 text-[10px]">
        <button
          onClick={() => {
            engine.triggerFrightenedMode();
            onUpdate();
          }}
          className="flex-1 px-2 py-1.5 rounded bg-blue-900/60 border border-blue-700/60 hover:bg-blue-800/80 text-blue-200 font-semibold text-center"
        >
          ⚡ Frighten Ghosts
        </button>

        <button
          onClick={() => {
            engine.spawnFruit();
            onUpdate();
          }}
          className="flex-1 px-2 py-1.5 rounded bg-amber-900/60 border border-amber-700/60 hover:bg-amber-800/80 text-amber-200 font-semibold text-center"
        >
          🍒 Spawn Fruit
        </button>

        <button
          onClick={() => {
            sendGhostsHome(engine);
            onUpdate();
          }}
          className="flex-1 px-2 py-1.5 rounded bg-red-900/60 border border-red-700/60 hover:bg-red-800/80 text-red-200 font-semibold text-center"
        >
          🏠 Reset Ghosts
        </button>
      </div>
    </div>
  );
};
